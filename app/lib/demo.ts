// The guided demo: the story from a call to a client brief, in seven steps. The steps only navigate and seed the same sample data
// the tools already offer, so the demo shows the real tools working, not a recording of them.
import type { Store } from "./assistant/history";
import { sampleCalls } from "./notes/calls";
import { loadNotes, saveNotes, upsertNote } from "./notes/store";

export const DEMO_KEY = "gf-demo";
export interface DemoState { step: number; seeded: boolean; }
export interface Step { title: string; text: string; path: string; }
export const STEPS: Step[] = [
  { title: "A call comes in", text: "As the call is said, the checklist ticks off what the company has told you, and only what they said. Nothing is guessed.", path: "/notes" },
  { title: "Notes and the follow-up email", text: "Notes with the exact words behind every point, and a follow-up email drafted from the verified facts.", path: "/notes" },
  { title: "Screen the company", text: "The same company against 127 sourced programmes. Each match shows what is clear and what still needs confirming, with no score.", path: "/screen" },
  { title: "What it could be worth", text: "Calculators from the recorded rates, and which programmes cannot be combined, each with its source.", path: "/screen" },
  { title: "A brief for the client", text: "A client-ready summary to print or save as a PDF.", path: "/screen" },
  { title: "Ask the grantbot", text: "The chat knows the company and answers from sourced data, and says so when it does not know. Try: How much would EIA save us?", path: "/assistant" },
  { title: "Across all your clients", text: "Every saved call screened at once: which programmes fit most of your clients, and who to call about each.", path: "/notes/portfolio" },
];
export const SAMPLE_PREFIX = "sample-";
/** Makes sure there are enough calls for the portfolio step. Returns true when it added any. */
export function seedSamples(store: Store | null, want = 4): boolean {
  const have = loadNotes(store); if (!store || have.length >= want) return false; let next = have, added = false;
  for (const n of sampleCalls().filter((x) => x.id !== "sample-demo")) { if (next.length >= want) break; if (!next.some((x) => x.id === n.id)) { next = upsertNote(next, n); added = true; } }
  return added && saveNotes(next, store);
}
/** Removes the sample calls (and the demo call) the demo made. Returns how many went. */
export function clearSamples(store: Store | null): number {
  const have = loadNotes(store), keep = have.filter((n) => !n.id.startsWith(SAMPLE_PREFIX)); if (keep.length !== have.length) saveNotes(keep, store); return have.length - keep.length;
}
export const readDemo = (store: Pick<Storage, "getItem"> | null): DemoState | null => { try { const v = JSON.parse(store?.getItem(DEMO_KEY) ?? "null"); return v && Number.isInteger(v.step) && v.step >= 0 && v.step < STEPS.length ? { step: v.step, seeded: !!v.seeded } : null; } catch { return null; } };
