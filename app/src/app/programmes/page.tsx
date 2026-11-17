"use client";
import { Fragment } from "react";
import { useMemo, useState } from "react";
import { Confidence, Status } from "@/components/Badges";
import { SCHEMES } from "@/lib/data";
import { countryGroup, fmtDate, SECTORS } from "@/lib/ui";
import type { Scheme } from "@/lib/types";

const uniq = (f: (s: Scheme) => string) => [...new Set(SCHEMES.map(f))].sort();
export default function Programmes() {
  const [q, setQ] = useState(""); const [country, setCountry] = useState(""); const [tg, setTg] = useState(""); const [sector, setSector] = useState("");
  const [status, setStatus] = useState(""); const [ver, setVer] = useState(""); const [calls, setCalls] = useState(true); const [sel, setSel] = useState<Scheme | null>(null);
  const rows = useMemo(() => SCHEMES.filter((s) =>
    (!q || (s.name + " " + s.aliases + " " + s.summary).toLowerCase().includes(q.toLowerCase())) && (!country || countryGroup(s) === country) &&
    (!tg || s.type_group === tg) && (!sector || s.sector.split(";").map((x) => x.trim()).includes(sector)) && (!status || s.status_clean === status) &&
    (!ver || s.verification === ver) && (calls || s.row_type === "scheme")).sort((a, b) => (a.closes_date || "9").localeCompare(b.closes_date || "9") || a.name.localeCompare(b.name)), [q, country, tg, sector, status, ver, calls]);
  const Sel = ({ v, set, opts, ph }: { v: string; set: (x: string) => void; opts: string[]; ph: string }) => <select value={v} onChange={(e) => set(e.target.value)} style={{ width: "auto" }}><option value="">{ph}</option>{opts.map((o) => <option key={o}>{o}</option>)}</select>;
  return (
    <>
      <h1>Programmes</h1>
      <p className="lead">All {SCHEMES.length} rows with filters. Click a row for the full terms, conflicts and sources.</p>
      <div className="row" style={{ marginBottom: 14 }}>
        <input style={{ width: 240 }} placeholder="Search name or summary" value={q} onChange={(e) => setQ(e.target.value)} />
        <Sel v={country} set={setCountry} opts={uniq(countryGroup)} ph="Country" /><Sel v={tg} set={setTg} opts={uniq((s) => s.type_group)} ph="Type" />
        <Sel v={sector} set={setSector} opts={SECTORS} ph="Sector" /><Sel v={status} set={setStatus} opts={uniq((s) => s.status_clean)} ph="Status" />
        <Sel v={ver} set={setVer} opts={uniq((s) => s.verification)} ph="Trust level" />
        <label style={{ margin: 0, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" style={{ width: "auto" }} checked={calls} onChange={(e) => setCalls(e.target.checked)} />include call rows</label>
        <span className="muted small">{rows.length} shown</span>
      </div>
      <div className={sel ? "split" : ""} style={sel ? { gridTemplateColumns: "1fr 440px" } : {}}>
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table><thead><tr><th>Programme</th><th>Country</th><th>Type</th><th>Status</th><th>Closes</th><th>Trust</th></tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.id} className={"clk" + (sel?.id === s.id ? " sel" : "")} onClick={() => setSel(s)}>
                <td><b>{s.name}</b>{s.row_type === "call" && <span className="muted small"> · call under {s.parent_id}</span>}<div className="muted small">{s.sector}</div></td>
                <td>{countryGroup(s)}</td><td>{s.type_group}</td><td><Status s={s.status_clean} /></td><td>{fmtDate(s.closes_date)}</td><td><Confidence v={s.verification} /></td>
              </tr>))}</tbody></table>
        </div>
        {sel && (
          <div className="card panel">
            <div className="row between"><h3>{sel.name}</h3><button className="btn ghost" onClick={() => setSel(null)}>Close</button></div>
            <div className="row" style={{ margin: "6px 0" }}><Confidence v={sel.verification} /><Status s={sel.status_clean} /></div>
            <p>{sel.summary}</p>
            <dl className="kv">{([["status", sel.status], ["applicants", sel.applicants], ["funding rate", sel.funding_rate], ["caps", sel.caps], ["budget", sel.budget], ["window", sel.window],
              ["before start", sel.before_start], ["assessment", sel.assessment]] as [string, string][]).filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
            {sel.rejection_risks && <div className="warn" style={{ margin: "10px 0" }}><b>Rejection risks:</b> {sel.rejection_risks}</div>}
            {sel.conflicts && <div className="warn" style={{ margin: "10px 0" }}><b>Source conflict:</b> {sel.conflicts}</div>}
            <p className="small muted">{sel.confidence} (as of {sel.as_of})</p>
            <h3>Sources</h3><ul className="tight">{sel.sources.map((s) => <li key={s.url}><span className="badge" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>{s.tier}</span> <a href={s.url} target="_blank" rel="noopener noreferrer">{s.field}</a></li>)}</ul>
          </div>)}
      </div>
    </>
  );
}
