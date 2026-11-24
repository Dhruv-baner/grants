// The consultant assistant's brain. Pure and deterministic: every answer is assembled from the data, so it cannot invent anything.
// Only programmes whose checklist is fully recorded are answered; everything else gets the beta message.
import { BY_ID } from "../data";
import { match } from "../matcher";
import type { Scheme } from "../types";
import { daysBetween, fmtDate, LABEL } from "../ui";
import { AMBIGUOUS, AS_COUNTRY, BETA, CONFIG, PARTIAL_PARENT } from "./config";
import { ALIAS_LIST, CHECKLISTS, DATA_AS_OF, DOCS_AS_OF, IN_SCOPE, IN_SCOPE_ROWS, KIND_OF, inScope, labelOf, type DocItem } from "./knowledge";
import { browseAnswer, isDiscovery, parseBrowse } from "./browse";
import { parseCompany } from "./profileFromText";
import { norm, scan, sentence, shorten, tidy } from "./text";

export type Block =
  | { t: "title"; text: string; sub?: string; id?: string }
  | { t: "text"; text: string; lead?: boolean }
  | { t: "facts"; rows: { k: string; v: string; hi?: boolean }[]; src?: string }
  | { t: "checklist"; groups: { label: string; items: { item: string; note: string; url: string }[] }[] }
  | { t: "table"; cols: string[]; rows: { label: string; cells: string[] }[] }
  | { t: "list"; groups: { label: string; note?: string; items: { id: string; label: string; meta: string; status: string; summary: string; url: string }[] }[]; more?: { text: string; href: string; label: string } }
  | { t: "picks"; items: { id: string; label: string; score: number; fit: string; why: string[]; flags: string[]; deadline: string }[] }
  | { t: "notice"; text: string }
  | { t: "sources"; items: { label: string; url: string }[] }
  | { t: "chips"; items: string[] };
export type Kind = "docs" | "facts" | "compare" | "recommend" | "browse" | "help" | "beta" | "clarify";
export interface Answer { kind: Kind; ids: string[]; blocks: Block[]; }
export interface Ctx { last: string[]; docs?: boolean; }
export interface Result { answer: Answer; ctx: Ctx; followup?: { id: string; question: string }; }
type Focus = "when" | "elig" | "money" | "before" | "decide";

const RX = {
  docs: /\b(documents?|paperwork|attachments?|annex(es)?|checklist|upload|prepare|preparing|papers|forms|what (do|should) (i|we) (need|have|bring|send|submit|gather)|what (is|are) (needed|required)|how (do|can|should) (i|we) apply|need to (apply|submit)|required to apply|what to (send|submit|bring|prepare))\b/,
  elig: /\b(eligib\w*|who (can|may|is|are|qualifies|gets)|who is it for|can (we|i|a|an|my|our|startups?|smes?|small|large)\b.*\b(apply|get|use|claim|qualify|join|take part)|do (we|i) qualify|qualif\w*|open to|suitable for|applicants?)\b/,
  decide: /\b(decision|how long (does|will|until|do)|turnaround|processing time|hear back)\b/,
  before: /\b(before (we |i )?(start|begin|order|buy|sign)|apply before|already (started|ordered|bought|signed)|start(ed)? (the )?(work|project)|too late)\b/,
  money: /\b(how much|amount|funding rate|rate|percent\w*|cap|maximum|max|grant size|loan size|budget|what (does|do) it (give|pay|cover|fund)|benefit|worth)\b/,
  when: /\b(deadlines?|closing|closes?|close|when|opens?|opening|status|window|until|due|dates?|still open|is it open)\b/,
  basics: /\b(basics?|overview|tell me about|what is|whats|summary|summari[sz]e|explain|about|details|info|information|describe)\b/,
  compare: /\b(compare|comparison|versus|vs|difference|differences|differ|better than|which is better)\b/,
  recommend: /\b(which (programme|program|scheme|grant|subsidy|funding|programmes|schemes|grants)|what (grants?|funding|subsidies|schemes?|programmes?|programs?)|what (could|can|should|might) (we|i)|what fits|recommend\w*|suggest\w*|looking for (funding|grants?|subsid\w+)|any (grants?|funding|subsid\w+)|we are (a|an)|were (a|an)|my company|our company|i run|i own|we (make|build|produce|manufacture|plan|want|need|operate)|funding for)\b/,
  personal: /\b(we are|were (a|an)|my company|our company|i run|i own|we (make|build|produce|manufacture|plan|want|need|operate))\b/,
  help: /\b(help|what can you (do|answer)|how does this work|what do you (cover|know)|which programmes (do you|are)|list (of )?programmes?|what programmes|covered)\b/,
  greet: /^(hi|hello|hey|good (morning|afternoon|evening)|thanks?|thank you|ok|okay)\b/,
};
// Words that show a message is about applying for funding. Without one, "when does it rain" must not reuse the last programme.
const DOMAIN = /\b(deadlines?|close[sd]?|closing|open|opens|opening|status|window|apply|applying|applications?|eligib\w*|qualif\w*|documents?|paperwork|attachments?|checklist|funding|grants?|subsid\w+|loans?|amount|rate|cap|maximum|max|decision|programmes?|programs?|schemes?|benefit|costs?|who (can|may) (get|use|claim|join)|how much|before (we |i )?(start|order|buy))\b/;
const STOPWORDS = new Set("a an the is are was were be do does did can could should would will i we you it its it s my our your of for to in on at by with and or but if so then than that this these those what whats which who whom how when where why please tell me about there any some from as into out up".split(" "));

function intents(t: string) {
  const focus: Focus[] = [];
  if (RX.decide.test(t)) focus.push("decide"); if (RX.elig.test(t)) focus.push("elig"); if (RX.before.test(t)) focus.push("before");
  if (RX.money.test(t)) focus.push("money"); if (RX.when.test(t)) focus.push("when");
  return { docs: RX.docs.test(t), focus, basics: RX.basics.test(t), compare: RX.compare.test(t) || / or /.test(` ${t} `), compareWord: RX.compare.test(t),
    recommend: RX.recommend.test(t), help: RX.help.test(t), greet: RX.greet.test(t) };
}

// ---------- building blocks ----------
const group = (r: Scheme) => `${AS_COUNTRY(r.country)} · ${r.type_group}`;
function deadlineLine(r: Scheme): string {
  const st = LABEL[r.status_clean] ?? r.status_clean;
  if (r.closes_date) {
    const n = daysBetween(DATA_AS_OF, r.closes_date);
    return n >= 0 ? `${st}. Closes ${fmtDate(r.closes_date)} (${n} ${n === 1 ? "day" : "days"} left as of ${fmtDate(DATA_AS_OF)}).` : `Closed on ${fmtDate(r.closes_date)}.`;
  }
  return [sentence(st), r.window && sentence(tidy(r.window)), String(r.status_note ?? "") && sentence(tidy(String(r.status_note)))].filter(Boolean).join(" ");
}
const sizeLine = (r: Scheme) => (r.eligible_sizes && r.eligible_sizes !== "unknown" ? (r.eligible_sizes === "any" ? "Company size: any." : `Company size recorded: ${r.eligible_sizes.split(";").join(", ")}.`) : "");
function beforeLine(r: Scheme): string {
  const v = tidy(String(r.before_start ?? ""));
  if (!v) return "Not recorded."; if (/^yes\.?$/i.test(v)) return "Yes. Apply before you start."; if (/^no\.?$/i.test(v)) return "No. Applying first is not required."; if (/^not stated/i.test(v)) return "Not stated on the official pages we read."; if (/^not read/i.test(v)) return "Not recorded yet.";
  return sentence(v);
}
function factRows(r: Scheme, focus?: Focus): { k: string; v: string; hi?: boolean }[] {
  const cl = CHECKLISTS[r.id];
  const give = [sentence(tidy(r.funding_rate)), r.caps ? `Limits: ${sentence(tidy(r.caps))}` : ""].filter(Boolean).join(" ") || "Not recorded.";
  const who = [sentence(tidy(r.applicants)), sizeLine(r)].filter(Boolean).join(" ") || "Not recorded.";
  const rows: { key: Focus | "where"; k: string; v: string }[] = [
    { key: "when", k: "Status and deadline", v: deadlineLine(r) }, { key: "elig", k: "Who can apply", v: who }, { key: "money", k: "What it gives", v: give },
    { key: "before", k: "Apply before starting?", v: beforeLine(r) },
    ...(r.decision_time ? [{ key: "decide" as const, k: "Decision time", v: sentence(tidy(String(r.decision_time))) }] : []),
    { key: "where", k: "Where to apply", v: sentence(tidy(cl.channel)) },
  ];
  const first = rows.filter((x) => x.key === focus); const rest = rows.filter((x) => x.key !== focus);
  return [...first, ...rest].map((x) => ({ k: x.k, v: x.v, ...(x.key === focus ? { hi: true } : {}) }));
}
const lead: Record<Focus, string> = {
  elig: "I can't tell whether your company qualifies. This is who the programme is open to, as the official pages describe it.",
  when: "", money: "", before: "", decide: "",
};
function factsBlocks(r: Scheme, focus?: Focus): Block[] {
  return [{ t: "title", text: labelOf(r.id), sub: group(r), id: r.id }, ...(focus && lead[focus] ? [{ t: "text", text: lead[focus] } as Block] : []), { t: "facts", rows: factRows(r, focus), src: r.official_url }];
}
const GROUPS: [DocItem["required"], string][] = [["required", "Required"], ["conditional", "Only if it applies to you"], ["after approval", "After you are approved"], ["optional", "Optional"]];
function docsBlocks(r: Scheme): Block[] {
  const cl = CHECKLISTS[r.id];
  const groups = GROUPS.map(([k, label]) => ({ label, items: cl.documents.filter((d) => d.required === k).map((d) => ({ item: d.item.replace(/^\d+\.\s*/, ""), note: tidy(d.note), url: d.source_url })) })).filter((g) => g.items.length);
  const n = (k: DocItem["required"]) => cl.documents.filter((d) => d.required === k).length;
  return [{ t: "title", text: `Documents for ${labelOf(r.id)}`, sub: group(r), id: r.id }, { t: "text", text: `${cl.documents.length} items: ${n("required")} required, ${n("conditional")} only if they apply, ${n("after approval")} after approval. Where and how to apply: ${sentence(tidy(cl.channel))}` }, { t: "checklist", groups },
    ...(cl.notes ? [{ t: "text", text: `Good to know: ${sentence(tidy(cl.notes))}` } as Block] : []),
    { t: "text", text: `How solid this is: ${sentence(tidy(cl.confidence))} Checked ${fmtDate(cl.checked)}.` }];
}
function sourcesBlock(ids: string[]): Block {
  const seen = new Set<string>(); const items: { label: string; url: string }[] = [];
  for (const id of ids) {
    const r = BY_ID[id]; const add = (label: string, url: string) => { if (url && !seen.has(url) && !/ignite/i.test(url + label)) { seen.add(url); items.push({ label, url }); } };
    add(`${labelOf(id)}: official page`, r.official_url);
    for (const s of CHECKLISTS[id].sources.filter((x) => x.tier === "Official").slice(0, 3)) add(`${labelOf(id)}: ${s.label}`, s.url);
  }
  return { t: "sources", items: items.slice(0, 8) };
}
const popular = ["What documents do I need for WBSO?", "When does the SME energy-saving loan close?", "Compare EIA and MIA and Vamil", "We are a small manufacturer in Gelderland replacing gas heating. What fits?"];
const chipsFor = (ids: string[], skip: "docs" | "facts" | "none" = "none"): Block => {
  const out: string[] = [];
  for (const id of ids.slice(0, 2)) { if (skip !== "docs") out.push(`What documents do I need for ${labelOf(id)}?`); if (skip !== "facts") out.push(`Deadline and eligibility for ${labelOf(id)}?`); }
  out.push("Which programme fits my company?"); return { t: "chips", items: out.slice(0, 4) };
};
const covered = () => {
  const by: Record<string, string[]> = {}; for (const id of IN_SCOPE) (by[AS_COUNTRY(BY_ID[id].country)] ??= []).push(labelOf(id));
  return Object.entries(by).map(([c, l]) => ({ c, l })).sort((a, b) => ["NL", "DE", "EU"].indexOf(a.c) - ["NL", "DE", "EU"].indexOf(b.c));
};
export const helpAnswer = (): Answer => ({ kind: "help", ids: [], blocks: [
  { t: "text", text: `I'm a consultant's assistant for ${IN_SCOPE.length} funding programmes in the Netherlands, Germany and the EU. I can tell you what documents a programme asks for, its deadline, who can apply, and what it gives. I can compare two programmes, or point you to the ones that fit a company you describe.` },
  { t: "facts", rows: covered().map(({ c, l }) => ({ k: c === "NL" ? "Netherlands" : c === "DE" ? "Germany" : c, v: l.join(", ") })) },
  { t: "text", text: `I only answer about these programmes. For anything else: ${BETA}` }, { t: "chips", items: popular }] });
export const betaAnswer = (lineText: string): Answer => ({ kind: "beta", ids: [], blocks: [{ t: "text", text: lineText }, { t: "notice", text: BETA },
  { t: "text", text: `Here is what I can help with right now: documents, deadlines and eligibility for ${IN_SCOPE.length} programmes.` }, { t: "chips", items: ["What can you answer?", ...popular.slice(0, 2)] }] });

// ---------- compare ----------
function compareBlocks(a: Scheme, b: Scheme): Block[] {
  const ca = CHECKLISTS[a.id], cb = CHECKLISTS[b.id];
  const count = (d: DocItem[]) => { const n = (k: DocItem["required"]) => d.filter((x) => x.required === k).length; return `${n("required")} required, ${n("conditional")} if it applies, ${n("after approval")} after approval`; };
  const main = (d: DocItem[]) => d.filter((x) => x.required === "required").slice(0, 3).map((x) => x.item.replace(/^\d+\.\s*/, "")).join("; ");
  const rows = [
    { label: "Status and deadline", cells: [shorten(deadlineLine(a)), shorten(deadlineLine(b))] },
    { label: "Who can apply", cells: [shorten(sentence(tidy(a.applicants)) + " " + sizeLine(a)), shorten(sentence(tidy(b.applicants)) + " " + sizeLine(b))] },
    { label: "What it gives", cells: [shorten(sentence(tidy(a.funding_rate))), shorten(sentence(tidy(b.funding_rate)))] },
    { label: "Apply before starting?", cells: [shorten(beforeLine(a)), shorten(beforeLine(b))] },
    { label: "Documents", cells: [count(ca.documents), count(cb.documents)] },
    { label: "Main documents", cells: [shorten(main(ca.documents), 150), shorten(main(cb.documents), 150)] },
    { label: "Where to apply", cells: [shorten(tidy(ca.channel), 150), shorten(tidy(cb.channel), 150)] },
  ];
  const stack = [a, b].map((r) => (r.stacking ? `${labelOf(r.id)}: ${sentence(tidy(String(r.stacking)))}` : "")).filter(Boolean);
  return [{ t: "title", text: `${labelOf(a.id)} or ${labelOf(b.id)}`, sub: "Side by side" }, { t: "table", cols: [labelOf(a.id), labelOf(b.id)], rows },
    ...(stack.length ? [{ t: "text", text: `Combining them: ${stack.join(" ")}` } as Block] : []),
    { t: "text", text: "Which one fits depends on the company. Describe it and I will rank the programmes I cover. I don't judge which is better in general." }];
}

// ---------- recommend ----------
export function recommend(original: string): Result {
  const parsed = parseCompany(original); const ctx: Ctx = { last: [] };
  if (!parsed.profile) return { ctx, answer: { kind: "clarify", ids: [], blocks: [
    { t: "text", text: `To rank the programmes I need to know where the company is based${parsed.found.length ? ` (so far I read: ${parsed.found.join("; ")})` : ""}. Add the country, and if you can, the size and what it plans to do.` },
    { t: "chips", items: ["We are a small manufacturer in the Netherlands planning to replace gas heating", "We are a 30-person German software company doing R&D", "We are a start-up in France building a deep-tech product"] }] } };
  const res = match(parsed.profile, IN_SCOPE_ROWS); const top = [...res.matches].sort((x, y) => y.score - x.score).slice(0, 3);
  const read = `Here is how the programmes I cover rank for: ${parsed.found.join(" · ")}.` + (parsed.missing.length ? ` I could not read the ${parsed.missing.join(" or ")}, so I left that open.` : "");
  if (!top.length) return { ctx, answer: { kind: "recommend", ids: [], blocks: [{ t: "text", text: `${read} None of the programmes I cover is a clear fit for what you described.` }, { t: "notice", text: BETA },
    { t: "text", text: "Add more detail about what the company plans to do and I will look again." }, { t: "chips", items: ["What can you answer?"] }] } };
  const ids = top.map((m) => m.scheme_id);
  return { ctx: { last: ids.slice(0, 2) }, answer: { kind: "recommend", ids, blocks: [
    { t: "text", text: read },
    { t: "picks", items: top.map((m) => ({ id: m.scheme_id, label: labelOf(m.scheme_id), score: m.score, fit: m.fit ?? "", why: m.reasons.slice(0, 3), flags: m.flags.slice(0, 2).map((f) => f.replace(/:\s*check\b/i, "")), deadline: /^\d{4}-\d{2}-\d{2}$/.test(m.next_deadline) ? `Closes ${fmtDate(m.next_deadline)}` : (LABEL[m.status_clean] ?? "") })) },
    { t: "text", text: "This uses the same readable score as the Screen page, limited to the programmes I cover. It shows where to look first, not whether the company qualifies." },
    { t: "chips", items: ids.slice(0, 2).map((id) => `What documents do I need for ${labelOf(id)}?`).concat(["Compare " + labelOf(ids[0]) + (ids[1] ? " and " + labelOf(ids[1]) : "")].filter(() => ids.length > 1)) }] } };
}

// ---------- the router ----------
function contentWords(t: string, hitAliases: string[]) {
  const drop = new Set(hitAliases.flatMap((a) => a.split(" "))); return t.split(" ").filter((w) => w && !STOPWORDS.has(w) && !drop.has(w)).length;
}
export function respond(raw: string, ctx: Ctx = { last: [] }): Result {
  const original = (raw ?? "").trim().slice(0, 600); const t = norm(original);
  const keep: Ctx = ctx;
  if (!t) return { ctx: keep, answer: helpAnswer() };
  const I = intents(t); const hits = scan(t, ALIAS_LIST);
  const kind = (h: { key: string; alias: string }) => KIND_OF.get(h.key + "|" + h.alias);
  let inIds = [...new Set(hits.filter((h) => kind(h) === "in").map((h) => h.key))];
  const outIds = [...new Set(hits.filter((h) => kind(h) === "out").map((h) => h.key))];
  const amb = hits.filter((h) => kind(h) === "ambiguous").map((h) => h.key);
  const partial = hits.filter((h) => kind(h) === "partial").map((h) => h.key);
  const outNames = outIds.slice(0, 2).map((id) => BY_ID[id].name.replace(/\s*\([^)]*\)/g, "").replace(/:.*$/, "").trim());
  const outNotice = outIds.length ? `I don't have a complete checklist for ${outNames.join(" or ")} yet. ${BETA}` : "";
  let note = "";
  if (!inIds.length && partial.length) { const p = PARTIAL_PARENT[partial[0]]; inIds = [p.id]; note = `${p.note} ${BETA}`; }
  if (!inIds.length && amb.length) {
    const a = AMBIGUOUS[amb[0]]; const verb = I.docs ? "What documents do I need for" : "Tell me about";
    return { ctx: keep, answer: { kind: "clarify", ids: [], blocks: [{ t: "text", text: a.question }, { t: "chips", items: a.ids.map((id) => `${verb} ${labelOf(id)}?`) }] } };
  }
  if (!I.docs && I.focus.length === 0 && !I.basics && !I.compareWord && inIds.length && keep.docs && contentWords(t, hits.map((h) => h.alias)) <= 1) I.docs = true; // "and for EIA?" repeats the last kind of question
  const aboutProgramme = (I.docs || I.focus.length > 0) && DOMAIN.test(t);
  const pointsBack = I.basics && /\b(it|that|this|them|these|more)\b/.test(t) && contentWords(t, []) <= 3;
  const usingContext = !inIds.length && !outIds.length && keep.last.length > 0 && (aboutProgramme || pointsBack) && !I.recommend;
  const ids = usingContext ? keep.last : inIds;
  const parsed = parseCompany(original);
  if (!ids.length) {
    if (outIds.length) return { ctx: keep, answer: { ...betaAnswer(outNotice.replace(` ${BETA}`, "")), ids: [] } };
    if (I.help && !I.recommend) return { ctx: keep, answer: helpAnswer() };
    if (!RX.personal.test(t)) { const f = parseBrowse(original); if (f) return { ctx: { last: [] }, answer: browseAnswer(f) }; }
    if (!RX.personal.test(t) && parsed.signals < 2 && isDiscovery(original)) return { ctx: keep, answer: { kind: "clarify", ids: [], blocks: [{ t: "text", text: "What kind of funding are you looking for? Tell me a country, a sector or a type (grant, loan, tax incentive), or describe your company and I will rank the programmes I cover." }, { t: "chips", items: ["Dutch grants", "grants for energy companies", "R&D funding", "what closes this month"] }] } };
    if (I.recommend || parsed.signals >= 2) return recommend(original);
    if (I.greet && t.split(" ").length <= 4) return { ctx: keep, answer: helpAnswer() };
    if (aboutProgramme) return { ctx: keep, answer: { kind: "clarify", ids: [], blocks: [{ t: "text", text: "Which programme do you mean? Name one of the programmes I cover, or ask what I cover." }, { t: "chips", items: ["What can you answer?", ...popular.slice(0, 2)] }] } };
    return { ctx: keep, answer: betaAnswer("I'm not able to answer that one yet.") };
  }
  const rows = ids.slice(0, 3).map((id) => BY_ID[id]); const used = rows.map((r) => r.id);
  const focus = I.focus[0]; const blocks: Block[] = []; let kindOut: Kind = "facts"; let followup: Result["followup"];
  if (note) blocks.push({ t: "notice", text: note });
  const isCompare = rows.length >= 2 && (I.compareWord || (I.compare && !I.docs) || (!I.docs && I.focus.length === 0));
  if (isCompare) { kindOut = "compare"; blocks.push(...compareBlocks(rows[0], rows[1])); }
  else {
    if (I.docs) { kindOut = "docs"; for (const r of rows) blocks.push(...docsBlocks(r)); }
    const wantFacts = !I.docs || I.focus.length > 0;
    if (wantFacts) {
      const unrecognised = !I.docs && I.focus.length === 0 && !I.basics && rows.length === 1 && !usingContext && contentWords(t, hits.map((h) => h.alias)) >= 3;
      if (unrecognised) { blocks.push({ t: "text", lead: true, text: `I can't answer that exact question from the information I hold yet. ${BETA} Here is what I have on ${labelOf(rows[0].id)}.` }); followup = { id: rows[0].id, question: original }; }
      for (const r of rows) blocks.push(...factsBlocks(r, focus));
    }
  }
  if (outNotice && !note) blocks.push({ t: "notice", text: outNotice });
  blocks.push(sourcesBlock(used)); blocks.push(chipsFor(used, kindOut === "docs" ? (I.focus.length ? "none" : "docs") : kindOut === "facts" ? "facts" : "none"));
  return { ctx: { last: used.slice(0, 2), docs: kindOut === "docs" }, answer: { kind: kindOut, ids: used, blocks }, followup };
}
export { inScope, DOCS_AS_OF, DATA_AS_OF };
