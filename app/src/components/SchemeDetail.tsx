import { Fragment } from "react";
import type { Scheme } from "@/lib/types";
import { plain, visibleSources } from "@/lib/ui";
import { Status } from "./Marks";
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
export default function SchemeDetail({ s }: { s: Scheme }) {
  const rows: [string, string][] = ([["Status", s.status], ["Who can apply", s.applicants], ["Funding rate", s.funding_rate], ["Caps", s.caps], ["Budget", s.budget], ["Window", s.window], ["Before starting", s.before_start], ["Assessment", s.assessment]] as [string, string][]).map(([k, v]) => [k, plain(v)] as [string, string]).filter(([, v]) => v);
  return (
    <div>
      <div className="d-meta mono"><Status s={s.status_clean} /><span>{s.country} · {s.type_group}</span>{s.row_type === "call" && <span>Call under {s.parent_id}</span>}</div>
      <p style={{ fontSize: 18 }}>{plain(s.summary)}</p>
      <dl className="dl">{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
      {plain(s.rejection_risks) && <div className="watch"><div className="lbl">Typical rejection risks</div>{plain(s.rejection_risks)}</div>}
      <div className="lbl" style={{ marginTop: 18 }}>Sources</div>
      <ul className="src-list">{visibleSources(s.sources).map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="noopener noreferrer"><span className="t">{x.field}</span><span className="h mono">{host(x.url)}</span></a></li>)}</ul>
    </div>
  );
}
