// Checks what was said in the call against the programme data. Uses the same matcher and the same "apply before you start" facts as the rest of the tool.
import { match } from "../matcher";
import { IN_SCOPE_ROWS, labelOf } from "../assistant/knowledge";
import type { Scheme } from "../types";
import { plain } from "../ui";
import { profileFromNote } from "./handoff";
import type { NoteResult } from "./types";

export interface RuleFlag { level: "alert" | "ok" | "ask"; title: string; detail: string; programmes: { id: string; label: string; note?: string }[]; }
export interface RuleResult { flags: RuleFlag[]; likely: { id: string; label: string; score: number }[]; }
const startsFirst = (r: Scheme) => /^\s*yes\b/i.test(String(r.before_start ?? ""));
const clock = (r: Scheme) => /order date|within \d+ months|three months|3 months|months? (?:of|after|from)/i.test(String(r.before_start ?? ""));
export function ruleCheck(n: NoteResult): RuleResult {
  const p = profileFromNote(n); const res = p ? match(p, IN_SCOPE_ROWS) : null; const top = (res?.matches ?? []).slice(0, 6);
  const rows = top.map((m) => IN_SCOPE_ROWS.find((r) => r.id === m.scheme_id)!); const likely = top.slice(0, 4).map((m) => ({ id: m.scheme_id, label: labelOf(m.scheme_id), score: m.score }));
  const first = rows.filter(startsFirst), timed = rows.filter((r) => clock(r) && !startsFirst(r)); const ref = (r: Scheme) => ({ id: r.id, label: labelOf(r.id), note: plain(String(r.before_start ?? "")) }); const flags: RuleFlag[] = [];
  if (n.ordered === "yes") {
    if (first.length) flags.push({ level: "alert", title: "Already ordered or started, but these programmes must be applied for first", detail: "Check each programme page before going further. Work that has started can rule a programme out.", programmes: first.map(ref) });
    if (timed.length) flags.push({ level: "alert", title: "A deadline runs from the order date", detail: "The clock may already be running. Confirm the exact date and wording on the programme page.", programmes: timed.map(ref) });
    if (!first.length && !timed.length) flags.push({ level: "ask", title: "Something is already ordered or started", detail: p ? "None of the best-matching programmes say that applying must come first, but confirm on each programme page." : "Add the country to see which programmes this affects.", programmes: [] });
  } else if (n.ordered === "no") {
    flags.push({ level: "ok", title: "Nothing ordered yet, so the timing is still open", detail: first.length ? "Hold off on ordering or signing until these are applied for." : "Keep it that way until the right programme is chosen.", programmes: first.map(ref) });
  } else {
    flags.push({ level: "ask", title: "Find out whether anything is ordered or started", detail: first.length ? `${first.length} of the best-matching programmes must be applied for before work starts.` : "Several programmes must be applied for before ordering or starting.", programmes: first.map(ref) });
  }
  return { flags, likely };
}
