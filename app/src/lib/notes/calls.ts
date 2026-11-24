// The Calls table: one row per saved call, built from the same extraction and the same edits as the notes, so the two can never disagree.
import { safeCell, toCrm, CRM_VERSION } from "./crm";
import { extractNotes } from "./extract";
import { FIXTURES } from "./fixtures";
import type { SavedNote } from "./store";

export interface Col { key: string; label: string; kind: "text" | "date" | "number" | "select" | "long" | "readonly"; }
/** The columns shown by default, in order. */
export const MAIN: Col[] = [{ key: "call_date", label: "Date", kind: "date" }, { key: "company_name", label: "Company", kind: "text" }, { key: "sector", label: "Sector", kind: "text" }, { key: "country", label: "Country", kind: "select" }, { key: "region", label: "Region", kind: "text" }, { key: "size_band", label: "Size", kind: "select" },
  { key: "project_description", label: "Project", kind: "text" }, { key: "planned_investment_eur", label: "Budget (EUR)", kind: "number" }, { key: "ordered_or_started", label: "Status", kind: "select" }, { key: "notes_summary", label: "Note summary", kind: "long" }];
/** Other fields of the standard record, available under "Columns". */
export const EXTRA: Col[] = [{ key: "employees", label: "Employees", kind: "number" }, { key: "activity", label: "What they do", kind: "text" }, { key: "investment_timing", label: "Timing", kind: "text" }, { key: "previous_funding", label: "Previous funding", kind: "text" }, { key: "decision_maker", label: "Decision-maker", kind: "text" },
  { key: "programmes_of_interest", label: "Programmes mentioned", kind: "text" }, { key: "next_step", label: "Next step", kind: "text" }, { key: "next_step_date", label: "Next step date", kind: "text" }, { key: "website", label: "Website", kind: "text" }, { key: "call_title", label: "Call title", kind: "readonly" }];
export const CRM_KEYS: string[] = toCrm(extractNotes(""), { title: "", date: "" }).map((f) => f.key);
export const COUNTRIES = ["Netherlands", "Germany", "EU (other member state)", "Outside the EU"]; export const SIZES = ["micro", "small", "medium", "large"];
export const STATUS_OPTIONS: [string, string][] = [["", "Not mentioned"], ["No", "Nothing ordered yet"], ["Yes", "Already ordered or started"]];
export const statusLabel = (v: string) => STATUS_OPTIONS.find(([k]) => k === v)?.[1] ?? v;
export const fmtDay = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export interface CallRow { id: string; created: number; fields: Record<string, string>; edited: Set<string>; }
export function buildRow(n: SavedNote): CallRow {
  const base = toCrm(extractNotes(n.transcript), { title: n.title === "Untitled call" ? "" : n.title, date: fmtDay(n.created) }); const fields: Record<string, string> = {}; const edited = new Set<string>();
  for (const f of base) { const v = n.edits[f.key]; fields[f.key] = v !== undefined ? v : f.value; if (v !== undefined && v !== f.value) edited.add(f.key); }
  return { id: n.id, created: n.created, fields, edited };
}
export interface CallStats { total: number; notOrdered: number; ordered: number; notMentioned: number; budget: number; withBudget: number; }
export function callStats(rows: CallRow[]): CallStats {
  const b = rows.map((r) => Number(r.fields.planned_investment_eur)).filter((n) => Number.isFinite(n) && n > 0);
  return { total: rows.length, notOrdered: rows.filter((r) => r.fields.ordered_or_started === "No").length, ordered: rows.filter((r) => r.fields.ordered_or_started === "Yes").length, notMentioned: rows.filter((r) => !r.fields.ordered_or_started).length, budget: b.reduce((a, n) => a + n, 0), withBudget: b.length };
}
export interface Filter { q: string; sector: string; country: string; status: string; }
const sectorsOf = (r: CallRow) => (r.fields.sector ?? "").split(";").map((s) => s.trim()).filter(Boolean);
export function sectorOptions(rows: CallRow[]): string[] { return [...new Set(rows.flatMap(sectorsOf))].sort(); }
export function filterRows(rows: CallRow[], f: Filter): CallRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => (!f.sector || sectorsOf(r).includes(f.sector)) && (!f.country || r.fields.country === f.country) && (!f.status || (r.fields.ordered_or_started ?? "") === (f.status === "none" ? "" : f.status))
    && (!q || [fmtDay(r.created), ...Object.values(r.fields), statusLabel(r.fields.ordered_or_started ?? "")].join(" ").toLowerCase().includes(q)));
}
export function sortRows(rows: CallRow[], key: string, dir: 1 | -1): CallRow[] {
  const val = (r: CallRow) => (key === "call_date" ? r.created : key === "planned_investment_eur" || key === "employees" ? (r.fields[key] ? Number(r.fields[key]) : null) : (r.fields[key] ?? "").toLowerCase());
  return [...rows].sort((a, b) => { const x = val(a), y = val(b); if (x === null || x === "") return y === null || y === "" ? 0 : 1; if (y === null || y === "") return -1; return (x < y ? -1 : x > y ? 1 : 0) * dir; });
}
const csv = (v: string) => { const s = safeCell(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** Every call as one row of the standard record (all 20 fields, whatever columns are showing), ready for a CRM import. */
export const callsToCsv = (rows: CallRow[]) => [["crm_version", "call_id", ...CRM_KEYS], ...rows.map((r) => [CRM_VERSION, r.id, ...CRM_KEYS.map((k) => r.fields[k] ?? "")])].map((l) => l.map(csv).join(",")).join("\n") + "\n";
export const callsToJson = (rows: CallRow[]) => JSON.stringify({ crm_version: CRM_VERSION, calls: rows.map((r) => ({ call_id: r.id, record: Object.fromEntries(CRM_KEYS.map((k) => [k, r.fields[k] || null])) })) }, null, 2);
/** Tab-separated, so it pastes straight into a spreadsheet. Only the columns on screen. */
export function callsToTsv(rows: CallRow[], cols: Col[]): string {
  const cell = (r: CallRow, c: Col) => (c.key === "call_date" ? fmtDay(r.created) : c.key === "ordered_or_started" ? statusLabel(r.fields[c.key] ?? "") : r.fields[c.key] ?? "");
  return [cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => cell(r, c)))].map((l) => l.map((v) => safeCell(v).replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n") + "\n";
}
/** Fictional calls for trying the table. Fixed ids, so adding them twice does not duplicate. */
export function sampleCalls(now = Date.now()): SavedNote[] {
  const pick: [string, string][] = [["brandt", "Sample: steel fabricator in Saxony (fictional)"], ["mueller", "Sample: machine builder near Stuttgart (fictional)"], ["founder", "Sample: logistics software founder (fictional)"], ["demo", "Sample: heat pump project (fictional)"]];
  return pick.map(([id, title], i) => { const f = FIXTURES.find((x) => x.id === id)!; const t = now - (i + 1) * 86_400_000; return { id: `sample-${id}`, title, created: t, updated: t, transcript: f.text, jottings: "", edits: {} }; });
}
