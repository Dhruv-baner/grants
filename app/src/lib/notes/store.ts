// Saved notes live only in this browser. A transcript can hold client details, so there is a visible delete for each note and for all of them.
import type { Store } from "../assistant/history";
export interface SavedNote { id: string; title: string; created: number; updated: number; transcript: string; jottings: string; edits: Record<string, string>; }
export const NOTES_KEY = "gf-notes-v1"; export const MAX_NOTES = 20; export const MAX_NOTE_BYTES = 250_000;
export function sanitizeNotes(raw: unknown): SavedNote[] {
  if (!Array.isArray(raw)) return []; const out: SavedNote[] = [];
  for (const c of raw) { if (!c || typeof c !== "object") continue; const o = c as Record<string, unknown>; if (typeof o.id !== "string" || typeof o.transcript !== "string" || !o.transcript.trim()) continue;
    const edits: Record<string, string> = {}; if (o.edits && typeof o.edits === "object") for (const [k, v] of Object.entries(o.edits as Record<string, unknown>)) if (typeof v === "string" && /^[a-z_]{2,40}$/.test(k) && k !== "__proto__") edits[k] = v.slice(0, 600);
    const updated = typeof o.updated === "number" ? o.updated : 0; out.push({ id: o.id.slice(0, 80), created: typeof o.created === "number" && o.created > 0 ? o.created : updated, title: typeof o.title === "string" ? o.title.slice(0, 80) : "Untitled call", updated, transcript: o.transcript.slice(0, 40000), jottings: typeof o.jottings === "string" ? o.jottings.slice(0, 4000) : "", edits }); }
  return out.sort((a, b) => b.updated - a.updated).slice(0, MAX_NOTES);
}
export function loadNotes(store: Store | null): SavedNote[] { if (!store) return []; try { const v = store.getItem(NOTES_KEY); return v ? sanitizeNotes(JSON.parse(v)) : []; } catch { return []; } }
export function saveNotes(notes: SavedNote[], store: Store | null): boolean {
  if (!store) return false; let list = notes.slice(0, MAX_NOTES); while (list.length > 1 && JSON.stringify(list).length > MAX_NOTE_BYTES) list = list.slice(0, -1);
  try { store.setItem(NOTES_KEY, JSON.stringify(list)); return true; } catch { return false; }
}
export const upsertNote = (notes: SavedNote[], n: SavedNote) => [n, ...notes.filter((x) => x.id !== n.id)].slice(0, MAX_NOTES);
export const deleteNote = (notes: SavedNote[], id: string) => notes.filter((x) => x.id !== id);
