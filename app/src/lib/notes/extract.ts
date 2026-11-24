// Turns what was said in a call into structured notes using plain rules, so it works instantly, offline and without a key.
// Every fact and key point carries the exact passage it came from; anything not said stays out ("not mentioned").
import { COUNTRY_RX, SECTOR_RULES } from "../assistant/profileFromText";
import { ALIAS_LIST, KIND_OF, inScope, labelOf } from "../assistant/knowledge";
import { norm, scan } from "../assistant/text";
import cfg from "../matcher-config.json";
import { findAmounts, formatEur, NUMBER_WORDS, sizeBand, wordsToNumber, type Amount } from "./numbers";
import type { Fact, FactKey, KeyPoint, NextStep, NoteResult, OpenQuestion, Ordered, ProgRef } from "./types";

const W = NUMBER_WORDS.join("|"); const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const SENT_END = /[.!?\n;]/;
const CH = String.raw`(?:[^.;\n]|\.(?!\s|$))`; const STOP = String.raw`(?:\.(?=\s|$)|[;\n]|$)`; // a "." inside 1.2 is not the end of a clause
const isEnd = (t: string, i: number) => (t[i] === "." ? i + 1 >= t.length || /\s/.test(t[i + 1]) : SENT_END.test(t[i]));
const MONTHS = "january|february|march|april|june|july|august|september|october|november|december"; const MAYM = String.raw`(?<=\b(?:in|by|before|from|during|until|till|after|of)\s)may`; const DAYS = "monday|tuesday|wednesday|thursday|friday|saturday|sunday";
const WHEN = String.raw`(?:spring|summer|autumn|fall|winter|q[1-4]|(?:the )?(?:first|second|third|fourth) quarter|(?:the )?(?:beginning|start|middle|end) of (?:next |this )?(?:year|month|quarter|${MONTHS}|spring|summer|autumn|winter)|(?:${MONTHS}|${MAYM})(?:\s+20\d\d)?|next (?:week|month|quarter|year)|early next year|20\d\d)`;
const COUNTRY_NAME: Record<string, string> = { NL: "the Netherlands", DE: "Germany", EU: "the EU", OTHER: "a country outside the EU" };
const SECTOR_NOUN: Record<string, string> = { "Industry & manufacturing": "manufacturing company", "Digital, AI & ICT": "digital company", "Health & life sciences": "health company", "Agriculture & food": "food company", "Buildings & real estate": "construction or property company", "Transport & maritime": "transport company", "Circular economy & environment": "recycling or environmental company", "Energy & climate": "energy company", "Creative, media & games": "creative company", "Defence & security": "defence company", "Education & skills": "education organisation", "Public sector & municipalities": "public-sector organisation" };

/** A passage of the transcript around a match, widened to the clause and trimmed to a few words each side. Always an exact substring. */
export function span(t: string, index: number, length: number, before = 8, after = 9): string {
  let s = index, e = index + length;
  while (s > 0 && !isEnd(t, s - 1)) s--; while (e < t.length && !isEnd(t, e)) e++;
  const seg = t.slice(s, e); const ms = index - s, me = index + length - s; const words = [...seg.matchAll(/\S+/g)];
  if (!words.length) return t.slice(index, index + length).trim();
  let i0 = words.findIndex((w) => w.index! + w[0].length > ms); if (i0 < 0) i0 = 0; let i1 = words.findIndex((w) => w.index! >= me); if (i1 < 0) i1 = words.length;
  const a = Math.max(0, i0 - before), b = Math.min(words.length, Math.max(i1, i0 + 1) + after);
  return seg.slice(words[a].index!, words[b - 1].index! + words[b - 1][0].length).replace(/[,\s]+$/, "").trim();
}
/** Dictation hears "W B S O"; join spaced single letters back into one word. */
export const fixAcronyms = (t: string) => t.replace(/\b(?:[a-z]\s){2,5}[a-z]\b/gi, (m) => m.replace(/\s/g, ""));
const NUMTOK = String.raw`(?:\d[\d,.]*|(?:(?:${W})[\s-]+(?:and\s+)?)*(?:${W}))`;
/** The client says "our"; the note says "their". */
const third = (s: string) => s.replace(/\bour\b/gi, "their").replace(/\bwe\b/gi, "they").replace(/\bmy\b/gi, "their").replace(/\bus\b/gi, "them");
const tidyStep = (s: string) => cap(s.replace(/^(?:a|an|the)\s+/i, "").replace(/\bfollow up\b/gi, "follow-up").replace(new RegExp(String.raw`\b(${DAYS}|${MONTHS})\b`, "gi"), (d) => cap(d.toLowerCase())));
const trimTail = (s: string) => s.replace(/\s+(?:for|at|with|of|to|and|in|on|by)$/i, "");
const monthCase = (s: string) => s.replace(new RegExp(String.raw`\b(${MONTHS}|may)\b`, "gi"), (m) => (m.toLowerCase() === "may" && !/\bmay\b/.test(m) ? m : cap(m.toLowerCase())));
const noYou = (s: string) => s.replace(/\b(send|email|call|share|forward|give|show|ring)\s+you\s+/i, "$1 ").replace(/\bcall you\b/i, "call");
const withThe = (v: string) => (/^(?:the|our|their)\b/i.test(v) || /[A-Z]/.test(v.slice(1)) ? v : `the ${v}`);
const first = (re: RegExp, t: string) => { const m = new RegExp(re.source, re.flags.replace("g", "")).exec(t); return m ? { m, index: m.index, length: m[0].length } : null; };

function findEmployees(t: string): { value: number; quote: string } | null {
  const res = [new RegExp(String.raw`\b(${NUMTOK})[\s-]*(?:person|people|employees|staff|fte|workers|colleagues)\b`, "gi"), new RegExp(String.raw`\b(?:team|staff|workforce|headcount|company|firm) of (?:about |around |roughly |some )?(${NUMTOK})\b`, "gi"), new RegExp(String.raw`\b(?:employ|employs|employing)\s+(?:about |around |roughly |approximately |over |some )?(${NUMTOK})\b`, "gi")];
  for (const [k, re] of res.entries()) for (const m of t.matchAll(re)) {
    const before = t.slice(Math.max(0, m.index! - 40), m.index!).trimEnd();
    if (k === 0 && !/(?:\b(?:we|our|company|firm|business|team|about|around|roughly|approximately|just|only|with|have|had|employ\w*|re|are|is|a|an|over|some)|[.!?])$/i.test(before)) continue;
    const v = wordsToNumber(m[1]); if (v !== null && v >= 1 && v < 1_000_000) return { value: v, quote: span(t, m.index!, m[0].length, 4, 6) };
  } return null;
}
const COMPANY_LEAD = String.raw`(?:[Ii]['’]m with|[Ii] am with|[Cc]alling from|[Cc]ompany is called|[Ww]e(?:['’]re| are) called|[Cc]alled|[Nn]amed|[Cc]lient is|[Ii] work (?:at|for)|[Ii]['’]m from)`;
const NOT_A_NAME = /^(?:the|a|an|i|we|very|really|just|also|not|still|currently|looking|planning|based|located|interested|hoping|trying|working|here|happy|excited|sorry|glad|calling|thinking|going)\b/i;
function findCompany(t: string): { value: string; quote: string } | null {
  const lead = String.raw`(?:${COMPANY_LEAD}|[Ww]e(?:['’]re| are))`;
  const re = new RegExp(String.raw`\b${lead}\s+(\p{Lu}[\p{L}\p{N}&.'’-]*(?:\s+\p{Lu}[\p{L}\p{N}&.'’-]*){0,3})`, "gu");
  for (const m of t.matchAll(re)) { const name = m[1].replace(/[.,]+$/, ""); const lc = name.toLowerCase();
    if (name.length < 2 || NOT_A_NAME.test(name) || COUNTRY_RX.NL.test(lc) || COUNTRY_RX.DE.test(lc) || COUNTRY_RX.EU.test(lc) || COUNTRY_RX.OTHER.test(lc)) continue; return { value: name, quote: span(t, m.index!, m[0].length, 3, 6) }; }
  return null;
}
function findCountry(lc: string) {
  const hit = (re: RegExp) => { const m = new RegExp(re.source).exec(lc); return m ? { index: m.index, length: m[0].length } : null; };
  const nl = hit(COUNTRY_RX.NL), de = hit(COUNTRY_RX.DE);
  if (nl || de) return nl && (!de || nl.index <= de.index) ? { code: "NL", ...nl } : { code: "DE", ...de! };
  const other = hit(COUNTRY_RX.OTHER); if (other) return { code: "OTHER", ...other }; const eu = hit(COUNTRY_RX.EU); return eu ? { code: "EU", ...eu } : null;
}
const REGIONS = Object.entries(cfg.REGIONS as Record<string, string[]>);
function findRegion(lc: string) { let best: { canon: string; index: number; length: number } | null = null;
  for (const [canon, aliases] of REGIONS) for (const a of aliases) { const m = new RegExp("\\b" + esc(a) + "\\b").exec(lc); if (m && (!best || m.index < best.index)) best = { canon, index: m.index, length: m[0].length }; } return best; }

const PROJECT_VERBS = String.raw`replace|install|buy|purchase|build|upgrade|invest(?:\s+in)?|switch|move|expand|develop|retrofit|insulate|electrify|hire|launch|set up|acquire|renovate|modernise|modernize|automate|digitali[sz]e|decarboni[sz]e|open|create|add`;
const PROJECT_RE = new RegExp(String.raw`\b(?:want|wants|plan|plans|planning|intend|intends|looking|hope|hopes|aim|aims|need|needs|would like|['’]d like|going|decided|considering|thinking)(?:\s+(?:money|funding|finance|financing|a loan|a grant|support|capital))?\s*(?:to|of)?\s*(?:about\s+)?(?:to\s+)?(${PROJECT_VERBS})\b\s*(${CH}{2,110}?)(?=\s+and\s+(?:we|they|it|the|our|then|also|i)\b|\s+(?:but|so|because|which|that|they|we|it|at a cost|for around|costing|budget)\b|,?\s+(?:maybe|perhaps|probably|possibly|around|about|roughly|approximately)\s+(?:€|\d|${W}|a hundred)|${STOP})`, "i");
const PROJECT_NOUN_RE = new RegExp(String.raw`\b(?:planning|plans|intend\w*|considering)\s+((?:a|an|the|our)\s+${CH}{3,100}?)(?=\s+and\s+(?:we|they|it|the|our|then|also|i)\b|\s+(?:but|so|because|which|that|they|we|it|at a cost|for around|costing|budget)\b|,?\s+(?:maybe|perhaps|probably|possibly|around|about|roughly|approximately)\s+(?:€|\d|${W}|a hundred)|${STOP})`, "i");
const ACTIVITY_RES = [
  new RegExp(String.raw`\b(?:we['’]re|we are|i['’]m|i am|they['’]re|they are|it['’]s|it is)\s+(?:a|an)\s+((?:[\w-]+\s+){0,3}?(?:manufacturer|fabricator|producer|company|firm|business|startup|start-up|bakery|brewery|supplier|developer|agency|farm|plant|shop|studio|platform|distributor|contractor|consultancy|retailer|wholesaler))(?=\s|[.,;]|$)`, "i"),
  new RegExp(String.raw`\b(?:we|they|i['’]m|i am|the company|the firm)\s+(?:also\s+)?((?:make|manufacture|build|produce|sell|develop|run|operate|provide|offer|supply|distribute|design|install|process|recycle|grow|brew|bake)(?:s|ing)?\s+[^.;,\n]{3,70}?)(?=\s+(?:and|but|so|because|in|at|with|we|they)\s|[.;,\n]|$)`, "i"),
];
const AFFIRM = String.raw`(?:ordered|signed|bought|purchased|started|committed|placed|booked|begun|installed)`;
const ORDER_NEG = [new RegExp(String.raw`\b(?:haven['’]t|have not|hasn['’]t|has not|didn['’]t|did not|not yet|never|yet to|still need to)\s+(?:\w+\s+){0,2}?${AFFIRM.replace("ordered", "ordered|order|sign|start|commit")}\b`, "i"), new RegExp(String.raw`\bnothing\s+(?:has\s+|is\s+|was\s+|['’]s\s+)?(?:been\s+)?(?:\w+\s+){0,3}?${AFFIRM}\b`, "i"), /\b(?:no|not any)\s+(?:order|contract|commitment|purchase)s?\s+(?:has\s+|have\s+)?(?:been\s+)?(?:placed|signed|made)?/i];
const ORDER_POS = [new RegExp(String.raw`\b(?:already|we['’]ve|they['’]ve|we have|they have|has|have|just|recently)\s+(?:\w+\s+){0,3}?${AFFIRM}\b`, "i"), /\border\b[^.;\n]{0,50}?\b(?:was|has been|is)\s+(?:already\s+)?placed\b/i, /\bsigned\s+(?:the|a|our|their)\s+(?:contract|order|quote|agreement)\b/i, /\b(?:work|construction|installation)\s+(?:has\s+|had\s+)?(?:already\s+)?(?:started|begun)\b/i];
const NEXT_RES = [new RegExp(String.raw`\bnext\s+steps?\s+(?:is|are|will be|would be)?\s*(?:to\s+)?(${CH}{4,90}?)(?=${STOP}|\s+(?:and then|then)\b)`, "i"), new RegExp(String.raw`\b(?:i|we)(?:['’]ll| will| shall| are going to)\s+((?:send|call|email|share|prepare|check|follow up|schedule|set up|book|come back|get back|review|draft|introduce|forward)\b${CH}{0,80}?)(?=${STOP}|\s+and\s+(?:then|we|i)\b)`, "i"), new RegExp(String.raw`\b(follow[- ]?up\s+(?:call|meeting|session|email)\b${CH}{0,50}?)(?=${STOP}|\s+and\b)`, "i")];
const WHEN_IN_STEP = new RegExp(String.raw`\b(${DAYS}|tomorrow|next week|next month|end of the week|end of (?:the )?month|(?:${MONTHS})\s+\d{1,2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:${MONTHS}))\b`, "i");
const UNSURE = /\b(?:not sure|don['’]t know|do not know|haven['’]t decided|have not decided|still deciding|undecided|unclear|not certain|need to (?:check|find out|figure out|decide)|we['’]ll see|tbd|to be decided|wondering)\b([^.;\n]{0,90})/gi;

function pickAmount(t: string, anchor: number | null): Amount | null {
  const list = findAmounts(t); if (!list.length) return null;
  const scored = list.map((a) => { const ctx = t.slice(Math.max(0, a.index - 70), a.index + a.length + 50).toLowerCase(); let s = 0;
    if (/\b(invest\w*|cost\w*|spend\w*|replace|install\w*|buy|purchase|build\w*|upgrade|order\w*|project|plant|machine\w*|equipment|hall|pilot|capex|worth|plan\w*|need\w*|funding|hire|hiring|loan|grant)\b/.test(ctx)) s += 2;
    if (/\b(revenue|turnover|sales|salary|salaries|valuation|raised|funding round|r&d budget|annual budget|profit|loss|debt|received|previous\w*)\b/.test(ctx)) s -= 3; if (anchor !== null && Math.abs(a.index - anchor) < 140) s += 1; return { a, s }; });
  scored.sort((x, y) => y.s - x.s || x.a.index - y.a.index); return scored[0].s > -3 ? scored[0].a : null;
}
function findTiming(t: string): { value: string; quote: string; start: boolean } | null {
  const re = new RegExp(String.raw`(?:\b(?:in|by|before|from|during|around|for|until|till|after|at|on|within)\s+(?:the\s+)?)?\b${WHEN}\b`, "gi"); const hits = [...t.matchAll(re)]; if (!hits.length) return null;
  const near = (m: RegExpMatchArray) => /\b(start\w*|begin\w*|kick\w*|install\w*|replace\w*|launch\w*|order\w*|ready|live|complete\w*|finish\w*|aim\w*|plan\w*|want\w*|hope\w*|deliver\w*|supplier|'d like|would like|go live|deadline|by|before)\b/i.test(t.slice(Math.max(0, m.index! - 70), m.index! + m[0].length + 30));
  let chosen = hits.find(near) ?? hits[0];
  const fix = /\b(?:actually|make that|i mean|sorry|rather|no wait|correction)\b/i; // "actually, summer": the later value wins
  const cue = fix.exec(t.slice(chosen.index!)); if (cue) { const after = chosen.index! + cue.index; const next = hits.find((m) => m.index! > after); if (next) chosen = next; }
  const q = span(t, chosen.index!, chosen[0].length, 7, 6); return { value: chosen[0].trim(), quote: q, start: /\b(start\w*|begin\w*|kick\w*|go live)\b/i.test(q) };
}
function findProgrammes(t: string): ProgRef[] {
  const found = new Map<string, number>(); const nt = norm(fixAcronyms(t));
  for (const h of scan(nt, ALIAS_LIST)) { const kind = KIND_OF.get(h.key + "|" + h.alias); if ((kind === "in" || kind === "out") && !found.has(h.key)) found.set(h.key, found.size); }
  const lc = t.toLowerCase(); const out: ProgRef[] = [];
  for (const id of found.keys()) { const aliases = ALIAS_LIST.filter((a) => a.key === id).map((a) => a.alias); let q: string | null = null;
    for (const a of aliases) { const toks = a.split(" "); const re = new RegExp("\\b" + (toks.length === 1 && /^[a-z]{2,6}$/.test(a) ? a.split("").join("[\\s.-]?") : toks.map(esc).join("[^a-z0-9]+")) + "\\b", "i"); const m = re.exec(t) ?? re.exec(lc); if (m) { q = span(t, m.index, m[0].length, 6, 6); break; } }
    out.push({ id, label: labelOf(id), covered: inScope(id), quote: q }); }
  return out;
}
const GAPS: [FactKey | "ordered2", string][] = [["ordered", "Has anything been ordered, signed or started yet?"], ["amount", "What is the expected budget for the project?"], ["timing", "When should the project start?"], ["decision", "Who decides, and how does approval work?"], ["country", "Where is the company based?"], ["size", "How many people does the company employ?"], ["previous", "Has the company received grants or subsidies before?"]];

export function extractNotes(transcript: string): NoteResult {
  const t = (transcript ?? "").replace(/\r/g, "").trim(); const lc = t.toLowerCase(); const facts: NoteResult["facts"] = {}; const nums: NoteResult["nums"] = {};
  const put = (k: FactKey, value: string, quote: string | null, how: Fact["how"] = "stated") => { facts[k] = { value, quote, how }; };
  const comp = findCompany(t); if (comp) put("company", comp.value, comp.quote);
  const web = first(/\b((?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*\.(?:com|nl|de|eu|org|net|io|co\.uk|be|fr)(?:\/[^\s,;]*)?)/i, t); if (web) put("website", web.m[1], span(t, web.index, web.length, 3, 3));
  const reg = findRegion(lc); const cty = findCountry(lc);
  if (cty) put("country", cty.code, span(t, cty.index, cty.length, 5, 5)); if (reg) put("region", reg.canon, span(t, reg.index, reg.length, 5, 5));
  const emp = findEmployees(t); if (emp) { nums.employees = emp.value; put("size", sizeBand(emp.value), emp.quote, "inferred"); }
  const secs = SECTOR_RULES().filter(([re]) => new RegExp(re.source, "i").test(lc)).map(([, s]) => s).slice(0, 2);
  if (secs.length) { const m = new RegExp(SECTOR_RULES().find(([, s]) => s === secs[0])![0].source, "i").exec(lc)!; put("sector", secs.join("; "), span(t, m.index, m[0].length, 5, 5), "inferred"); }
  let act: { value: string; quote: string } | null = null;
  for (const re of ACTIVITY_RES) { const r = first(re, t); if (r) { act = { value: r.m[1].replace(/\b\d[\d,]*[\s-]*(?:person|people)\s*/gi, "").trim(), quote: span(t, r.index, r.length, 3, 5) }; break; } }
  if (act && act.value) put("activity", third(act.value), act.quote);
  const pj = first(PROJECT_RE, t); const pn = pj ? null : first(PROJECT_NOUN_RE, t); let anchor: number | null = null;
  if (pj) { anchor = pj.index; put("project", trimTail(third(`${pj.m[1].replace(/\s+/g, " ")} ${pj.m[2]}`.trim())), span(t, pj.index, pj.length, 3, 2)); }
  else if (pn) { anchor = pn.index; put("project", trimTail(third(pn.m[1].replace(/\s+/g, " ").trim())), span(t, pn.index, pn.length, 3, 2)); }
  const amt = pickAmount(t, anchor); if (amt) { nums.amountEur = amt.value; put("amount", formatEur(amt.value), span(t, amt.index, amt.length, 7, 5)); }
  const tm = findTiming(t); if (tm) put("timing", monthCase(tm.value), tm.quote);
  let ordered: Ordered = "unknown";
  const all = (res: RegExp[]) => res.flatMap((re) => [...t.matchAll(new RegExp(re.source, "gi"))].map((m) => ({ index: m.index!, length: m[0].length }))).sort((x, y) => x.index - y.index);
  const negs = all(ORDER_NEG); const poss = all(ORDER_POS).filter((p) => !negs.some((n) => p.index < n.index + n.length && n.index < p.index + p.length));
  if (poss.length) { ordered = "yes"; put("ordered", "Yes", span(t, poss[0].index, poss[0].length, 3, 6)); }
  else if (negs.length) { ordered = "no"; put("ordered", "No", span(t, negs[0].index, negs[0].length, 3, 5)); }
  const pneg = first(new RegExp(String.raw`\b(?:never|haven['’]t|have not|not)\s+(?:\w+\s+){0,3}?(?:applied|received|got|had|used)\s+(?:for\s+)?(?:any\s+)?(?:grants?|subsid\w+|funding|loans?|support|wbso|eia)\b`, "i"), t);
  const ppos = first(new RegExp(String.raw`\b(?:received|got|had|used|were awarded|won)\s+(?:(?:a|an|the|some|our|\w+)\s+){0,2}(?:grants?|subsid\w+|funding|loans?|wbso|eia|mia|innovation credit)\b`, "i"), t);
  if (pneg) put("previous", "None mentioned", span(t, pneg.index, pneg.length, 3, 4)); else if (ppos) put("previous", ppos.m[0].replace(/\s+/g, " "), span(t, ppos.index, ppos.length, 4, 4));
  const d1 = first(new RegExp(String.raw`\b(?:decision|decisions|sign-?off|approval|budget)\s+(?:sits|lies|rests|is|comes|stays)?\s*(?:with|from|by)\s+(?:the\s+|our\s+|their\s+)?([a-z][a-z'’ -]{2,40}?)(?=\s+(?:and|but|so|who|which|next|then|they|we|it|also|i)\b|[.,;\n]|$)`, "i"), t);
  const d2 = first(new RegExp(String.raw`\b(?:our|the|their|my)\s+((?:cfo|ceo|cto|coo|finance director|managing director|owner|founder|board|head of [a-z]+|director of [a-z]+|chief [a-z]+ officer|procurement manager|plant manager)(?:,?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)?),?\s+(?:makes|take|takes|decides|will decide|signs off|approves|has the final say)`, "i"), t);
  const dm = d1 ?? d2; if (dm) put("decision", third(dm.m[1].replace(/\s+/g, " ").trim()), span(t, dm.index, dm.length, 4, 4));
  const programmes = findProgrammes(t);
  const nextSteps: NextStep[] = []; const seen: [number, number][] = [];
  for (const re of NEXT_RES) for (const m of t.matchAll(new RegExp(re.source, "gi"))) { const a = m.index!, b = a + m[0].length; if (seen.some(([x, y]) => a < y && x < b) || nextSteps.length >= 4) continue; seen.push([a, b]);
    const what = m[1].replace(/\s+/g, " ").trim(); const w = WHEN_IN_STEP.exec(m[0]); nextSteps.push({ what: tidyStep(noYou(third(what))), ...(w ? { when: cap(w[1]) } : {}), quote: span(t, a, m[0].length, 2, 3) }); }
  const openQuestions: OpenQuestion[] = []; for (const m of t.matchAll(UNSURE)) if (openQuestions.length < 3) openQuestions.push({ text: cap(third(m[0].replace(/\s+/g, " ").trim())), kind: "said", quote: span(t, m.index!, m[0].length, 2, 3) });
  for (const [k, q] of GAPS) { if (openQuestions.length >= 6 || !Object.keys(facts).length) break; if (!facts[k as FactKey] && !(k === "country" && facts.region)) openQuestions.push({ text: q, kind: "gap" }); }

  const kp: KeyPoint[] = []; const add = (text: string, quote: string | null | undefined) => { if (quote && kp.length < 7) kp.push({ text, quote }); };
  const band = facts.size?.value; const place = facts.region?.value ?? (cty ? COUNTRY_NAME[cty.code] : undefined);
  const verbish = !!act && /^(?:\w+ing|makes?|manufactures?|builds?|produces?|sells?|develops?|runs?|operates?|provides?|offers?|suppl(?:y|ies)|distributes?|designs?|installs?|process(?:es)?|recycles?|grows?|brews?|bakes?)\b/i.test(act.value);
  const sectorNoun = secs[0] ? SECTOR_NOUN[secs[0]] : undefined;
  const noun = act ? (verbish ? `${sectorNoun ?? "company"} ${act.value}` : act.value.replace(/^(?:a|an)\s+/i, "")) : sectorNoun ?? (comp || band || place ? "company" : undefined);
  const staff = nums.employees ? ` (about ${nums.employees.toLocaleString("en-GB")} staff)` : ""; const planWord = (v: string) => (/^(?:a|an|the|their)\b/i.test(v) ? "Plans " : "Plans to ");
  if (noun || band || place) add(`${cap([band, noun].filter(Boolean).join(" ") || "Company")}${place ? ` in ${place}` : ""}${staff}`, facts.activity?.quote ?? facts.size?.quote ?? facts.sector?.quote ?? facts.region?.quote ?? facts.country?.quote);
  if (facts.project) add(`${planWord(facts.project.value)}${facts.project.value}`, facts.project.quote); if (facts.amount) add(`Budget around ${facts.amount.value}`, facts.amount.quote);
  if (ordered !== "unknown") add(ordered === "no" ? "Nothing ordered or started yet" : "Something has already been ordered or started", facts.ordered?.quote);
  if (facts.timing) add(`${tm?.start ? "Wants to start" : "Timing:"} ${facts.timing.value}`, facts.timing.quote); if (facts.decision) add(`Decision sits with ${withThe(facts.decision.value)}`, facts.decision.quote);
  if (facts.previous) add(facts.previous.value === "None mentioned" ? "No previous grants or subsidies mentioned" : `Previously: ${facts.previous.value}`, facts.previous.quote);
  const named = programmes.filter((p) => p.quote); if (named.length) add(`Mentioned: ${named.map((p) => p.label).join(", ")}`, named[0].quote);
  for (const q of openQuestions) if (q.kind === "said") add(q.text, q.quote);

  const sentences: string[] = []; const pj2 = facts.project?.value;
  if (comp || band || place || act) { const desc = [band, noun?.replace(/^\d.*?\s(?=[a-z])/i, "")].filter(Boolean).join(" ") || "company"; sentences.push(comp ? `${comp.value} is ${/^[aeiou]/i.test(desc) ? "an" : "a"} ${desc}${place ? ` in ${place}` : ""}${staff}.` : `${cap(desc)}${place ? ` in ${place}` : ""}${staff}.`); }
  const amountInProject = !!(amt && pj2 && pj2.toLowerCase().includes(amt.text.trim().toLowerCase()));
  if (pj2) sentences.push(`${planWord(pj2)}${pj2}${facts.amount && !amountInProject ? `, around ${facts.amount.value}` : ""}.`); else if (facts.amount) sentences.push(`Budget mentioned: ${facts.amount.value}.`);
  if (facts.timing && !(pj2 && pj2.toLowerCase().includes(facts.timing.value.toLowerCase()))) sentences.push(`${tm?.start ? "Wants to start" : "Timing:"} ${facts.timing.value}.`);
  if (ordered === "no") sentences.push("Nothing has been ordered or started yet."); else if (ordered === "yes") sentences.push("Something has already been ordered or started.");
  if (facts.previous) sentences.push(facts.previous.value === "None mentioned" ? "No previous grants or subsidies were mentioned." : `Previous funding: ${facts.previous.value}.`);
  if (facts.decision) sentences.push(`Decision sits with ${withThe(facts.decision.value)}.`);
  const pnamed = programmes.filter((p) => p.quote); if (pnamed.length) sentences.push(`Programmes mentioned: ${pnamed.map((p) => p.label).join(", ")}.`); if (nextSteps[0]) sentences.push(`Next step: ${nextSteps[0].what}.`);
  const summary = sentences.length ? sentences.join(" ") : "No funding-relevant details were mentioned in this conversation.";
  return { summary, keyPoints: kp, facts, nums, ordered, openQuestions, nextSteps, programmes, words: (t.match(/\S+/g) ?? []).length, source: "rules" };
}
