import { META, SCHEMES } from "@/lib/data";
import { countryGroup, SECTORS } from "@/lib/ui";

const LEVELS = ["Verified", "Verified (framework)", "Partial", "Candidate"] as const;
const COLORS: Record<string, string> = { Verified: "#4ade80", "Verified (framework)": "#5eead4", Partial: "#fbbf24", Candidate: "#7b86a8" };
export default function DataPage() {
  const countries = ["NL", "DE", "EU", "Cross-border"];
  const byC = countries.map((c) => { const rows = SCHEMES.filter((s) => countryGroup(s) === c); return { c, n: rows.length, counts: LEVELS.map((l) => rows.filter((r) => r.verification === l).length) }; }).filter((r) => r.n);
  const sectors = [...SECTORS, "All sectors"]; const max = Math.max(...sectors.flatMap((sec) => LEVELS.map((l) => SCHEMES.filter((s) => s.sector.split(";").map((x) => x.trim()).includes(sec) && s.verification === l).length)));
  const tiers = ["Official", "Secondary", "Trade press"].map((t) => ({ t, n: SCHEMES.reduce((a, s) => a + s.sources.filter((x) => x.tier === t).length, 0) }));
  const totalSrc = tiers.reduce((a, b) => a + b.n, 0);
  const conflicts = SCHEMES.filter((s) => s.conflicts);
  const unknownSize = SCHEMES.filter((s) => s.eligible_sizes === "unknown").length, unknownBefore = SCHEMES.filter((s) => s.before_start_flag === "unknown").length;
  return (
    <>
      <h1>Data trust</h1>
      <p className="lead">What is solid, what is not, and where sources disagree. Dataset v{META.version}, as of {META.as_of}.</p>
      <h2>Trust level by country</h2>
      <div className="card">
        {byC.map((r) => (<div key={r.c} style={{ margin: "10px 0" }}><div className="row between small"><b>{r.c}</b><span className="muted">{r.n} rows</span></div>
          <div style={{ display: "flex", height: 18, borderRadius: 6, overflow: "hidden", background: "#1c2754" }}>{r.counts.map((n, i) => n ? <div key={i} title={`${LEVELS[i]}: ${n}`} style={{ width: (n / r.n) * 100 + "%", background: COLORS[LEVELS[i]] }} /> : null)}</div></div>))}
        <div className="row small muted" style={{ marginTop: 8 }}>{LEVELS.map((l) => <span key={l}><span style={{ display: "inline-block", width: 10, height: 10, background: COLORS[l], borderRadius: 2, marginRight: 5 }} />{l}</span>)}</div>
      </div>
      <h2>Trust level by sector</h2>
      <div className="card" style={{ overflow: "auto" }}>
        <table><thead><tr><th>Sector</th>{LEVELS.map((l) => <th key={l}>{l}</th>)}</tr></thead><tbody>
          {sectors.map((sec) => (<tr key={sec}><td>{sec}</td>{LEVELS.map((l) => { const n = SCHEMES.filter((s) => s.sector.split(";").map((x) => x.trim()).includes(sec) && s.verification === l).length;
            return <td key={l} style={{ background: `rgba(94,234,212,${(n / max) * 0.55})`, textAlign: "center" }}>{n || ""}</td>; })}</tr>))}
        </tbody></table>
        <div className="small muted">A row can carry up to three sector tags, so rows are counted under each tag. Sector tags are our judgment, not Ignite's.</div>
      </div>
      <div className="grid g2">
        <div><h2>Source quality</h2><div className="card">
          {tiers.map((t) => <div key={t.t} className="row between small" style={{ margin: "8px 0" }}><span>{t.t}</span><span><span className="bar" style={{ width: 200 }}><i style={{ width: (t.n / totalSrc) * 100 + "%" }} /></span> {t.n}</span></div>)}
          <p className="small muted">{totalSrc} source links in total.</p></div></div>
        <div><h2>Known gaps</h2><div className="card"><ul className="tight small">
          <li>{unknownSize} rows do not state which company sizes can apply; the matcher treats this as "check".</li>
          <li>{unknownBefore} rows do not state whether the project may start before applying.</li>
          <li>{SCHEMES.filter((s) => s.verification === "Partial" || s.verification === "Candidate").length} rows are Partial or Candidate and must be verified before quoting.</li>
          <li>{SCHEMES.filter((s) => s.status_clean === "unknown").length} rows have no clear open or closed status.</li></ul></div></div>
      </div>
      <h2>Where sources disagree ({conflicts.length} rows)</h2>
      <div className="card" style={{ padding: 0, overflow: "auto" }}><table><thead><tr><th>Programme</th><th>Conflict</th></tr></thead><tbody>
        {conflicts.map((s) => <tr key={s.id}><td><b>{s.name}</b></td><td className="small">{s.conflicts}</td></tr>)}</tbody></table></div>
    </>
  );
}
