// Which programmes can be combined, and in what order to apply. Only rules with a recorded source are stated; any other pair is "not recorded".
import type { Scheme } from "../types";
import { plain } from "../ui";

export type Verdict = "no" | "yes" | "conditional";
export interface Rule { a: string; b: string; verdict: Verdict; note: string; source: { label: string; url: string }; }
const RVO_MIA = { label: "RVO, MIA\\Vamil conditions (checked 29 July 2026)", url: "https://www.rvo.nl/subsidies-financiering/mia-vamil/ondernemers/voorwaarden" };
const DATA = { label: "The programme record (as recorded on 17 Nov 2026)", url: "/programmes" };
export const RULES: Rule[] = [
  { a: "EIA", b: "MIA_VAMIL", verdict: "conditional", note: "Costs that already get EIA cannot also get MIA. Vamil can still be added for the same costs.", source: RVO_MIA },
  { a: "ISDE", b: "SDE_PP", verdict: "no", note: "SDE++ excludes ISDE for the same installation.", source: DATA },
  { a: "SDE_PP", b: "EIA", verdict: "no", note: "No EIA for the same installation as SDE++.", source: DATA },
  { a: "ISDE", b: "EIA", verdict: "no", note: "ISDE cannot be combined with EIA for the same asset.", source: DATA },
];
/** Rules inside one programme record. */
export const WITHIN: Record<string, string> = { BEG_NWG: "Within BEG, EM and NWG cannot be combined, and a 3-year lock applies between them (as recorded).", STUDI: "A comparable study is limited by the de minimis room left (EUR 300,000 over 3 years), as recorded." };
export const STATE_AID = "All support for the same costs together must stay within the EU state-aid limits, and support over EUR 100,000 is published (RVO).";
const GENERAL = STATE_AID;
export const ruleFor = (a: string, b: string) => RULES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));

export interface Conflict { a: string; b: string; rule: Rule; }
export interface Step { id: string; name: string; why: string; kind: "first" | "clock" | "deadline" | "later"; closes?: string; }
export interface Plan { conflicts: Conflict[]; unknownPairs: number; order: Step[]; notes: string[]; }
const FIRST = /^\s*yes\b/i, EARLY = /early start|apply before|mandatory .*consultation/i, CLOCK = /order date|within \d+ months|three months|3 months|months? (?:of|after|from)/i;
export function stackPlan(ids: string[], by: Record<string, Scheme>): Plan {
  const list = ids.filter((i) => by[i]); const conflicts: Conflict[] = []; let unknownPairs = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const rule = ruleFor(list[i], list[j]); if (rule && rule.verdict !== "yes") conflicts.push({ a: list[i], b: list[j], rule }); else if (!rule) unknownPairs++; }
  const rank = (r: Scheme) => { const bs = String(r.before_start ?? ""); return FIRST.test(bs) || EARLY.test(bs) ? 0 : CLOCK.test(bs) ? 1 : r.closes_date ? 2 : 3; };
  const order: Step[] = list.map((id) => { const r = by[id], bs = String(r.before_start ?? ""), k = rank(r);
    return { id, name: r.name, kind: (["first", "clock", "deadline", "later"] as const)[k], closes: r.closes_date || undefined,
      why: k === 0 ? `Apply first: ${plain(bs).slice(0, 110)}` : k === 1 ? `A deadline runs from the order date: ${plain(bs).slice(0, 90)}` : k === 2 ? `Closes ${r.closes_date}` : "No fixed deadline recorded" }; })
    .sort((x, y) => rank(by[x.id]) - rank(by[y.id]) || (x.closes ?? "9999").localeCompare(y.closes ?? "9999") || x.name.localeCompare(y.name));
  const notes: string[] = []; for (const id of list) if (WITHIN[id]) notes.push(WITHIN[id]); if (list.length > 1) notes.push(GENERAL); if (unknownPairs) notes.push(`${unknownPairs} pair${unknownPairs === 1 ? "" : "s"} of these programmes ${unknownPairs === 1 ? "has" : "have"} no recorded combining rule. Check each programme's conditions before combining them.`);
  return { conflicts, unknownPairs, order, notes };
}
