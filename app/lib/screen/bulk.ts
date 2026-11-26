// Screen a list of companies at once: CSV in, ranked table and heat map out. Runs in the browser with the same matcher.
import { sectorsIn } from "../assistant/profileFromText";
import { norm } from "../assistant/text";
import { safeCell } from "../notes/crm";
import { sizeBand } from "../notes/numbers";
import { match } from "../matcher";
import type { Profile, Scheme } from "../types";

export const MAX_ROWS = 300, MAX_BYTES = 1_000_000;
export function parseCsv(input: string): string[][] {
  const t = input.replace(/^\uFEFF/, ""), first = t.split(/\r?\n/, 1)[0] ?? ""; const delim = [",", ";", "\t"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = []; let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"' && cur === "") q = true; else if (c === delim) { row.push(cur); cur = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; } else cur += c; }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row); return rows;
}
const HEAD: Record<string, string[]> = { name: ["company", "company name", "name", "naam", "bedrijf", "bedrijfsnaam", "firma", "unternehmen"], country: ["country", "land", "nation"], region: ["region", "state", "province", "provincie", "bundesland"], size: ["size", "company size", "size band"],
  employees: ["employees", "headcount", "fte", "staff", "mitarbeiter", "medewerkers", "number of employees"], sector: ["sector", "industry", "branche", "sectors"], description: ["description", "activities", "what they do", "about", "notes", "summary", "project", "omschrijving"], website: ["website", "url", "site"] };
const key = (h: string) => { const n = h.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim(); return Object.entries(HEAD).find(([, v]) => v.includes(n))?.[0]; };
const COUNTRY: [RegExp, Profile["country"]][] = [[/^(nl|nld|netherlands|the netherlands|holland|dutch|nederland)$/i, "NL"], [/^(de|deu|germany|deutschland|german)$/i, "DE"], [/^(eu|european union|europe)$/i, "EU"]];
export interface Entry { row: number; profile: Profile & { name: string }; notes: string[]; }
export interface Skipped { row: number; name: string; reason: string; }
export interface Parsed { entries: Entry[]; skipped: Skipped[]; columns: Record<string, string>; unmapped: string[]; truncated: boolean; }
export function toProfiles(table: string[][]): Parsed {
  const out: Parsed = { entries: [], skipped: [], columns: {}, unmapped: [], truncated: false }; if (table.length < 2) return out;
  const idx: Record<string, number> = {}; table[0].forEach((h, i) => { const k = key(h); if (k && !(k in idx)) { idx[k] = i; out.columns[k] = h.trim(); } else if (!k && h.trim()) out.unmapped.push(h.trim()); });
  const body = table.slice(1); if (body.length > MAX_ROWS) { out.truncated = true; body.length = MAX_ROWS; }
  body.forEach((cells, n) => { const g = (k: string) => (k in idx ? (cells[idx[k]] ?? "").trim() : ""), row = n + 2, name = g("name") || `Row ${row}`, notes: string[] = [];
    const cc = g("country"); if (!cc) { out.skipped.push({ row, name, reason: "No country, which the matching needs" }); return; }
    const country = COUNTRY.find(([re]) => re.test(cc))?.[1] ?? "OTHER"; if (country === "OTHER") notes.push("Outside NL, DE and the EU as a group: only EU-wide programmes can match");
    let size: Profile["size"] = "unknown"; const sz = g("size").toLowerCase(), emp = Number(g("employees").replace(/[^\d.]/g, ""));
    if (/micro|small|medium|large/.test(sz)) size = sz.match(/micro|small|medium|large/)![0] as Profile["size"]; else if (/enterprise|corporate/.test(sz)) size = "large"; else if (emp > 0) size = sizeBand(emp); else notes.push("Size unknown");
    const desc = g("description"); let sectors = sectorsIn(norm(g("sector"))); if (!sectors.length) sectors = sectorsIn(norm(desc)); if (!sectors.length) notes.push("No sector recognised");
    out.entries.push({ row, notes, profile: { name, country, region: g("region"), size, sectors: sectors.slice(0, 3), description: desc, activities: desc, signals: [] } }); });
  return out;
}
export interface Row { row: number; name: string; country: string; size: string; matches: number; best: number; top: { id: string; name: string; score: number; fit: string }[]; scores: Record<string, number>; names: Record<string, string>; notes: string[]; }
export function screenAll(entries: Entry[], schemes: Scheme[]): Row[] {
  return entries.map((e) => { const r = match(e.profile, schemes), m = r.matches; return { row: e.row, name: e.profile.name, country: e.profile.country, size: e.profile.size ?? "unknown", matches: m.length, best: m[0]?.score ?? 0,
    top: m.slice(0, 3).map((x) => ({ id: x.scheme_id, name: x.name, score: x.score, fit: x.fit ?? "low" })), scores: Object.fromEntries(m.map((x) => [x.scheme_id, x.score])), names: Object.fromEntries(m.map((x) => [x.scheme_id, x.name])), notes: e.notes }; });
}
export interface Heat { programmes: { id: string; name: string; count: number }[]; cells: number[][]; }
/** The programmes that match most of the list, against each company, with the score in each cell (0 = no match). */
export function heatmap(rows: Row[], topN = 10): Heat {
  const count = new Map<string, number>(), names = new Map<string, string>(); for (const r of rows) for (const id of Object.keys(r.scores)) { count.set(id, (count.get(id) ?? 0) + 1); names.set(id, r.names[id]); }
  const programmes = [...count].sort((a, b) => b[1] - a[1] || String(names.get(a[0])).localeCompare(String(names.get(b[0])))).slice(0, topN).map(([id, c]) => ({ id, name: names.get(id)!, count: c }));
  return { programmes, cells: rows.map((r) => programmes.map((p) => r.scores[p.id] ?? 0)) };
}
const cell = (v: string | number) => { const s = safeCell(String(v)); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function rowsToCsv(rows: Row[]): string {
  const head = ["row", "company", "country", "size", "matches", "best_score", "top1", "top1_score", "top2", "top2_score", "top3", "top3_score", "notes"];
  return [head, ...rows.map((r) => [r.row, r.name, r.country, r.size, r.matches, r.best, ...[0, 1, 2].flatMap((i) => [r.top[i]?.name ?? "", r.top[i]?.score ?? ""]), r.notes.join("; ")])].map((l) => l.map(cell).join(",")).join("\n") + "\n";
}
export const TEMPLATE = "company,country,region,employees,sector,description\nExample BV,NL,Gelderland,40,Industry & manufacturing,Manufacturer replacing gas heating with heat pumps\nBeispiel GmbH,DE,NRW,120,Digital,Software company with its own R&D team\n";
