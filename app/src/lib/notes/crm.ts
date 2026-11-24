import type { NoteResult } from "./types";

export const CRM_VERSION = "1";
export interface CrmField { key: string; label: string; value: string; evidence: string | null; confidence: "stated" | "inferred" | "unknown"; }
const COUNTRY: Record<string, string> = { NL: "Netherlands", DE: "Germany", EU: "EU (other member state)", OTHER: "Outside the EU" };
/** The standard record, the same fields every time. An empty value means the call did not say. */
export function toCrm(n: NoteResult, meta: { title: string; date: string }): CrmField[] {
  const f = (key: string, label: string, v: string | undefined, ev: string | null | undefined, how: "stated" | "inferred" = "stated"): CrmField => ({ key, label, value: v ?? "", evidence: v ? ev ?? null : null, confidence: v ? how : "unknown" });
  const F = n.facts; const step = n.nextSteps[0]; const progs = n.programmes.filter((p) => p.quote);
  return [
    f("company_name", "Company name", F.company?.value, F.company?.quote), f("website", "Website", F.website?.value, F.website?.quote),
    f("country", "Country", F.country ? COUNTRY[F.country.value] ?? F.country.value : undefined, F.country?.quote), f("region", "Region", F.region?.value, F.region?.quote),
    f("size_band", "Size band", F.size?.value, F.size?.quote, "inferred"), f("employees", "Employees", n.nums.employees !== undefined ? String(n.nums.employees) : undefined, F.size?.quote),
    f("sector", "Sector", F.sector?.value, F.sector?.quote, "inferred"), f("activity", "What the company does", F.activity?.value, F.activity?.quote),
    f("project_description", "Project", F.project?.value, F.project?.quote), f("planned_investment_eur", "Planned investment (EUR)", n.nums.amountEur !== undefined ? String(n.nums.amountEur) : undefined, F.amount?.quote),
    f("investment_timing", "Timing", F.timing?.value, F.timing?.quote), f("ordered_or_started", "Ordered or started", n.ordered === "unknown" ? undefined : n.ordered === "yes" ? "Yes" : "No", F.ordered?.quote),
    f("previous_funding", "Previous grants or subsidies", F.previous?.value, F.previous?.quote), f("decision_maker", "Decision-maker", F.decision?.value, F.decision?.quote),
    f("programmes_of_interest", "Programmes mentioned", progs.length ? progs.map((p) => p.label).join("; ") : undefined, progs[0]?.quote),
    f("next_step", "Next step", step?.what, step?.quote), f("next_step_date", "Next step date", step?.when, step?.quote),
    f("call_title", "Call title", meta.title || undefined, null), f("call_date", "Call date", meta.date, null), f("notes_summary", "Summary", n.summary, null, "inferred"),
  ];
}
/** A spreadsheet treats a cell starting with = + - @ as a formula, and a call can say anything, so those get a leading apostrophe. */
export const safeCell = (v: string) => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);
const csvCell = (v: string) => { const s = safeCell(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const crmToCsv = (fields: CrmField[]) => ["crm_version", ...fields.map((x) => x.key)].map(csvCell).join(",") + "\n" + [CRM_VERSION, ...fields.map((x) => x.value)].map(csvCell).join(",") + "\n";
export const crmToJson = (fields: CrmField[]) => JSON.stringify({ crm_version: CRM_VERSION, record: Object.fromEntries(fields.map((x) => [x.key, x.value || null])), evidence: Object.fromEntries(fields.filter((x) => x.evidence).map((x) => [x.key, x.evidence])), confidence: Object.fromEntries(fields.map((x) => [x.key, x.confidence])) }, null, 2);
export const crmToMarkdown = (fields: CrmField[]) => "| Field | Value | Evidence |\n|---|---|---|\n" + fields.map((x) => `| ${x.label} | ${(x.value || "Not mentioned").replace(/\|/g, "\\|").replace(/\n/g, " ")} | ${x.evidence ? "“" + x.evidence.replace(/\|/g, "\\|") + "”" : ""} |`).join("\n");
