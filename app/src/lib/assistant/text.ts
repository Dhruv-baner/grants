import { clean } from "../ui";
/** Lowercase, accent-folded text with punctuation turned into single spaces, so "SDE++" and "Gründungsstipendium.NRW" match plain aliases. */
export function norm(s: string): string {
  return s.replace(/['\u2019]/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u00df/g, "ss").toLowerCase()
    .replace(/&/g, " and ").replace(/\+\+/g, " plus plus ").replace(/[^a-z0-9]+/g, " ").trim();
}
export interface Hit { key: string; start: number; len: number; alias: string; }
/** Finds every whole-word occurrence of the aliases in the text; overlapping hits resolve in favour of the longer alias. */
export function scan(text: string, aliases: { key: string; alias: string }[]): Hit[] {
  const t = ` ${text} `; const all: Hit[] = [];
  for (const { key, alias } of aliases) {
    const needle = ` ${alias} `; let from = 0;
    for (;;) { const i = t.indexOf(needle, from); if (i < 0) break; all.push({ key, start: i, len: alias.length, alias }); from = i + 1; }
  }
  all.sort((a, b) => b.len - a.len || a.start - b.start);
  const taken: Hit[] = [];
  for (const h of all) if (!taken.some((x) => h.start < x.start + x.len + 2 && x.start < h.start + h.len + 2)) taken.push(h);
  return taken.sort((a, b) => a.start - b.start);
}
/** Source notes in the data say how a fact was sourced; in chat they are shown in plain words. */
export function tidy(s: string | undefined): string {
  if (!s) return "";
  return clean(s).replace(/\s*[(\[](secondary|adviser source|adviser sources)[)\]]/gi, " (adviser source)").replace(/\s*\(aggregator\)/gi, " (comparison site)")
    .replace(/\s{2,}/g, " ").trim();
}
export function shorten(s: string, max = 170): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max); const i = Math.max(cut.lastIndexOf("; "), cut.lastIndexOf(". "), cut.lastIndexOf(", "));
  return (i > max * 0.5 ? cut.slice(0, i) : cut.replace(/\s+\S*$/, "")).replace(/[;,.\s]+$/, "") + "…";
}
export const sentence = (s: string) => (s && !/[.!?…]$/.test(s) ? s + "." : s);
