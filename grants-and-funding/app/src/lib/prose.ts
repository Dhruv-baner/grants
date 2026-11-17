// Claude writes short prose per match; every number must exist in the data (grounding check), else template text is kept.
import { groundingViolations } from "./grounding";
import type { Llm } from "./llm";
import type { MatchEntry, Profile, Scheme } from "./types";

export const PROSE_SYSTEM = `You write short factual notes for a business-funding consultant.
Use ONLY the facts provided in <schemes>. Never state any amount, percentage, date or number that is not in those facts.
If a condition is not in the facts, say it needs checking. Do not promise eligibility or funding.
Reply with ONLY a JSON array: [{"scheme_id": "...", "why_it_fits": "max 40 words", "watch_outs": ["max 3 short items"]}]`;

export async function llmProse(profile: Profile, matches: MatchEntry[], by: Record<string, Scheme>, llm: Llm) {
  const notes: string[] = []; const prose: Record<string, { why: string; watch: string[] }> = {};
  const pack = matches.slice(0, 8).map((m) => { const r = by[m.scheme_id]; const f: Record<string, string> = {};
    for (const k of ["applicants", "funding_rate", "caps", "window", "before_start"]) f[k] = String(r[k] ?? "").slice(0, 260);
    return { scheme_id: m.scheme_id, name: r.name, status: m.status_clean, next_deadline: m.next_deadline, facts: f, matcher_reasons: m.reasons, matcher_flags: m.flags }; });
  const co = { country: profile.country, region: profile.region, size: profile.size, sectors: profile.sectors, activities: (profile.activities ?? "").slice(0, 400), signals: (profile.signals ?? []).slice(0, 8) };
  const res = await llm.complete({ system: PROSE_SYSTEM, user: `<company>${JSON.stringify(co)}</company>\n<schemes>${JSON.stringify(pack)}</schemes>`, task: "brief", maxTokens: 1400 });
  let arr: any[] = [];
  try { arr = JSON.parse((res.text.match(/\[[\s\S]*\]/) ?? [""])[0]); } catch { notes.push("Claude prose could not be read; template text kept."); }
  for (const it of arr) {
    const row = by[it?.scheme_id]; if (!row || !matches.some((m) => m.scheme_id === it.scheme_id) || typeof it.why_it_fits !== "string") continue;
    const watch = (Array.isArray(it.watch_outs) ? it.watch_outs : []).filter((w: unknown) => typeof w === "string") as string[];
    const bad = groundingViolations(it.why_it_fits + " " + watch.join(" "), row, profile);
    if (bad.length) { notes.push(`${it.scheme_id}: generated text contained numbers not found in the data (${bad.join(", ")}); template text kept.`); continue; }
    prose[it.scheme_id] = { why: it.why_it_fits.slice(0, 400), watch: watch.map((w) => w.slice(0, 200)).slice(0, 3) };
  }
  return { prose, notes, usage: { in: res.inputTokens, out: res.outputTokens } };
}
