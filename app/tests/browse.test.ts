import { describe, expect, it } from "vitest";
import { SCHEMES } from "@/lib/data";
import { parseBrowse, runBrowse, browseAnswer } from "@/lib/assistant/browse";
import { BETA } from "@/lib/assistant/config";
import { collectCitations } from "@/lib/assistant/citations";
import { respond, type Answer, type Block } from "@/lib/assistant/engine";
import { DATA_AS_OF, IN_SCOPE, inScope } from "@/lib/assistant/knowledge";
import { answerToMarkdown } from "@/lib/assistant/markdown";

const ask = (q: string) => respond(q).answer;
const lists = (a: Answer) => a.blocks.filter((b): b is Extract<Block, { t: "list" }> => b.t === "list");
const groups = (a: Answer) => lists(a).flatMap((l) => l.groups);
const ids = (a: Answer) => groups(a).flatMap((g) => g.items.map((i) => i.id));
const texts = (a: Answer) => a.blocks.filter((b) => b.t === "text" || b.t === "notice").map((b) => (b as { text: string }).text).join(" ");
const NOW = new Set(["open", "rolling", "opening_soon"]);
const GRANTS = ["Grant", "Mixed (grant and loan)", "Mixed (grant and equity)"], LOANS = ["Loan", "Guarantee", "Other (commercial finance)", "Mixed (grant and loan)"];
const monthEnd = (iso: string) => { const [y, m] = iso.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

describe("what counts as an open-ended question", () => {
  const f = (q: string) => parseBrowse(q);
  it("reads country, sector, type, theme and timing", () => {
    expect(f("grants for energy companies")).toMatchObject({ sectors: ["Energy & climate"], countries: [], pref: "grants" });
    expect(f("Dutch grants")).toMatchObject({ countries: ["NL"], pref: "grants" });
    expect(f("German funding for hydrogen")).toMatchObject({ countries: ["DE"], themes: ["hydrogen"] });
    expect(f("tax incentives in the Netherlands")).toMatchObject({ countries: ["NL"], pref: "tax" });
    expect(f("loans for SMEs in NL")).toMatchObject({ countries: ["NL"], pref: "loans" });
    expect(f("EU funding for start-ups")).toMatchObject({ countries: ["EU"], themes: ["startup"] });
    expect(f("Dutch and German subsidies")?.countries).toEqual(["NL", "DE"]);
    expect(f("what is open right now in Germany")).toMatchObject({ countries: ["DE"], openNow: true });
    expect(f("what closes this month")?.soon?.to).toBe(monthEnd(DATA_AS_OF));
    expect(f("any deadlines coming up?")?.soon).not.toBeNull();
    expect(f("R&D funding")?.themes).toEqual(["rd_innovation"]);
    expect(f("grants")).toMatchObject({ pref: "grants", countries: [] });
  });
  it("leaves everything else alone", () => {
    for (const q of ["What documents do I need for WBSO?", "Which programme fits my company?", "hello", "what's the weather in Delhi", "funding", "what is a bond", "Dutch", "who can see my results"]) expect(f(q), q).toBeNull();
  });
  it("sends company descriptions to the ranking, not the list", () => {
    for (const q of ["We are a small manufacturer in Gelderland replacing gas heating. What fits?", "We are a 30-person German software company doing R&D", "A 12-person Dutch software start-up doing AI research"]) expect(ask(q).kind, q).toBe("recommend");
  });
  it("lets a named programme win over the filters", () => { expect(ask("EIA grants").kind).not.toBe("browse"); expect(ask("EIA grants").ids).toEqual(["EIA"]); expect(ask("what documents for Dutch WBSO").kind).toBe("docs"); });
});

describe("a question with no filter at all", () => {
  it("asks what kind of funding, with examples that work", () => {
    for (const q of ["funding", "any funding?", "what support is there"]) { const a = ask(q); expect(a.kind, q).toBe("clarify"); const chips = (a.blocks.find((b) => b.t === "chips") as { items: string[] }).items; expect(chips.length).toBe(4); for (const c of chips) expect(["browse"], c).toContain(respond(c).answer.kind); }
  });
  it("lists everything of one type when only the type is given", () => { const a = ask("grants"); expect(a.kind).toBe("browse"); expect(ids(a).length).toBeGreaterThan(8); });
});

describe("the lists are right", () => {
  it("Dutch grants: the four grants, no tax incentives or loans, and says what else exists", () => {
    const a = ask("Dutch grants"); expect(a.kind).toBe("browse"); const got = ids(a);
    expect(new Set(got)).toEqual(new Set(["ISDE", "SDE_PP", "VEKI", "STUDI"])); expect(texts(a)).toMatch(/I also cover 4 tax incentives and 2 loans and guarantees/);
  });
  it("tax incentives in the Netherlands: exactly the four", () => expect(new Set(ids(ask("tax incentives in the Netherlands")))).toEqual(new Set(["WBSO", "INNOVATIEBOX", "EIA", "MIA_VAMIL"])));
  it("Dutch loans", () => { const got = new Set(ids(ask("Dutch loans"))); expect(got.has("MKB_EBL") && got.has("INNOVATIEKREDIET")).toBe(true); expect([...got].every((id) => LOANS.includes(SCHEMES.find((r) => r.id === id)!.type_group))).toBe(true); });
  it("grants for energy companies: energy-specific ones by country, then the open-to-every-sector ones", () => {
    const a = ask("grants for energy companies"); const g = groups(a); const got = new Set(ids(a));
    for (const id of ["SDE_PP", "ISDE", "VEKI", "STUDI", "EBN", "EEW", "BEG_NWG", "BIK_M2_TM2_R3", "INT_WASSERSTOFF"]) expect(got.has(id), id).toBe(true);
    expect(g.map((x) => x.label)).toEqual(["Netherlands", "Germany", "Open to every sector"]);
    for (const x of g.find((y) => y.label === "Netherlands")!.items) expect(SCHEMES.find((r) => r.id === x.id)!.sector).toMatch(/Energy & climate/);
    for (const x of g.find((y) => y.label === "Open to every sector")!.items) expect(SCHEMES.find((r) => r.id === x.id)!.sector).toContain("All sectors");
  });
  it("R&D funding: the research programmes, not equipment deductions", () => {
    const got = new Set(ids(ask("R&D funding"))); for (const id of ["WBSO", "FZULG", "HORIZON", "INNOVATIEBOX"]) expect(got.has(id), id).toBe(true); for (const id of ["EIA", "MIA_VAMIL", "ISDE", "MKB_EBL", "EBN"]) expect(got.has(id), id).toBe(false);
  });
  it("start-up funding finds the founder and EIC programmes", () => { const got = new Set(ids(ask("funding for start-ups"))); expect(got.has("GSTIP_NRW") && got.has("EIC_ACC")).toBe(true); });
  it("hydrogen grants", () => { const got = new Set(ids(ask("hydrogen grants"))); expect(got.has("INT_WASSERSTOFF")).toBe(true); });
  it("what closes this month: exactly the covered programmes with a closing date in that window", () => {
    const want = IN_SCOPE.filter((id) => { const r = SCHEMES.find((x) => x.id === id)!; return r.closes_date && r.closes_date >= DATA_AS_OF && r.closes_date <= monthEnd(DATA_AS_OF) && NOW.has(r.status_clean); }).sort();
    expect(ids(ask("what closes this month")).sort()).toEqual(want);
  });
  it("closing soon: only dates in the next 45 days, soonest first", () => {
    const g = groups(ask("what is closing soon")); const all = g.flatMap((x) => x.items).map((i) => SCHEMES.find((r) => r.id === i.id)!); expect(all.length).toBeGreaterThan(0);
    for (const r of all) { expect(r.closes_date! >= DATA_AS_OF).toBe(true); expect(Date.parse(r.closes_date!) - Date.parse(DATA_AS_OF)).toBeLessThanOrEqual(45 * 864e5); }
    for (const x of g) { const d = x.items.map((i) => SCHEMES.find((r) => r.id === i.id)!.closes_date!); expect([...d].sort()).toEqual(d); }
  });
  it("EU funding includes the three EU programmes", () => { const got = new Set(ids(ask("EU funding"))); for (const id of ["EIC_ACC", "EIC_STEP", "HORIZON"]) expect(got.has(id), id).toBe(true); });
  it("only ever lists covered programmes, with a source and a status", () => {
    for (const q of ["grants for energy companies", "Dutch grants", "what is open right now in Germany", "R&D funding", "EU funding", "German tax incentives", "loans", "what is open"]) for (const g of groups(ask(q))) for (const i of g.items) {
      expect(inScope(i.id), q + " " + i.id).toBe(true); expect(i.url, i.id).toMatch(/^https:/); expect(i.status.length).toBeGreaterThan(3); expect(i.summary.length).toBeGreaterThan(10); expect(i.meta).toMatch(/·/);
    }
  });
  it("matches every filter, checked against the raw data", () => {
    const sec = "Energy & climate"; const a = ask("Dutch grants for energy companies");
    for (const id of ids(a)) { const r = SCHEMES.find((x) => x.id === id)!; expect(r.country.split("/")).toContain("NL"); expect(GRANTS).toContain(r.type_group); expect(NOW.has(r.status_clean)).toBe(true); expect(r.sector.includes(sec) || r.sector.includes("All sectors")).toBe(true); }
  });
  it("caps a group at six and says how many more there are", () => {
    for (const g of groups(ask("what is open"))) expect(g.items.length).toBeLessThanOrEqual(6);
    const l = lists(ask("what is open"))[0]; expect(l.more?.text).toBeTruthy();
  });
  it("counts the matching programmes that are not covered, independently of the lists", () => {
    const f = parseBrowse("Dutch grants")!; const r = runBrowse(f);
    const other = SCHEMES.filter((x) => !inScope(x.id) && NOW.has(x.status_clean) && x.country.split("/").includes("NL") && GRANTS.includes(x.type_group)).length; expect(r.others).toBe(other); expect(other).toBeGreaterThan(0);
  });
});

describe("wording and honesty", () => {
  it("uses singular and plural correctly", () => {
    const one = texts(ask("German funding for hydrogen")); expect(one).toMatch(/\b1 programme I cover matches\b/); expect(one).not.toMatch(/1 programmes/);
    const many = texts(ask("Dutch grants")); expect(many).toMatch(/\b4 programmes I cover match\b/);
    const aside = texts(ask("subsidies for heat pumps")); expect(aside).not.toMatch(/\b1 (tax incentives|loans|grants)\b/);
  });
  it("names the sector gap instead of pretending", () => { const t = texts(ask("grants for shipping companies")); expect(t).toMatch(/None of the programmes I cover is specific to Transport & maritime/); expect(groups(ask("grants for shipping companies")).map((g) => g.label)).toEqual(["Open to every sector"]); });
  it("says the rest are not covered yet, with the beta message and a link", () => {
    const a = ask("grants for energy companies"); expect(texts(a)).not.toBe(""); const more = lists(a)[0].more!; expect(more.text).toContain(BETA); expect(more.text).toMatch(/not covered here yet/); expect(more.href).toBe("/programmes");
  });
  it("gives an empty result a next step", () => {
    const a = ask("AI funding"); expect(ids(a)).toEqual([]); expect(texts(a)).toContain("None of the programmes I cover"); const chips = a.blocks.find((b) => b.t === "chips") as { items: string[] }; expect(chips.items).toContain("R&D funding");
  });
  it("shows what closes next when nothing closes in the window", () => {
    const a = browseAnswer({ countries: ["DE"], sectors: [], themes: [], pref: null, openNow: false, soon: { from: DATA_AS_OF, to: DATA_AS_OF, label: "closing today" } }); expect(texts(a)).toMatch(/None of the programmes I cover is closing today/);
  });
  it("uses no dash punctuation and no placeholders", () => { for (const q of ["Dutch grants", "AI funding", "what closes this month", "grants for shipping companies"]) { const a = ask(q); expect(texts(a)).not.toMatch(/[\u2014\u2013]|undefined|\bNaN\b/); } });
  it("every suggested follow-up leads to a real answer", () => {
    const chips = new Set<string>(); for (const q of ["Dutch grants", "grants for energy companies", "tax incentives in the Netherlands", "R&D funding", "AI funding", "what closes this month"]) for (const b of ask(q).blocks) if (b.t === "chips") b.items.forEach((c) => chips.add(c));
    expect(chips.size).toBeGreaterThan(8);
    for (const c of chips) { const k = respond(c).answer.kind; expect(["browse", "docs", "clarify", "help"], c).toContain(k); if (k === "clarify") expect(c).toBe("Which programme fits my company?"); }
  });
});

describe("sources and export", () => {
  it("cites every listed programme's official page", () => {
    const a = ask("Dutch grants"); const c = collectCitations(a); const urls = groups(a).flatMap((g) => g.items.map((i) => i.url)); expect(c.map((x) => x.url)).toEqual(urls); expect(c.map((x) => x.n)).toEqual(urls.map((_, i) => i + 1));
  });
  it("exports every programme and the not-covered note as Markdown", () => {
    const a = ask("grants for energy companies"); const md = answerToMarkdown(a); for (const g of groups(a)) { expect(md).toContain(`### ${g.label}`); for (const i of g.items) expect(md).toContain(i.label); }
    expect(md).toContain(BETA); expect(md).toMatch(/\*\*Sources\*\*/); expect(md).not.toMatch(/undefined/);
  });
});
