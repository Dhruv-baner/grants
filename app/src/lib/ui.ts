import type { Scheme } from "./types";
export const vClass = (v: string) => (v === "Verified" ? "b-Verified" : v === "Verified (framework)" ? "b-fw" : v === "Partial" ? "b-Partial" : "b-Candidate");
export const vLabel = (v: string) => (v === "Verified (framework)" ? "Verified: framework" : v);
export const fmtDate = (iso: string) => (iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const countryGroup = (s: Scheme) => (s.country.startsWith("EU") ? "EU" : s.country.includes("/") ? "Cross-border" : s.country);
export const SECTORS = ["Energy & climate", "Industry & manufacturing", "Digital, AI & ICT", "Health & life sciences", "Agriculture & food", "Buildings & real estate",
  "Transport & maritime", "Circular economy & environment", "Creative, media & games", "Defence & security", "Education & skills", "Public sector & municipalities"];
export const LABEL: Record<string, string> = { open: "Open", opening_soon: "Opening soon", rolling: "Rolling", between_rounds: "Between rounds", paused: "Paused", varies: "Varies by call", closed: "Closed", unknown: "Unknown" };
/** Research notes that compare with Ignite's own listing stay in the data but are never shown: drops any bracketed note or sentence that mentions it. */
export function clean(s: string): string {
  if (!s) return s;
  const t = s.replace(/\s*\([^()]*ignite[^()]*\)/gi, "");
  return t.split(/(?<=[.;])\s+/).filter((p) => !/ignite/i.test(p)).join(" ").replace(/\s+([.;,])/g, "$1").replace(/\s{2,}/g, " ").trim();
}
/** A company's own listing page is not evidence for a scheme's facts, so it is never shown as a source. */
export const visibleSources = <T extends { field: string; url: string }>(l: T[]) => l.filter((s) => !/ignite/i.test(s.field + " " + s.url));
