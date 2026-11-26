// Claude writes short prose per match; every number must exist in the data (grounding check), else template text is kept.
import { groundingViolations } from "./grounding";
import type { Llm } from "./llm";
import type { MatchEntry, Profile, Scheme } from "./types";

export const PROSE_SYSTEM = `You write short factual notes for a business-funding consultant.
Use ONLY the facts provided in <schemes>. Never state any amount, percentage, date or number that is not in those facts.
If a condition is not in the facts, say it needs checking. Do not promise eligibility or funding.
Reply with ONLY a JSON array: [{"scheme_id": "...", "why_it_fits": "max 40 words", "watch_outs": ["max 3 short items"]}]`;

/** Reads the model's reply even when it is wrapped in text or code fences, or cut off part-way: falls back to every complete {...scheme_id...} object it can find. */
export function parseItems(text: string): any[] {
  const t = text.replace(/```(?:json)?/gi, "");
  try { const m = t.match(/\[[\s\S]*\]/); if (m) { const v = JSON.parse(m[0]); if (Array.isArray(v)) return v; } } catch { /* fall through to salvage */ }
  const out: any[] = [];
  for (const m of t.matchAll(/\{[^{}]*"scheme_id"[^{}]*\}/g)) { try { out.push(JSON.parse(m[0])); } catch { /* skip a broken object */ } }
  return out;
}

const CLAIM = /\b(?:qualif(?:y|ies|ied)|(?:is|are|will be) eligible|entitled|will receive|guaranteed?)\b/i;
export async function llmProse(profile: Profile, matches: MatchEntry[], by: Record<string, Scheme>, llm: Llm) {
  const notes: string[] = []; const prose: Record<string, { why: string; watch: string[] }> = {};
  const pack = matches.slice(0, 8).map((m) => { const r = by[m.scheme_id]; const f: Record<string, string> = {};
    for (const k of ["applicants", "funding_rate", "caps", "window", "before_start"]) f[k] = String(r[k] ?? "").slice(0, 260);
    return { scheme_id: m.scheme_id, name: r.name, status: m.status_clean, next_deadline: m.next_deadline, facts: f, matcher_reasons: m.reasons, matcher_flags: m.flags }; });
  const co = { country: profile.country, region: profile.region, size: profile.size, sectors: profile.sectors, activities: (profile.activities ?? "").slice(0, 400), signals: (profile.signals ?? []).slice(0, 8) };
  const res = await llm.complete({ system: PROSE_SYSTEM, user: `<company>${JSON.stringify(co)}</company>\n<schemes>${JSON.stringify(pack)}</schemes>`, task: "brief", maxTokens: 3000 });
  const arr = parseItems(res.text);
  if (!arr.length) notes.push(`Claude's reply could not be read${res.stopReason ? ` (it stopped because: ${res.stopReason})` : ""}; template text kept. It began: "${res.text.replace(/\s+/g, " ").slice(0, 140)}"`);
  for (const it of arr) {
    const row = by[it?.scheme_id]; if (!row || !matches.some((m) => m.scheme_id === it.scheme_id) || typeof it.why_it_fits !== "string") continue;
    const watch = (Array.isArray(it.watch_outs) ? it.watch_outs : []).filter((w: unknown) => typeof w === "string") as string[];
    if (CLAIM.test(it.why_it_fits + " " + watch.join(" "))) { notes.push(`${it.scheme_id}: generated text claimed eligibility or a guaranteed outcome, which is not allowed; template text kept.`); continue; }
    const bad = groundingViolations(it.why_it_fits + " " + watch.join(" "), row, profile);
    if (bad.length) { notes.push(`${it.scheme_id}: generated text contained numbers not found in the data (${bad.join(", ")}); template text kept.`); continue; }
    prose[it.scheme_id] = { why: it.why_it_fits.slice(0, 400), watch: watch.map((w) => w.slice(0, 200)).slice(0, 3) };
  }
  return { prose, notes, usage: { in: res.inputTokens, out: res.outputTokens } };
}
