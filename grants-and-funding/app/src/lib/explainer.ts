// Template brief (no AI): port of the template mode in pipeline/explainer.py.
import type { MatchEntry, MatchResult, Profile, Scheme, Source } from "./types";
export const BANNER = "Indicative screening only. Consultant review required. Not legal or financial advice.";
export const FACT_FIELDS = ["funding_rate", "caps", "window", "before_start", "status"] as const;
export interface BriefItem {
  scheme_id: string; name: string; fit: string; score: number; status_clean: string; next_deadline: string; data_confidence: string; type_group: string;
  why_it_fits: string; watch_outs: string[]; questions: string[]; key_terms: Record<string, string>; as_of: string; sources: Source[];
}
export interface Brief {
  company: Profile; data_as_of: string; banner: string; matches: BriefItem[];
  not_open: { scheme_id: string; name: string; status_clean: string; next_deadline: string; flags: string[] }[];
  check_manually: { scheme_id: string; name: string; status_clean: string; next_deadline: string; flags: string[] }[];
}
export function templateProse(m: MatchEntry, row: Scheme): [string, string[]] {
  const r = m.reasons.join("; ");
  const why = m.reasons.length ? r.slice(0, 1).toUpperCase() + r.slice(1) + "." : "Passes the country, size and status filters.";
  const watch = [...m.flags];
  if (row.rejection_risks) watch.push("Typical rejection risks: " + row.rejection_risks.slice(0, 200));
  return [why, watch.slice(0, 4)];
}
export function questionsFor(m: MatchEntry, row: Scheme): string[] {
  const qs = (row.call_questions ?? "").split(/\?\s*/).map((q) => q.trim()).filter(Boolean).map((q) => q + "?");
  return (qs.length ? qs : m.questions_for_consultant).slice(0, 3);
}
export function buildBrief(profile: Profile, result: MatchResult, by: Record<string, Scheme>, dataAsOf: string): Brief {
  const short = (l: MatchEntry[]) => l.map((e) => ({ scheme_id: e.scheme_id, name: e.name, status_clean: e.status_clean, next_deadline: e.next_deadline, flags: e.flags }));
  return {
    company: profile, data_as_of: dataAsOf, banner: BANNER, not_open: short(result.not_open), check_manually: short(result.check_manually),
    matches: result.matches.map((m) => {
      const row = by[m.scheme_id]; const [why, watch] = templateProse(m, row);
      return { scheme_id: m.scheme_id, name: row.name, fit: m.fit ?? "low", score: m.score, status_clean: m.status_clean, next_deadline: m.next_deadline,
        data_confidence: m.data_confidence, type_group: m.type_group, why_it_fits: why, watch_outs: watch, questions: questionsFor(m, row),
        key_terms: Object.fromEntries(FACT_FIELDS.map((k) => [k, String(row[k] ?? "").slice(0, 300)])), as_of: row.as_of, sources: row.sources.slice(0, 4) };
    }),
  };
}
const BADGE: Record<string, string> = { Verified: "[Verified]", "Verified (framework)": "[Verified: framework]", Partial: "[Partial: verify before quoting]", Candidate: "[Candidate]" };
export function renderMarkdown(b: Brief): string {
  const c = b.company; const L: string[] = [`# Funding screening: ${c.name ?? "company"}`, "", `> **${b.banner}**`, `> Data as of ${b.data_as_of}.`, "",
    "## Company profile", `- Country: ${c.country}${c.region ? ", " + c.region : ""}`, `- Size: ${c.size ?? "unknown"}`, `- Sectors: ${(c.sectors ?? []).join(", ") || "not determined"}`,
    `- Activities: ${c.activities || c.description || "not determined"}`, "", "## Top matches", ""];
  if (!b.matches.length) L.push("No open scheme passed the filters. See the lists below.", "");
  b.matches.forEach((m, i) => {
    L.push(`### ${i + 1}. ${m.name}  (${m.fit} fit, score ${m.score})`, `${BADGE[m.data_confidence] ?? m.data_confidence} | ${m.type_group} | status: ${m.status_clean}${m.next_deadline ? ", next deadline " + m.next_deadline : ""}`, "",
      `**Why it may fit:** ${m.why_it_fits}`, "", `**Key terms (copied from the data, as of ${m.as_of}):**`);
    for (const [k, v] of Object.entries(m.key_terms)) if (v) L.push(`- ${k.replaceAll("_", " ")}: ${v}`);
    L.push(""); if (m.watch_outs.length) L.push("**Watch-outs:**", ...m.watch_outs.map((w) => `- ${w}`), "");
    if (m.questions.length) L.push("**Questions for the consultant:**", ...m.questions.map((q) => `- ${q}`), "");
    L.push("**Sources:** " + m.sources.map((s) => `${s.tier}: ${s.url}`).join("; "), "");
  });
  if (b.not_open.length) L.push("## Relevant but not open now", ...b.not_open.map((x) => `- ${x.name} (${x.status_clean})${x.next_deadline ? ", next date " + x.next_deadline : ""}`), "");
  if (b.check_manually.length) L.push("## To check manually (unverified or unknown status)", ...b.check_manually.map((x) => `- ${x.name}`), "");
  L.push("---", "Rates, caps and deadlines are true only as of the data date. Check official sources before advising a client.");
  return L.join("\n");
}
const q = (s: string | number) => `"${String(s).replaceAll('"', '""')}"`;
export function toCsv(b: Brief): string {
  const head = ["company", "scheme_id", "scheme", "fit", "score", "status", "next_deadline", "type_group", "data_confidence", "official_source"];
  const rows = b.matches.map((m) => [b.company.name ?? "", m.scheme_id, m.name, m.fit, m.score, m.status_clean, m.next_deadline, m.type_group, m.data_confidence,
    (m.sources.find((s) => s.tier === "Official") ?? m.sources[0])?.url ?? ""]);
  return [head, ...rows].map((r) => r.map(q).join(",")).join("\n");
}
