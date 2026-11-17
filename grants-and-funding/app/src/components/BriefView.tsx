"use client";
import { Fragment } from "react";
import type { Brief } from "@/lib/explainer";
import { renderMarkdown, toCsv } from "@/lib/explainer";
import { Confidence, Status } from "./Badges";
import { fmtDate } from "@/lib/ui";

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export default function BriefView({ brief, excluded }: { brief: Brief; excluded?: Record<string, number> }) {
  const slug = (brief.company.name ?? "company").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const why = Object.entries(excluded ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <div className="row between noprint" style={{ marginBottom: 12 }}>
        <div className="muted small">{brief.matches.length} matches, {brief.not_open.length} relevant but not open, {brief.check_manually.length} to check manually</div>
        <div className="row">
          <button className="btn ghost" onClick={() => download(slug + "-brief.md", renderMarkdown(brief), "text/markdown")}>Markdown</button>
          <button className="btn ghost" onClick={() => download(slug + "-matches.csv", toCsv(brief), "text/csv")}>CSV for CRM</button>
          <button className="btn ghost" onClick={() => download(slug + "-brief.json", JSON.stringify(brief, null, 1), "application/json")}>JSON</button>
          <button className="btn" onClick={() => window.print()}>Print / PDF</button>
        </div>
      </div>
      {!brief.matches.length && <div className="card">No open scheme passed the filters for this profile. Try adding sectors or signals, or check the lists below.</div>}
      <div className="grid">
        {brief.matches.map((m, i) => (
          <div className="card" key={m.scheme_id}>
            <div className="row between">
              <h3>{i + 1}. {m.name}</h3>
              <div className="row"><span className={"fit " + m.fit}>{m.fit} fit</span><span className="bar" title={"score " + m.score}><i style={{ width: Math.min(100, m.score) + "%" }} /></span><span className="muted small">{m.score}</span></div>
            </div>
            <div className="row" style={{ margin: "6px 0 10px" }}>
              <Confidence v={m.data_confidence} /><Status s={m.status_clean} /><span className="badge" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>{m.type_group}</span>
              {m.next_deadline && <span className="small muted">next deadline {fmtDate(m.next_deadline)}</span>}
            </div>
            <p style={{ margin: "0 0 8px" }}><b>Why it may fit.</b> {m.why_it_fits}</p>
            {m.watch_outs.length > 0 && <div className="warn"><b>Watch-outs</b><ul className="tight">{m.watch_outs.map((w) => <li key={w}>{w}</li>)}</ul></div>}
            <details><summary>Key terms (copied from the data, as of {m.as_of})</summary>
              <dl className="kv">{Object.entries(m.key_terms).filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt>{k.replaceAll("_", " ")}</dt><dd>{v}</dd></Fragment>)}</dl>
            </details>
            {m.questions.length > 0 && <details><summary>Questions for the consultant</summary><ul className="tight">{m.questions.map((q) => <li key={q}>{q}</li>)}</ul></details>}
            <details><summary>Sources ({m.sources.length})</summary><ul className="tight">{m.sources.map((s) => <li key={s.url}><span className="badge" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>{s.tier}</span> <a href={s.url} target="_blank" rel="noopener noreferrer">{s.field}</a></li>)}</ul></details>
          </div>
        ))}
      </div>
      {brief.not_open.length > 0 && <><h2>Relevant but not open now</h2><div className="card"><ul className="tight">{brief.not_open.map((x) => <li key={x.scheme_id}>{x.name} <Status s={x.status_clean} /> {x.next_deadline ? <span className="muted small">next date {fmtDate(x.next_deadline)}</span> : <span className="muted small">no next date known</span>}</li>)}</ul></div></>}
      {brief.check_manually.length > 0 && <><h2>To check manually</h2><div className="card"><ul className="tight">{brief.check_manually.map((x) => <li key={x.scheme_id}>{x.name} <span className="muted small">(unverified or unknown status)</span></li>)}</ul></div></>}
      {why.length > 0 && <details className="noprint" style={{ marginTop: 18 }}><summary>Why other schemes were left out</summary><ul className="tight">{why.map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul></details>}
    </div>
  );
}
