// Open-ended discovery questions ("grants for energy companies", "Dutch grants", "what closes this month"):
// a plain filter over the programmes, not a company screening. The covered programmes are listed in full;
// matching programmes that are not covered yet are only counted, with the beta message.
import { SCHEMES } from "../data";
import { conceptsIn, rowText } from "../matcher";
import type { Scheme } from "../types";
import { daysBetween, fmtDate, LABEL } from "../ui";
import { AS_COUNTRY, BETA } from "./config";
import { DATA_AS_OF, IN_SCOPE_ROWS, inScope, labelOf } from "./knowledge";
import { sectorsIn } from "./profileFromText";
import { norm, sentence, shorten, tidy } from "./text";
import type { Answer, Block } from "./engine";

export type Pref = "grants" | "tax" | "loans" | "equity";
export interface Filters { countries: ("NL" | "DE" | "EU")[]; sectors: string[]; themes: string[]; pref: Pref | null; soon: { from: string; to: string; label: string } | null; openNow: boolean; }
export interface Item { id: string; label: string; meta: string; status: string; summary: string; url: string; }
export interface Group { label: string; note?: string; items: Item[]; }

const DISCOVER = /\b(grants?|subsid\w+|fund(s|ing)?|loans?|credits?|tax (incentives?|credits?|relief|deductions?|allowances?)|incentives?|programmes?|programs?|schemes?|support|financing|finance|money|calls?|opportunit\w+|open now|closing soon|deadlines?|whats open|what is open|closes?|closing)\b/;
const NL = /\b(dutch|netherlands|nederland|holland)\b/, DE = /\b(german|germany|deutschland)\b/, EU = /\b(eu|european|europe)\b/;
const TYPE_RX: [Pref, RegExp][] = [["tax", /\btax (incentives?|credits?|relief|deductions?|allowances?|breaks?)\b|\btax\b/], ["loans", /\b(loans?|borrow\w*|guarantees?|debt|financing|credit facilit\w+)\b/], ["equity", /\b(equity|venture|investors?|investments?)\b/], ["grants", /\b(grants?|subsid\w+)\b/]];
const GROUPS: Record<Pref, string[]> = { grants: ["Grant", "Mixed (grant and loan)", "Mixed (grant and equity)"], tax: ["Tax incentive"], loans: ["Loan", "Guarantee", "Other (commercial finance)", "Mixed (grant and loan)"], equity: ["Equity", "Mixed (grant and equity)"] };
const CATEGORY = (r: Scheme) => r.type_group === "Grant" ? "Grants and subsidies" : r.type_group === "Tax incentive" ? "Tax incentives" : ["Loan", "Guarantee", "Other (commercial finance)"].includes(r.type_group) ? "Loans and guarantees" : "Mixed grant, loan or equity";
const CAT_ORDER = ["Grants and subsidies", "Tax incentives", "Loans and guarantees", "Mixed grant, loan or equity"];
const COUNTRY_NAME: Record<string, string> = { NL: "Netherlands", DE: "Germany", EU: "EU" };
const NOW_STATUS = new Set(["open", "rolling", "opening_soon"]);
const THEMES = new Map(SCHEMES.map((r) => [r.id, conceptsIn(rowText(r))]));
// The matcher's theme detection is deliberately broad (it feeds a score). A browse list needs precision, so the common themes use a tighter check on the programme's own description.
const STRICT: Record<string, RegExp> = {
  rd_innovation: /\b(r&d|research|innovation|innovative|experimental development)\b/i, startup: /\b(start-?ups?|founders?|founding|scale-?ups?|spin-?offs?)\b/i,
  energy_saving: /\b(energy[- ]saving|energy efficien\w*|heat pumps?|insulation|energy advice|energy audits?|renewable)\b/i, ai_digital: /\b(artificial intelligence|\bai\b|machine learning|digital)\b/i,
  circular_plastics: /\b(recycl\w*|circular|plastics?|waste)\b/i, hydrogen: /\bhydrogen\b/i,
};
const themeText = (r: Scheme) => [r.name, r.summary, r.activities, r.fit_signals, r.applicants].map((x) => String(x ?? "")).join(" ");
const hasTheme = (r: Scheme, c: string) => (STRICT[c] ? STRICT[c].test(themeText(r)) : (THEMES.get(r.id) ?? new Set()).has(c));
const THEME_LABEL: Record<string, string> = { rd_innovation: "R&D and innovation", startup: "start-ups", energy_saving: "energy saving", ai_digital: "AI and digital", circular_plastics: "plastics and recycling", hydrogen: "hydrogen" };
const MONTH_END = (iso: string) => { const [y, m] = iso.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

/** True when the message is about finding funding at all, even if it names no filter. */
export const isDiscovery = (original: string) => DISCOVER.test(norm(original));
/** Reads a discovery question. Returns null unless it names at least one filter, so company descriptions and unrelated questions pass through. */
export function parseBrowse(original: string): Filters | null {
  const t = norm(original); if (!DISCOVER.test(t)) return null;
  const countries: Filters["countries"] = []; if (NL.test(t) || /\bNL\b/.test(original)) countries.push("NL"); if (DE.test(t) || /\bDE\b/.test(original)) countries.push("DE"); if (EU.test(t)) countries.push("EU");
  const sectors = sectorsIn(t); const themes = [...conceptsIn(original)].filter((c) => c !== "financing_gap");
  const pref = TYPE_RX.find(([, re]) => re.test(t))?.[0] ?? null;
  let soon: Filters["soon"] = null;
  if (/\bclos(es|ing)\b.*\bthis month\b|\bthis month\b.*\b(clos\w+|deadlines?)\b|\bdeadlines? this month\b/.test(t)) soon = { from: DATA_AS_OF, to: MONTH_END(DATA_AS_OF), label: "closing this month" };
  else if (/\bnext month\b/.test(t) && /\b(clos\w+|deadlines?)\b/.test(t)) soon = { from: DATA_AS_OF, to: addDays(MONTH_END(DATA_AS_OF), 31), label: "closing by the end of next month" };
  else if (/\b(closing soon|clos(es|ing) in|deadlines?( coming up)?|coming weeks|due soon|next (30|few) days|running out)\b/.test(t)) soon = { from: DATA_AS_OF, to: addDays(DATA_AS_OF, 45), label: "closing in the next 45 days" };
  const openNow = /\b(open now|currently open|still open|right now|whats open|what is open|open at the moment|available now)\b/.test(t);
  if (!countries.length && !sectors.length && !themes.length && !pref && !soon && !openNow) return null;
  return { countries, sectors, themes, pref, soon, openNow };
}
export const describe = (f: Filters) => [f.pref && { grants: "grants", tax: "tax incentives", loans: "loans and guarantees", equity: "equity" }[f.pref], f.countries.length && f.countries.map((c) => COUNTRY_NAME[c]).join(" and "), f.sectors.length && f.sectors.join(", "), f.themes.length && f.themes.map((x) => THEME_LABEL[x] ?? x.replace(/_/g, " ")).join(", "), f.soon?.label, f.openNow && "open now"].filter(Boolean).join(" · ");

const inCountry = (r: Scheme, c: Filters["countries"]) => !c.length || r.country.split("/").some((x) => c.includes(x as "NL")) || (c.includes("EU") && r.geo_scope === "eu");
/** "own" = tagged for the requested sector; "broad" = open to every sector. */
function fits(r: Scheme, f: Filters, ignoreType = false): "own" | "broad" | null {
  if (!NOW_STATUS.has(r.status_clean) && !(f.soon && r.closes_date)) return null;
  if (!inCountry(r, f.countries)) return null;
  if (f.soon && !(r.closes_date && r.closes_date >= f.soon.from && r.closes_date <= f.soon.to)) return null;
  if (f.themes.length && !f.themes.some((c) => hasTheme(r, c))) return null;
  if (!ignoreType && f.pref && !GROUPS[f.pref].includes(r.type_group)) return null;
  if (!f.sectors.length) return "own";
  const tags = r.sector.split(";").map((s) => s.trim()); if (tags.some((s) => f.sectors.includes(s))) return "own"; return tags.includes("All sectors") ? "broad" : null;
}
const statusText = (r: Scheme) => { const st = LABEL[r.status_clean] ?? r.status_clean; if (r.closes_date) { const n = daysBetween(DATA_AS_OF, r.closes_date); return n >= 0 ? `${st} · closes ${fmtDate(r.closes_date)} (${n} ${n === 1 ? "day" : "days"})` : `Closed ${fmtDate(r.closes_date)}`; } return st; };
const toItem = (r: Scheme): Item => ({ id: r.id, label: labelOf(r.id), meta: `${AS_COUNTRY(r.country)} · ${r.type_group}${r.geo_scope === "regional" ? " · regional" : ""}`, status: statusText(r), summary: shorten(sentence(tidy(r.summary)), 150), url: r.official_url });
const byDate = (a: Scheme, b: Scheme) => (a.closes_date ?? "9999").localeCompare(b.closes_date ?? "9999") || a.id.localeCompare(b.id);
const PER_GROUP = 6;

export interface BrowseResult { groups: Group[]; shown: number; total: number; others: number; asideText: string; asideChips: string[]; }
export function runBrowse(f: Filters): BrowseResult {
  const own = IN_SCOPE_ROWS.filter((r) => fits(r, f) === "own").sort(byDate); const broad = f.sectors.length ? IN_SCOPE_ROWS.filter((r) => fits(r, f) === "broad").sort(byDate) : [];
  const groups: Group[] = []; let truncated = 0;
  const push = (label: string, rows: Scheme[], note?: string) => { if (!rows.length) return; const items = rows.slice(0, PER_GROUP).map(toItem); truncated += rows.length - items.length; groups.push({ label, note, items }); };
  if (f.countries.length === 1) for (const c of CAT_ORDER) push(c, own.filter((r) => CATEGORY(r) === c));
  else for (const c of ["NL", "DE", "EU"]) push(COUNTRY_NAME[c], own.filter((r) => AS_COUNTRY(r.country) === c));
  push("Open to every sector", broad, `Not specific to ${f.sectors.join(" or ").toLowerCase()}. They are open to every sector; check each one's other conditions, such as region and company size.`);
  const others = SCHEMES.filter((r) => !inScope(r.id) && fits(r, f) !== null).length;
  // other kinds of funding that match everything except the requested type
  let asideText = ""; const asideChips: string[] = [];
  if (f.pref) {
    const extra = IN_SCOPE_ROWS.filter((r) => fits(r, f, true) && !GROUPS[f.pref!].includes(r.type_group)); const kinds = new Map<Pref, number>();
    for (const r of extra) for (const k of ["tax", "loans", "equity", "grants"] as Pref[]) if (k !== f.pref && GROUPS[k].includes(r.type_group) && !GROUPS[f.pref].includes(r.type_group)) { kinds.set(k, (kinds.get(k) ?? 0) + 1); break; }
    const nm: Record<Pref, string> = { grants: "grants", tax: "tax incentives", loans: "loans and guarantees", equity: "equity" }; const one: Record<Pref, string> = { grants: "grant", tax: "tax incentive", loans: "loan or guarantee", equity: "equity programme" }; const where = f.countries.length ? f.countries.map((c) => COUNTRY_NAME[c]).join(" and ") + " " : "";
    const parts = [...kinds].map(([k, n]) => `${n} ${n === 1 ? one[k] : nm[k]}`); const joined = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
    if (parts.length) { asideText = `I also cover ${joined} that ${extra.length === 1 ? "matches" : "match"}${f.sectors.length || f.themes.length ? " the rest of your question" : ""}. Ask for them by type to see them.`; for (const [k] of kinds) asideChips.push(`${where}${nm[k]}${f.sectors.length ? " for " + f.sectors[0].toLowerCase().replace(/ & .*/, "") : ""}`.replace(/^./, (c) => c.toUpperCase())); }
  }
  return { groups, shown: groups.reduce((n, g) => n + g.items.length, 0), total: own.length + broad.length, others, asideText, asideChips: asideChips.slice(0, 2) };
}
export function browseAnswer(f: Filters): Answer {
  const r = runBrowse(f); const blocks: Block[] = []; const what = describe(f);
  if (!r.shown) {
    // for a time window with nothing in it, show what closes next instead of a dead end
    if (f.soon) { const next = IN_SCOPE_ROWS.filter((x) => x.closes_date && x.closes_date >= DATA_AS_OF && fits(x, { ...f, soon: null }) === "own").sort(byDate).slice(0, 4);
      blocks.push({ t: "text", text: `None of the programmes I cover is ${f.soon.label}. ${next.length ? "These close next:" : ""}` }); if (next.length) blocks.push({ t: "list", groups: [{ label: "Closing next", items: next.map(toItem) }] }); }
    else blocks.push({ t: "text", text: `None of the programmes I cover matches: ${what}.` }, { t: "notice", text: BETA });
    if (r.others) blocks.push({ t: "list", groups: [], more: { text: `${r.others} matching programme${r.others === 1 ? "" : "s"} ${r.others === 1 ? "is" : "are"} in the database but not covered here yet. ${BETA}`, href: "/programmes", label: "Browse all programmes" } });
    blocks.push({ t: "chips", items: ["R&D funding", "What can you answer?", "Which programme fits my company?"] }); return { kind: "browse", ids: [], blocks };
  }
  const ownCount = r.groups.filter((g) => g.label !== "Open to every sector").reduce((n, g) => n + g.items.length, 0);
  blocks.push({ t: "text", text: f.sectors.length && !ownCount ? `None of the programmes I cover is specific to ${f.sectors.join(" or ")}. These are open to every sector, so they may still apply (check each one's other conditions). Dates are as of ${fmtDate(DATA_AS_OF)}.` : `${r.total} programme${r.total === 1 ? "" : "s"} I cover ${r.total === 1 ? "matches" : "match"}: ${what || "everything open now"}. Dates are as of ${fmtDate(DATA_AS_OF)}.` });
  const hidden = r.total - r.shown; const more = r.others ? { text: `${r.others} more matching programme${r.others === 1 ? " is" : "s are"} in the database but not covered here yet. ${BETA}`, href: "/programmes", label: "Browse all programmes" } : hidden ? { text: `${hidden} more match. Narrow by country, type or sector to see them.`, href: "", label: "" } : undefined;
  blocks.push({ t: "list", groups: r.groups, ...(more ? { more } : {}) });
  if (r.asideText) blocks.push({ t: "text", text: r.asideText });
  const firstIds = r.groups.flatMap((g) => g.items).slice(0, 2).map((i) => i.id);
  blocks.push({ t: "chips", items: [...firstIds.map((id) => `What documents do I need for ${labelOf(id)}?`), ...r.asideChips, "Which programme fits my company?"].slice(0, 4) });
  return { kind: "browse", ids: firstIds, blocks };
}
