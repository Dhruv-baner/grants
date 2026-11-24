"use client";
import { summarise, type Check } from "@/lib/screen/eligibility";

const MARK = { pass: "Clear", fail: "Blocked", unknown: "To confirm" } as const;
/** What is clear, what is blocked and what still needs confirming for one programme, and what would settle each unknown. */
export default function EligibilityChips({ checks }: { checks: Check[] }) {
  const s = summarise(checks);
  const head = s.headline === "clear" ? "All checks clear" : s.headline === "blocked" ? `${s.fail} blocked` : `${s.unknown} to confirm`;
  return (
    <details className="elig" open={s.headline !== "clear"}>
      <summary><span className={`elig-pill ${s.headline}`}>{head}</span><span className="elig-count mono">{s.pass} clear · {s.unknown} to confirm · {s.fail} blocked</span></summary>
      <ul className="elig-list">{checks.map((c) => <li key={c.id} className={c.verdict}><span className="elig-mark mono">{MARK[c.verdict]}</span><span><b>{c.label}.</b> {c.detail}{c.settle && <em className="elig-settle"> To settle it: {c.settle}.</em>}</span></li>)}</ul>
    </details>
  );
}
