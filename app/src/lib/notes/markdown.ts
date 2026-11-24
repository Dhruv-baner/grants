import { crmToMarkdown, type CrmField } from "./crm";
import type { RuleResult } from "./rules";
import type { NoteResult } from "./types";

export function noteToMarkdown(title: string, date: string, n: NoteResult, opts: { rules?: RuleResult; crm?: CrmField[]; jottings?: string; transcript?: string } = {}): string {
  const out = [`# ${title || "Call notes"}`, `_${date}${n.source === "claude" ? ". Enhanced by Claude, every quote checked against the transcript." : ". Structured from the transcript; every point links to what was said."}_`, `## Summary\n${n.summary}`];
  if (n.keyPoints.length) out.push("## Key points\n" + n.keyPoints.map((p) => `- ${p.text}\n  > “${p.quote}”`).join("\n"));
  const rows = (Object.entries(n.facts) as [string, { value: string; quote: string | null }][]).filter(([, x]) => x.value);
  if (rows.length) out.push("## Facts from the call\n" + rows.map(([k, x]) => `- **${k.replace(/_/g, " ")}:** ${x.value}${x.quote ? ` (“${x.quote}”)` : ""}`).join("\n"));
  if (opts.rules?.flags.length) out.push("## Rule check\n" + opts.rules.flags.map((f) => `- **${f.title}.** ${f.detail}${f.programmes.length ? " " + f.programmes.map((p) => p.label + (p.note ? ` (${p.note})` : "")).join("; ") + "." : ""}`).join("\n"));
  if (opts.rules?.likely.length) out.push("Programmes that look relevant (readable score, not a statement of eligibility): " + opts.rules.likely.map((l) => l.label).join(", ") + ".");
  if (n.openQuestions.length) out.push("## Open questions\n" + n.openQuestions.map((q) => `- ${q.kind === "gap" ? "Ask next: " : "Said: "}${q.text}`).join("\n"));
  if (n.nextSteps.length) out.push("## Next steps\n" + n.nextSteps.map((s) => `- ${s.what}${s.when ? ` (${s.when})` : ""}`).join("\n"));
  if (opts.jottings?.trim()) out.push("## Your notes\n" + opts.jottings.trim());
  if (opts.crm) out.push("## CRM fields\n" + crmToMarkdown(opts.crm));
  if (opts.transcript) out.push("## Transcript\n" + opts.transcript.trim());
  return out.join("\n\n");
}
