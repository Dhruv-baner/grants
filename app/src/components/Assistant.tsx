"use client";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { collectCitations, type Citation } from "@/lib/assistant/citations";
import EligibilityChips from "@/components/Eligibility";
import { helpAnswer, respond, type Answer, type Block, type Ctx } from "@/lib/assistant/engine";
import { browserStore, deleteChat, loadChats, replay, saveChats, titleOf, turnsOf, upsertChat, type Msg, type Store, type StoredChat } from "@/lib/assistant/history";
import { DATA_AS_OF, IN_SCOPE, labelOf } from "@/lib/assistant/knowledge";
import { answerToMarkdown, chatToMarkdown } from "@/lib/assistant/markdown";
import { copyText, download } from "@/lib/browser";
import { fmtDate } from "@/lib/ui";

const STARTERS = [
  { tag: "Documents", q: "What documents do I need for WBSO?" }, { tag: "Deadlines", q: "When does the SME energy-saving loan close?" },
  { tag: "Estimate", q: "How much would WBSO save with 2,000 hours of R&D work?" }, { tag: "Combine", q: "Can I combine EIA and MIA?" },
  { tag: "Eligibility", q: "Can a start-up apply for the Gründungsstipendium.NRW?" }, { tag: "Compare", q: "Compare EIA and MIA and Vamil" },
  { tag: "Which fits", q: "We are a small manufacturer in Gelderland replacing gas heating. What fits?" }, { tag: "Coverage", q: "What can you answer?" },
];
const safeHref = (u: string) => (/^https?:\/\//i.test(u) ? u : "#");
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const Ico = ({ d, cls }: { d: string; cls?: string }) => <svg className={cls} viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d={d} /></svg>;
const UP = "M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z";
const COPY = "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z";
const SEND = "M2 21l21-9L2 3v7l15 2-15 2z";

function Cite({ n, cites }: { n?: number; cites: Citation[] }) {
  const c = cites.find((x) => x.n === n); if (!c) return null;
  return <a className="cite" href={safeHref(c.url)} target="_blank" rel="noopener noreferrer" aria-label={`Source ${c.n}: ${c.label} (opens in a new tab)`}>[{c.n}]</a>;
}
function View({ b, cites, ask }: { b: Block; cites: Citation[]; ask: (q: string) => void }) {
  const num = (u?: string) => cites.find((c) => c.url === u)?.n;
  switch (b.t) {
    case "title": return <div className="b-titlerow"><h3 className="b-title">{b.text}</h3>{b.id && <Link className="b-more mono" href={`/programmes#${b.id}`}>Programme details →</Link>}</div>;
    case "text": return <p className="b-text">{b.text}</p>;
    case "notice": return <p className="b-notice" role="note">{b.text}</p>;
    case "facts": return <><dl className="b-facts">{b.rows.map((r) => <div key={r.k} className={r.hi ? "hi" : undefined}><dt>{r.k}</dt><dd>{r.v}</dd></div>)}</dl>{b.src && <p className="b-foot">Source <Cite n={num(b.src)} cites={cites} /></p>}</>;
    case "checklist": return <>{b.groups.map((g) => <div key={g.label} className="b-group"><h4>{g.label}</h4><ul className="b-list">{g.items.map((i) => <li key={i.item}><span className="it">{i.item}<Cite n={num(i.url)} cites={cites} /></span>{i.note && <span className="nt">{i.note}</span>}</li>)}</ul></div>)}</>;
    case "table": return <div className="b-table-wrap" tabIndex={0} role="region" aria-label="Comparison table, scrolls sideways on small screens"><table className="b-table" role="table"><thead><tr role="row"><th role="columnheader" scope="col"><span className="sr">Topic</span></th>{b.cols.map((c) => <th key={c} role="columnheader" scope="col">{c}</th>)}</tr></thead>
      <tbody>{b.rows.map((r) => <tr key={r.label} role="row"><th role="rowheader" scope="row">{r.label}</th>{r.cells.map((c, i) => <td key={i} role="cell" data-label={b.cols[i]}>{c}</td>)}</tr>)}</tbody></table></div>;
    case "list": return <>{b.groups.map((g) => <div key={g.label} className="b-group"><h4>{g.label}</h4>{g.note && <p className="b-foot" style={{ margin: "0 0 8px" }}>{g.note}</p>}
      <ul className="b-list">{g.items.map((i) => <li key={i.id}><div className="pl-top"><span className="it">{i.label}<Cite n={num(i.url)} cites={cites} /></span><span className="pl-meta mono">{i.meta}</span></div><span className="pl-status">{i.status}</span><span className="nt">{i.summary}</span>
        <div className="pl-acts"><button type="button" className="mini" onClick={() => ask(`What documents do I need for ${i.label}?`)}>Documents</button><Link className="mini" href={`/programmes#${i.id}`}>Details →</Link></div></li>)}</ul></div>)}
      {b.more && <p className="b-text">{b.more.text}{b.more.href && <> <Link className="b-more" href={b.more.href}>{b.more.label} →</Link></>}</p>}</>;
    case "estimate": return <div className="b-est"><div className="b-titlerow"><h3 className="b-title">{b.title}</h3><span className={`ctype mono ${b.kind}`}>{b.kind === "tax" ? "Tax benefit" : b.kind === "grant" ? "Grant" : "Loan"}</span></div><p className="calc-head">{b.headline}</p>
      <dl className="calc-lines">{b.lines.map((l) => <div key={l.label}><dt>{l.label}</dt><dd>{l.value}</dd></div>)}</dl>{b.warnings.map((w) => <p className="calc-warn" key={w}>{w}</p>)}<ul className="calc-notes">{b.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      <details className="dd"><summary>Figures used</summary><dl className="dl">{b.inputs.map((i) => <Fragment key={i.label}><dt>{i.label}</dt><dd>{i.value}</dd></Fragment>)}</dl></details><p className="b-foot">Source <Cite n={num(b.src)} cites={cites} /></p></div>;
    case "checks": return <EligibilityChips checks={b.checks} />;
    case "combine": return <div className="b-combine"><ul className="stack-conf">{b.pairs.map((p) => <li key={p.a + p.b} className={p.verdict}><span className="elig-mark mono">{({ no: "Not together", conditional: "Partly", yes: "Allowed", unknown: "No rule recorded" })[p.verdict]}</span>
      <span><b>{labelOf(p.a)} and {labelOf(p.b)}.</b> {p.note} {p.source && (p.source.url.startsWith("http") ? <><Cite n={num(p.source.url)} cites={cites} /> <a href={safeHref(p.source.url)} target="_blank" rel="noopener noreferrer">{p.source.label}</a></> : <Link href={p.source.url}>{p.source.label}</Link>)}</span></li>)}</ul>{b.general && <p className="b-foot">{b.general}</p>}</div>;
    case "picks": return <div className="b-picks">{b.items.map((p, i) => <div key={p.id} className="b-pick"><h4><span>{i + 1}. {p.label}</span></h4>
      {p.why.length > 0 && <ul>{p.why.map((w) => <li key={w}>{w}</li>)}</ul>}{p.flags.length > 0 && <><p className="dl2" style={{ marginBottom: 0 }}>To check</p><ul style={{ marginTop: 2 }}>{p.flags.map((w) => <li key={w}>{w}</li>)}</ul></>}
      <p className="dl2">{p.deadline ? `Timing: ${p.deadline} · ` : ""}<Link href={`/programmes#${p.id}`}>Programme details →</Link></p></div>)}</div>;
    default: return null;
  }
}

function Bot({ m, last, onAsk, onFb, onCopy, copied }: { m: Msg; last: boolean; onAsk: (q: string) => void; onFb: (id: number, v: "up" | "down") => void; onCopy: (m: Msg) => void; copied: boolean }) {
  const a = m.answer!; const blocks = useMemo(() => a.blocks.filter((b) => b.t !== "chips" && b.t !== "sources"), [a]);
  const chips = (a.blocks.find((b) => b.t === "chips") as Extract<Block, { t: "chips" }> | undefined)?.items ?? [];
  const cites = useMemo(() => collectCitations(a), [a]);
  const [shown, setShown] = useState(m.fresh ? 1 : blocks.length);
  useEffect(() => {
    if (!m.fresh || shown >= blocks.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(blocks.length); return; }
    const t = setTimeout(() => setShown((n) => n + 1), 90); return () => clearTimeout(t);
  }, [shown, blocks.length, m.fresh]);
  const done = shown >= blocks.length; const ai = m.followup;
  return (
    <article className="msg bot" aria-label="Answer" aria-busy={!done}>
      <div className="avatar" aria-hidden="true"><i /></div>
      <div className="body">
        {ai?.state === "loading" && <p className="b-text thinking" aria-busy="true">Checking the record<span className="dots" aria-hidden="true"><b>.</b><b>.</b><b>.</b></span></p>}
        {ai?.state === "done" && <div className="ai-box"><p className="b-text" style={{ margin: 0 }}>{ai.text}</p><p className="b-foot" style={{ marginTop: 8 }}>Written by Claude from the programme's record, with numbers checked against the data.</p></div>}
        {blocks.slice(0, shown).filter((b) => !(b.t === "text" && b.lead && ai?.state === "done")).map((b, k) => <div key={k} className={m.fresh ? "rev" : undefined}><View b={b} cites={cites} ask={onAsk} /></div>)}
        {done && cites.length > 0 && <section className="csrc" aria-label="Sources"><h4>Sources</h4><ol>{cites.map((c) => <li key={c.n}><a href={safeHref(c.url)} target="_blank" rel="noopener noreferrer" aria-label={`Source ${c.n}: ${c.label} (opens in a new tab)`}><span className="n">{c.n}</span><span className="t">{c.label}</span><span className="h">{c.host}</span></a></li>)}</ol></section>}
        {done && !m.pending && <div className="acts" role="group" aria-label="Answer actions">
          <button type="button" className="act" onClick={() => onCopy(m)}><Ico d={COPY} />{copied ? "Copied" : "Copy"}</button>
          <button type="button" className="act" aria-pressed={m.fb === "up"} onClick={() => onFb(m.id, "up")} aria-label="Helpful"><Ico d={UP} /></button>
          <button type="button" className="act dn" aria-pressed={m.fb === "down"} onClick={() => onFb(m.id, "down")} aria-label="Not helpful"><Ico d={UP} cls="dn" /></button>
        </div>}
        {done && last && chips.length > 0 && <div className="follow" role="group" aria-label="Follow-up questions"><h4>Follow-ups</h4>{chips.map((c) => <button key={c} type="button" className="b-chip" onClick={() => onAsk(c)}>↳ {c}</button>)}</div>}
        {done && !m.pending && a.kind !== "help" && a.kind !== "beta" && <p className="b-foot">Programme data as of {fmtDate(DATA_AS_OF)}. {a.kind === "estimate" ? "Estimates are not offers or decisions, and do not say a company qualifies." : a.kind === "combine" ? "Only combining rules with a source are stated. Check each programme's own conditions." : a.kind === "checks" ? "A check is not advice that a company qualifies." : "A checklist says what the official page asks for. It is not advice that a company qualifies."}</p>}
      </div>
    </article>
  );
}

export default function Assistant() {
  const [chats, setChats] = useState<StoredChat[]>([]); const [activeId, setActiveId] = useState(() => uid());
  const [msgs, setMsgs] = useState<Msg[]>([]); const [ctx, setCtx] = useState<Ctx>({ last: [] });
  const [input, setInput] = useState(""); const [busy, setBusy] = useState(false); const [status, setStatus] = useState<{ live: boolean; needsCode: boolean } | null>(null); const [code, setCode] = useState("");
  const [rail, setRail] = useState(false); const [mobile, setMobile] = useState(false); const [copied, setCopied] = useState(0);
  const seq = useRef(0); const store = useRef<Store | null>(null); const chatsRef = useRef<StoredChat[]>([]);
  const lastRef = useRef<HTMLDivElement>(null); const taRef = useRef<HTMLTextAreaElement>(null); const histBtn = useRef<HTMLButtonElement>(null); const firstRender = useRef(true);
  const startRef = useRef<string | null>(null);
  useEffect(() => { try { const t = sessionStorage.getItem("gf-chat-start"); if (t) { sessionStorage.removeItem("gf-chat-start"); startRef.current = t; } } catch { /* ignore */ } }, []);
  const nextId = () => ++seq.current; const started = msgs.length > 0;

  useEffect(() => { store.current = browserStore(); const c = loadChats(store.current); chatsRef.current = c; setChats(c); fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ live: false, needsCode: false })); }, []);
  useEffect(() => { // start typing at once on a computer (not on a phone, where it would throw up the keyboard), and "/" jumps back to the box
    if (window.matchMedia("(min-width: 901px)").matches && navigator.maxTouchPoints === 0) taRef.current?.focus();
    const on = (e: globalThis.KeyboardEvent) => { if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return; const t = e.target as HTMLElement | null; if (t?.closest("input,textarea,select,[contenteditable]")) return; e.preventDefault(); taRef.current?.focus(); };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, []);
  useEffect(() => { const mq = window.matchMedia("(max-width: 900px)"); const on = () => setMobile(mq.matches); on(); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);
  useEffect(() => { const on = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape" && rail) { setRail(false); histBtn.current?.focus(); } }; window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on); }, [rail]);
  useEffect(() => { const el = taRef.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 176) + "px"; } }, [input, started]);
  useEffect(() => {
    if (first_(firstRender)) return; if (msgs.length) lastRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [msgs.length]);
  // Save the conversation (questions only) whenever it changes. Opening an old chat does not bump it to the top.
  useEffect(() => {
    if (!msgs.some((m) => m.role === "me")) return; const turns = turnsOf(msgs); if (!turns.length) return;
    const old = chatsRef.current.find((c) => c.id === activeId); if (old && JSON.stringify(old.turns) === JSON.stringify(turns)) return;
    const next = upsertChat(chatsRef.current, { id: activeId, title: old?.title ?? titleOf(turns), updated: Date.now(), turns }); chatsRef.current = next; setChats(next); saveChats(next, store.current);
  }, [msgs, activeId]);

  useEffect(() => { if (status && startRef.current) { const t = startRef.current; startRef.current = null; void send(t); } }); // eslint-disable-line react-hooks/exhaustive-deps
  const patch = (id: number, f: Partial<Msg>) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, ...f } : x)));
  const send = useCallback(async (text: string) => {
    const q = text.trim().slice(0, 600); if (!q || busy) return;
    setInput(""); const r = respond(q, ctx); setCtx(r.ctx); const botId = nextId(); const live = !!(r.followup && status?.live);
    // When the rules cannot place a question (the beta message, or "I can't answer that exact question"), a small model first chooses how to answer it. It only picks; the answer is built from the data.
    const tryRoute = !!status?.live && (r.answer.kind === "beta" || !!r.followup);
    const thinking: Answer = { kind: "clarify", ids: [], blocks: [{ t: "text", text: "Working out what you mean…" }] };
    setMsgs((m) => [...m, { id: nextId(), role: "me", text: q }, { id: botId, role: "bot", answer: tryRoute ? thinking : r.answer, q, fresh: true, pending: tryRoute, followup: live && !tryRoute ? { state: "loading" } : undefined }]);
    taRef.current?.focus();
    if (tryRoute) {
      setBusy(true); let routed = false;
      try {
        const res = await fetch("/api/assistant/intent", { method: "POST", headers: { "content-type": "application/json", ...(code ? { "x-access-code": code } : {}) }, body: JSON.stringify({ question: q, hasCompany: !!ctx.company }) }); const d = await res.json().catch(() => ({}));
        if (res.ok && typeof d.canonical === "string" && d.canonical) { const r2 = respond(d.canonical, ctx); if (r2.answer.kind !== "beta" && !r2.followup) { setCtx(r2.ctx); patch(botId, { answer: r2.answer, route: d.canonical, pending: false }); routed = true; } }
      } catch { /* fall back to the rules' own answer */ }
      if (routed) { setBusy(false); return; }
      patch(botId, { answer: r.answer, pending: false, followup: live ? { state: "loading" } : undefined }); if (!live) { setBusy(false); return; }
    } else { if (!live || !r.followup) return; setBusy(true); }
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json", ...(code ? { "x-access-code": code } : {}) }, body: JSON.stringify({ programme_id: r.followup!.id, question: r.followup!.question }) });
      const data = await res.json().catch(() => ({})); patch(botId, { followup: res.ok && typeof data.answer === "string" ? { state: "done", text: data.answer } : { state: "none" } });
    } catch { patch(botId, { followup: { state: "none" } }); } finally { setBusy(false); }
  }, [busy, ctx, status, code]);
  const newChat = () => { setActiveId(uid()); setMsgs([]); setCtx({ last: [] }); setInput(""); setRail(false); setTimeout(() => taRef.current?.focus(), 0); };
  const openChat = (c: StoredChat) => { const r = replay(c.turns); seq.current = r.msgs.length; setActiveId(c.id); setMsgs(r.msgs); setCtx(r.ctx); setRail(false); };
  const removeChat = (id: string) => { const next = deleteChat(chatsRef.current, id); chatsRef.current = next; setChats(next); saveChats(next, store.current); if (id === activeId) newChat(); };
  const clearAll = () => { if (!window.confirm("Delete all saved conversations from this browser?")) return; chatsRef.current = []; setChats([]); saveChats([], store.current); newChat(); };
  const onFb = (id: number, v: "up" | "down") => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, fb: x.fb === v ? undefined : v } : x)));
  const onCopy = async (m: Msg) => { const md = answerToMarkdown(m.answer!, undefined, m.followup?.state === "done" ? m.followup.text : undefined); if (await copyText(md)) { setCopied(m.id); setTimeout(() => setCopied((c) => (c === m.id ? 0 : c)), 1800); } };
  const exportChat = () => download("grants-and-funding-conversation.md", chatToMarkdown(titleOf(turnsOf(msgs)), msgs.map((m) => ({ role: m.role, text: m.text, answer: m.answer, ai: m.followup?.state === "done" ? m.followup.text : undefined })), fmtDate(new Date().toISOString().slice(0, 10))));
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); } };
  const covered = useMemo(() => (helpAnswer().blocks.find((b) => b.t === "facts") as Extract<Block, { t: "facts" }>).rows, []);

  const composer = (
    <div className="dock-in">
      {ctx.company && <p className="co-chip" role="status"><span className="mono">Company in this chat</span><b>{ctx.company.label}</b><button type="button" className="mini" onClick={() => setCtx((c) => ({ ...c, company: undefined }))}>Remove</button></p>}
      {status?.live && status.needsCode && <div className="field" style={{ marginBottom: 10, maxWidth: 320 }}><label htmlFor="ac">Access code (for follow-up questions)</label><input id="ac" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" /></div>}
      <form className="composer" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <label htmlFor="q" className="sr">Ask about a programme</label>
        <textarea id="q" ref={taRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} maxLength={600} placeholder={mobile ? "Ask a question" : "Ask about documents, deadlines, eligibility, or describe your company"} autoComplete="off" enterKeyHint="send" />
        <button className="send" type="submit" disabled={busy || !input.trim()} aria-label="Send"><Ico d={SEND} cls="sendi" /></button>
      </form>
      <p className="composer-note">Enter to send, Shift+Enter for a new line, / to jump here. Built from sourced data, in beta.</p>
    </div>
  );
  const lastBot = [...msgs].reverse().find((m) => m.role === "bot")?.id;

  return (
    <div className="ask-app">
      {rail && mobile && <button type="button" className="rail-bd" aria-label="Close history" onClick={() => { setRail(false); histBtn.current?.focus(); }} />}
      <aside className="rail" data-open={rail} aria-label="Conversations" {...(mobile && !rail ? { inert: true } : {})}>
        <button type="button" className="newchat" onClick={newChat}><span aria-hidden="true">+</span> New chat</button>
        <h2>History</h2>
        {chats.length === 0 ? <p className="rail-empty">Your conversations will appear here.</p> : <ul className="chatlist">{chats.map((c) => <li key={c.id} data-active={c.id === activeId}><button type="button" className="chat-item" aria-current={c.id === activeId ? "true" : undefined} onClick={() => openChat(c)} title={c.title}>{c.title}</button><button type="button" className="chat-del" aria-label={`Delete conversation: ${c.title}`} onClick={() => removeChat(c.id)}>×</button></li>)}</ul>}
        <div className="rail-note">Saved only in this browser, as questions. Answers are rebuilt from the current data when you open one.{chats.length > 0 && <button type="button" className="rail-clear" onClick={clearAll}>Delete all</button>}</div>
      </aside>
      <section className="stage">
        <div className="stage-bar">
          <button type="button" ref={histBtn} className="bar-btn hist-btn" aria-expanded={rail} onClick={() => setRail((v) => !v)}>History</button>
          {started && <><button type="button" className="bar-btn" onClick={exportChat}>Export</button><button type="button" className="bar-btn" onClick={newChat}>New</button></>}
        </div>
        {!started ? (
          <div className="hero-chat">
            <div className="hero-title"><h1>Ask The Grantbot</h1><span className="beta-tag">Beta</span></div>
            {composer}
            <ul className="starters">{STARTERS.map((s) => <li key={s.q}><button type="button" onClick={() => void send(s.q)}><span className="tag mono">{s.tag}</span><span>{s.q}</span></button></li>)}</ul>
            <details className="covers"><summary>Programmes covered ({IN_SCOPE.length})</summary><dl>{covered.map((r) => <div key={r.k} style={{ display: "contents" }}><dt>{r.k}</dt><dd>{r.v}</dd></div>)}</dl></details>
          </div>
        ) : (
          <>
            <h1 className="sr">Ask the grantbot</h1>
            <div className="thread" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">
              {msgs.map((m, i) => m.role === "me"
                ? <div key={m.id} className="msg me" ref={i === msgs.length - 1 ? lastRef : undefined}><p>{m.text}</p></div>
                : <div key={m.id} ref={i === msgs.length - 1 ? lastRef : undefined} style={{ scrollMarginTop: "calc(var(--nav-h) + 72px)" }}><Bot m={m} last={m.id === lastBot} onAsk={(q) => void send(q)} onFb={onFb} onCopy={onCopy} copied={copied === m.id} /></div>)}
            </div>
            <div className="dock">{composer}</div>
          </>
        )}
      </section>
    </div>
  );
}
function first_(r: { current: boolean }) { if (r.current) { r.current = false; return true; } return false; }
