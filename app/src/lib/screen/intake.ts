// Reads a project description (typed or pasted) into company details and project facts, with the same rules as the call notes. Free, instant, offline.
import { extractNotes } from "../notes/extract";
import type { Profile } from "../types";
import type { Project, Started } from "./types";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const SEASON: Record<string, number> = { spring: 2, summer: 5, autumn: 8, fall: 8, winter: 11 };
const iso = (y: number, m: number, d = 1) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** "in spring", "by the end of March", "Q3", "next year" -> a date, relative to a reference day. Null when it cannot be read. */
export function parseStart(text: string, asOf: string): string | null {
  const t = text.toLowerCase(), y = Number(asOf.slice(0, 4)), m0 = Number(asOf.slice(5, 7)) - 1; const nextOcc = (m: number) => (m >= m0 ? y : y + 1);
  const mi = MONTHS.findIndex((m) => new RegExp(`\\b${m}\\b`).test(t)); const yr = t.match(/\b(20\d\d)\b/);
  if (mi >= 0) { const year = yr ? Number(yr[1]) : nextOcc(mi); return /end of/.test(t) ? iso(year, mi, new Date(Date.UTC(year, mi + 1, 0)).getUTCDate()) : iso(year, mi); }
  for (const [s, m] of Object.entries(SEASON)) if (new RegExp(`\\b${s}\\b`).test(t)) return iso(yr ? Number(yr[1]) : nextOcc(m), m);
  const q = t.match(/\bq([1-4])\b/) ?? t.match(/\b(first|second|third|fourth) quarter\b/); if (q) { const n = /^\d$/.test(q[1]) ? Number(q[1]) : ["first", "second", "third", "fourth"].indexOf(q[1]) + 1; return iso(yr ? Number(yr[1]) : nextOcc((n - 1) * 3), (n - 1) * 3); }
  if (/next month/.test(t)) return iso(m0 === 11 ? y + 1 : y, (m0 + 1) % 12); if (/next quarter/.test(t)) { const nq = (Math.floor(m0 / 3) + 1) * 3; return iso(nq >= 12 ? y + 1 : y, nq % 12); }
  if (/next year/.test(t)) return iso(y + 1, 0); if (yr) return iso(Number(yr[1]), 0); return null;
}
export interface Intake { fields: Partial<{ name: string; country: Profile["country"]; region: string; size: NonNullable<Profile["size"]>; sectors: string[]; description: string }>; project: Project; found: string[]; }
export function intakeFromText(text: string, asOf: string): Intake {
  const n = extractNotes(text), f = n.facts, fields: Intake["fields"] = {}, found: string[] = [];
  if (f.company) { fields.name = f.company.value; found.push("company name"); }
  if (f.country) { fields.country = f.country.value as Profile["country"]; found.push("country"); } if (f.region) { fields.region = f.region.value; found.push("region"); }
  if (f.size) { fields.size = f.size.value as NonNullable<Profile["size"]>; found.push("size"); }
  if (f.sector) { fields.sectors = f.sector.value.split(";").map((s) => s.trim()).filter(Boolean).slice(0, 3); found.push("sector"); }
  const desc = [f.activity?.value, f.project?.value].filter(Boolean).join(". "); if (desc) { fields.description = desc; found.push("what the company does"); }
  const project: Project = { started: n.ordered as Started, text: text.slice(0, 2000) }; if (n.ordered !== "unknown") found.push(n.ordered === "yes" ? "already ordered or started" : "nothing ordered yet");
  if (n.nums.amountEur) { project.budget = n.nums.amountEur; found.push("budget"); } if (f.timing) { const s = parseStart(f.timing.value, asOf); if (s) { project.start = s; found.push("start date"); } }
  return { fields, project, found };
}
