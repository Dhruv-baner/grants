"use client";
import { Fragment } from "react";
import type { Brief } from "@/lib/explainer";
import { renderMarkdown, toCsv } from "@/lib/explainer";
import { clean, fmtDate } from "@/lib/ui";
import type { Check } from "@/lib/screen/eligibility";
import EligibilityChips from "./Eligibility";
import { Status, Trust } from "./Marks";

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
const sign = (n: number) => (n > 0 ? "+" + n : String(n));
export function Ledger({ b, total }: { b: Brief["matches"][number]["breakdown"]; total?: number }) {
  const lines: [string, number][] = [["Sector fit", b.sector], ["Shared themes", b.themes], ["Company size", b.size], ["Data quality", b.data], ["Timing", b.status], ...b.adjustments.map((a) => [a.label, a.points] as [string, number])];
  return <ul className="ledger" aria-label="Score breakdown">{lines.map(([l, p]) => <li key={l} className={p < 0 ? "neg" : ""}><span>{l}</span><span className="ld" /><span className="pt">{sign(p)}</span></li>)}{total !== undefined && <li className="tot"><span>Total</span><span className="ld" style={{ borderBottomStyle: "none" }} /><span className="pt">{total}</span></li>}</ul>;
}
export default function BriefView({ brief, excluded, checks, canEstimate, onEstimate, onPrint }: { brief: Brief; onPrint?: () => void; excluded?: Record<string, number>; checks?: Record<string, Check[]>; canEstimate?: (id: string) => boolean; onEstimate?: (id: string) => void }) {
  const slug = (brief.company.name ?? "company").toLowerCase().replace(/[^a-z0-9]+/g, "-"); const why = Object.entries(excluded ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <div className="toolbar noprint"><div className="mono muted num">{brief.matches.length} matches · {brief.not_open.length} not open · {brief.check_manually.length} to check</div>
        <div className="acts"><button className="btn alt" onClick={() => download(slug + "-brief.md", renderMarkdown(brief), "text/markdown")}>Markdown</button><button className="btn alt" onClick={() => download(slug + "-matches.csv", toCsv(brief), "text/csv")}>CSV for CRM</button>
          <button className="btn alt" onClick={() => download(slug + "-brief.json", JSON.stringify({ ...brief, matches: brief.matches.map((m) => ({ ...m, key_terms: Object.fromEntries(Object.entries(m.key_terms).map(([k, v]) => [k, clean(v)])) })) }, null, 1), "application/json")}>JSON</button><button className="btn" onClick={() => (onPrint ? onPrint() : window.print())}>Print / PDF</button></div></div>
      {!brief.matches.length && <p className="d-why">No open scheme passed the filters for this profile. Add sectors or signals, or look at the lists below.</p>}
      {brief.matches.map((m, i) => (
        <article className="dossier" id={"m-" + m.scheme_id} key={m.scheme_id}>
          <div className="d-head">
            <div className="d-no" aria-hidden="true">{i + 1}</div>
            <div><h3>{m.name}</h3><div className="d-meta mono"><Trust v={m.data_confidence} /><span>{m.type_group}</span><Status s={m.status_clean} />{m.next_deadline && <span className="num">Closes {fmtDate(m.next_deadline)}</span>}</div></div>
          </div>
          <p className="d-why">{m.why_it_fits}</p>
          {m.watch_outs.filter((w) => !(checks?.[m.scheme_id] && /:\s*check$/i.test(w))).length > 0 && <ul className="watch" style={{ listStyle: "none" }}>{m.watch_outs.filter((w) => !(checks?.[m.scheme_id] && /:\s*check$/i.test(w))).map((w) => clean(w) && <li key={w}>{clean(w)}</li>)}</ul>}
          {checks?.[m.scheme_id] && <EligibilityChips checks={checks[m.scheme_id]} />}
          {onEstimate && canEstimate?.(m.scheme_id) && <button type="button" className="btn alt noprint est-btn" onClick={() => onEstimate(m.scheme_id)}>Estimate the aid</button>}
          <details className="dd"><summary>How this was rated</summary><p className="fit-line">{m.fit.charAt(0).toUpperCase() + m.fit.slice(1)} fit</p><Ledger b={m.breakdown} /></details>
          <details className="dd"><summary>Key terms, copied from the data (as of {m.as_of})</summary><dl className="dl" style={{ marginBottom: 12 }}>{Object.entries(m.key_terms).filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt>{k.replaceAll("_", " ")}</dt><dd>{clean(v)}</dd></Fragment>)}</dl></details>
          {m.questions.length > 0 && <details className="dd"><summary>Questions for the consultant</summary><ul style={{ paddingLeft: 18, margin: "0 0 12px" }}>{m.questions.map((q) => <li key={q}>{q}</li>)}</ul></details>}
          <details className="dd"><summary>Sources ({m.sources.length})</summary><ul className="srcs">{m.sources.map((s) => <li key={s.url}><span className="mono faint" style={{ width: 92, flex: "none" }}>{s.tier}</span><a href={s.url} target="_blank" rel="noopener noreferrer">{s.field}</a></li>)}</ul></details>
        </article>))}
      {brief.not_open.length > 0 && <section style={{ marginTop: 40 }}><div className="lbl">Relevant, but not open now</div>{brief.not_open.map((x) => <div className="led-row" key={x.scheme_id}><span style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 24 }}>{x.name}</span><span className="mono"><Status s={x.status_clean} />{x.next_deadline ? " · next " + fmtDate(x.next_deadline) : ""}</span></div>)}</section>}
      {brief.check_manually.length > 0 && <section style={{ marginTop: 32 }}><div className="lbl">To check by hand: unverified, or status unknown</div>{brief.check_manually.map((x) => <div className="led-row" key={x.scheme_id}><span style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 22 }}>{x.name}</span><span className="mono faint">Not ranked</span></div>)}</section>}
      {why.length > 0 && <details className="dd noprint" style={{ marginTop: 28 }}><summary>Why other schemes were left out</summary><ul className="ledger">{why.map(([k, v]) => <li key={k}><span>{k}</span><span className="ld" /><span className="pt num">{v}</span></li>)}</ul></details>}
    </div>
  );
}
