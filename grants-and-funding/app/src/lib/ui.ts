import type { Scheme } from "./types";
export const vClass = (v: string) => (v === "Verified" ? "b-Verified" : v === "Verified (framework)" ? "b-fw" : v === "Partial" ? "b-Partial" : "b-Candidate");
export const vLabel = (v: string) => (v === "Verified (framework)" ? "Verified: framework" : v);
export const fmtDate = (iso: string) => (iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const countryGroup = (s: Scheme) => (s.country.startsWith("EU") ? "EU" : s.country.includes("/") ? "Cross-border" : s.country);
export const SECTORS = ["Energy & climate", "Industry & manufacturing", "Digital, AI & ICT", "Health & life sciences", "Agriculture & food", "Buildings & real estate",
  "Transport & maritime", "Circular economy & environment", "Creative, media & games", "Defence & security", "Education & skills", "Public sector & municipalities"];
