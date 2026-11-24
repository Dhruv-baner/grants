"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { companyToText } from "@/lib/assistant/company";
import { useCallback, useEffect, useMemo, useState } from "react";
import BriefView from "@/components/BriefView";
import ClientReport from "@/components/ClientReport";
import DotField from "@/components/DotField";
import SchemeDetail from "@/components/SchemeDetail";
import { AidPanel, TimelinePanel, WhatIfPanel } from "@/components/ScreenPanels";
import Tabs from "@/components/Tabs";
import { BY_ID, META, REAL, REAL_META, SCHEMES } from "@/lib/data";
import { buildBrief } from "@/lib/explainer";
import { match } from "@/lib/matcher";
import { CALCS, defaults, hasCalc, type CalcOut, type Val } from "@/lib/screen/calculators";
import { checksFor } from "@/lib/screen/eligibility";
import { intakeFromText } from "@/lib/screen/intake";
import { stackPlan } from "@/lib/screen/stack";
import { buildTimeline } from "@/lib/screen/timeline";
import type { Project } from "@/lib/screen/types";
import type { MatchResult, Profile, Scheme } from "@/lib/types";
import { fmtDate, SECTORS } from "@/lib/ui";

type Country = "NL" | "DE" | "EU" | "OTHER";
interface Form { name: string; country: Country | ""; region: string; size: NonNullable<Profile["size"]>; sectors: string[]; signals: string; description: string; }
interface Status { live: boolean; needsCode: boolean }
interface Prose { map: Record<string, { why: string; watch: string[] }>; notes: string[]; tokens: number }
type FKey = "country" | "region" | "size" | "sectors" | "description";
interface Src { from: "website" | "document" | "text" | "you"; conf: "stated" | "inferred" | "unknown"; evidence?: string }
const BLANK: Form = { name: "", country: "", region: "", size: "unknown", sectors: [], signals: "", description: "" };
const EMPTY: MatchResult = { matches: [], not_open: [], check_manually: [], excluded: {} };
const NO_PROJECT: Project = { started: "unknown" };
const fromReal = (id: string): Form => { const d = REAL.find((x) => x.id === id); if (!d) return BLANK;
  return { name: d.name, country: d.country as Country, region: d.region ?? "", size: d.size ?? "unknown", sectors: d.sectors ?? [], signals: (d.signals ?? []).join("\n"), description: d.description }; };
const ASOF = META.as_of;
function Hint({ s }: { s?: Src }) {
  if (!s || s.from === "you") return null; const where = s.from === "website" ? "the website" : s.from === "document" ? "the document" : "your text";
  return <p className={`fhint ${s.conf}`}>{s.conf === "stated" ? <>Read from {where}, stated{s.evidence ? <>: <q>{s.evidence}</q></> : "."}</> : s.conf === "inferred" ? <>Guessed from {where}: please confirm it.</> : <>Not found in {where}: add it if you know it.</>}</p>;
}

export default function Screen() {
  const router = useRouter();
  const [sel, setSel] = useState(""); const [f, setF] = useState<Form>(BLANK); const [project, setProject] = useState<Project>(NO_PROJECT); const [pjText, setPjText] = useState(""); const [src, setSrc] = useState<Partial<Record<FKey, Src>>>({});
  const [status, setStatus] = useState<Status | null>(null); const [url, setUrl] = useState(""); const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"" | "profile" | "document" | "prose">(""); const [err, setErr] = useState(""); const [info, setInfo] = useState("");
  const [prose, setProse] = useState<Prose | null>(null); const [picked, setPicked] = useState<Scheme | null>(null); const [tab, setTab] = useState("matches"); const [calcEdits, setCalcEdits] = useState<Record<string, Record<string, Val>>>({});
  const [today, setToday] = useState(""); const [printNext, setPrintNext] = useState(false);
  useEffect(() => { setToday(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })); const done = () => document.body.classList.remove("print-report"); window.addEventListener("afterprint", done); return () => window.removeEventListener("afterprint", done); }, []);
  useEffect(() => { const h = window.location.hash.slice(1); if (h && REAL.some((d) => d.id === h)) { setSel(h); setF(fromReal(h)); } }, []);
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ live: false, needsCode: false })); }, []);
  useEffect(() => { // a company handed over from the Notes page
    try { const raw = sessionStorage.getItem("gf-screen-prefill"); if (!raw) return; sessionStorage.removeItem("gf-screen-prefill"); const d = JSON.parse(raw);
      setSel(""); setF({ name: String(d.name ?? "").slice(0, 120), country: ["NL", "DE", "EU", "OTHER"].includes(d.country) ? d.country : "", region: String(d.region ?? "").slice(0, 80), size: ["micro", "small", "medium", "large", "unknown"].includes(d.size) ? d.size : "unknown",
        sectors: Array.isArray(d.sectors) ? d.sectors.filter((x: unknown) => typeof x === "string" && SECTORS.includes(x)) : [], signals: String(d.signals ?? "").slice(0, 600), description: String(d.description ?? "").slice(0, 2000) });
    } catch { /* ignore a bad hand-over */ }
  }, []);
  const ready = f.country !== "";
  const profile: Profile = useMemo(() => ({ name: f.name, country: (f.country || "NL") as Country, region: f.region, size: f.size, sectors: f.sectors, signals: f.signals.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean), description: f.description, activities: f.description }), [f]);
  useEffect(() => { setProse(null); setPicked(null); }, [profile]);
  const result = useMemo(() => (ready ? match(profile, SCHEMES) : EMPTY), [profile, ready]);
  const brief = useMemo(() => { const b = buildBrief(profile, result, BY_ID, META.as_of);
    if (prose) b.matches = b.matches.map((m) => (prose.map[m.scheme_id] ? { ...m, why_it_fits: prose.map[m.scheme_id].why, watch_outs: prose.map[m.scheme_id].watch.length ? prose.map[m.scheme_id].watch : m.watch_outs } : m)); return b; }, [profile, result, prose]);
  const lit = useMemo(() => Object.fromEntries(result.matches.map((m) => [m.scheme_id, m.fit ?? "low"])) as Record<string, "high" | "medium" | "low">, [result]);
  const rings = useMemo(() => result.not_open.map((m) => m.scheme_id), [result]);
  // everything built on top of the ranking
  const ids = useMemo(() => result.matches.slice(0, 8).map((m) => m.scheme_id), [result]);
  const checks = useMemo(() => Object.fromEntries(result.matches.map((m) => [m.scheme_id, checksFor(profile, project, BY_ID[m.scheme_id])])), [result, profile, project]);
  const calcIds = useMemo(() => result.matches.filter((m) => hasCalc(m.scheme_id)).map((m) => m.scheme_id), [result]);
  const vals = useMemo(() => Object.fromEntries(calcIds.map((id) => [id, { ...defaults(CALCS[id], profile, project), ...(calcEdits[id] ?? {}) }])), [calcIds, profile, project, calcEdits]);
  const outs = useMemo(() => Object.fromEntries(calcIds.map((id) => [id, CALCS[id].run(vals[id])])), [calcIds, vals]);
  const estimates = useMemo(() => Object.fromEntries(Object.entries(outs).filter(([, o]) => !("error" in o))) as Record<string, CalcOut>, [outs]);
  const plan = useMemo(() => stackPlan(ids, BY_ID), [ids]);
  const timeline = useMemo(() => buildTimeline(ids, BY_ID, project, ASOF).items, [ids, project]);
  const names = useMemo(() => Object.fromEntries(Object.entries(BY_ID).map(([k, v]) => [k, v.name])), []);
  const missing = useMemo(() => result.matches.slice(0, 8).filter((m) => !hasCalc(m.scheme_id)).map((m) => m.name), [result]);
  useEffect(() => { if (printNext && tab === "report") { const t = window.setTimeout(() => { document.body.classList.add("print-report"); window.print(); setPrintNext(false); }, 80); return () => window.clearTimeout(t); } }, [printNext, tab]);

  const mark = (k: FKey, s: Src) => setSrc((p) => ({ ...p, [k]: s }));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setSel(""); setF((p) => ({ ...p, [k]: v })); if (k !== "name" && k !== "signals") mark(k as FKey, { from: "you", conf: "stated" }); };
  const toggle = (s: string) => set("sectors", f.sectors.includes(s) ? f.sectors.filter((x) => x !== s) : [...f.sectors, s]);
  async function post(path: string, body: unknown) { const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...(code ? { "x-access-code": code } : {}) }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`); return j; }
  function applyRead(j: { profile: Record<string, any>; fields?: Record<string, { confidence: Src["conf"]; evidence?: string }>; pages?: string[]; cached?: boolean }, from: "website" | "document") {
    const p = j.profile, fl = j.fields ?? {};
    setF({ name: p.name, country: p.country, region: p.region ?? "", size: p.size ?? "unknown", sectors: p.sectors ?? [], signals: (p.signals ?? []).join("\n"), description: p.description ?? p.activities ?? "" }); setSel("");
    const tag = (k: string): Src => ({ from, conf: fl[k]?.confidence ?? "inferred", evidence: fl[k]?.evidence }); setSrc({ country: tag("country"), region: tag("region"), size: tag("size"), sectors: tag("sectors"), description: tag("activities") });
    setInfo(`Read from ${j.pages?.length ?? 1} ${from === "website" ? "page(s)" : "file"}${j.cached ? " (cached)" : ""}. Confidence: ${p.confidence}. A draft, not verified: each field says whether the ${from} states it. Confirm before relying on the result.` + (p.country === "OTHER" ? " Outside NL, DE and EU, only EU-wide schemes can match." : ""));
  }
  async function runProfile() { setBusy("profile"); setErr(""); setInfo(""); try { applyRead(await post("/api/profile", { url }), "website"); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); } }
  async function runDocument(file: File | undefined) {
    if (!file) return; setBusy("document"); setErr(""); setInfo("");
    try { const fd = new FormData(); fd.set("file", file); const r = await fetch("/api/document", { method: "POST", headers: code ? { "x-access-code": code } : {}, body: fd }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`); applyRead(j, "document"); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }
  async function runProse() { setBusy("prose"); setErr(""); try { const j = await post("/api/prose", { profile }); setProse({ map: j.prose ?? {}, notes: j.notes ?? [], tokens: (j.usage?.in ?? 0) + (j.usage?.out ?? 0) }); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); } }
  function readProject() {
    const i = intakeFromText(pjText, ASOF); setProject((p) => ({ ...p, ...(i.project.budget ? { budget: i.project.budget } : {}), ...(i.project.start ? { start: i.project.start } : {}), started: i.project.started !== "unknown" ? i.project.started : p.started, text: pjText }));
    const fi = i.fields; setSel(""); setF((p) => ({ ...p, name: p.name || fi.name || "", country: p.country || fi.country || "", region: p.region || fi.region || "", size: p.size === "unknown" && fi.size ? fi.size : p.size, sectors: p.sectors.length ? p.sectors : fi.sectors ?? [], description: p.description || fi.description || "" }));
    setSrc((p) => { const n = { ...p }; const add = (k: FKey, has: boolean, was: boolean) => { if (has && !was) n[k] = { from: "text", conf: "inferred" }; }; add("country", !!fi.country, !!f.country); add("region", !!fi.region, !!f.region); add("size", !!fi.size, f.size !== "unknown"); add("sectors", !!fi.sectors, f.sectors.length > 0); add("description", !!fi.description, !!f.description); return n; });
    setInfo(i.found.length ? `Read from your text: ${i.found.join(", ")}. Fields you had already filled in were left alone. Check them.` : "Nothing useful was found in that text. Add a country, a budget or a start date.");
  }
  const onPick = (s: Scheme) => { if (lit[s.id]) { setPicked(null); setTab("matches"); window.setTimeout(() => { const el = document.getElementById("m-" + s.id); if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); } }, 50); } else setPicked(s); };
  const estimateFor = useCallback((id: string) => { setTab("aid"); window.setTimeout(() => document.getElementById("calc-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }, []);
  const n = { lit: result.matches.length, ring: result.not_open.length };
  const tabs = [{ id: "matches", label: "Matches", count: n.lit }, { id: "aid", label: "Aid and stack" }, { id: "timeline", label: "Timeline" }, { id: "whatif", label: "What if" }, { id: "report", label: "Client brief" }];

  return (
    <div className="wrap" style={{ paddingTop: "var(--s7)" }}>
      <div className="sec-head" style={{ marginBottom: "var(--s6)" }}><span className="mono">Screen</span><span className="mono muted">Describe a company. Matching runs in your browser by fixed rules.</span></div>
      <div className="screen">
        <aside className="screen-form noprint" aria-label="Company profile" style={{ gridArea: "form" }}>
          {status?.live && <>
            <div className="field"><label htmlFor="url">Company website</label><div style={{ display: "flex", gap: 10, alignItems: "end" }}><input id="url" value={url} placeholder="https://company.example" onChange={(e) => setUrl(e.target.value)} /><button className="btn" style={{ padding: "12px 16px" }} disabled={!url || busy !== ""} onClick={runProfile}>{busy === "profile" ? "Reading" : "Profile"}</button></div></div>
            <div className="field"><label htmlFor="doc">Or a document: annual report, pitch deck, project description</label><input id="doc" type="file" accept=".pdf,.docx,.txt,.md" disabled={busy !== ""} onChange={(e) => { void runDocument(e.target.files?.[0]); e.target.value = ""; }} /><span className="hint">{busy === "document" ? "Reading the file…" : "PDF, Word or text, up to 4 MB. Scanned pages cannot be read."}</span></div>
            {status.needsCode && <div className="field"><label htmlFor="code">Access code</label><input id="code" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" /></div>}</>}
          {info && <div className="note" role="status">{info}</div>}
          {err && <div className="note err" role="alert">{err}</div>}
          <div className="field"><span className="lbl" id="real-l">Try a real company</span>
            <div className="realpick" role="group" aria-labelledby="real-l">{REAL.map((c) => <button key={c.id} type="button" className="real" aria-pressed={sel === c.id} onClick={() => { setSel(c.id); setF(fromReal(c.id)); setSrc({}); }}><b>{c.name}</b><span>{c.summary}</span></button>)}</div>
            <p className="faint" style={{ fontSize: 13, marginTop: 10 }}>Real companies, profiled from their public reports and websites (checked {fmtDate(REAL_META.as_of)}). Illustration only: no connection to them, and a result is not a statement that they are eligible.</p>
            {sel && <details className="real-src"><summary>Sources for this profile</summary><ul>{REAL.find((c) => c.id === sel)?.sources.map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="noopener noreferrer">{x.label}</a></li>)}</ul></details>}</div>
          <div className="field"><label htmlFor="nm">Company name</label><input id="nm" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div className="field"><label htmlFor="co">Country</label><select id="co" value={f.country} onChange={(e) => set("country", e.target.value as Country | "")}><option value="">Select</option><option>NL</option><option>DE</option><option>EU</option><option value="OTHER">Other</option></select><Hint s={src.country} /></div>
            <div className="field"><label htmlFor="sz">Size</label><select id="sz" value={f.size} onChange={(e) => set("size", e.target.value as Form["size"])}>{["micro", "small", "medium", "large", "unknown"].map((s) => <option key={s}>{s}</option>)}</select><Hint s={src.size} /></div></div>
          <div className="field"><label htmlFor="rg">Region, optional</label><input id="rg" value={f.region} placeholder="Saxony, NRW, Gelderland" onChange={(e) => set("region", e.target.value)} /><Hint s={src.region} /></div>
          <div className="field"><span className="lbl" id="sec-l">Sectors</span><div className="tog-group" role="group" aria-labelledby="sec-l">{SECTORS.map((s) => <button key={s} className="tog" aria-pressed={f.sectors.includes(s)} onClick={() => toggle(s)}>{s}</button>)}</div><Hint s={src.sectors} /></div>
          <div className="field"><label htmlFor="sg">Signals, one per line</label><textarea id="sg" value={f.signals} onChange={(e) => set("signals", e.target.value)} placeholder={"own R&D staff\nplanned new production site"} /></div>
          <div className="field"><label htmlFor="ds">What the company does</label><textarea id="ds" value={f.description} onChange={(e) => set("description", e.target.value)} /><Hint s={src.description} /></div>
          <fieldset className="pj"><legend className="lbl">The project</legend>
            <div className="field"><label htmlFor="pj">Describe it, optional</label><textarea id="pj" value={pjText} placeholder={"We want to replace our gas heating with heat pumps, around 300 thousand euros. Nothing is ordered yet. We would like to start in spring."} onChange={(e) => setPjText(e.target.value)} /><button type="button" className="btn alt" style={{ marginTop: 10 }} disabled={pjText.trim().length < 15} onClick={readProject}>Read the project from the text</button><span className="hint">Free and instant. It fills the fields below, and only what the text says.</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div className="field"><label htmlFor="bd">Budget (EUR)</label><input id="bd" type="number" inputMode="numeric" min={0} value={project.budget ?? ""} onChange={(e) => setProject((p) => ({ ...p, budget: e.target.value ? Number(e.target.value) : undefined }))} /></div>
              <div className="field"><label htmlFor="st">Planned start</label><input id="st" type="date" value={project.start ?? ""} onChange={(e) => setProject((p) => ({ ...p, start: e.target.value || undefined }))} /></div></div>
            <div className="field"><label htmlFor="os">Already ordered or started?</label><select id="os" value={project.started} onChange={(e) => setProject((p) => ({ ...p, started: e.target.value as Project["started"] }))}><option value="unknown">Not known</option><option value="no">Nothing ordered yet</option><option value="yes">Already ordered or started</option></select><span className="hint">Many programmes must be applied for before work starts.</span></div></fieldset>
          {status?.live && <><button className="btn alt" disabled={busy !== "" || !brief.matches.length} onClick={runProse}>{busy === "prose" ? "Curating" : "Curated AI brief"}</button><p className="faint" style={{ fontSize: 13.5, marginTop: 10 }}>Optional. Claude writes the short explanations for each match. Rates, caps and sources stay copied from the data, and any generated number not in the data, or any claim of eligibility, is discarded.</p></>}
          {ready && <p className="faint" style={{ fontSize: 14, marginTop: 18 }}>Questions about this company? <button type="button" className="linkbtn" onClick={() => { try { sessionStorage.setItem("gf-chat-start", companyToText(profile, project)); } catch { /* ignore */ } router.push("/assistant"); }}>Ask the consultant about it</button>.</p>}
          <p className="faint" style={{ fontSize: 14, marginTop: 18 }}>Have a list of companies? <Link href="/screen/bulk">Screen a whole list at once</Link>.</p>
        </aside>
        {!ready ? <div className="empty-state" style={{ gridArea: "plate" }}><h2>Choose a company</h2><p>Pick one of the real companies on the left, or describe your own: select a country, then add its size, sectors and what it does. Its matches light up here.</p></div> : <>
        <div className="plate" style={{ gridArea: "plate", padding: "26px 26px 20px" }}>
            <DotField lit={lit} rings={rings} onPick={onPick} label={`${n.lit} schemes lit for this company, ${n.ring} relevant but not open`} />
            <div className="legend mono"><span><i />{n.lit} lit</span><span><i className="rg" />{n.ring} relevant, not open</span><span><i className="cold" />{SCHEMES.length - n.lit - n.ring} cold</span><span style={{ marginLeft: "auto" }}>Hover, or use arrow keys</span></div>
        </div>
        <div style={{ gridArea: "results", minWidth: 0 }}>
          {picked && <section className="dossier" style={{ borderTopStyle: "solid" }}><div className="toolbar" style={{ marginBottom: 16 }}><h3>{picked.name}</h3><button className="btn alt" onClick={() => setPicked(null)}>Close</button></div><p className="note">Not among the matches for this company: it did not pass the filters or the theme check. Terms below are for reference.</p><SchemeDetail s={picked} /></section>}
          <div className="tabbar noprint"><Tabs tabs={tabs} active={tab} onChange={setTab} label="Screening results" />{["aid", "timeline", "whatif"].includes(tab) && <button type="button" className="btn" onClick={() => { setTab("report"); setPrintNext(true); }}>Client brief (PDF)</button>}</div>
          {tab === "matches" && <div role="tabpanel" id="panel-matches" aria-labelledby="tab-matches">
            {prose && <div className="note noprint">{Object.keys(prose.map).length ? <>Curated AI brief: {Object.keys(prose.map).length} explanation(s) below were written by Claude and checked against the data{prose.tokens ? ` (${prose.tokens} tokens)` : ""}.</> : <>Claude was called{prose.tokens ? ` (${prose.tokens} tokens)` : ""}, but nothing it wrote could be used, so the standard explanations are shown.</>} {prose.notes.length > 0 && <details style={{ marginTop: 8 }}><summary>What was left out</summary><ul>{prose.notes.map((x) => <li key={x}>{x}</li>)}</ul></details>}</div>}
            <BriefView brief={brief} excluded={result.excluded} checks={checks} canEstimate={hasCalc} onEstimate={estimateFor} onPrint={() => { setTab("report"); setPrintNext(true); }} /></div>}
          {tab === "aid" && <div role="tabpanel" id="panel-aid" aria-labelledby="tab-aid"><AidPanel calcs={calcIds} rows={BY_ID} vals={vals} outs={outs} onChange={(id, k, v) => setCalcEdits((p) => ({ ...p, [id]: { ...(p[id] ?? {}), [k]: v } }))} plan={plan} by={BY_ID} missing={missing} /></div>}
          {tab === "timeline" && <div role="tabpanel" id="panel-timeline" aria-labelledby="tab-timeline"><TimelinePanel ids={ids} by={BY_ID} project={project} asOf={ASOF} company={f.name} /></div>}
          {tab === "whatif" && <div role="tabpanel" id="panel-whatif" aria-labelledby="tab-whatif"><WhatIfPanel profile={profile} project={project} rows={SCHEMES} onApply={(c) => { if (c.size) set("size", c.size); if (c.region) set("region", c.region); }} /></div>}
          {tab === "report" && <div role="tabpanel" id="panel-report" aria-labelledby="tab-report"><div className="toolbar noprint" style={{ marginBottom: 14 }}><span className="mono muted">A client-ready summary of this screening</span><button type="button" className="btn" onClick={() => { document.body.classList.add("print-report"); window.print(); }}>Print or save as PDF</button></div>
            <ClientReport brief={brief} profile={profile} project={project} checks={checks} estimates={estimates} plan={plan} timeline={timeline} names={names} today={today} /></div>}
        </div>
        </>}
      </div>
    </div>
  );
}
