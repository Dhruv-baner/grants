// Spoken and written numbers: "three hundred thousand euros", "€1.2 million", "300k", "forty", "3,000".
const UNITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const FILLER = new Set(["and", "a", "an", "about", "around", "roughly", "approximately", "some", "just", "only", "over", "nearly", "almost"]);
export const NUMBER_WORDS = [...Object.keys(UNITS), ...Object.keys(TENS), "hundred", "thousand", "million", "billion"];
const plainNumber = (s: string): number | null => {
  const t = s.replace(/\s/g, ""); if (/^\d{1,3}(\.\d{3})+$/.test(t)) return parseInt(t.replace(/\./g, ""), 10); // 1.200.000
  const n = parseFloat(t.replace(/,/g, "")); return Number.isFinite(n) ? n : null;
};
/** "three hundred and fifty thousand" -> 350000; "300 thousand" -> 300000; "1.2 million" -> 1200000; null if it is not a number. */
export function wordsToNumber(input: string): number | null {
  const toks = input.toLowerCase().split(/[\s-]+/).filter((t) => t && !FILLER.has(t)); if (!toks.length) return null;
  let total = 0, cur = 0, seen = false;
  for (const t of toks) {
    const km = t.match(/^(\d[\d.,]*)(k|m|mn)$/);
    if (/^\d[\d.,]*$/.test(t)) { const n = plainNumber(t); if (n === null) return null; cur += n; seen = true; }
    else if (km) { const n = plainNumber(km[1]); if (n === null) return null; total += n * (km[2] === "k" ? 1e3 : 1e6); seen = true; }
    else if (t in UNITS) { cur += UNITS[t]; seen = true; } else if (t in TENS) { cur += TENS[t]; seen = true; }
    else if (t === "hundred") { cur = (cur || 1) * 100; seen = true; }
    else if (t === "thousand" || t === "k") { total += (cur || 1) * 1e3; cur = 0; seen = true; }
    else if (t === "million" || t === "mn" || t === "m") { total += (cur || 1) * 1e6; cur = 0; seen = true; }
    else if (t === "billion" || t === "bn") { total += (cur || 1) * 1e9; cur = 0; seen = true; }
    else return null;
  }
  return seen ? total + cur : null;
}
export interface Amount { value: number; index: number; length: number; text: string; }
const W = NUMBER_WORDS.join("|"); const SUFFIX = "k|m|mn|thousand|million|billion|bn";
const PATTERNS: RegExp[] = [
  new RegExp(String.raw`(?:€|\beur\s?|\beuros?\s)\s?(\d[\d.,]*)(?:\s?(${SUFFIX})\b)?`, "gi"),
  new RegExp(String.raw`\b(\d[\d.,]*)\s?(${SUFFIX})?\s?(?:euros?|eur\b|€)`, "gi"),
  new RegExp(String.raw`\b((?:(?:${W}|and|a)[\s-]+)*(?:${W}))\s+(?:euros?|eur)\b`, "gi"),
  new RegExp(String.raw`\b(?:cost(?:s|ing)?|budget|worth|investment|invest(?:s|ing)?|spend(?:ing)?|price|value)\s+(?:of\s+|is\s+|about\s+|around\s+|roughly\s+|up to\s+)*(\d[\d.,]*)\s?(${SUFFIX})\b`, "gi"),
];
/** Money amounts in euros found in a text, in order, without overlaps. */
export function findAmounts(text: string): Amount[] {
  const all: Amount[] = [];
  PATTERNS.forEach((re, k) => { for (const m of text.matchAll(re)) {
    const value = k === 2 ? wordsToNumber(m[1]) : wordsToNumber(`${m[1]} ${m[2] ?? ""}`.trim());
    if (value === null || value <= 0) continue; // pattern 3 has no currency word, only a cost word in front
    all.push({ value, index: m.index!, length: m[0].length, text: m[0] }); } });
  all.sort((a, b) => b.length - a.length); const kept: Amount[] = [];
  for (const a of all) if (!kept.some((x) => a.index < x.index + x.length && x.index < a.index + a.length)) kept.push(a);
  return kept.sort((a, b) => a.index - b.index);
}
export const formatEur = (n: number) => "€" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const sizeBand = (n: number): "micro" | "small" | "medium" | "large" => (n < 10 ? "micro" : n < 50 ? "small" : n < 250 ? "medium" : "large");
