"use client";
import { useEffect, useMemo, useState } from "react";
import BriefView from "@/components/BriefView";
import { BY_ID, DEMOS, META, SCHEMES } from "@/lib/data";
import { buildBrief } from "@/lib/explainer";
import { match } from "@/lib/matcher";
import type { Profile } from "@/lib/types";
import { SECTORS } from "@/lib/ui";

type Country = "NL" | "DE" | "EU" | "OTHER";
interface Form { name: string; country: Country; region: string; size: NonNullable<Profile["size"]>; sectors: string[]; signals: string; description: string; }
interface Status { live: boolean; needsCode: boolean }
interface Prose { map: Record<string, { why: string; watch: string[] }>; notes: string[]; tokens: number }
const fromDemo = (id: string): Form => {
  const d = DEMOS.find((x) => x.id === id) ?? DEMOS[0];
  return { name: d.name, country: d.country as Country, region: d.region ?? "", size: d.size ?? "unknown", sectors: d.sectors ?? [], signals: (d.signals ?? []).join("\n"), description: d.description };
};
export default function Screen() {
  const [demoId, setDemoId] = useState("nl-manufacturer-energy");
  const [f, setF] = useState<Form>(fromDemo("nl-manufacturer-energy"));
  const [status, setStatus] = useState<Status | null>(null);
  const [url, setUrl] = useState(""); const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"" | "profile" | "prose">(""); const [err, setErr] = useState(""); const [info, setInfo] = useState("");
  const [prose, setProse] = useState<Prose | null>(null);
  useEffect(() => { const h = window.location.hash.slice(1); if (h && DEMOS.some((d) => d.id === h)) { setDemoId(h); setF(fromDemo(h)); } }, []);
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ live: false, needsCode: false })); }, []);
  const profile: Profile = useMemo(() => ({ name: f.name, country: f.country, region: f.region, size: f.size, sectors: f.sectors,
    signals: f.signals.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean), description: f.description, activities: f.description }), [f]);
  useEffect(() => { setProse(null); }, [profile]);
  const result = useMemo(() => match(profile, SCHEMES), [profile]);
  const brief = useMemo(() => {
    const b = buildBrief(profile, result, BY_ID, META.as_of);
    if (prose) b.matches = b.matches.map((m) => (prose.map[m.scheme_id] ? { ...m, why_it_fits: prose.map[m.scheme_id].why, watch_outs: prose.map[m.scheme_id].watch.length ? prose.map[m.scheme_id].watch : m.watch_outs } : m));
    return b;
  }, [profile, result, prose]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (s: string) => set("sectors", f.sectors.includes(s) ? f.sectors.filter((x) => x !== s) : [...f.sectors, s]);
  const headers = (): Record<string, string> => ({ "content-type": "application/json", ...(code ? { "x-access-code": code } : {}) });
  async function post(path: string, body: unknown) {
    const r = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`); return j;
  }
  async function runProfile() {
    setBusy("profile"); setErr(""); setInfo("");
    try {
      const j = await post("/api/profile", { url }); const p = j.profile;
      setF({ name: p.name, country: p.country, region: p.region ?? "", size: p.size ?? "unknown", sectors: p.sectors ?? [], signals: (p.signals ?? []).join("\n"), description: p.description ?? p.activities ?? "" });
      setDemoId("");
      setInfo(`Profile drafted from ${j.pages?.length ?? 1} page(s)${j.cached ? " (cached)" : ""}. Confidence: ${p.confidence}. Review and correct it: it is a draft from a website, not verified.` + (p.country === "OTHER" ? " Outside NL, DE and EU: only EU-wide schemes can match." : ""));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }
  async function runProse() {
    setBusy("prose"); setErr("");
    try { const j = await post("/api/prose", { profile }); setProse({ map: j.prose ?? {}, notes: j.notes ?? [], tokens: (j.usage?.in ?? 0) + (j.usage?.out ?? 0) }); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }
  return (
    <>
      <h1>Screen a company</h1>
      <p className="lead">Describe a company, or paste its website when live mode is on, and see which Dutch, German and EU schemes may fit. Matching runs in your browser with fixed rules; AI is only used if you press the live buttons.</p>
      <div className="split">
        <div className="card noprint">
          <label>Company website {status?.live ? <span className="badge s-open">live mode on</span> : <span className="badge s-unknown">live mode off</span>}</label>
          <div className="row"><input value={url} disabled={!status?.live} placeholder={status?.live ? "https://company.example" : "needs an API key on the server"} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn" disabled={!status?.live || !url || busy !== ""} onClick={runProfile}>{busy === "profile" ? "Reading…" : "Profile"}</button></div>
          {status?.live && status.needsCode && <><label>Access code</label><input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" /></>}
          {!status?.live && <p className="small muted">Demo mode: pick a demo company or fill in the fields below. No data leaves this page.</p>}
          {info && <div className="warn" style={{ marginTop: 10 }}>{info}</div>}
          {err && <div className="warn" style={{ marginTop: 10, borderColor: "var(--bad)", background: "#2a1017", color: "#fecdd3" }}>{err}</div>}
          <label>Demo company (fictional)</label>
          <select value={demoId} onChange={(e) => { setDemoId(e.target.value); if (e.target.value) setF(fromDemo(e.target.value)); }}>
            <option value="">(custom)</option>{DEMOS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label>Company name</label><input value={f.name} onChange={(e) => set("name", e.target.value)} />
          <div className="row"><div style={{ flex: 1 }}><label>Country</label><select value={f.country} onChange={(e) => set("country", e.target.value as Country)}><option>NL</option><option>DE</option><option>EU</option><option value="OTHER">Other (EU-wide only)</option></select></div>
            <div style={{ flex: 1 }}><label>Size</label><select value={f.size} onChange={(e) => set("size", e.target.value as Form["size"])}>{["micro", "small", "medium", "large", "unknown"].map((s) => <option key={s}>{s}</option>)}</select></div></div>
          <label>Region (state or province, optional)</label><input value={f.region} placeholder="e.g. Saxony, NRW, Gelderland" onChange={(e) => set("region", e.target.value)} />
          <label>Sectors</label><div className="chips">{SECTORS.map((s) => <button key={s} className={"chip" + (f.sectors.includes(s) ? " on" : "")} onClick={() => toggle(s)}>{s}</button>)}</div>
          <label>Signals (one per line)</label><textarea value={f.signals} onChange={(e) => set("signals", e.target.value)} placeholder={"own R&D staff\nplanned new production site"} />
          <label>What the company does</label><textarea value={f.description} onChange={(e) => set("description", e.target.value)} />
          {status?.live && <div style={{ marginTop: 14 }}><button className="btn ghost" disabled={busy !== "" || !brief.matches.length} onClick={runProse}>{busy === "prose" ? "Writing…" : "Rewrite explanations with Claude"}</button>
            <p className="small muted">Optional. Claude only rewords the short explanations; rates, caps, windows and sources stay copied from the data, and any generated number not in the data is discarded.</p></div>}
        </div>
        <div>
          {prose && <div className="warn noprint" style={{ marginBottom: 12 }}>Explanations below were written by Claude and checked against the data{prose.tokens ? ` (${prose.tokens} tokens)` : ""}. {prose.notes.map((n) => <div key={n}>{n}</div>)}</div>}
          <BriefView brief={brief} excluded={result.excluded} />
        </div>
      </div>
    </>
  );
}
