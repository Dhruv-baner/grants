// Company website text: robots.txt respected, page and size caps. Mirrors pipeline/fetch.py.
import * as cheerio from "cheerio";
import { httpGet, UA, validateUrl, UnsafeUrl, type GetOpts } from "./ssrf";

export const MAX_PAGES = 5, MAX_CHARS = 16000;
// One page per kind, in this order, before any repeat: about, what they sell, research, careers, news and reports.
const CATS = [/about|over-ons|ueber|über|company|unternehmen|bedrijf|who-we-are|team/i, /product|producten|service|diensten|leistung|solution|oplossing|technolog|branche|sector|industr/i, /research|innovat|r-d|forschung|onderzoek/i, /career|jobs|vacatur|karriere|stellen/i, /news|nieuws|press|investor|sustainab|duurzaam|nachhaltig|annual|jaarverslag|geschaeftsbericht|projects|cases/i];
export interface Site { url: string; pages: string[]; text: string; }
export type Getter = (url: string) => Promise<{ text: string; finalUrl: string }>;

export function robotsAllows(robotsTxt: string, path: string, ua = UA): boolean {
  const name = (/compatible;\s*([^\/\s;]+)/i.exec(ua)?.[1] ?? ua.split("/")[0]).toLowerCase(); const groups: { agents: string[]; rules: [boolean, string][] }[] = []; let cur: (typeof groups)[number] | null = null; let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim(); const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") { if (!lastWasAgent || !cur) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasAgent = true; }
    else { lastWasAgent = false; if (cur && (k === "allow" || k === "disallow")) cur.rules.push([k === "allow", v]); }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && name.includes(a)));
  const use = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  let best: [boolean, number] | null = null;
  for (const g of use) for (const [allow, p] of g.rules) { if (!p) continue; if (path.startsWith(p) && (!best || p.length > best[1] || (p.length === best[1] && allow))) best = [allow, p.length]; }
  return best ? best[0] : true;
}
/** Email addresses and phone numbers are not needed to profile a company, so they are removed before the text goes anywhere. */
const scrub = (t: string) => t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "").replace(/\b(?:tel(?:efoon|efon)?|phone|fax|mobile|mob)\s*[:.]?\s*\+?\d[\d\s().\/-]{6,}/gi, "").replace(/ {2,}/g, " ");
const PER_PAGE = 5000;
/** The company data a site publishes about itself in its page (schema.org), which usually states the address even when the visible text does not. */
function orgFacts($: cheerio.CheerioAPI): string {
  const out: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { const j = JSON.parse($(el).html() ?? ""); const nodes: any[] = Array.isArray(j) ? j : Array.isArray(j?.["@graph"]) ? j["@graph"] : [j];
      for (const n of nodes) { if (!n || typeof n !== "object") continue; if (!/Organization|Corporation|Business|Company/i.test([n["@type"] ?? ""].flat().join(" "))) continue;
        const a = n.address && typeof n.address === "object" ? n.address : {}; const country = typeof a.addressCountry === "object" ? a.addressCountry?.name : a.addressCountry;
        const where = [a.streetAddress, a.postalCode, a.addressLocality, a.addressRegion, country].filter((x) => typeof x === "string" && x).join(", "); const e = n.numberOfEmployees; const emp = e && typeof e === "object" ? (e.value ?? e.minValue) : e;
        const parts = [typeof n.name === "string" && n.name && `Organization: ${n.name}`, where && `Address: ${where}`, emp && (typeof emp === "number" || typeof emp === "string") && `Employees: ${emp}`, typeof n.foundingDate === "string" && n.foundingDate && `Founded: ${n.foundingDate}`].filter(Boolean);
        if (parts.length) out.push(parts.join(". ")); } } catch { /* not JSON */ }
  });
  return [...new Set(out)].slice(0, 2).join(" | ").slice(0, 600);
}
export function extractText(html: string): string {
  const $ = cheerio.load(html); const title = $("title").first().text().trim(); const desc = ($('meta[name="description"]').attr("content") ?? "").trim(); const brand = ($('meta[property="og:site_name"]').attr("content") ?? "").trim();
  const org = orgFacts($), footer = $("footer").first().text().replace(/\s+/g, " ").trim().slice(0, 400); // the footer is where an address usually is, so a short slice is kept, last
  $("script,style,noscript,nav,footer,header,form,svg,iframe").remove();
  const body = $("body").text().replace(/\s+/g, " ").trim().slice(0, PER_PAGE);
  return scrub([title, brand && brand !== title ? brand : "", desc, org, body, footer && `Footer: ${footer}`].filter(Boolean).join(" | "));
}
export function pickLinks(html: string, baseUrl: string, limit = 2): string[] {
  const $ = cheerio.load(html); const host = new URL(baseUrl).host; const seen = new Set<string>(); const cands: { s: string; cat: number }[] = [];
  $("a[href]").each((_, a) => {
    try { const u = new URL($(a).attr("href")!, baseUrl); u.hash = ""; const s = u.toString(); if (u.host !== host || s === baseUrl || seen.has(s)) return;
      const cat = CATS.findIndex((re) => re.test(u.pathname + " " + $(a).text())); if (cat >= 0) { seen.add(s); cands.push({ s, cat }); } } catch { /* bad href */ }
  });
  const out: string[] = []; for (let c = 0; c < CATS.length && out.length < limit; c++) { const hit = cands.find((x) => x.cat === c); if (hit) out.push(hit.s); }
  for (const x of cands) { if (out.length >= limit) break; if (!out.includes(x.s)) out.push(x.s); } return out;
}
export type SiteErrorCode = "blocked" | "not_found" | "timeout" | "dns" | "tls" | "server" | "robots" | "too_little_text" | "not_html" | "other";
/** Why a site could not be read, so the person is told the reason and what to do instead. */
export class SiteError extends Error { constructor(public code: SiteErrorCode, message: string) { super(message); } }
export function classify(e: unknown): SiteError {
  if (e instanceof SiteError) return e; const m = String((e as Error)?.message ?? e);
  const code: SiteErrorCode = /^HTTP (401|403|406|429|451)\b/.test(m) ? "blocked" : /^HTTP (404|410)\b/.test(m) ? "not_found" : /^HTTP 5\d\d/.test(m) ? "server" : /timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(m) ? "timeout"
    : /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m) ? "dns" : /certificate|CERT_|SSL|TLS|self[- ]signed|UNABLE_TO_VERIFY/i.test(m) ? "tls" : /unsupported content type/i.test(m) ? "not_html" : /robots/i.test(m) ? "robots" : "other";
  return new SiteError(code, m);
}
export async function fetchCompany(rawUrl: string, get: Getter = (u) => httpGet(u)): Promise<Site> {
  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? rawUrl : "https://" + rawUrl; const u0 = validateUrl(url);
  const robotsOf = new Map<string, Promise<string | null>>(); // robots.txt is read once per host, not once per page
  const robots = (t: URL) => { const k = `${t.protocol}//${t.host}`; let p = robotsOf.get(k); if (!p) { p = get(`${k}/robots.txt`).then((r) => r.text as string | null, (e) => { if (e instanceof UnsafeUrl) throw e; return null; }); robotsOf.set(k, p); } return p; };
  const allowed = async (target: string) => { const t = new URL(target); const txt = await robots(t); return txt === null ? true : robotsAllows(txt, t.pathname + t.search); };
  if (!(await allowed(u0.toString()))) throw new SiteError("robots", "robots.txt disallows fetching this site");
  let first: { text: string; finalUrl: string }; try { first = await get(u0.toString()); } catch (e) { if (e instanceof UnsafeUrl) throw e; throw classify(e); }
  const pages = [first.finalUrl], texts = [extractText(first.text)];
  const got = await Promise.all(pickLinks(first.text, first.finalUrl, MAX_PAGES - 1).map(async (l) => { try { return (await allowed(l)) ? await get(l) : null; } catch { return null; } })); // the other pages are read side by side, in the order chosen
  for (const r of got) if (r) { pages.push(r.finalUrl); texts.push(extractText(r.text)); }
  const text = texts.join(" \n").slice(0, MAX_CHARS);
  if (text.replace(/[\s|]+/g, "").length < 200) throw new SiteError("too_little_text", "the pages hold almost no readable text");
  return { url: first.finalUrl, pages, text };
}
