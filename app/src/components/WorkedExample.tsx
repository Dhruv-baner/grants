"use client";
import { useMemo, useState } from "react";
import { DEMOS, SCHEMES } from "@/lib/data";
import { match } from "@/lib/matcher";
import type { Profile } from "@/lib/types";
import { Status } from "./Marks";

const Bar = ({ label, v, max, neg }: { label: string; v: number; max: number; neg?: boolean }) => (
  <div className={"ex-bar" + (neg ? " neg" : "")}><span>{label}</span><span className="b"><i style={{ width: Math.min(100, (Math.abs(v) / max) * 100) + "%" }} /></span><span className="num" style={{ textAlign: "right" }}>{v > 0 && neg === false ? "+" : ""}{v}</span></div>
);
export default function WorkedExample() {
  const [id, setId] = useState("nl-manufacturer-energy"); const d = DEMOS.find((x) => x.id === id)!;
  const profile: Profile = useMemo(() => ({ ...d, signals: d.signals ?? [], description: d.description }), [d]);
  const res = useMemo(() => match(profile, SCHEMES), [profile]);
  return (
    <div>
      <div className="field" style={{ maxWidth: 420 }}><label htmlFor="ex">Sample company</label><select id="ex" value={id} onChange={(e) => setId(e.target.value)}>{DEMOS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <p className="muted" style={{ maxWidth: "62ch" }}>{d.description.replace("Fictional ", "")}. {res.matches.length} schemes passed; the top three are broken down below. Excluded: {Object.values(res.excluded).reduce((a, b) => a + b, 0)} rows.</p>
      <div style={{ display: "grid", gap: 36, marginTop: 28 }}>
        {res.matches.slice(0, 3).map((m, i) => (
          <div key={m.scheme_id} style={{ borderTop: "3px double var(--ink)", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "baseline", flexWrap: "wrap" }}><h3>{i + 1}. {m.name}</h3><span className="mono"><Status s={m.status_clean} /> · <b className="num">{m.score}</b> points · {m.fit} fit</span></div>
            <div style={{ maxWidth: 640, marginTop: 14 }}>
              <Bar label="Sector fit" v={m.breakdown.sector} max={40} /><Bar label="Shared themes" v={m.breakdown.themes} max={30} /><Bar label="Company size" v={m.breakdown.size} max={10} /><Bar label="Data quality" v={m.breakdown.data} max={10} /><Bar label="Timing" v={m.breakdown.status} max={10} />
              {m.breakdown.adjustments.map((a) => <Bar key={a.label} label={a.points > 0 ? "Bonus" : "Penalty"} v={a.points} max={15} neg={a.points < 0} />)}
            </div>
            {m.reasons.length > 0 && <p className="muted" style={{ marginTop: 10, fontSize: 15 }}>Because: {m.reasons.join("; ")}.</p>}
          </div>))}
      </div>
    </div>
  );
}
