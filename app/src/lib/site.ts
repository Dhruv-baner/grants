// Company website text: robots.txt respected, page and size caps. Mirrors pipeline/fetch.py.
import * as cheerio from "cheerio";
import { httpGet, UA, validateUrl, UnsafeUrl, type GetOpts } from "./ssrf";

export const MAX_PAGES = 5, MAX_CHARS = 16000;
// One page per kind, in this order, before any repeat: about, what they sell, research, careers, news and reports.
const CATS = [/about|over-ons|ueber|über|company|unternehmen|bedrijf|who-we-are|team/i, /product|producten|service|diensten|leistung|solution|oplossing|technolog|branche|sector|industr/i, /research|innovat|r-d|forschung|onderzoek/i, /career|jobs|vacatur|karriere|stellen/i, /news|nieuws|press|investor|sustainab|duurzaam|nachhaltig|annual|jaarverslag|geschaeftsbericht|projects|cases/i];
export interface Site { url: string; pages: string[]; text: string; }
export type Getter = (url: string) => Promise<{ text: string; finalUrl: string }>;

export function robotsAllows(robotsTxt: string, path: string, ua = UA): boolean {
  const name = ua.split("/")[0].toLowerCase(); const groups: { agents: string[]; rules: [boolean, string][] }[] = []; let cur: (typeof groups)[number] | null = null; let lastWasAgent = false;
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
export function extractText(html: string): string {
  const $ = cheerio.load(html); const title = $("title").first().text().trim(); const desc = ($('meta[name="description"]').attr("content") ?? "").trim();
  $("script,style,noscript,nav,footer,header,form,svg,iframe").remove();
  const body = $("body").text().replace(/\s+/g, " ").trim();
  return [title, desc, body].filter(Boolean).join(" | ");
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
export async function fetchCompany(rawUrl: string, get: Getter = (u) => httpGet(u)): Promise<Site> {
  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? rawUrl : "https://" + rawUrl; const u0 = validateUrl(url);
  const allowed = async (target: string) => { const t = new URL(target);
    try { const r = await get(`${t.protocol}//${t.host}/robots.txt`); return robotsAllows(r.text, t.pathname + t.search); } catch (e) { if (e instanceof UnsafeUrl) throw e; return true; } };
  if (!(await allowed(u0.toString()))) throw new Error("robots.txt disallows fetching this site");
  const first = await get(u0.toString()); const pages = [first.finalUrl]; const texts = [extractText(first.text)];
  for (const link of pickLinks(first.text, first.finalUrl, MAX_PAGES - 1)) {
    try { if (await allowed(link)) { const r = await get(link); pages.push(r.finalUrl); texts.push(extractText(r.text)); } } catch (e) { if (e instanceof UnsafeUrl) continue; }
  }
  return { url: first.finalUrl, pages, text: texts.join(" \n").slice(0, MAX_CHARS) };
}
