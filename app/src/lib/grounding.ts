// Port of the number-grounding check in pipeline/explainer.py: generated text may not contain numbers absent from the data.
import type { Profile, Scheme } from "./types";
const NUM = /(?<![\w.])(\d+(?:[.,]\d+)*)(\s?(?:%|percent|k\b|m\b|bn\b|million|billion))?/gi;
const ALLOWED_FIELDS = ["name", "summary", "status", "window", "funding_rate", "caps", "budget", "before_start", "assessment", "applicants", "activities",
  "instrument_detail", "eligible_costs", "closes_date", "size_rule", "stage"];
const norm = (t: string) => t.replaceAll(",", "").replace(/\.$/, "");
export function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of (text || "").matchAll(NUM)) {
    const n = norm(m[1]); const unit = m[2] ?? "";
    const smallInt = !unit && !m[1].includes(".") && !m[1].includes(",") && parseInt(n, 10) <= 31;
    if (!smallInt) out.add(n);
  }
  return out;
}
export function allowedNumbers(row: Scheme, profile?: Partial<Profile>): Set<string> {
  const txt = ALLOWED_FIELDS.map((k) => String(row[k] ?? "")).join(" ") + " " + (profile?.activities ?? "");
  return new Set([...txt.matchAll(NUM)].map((m) => norm(m[1])));
}
export function groundingViolations(text: string, row: Scheme, profile?: Partial<Profile>): string[] {
  const allowed = allowedNumbers(row, profile);
  return [...numbersIn(text)].filter((n) => !allowed.has(n)).sort();
}
