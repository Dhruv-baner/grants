// The call companion: what a funding call should cover, and which of it the transcript has already said.
// An item is covered only when the call actually stated it, so the list never claims more than the transcript holds.
import type { NoteResult } from "./types";

export interface Item { id: string; label: string; ask: string; why: string; value: (n: NoteResult) => string | null; }
const COUNTRY: Record<string, string> = { NL: "Netherlands", DE: "Germany", EU: "EU (other member state)", OTHER: "Outside the EU" };
const some = (s?: string) => (s && s.trim() ? s.trim() : null);
export const ITEMS: Item[] = [
  { id: "where", label: "Where it is based", ask: "Which country and region are you based in?", why: "Decides which national and regional programmes apply.", value: (n) => { const c = n.facts.country?.value; return c ? [n.facts.region?.value, COUNTRY[c] ?? c].filter(Boolean).join(", ") : null; } },
  { id: "size", label: "Company size", ask: "Roughly how many people do you employ?", why: "Many programmes have size limits, and some rates depend on it.", value: (n) => (n.nums.employees !== undefined ? `about ${n.nums.employees.toLocaleString("en-GB")} people` : some(n.facts.size?.value)) },
  { id: "what", label: "What it does", ask: "What does the company make or do?", why: "Sets the sector and the themes that can match.", value: (n) => some(n.facts.activity?.value) ?? some(n.facts.sector?.value?.split(";")[0]) },
  { id: "project", label: "The project", ask: "What exactly are you planning to do?", why: "Programmes fund specific kinds of projects.", value: (n) => some(n.facts.project?.value) },
  { id: "budget", label: "Budget", ask: "What is the budget for it?", why: "Sizes the aid and checks the caps.", value: (n) => some(n.facts.amount?.value) ?? (n.nums.amountEur !== undefined ? `€${n.nums.amountEur.toLocaleString("en-GB")}` : null) },
  { id: "timing", label: "Planned start", ask: "When do you plan to start?", why: "Checks the deadlines against the timeline.", value: (n) => some(n.facts.timing?.value) },
  { id: "ordered", label: "Anything ordered yet", ask: "Has anything been ordered or signed yet?", why: "Many programmes must be applied for before work starts.", value: (n) => (n.ordered === "no" ? "Nothing ordered yet" : n.ordered === "yes" ? "Already ordered or started" : null) },
  { id: "previous", label: "Past funding", ask: "Have you had grants or subsidies before?", why: "Affects state-aid limits, and shows what they already know.", value: (n) => some(n.facts.previous?.value) },
  { id: "decision", label: "Who decides", ask: "Who decides, and by when?", why: "Sets the pace, and who to follow up with.", value: (n) => some(n.facts.decision?.value) },
];
export interface Status { item: Item; value: string | null; }
export const companion = (n: NoteResult): Status[] => ITEMS.map((item) => ({ item, value: item.value(n) }));
/** How many items are covered, counting the ones the consultant ticked by hand. */
export const coveredCount = (s: Status[], manual: Record<string, boolean> = {}) => s.filter((x) => x.value || manual[x.item.id]).length;
