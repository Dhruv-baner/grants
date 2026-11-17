// TypeScript port of pipeline/matcher.py. Constants come from matcher-config.json (exported from the Python file).
// tests/parity.test.ts checks this port against Python results on 95 profiles.
import cfg from "./matcher-config.json";
import type { MatchEntry, MatchResult, Profile, Scheme } from "./types";

const CONCEPT_RES: [string, RegExp][] = Object.entries(cfg.CONCEPTS).map(([k, p]) => [k, new RegExp(p as string)]);
const GATE = new Set<string>(cfg.GATE);
const ADJ = new Set<string>(cfg.ADJACENT.map((p) => [...p].sort().join("|")));
const CONSORTIUM_RE = /consortia only|consortium (of|with)|at least (two|three)|typically 3|cross-border (consortium|partners)|only consortia|joint project/;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pyRound = (x: number) => { const f = Math.floor(x); return x - f === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(x); };
const inter = <T,>(a: Set<T>, b: Set<T>) => new Set([...a].filter((x) => b.has(x)));

export function canonRegions(text: string | undefined): Set<string> {
  let t = (text || "").toLowerCase(); const out = new Set<string>();
  for (const [canon, aliases] of Object.entries(cfg.REGIONS as Record<string, string[]>)) {
    for (const a of aliases) {
      const re = new RegExp("\\b" + esc(a) + "\\b");
      if (re.test(t)) { out.add(canon); t = t.replace(new RegExp("\\b" + esc(a) + "\\b", "g"), " "); break; }
    }
  }
  return out;
}
export function conceptsIn(text: string | undefined): Set<string> {
  const t = (text || "").toLowerCase(); const out = new Set<string>();
  for (const [k, re] of CONCEPT_RES) if (re.test(t)) out.add(k);
  return out;
}
const rowText = (r: Scheme) => ["name", "summary", "activities", "fit_signals", "aliases", "type", "consortium"].map((k) => String(r[k] ?? "")).join(" ");
export function countryOk(pc: string, r: Scheme) {
  const rc = r.country;
  if (pc === "EU") return rc.startsWith("EU") || r.geo_scope === "eu";
  return rc.startsWith("EU") || rc.split(/[/ ,()]+/).includes(pc);
}
export const MIN_SCORE: number = cfg.MIN_SCORE; export const TOP_N: number = cfg.TOP_N;

export function match(profile: Profile, rows: Scheme[]): MatchResult {
  const pCountry = profile.country, pSize = profile.size ?? "unknown";
  let pSectors = new Set(profile.sectors ?? []);
  const ptext = (profile.signals ?? []).join(" ") + " " + (profile.description ?? "");
  let pConc = conceptsIn(ptext);
  if (["energy_saving", "renewable_energy", "decarbonisation"].some((c) => pConc.has(c))) pConc = new Set([...pConc, "environment_invest"]);
  const pRegions = canonRegions(profile.region ?? "");
  const cs = cfg.CONCEPT_SECTOR as Record<string, string>;
  pSectors = new Set([...pSectors, ...[...pConc].filter((c) => c in cs).map((c) => cs[c])]);
  const out: MatchResult = { matches: [], not_open: [], check_manually: [], excluded: {} };
  const excl = (why: string) => { out.excluded[why] = (out.excluded[why] ?? 0) + 1; };
  for (const r of rows) {
    if (r.status_clean === "varies") { excl("umbrella (see call rows)"); continue; }
    if (!countryOk(pCountry, r)) { excl("wrong country"); continue; }
    const flags: string[] = [], reasons: string[] = []; let regionPen = 0;
    const rr = canonRegions(r.region ?? "");
    if (r.geo_scope === "regional" && rr.size) {
      if (!pRegions.size) { flags.push(`regional scheme (${r.region}): confirm the company's location`); regionPen = 15; }
      else if (!inter(pRegions, rr).size) { excl("wrong region"); continue; }
      else reasons.push(`located in ${r.region}`);
    } else if (r.geo_scope === "eu" && rr.size && pRegions.size && !inter(pRegions, rr).size) flags.push("limited to specific border or programme regions");
    const sizes = r.eligible_sizes;
    if (!["any", "unknown"].includes(sizes) && pSize !== "unknown" && !sizes.split(";").includes(pSize)) { excl("size not eligible"); continue; }
    const sizePts = sizes === "any" || sizes.split(";").includes(pSize) ? 10 : 2;
    if (sizes === "unknown") flags.push("size eligibility not stated: check");
    const gate = new Set([...conceptsIn(r.name + " " + (r.aliases ?? ""))].filter((c) => GATE.has(c)));
    if (gate.size && !inter(gate, pConc).size) { excl("targets a specific theme the company does not show"); continue; }
    const rs = new Set(r.sector.split(";").map((s) => s.trim())); const tags = new Set([...rs].filter((s) => s !== "All sectors"));
    let secPts = 0; const overlap = inter(rs, pSectors);
    if (rs.has("All sectors")) secPts = 20;
    else if (overlap.size) { secPts = pyRound(20 + (20 * overlap.size) / tags.size); reasons.push("sector fit: " + [...overlap].sort().join(", ")); }
    else if ([...rs].some((a) => [...pSectors].some((b) => ADJ.has([a, b].sort().join("|"))))) { secPts = 12; reasons.push("adjacent sector fit"); }
    const shared = inter(conceptsIn(rowText(r)), pConc);
    const conPts = Math.min(30, 10 * shared.size);
    if (shared.size) reasons.push("shared themes: " + [...shared].sort().join(", ").replaceAll("_", " "));
    const ver = ({ Verified: 10, "Verified (framework)": 7, Partial: 3, Candidate: 0 } as Record<string, number>)[r.verification] ?? 0;
    const st = r.status_clean;
    const stPts = ({ open: 10, rolling: 10, opening_soon: 10, between_rounds: 5 } as Record<string, number>)[st] ?? 0;
    const adj: { label: string; points: number }[] = [];
    if (regionPen) adj.push({ label: "Regional scheme, company location not given", points: -regionPen });
    let score = secPts + conPts + sizePts + ver + stPts - regionPen;
    if (r.type_group === "Tax incentive") { score += 10; reasons.push("tax incentive: no competition for funds"); adj.push({ label: "Tax incentive: no competition for funds", points: 10 }); }
    if (CONSORTIUM_RE.test(((r.consortium ?? "") + " " + (r.applicants ?? "")).toLowerCase()) && !pConc.has("consortium_crossborder")) { score -= 15; flags.push("requires a consortium or partners the company has not mentioned"); adj.push({ label: "Needs a consortium the company has not mentioned", points: -15 }); }
    if (secPts === 0 && !shared.size) { excl("no sector or theme fit"); continue; }
    if (secPts <= 20 && !shared.size && !rs.has("All sectors")) { excl("no theme fit"); continue; }
    if (rs.has("All sectors") && !shared.size) { excl("generic scheme without a theme match"); continue; }
    const entry: MatchEntry = { scheme_id: r.id, name: r.name, score, reasons, flags, status_clean: st, next_deadline: r.closes_date, data_confidence: r.verification,
      type_group: r.type_group, questions_for_consultant: (r.call_questions ?? "").split(/\?\s*/).map((q) => q.trim()).filter(Boolean).slice(0, 3),
      breakdown: { sector: secPts, themes: conPts, size: sizePts, data: ver, status: stPts, adjustments: adj } };
    if (r.verification === "Partial" || r.verification === "Candidate") entry.flags.push(`data confidence ${r.verification}: verify before quoting`);
    if (st === "between_rounds") entry.flags.push("current round closed; next window" + (r.closes_date ? ` ends ${r.closes_date}` : " date unknown"));
    if (r.before_start_flag === "yes" || r.before_start_flag === "at_application") entry.flags.push(r.before_start_flag === "yes" ? "do not start the project before applying" : "project may start once the application is filed");
    if (r.verification === "Candidate" || st === "unknown") out.check_manually.push(entry);
    else if (st === "closed" || st === "paused") { if (!r.closes_date) entry.flags.push("not open now; no next window date known"); out.not_open.push(entry); }
    else out.matches.push(entry);
  }
  const byScore = (a: MatchEntry, b: MatchEntry) => b.score - a.score;
  out.matches.sort(byScore); out.not_open.sort(byScore); out.check_manually.sort(byScore);
  out.matches = out.matches.filter((e) => e.score >= MIN_SCORE).slice(0, TOP_N);
  out.not_open = out.not_open.filter((e) => e.score >= MIN_SCORE).slice(0, 6);
  out.check_manually = out.check_manually.slice(0, 5);
  for (const e of out.matches) e.fit = e.score >= 75 ? "high" : e.score >= 60 ? "medium" : "low";
  return out;
}
