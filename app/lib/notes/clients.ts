// Your saved calls as clients: what a call says about a company, with any corrections made in the Calls table, matched against every programme.
import { BY_ID, SCHEMES } from "../data";
import { type Row, type Entry, type Heat, heatmap, screenAll } from "../screen/bulk";
import type { TItem } from "../screen/timeline";
import type { Project } from "../screen/types";
import type { Profile, Scheme } from "../types";
import { buildRow } from "./calls";
import { sizeBand } from "./numbers";
import type { Store } from "../assistant/history";
import { loadNotes, type SavedNote } from "./store";

const COUNTRY: Record<string, Profile["country"]> = { Netherlands: "NL", Germany: "DE", "EU (other member state)": "EU", "Outside the EU": "OTHER" };
export interface Client { id: string; name: string; profile: Profile & { name: string }; project: Project; }
export const clientName = (sn: SavedNote, fields: Record<string, string>) => fields.company_name || (sn.title && sn.title !== "Untitled call" ? sn.title : "Untitled call");
/** A client from a saved call. Null when the call did not say where the company is, because nothing can be matched without that. */
export function clientFromNote(sn: SavedNote): Client | null {
  const f = buildRow(sn).fields, country = COUNTRY[f.country]; if (!country) return null;
  const emp = Number(f.employees), size = Number.isFinite(emp) && f.employees !== "" ? sizeBand(emp) : (["micro", "small", "medium", "large"].includes(f.size_band) ? (f.size_band as Profile["size"]) : "unknown");
  const budget = Number(f.planned_investment_eur); const description = [f.activity, f.project_description, budget > 0 ? `budget ${f.planned_investment_eur}` : "", f.investment_timing ? `timing ${f.investment_timing}` : ""].filter(Boolean).join(". ") || f.notes_summary || "";
  const name = clientName(sn, f);
  return { id: sn.id, name, profile: { name, country, region: f.region ?? "", size, sectors: (f.sector ?? "").split(";").map((s) => s.trim()).filter(Boolean), signals: [], description, activities: description }, project: { started: f.ordered_or_started === "Yes" ? "yes" : f.ordered_or_started === "No" ? "no" : "unknown", budget: budget > 0 ? budget : undefined } };
}
export function loadClients(store: Store | null): { clients: Client[]; skipped: string[] } {
  const clients: Client[] = [], skipped: string[] = [];
  for (const sn of loadNotes(store)) { const c = clientFromNote(sn); if (c) clients.push(c); else skipped.push(clientName(sn, buildRow(sn).fields)); }
  return { clients, skipped };
}
export interface Portfolio { clients: Client[]; rows: Row[]; heat: Heat; ranked: { id: string; name: string; clients: Client[] }[]; }
export function buildPortfolio(clients: Client[], schemes: Scheme[] = SCHEMES, topN = 10): Portfolio {
  const entries: Entry[] = clients.map((c, i) => ({ row: i + 1, profile: c.profile, notes: [] })), rows = screenAll(entries, schemes), by = new Map<string, { id: string; name: string; clients: Client[] }>();
  rows.forEach((r, i) => { for (const id of Object.keys(r.scores)) { const e = by.get(id) ?? { id, name: r.names[id], clients: [] }; e.clients.push(clients[i]); by.set(id, e); } });
  const ranked = [...by.values()].sort((a, b) => b.clients.length - a.clients.length || a.name.localeCompare(b.name));
  return { clients, rows, heat: heatmap(rows, topN), ranked };
}
/** The closing dates still ahead for the programmes that fit at least one client, as calendar items. */
export function deadlineItems(ranked: Portfolio["ranked"], today: string): TItem[] {
  return ranked.flatMap((p) => { const s = BY_ID[p.id]; if (!s?.closes_date || s.closes_date < today || !["open", "opening_soon"].includes(s.status_clean)) return []; return [{ id: p.id, name: p.name, date: s.closes_date, kind: "closes" as const, note: `Fits ${p.clients.length} of your clients: ${p.clients.map((c) => c.name).join(", ")}`, urgency: "soon" as const, url: s.official_url }]; }).sort((a, b) => a.date.localeCompare(b.date));
}
