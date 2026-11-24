"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { browserStore, type Store } from "@/lib/assistant/history";
import { copyText, download } from "@/lib/browser";
import { fmtDay } from "@/lib/notes/calls";
import { crmToCsv, crmToJson, toCrm } from "@/lib/notes/crm";
import { extractNotes } from "@/lib/notes/extract";
import { profileFromNote, SCREEN_PREFILL_KEY } from "@/lib/notes/handoff";
import { noteToMarkdown } from "@/lib/notes/markdown";
import { findInTranscript } from "@/lib/notes/quote";
import { ruleCheck } from "@/lib/notes/rules";
import { deleteNote, loadNotes, saveNotes, upsertNote, type SavedNote } from "@/lib/notes/store";
import type { NoteResult } from "@/lib/notes/types";
import { MSG, speechSupported, useRecorder } from "@/lib/notes/useRecorder";

const LANGS = [["en-GB", "English (UK)"], ["en-US", "English (US)"], ["en-IN", "English (India)"]] as const;
const MIC = "M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z";
const STOP = "M6 6h12v12H6z";
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const tidyLine = (s: string) => { const t = s.replace(/\s+/g, " ").trim(); if (!t) return ""; const c = t.charAt(0).toUpperCase() + t.slice(1); return /[.!?]$/.test(c) ? c : c + "."; };
const COUNTRY: Record<string, string> = { NL: "Netherlands", DE: "Germany", EU: "EU (other member state)", OTHER: "Outside the EU" };
const FACT_ROWS: [keyof NoteResult["facts"], string][] = [["company", "Company"], ["country", "Country"], ["region", "Region"], ["size", "Size"], ["sector", "Sector"], ["activity", "What they do"], ["project", "Project"], ["amount", "Budget"], ["timing", "Timing"], ["ordered", "Ordered or started"], ["previous", "Previous funding"], ["decision", "Decision-maker"]];
const Ico = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={d} /></svg>;

function Meter({ levelRef, active }: { levelRef: MutableRefObject<number>; active: boolean }) {
  const bars = useRef<(HTMLElement | null)[]>([]); const hist = useRef<number[]>(Array(32).fill(0.06));
  useEffect(() => {
    if (!active) { bars.current.forEach((b) => b && (b.style.transform = "scaleY(.06)")); hist.current.fill(0.06); return; }
    let raf = 0, last = 0;
    const loop = (t: number) => { if (t - last > 55) { last = t; hist.current.push(Math.max(0.06, levelRef.current)); hist.current.shift(); hist.current.forEach((v, i) => { const b = bars.current[i]; if (b) b.style.transform = `scaleY(${v})`; }); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [active, levelRef]);
  return <div className={`meter${active ? " hot" : ""}`} aria-hidden="true">{Array.from({ length: 32 }, (_, i) => <b key={i} ref={(el) => { bars.current[i] = el; }} />)}</div>;
}
/** Hovering or focusing an evidence chip previews the passage in the transcript. */
const HoverCtx = createContext<(q: string | null) => void>(() => {});
function Quote({ q, active, onPick }: { q: string | null | undefined; active: string | null; onPick: (q: string) => void }) {
  const hover = useContext(HoverCtx); if (!q) return null; const short = q.length > 70 ? q.slice(0, 68).trimEnd() + "…" : q;
  return <button type="button" className="qchip" aria-pressed={active === q} aria-label={`Show where this was said: ${q}`} onClick={() => onPick(q)} onMouseEnter={() => hover(q)} onMouseLeave={() => hover(null)} onFocus={() => hover(q)} onBlur={() => hover(null)}>“{short}”</button>;
}

export default function Notes() {
  const router = useRouter();
  const [title, setTitle] = useState(""); const [transcript, setTranscript] = useState(""); const [interim, setInterim] = useState(""); const [analysed, setAnalysed] = useState("");
  const [jot, setJot] = useState(""); const [editing, setEditing] = useState(false); const [typing, setTyping] = useState(false); const [err, setErr] = useState<string | null>(null); const [announce, setAnnounce] = useState("");
  const [lang, setLang] = useState("en-GB"); const [supported, setSupported] = useState(true); const [created, setCreated] = useState(0);
  const [saved, setSaved] = useState<SavedNote[]>([]); const [activeId, setActiveId] = useState(() => uid()); const [edits, setEdits] = useState<Record<string, string>>({});
  const [toNotes, setToNotes] = useState(false); const [hoverQ, setHoverQ] = useState<string | null>(null); const [crmOpen, setCrmOpen] = useState(false); const [quote, setQuote] = useState<string | null>(null); const [copied, setCopied] = useState("");
  const [status, setStatus] = useState<{ live: boolean; needsCode: boolean } | null>(null); const [code, setCode] = useState("");
  const [enh, setEnh] = useState<{ note: NoteResult; kept: number; dropped: number } | null>(null); const [enhState, setEnhState] = useState<"idle" | "busy" | "failed">("idle"); const [enhMsg, setEnhMsg] = useState("");
  const store = useRef<Store | null>(null); const savedRef = useRef<SavedNote[]>([]); const trRef = useRef(""); const inRef = useRef(""); const markRef = useRef<HTMLElement>(null); const liveRef = useRef<HTMLDivElement>(null); const crmRef = useRef<HTMLDivElement>(null); const docRef = useRef<HTMLDivElement>(null);
  trRef.current = transcript; inRef.current = interim;

  const rec = useRecorder({
    lang, onFinal: (t) => { const l = tidyLine(t); if (l) setTranscript((p) => (p ? p + "\n" + l : l)); setInterim(""); }, onInterim: setInterim, onError: (m) => setErr(m),
    onStopped: () => {
      const tail = inRef.current ? tidyLine(inRef.current) : ""; const full = (trRef.current + (tail ? (trRef.current ? "\n" : "") + tail : "")).trim(); setInterim(""); setTranscript(full);
      if (full.length >= 15) { setAnalysed(full); setToNotes(true); setAnnounce("Recording stopped. Your notes are ready."); } else { setErr((e) => e ?? "We did not hear enough to write notes. Check the level meter moves when you speak, then try again, or paste a transcript."); setAnnounce("Recording stopped. Nothing was captured."); }
    },
  });
  const recording = rec.state === "recording"; const busy = rec.state !== "idle";

  useEffect(() => {
    store.current = browserStore(); const n = loadNotes(store.current); savedRef.current = n; setSaved(n); setSupported(speechSupported());
    const hid = decodeURIComponent(window.location.hash.slice(1)); const hit = hid ? n.find((x) => x.id === hid) : undefined; if (hit) openSaved(hit); else setCreated(Date.now()); // a row in the Calls table opens its notes
    try { const l = localStorage.getItem("gf-notes-lang"); if (l && LANGS.some(([c]) => c === l)) setLang(l); } catch { /* ignore */ }
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ live: false, needsCode: false }));
  }, []);
  const note = useMemo(() => (analysed.trim().length >= 15 ? extractNotes(analysed) : null), [analysed]);
  useEffect(() => { setEnh(null); setEnhState("idle"); setEnhMsg(""); setQuote(null); }, [analysed]);
  const shown = enh?.note ?? note; const when = created ? fmtDay(created) : "";
  const rules = useMemo(() => (shown ? ruleCheck(shown) : null), [shown]);
  const crmBase = useMemo(() => (shown ? toCrm(shown, { title: title.trim(), date: when }) : []), [shown, title, when]);
  const crm = crmBase.map((f) => ({ ...f, value: edits[f.key] ?? f.value, edited: edits[f.key] !== undefined && edits[f.key] !== f.value }));
  const profile = useMemo(() => (shown ? profileFromNote(shown, title.trim()) : null), [shown, title]);
  useEffect(() => { // save in this browser (local only)
    if (!analysed.trim()) return; const next = upsertNote(savedRef.current, { id: activeId, title: title.trim() || "Untitled call", created: created || Date.now(), updated: Date.now(), transcript: analysed, jottings: jot, edits }); savedRef.current = next; setSaved(next); saveNotes(next, store.current);
  }, [analysed, title, jot, edits, activeId, created]);
  useEffect(() => { if (quote && markRef.current) markRef.current.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }, [quote]);
  useEffect(() => { // on a phone the notes sit below the controls, so bring them into view once they exist
    if (!toNotes || !shown) return; setToNotes(false); if (window.matchMedia("(max-width: 960px)").matches) docRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [toNotes, shown]);
  const toggleRef = useRef<() => void>(() => {});
  useEffect(() => { // R starts and stops recording when you are not typing
    const on = (e: globalThis.KeyboardEvent) => { if (e.key.toLowerCase() !== "r" || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return; const t = e.target as HTMLElement | null; if (t?.closest("input,textarea,select,[contenteditable]") || (t?.closest("button,a") && !t.closest(".recbtn"))) return; e.preventDefault(); toggleRef.current(); };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, []);
  useEffect(() => { if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight; }, [transcript, interim]);
  useEffect(() => { if (crmOpen) crmRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [crmOpen]);

  const toggleRec = () => { setErr(null); if (recording) rec.stop(); else if (rec.state === "idle") { setCrmOpen(false); void rec.start(); setAnnounce("Recording started."); } };
  toggleRef.current = toggleRec;
  const goCalls = () => { try { sessionStorage.setItem("gf-calls-focus", activeId); } catch { /* ignore */ } };
  const reset = () => { setTitle(""); setTranscript(""); setInterim(""); setAnalysed(""); setJot(""); setEdits({}); setCrmOpen(false); setEditing(false); setErr(null); setActiveId(uid()); setCreated(Date.now()); setQuote(null); };
  const useSample = () => { reset(); setTitle("Sample call: heat pump project"); const lines = [tidyLine("we're a 40 person manufacturer in gelderland we want to replace our gas heating with heat pumps around 300 thousand euros"), tidyLine("we haven't ordered anything yet they'd like to start in spring and the decision sits with the finance director"), tidyLine("next step is a follow up call on thursday")]; const full = lines.join("\n"); setTranscript(full); setAnalysed(full); setToNotes(true); setAnnounce("Sample call loaded. Your notes are ready."); };
  const openSaved = (n: SavedNote) => { setActiveId(n.id); setCreated(n.created); setTitle(n.title === "Untitled call" ? "" : n.title); setTranscript(n.transcript); setAnalysed(n.transcript); setJot(n.jottings); setEdits(n.edits); setCrmOpen(false); setEditing(false); setErr(null); };
  const removeSaved = (id: string) => { const next = deleteNote(savedRef.current, id); savedRef.current = next; setSaved(next); saveNotes(next, store.current); if (id === activeId) reset(); };
  const clearAll = () => { if (!window.confirm("Delete all saved notes from this browser?")) return; savedRef.current = []; setSaved([]); saveNotes([], store.current); reset(); };
  const flash = (k: string) => { setCopied(k); window.setTimeout(() => setCopied((c) => (c === k ? "" : c)), 1800); };
  const mdOf = () => noteToMarkdown(title.trim() || "Call notes", when, shown!, { rules: rules ?? undefined, crm: crmOpen ? crm : undefined, jottings: jot, transcript: analysed });
  const doneEditing = () => { setEditing(false); setTyping(false); const t = transcript.trim(); setTranscript(t); setAnalysed(t.length >= 15 ? t : ""); };
  const showEdit = !busy && (editing || typing || !transcript);
  useEffect(() => { // while typing or pasting, the notes follow after a short pause
    if (!showEdit) return; const id = window.setTimeout(() => { const t = transcript.trim(); setAnalysed(t.length >= 15 ? t : ""); }, 600); return () => window.clearTimeout(id);
  }, [showEdit, transcript]);
  const goScreen = () => { if (!profile) return; try { sessionStorage.setItem(SCREEN_PREFILL_KEY, JSON.stringify({ ...profile, signals: "" })); } catch { /* ignore */ } router.push("/screen"); };
  const enhance = useCallback(async () => {
    setEnhState("busy"); setEnhMsg("");
    try {
      const res = await fetch("/api/notes", { method: "POST", headers: { "content-type": "application/json", ...(code ? { "x-access-code": code } : {}) }, body: JSON.stringify({ transcript: analysed, jottings: jot }) }); const d = await res.json().catch(() => ({}));
      if (!res.ok) { setEnhState("failed"); setEnhMsg(typeof d.error === "string" ? d.error : "Could not enhance the notes."); return; }
      if (d.reason === "unreadable" || !d.note) { setEnhState("failed"); setEnhMsg("Claude's reply could not be used, so the instant notes stay."); return; }
      if (d.kept === 0) { setEnhState("failed"); setEnhMsg("Nothing Claude wrote could be verified against the transcript, so the instant notes stay."); return; }
      setEnh({ note: d.note, kept: d.kept, dropped: d.dropped }); setEnhState("idle");
    } catch { setEnhState("failed"); setEnhMsg("Could not reach the server."); }
  }, [analysed, jot, code]);

  const status_ = rec.state === "idle" ? (note ? "Notes ready" : "Ready") : rec.state === "starting" ? "Starting" : rec.state === "stopping" ? "Finishing" : "Listening";
  const view = (() => { const hl = quote ?? hoverQ; const p = hl && !editing ? findInTranscript(transcript, hl) : null; return p ? [transcript.slice(0, p.start), transcript.slice(p.start, p.end), transcript.slice(p.end)] : null; })();
  const factVal = (k: keyof NoteResult["facts"]) => { const f = shown?.facts[k]; if (!f) return null; if (k === "country") return COUNTRY[f.value] ?? f.value; if (k === "size") return shown?.nums.employees ? `${f.value} (${shown.nums.employees.toLocaleString("en-GB")} staff)` : f.value; return f.value; };

  return (
    <HoverCtx.Provider value={setHoverQ}>
    <div className="nt">
      <p className="sr" role="status" aria-live="polite">{announce}</p>
      <header className="nt-top">
        <div className="nt-head"><p className="mono nt-kick">Notes <span className="beta-tag">Beta</span> <span className="nt-date">{when}</span></p>
          <input className="nt-title" aria-label="Note title" placeholder="Untitled call" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          {analysed && <p className="nt-savedline"><span aria-hidden="true">●</span> Saved to <Link href="/calls" onClick={goCalls}>Calls</Link>, in this browser only</p>}</div>
        <div className="nt-tools">
          <details className="nt-saved"><summary>Saved ({saved.length})</summary><div className="nt-pop">
            {saved.length === 0 ? <p className="nt-muted">Notes you make are saved here, in this browser only.</p> : <ul>{saved.map((n) => <li key={n.id} data-active={n.id === activeId}><button type="button" className="nt-open" onClick={() => openSaved(n)} title={n.title}>{n.title}</button><button type="button" className="nt-del" aria-label={`Delete note: ${n.title}`} onClick={() => removeSaved(n.id)}>×</button></li>)}</ul>}
            {saved.length > 0 && <button type="button" className="rail-clear" onClick={clearAll}>Delete all</button>}</div></details>
          <Link className="bar-btn" href="/calls" onClick={goCalls}>All calls ({saved.length})</Link>
          <button type="button" className="bar-btn" onClick={reset} disabled={busy}>New note</button>
        </div>
      </header>

      <div className="nt-grid">
        <section className="nt-cap" aria-label="Capture">
          <div className={`plate${recording ? " rec" : ""}`}>
            <p className="pst mono"><i aria-hidden="true" />{status_}</p>
            <p className="timer" aria-hidden="true">{mmss(rec.elapsed)}</p>
            <Meter levelRef={rec.levelRef} active={recording} />
            <button type="button" className="recbtn" aria-pressed={recording} aria-label={recording ? "Stop recording" : "Start recording"} disabled={rec.state === "stopping"} onClick={toggleRec}><Ico d={recording ? STOP : MIC} /></button>
            <p className="rec-lbl mono">{recording ? "Press to stop" : rec.state === "starting" ? "Allow the microphone…" : "Press to record"}</p>
            <p className="rec-key">or press <kbd>R</kbd></p>
            <div className="plate-foot">
              <label className="lang mono">Language <select value={lang} disabled={busy} onChange={(e) => { setLang(e.target.value); try { localStorage.setItem("gf-notes-lang", e.target.value); } catch { /* ignore */ } }}>{LANGS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select></label>
              <p className="hint">No headphones? The microphone also hears your speakers, so record while the other person is quiet.</p>
              <details className="hint"><summary>Privacy</summary><p>Browser dictation sends the audio to your browser's speech service, so use fictional or approved content only. This tool does not store audio. Transcripts stay in this browser.</p></details>
            </div>
          </div>
          {err && <p className="nt-err" role="alert">{err}</p>}
          {!supported && !err && <p className="nt-info" role="note">{MSG.unsupported}</p>}
          {!busy && <div className="tcard">
            <div className="tcard-h"><h2 className="mono">Transcript</h2><div className="tcard-b">
              {!recording && transcript && <button type="button" className="mini" onClick={() => (showEdit ? doneEditing() : setEditing(true))}>{showEdit ? "Done" : "Edit"}</button>}
              {!busy && <button type="button" className="mini" onClick={useSample}>Sample call</button>}</div></div>
            {showEdit ? <textarea className="tx-edit" aria-label={transcript ? "Edit transcript" : "Paste or type a transcript"} value={transcript} placeholder="Paste or type a call transcript here, or press record" onChange={(e) => { setTyping(true); setTranscript(e.target.value); }} onBlur={() => { if (!editing && transcript.trim()) doneEditing(); }} rows={transcript ? 8 : 5} />
              : <div className="tx" tabIndex={0} aria-label="Transcript">{transcript || interim ? <>{view ? <>{view[0]}<mark ref={markRef}>{view[1]}</mark>{view[2]}</> : transcript}{interim && <span className="int">{transcript ? "\n" : ""}{interim}</span>}</> : <span className="nt-muted">{recording ? "Listening… start speaking." : "What you say appears here. You can also paste or type a call below."}</span>}</div>}
          </div>}
          <div className="jot"><label htmlFor="jot" className="mono">Your notes (optional)</label><textarea id="jot" rows={3} value={jot} onChange={(e) => setJot(e.target.value)} placeholder="Jot anything you want kept with the notes" maxLength={4000} /></div>
        </section>

        <section className="nt-doc" aria-label="Notes" ref={docRef}>
          {busy ? (
            <div className="lvp"><p className="lvp-k mono"><i className={recording ? "act" : ""} aria-hidden="true" />{rec.state === "starting" ? "Allow the microphone…" : rec.state === "stopping" ? "Finishing…" : "Live transcript"}</p>
              <div className="lvp-tx" ref={liveRef} aria-label="Live transcript">{transcript || interim ? <>{transcript}{interim && <span className="int">{transcript ? "\n" : ""}{interim}</span>}</> : <span className="nt-muted">Start speaking. Your words appear here as you say them.</span>}</div>
              <p className="nt-muted lvp-foot">Press stop when you are done. Your notes appear here.</p></div>
          ) : !shown ? (
            <div className="nt-empty"><h2>Your notes appear here</h2>
              <ol className="steps3"><li><b>1</b> Press record</li><li><b>2</b> Speak a few lines about a client</li><li><b>3</b> Press stop</li></ol>
              <p className="nt-muted">You get a summary, key points with the quotes behind them, the facts a CRM needs, a check against the funding rules, and the next steps. Nothing is invented: what was not said shows as not mentioned.</p>
              <div className="nt-empty-actions"><button type="button" className="nbtn pri" onClick={useSample}>Try a sample call</button><span className="nt-muted">or paste a transcript on the left</span></div>
              <div className="ghosts" aria-hidden="true"><i /><i /><i /><i /></div></div>
          ) : (
            <>
              <div className="nt-bar" role="toolbar" aria-label="Note actions">
                <button type="button" className="nbtn" onClick={async () => { if (await copyText(mdOf())) flash("md"); }}>{copied === "md" ? "Copied" : "Copy"}</button>
                <button type="button" className="nbtn" onClick={() => download(`${(title.trim() || "call-notes").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`, mdOf())}>Download</button>
                {status?.live && <button type="button" className="nbtn" disabled={enhState === "busy" || !!enh} onClick={() => void enhance()}>{enhState === "busy" ? "Enhancing…" : "Enhance with Claude"}</button>}
                <button type="button" className="nbtn" aria-expanded={crmOpen} onClick={() => setCrmOpen((v) => !v)}>Extract CRM fields</button>
                <button type="button" className="nbtn pri" disabled={!profile} onClick={goScreen} title={profile ? "Open the Screen page with this company filled in" : "The call did not say where the company is based"}>Screen this company →</button>
              </div>
              {status?.live && status.needsCode && !enh && <div className="field nt-code"><label htmlFor="ac">Access code (for Claude)</label><input id="ac" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" /></div>}
              {enhMsg && <p className="nt-info" role="status">{enhMsg}</p>}
              <p className="nt-tag mono">{enh ? <>Enhanced by Claude · {enh.kept} statements verified against the transcript{enh.dropped ? `, ${enh.dropped} dropped because their quotes were not in it` : ""} <button type="button" className="mini" onClick={() => setEnh(null)}>Back to instant notes</button></> : "Instant notes · every point links to what was said"}</p>

              <article className="sec rev"><h3>Summary</h3><p className="sum">{shown.summary}</p></article>
              {shown.keyPoints.length > 0 && <article className="sec rev" style={{ animationDelay: "80ms" }}><h3>Key points</h3><ul className="kp">{shown.keyPoints.map((p, i) => <li key={i}><span>{p.text}</span><Quote q={p.quote} active={quote} onPick={(q) => setQuote(quote === q ? null : q)} /></li>)}</ul></article>}
              <article className="sec rev" style={{ animationDelay: "160ms" }}><h3>From the call</h3><dl className="facts">{FACT_ROWS.map(([k, label]) => { const v = factVal(k); const f = shown.facts[k]; return <div key={k} className={v ? undefined : "none"}><dt>{label}</dt><dd>{v ?? "Not mentioned"}</dd><dd className="ev">{f?.quote ? <Quote q={f.quote} active={quote} onPick={(q) => setQuote(quote === q ? null : q)} /> : null}</dd></div>; })}</dl>
                {shown.programmes.length > 0 && <p className="progs">Programmes mentioned: {shown.programmes.map((p, i) => <span key={p.id}>{i > 0 && ", "}{p.covered ? <Link href={`/programmes#${p.id}`}>{p.label}</Link> : <span>{p.label} <span className="nt-muted">(not covered yet)</span></span>}</span>)}</p>}</article>
              {rules && <article className="sec rev" style={{ animationDelay: "240ms" }}><h3>Rule check</h3>{rules.flags.map((f, i) => <div key={i} className={`flag ${f.level}`}><p className="flag-t"><span className="flag-k mono">{f.level === "alert" ? "Check now" : f.level === "ok" ? "Good" : "Ask"}</span>{f.title}</p><p>{f.detail}</p>{f.programmes.length > 0 && <ul>{f.programmes.map((p) => <li key={p.id}><Link href={`/programmes#${p.id}`}>{p.label}</Link>{p.note ? `: ${p.note}` : ""}</li>)}</ul>}</div>)}
                {rules.likely.length > 0 && <p className="likely">Programmes that look relevant: {rules.likely.map((l, i) => <span key={l.id}>{i > 0 && ", "}<Link href={`/programmes#${l.id}`}>{l.label}</Link></span>)}. <span className="nt-muted">A readable score, not a statement of eligibility.</span></p>}</article>}
              {shown.openQuestions.length > 0 && <article className="sec rev" style={{ animationDelay: "320ms" }}><h3>Open questions</h3><ul className="oq">{shown.openQuestions.map((q, i) => <li key={i}><span className="oq-k mono">{q.kind === "said" ? "Said" : "Ask next"}</span>{q.text}{q.quote && <Quote q={q.quote} active={quote} onPick={(x) => setQuote(quote === x ? null : x)} />}</li>)}</ul></article>}
              {shown.nextSteps.length > 0 && <article className="sec rev" style={{ animationDelay: "400ms" }}><h3>Next steps</h3><ul className="oq">{shown.nextSteps.map((s, i) => <li key={i}><span className="oq-k mono">{s.when ?? "Step"}</span>{s.what}<Quote q={s.quote} active={quote} onPick={(x) => setQuote(quote === x ? null : x)} /></li>)}</ul></article>}
              {jot.trim() && <article className="sec"><h3>Your notes</h3><p className="jot-out">{jot}</p></article>}

              {crmOpen && <div className="sec crm" ref={crmRef}><h3>CRM fields <span className="nt-muted">version 1 · review before you paste into your CRM</span></h3>
                <div className="crm-actions"><button type="button" className="nbtn" onClick={() => download("crm-record.csv", crmToCsv(crm), "text/csv;charset=utf-8")}>Download CSV</button><button type="button" className="nbtn" onClick={() => download("crm-record.json", crmToJson(crm), "application/json")}>Download JSON</button><button type="button" className="nbtn" onClick={async () => { if (await copyText(crmToJson(crm))) flash("crm"); }}>{copied === "crm" ? "Copied" : "Copy JSON"}</button>{Object.keys(edits).length > 0 && <button type="button" className="mini" onClick={() => setEdits({})}>Reset edits</button>}</div>
                <div className="crm-table" role="group" aria-label="CRM fields">{crm.map((f) => <div className={`crm-row${f.value ? "" : " none"}`} key={f.key}><label className="crm-l" htmlFor={`crm-${f.key}`}>{f.label}</label>
                  <input id={`crm-${f.key}`} value={f.value} placeholder="Not mentioned" onChange={(e) => setEdits((p) => ({ ...p, [f.key]: e.target.value }))} />
                  <span className="crm-c mono">{f.edited ? "edited" : f.confidence === "unknown" ? "not said" : f.confidence}</span><span className="crm-e"><Quote q={f.evidence} active={quote} onPick={(x) => setQuote(quote === x ? null : x)} /></span></div>)}</div></div>}
            </>
          )}
        </section>
      </div>
    </div>
    </HoverCtx.Provider>
  );
}
