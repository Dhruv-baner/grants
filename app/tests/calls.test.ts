import { describe, expect, it } from "vitest";
import { buildRow, callsToCsv, callsToJson, callsToTsv, CRM_KEYS, EXTRA, filterRows, fmtDay, MAIN, sampleCalls, sectorOptions, sortRows, statusLabel, STATUS_OPTIONS } from "@/lib/notes/calls";
import { FIXTURES } from "@/lib/notes/fixtures";
import { sanitizeNotes, type SavedNote } from "@/lib/notes/store";

const T0 = Date.UTC(2026, 10, 20, 12); const DAY = 86_400_000;
const note = (id: string, text: string, o: Partial<SavedNote> = {}): SavedNote => ({ id, title: "Untitled call", created: T0, updated: T0, transcript: text, jottings: "", edits: {}, ...o });
const fx = (id: string) => FIXTURES.find((f) => f.id === id)!.text;
const rowOf = (id: string, o: Partial<SavedNote> = {}) => buildRow(note(id, fx(id), o));

describe("the columns", () => {
  it("are exactly the ten asked for, in order", () => expect(MAIN.map((c) => c.label)).toEqual(["Date", "Company", "Sector", "Country", "Region", "Size", "Project", "Budget (EUR)", "Status", "Note summary"]));
  it("all belong to the standard record, with no overlap with the optional ones", () => { for (const c of [...MAIN, ...EXTRA]) expect(CRM_KEYS, c.key).toContain(c.key); expect(MAIN.filter((c) => EXTRA.some((e) => e.key === c.key))).toEqual([]); });
});
describe("a row", () => {
  it("is built from what the call said", () => {
    const r = rowOf("brandt"); const f = r.fields;
    expect(f).toMatchObject({ company_name: "Brandt Metallbau", country: "Germany", region: "Saxony", size_band: "medium", planned_investment_eur: "1200000", ordered_or_started: "Yes", employees: "120" });
    expect(f.sector).toContain("Industry & manufacturing"); expect(f.project_description).toMatch(/new production hall/); expect(f.notes_summary).toMatch(/^Brandt Metallbau is a medium manufacturing company/);
  });
  it("leaves out what was not said instead of guessing", () => { const f = buildRow(note("c", fx("chat"))).fields; for (const k of ["company_name", "sector", "country", "region", "size_band", "project_description", "planned_investment_eur", "ordered_or_started"]) expect(f[k], k).toBe(""); });
  it("uses the day the call was made, and a stable one", () => { const a = buildRow(note("a", fx("demo"), { created: T0 })); expect(a.fields.call_date).toBe(fmtDay(T0)); expect(buildRow(note("a", fx("demo"), { created: T0 + 3 * DAY })).fields.call_date).toBe(fmtDay(T0 + 3 * DAY)); });
  it("takes the title only if it was typed", () => { expect(buildRow(note("a", fx("demo"))).fields.call_title).toBe(""); expect(buildRow(note("a", fx("demo"), { title: "Brandt intro" })).fields.call_title).toBe("Brandt intro"); });
  it("shows an edit instead of the extracted value, and remembers it was edited", () => {
    const r = rowOf("demo", { edits: { company_name: "Acme BV", region: "Gelderland", planned_investment_eur: "250000" } }); expect(r.fields.company_name).toBe("Acme BV"); expect(r.fields.planned_investment_eur).toBe("250000"); expect([...r.edited].sort()).toEqual(["company_name", "planned_investment_eur"]);
  });
  it("can be blanked on purpose", () => { const r = rowOf("brandt", { edits: { company_name: "" } }); expect(r.fields.company_name).toBe(""); expect(r.edited.has("company_name")).toBe(true); });
  it("agrees with the notes page, because both come from the same extraction", () => { for (const f of FIXTURES) { const r = buildRow(note(f.id, f.text)); expect(r.fields.notes_summary).toBeTruthy(); expect(Object.keys(r.fields).sort()).toEqual([...CRM_KEYS].sort()); } });
  it("describes the status in plain words", () => { expect(STATUS_OPTIONS.map(([, l]) => l)).toEqual(["Not mentioned", "Nothing ordered yet", "Already ordered or started"]); expect([statusLabel(""), statusLabel("No"), statusLabel("Yes")]).toEqual(["Not mentioned", "Nothing ordered yet", "Already ordered or started"]); });
});

const rows = () => [rowOf("brandt", { created: T0 }), rowOf("mueller", { created: T0 + DAY }), rowOf("founder", { created: T0 + 2 * DAY }), rowOf("large", { created: T0 + 3 * DAY }), buildRow(note("chat", fx("chat"), { created: T0 + 4 * DAY }))];
const F = { q: "", sector: "", country: "", status: "" };
describe("filtering", () => {
  it("by country, status and sector", () => {
    expect(filterRows(rows(), { ...F, country: "Germany" }).map((r) => r.id)).toEqual(["brandt", "mueller"]);
    expect(filterRows(rows(), { ...F, status: "Yes" }).map((r) => r.id)).toEqual(["brandt"]); expect(filterRows(rows(), { ...F, status: "No" }).map((r) => r.id)).toEqual(["mueller"]);
    expect(filterRows(rows(), { ...F, status: "none" }).map((r) => r.id).sort()).toEqual(["chat", "founder", "large"]);
    expect(filterRows(rows(), { ...F, sector: "Digital, AI & ICT" }).map((r) => r.id)).toEqual(["founder"]);
  });
  it("by free text across every field, ignoring case", () => { expect(filterRows(rows(), { ...F, q: "SAXONY" }).map((r) => r.id)).toEqual(["brandt"]); expect(filterRows(rows(), { ...F, q: "software platform" }).map((r) => r.id)).toEqual(["founder"]); expect(filterRows(rows(), { ...F, q: "already ordered" }).map((r) => r.id)).toEqual(["brandt"]); expect(filterRows(rows(), { ...F, q: "zzz" })).toEqual([]); });
  it("combines filters", () => expect(filterRows(rows(), { ...F, country: "Germany", status: "No" }).map((r) => r.id)).toEqual(["mueller"]));
  it("lists the sectors that are present, once each", () => { const s = sectorOptions(rows()); expect(new Set(s).size).toBe(s.length); expect(s).toContain("Industry & manufacturing"); expect(s.every((x) => !x.includes(";"))).toBe(true); });
});
describe("sorting", () => {
  const ids = (k: string, d: 1 | -1) => sortRows(rows(), k, d).map((r) => r.id);
  it("by date, newest first or oldest first", () => { expect(ids("call_date", -1)).toEqual(["chat", "large", "founder", "mueller", "brandt"]); expect(ids("call_date", 1)).toEqual(["brandt", "mueller", "founder", "large", "chat"]); });
  it("by budget as a number, with empty budgets last either way", () => { expect(ids("planned_investment_eur", -1).slice(0, 4)).toEqual(["large", "mueller", "brandt", "founder"]); expect(ids("planned_investment_eur", 1).slice(0, 4)).toEqual(["founder", "brandt", "mueller", "large"]); expect(ids("planned_investment_eur", -1)[4]).toBe("chat"); expect(ids("planned_investment_eur", 1)[4]).toBe("chat"); });
  it("by text, with empty values last", () => { const c = ids("company_name", 1); expect(c.slice(0, 2)).toEqual(["brandt", "mueller"]); expect(c.slice(2).sort()).toEqual(["chat", "founder", "large"]); });
  it("does not change the list it was given", () => { const r = rows(); const before = r.map((x) => x.id); sortRows(r, "company_name", 1); expect(r.map((x) => x.id)).toEqual(before); });
});
describe("export", () => {
  it("writes CSV with the version, the call id and all twenty fields, one line per call", () => {
    const csv = callsToCsv(rows()); const lines = csv.trim().split("\n"); expect(lines).toHaveLength(6); const head = lines[0].split(","); expect(head.slice(0, 2)).toEqual(["crm_version", "call_id"]); expect(head).toHaveLength(2 + CRM_KEYS.length); expect(CRM_KEYS).toHaveLength(20);
    expect(lines[1].startsWith("1,brandt,Brandt Metallbau")).toBe(true);
  });
  it("cannot be turned into a spreadsheet formula, and quotes properly", () => {
    const r = rowOf("demo", { edits: { company_name: '=HYPERLINK("http://x")', region: "+31 6 12", project_description: 'say "hi", twice' } }); const csv = callsToCsv([r]);
    expect(csv).toContain("'=HYPERLINK"); expect(csv).toContain("'+31 6 12"); expect(csv).toContain('"say ""hi"", twice"'); expect(callsToTsv([r], MAIN)).toContain("'=HYPERLINK");
  });
  it("writes JSON with nulls for what was not said", () => { const j = JSON.parse(callsToJson(rows())); expect(j.crm_version).toBe("1"); expect(j.calls).toHaveLength(5); const chat = j.calls.find((c: { call_id: string }) => c.call_id === "chat"); expect(chat.record.company_name).toBeNull(); expect(Object.keys(chat.record)).toEqual(CRM_KEYS); });
  it("copies only the columns on screen, tab-separated, one clean line per call", () => { const t = callsToTsv(rows(), MAIN); const lines = t.trim().split("\n"); expect(lines).toHaveLength(6); expect(lines[0].split("\t")).toEqual(MAIN.map((c) => c.label)); for (const l of lines) expect(l.split("\t")).toHaveLength(10); expect(t).toContain("Already ordered or started"); expect(t).not.toMatch(/\t\t\t\t\t\t\t\t\t\t/); });
  it("exports the filtered rows only when given them", () => expect(callsToCsv(filterRows(rows(), { ...F, country: "Germany" })).trim().split("\n")).toHaveLength(3));
});
describe("sample calls and saved dates", () => {
  it("make four varied, fictional rows with fixed ids and different dates", () => {
    const s = sampleCalls(T0); expect(s.map((x) => x.id)).toEqual(["sample-brandt", "sample-mueller", "sample-founder", "sample-demo"]); expect(new Set(s.map((x) => x.created)).size).toBe(4); for (const n of s) expect(n.title).toMatch(/fictional/);
    const r = s.map(buildRow); expect(r.map((x) => x.fields.ordered_or_started)).toEqual(["Yes", "No", "", "No"]); expect(new Set(r.map((x) => x.fields.country)).size).toBeGreaterThan(1);
  });
  it("keeps the date a call was made, and falls back for old saved notes", () => {
    const got = sanitizeNotes([{ id: "a", title: "t", updated: 50, created: 20, transcript: "we plan to buy a boiler" }, { id: "b", title: "t", updated: 70, transcript: "we plan to buy a boiler" }, { id: "c", title: "t", updated: 9, created: -4, transcript: "we plan to buy a boiler" }]);
    expect(Object.fromEntries(got.map((n) => [n.id, n.created]))).toEqual({ a: 20, b: 70, c: 9 });
  });
});

import { callStats } from "@/lib/notes/calls";
describe("the at-a-glance figures", () => {
  it("count calls by status and add up the budgets that were mentioned", () => {
    const s = callStats(sampleCalls(T0).map(buildRow)); expect(s).toMatchObject({ total: 4, notOrdered: 2, ordered: 1, notMentioned: 1, withBudget: 4, budget: 1200000 + 2500000 + 50000 + 300000 });
  });
  it("ignore calls with no budget, and cope with no calls", () => {
    const s = callStats([buildRow(note("c", fx("chat"))), rowOf("founder")]); expect(s).toMatchObject({ total: 2, withBudget: 1, budget: 50000 }); expect(callStats([])).toEqual({ total: 0, notOrdered: 0, ordered: 0, notMentioned: 0, budget: 0, withBudget: 0 });
  });
  it("always add up: every call has exactly one status", () => { const s = callStats(rows()); expect(s.notOrdered + s.ordered + s.notMentioned).toBe(s.total); });
});
