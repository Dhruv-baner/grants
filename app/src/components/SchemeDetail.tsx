import { Fragment } from "react";
import type { Scheme } from "@/lib/types";
import { clean, visibleSources } from "@/lib/ui";
import { Status, Trust } from "./Marks";
export default function SchemeDetail({ s }: { s: Scheme }) {
  const rows: [string, string][] = ([["Status", s.status], ["Who can apply", s.applicants], ["Funding rate", s.funding_rate], ["Caps", s.caps], ["Budget", s.budget], ["Window", s.window], ["Before starting", s.before_start], ["Assessment", s.assessment]] as [string, string][]).map(([k, v]) => [k, clean(v)] as [string, string]).filter(([, v]) => v);
  return (
    <div>
      <div className="d-meta mono"><Trust v={s.verification} /><Status s={s.status_clean} /><span>{s.country} · {s.type_group}</span>{s.row_type === "call" && <span>Call under {s.parent_id}</span>}</div>
      <p style={{ fontSize: 18 }}>{s.summary}</p>
      <dl className="dl">{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
      {clean(s.rejection_risks) && <div className="watch"><div className="lbl">Typical rejection risks</div>{clean(s.rejection_risks)}</div>}
      {clean(s.conflicts) && <div className="watch"><div className="lbl">Where sources disagree</div>{clean(s.conflicts)}</div>}
      <p className="faint" style={{ fontSize: 13.5, marginTop: 14 }}>{s.confidence} (as of {s.as_of})</p>
      <div className="lbl" style={{ marginTop: 18 }}>Sources</div>
      <ul className="srcs">{visibleSources(s.sources).map((x) => <li key={x.url}><span className="mono faint" style={{ width: 92, flex: "none" }}>{x.tier}</span><a href={x.url} target="_blank" rel="noopener noreferrer">{x.field}</a></li>)}</ul>
    </div>
  );
}
