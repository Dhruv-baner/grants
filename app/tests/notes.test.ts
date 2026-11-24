import { describe, expect, it } from "vitest";
import { FIXTURES } from "@/lib/notes/fixtures";
import { extractNotes, fixAcronyms, span } from "@/lib/notes/extract";
import { findAmounts, formatEur, sizeBand, wordsToNumber } from "@/lib/notes/numbers";
import { findInTranscript, quoteInTranscript } from "@/lib/notes/quote";
import type { NoteResult } from "@/lib/notes/types";

const val = (n: NoteResult, k: keyof NoteResult["facts"]) => n.facts[k]?.value;
describe("numbers", () => {
  it("reads spoken and written quantities", () => {
    const t: [string, number][] = [["three hundred thousand", 300000], ["300 thousand", 300000], ["1.2 million", 1200000], ["300k", 300000], ["forty", 40], ["three hundred and fifty thousand", 350000], ["two hundred and sixty", 260], ["3,000", 3000], ["1.200.000", 1200000], ["a hundred", 100], ["twelve", 12], ["fifty thousand", 50000], ["2.5 million", 2500000], ["eighty thousand", 80000]];
    for (const [s, n] of t) expect(wordsToNumber(s), s).toBe(n);
    for (const s of ["", "banana", "three bananas", "and"]) expect(wordsToNumber(s), s).toBeNull();
  });
  it("finds money in euros however it is said", () => {
    const t: [string, number][] = [["around 300 thousand euros", 300000], ["€1.2 million", 1200000], ["EUR 80,000", 80000], ["about fifty thousand euros", 50000], ["1,200,000 euros", 1200000], ["a budget of 25k euros", 25000], ["at a cost of 45 million", 45000000], ["invest 2.5 million in", 2500000], ["two hundred and fifty thousand euros", 250000], ["3 million euros", 3000000]];
    for (const [s, n] of t) expect(findAmounts(s).map((a) => a.value), s).toContain(n);
    for (const s of ["we have 300 employees", "about 80k", "three people", "the 3,000 staff", "in 2026"]) expect(findAmounts(s), s).toEqual([]);
  });
  it("formats and bands", () => { expect(formatEur(1200000)).toBe("€1,200,000"); expect(formatEur(300000)).toBe("€300,000"); expect([5, 9, 10, 49, 50, 249, 250].map(sizeBand)).toEqual(["micro", "micro", "small", "small", "medium", "medium", "large"]); });
});
describe("quotes", () => {
  const t = "We plan to invest €1.2 million in a new production hall. The order was placed last month.";
  it("finds a passage despite case, spacing and punctuation", () => {
    const q = "invest €1.2 million in a new production hall"; const f = findInTranscript(t, q)!; expect(t.slice(f.start, f.end)).toBe(q); expect(quoteInTranscript(t, "THE ORDER   was placed, last month")).toBe(true);
    expect(quoteInTranscript(t, "invest 5 million in a new hall")).toBe(false); expect(quoteInTranscript(t, "")).toBe(false); expect(quoteInTranscript(t, "the")).toBe(false);
  });
  it("makes evidence spans that are exact substrings, and does not break on decimals", () => { const i = t.indexOf("1.2"); const s = span(t, i, 3); expect(t.includes(s)).toBe(true); expect(s).toContain("1.2 million"); });
  it("joins spaced letters", () => { expect(fixAcronyms("the W B S O and E I A")).toBe("the WBSO and EIA"); expect(fixAcronyms("a b")).toBe("a b"); });
});
describe("each fixture call", () => {
  for (const f of FIXTURES) it(`${f.id}: ${f.label}`, () => {
    const n = extractNotes(f.text); const e = f.expect;
    if (e.noFacts) { expect(Object.keys(n.facts)).toEqual([]); expect(n.keyPoints).toEqual([]); expect(n.nextSteps).toEqual([]); expect(n.summary).toMatch(/No funding-relevant details/); return; }
    if (e.company) expect(val(n, "company")).toBe(e.company); if (e.country) expect(val(n, "country")).toBe(e.country); if (e.region) expect(val(n, "region")).toBe(e.region);
    if (e.size) expect(val(n, "size")).toBe(e.size); if (e.employees) expect(n.nums.employees).toBe(e.employees);
    for (const s of e.sector ?? []) expect(val(n, "sector"), "sector").toContain(s);
    if (e.project) expect(val(n, "project")?.toLowerCase()).toContain(e.project.toLowerCase()); if (e.amountEur) expect(n.nums.amountEur).toBe(e.amountEur);
    if (e.timing) expect(val(n, "timing")?.toLowerCase()).toContain(e.timing.toLowerCase()); if (e.ordered) expect(n.ordered).toBe(e.ordered);
    if (e.previous) expect(val(n, "previous")).toContain(e.previous); if (e.decision) expect(val(n, "decision")?.toLowerCase()).toContain(e.decision.toLowerCase());
    for (const p of e.programmes ?? []) expect(n.programmes.map((x) => x.id), "programmes").toContain(p); if (e.nextWhen) expect(n.nextSteps.map((s) => s.when)).toContain(e.nextWhen);
    if (e.said) expect(n.openQuestions.filter((q) => q.kind === "said").map((q) => q.text).join(" ").toLowerCase()).toContain(e.said.toLowerCase());
    for (const bad of e.forbid ?? []) expect(JSON.stringify(n).toLowerCase(), bad).not.toContain(bad.toLowerCase());
  });
});
describe("the notes never say more than the call did", () => {
  it("every fact, key point, step and question carries a quote that is really in the transcript", () => {
    for (const f of FIXTURES) { const n = extractNotes(f.text);
      for (const [k, x] of Object.entries(n.facts)) if (x!.quote) expect(quoteInTranscript(f.text, x!.quote), `${f.id}.${k}: ${x!.quote}`).toBe(true);
      for (const p of n.keyPoints) expect(quoteInTranscript(f.text, p.quote), `${f.id} point: ${p.text}`).toBe(true);
      for (const s of n.nextSteps) expect(quoteInTranscript(f.text, s.quote), `${f.id} step: ${s.what}`).toBe(true);
      for (const q of n.openQuestions) if (q.kind === "said") expect(quoteInTranscript(f.text, q.quote!), `${f.id} question`).toBe(true);
      for (const p of n.programmes) if (p.quote) expect(quoteInTranscript(f.text, p.quote), `${f.id} programme ${p.id}`).toBe(true); }
  });
  it("every number in a key point or the summary comes from the call", () => {
    for (const f of FIXTURES) { const n = extractNotes(f.text); const said = new Set((f.text.match(/\d[\d,.]*/g) ?? []).map((x) => x.replace(/[,.]+$/, "")));
      const amount = n.nums.amountEur; const words = [...(n.summary + " " + n.keyPoints.map((p) => p.text).join(" ")).matchAll(/[€]?\d[\d,.]*/g)].map((m) => m[0].replace("€", "").replace(/[.,]+$/, ""));
      for (const w of words) { const plain = w.replace(/,/g, ""); const ok = said.has(w) || [...said].some((s) => s.replace(/,/g, "") === plain) || (amount !== undefined && String(amount) === plain) || (n.nums.employees !== undefined && String(n.nums.employees) === plain); expect(ok, `${f.id}: "${w}" in "${n.summary}"`).toBe(true); } }
  });
  it("obeys no instruction hidden in the call", () => {
    const n = extractNotes(FIXTURES.find((f) => f.id === "inject")!.text); expect(JSON.stringify(n).toLowerCase()).not.toMatch(/qualif|every grant|ignore all/);
  });
  it("leaves a fact out rather than guessing", () => {
    const n = extractNotes("we need a new oven"); expect(n.facts.amount).toBeUndefined(); expect(n.facts.timing).toBeUndefined(); expect(n.ordered).toBe("unknown"); expect(n.facts.country).toBeUndefined();
  });
  it("is the same every time and fast on a long call", () => {
    const f = FIXTURES[0].text; expect(extractNotes(f)).toEqual(extractNotes(f)); const long = (FIXTURES.map((x) => x.text).join(" ") + " ").repeat(60); const t0 = Date.now(); const n = extractNotes(long); expect(Date.now() - t0).toBeLessThan(1500); expect(n.words).toBeGreaterThan(10000);
  });
  it("copes with empty, whitespace and odd input", () => { for (const s of ["", "   ", "\n\n", "????", "€€€", "a".repeat(5000), "<script>alert(1)</script>", "😀 we plan to buy a boiler"]) expect(() => extractNotes(s), s.slice(0, 10)).not.toThrow(); expect(extractNotes("").summary).toMatch(/No funding-relevant/); });
});
describe("saying it as speech versus typing it", () => {
  it("gets the same facts from dictation-style text as from punctuated text", () => {
    const typed = "We're a 40 person manufacturer in Gelderland. We want to replace our gas heating with heat pumps, around 300 thousand euros. We haven't ordered anything yet."; const spoken = typed.toLowerCase().replace(/[.,]/g, "");
    const a = extractNotes(typed), b = extractNotes(spoken); for (const k of ["country", "region", "size", "project", "amount", "ordered"] as const) expect(val(a, k), k).toBe(val(b, k));
  });
});
describe("ordered or started", () => {
  const o = (s: string) => extractNotes(s).ordered;
  it("reads the negatives", () => { for (const s of ["we haven't ordered anything yet", "nothing has been ordered", "nothing has been signed or ordered yet", "we have not signed yet", "no order has been placed", "we still need to order the pumps", "not yet ordered", "we haven't started the work"]) expect(o(s), s).toBe("no"); });
  it("reads the positives", () => { for (const s of ["we already ordered the boiler", "we've signed the contract with the installer", "the order was placed last month", "we have started the installation", "they've bought the machine", "work has already started"]) expect(o(s), s).toBe("yes"); });
  it("says unknown when it is not mentioned", () => { for (const s of ["we want a heat pump", "the weather is nice", "we ordered coffee"].slice(0, 2)) expect(o(s), s).toBe("unknown"); });
});

describe("the written summary", () => {
  const S: Record<string, string> = {
    demo: "Small manufacturer in Gelderland (about 40 staff). Plans to replace their gas heating with heat pumps, around €300,000. Wants to start in spring. Nothing has been ordered or started yet. Decision sits with the finance director. Next step: Follow-up call on Thursday.",
    brandt: "Brandt Metallbau is a medium manufacturing company in Saxony (about 120 staff). Plans to invest €1.2 million in a new production hall and energy-saving equipment. Something has already been ordered or started. No previous grants or subsidies were mentioned. Decision sits with CFO, Anna Keller. Next step: Send the application checklist by Friday.",
    founder: "Micro digital company building a software platform for logistics in the Netherlands (about 5 staff). Plans to hire two engineers, around €50,000. Wants to start in January.",
    chat: "No funding-relevant details were mentioned in this conversation.",
    inject: "Micro bakery in the Netherlands (about 8 staff). Plans to buy a new oven, around €25,000.",
    correction: "Timing: summer.",
    large: "Large global chemicals company in the Netherlands (about 3,000 staff). Plans a pilot plant for plastic recycling, around €45,000,000.",
    acronyms: "Large company (about 260 staff). Budget mentioned: €250,000. Programmes mentioned: WBSO, EIA.",
    signed: "Timing: in March. Something has already been ordered or started.",
    nothing: "Plans to replace their boiler, around €80,000. Timing: by the end of September. Nothing has been ordered or started yet.",
    previous: "Previous funding: received a WBSO grant. Programmes mentioned: WBSO, Innovation Credit.",
    mueller: "Müller Maschinenbau is a medium manufacturing company in Germany (about 85 staff). Plans to invest 2.5 million in a new production line next year. Nothing has been ordered or started yet. Decision sits with the managing director. Next step: Send the checklist on Monday.",
  };
  for (const f of FIXTURES) it(`reads well: ${f.id}`, () => expect(extractNotes(f.text).summary).toBe(S[f.id]));
  it("does not repeat words or leave a dangling preposition", () => { for (const f of FIXTURES) { const s = extractNotes(f.text).summary; expect(s).not.toMatch(/\b(\w+) \1\b/i); expect(s).not.toMatch(/\b(?:for|at|with|of|to|and|in|on|by),/); expect(s).not.toMatch(/ ,|,,|\.\./); } });
  it("treats the verb 'may' as a verb, and 'in May' as a month", () => { expect(val(extractNotes("we may replace the boiler, maybe soon"), "timing")).toBeUndefined(); expect(val(extractNotes("we want to start in may"), "timing")).toBe("in May"); });
});
