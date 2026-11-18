"use client";
import { useEffect, useMemo, useState } from "react";
import BriefView from "@/components/BriefView";
import DotField from "@/components/DotField";
import SchemeDetail from "@/components/SchemeDetail";
import { BY_ID, META, REAL, REAL_META, SCHEMES } from "@/lib/data";
import { buildBrief } from "@/lib/explainer";
import { match } from "@/lib/matcher";
import type { MatchResult, Profile, Scheme } from "@/lib/types";
import { fmtDate, SECTORS } from "@/lib/ui";

type Country = "NL" | "DE" | "EU" | "OTHER";
interface Form { name: string; country: Country | ""; region: string; size: NonNullable<Profile["size"]>; sectors: string[]; signals: string; description: string; }
interface Status { live: boolean; needsCode: boolean }
interface Prose { map: Record<string, { why: string; watch: string[] }>; notes: string[]; tokens: number }
const BLANK: Form = { name: "", country: "", region: "", size: "unknown", sectors: [], signals: "", description: "" };
const EMPTY: MatchResult = { matches: [], not_open: [], check_manually: [], excluded: {} };
const fromReal = (id: string): Form => { const d = REAL.find((x) => x.id === id); if (!d) return BLANK;
  return { name: d.name, country: d.country as Country, region: d.region ?? "", size: d.size ?? "unknown", sectors: d.sectors ?? [], signals: (d.signals ?? []).join("\n"), description: d.description }; };

export default function Screen() {
  const [sel, setSel] = useState(""); const [f, setF] = useState<Form>(BLANK);
  const [status, setStatus] = useState<Status | null>(null); const [url, setUrl] = useState(""); const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"" | "profile" | "prose">(""); const [err, setErr] = useState(""); const [info, setInfo] = useState("");
  const [prose, setProse] = useState<Prose | null>(null); const [picked, setPicked] = useState<Scheme | null>(null);
  useEffect(() => { const h = window.location.hash.slice(1); if (h && REAL.some((d) => d.id === h)) { setSel(h); setF(fromReal(h)); } }, []);
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ live: false, needsCode: false })); }, []);
  const ready = f.country !== "";
  const profile: Profile = useMemo(() => ({ name: f.name, country: (f.country || "NL") as Country, region: f.region, size: f.size, sectors: f.sectors, signals: f.signals.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean), description: f.description, activities: f.description }), [f]);
  useEffect(() => { setProse(null); setPicked(null); }, [profile]);
  const result = useMemo(() => (ready ? match(profile, SCHEMES) : EMPTY), [profile, ready]);
  const brief = useMemo(() => { const b = buildBrief(profile, result, BY_ID, META.as_of);
    if (prose) b.matches = b.matches.map((m) => (prose.map[m.scheme_id] ? { ...m, why_it_fits: prose.map[m.scheme_id].why, watch_outs: prose.map[m.scheme_id].watch.length ? prose.map[m.scheme_id].watch : m.watch_outs } : m)); return b; }, [profile, result, prose]);
  const lit = useMemo(() => Object.fromEntries(result.matches.map((m) => [m.scheme_id, m.fit ?? "low"])) as Record<string, "high" | "medium" | "low">, [result]);
  const rings = useMemo(() => result.not_open.map((m) => m.scheme_id), [result]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setSel(""); setF((p) => ({ ...p, [k]: v })); };
  const toggle = (s: string) => set("sectors", f.sectors.includes(s) ? f.sectors.filter((x) => x !== s) : [...f.sectors, s]);
  async function post(path: string, body: unknown) { const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...(code ? { "x-access-code": code } : {}) }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`); return j; }
  async function runProfile() { setBusy("profile"); setErr(""); setInfo("");
    try { const j = await post("/api/profile", { url }); const p = j.profile;
      setF({ name: p.name, country: p.country, region: p.region ?? "", size: p.size ?? "unknown", sectors: p.sectors ?? [], signals: (p.signals ?? []).join("\n"), description: p.description ?? p.activities ?? "" }); setSel("");
      setInfo(`Drafted from ${j.pages?.length ?? 1} page(s)${j.cached ? " (cached)" : ""}. Confidence: ${p.confidence}. A website draft, not verified: correct it before relying on the result.` + (p.country === "OTHER" ? " Outside NL, DE and EU, only EU-wide schemes can match." : ""));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); } }
  async function runProse() { setBusy("prose"); setErr("");
    try { const j = await post("/api/prose", { profile }); setProse({ map: j.prose ?? {}, notes: j.notes ?? [], tokens: (j.usage?.in ?? 0) + (j.usage?.out ?? 0) }); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); } }
  const onPick = (s: Scheme) => { if (lit[s.id]) { setPicked(null); const el = document.getElementById("m-" + s.id); if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); } } else setPicked(s); };
  const n = { lit: result.matches.length, ring: result.not_open.length };

  return (
    <div className="wrap" style={{ paddingTop: "var(--s7)" }}>
      <div className="sec-head" style={{ marginBottom: "var(--s6)" }}><span className="mono">Screen</span><span className="mono muted">Describe a company. Matching runs in your browser by fixed rules.</span></div>
      <div className="screen">
        <aside className="screen-form noprint" aria-label="Company profile" style={{ gridArea: "form" }}>
          {status?.live && <>
            <div className="field"><label htmlFor="url">Company website</label><div style={{ display: "flex", gap: 10, alignItems: "end" }}><input id="url" value={url} placeholder="https://company.example" onChange={(e) => setUrl(e.target.value)} /><button className="btn" style={{ padding: "12px 16px" }} disabled={!url || busy !== ""} onClick={runProfile}>{busy === "profile" ? "Reading" : "Profile"}</button></div></div>
            {status.needsCode && <div className="field"><label htmlFor="code">Access code</label><input id="code" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" /></div>}
            {info && <div className="note">{info}</div>}</>}
          {err && <div className="note err" role="alert">{err}</div>}
          <div className="field"><span className="lbl" id="real-l">Try a real company</span>
            <div className="realpick" role="group" aria-labelledby="real-l">{REAL.map((c) => <button key={c.id} type="button" className="real" aria-pressed={sel === c.id} onClick={() => { setSel(c.id); setF(fromReal(c.id)); }}><b>{c.name}</b><span>{c.summary}</span></button>)}</div>
            <p className="faint" style={{ fontSize: 13, marginTop: 10 }}>Real companies, profiled from their public reports and websites (checked {fmtDate(REAL_META.as_of)}). Illustration only: no connection to them, and a result is not a statement that they are eligible.</p>
            {sel && <details className="real-src"><summary>Sources for this profile</summary><ul>{REAL.find((c) => c.id === sel)?.sources.map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="noopener noreferrer">{x.label}</a></li>)}</ul></details>}</div>
          <div className="field"><label htmlFor="nm">Company name</label><input id="nm" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div className="field"><label htmlFor="co">Country</label><select id="co" value={f.country} onChange={(e) => set("country", e.target.value as Country | "")}><option value="">Select</option><option>NL</option><option>DE</option><option>EU</option><option value="OTHER">Other</option></select></div>
            <div className="field"><label htmlFor="sz">Size</label><select id="sz" value={f.size} onChange={(e) => set("size", e.target.value as Form["size"])}>{["micro", "small", "medium", "large", "unknown"].map((s) => <option key={s}>{s}</option>)}</select></div></div>
          <div className="field"><label htmlFor="rg">Region, optional</label><input id="rg" value={f.region} placeholder="Saxony, NRW, Gelderland" onChange={(e) => set("region", e.target.value)} /></div>
          <div className="field"><span className="lbl" id="sec-l">Sectors</span><div className="tog-group" role="group" aria-labelledby="sec-l">{SECTORS.map((s) => <button key={s} className="tog" aria-pressed={f.sectors.includes(s)} onClick={() => toggle(s)}>{s}</button>)}</div></div>
          <div className="field"><label htmlFor="sg">Signals, one per line</label><textarea id="sg" value={f.signals} onChange={(e) => set("signals", e.target.value)} placeholder={"own R&D staff\nplanned new production site"} /></div>
          <div className="field"><label htmlFor="ds">What the company does</label><textarea id="ds" value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
          {status?.live && <><button className="btn alt" disabled={busy !== "" || !brief.matches.length} onClick={runProse}>{busy === "prose" ? "Curating" : "Curated AI brief"}</button><p className="faint" style={{ fontSize: 13.5, marginTop: 10 }}>Optional. Claude writes the short explanations for each match. Rates, caps and sources stay copied from the data, and any generated number not in the data is discarded.</p></>}
        </aside>
        {!ready ? <div className="empty-state" style={{ gridArea: "plate" }}><h2>Choose a company</h2><p>Pick one of the real companies on the left, or describe your own: select a country, then add its size, sectors and what it does. Its matches light up here.</p></div> : <>
        <div className="plate" style={{ gridArea: "plate", padding: "26px 26px 20px" }}>
            <DotField lit={lit} rings={rings} onPick={onPick} label={`${n.lit} schemes lit for this company, ${n.ring} relevant but not open`} />
            <div className="legend mono"><span><i />{n.lit} lit</span><span><i className="rg" />{n.ring} relevant, not open</span><span><i className="cold" />{SCHEMES.length - n.lit - n.ring} cold</span><span style={{ marginLeft: "auto" }}>Hover, or use arrow keys</span></div>
        </div>
        <div style={{ gridArea: "results", minWidth: 0 }}>
          {picked && <section className="dossier" style={{ borderTopStyle: "solid" }}><div className="toolbar" style={{ marginBottom: 16 }}><h3>{picked.name}</h3><button className="btn alt" onClick={() => setPicked(null)}>Close</button></div><p className="note">Not among the matches for this company: it did not pass the filters or the theme check. Terms below are for reference.</p><SchemeDetail s={picked} /></section>}
          {prose && <div className="note noprint">{Object.keys(prose.map).length ? <>Curated AI brief: {Object.keys(prose.map).length} explanation(s) below were written by Claude and checked against the data{prose.tokens ? ` (${prose.tokens} tokens)` : ""}.</> : <>Claude was called{prose.tokens ? ` (${prose.tokens} tokens)` : ""}, but nothing it wrote could be used, so the standard explanations are shown.</>} {prose.notes.map((x) => <div key={x}>{x}</div>)}</div>}
          <BriefView brief={brief} excluded={result.excluded} />
        </div>
        </>}
      </div>
    </div>
  );
}
