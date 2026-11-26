// The follow-up email after a call. A template filled only from what the call said and from the same matcher and checklists as the rest of the app,
// so nothing in it can be invented, and it never says the company qualifies.
import { BY_ID, SCHEMES } from "../data";
import { match } from "../matcher";
import { CHECKLISTS, IN_SCOPE } from "../assistant/knowledge";
import { checksFor } from "../screen/eligibility";
import type { Project } from "../screen/types";
import { clean, fmtDate } from "../ui";
import { profileFromNote } from "./handoff";
import type { NoteResult } from "./types";

const ASK: Record<string, string> = { region: "Which region will the project be in?", size: "Roughly how many people do you employ?", timing: "Is there a date by which the project has to start?", start: "Has anything been ordered or signed yet?", partners: "Do you have a partner for the project, such as another company or a research institute?" };
const you = (s: string) => s.replace(/\bthe company\b/gi, "your company").replace(/\btheir\b/gi, "your").replace(/\bthey\b/gi, "you");
const first = (s: string) => { const t = clean(s).trim(); return (t.split(/(?<=[.!?])\s/)[0] ?? t).replace(/\.$/, ""); };
export interface Recap { subject: string; body: string; programmes: string[]; }
export function buildRecap(n: NoteResult, opts: { title?: string; today?: string } = {}): Recap {
  const F = n.facts, name = F.company?.value || (opts.title && !/^sample call/i.test(opts.title) ? opts.title : "");
  const facts: [string, string | undefined][] = [["Location", [F.region?.value, F.country ? ({ NL: "Netherlands", DE: "Germany", EU: "another EU country", OTHER: "outside the EU" } as Record<string, string>)[F.country.value] : ""].filter(Boolean).join(", ") || undefined],
    ["Size", n.nums.employees !== undefined ? `about ${n.nums.employees} people` : F.size?.value], ["What you do", F.activity?.value], ["Project", F.project ? you(F.project.value) : undefined], ["Budget", F.amount?.value],
    ["Planned start", F.timing?.value], ["Status", n.ordered === "no" ? "nothing ordered yet" : n.ordered === "yes" ? "something has already been ordered or started" : undefined], ["Decision-maker", F.decision?.value]];
  const lines: string[] = ["Hello,", "", "Thank you for your time today. This is what I took from our call. Please tell me if anything is off.", ""];
  const stated = facts.filter(([, v]) => v); lines.push(...(stated.length ? stated.map(([k, v]) => `• ${k}: ${v}`) : ["• (Nothing specific was said yet.)"]), "");
  const profile = profileFromNote(n, name), project: Project = { started: n.ordered === "yes" ? "yes" : n.ordered === "no" ? "no" : "unknown", budget: n.nums.amountEur };
  const top = profile ? match(profile, SCHEMES).matches.slice(0, 3) : [], asks = new Set<string>();
  if (top.length) {
    lines.push("Programmes worth a closer look", ...top.map((m) => { const row = BY_ID[m.scheme_id], when = m.next_deadline ? ` Closes ${fmtDate(m.next_deadline)}.` : m.status_clean === "rolling" ? " Open on a rolling basis." : ""; return `• ${m.name}: ${first(row.summary)}.${when}`; }),
      "This is a first indication from what you told me. It does not say that your company qualifies for any of them: each programme's own conditions decide that.", "");
    for (const m of top) for (const c of checksFor(profile!, project, BY_ID[m.scheme_id])) if (c.verdict === "unknown" && ASK[c.id]) asks.add(ASK[c.id]);
  } else lines.push("I still need to know where the company is based before I can suggest programmes.", "");
  for (const q of n.openQuestions.filter((x) => x.kind === "gap").slice(0, 2)) asks.add(you(q.text).replace(/^Has your company/, "Has your company"));
  const ask = [...asks].slice(0, 5); if (ask.length) lines.push("To take this further, it would help to know", ...ask.map((q) => `• ${q}`), "");
  const docs = [...new Set(top.filter((m) => IN_SCOPE.includes(m.scheme_id)).flatMap((m) => CHECKLISTS[m.scheme_id].documents.filter((d) => d.required === "required").map((d) => d.item)))].slice(0, 6);
  if (docs.length) lines.push("Documents it helps to have ready", ...docs.map((d) => `• ${d}`), "");
  const steps = n.nextSteps.map((s) => `• ${s.what}${s.when && !s.what.toLowerCase().includes(s.when.toLowerCase()) ? ` (${s.when})` : ""}`);
  lines.push("Next steps", ...(steps.length ? steps : ["• I will come back to you with a short list once I have checked the details."]), "", "Best regards,", "[Your name]");
  return { subject: `Following up on our call: funding for ${name || "your project"}`, body: lines.join("\n"), programmes: top.map((m) => m.scheme_id) };
}
