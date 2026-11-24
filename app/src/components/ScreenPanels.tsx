"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { download } from "@/lib/browser";
import { formatEur } from "@/lib/notes/numbers";
import { CALCS, type Calc, type CalcOut, type Val, totals } from "@/lib/screen/calculators";
import { checksFor, summarise } from "@/lib/screen/eligibility";
import { robustness, whatIf } from "@/lib/screen/scenarios";
import { stackPlan, type Plan } from "@/lib/screen/stack";
import { buildTimeline, toIcs } from "@/lib/screen/timeline";
import type { Project } from "@/lib/screen/types";
import type { Profile, Scheme } from "@/lib/types";
import { fmtDate, plain } from "@/lib/ui";

const money = (n: number) => formatEur(n);
const range = (lo: number, hi: number) => (Math.round(lo) === Math.round(hi) ? money(hi) : `${money(lo)} to ${money(hi)}`);

/* ---------- Aid estimates ---------- */
export function CalcCard({ calc, row, vals, out, onChange }: { calc: Calc; row: Scheme; vals: Record<string, Val>; out: CalcOut | { error: string }; onChange: (k: string, v: Val) => void }) {
  const ok = !("error" in out);
  return (
    <article className="calc" id={`calc-${calc.id}`}>
      <header><h4>{calc.title}</h4><span className={`ctype mono ${calc.kind}`}>{calc.kind === "tax" ? "Tax benefit" : calc.kind === "grant" ? "Grant" : "Loan"}</span></header>
      <div className="calc-in">{calc.inputs.map((i) => { const id = `${calc.id}-${i.key}`; return (
        <div className="field" key={i.key}>
          {i.kind === "check" ? <label className="chk"><input type="checkbox" checked={!!vals[i.key]} onChange={(e) => onChange(i.key, e.target.checked)} /> {i.label}</label>
            : <><label htmlFor={id}>{i.label}</label>{i.kind === "select" ? <select id={id} value={String(vals[i.key])} onChange={(e) => onChange(i.key, e.target.value)}>{i.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              : <input id={id} type="number" inputMode="decimal" min={0} value={Number(vals[i.key]) || ""} placeholder="0" onChange={(e) => onChange(i.key, e.target.value === "" ? 0 : Number(e.target.value))} />}</>}
          {i.hint && <span className="hint">{i.hint}</span>}
        </div>); })}</div>
      {!ok ? <p className="calc-hint">{(out as { error: string }).error}</p> : <div className="calc-out" role="status" aria-live="polite">
        <p className="calc-head">{(out as CalcOut).headline}</p>
        <dl className="calc-lines">{(out as CalcOut).lines.map((l) => <div key={l.label}><dt>{l.label}</dt><dd>{l.value}</dd></div>)}</dl>
        {(out as CalcOut).warnings.map((w) => <p className="calc-warn" key={w}>{w}</p>)}
        <ul className="calc-notes">{(out as CalcOut).notes.map((n) => <li key={n}>{n}</li>)}</ul></div>}
      <details className="dd"><summary>Rates and caps as recorded</summary><dl className="dl"><dt>Rate</dt><dd>{plain(String(row.funding_rate ?? "")) || "Not recorded"}</dd><dt>Caps</dt><dd>{plain(String(row.caps ?? "")) || "Not recorded"}</dd></dl>
        <p className="faint" style={{ fontSize: 13 }}>An estimate to start a conversation, not an offer or a decision. <a href={row.official_url} target="_blank" rel="noopener noreferrer">Official page</a></p></details>
    </article>
  );
}
export function StackPanel({ plan, by }: { plan: Plan; by: Record<string, Scheme> }) {
  return (
    <section className="stackp" aria-label="Funding stack">
      <h3>Funding stack</h3>
      {plan.order.length === 0 ? <p className="nt-muted">No matches to order yet.</p> : <>
        <ol className="stack-order">{plan.order.map((s) => <li key={s.id} className={s.kind}><b>{s.name}</b><span>{s.why}</span></li>)}</ol>
        {plan.conflicts.length > 0 ? <ul className="stack-conf">{plan.conflicts.map((c) => <li key={c.a + c.b} className={c.rule.verdict}><span className="elig-mark mono">{c.rule.verdict === "no" ? "Not together" : "Partly"}</span><span><b>{by[c.a]?.name} and {by[c.b]?.name}.</b> {c.rule.note} <a href={c.rule.source.url} target={c.rule.source.url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{c.rule.source.label}</a></span></li>)}</ul>
          : plan.order.length > 1 && <p className="nt-muted">No recorded conflict between these programmes.</p>}
        {plan.notes.map((n) => <p className="faint" style={{ fontSize: 13.5, margin: "8px 0 0" }} key={n}>{n}</p>)}</>}
    </section>
  );
}
export function AidPanel({ calcs, rows, vals, outs, onChange, plan, by, missing }: { calcs: string[]; rows: Record<string, Scheme>; vals: Record<string, Record<string, Val>>; outs: Record<string, CalcOut | { error: string }>; onChange: (id: string, k: string, v: Val) => void; plan: Plan; by: Record<string, Scheme>; missing: string[] }) {
  const good = Object.values(outs).filter((o): o is CalcOut => !("error" in o)); const t = totals(good);
  return (
    <div>
      <div className="aid-tiles" role="group" aria-label="Estimated totals">
        <div className="aid-tile"><b>{good.some((o) => o.kind === "tax") ? range(t.tax.low, t.tax.high) : "None yet"}</b><span>Tax benefits</span></div>
        <div className="aid-tile"><b>{good.some((o) => o.kind === "grant") ? range(t.grant.low, t.grant.high) : "None yet"}</b><span>Grants</span></div>
        <div className="aid-tile"><b>{good.some((o) => o.kind === "loan" && o.unit === "total") ? `Up to ${money(t.loan)}` : "None yet"}</b><span>Loans, repayable: not aid</span></div>
      </div>
      <p className="faint" style={{ fontSize: 13.5 }}>Estimates from the recorded rates, for talking to a client. Programmes that cover the same costs cannot always be added together: see the stack below before adding these up.</p>
      <StackPanel plan={plan} by={by} />
      <h3 style={{ marginTop: 28 }}>Calculators</h3>
      {calcs.length === 0 && <p className="nt-muted">None of the matched programmes has a calculator yet.</p>}
      <div className="calc-grid">{calcs.map((id) => <CalcCard key={id} calc={CALCS[id]} row={rows[id]} vals={vals[id]} out={outs[id]} onChange={(k, v) => onChange(id, k, v)} />)}</div>
      {missing.length > 0 && <p className="faint" style={{ fontSize: 13.5, marginTop: 16 }}>No calculator yet for {missing.join(", ")}. Their rates and caps are on each programme's page.</p>}
    </div>
  );
}

/* ---------- Timeline ---------- */
export function TimelinePanel({ ids, by, project, asOf, company }: { ids: string[]; by: Record<string, Scheme>; project: Project; asOf: string; company: string }) {
  const t = useMemo(() => buildTimeline(ids, by, project, asOf), [ids, by, project, asOf]);
  const marks = [...t.items.map((i) => ({ key: i.id + i.kind, date: i.date, el: <li key={i.id + i.kind} className={`tl ${i.urgency}${i.beforeStart ? " early" : ""}`}><time dateTime={i.date} className="mono">{fmtDate(i.date)}</time><span><Link href={`/programmes#${i.id}`}>{i.name}</Link>. {i.note}.</span></li> })),
    ...(project.start ? [{ key: "start", date: project.start, el: <li key="start" className="tl start"><time dateTime={project.start} className="mono">{fmtDate(project.start)}</time><span><b>Planned start of the project.</b> Anything that must be applied for first should be in before this date.</span></li> }] : [])].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section aria-label="Timeline">
      <div className="toolbar" style={{ marginBottom: 14 }}><h3 style={{ margin: 0 }}>Dates that matter</h3>
        <button type="button" className="btn alt" disabled={!t.items.some((i) => i.urgency !== "passed")} onClick={() => download("funding-deadlines.ics", toIcs(t.items, company), "text/calendar;charset=utf-8")}>Add to calendar (.ics)</button></div>
      {!project.start && <p className="faint" style={{ fontSize: 13.5 }}>Add a planned start date on the left to see which deadlines fall before it.</p>}
      {marks.length === 0 ? <p className="nt-muted">No matched programme has a fixed date.</p> : <ol className="tl-list">{marks.map((m) => m.el)}</ol>}
      {t.rolling.length > 0 && <p className="faint" style={{ fontSize: 13.5 }}>No fixed deadline (continuous): {t.rolling.map((r, i) => <span key={r.id}>{i > 0 && ", "}<Link href={`/programmes#${r.id}`}>{r.name}</Link></span>)}.</p>}
    </section>
  );
}

/* ---------- What if, and robustness ---------- */
const SIZES = ["micro", "small", "medium", "large"] as const;
export function WhatIfPanel({ profile, project, rows, onApply }: { profile: Profile; project: Project; rows: Scheme[]; onApply: (c: { size?: Profile["size"]; region?: string }) => void }) {
  const [size, setSize] = useState<string>(""); const [region, setRegion] = useState(""); const [started, setStarted] = useState<string>("");
  const rob = useMemo(() => robustness(profile, rows), [profile, rows]);
  const change: Partial<Profile> = { ...(size ? { size: size as Profile["size"] } : {}), ...(region.trim() ? { region: region.trim() } : {}) };
  const wi = useMemo(() => whatIf(profile, change, rows), [profile, size, region, rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const elig = useMemo(() => { const count = (p: Profile, pr: Project) => wi[p === profile ? "base" : "alt"].matches.reduce((n, m) => n + summarise(checksFor(p, pr, rows.find((r) => r.id === m.scheme_id)!)).fail, 0); const altProject = started ? { ...project, started: started as Project["started"] } : project; return { before: count(profile, project), after: count({ ...profile, ...change }, altProject) }; }, [wi, started, profile, project, rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = wi.diff, any = !!(size || region.trim() || started);
  return (
    <section aria-label="What if">
      <h3>How firm is this ranking?</h3>
      <div className={`rob ${rob.stable ? "stable" : "shaky"}`}><b>{rob.stable ? "Stable." : "Depends on what is not known."}</b> {rob.findings.length === 0 ? "Size and region are both given, so there is nothing left to vary." : rob.findings.map((f) => f.summary).join(" ")}</div>
      {rob.findings.find((f) => f.field === "region")?.variants.length ? <details className="dd"><summary>Which regions would unlock more programmes</summary><ul className="rob-list">{rob.findings.find((f) => f.field === "region")!.variants.map((v) => <li key={v.label}><button type="button" className="mini" onClick={() => setRegion(v.label)}>{v.label}</button> unlocks {v.appear.map((a) => a.name).join(", ")}</li>)}</ul></details> : null}
      <h3 style={{ marginTop: 26 }}>What if…</h3>
      <div className="wi-form">
        <div className="field"><label htmlFor="wi-size">Company size</label><select id="wi-size" value={size} onChange={(e) => setSize(e.target.value)}><option value="">As entered ({profile.size ?? "unknown"})</option>{SIZES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="field"><label htmlFor="wi-region">Region</label><input id="wi-region" value={region} placeholder={profile.region || "Saxony, NRW, Gelderland"} onChange={(e) => setRegion(e.target.value)} /></div>
        <div className="field"><label htmlFor="wi-start">Work already ordered or started</label><select id="wi-start" value={started} onChange={(e) => setStarted(e.target.value)}><option value="">As entered ({project.started === "yes" ? "yes" : project.started === "no" ? "no" : "not known"})</option><option value="no">Nothing ordered yet</option><option value="yes">Already ordered or started</option></select></div>
      </div>
      {!any ? <p className="nt-muted">Change a field to see which programmes appear, drop out or move.</p> : <div className="wi-out" role="status" aria-live="polite">
        <p><b>{d.appear.length}</b> appear · <b>{d.vanish.length}</b> drop out · <b>{d.moved.filter((x) => x.from !== x.to).length}</b> move · <b>{d.same}</b> stay as they are.</p>
        {d.appear.length > 0 && <p className="wi-up"><span className="mono">Appear</span> {d.appear.map((x) => x.name).join(", ")}</p>}
        {d.vanish.length > 0 && <p className="wi-down"><span className="mono">Drop out</span> {d.vanish.map((x) => x.name).join(", ")}</p>}
        {d.moved.length > 0 && <p><span className="mono">Move</span> {d.moved.filter((x) => x.from !== x.to).slice(0, 6).map((x) => `${x.name} ${x.from} to ${x.to}`).join(", ")}</p>}
        {started && <p><span className="mono">Blocking checks</span> {elig.before} now, {elig.after} in this case.</p>}
        <div className="wi-acts"><button type="button" className="btn alt" disabled={!size && !region.trim()} onClick={() => { onApply({ size: (size || undefined) as Profile["size"], region: region.trim() || undefined }); setSize(""); setRegion(""); }}>Use this in the company profile</button><button type="button" className="mini" onClick={() => { setSize(""); setRegion(""); setStarted(""); }}>Reset</button></div></div>}
    </section>
  );
}
