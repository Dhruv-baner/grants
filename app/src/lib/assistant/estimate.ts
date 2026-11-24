// Reads the numbers in a question ("2,000 hours", "a 10 kW heat pump", "1 million euros", "over 7 years") into a calculator, so a question like
// "how much would WBSO save with 2,000 hours?" is answered by the same calculators as the Screen page, not by a model.
import { findAmounts, NUMBER_WORDS, wordsToNumber } from "../notes/numbers";
import { CALCS, defaults, type Calc, type CalcOut, type Val } from "../screen/calculators";
import { NO_PROJECT } from "../screen/types";
import type { Profile } from "../types";
import type { CompanyCtx } from "./company";

const W = NUMBER_WORDS.join("|");
const NUM = String.raw`(\d[\d,.]*(?:\s?(?:k|thousand|million))?|(?:(?:${W})[\s-]+(?:and\s+)?)*(?:${W}))`;
const grab = (text: string, unit: string) => { const m = new RegExp(String.raw`${NUM}\s*(?:${unit})\b`, "i").exec(text); return m ? wordsToNumber(m[1].trim()) : null; };
export const EXAMPLES: Record<string, string> = {
  WBSO: "How much would WBSO save with 2,000 hours of R&D work?", FZULG: "How much would the research allowance give on 1 million euros of R&D costs for an SME?", EIA: "How much would EIA save on a 1 million euro investment with 1 million euros of profit?",
  MIA_VAMIL: "How much would MIA give on a 500,000 euro investment?", ISDE: "How much would ISDE give for a 10 kW heat pump?", VEKI: "How much could VEKI give for a 2 million euro investment that saves 100,000 euros a year and avoids 500 tonnes of CO2?",
  INNOVATIEKREDIET: "How much Innovation Credit for 2 million euros of project costs at a medium company?", STUDI: "How much would STUDI give for a 100,000 euro study at a small company?", MKB_EBL: "What would the SME energy-saving loan cost per month for 100,000 euros over 7 years?",
  GSTIP_NRW: "How much would the Gründungsstipendium.NRW give for 3 founders for 12 months?", EIC_ACC: "How much would the EIC Accelerator grant be for 1 million euros of eligible costs?",
};
/** The values a question states for a calculator. Only inputs the calculator has are filled, and only from what the question says. */
export function extractInputs(calc: Calc, text: string): { vals: Record<string, Val>; found: string[] } {
  const has = (k: string) => calc.inputs.some((i) => i.key === k), vals: Record<string, Val> = {}, found: string[] = []; const put = (k: string, v: Val, label: string) => { if (has(k)) { vals[k] = v; found.push(label); } };
  const lc = text.toLowerCase(); const hours = grab(text, "hours?|hrs|uur|uren|stunden|heures?|horas?|ore"); if (hours) put("hours", hours, `${hours.toLocaleString("en-GB")} hours`);
  const kw = /(\d+(?:[.,]\d+)?)\s*kw\b/i.exec(text); if (kw) put("kw", Number(kw[1].replace(",", ".")), `${kw[1]} kW`);
  const yrs = grab(text, "years?|jaar|jaren|jahre|ans|anos|años|anni"); if (yrs && yrs >= 1 && yrs <= 7) put("years", String(Math.round(yrs)), `${Math.round(yrs)} years`);
  const co2 = new RegExp(String.raw`${NUM}\s*(?:tonnes?|tons?|tonnen|ton)\s*(?:of\s*)?co2`, "i").exec(text); if (co2) { const v = wordsToNumber(co2[1].trim()); if (v) put("co2", v, `${v.toLocaleString("en-GB")} tonnes CO2 a year`); }
  const people = grab(text, "founders?|people|persons|gruender|grunder|personnes|personas|persone|medewerkers|mitarbeiter"), months = grab(text, "months?|maanden|monate|mois|meses|mesi"); if (people) put("people", people, `${people} founders`); if (months) put("months", months, `${months} months`);
  const money = ["investment", "costs", "base", "amount"].find(has); let used = false;
  for (const a of findAmounts(text)) { const ctx = lc.slice(Math.max(0, a.index - 32), a.index), after = lc.slice(a.index + a.length, a.index + a.length + 22), shown = `€${Math.round(a.value).toLocaleString("en-GB")}`;
    if (has("profit") && (/\b(profit|winst|gewinn)\w*\s*(of|is|was|around|about|roughly)?\s*$/.test(ctx) || /^\s*(of\s+)?(taxable\s+)?(profit|winst|gewinn)/.test(after))) put("profit", a.value, `profit ${shown}`);
    else if (has("savings") && (/\b(sav(e|es|ing|ings)|besparing|ersparnis)\s*(of|is|around|about)?\s*$/.test(ctx) || /^\s*(a year\s+|per year\s+)?(of\s+)?(yearly\s+|annual\s+)?(savings?|besparing|ersparnis)/.test(after) || /^\s*(a|per) year/.test(after))) put("savings", a.value, `saving ${shown} a year`);
    else if (calc.id === "WBSO") { if (/other|overige|sonstige|material|equipment/.test(ctx)) put("other", a.value, `other costs ${shown}`); }
    else if (money && !used) { put(money, a.value, `${money === "amount" ? "loan" : money} ${shown}`); used = true; } }
  if (/\bstarters?\b/.test(lc)) put("starter", true, "starter");
  const size = /\b(small|klein\w*|kleine?)\b/.test(lc) ? "small" : /\b(medium|middelgroot\w*|mittel\w*)\b/.test(lc) ? "medium" : /\b(large|groot\w*|gross\w*|grosse?)\b/.test(lc) ? "large" : ""; if (size) { put("size", size, `${size} company`); if (has("sme")) put("sme", size !== "large", `${size} company`); if (has("large")) put("large", size === "large", `${size} company`); }
  if (/\bsme\b|\bmkb\b/.test(lc) && has("sme")) put("sme", true, "SME"); if (/\b2027\b/.test(lc)) put("year", "2027", "2027"); else if (/\b2026\b/.test(lc)) put("year", "2026", "2026");
  const cat = /\b(27|36|45)\s?%/.exec(lc); if (cat) put("rate", `0.${cat[1]}`, `${cat[1]}% category`); return { vals, found: [...new Set(found)] };
}
const EMPTY: Profile = { country: "NL", size: "unknown", sectors: [], signals: [], description: "" };
export interface EstimateCore { calc: Calc; out: CalcOut | { error: string }; found: string[]; used: { label: string; value: string }[]; }
export function estimateCore(id: string, text: string, company?: CompanyCtx): EstimateCore {
  const calc = CALCS[id], { vals, found } = extractInputs(calc, text), base = defaults(calc, company?.profile ?? EMPTY, company?.project ?? NO_PROJECT), merged = { ...base, ...vals };
  const show = (i: Calc["inputs"][number]) => { const v = merged[i.key]; if (i.kind === "check") return v ? "Yes" : "No"; if (i.kind === "select") return i.options?.find(([k]) => k === String(v))?.[1] ?? String(v); return Number(v) ? Number(v).toLocaleString("en-GB") : "not given"; };
  return { calc, out: calc.run(merged), found, used: calc.inputs.filter((i) => i.kind !== "number" || Number(merged[i.key])).map((i) => ({ label: i.label, value: show(i) })) };
}
