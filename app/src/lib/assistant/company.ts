import { formatEur } from "../notes/numbers";
import type { Project } from "../screen/types";
import type { Profile } from "../types";

/** The company a chat is about, read from what the person described (or handed over from the Screen page). */
export interface CompanyCtx { profile: Profile; project: Project; label: string; }
const WHERE: Record<string, string> = { NL: "the Netherlands", DE: "Germany", EU: "the EU", OTHER: "" };
const BAND: Record<string, string> = { micro: "9 employees or fewer", small: "10 to 49 employees", medium: "50 to 249 employees", large: "more than 250 employees" };
const MONTH = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
/** A company and project as a few plain sentences the assistant can read back into a company, so a hand-over is an ordinary first message. */
export function companyToText(p: Profile, project: Project): string {
  const band = p.size && BAND[p.size] ? ` with ${BAND[p.size]}` : ""; const where = [p.region, WHERE[p.country]].filter(Boolean).join(", "); const out = [`We are a company${where ? ` in ${where}` : ""}${band}.`]; // a headcount range reads back as the right size, which a bare word like "medium" does not when the description also uses size words
  // The project comes before the description, in plain wording, so a budget or a date in the description cannot be mistaken for the project's.
  if (project.budget) out.push(`We plan to invest ${formatEur(project.budget)} in this project.`); if (project.start) out.push(`We plan to start in ${MONTH(project.start)}.`);
  if (project.started === "no") out.push("Nothing is ordered yet."); else if (project.started === "yes") out.push("Something has already been ordered or started.");
  const d = (p.description ?? "").replace(/\s+/g, " ").trim(); if (d) out.push(/[.!?]$/.test(d) ? d : d + "."); if (p.sectors?.length) out.push(`Sectors: ${p.sectors.join("; ")}.`);
  return out.join(" ");
}
