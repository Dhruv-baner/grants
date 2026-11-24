import type { Answer, Block } from "./engine";
import { collectCitations, type Citation } from "./citations";
import { DATA_AS_OF } from "./knowledge";
import { fmtDate } from "../ui";

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
function blockMd(b: Block, cites: Citation[]): string {
  const n = (u: string) => { const c = cites.find((x) => x.url === u); return c ? ` [${c.n}]` : ""; };
  switch (b.t) {
    case "title": return `## ${b.text}${b.sub ? `\n_${b.sub}_` : ""}`;
    case "text": return b.text;
    case "notice": return `> ${b.text}`;
    case "facts": return b.rows.map((r) => `- **${r.k}:** ${r.v}`).join("\n") + (b.src ? `\n\nSource:${n(b.src)}` : "");
    case "checklist": return b.groups.map((g) => `### ${g.label}\n` + g.items.map((i) => `- **${i.item}**${i.note ? `: ${i.note}` : ""}${n(i.url)}`).join("\n")).join("\n\n");
    case "table": return `| Topic | ${b.cols.map(cell).join(" | ")} |\n|---|${b.cols.map(() => "---|").join("")}\n` + b.rows.map((r) => `| ${cell(r.label)} | ${r.cells.map(cell).join(" | ")} |`).join("\n");
    case "list": return b.groups.map((g) => `### ${g.label}${g.note ? `\n_${g.note}_` : ""}\n` + g.items.map((i) => `- **${i.label}** (${i.meta}): ${i.status}. ${i.summary}${n(i.url)}`).join("\n")).join("\n\n") + (b.more ? `\n\n${b.more.text}` : "");
    case "picks": return b.items.map((p, i) => `${i + 1}. **${p.label}**: ${p.score} / 110${p.fit ? `, ${p.fit} fit` : ""}${p.deadline ? `. ${p.deadline}` : ""}${p.why.length ? `\n   - Why: ${p.why.join("; ")}` : ""}${p.flags.length ? `\n   - To check: ${p.flags.join("; ")}` : ""}`).join("\n");
    default: return "";
  }
}
const FOOT = () => `_Programme data as of ${fmtDate(DATA_AS_OF)}. A checklist says what the official page asks for. It is not advice that a company qualifies._`;
export function answerToMarkdown(a: Answer, cites: Citation[] = collectCitations(a), aiText?: string): string {
  const parts = [aiText ? `${aiText}\n\n_Written by Claude from the programme's record, with numbers checked against the data._` : "", ...a.blocks.map((b) => blockMd(b, cites)).filter(Boolean)];
  if (cites.length) parts.push("**Sources**\n" + cites.map((c) => `${c.n}. [${c.label}](${c.url})`).join("\n"));
  if (a.kind !== "help" && a.kind !== "beta") parts.push(FOOT());
  return parts.filter(Boolean).join("\n\n");
}
export interface ExportMsg { role: "me" | "bot"; text?: string; answer?: Answer; ai?: string; }
export function chatToMarkdown(title: string, msgs: ExportMsg[], date: string): string {
  const out = [`# ${title || "Conversation"}`, `_Grants and Funding, exported ${date}._`];
  for (const m of msgs) out.push(m.role === "me" ? `**Question:** ${m.text ?? ""}` : answerToMarkdown(m.answer!, undefined, m.ai));
  return out.join("\n\n---\n\n").replace(/\n\n---\n\n(?=\*\*Question)/g, "\n\n---\n\n");
}
