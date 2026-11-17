import { META, SCHEMES } from "@/lib/data";
import { Confidence } from "@/components/Badges";
import { daysBetween, fmtDate } from "@/lib/ui";

export default function Deadlines() {
  const HORIZON = 120, W = 1100, PAD = 40, LANES = 7, LANE_H = 34, TOP = 40, H = TOP + LANES * LANE_H + 20;
  const items = SCHEMES.filter((s) => ["open", "opening_soon"].includes(s.status_clean) && s.closes_date && daysBetween(META.as_of, s.closes_date) >= 0)
    .sort((a, b) => a.closes_date.localeCompare(b.closes_date));
  const inRange = items.filter((s) => daysBetween(META.as_of, s.closes_date) <= HORIZON);
  const x = (d: number) => PAD + (d / HORIZON) * (W - 2 * PAD);
  const lastX: number[] = Array(LANES).fill(-1e9);
  const placed = inRange.map((s) => {
    const d = daysBetween(META.as_of, s.closes_date); const px = x(d);
    let lane = lastX.findIndex((lx) => px - lx > 128); if (lane < 0) lane = lastX.indexOf(Math.min(...lastX));
    lastX[lane] = px; return { s, px, lane, d };
  });
  const start = new Date(META.as_of + "T00:00:00Z"); const months: { d: number; label: string }[] = [];
  for (let m = 1; m <= 5; m++) { const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 1)); const d = Math.round((+dt - +start) / 86400000); if (d <= HORIZON) months.push({ d, label: dt.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }) }); }
  const rolling = SCHEMES.filter((s) => s.status_clean === "rolling").length;
  const col = (d: number) => (d <= 14 ? "var(--bad)" : d <= 35 ? "var(--warn)" : "var(--accent)");
  return (
    <>
      <h1>Deadlines</h1>
      <p className="lead">Open and opening-soon schemes with a known closing date, next {HORIZON} days from {fmtDate(META.as_of)}. {rolling} more schemes run on a rolling basis with no closing date.</p>
      <div className="card" style={{ overflow: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Deadline timeline">
          {months.map((m) => <g key={m.label}><line x1={x(m.d)} x2={x(m.d)} y1={22} y2={H - 10} stroke="#25325f" strokeDasharray="3 4" /><text x={x(m.d) + 4} y={16}>{m.label}</text></g>)}
          <line x1={x(0)} x2={x(0)} y1={22} y2={H - 10} stroke="var(--accent)" strokeWidth={2} /><text x={x(0) + 4} y={16} className="strong">today</text>
          {placed.map(({ s, px, lane, d }) => { const y = TOP + lane * LANE_H; return (
            <g key={s.id}><title>{`${s.name}: closes ${fmtDate(s.closes_date)}`}</title>
              <line x1={px} x2={px} y1={22} y2={y} stroke={col(d)} strokeOpacity={0.35} />
              <circle cx={px} cy={y} r={5} fill={col(d)} /><text x={px + 8} y={y + 4} className="strong">{(s.name.length > 24 ? s.name.slice(0, 23) + "…" : s.name)}</text></g>); })}
        </svg>
        <div className="small muted">Red: 14 days or less. Amber: 35 days or less. Teal: later. Hover a dot for the full name.</div>
      </div>
      <h2>All upcoming closing dates ({items.length})</h2>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table><thead><tr><th>Closes</th><th>In</th><th>Programme</th><th>Country</th><th>Trust</th></tr></thead><tbody>
          {items.map((s) => { const d = daysBetween(META.as_of, s.closes_date); return (
            <tr key={s.id}><td>{fmtDate(s.closes_date)}</td><td style={{ color: col(d) }}>{d} days</td><td><b>{s.name}</b><div className="muted small">{s.status}</div></td><td>{s.country}</td><td><Confidence v={s.verification} /></td></tr>); })}
        </tbody></table>
      </div>
    </>
  );
}
