// What if the company were a different size, or elsewhere? Re-runs the same matcher and shows what changes. Robustness: does the top 3 depend on a field we do not know?
import { canonRegions, match, rowText } from "../matcher";
import type { MatchEntry, MatchResult, Profile, Scheme } from "../types";

export interface Item { id: string; name: string; score: number; }
export interface Moved { id: string; name: string; from: number; to: number; delta: number; }
export interface Diff { appear: Item[]; vanish: Item[]; moved: Moved[]; same: number; }
const item = (m: MatchEntry): Item => ({ id: m.scheme_id, name: m.name, score: m.score });
export function diffResults(a: MatchResult, b: MatchResult): Diff {
  const A = new Map(a.matches.map((m, i) => [m.scheme_id, { m, i }])), B = new Map(b.matches.map((m, i) => [m.scheme_id, { m, i }]));
  const moved: Moved[] = []; let same = 0;
  for (const [id, x] of A) { const y = B.get(id); if (!y) continue; if (y.i !== x.i || y.m.score !== x.m.score) moved.push({ id, name: x.m.name, from: x.i + 1, to: y.i + 1, delta: y.m.score - x.m.score }); else same++; }
  return { appear: b.matches.filter((m) => !A.has(m.scheme_id)).map(item), vanish: a.matches.filter((m) => !B.has(m.scheme_id)).map(item), moved: moved.sort((p, q) => Math.abs(q.delta) - Math.abs(p.delta) || p.to - q.to), same };
}
export function whatIf(base: Profile, change: Partial<Profile>, rows: Scheme[]) { const a = match(base, rows), b = match({ ...base, ...change }, rows); return { base: a, alt: b, diff: diffResults(a, b) }; }

export interface Variant { label: string; top3: string[]; appear: Item[]; vanish: Item[]; }
export interface Finding { field: "size" | "region"; stable: boolean; summary: string; variants: Variant[]; }
export interface Robust { top3: string[]; stable: boolean; findings: Finding[]; }
const top3 = (r: MatchResult) => r.matches.slice(0, 3).map((m) => m.scheme_id);
const SIZES = ["micro", "small", "medium", "large"] as const;
export function robustness(p: Profile, rows: Scheme[]): Robust {
  const base = match(p, rows), t3 = top3(base), findings: Finding[] = [];
  if (!p.size || p.size === "unknown") {
    const variants: Variant[] = SIZES.map((s) => { const alt = match({ ...p, size: s }, rows); const d = diffResults(base, alt); return { label: s, top3: top3(alt), appear: d.appear, vanish: d.vanish }; });
    const stable = variants.every((v) => v.top3.join() === t3.join());
    const names = new Map(base.matches.map((m) => [m.scheme_id, m.name])); const lead = variants.map((v) => `${v.label}: ${v.top3[0] ? names.get(v.top3[0]) ?? v.top3[0] : "none"}`).join("; ");
    findings.push({ field: "size", stable, variants, summary: stable ? "The top 3 is the same at every company size." : `The top 3 depends on company size (leader by size: ${lead}).` });
  }
  if (!p.region?.trim()) {
    const regions = new Set<string>(); for (const r of rows) if (r.geo_scope === "regional") for (const x of canonRegions(rowText(r))) regions.add(x);
    const variants: Variant[] = [];
    for (const reg of regions) { if (!canonRegions(reg).has(reg)) continue; const alt = match({ ...p, region: reg }, rows); const d = diffResults(base, alt); if (d.appear.length || d.vanish.length) variants.push({ label: reg, top3: top3(alt), appear: d.appear, vanish: d.vanish }); }
    variants.sort((a, b) => b.appear.length - a.appear.length || a.label.localeCompare(b.label));
    findings.push({ field: "region", stable: variants.length === 0, variants, summary: variants.length ? `Regional programmes appear only if the company is in a particular region (${variants.slice(0, 4).map((v) => `${v.label}: ${v.appear.length}`).join(", ")}).` : "No regional programme changes the result." });
  }
  return { top3: t3, stable: findings.every((f) => f.stable), findings };
}
