// Aid estimates. Every rate and cap below is taken from the recorded programme data (as of 17 Nov 2026); the notes say where a figure comes from an adviser.
// They are estimates to help a conversation, never an offer, and never a statement that a company qualifies.
import { formatEur as eur } from "../notes/numbers";
import type { Profile } from "../types";
import type { Project } from "./types";

export type Val = number | string | boolean;
export interface CalcInput { key: string; label: string; kind: "number" | "select" | "check"; def: Val; options?: [string, string][]; hint?: string; }
export interface CalcLine { label: string; value: string; }
export interface CalcOut { kind: "tax" | "grant" | "loan"; headline: string; low: number; high: number; unit: "total" | "per month"; lines: CalcLine[]; notes: string[]; warnings: string[]; }
export interface Calc { id: string; title: string; kind: "tax" | "grant" | "loan"; inputs: CalcInput[]; run(v: Record<string, Val>): CalcOut | { error: string }; }
const num = (v: Val | undefined) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
/** Dutch corporate tax as recorded: 19% up to EUR 200,000 of profit, 25.8% above. */
export const corpTax = (profit: number) => 0.19 * Math.min(profit, 200_000) + 0.258 * Math.max(profit - 200_000, 0);
function taxEffect(deduction: number, profit: number): { low: number; high: number; line: CalcLine } {
  if (profit > 0) { const s = corpTax(profit) - corpTax(Math.max(profit - deduction, 0)); return { low: s, high: s, line: { label: `Corporate tax saved at a profit of ${eur(profit)}`, value: eur(s) } }; }
  return { low: deduction * 0.19, high: deduction * 0.258, line: { label: "Corporate tax saved (19% to 25.8%, depending on your profit)", value: `${eur(deduction * 0.19)} to ${eur(deduction * 0.258)}` } };
}
const range = (lo: number, hi: number) => (Math.round(lo) === Math.round(hi) ? eur(hi) : `${eur(lo)} to ${eur(hi)}`);
const SIZE_OPT: [string, string][] = [["small", "Small"], ["medium", "Medium"], ["large", "Large"]];
const profitIn: CalcInput = { key: "profit", label: "Taxable profit before the deduction (EUR), optional", kind: "number", def: 0, hint: "Leave 0 if unknown and you get a range" };

export const CALCS: Record<string, Calc> = {
  WBSO: { id: "WBSO", title: "WBSO payroll-tax reduction", kind: "tax", inputs: [
    { key: "hours", label: "Hours of R&D (S&O) work in the year", kind: "number", def: 0 }, { key: "mode", label: "Hourly cost", kind: "select", def: "flat", options: [["flat", "Flat rate, EUR 29 per hour (2026)"], ["actual", "Actual hourly cost"]] },
    { key: "wage", label: "Actual hourly cost (EUR), if chosen", kind: "number", def: 0 }, { key: "other", label: "Other R&D costs and expenditure (EUR)", kind: "number", def: 0 }, { key: "starter", label: "Starter", kind: "check", def: false, hint: "50% on the first bracket" }],
    run: (v) => { const rate = v.mode === "actual" ? num(v.wage) : 29, base = num(v.hours) * rate + num(v.other); if (base <= 0) return { error: "Enter the R&D hours (and the hourly cost), or other R&D costs." };
      const r1 = v.starter ? 0.5 : 0.36, b1 = Math.min(base, 391_020), b2 = Math.max(base - 391_020, 0), benefit = r1 * b1 + 0.16 * b2;
      return { kind: "tax", unit: "total", low: benefit, high: benefit, headline: `About ${eur(benefit)} less payroll tax`, lines: [{ label: "R&D base", value: eur(base) }, { label: `First ${eur(391_020)} at ${Math.round(r1 * 100)}%`, value: eur(r1 * b1) }, ...(b2 ? [{ label: "Above that at 16%", value: eur(0.16 * b2) }] : []), { label: "Reduction", value: eur(benefit) }],
        notes: ["Reduces the wage tax and social contributions you pay. The benefit is limited by the wage tax you owe (as recorded).", "Rates as recorded for 2026 and unchanged for 2027. The flat hourly rate rises to EUR 33 in 2027 (adviser source)."], warnings: [] }; } },
  FZULG: { id: "FZULG", title: "Forschungszulage (German research allowance)", kind: "tax", inputs: [{ key: "base", label: "Eligible R&D costs in the year (EUR)", kind: "number", def: 0 }, { key: "sme", label: "Small or medium company", kind: "check", def: true, hint: "35% instead of 25%" }],
    run: (v) => { const base = num(v.base); if (!base) return { error: "Enter the eligible R&D costs." }; const rate = v.sme ? 0.35 : 0.25, counted = Math.min(base, 12_000_000), a = rate * counted;
      return { kind: "tax", unit: "total", low: a, high: a, headline: `About ${eur(a)} allowance`, lines: [{ label: "Costs counted (cap EUR 12M a year)", value: eur(counted) }, { label: `Rate for ${v.sme ? "an SME" : "other companies"}`, value: `${rate * 100}%` }, { label: "Allowance", value: eur(a) }],
        notes: ["The cap on the base is EUR 12M a year from 1 Jan 2026; the maximum allowance is EUR 3.0M, or EUR 4.2M for SMEs (as recorded).", "What counts as eligible cost is defined by the programme: check it before relying on the base."], warnings: base > 12_000_000 ? ["Costs above EUR 12M are not counted."] : [] }; } },
  EIA: { id: "EIA", title: "EIA energy-investment deduction", kind: "tax", inputs: [{ key: "investment", label: "Qualifying investment (EUR)", kind: "number", def: 0 }, { key: "year", label: "Order year", kind: "select", def: "2026", options: [["2026", "2026: 40%"], ["2027", "2027: 45.5% (proposed)"]] }, profitIn],
    run: (v) => { const inv = num(v.investment); if (!inv) return { error: "Enter the investment." }; const rate = v.year === "2027" ? 0.455 : 0.4, q = Math.min(inv, 151_000_000), ded = rate * q, t = taxEffect(ded, num(v.profit));
      const warnings = [...(inv < 2500 ? ["Below EUR 2,500 per asset, which is the minimum (adviser source)."] : []), ...(v.year === "2027" ? ["45.5% is proposed in the 2027 tax plan and not yet approved."] : [])];
      return { kind: "tax", unit: "total", low: t.low, high: t.high, headline: `Tax saving of about ${range(t.low, t.high)}`, lines: [{ label: "Qualifying investment (cap EUR 151M)", value: eur(q) }, { label: `Deduction at ${rate * 100}%`, value: eur(ded) }, t.line],
        notes: ["A deduction from taxable profit, so the saving depends on your profit.", "Costs that get ISDE or SDE++ support cannot also get EIA, and costs that get EIA cannot also get MIA."], warnings }; } },
  MIA_VAMIL: { id: "MIA_VAMIL", title: "MIA/Vamil environmental deduction", kind: "tax", inputs: [{ key: "investment", label: "Qualifying investment (EUR)", kind: "number", def: 0 }, { key: "rate", label: "Category on the Milieulijst", kind: "select", def: "0.27", options: [["0.27", "27%"], ["0.36", "36%"], ["0.45", "45%"]] }, profitIn],
    run: (v) => { const inv = num(v.investment); if (!inv) return { error: "Enter the investment." }; const rate = Number(v.rate), q = Math.min(inv, 25_000_000), ded = rate * q, t = taxEffect(ded, num(v.profit));
      return { kind: "tax", unit: "total", low: t.low, high: t.high, headline: `MIA tax saving of about ${range(t.low, t.high)}`, lines: [{ label: "Qualifying investment (cap EUR 25M)", value: eur(q) }, { label: `MIA deduction at ${Math.round(rate * 100)}%`, value: eur(ded) }, t.line],
        notes: ["Vamil adds up to 75% arbitrary depreciation: a timing benefit, not included here.", "Costs that already get EIA cannot also get MIA; Vamil can still be added (RVO)."], warnings: inv < 2500 ? ["Below EUR 2,500 per application, which is the minimum (RVO)."] : [] }; } },
  ISDE: { id: "ISDE", title: "ISDE air-to-water heat pump", kind: "grant", inputs: [{ key: "kw", label: "Heat pump capacity (kW)", kind: "number", def: 0 }, { key: "year", label: "Year of application", kind: "select", def: "2026", options: [["2026", "2026: EUR 225 per kW"], ["2027", "2027: EUR 120 per kW"]] }],
    run: (v) => { const kw = num(v.kw); if (!kw) return { error: "Enter the capacity in kW." }; const per = v.year === "2027" ? 120 : 225, a = kw * per;
      return { kind: "grant", unit: "total", low: a, high: a, headline: `About ${eur(a)} grant`, lines: [{ label: "Capacity", value: `${kw} kW` }, { label: "Amount per kW", value: eur(per) }, { label: "Grant", value: eur(a) }],
        notes: ["For the first unit. Other heat pump types, solar boilers and small wind use other amounts. The application date fixes the amount."], warnings: kw > 70 ? ["Above 70 kW the amount is assessed individually (supplier page), so this figure may not apply."] : [] }; } },
  VEKI: { id: "VEKI", title: "VEKI industrial CO2 subsidy (upper limit)", kind: "grant", inputs: [{ key: "investment", label: "Investment (EUR)", kind: "number", def: 0 }, { key: "savings", label: "Yearly net saving or income from it (EUR)", kind: "number", def: 0 }, { key: "co2", label: "CO2 avoided per year (tonnes)", kind: "number", def: 0 }, { key: "large", label: "Large company", kind: "check", def: false, hint: "Minimum subsidy EUR 125,000 instead of 30,000" }],
    run: (v) => { const inv = num(v.investment), co2 = num(v.co2); if (!inv || !co2) return { error: "Enter the investment and the CO2 avoided per year." }; const unprofitable = Math.max(0, inv - 5 * num(v.savings)), perCo2 = 80 * 15 * co2, a = Math.min(unprofitable, perCo2, 30_000_000), min = v.large ? 125_000 : 30_000;
      return { kind: "grant", unit: "total", low: 0, high: a, headline: `At most about ${eur(a)}`, lines: [{ label: "Part that does not pay back within 5 years", value: eur(unprofitable) }, { label: "EUR 80 per tonne over 15 years", value: eur(perCo2) }, { label: "Lower of the two (cap EUR 30M)", value: eur(a) }],
        notes: ["An upper limit, not a forecast: applications are also ranked by subsidy per tonne of CO2 avoided (as recorded)."], warnings: a < min ? [`Below the minimum subsidy of ${eur(min)}, so this would not qualify.`] : [] }; } },
  INNOVATIEKREDIET: { id: "INNOVATIEKREDIET", title: "Innovation Credit", kind: "loan", inputs: [{ key: "costs", label: "Total project costs (EUR)", kind: "number", def: 0 }, { key: "size", label: "Company size", kind: "select", def: "medium", options: SIZE_OPT }],
    run: (v) => { const costs = num(v.costs); if (!costs) return { error: "Enter the total project costs." }; const rate = v.size === "small" ? 0.45 : v.size === "large" ? 0.25 : 0.35, credit = Math.min(rate * costs, 10_000_000);
      return { kind: "loan", unit: "total", low: 0, high: credit, headline: `A credit of up to ${eur(credit)}`, lines: [{ label: `Up to ${Math.round(rate * 100)}% of project costs (cap EUR 10M, technical)`, value: eur(credit) }, { label: "One-off surcharge if it succeeds (technical, 15%)", value: eur(0.15 * credit) }],
        notes: ["A loan, not a grant. If the project succeeds you repay the principal, 3.0% compound interest and a one-off surcharge, with first pledge security (RVO). Higher percentages with collaboration (adviser)."], warnings: credit < 250_000 ? ["Below the minimum financing need of EUR 250,000 (adviser source)."] : [] }; } },
  STUDI: { id: "STUDI", title: "STUDI study subsidy", kind: "grant", inputs: [{ key: "costs", label: "Eligible study costs (EUR)", kind: "number", def: 0 }, { key: "size", label: "Company size", kind: "select", def: "medium", options: SIZE_OPT }],
    run: (v) => { const costs = num(v.costs); if (!costs) return { error: "Enter the eligible study costs." }; const rate = v.size === "small" ? 0.7 : v.size === "large" ? 0.5 : 0.6, a = Math.min(rate * costs, 4_000_000);
      return { kind: "grant", unit: "total", low: a, high: a, headline: `Up to ${eur(a)}`, lines: [{ label: `${Math.round(rate * 100)}% of eligible study costs (cap EUR 4M per study)`, value: eur(a) }], notes: ["EUR 4M per feasibility or environmental study, EUR 3M for gasification. A comparable study is limited by the de minimis room left (EUR 300,000 over 3 years)."], warnings: [] }; } },
  MKB_EBL: { id: "MKB_EBL", title: "SME energy loan repayment", kind: "loan", inputs: [{ key: "amount", label: "Loan amount (EUR)", kind: "number", def: 0 }, { key: "years", label: "Term", kind: "select", def: "7", options: [1, 2, 3, 4, 5, 6, 7].map((y) => [String(y), `${y} year${y > 1 ? "s" : ""}`] as [string, string]) }],
    run: (v) => { const p = num(v.amount); if (!p) return { error: "Enter the loan amount." }; const r = 0.069 / 12, n = Number(v.years) * 12, pay = (p * r) / (1 - Math.pow(1 + r, -n)), total = pay * n;
      return { kind: "loan", unit: "per month", low: pay, high: pay, headline: `About ${eur(pay)} a month`, lines: [{ label: "Monthly instalment", value: eur(pay) }, { label: "Total repaid", value: eur(total) }, { label: "Total interest", value: eur(total - p) }],
        notes: ["Fixed 6.9% a year for the whole term, up to 7 years, repayable early without penalty (aggregator source). Shown as equal monthly instalments; the lender's schedule may differ.", "No collateral, but owners of a BV holding 50% or more give a personal guarantee (as recorded)."], warnings: p < 10_000 || p > 250_000 ? ["The loan is EUR 10,000 to EUR 250,000 per location."] : [] }; } },
  GSTIP_NRW: { id: "GSTIP_NRW", title: "Gründungsstipendium.NRW", kind: "grant", inputs: [{ key: "people", label: "Founders in the team (up to 3)", kind: "number", def: 1 }, { key: "months", label: "Months (up to 12)", kind: "number", def: 12 }],
    run: (v) => { const people = Math.min(3, Math.round(num(v.people))), months = Math.min(12, Math.round(num(v.months))); if (!people || !months) return { error: "Enter the number of founders and months." }; const a = 1200 * people * months;
      return { kind: "grant", unit: "total", low: a, high: a, headline: `${eur(a)} in total`, lines: [{ label: `${people} founder${people > 1 ? "s" : ""} × ${months} months × ${eur(1200)}`, value: eur(a) }], notes: ["Up to EUR 14,400 per person for the regular term. Three extra months at the birth of a child. The diversity module is described differently by two sources, so it is not included."], warnings: num(v.people) > 3 || num(v.months) > 12 ? ["Capped at 3 founders and 12 months."] : [] }; } },
  EIC_ACC: { id: "EIC_ACC", title: "EIC Accelerator grant", kind: "grant", inputs: [{ key: "costs", label: "Eligible innovation costs (EUR)", kind: "number", def: 0 }],
    run: (v) => { const c = num(v.costs); if (!c) return { error: "Enter the eligible innovation costs." }; const a = Math.min(0.7 * c, 2_500_000);
      return { kind: "grant", unit: "total", low: a, high: a, headline: `Grant of up to ${eur(a)}`, lines: [{ label: "70% of eligible costs (cap EUR 2.5M), lump sum", value: eur(a) }], notes: ["For innovation activities at TRL 6 to 8. The investment component (EUR 1M to EUR 10M, as equity or a convertible loan) is separate and not included."], warnings: [] }; } },
};
export const hasCalc = (id: string) => id in CALCS;
const sizeSel = (p: Profile) => (p.size === "large" ? "large" : p.size === "medium" || !p.size || p.size === "unknown" ? "medium" : "small");
/** Starting values for a calculator, from what is already known about the company and the project. */
export function defaults(c: Calc, p: Profile, project: Project): Record<string, Val> {
  const o: Record<string, Val> = {}; for (const i of c.inputs) o[i.key] = i.def;
  for (const k of ["investment", "costs", "amount", "base"]) if (k in o && project.budget) o[k] = project.budget;
  if ("size" in o) o.size = sizeSel(p); if ("sme" in o) o.sme = p.size !== "large"; if ("large" in o) o.large = p.size === "large";
  if ("amount" in o && project.budget) o.amount = Math.min(250_000, Math.max(10_000, project.budget)); return o;
}
export interface Totals { tax: { low: number; high: number }; grant: { low: number; high: number }; loan: number; }
/** Adds up the estimates by kind. Loans are shown apart: they are not aid. Monthly figures are not added. */
export function totals(results: CalcOut[]): Totals {
  const t: Totals = { tax: { low: 0, high: 0 }, grant: { low: 0, high: 0 }, loan: 0 };
  for (const r of results) { if (r.unit !== "total") continue; if (r.kind === "loan") t.loan += r.high; else { t[r.kind].low += r.low; t[r.kind].high += r.high; } } return t;
}
