// Saved conversations live only in this browser. To stay small and never go stale, a conversation stores just the questions
// (plus any follow-up answer from Claude and the user's thumbs); the answers are rebuilt from the current data when it is opened.
import { respond, type Answer, type Ctx } from "./engine";

export interface Turn { q: string; ai?: string; fb?: "up" | "down"; }
export interface StoredChat { id: string; title: string; updated: number; turns: Turn[]; }
export interface Msg { id: number; role: "me" | "bot"; text?: string; answer?: Answer; followup?: { state: "loading" | "done" | "none"; text?: string }; fb?: "up" | "down"; fresh?: boolean; q?: string; }
export const KEY = "gf-assistant-chats-v1"; export const MAX_CHATS = 30; export const MAX_BYTES = 150_000;
export interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void; }
export function browserStore(): Store | null { try { const s = window.localStorage; const t = "__gf"; s.setItem(t, "1"); s.removeItem(t); return s; } catch { return null; } }

export function sanitize(raw: unknown): StoredChat[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredChat[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue; const o = c as Record<string, unknown>;
    if (typeof o.id !== "string" || !Array.isArray(o.turns)) continue;
    const turns: Turn[] = o.turns.filter((t): t is Record<string, unknown> => !!t && typeof t === "object" && typeof (t as Record<string, unknown>).q === "string")
      .map((t) => ({ q: String(t.q).slice(0, 600), ...(typeof t.ai === "string" ? { ai: t.ai.slice(0, 1500) } : {}), ...(t.fb === "up" || t.fb === "down" ? { fb: t.fb } : {}) }));
    if (!turns.length) continue;
    out.push({ id: o.id.slice(0, 80), title: typeof o.title === "string" ? o.title.slice(0, 80) : turns[0].q.slice(0, 60), updated: typeof o.updated === "number" ? o.updated : 0, turns });
  }
  return out.sort((a, b) => b.updated - a.updated).slice(0, MAX_CHATS);
}
export function loadChats(store: Store | null): StoredChat[] { if (!store) return []; try { const v = store.getItem(KEY); return v ? sanitize(JSON.parse(v)) : []; } catch { return []; } }
export function saveChats(chats: StoredChat[], store: Store | null): boolean {
  if (!store) return false; let list = chats.slice(0, MAX_CHATS);
  while (list.length > 1 && JSON.stringify(list).length > MAX_BYTES) list = list.slice(0, -1); // drop the oldest first
  try { store.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}
export const upsertChat = (chats: StoredChat[], chat: StoredChat) => [chat, ...chats.filter((c) => c.id !== chat.id)].slice(0, MAX_CHATS);
export const deleteChat = (chats: StoredChat[], id: string) => chats.filter((c) => c.id !== id);
export const titleOf = (turns: Turn[]) => { const q = (turns[0]?.q ?? "New chat").replace(/\s+/g, " ").trim(); return q.length > 56 ? q.slice(0, 55).trimEnd() + "…" : q; };

/** Rebuilds a conversation from its questions with the current data. */
export function replay(turns: Turn[]): { msgs: Msg[]; ctx: Ctx } {
  let ctx: Ctx = { last: [] }; const msgs: Msg[] = []; let id = 0;
  for (const t of turns) { const r = respond(t.q, ctx); ctx = r.ctx;
    msgs.push({ id: ++id, role: "me", text: t.q }, { id: ++id, role: "bot", answer: r.answer, q: t.q, ...(t.ai ? { followup: { state: "done" as const, text: t.ai } } : {}), ...(t.fb ? { fb: t.fb } : {}) }); }
  return { msgs, ctx };
}
export function turnsOf(msgs: Msg[]): Turn[] {
  const turns: Turn[] = [];
  for (let i = 0; i < msgs.length; i++) { const m = msgs[i]; if (m.role !== "me") continue; const b = msgs[i + 1];
    turns.push({ q: m.text ?? "", ...(b?.followup?.state === "done" && b.followup.text ? { ai: b.followup.text } : {}), ...(b?.fb ? { fb: b.fb } : {}) }); }
  return turns.filter((t) => t.q);
}
