import type { Profile } from "../types";
import { sizeBand } from "./numbers";
import type { NoteResult } from "./types";

export const SCREEN_PREFILL_KEY = "gf-screen-prefill";
/** The company profile the Screen page uses, built only from what the call said. Null when the country is unknown. */
export function profileFromNote(n: NoteResult, title = ""): (Profile & { name: string }) | null {
  const cc = n.facts.country?.value as Profile["country"] | undefined; if (!cc) return null;
  const sectors = (n.facts.sector?.value ?? "").split(";").map((s) => s.trim()).filter(Boolean);
  const description = [n.facts.activity?.value, n.facts.project?.value, n.facts.amount ? `budget ${n.facts.amount.value}` : "", n.facts.timing ? `timing ${n.facts.timing.value}` : ""].filter(Boolean).join(". ");
  return { name: n.facts.company?.value ?? title, country: cc, region: n.facts.region?.value ?? "", size: n.nums.employees !== undefined ? sizeBand(n.nums.employees) : "unknown", sectors, signals: [], description: description || n.summary, activities: description };
}
