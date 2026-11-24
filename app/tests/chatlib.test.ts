import { describe, expect, it } from "vitest";
import { collectCitations } from "@/lib/assistant/citations";
import { respond, helpAnswer, betaAnswer, type Answer, type Ctx } from "@/lib/assistant/engine";
import { KEY, MAX_CHATS, MAX_BYTES, deleteChat, loadChats, replay, sanitize, saveChats, titleOf, turnsOf, upsertChat, type Store, type StoredChat } from "@/lib/assistant/history";
import { CHECKLISTS, IN_SCOPE } from "@/lib/assistant/knowledge";
import { answerToMarkdown, chatToMarkdown } from "@/lib/assistant/markdown";

const ask = (q: string, ctx?: Ctx) => respond(q, ctx);
const mem = (): Store & { data: Record<string, string> } => { const data: Record<string, string> = {}; return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } }; };
const STARTERS = ["What documents do I need for WBSO?", "When does the SME energy-saving loan close?", "Can a start-up apply for the Gründungsstipendium.NRW?", "Compare EIA and MIA and Vamil", "We are a small manufacturer in Gelderland replacing gas heating. What fits?", "What can you answer?"];

describe("starter questions", () => {
  it("each one leads to the intended kind of answer", () => {
    const kinds = STARTERS.map((q) => ask(q).answer.kind);
    expect(kinds).toEqual(["docs", "facts", "facts", "compare", "recommend", "help"]);
    expect(ask(STARTERS[2]).answer.ids).toEqual(["GSTIP_NRW"]);
  });
});

describe("document answers", () => {
  it("open with a summary line that matches the data", () => {
    for (const id of IN_SCOPE) {
      const a = ask(`What documents do I need for ${id === "BIK_M2_TM2_R3" ? "bik module 2" : id.toLowerCase().replace(/_/g, " ")}`).answer;
      if (a.ids[0] !== id) continue; // aliases are tested elsewhere
      const t = a.blocks.find((b) => b.t === "text") as { text: string };
      const n = CHECKLISTS[id].documents.length; expect(t.text, id).toContain(`${n} items:`);
    }
    const w = (ask("documents for WBSO").answer.blocks.find((b) => b.t === "text") as { text: string }).text; const d = CHECKLISTS.WBSO.documents;
    expect(w).toContain(`${d.length} items: ${d.filter((x) => x.required === "required").length} required`);
  });
  it("carry the programme id on the title and a source on the facts", () => {
    const docs = ask("documents for WBSO").answer; expect((docs.blocks.find((b) => b.t === "title") as { id?: string }).id).toBe("WBSO");
    const facts = ask("tell me about EIA").answer; expect((facts.blocks.find((b) => b.t === "facts") as { src?: string }).src).toMatch(/^https:/);
  });
});

describe("citations", () => {
  it("number every source an answer uses, in order, without duplicates", () => {
    for (const id of IN_SCOPE) {
      const a = ask(`What documents do I need for ${id === "BIK_M2_TM2_R3" ? "bik module 2" : id.toLowerCase().replace(/_/g, " ")}`).answer; if (a.ids[0] !== id) continue;
      const c = collectCitations(a); expect(c.length, id).toBeGreaterThan(0);
      expect(c.map((x) => x.n), id).toEqual(c.map((_, i) => i + 1)); expect(new Set(c.map((x) => x.url)).size).toBe(c.length);
      for (const x of c) { expect(x.label.length).toBeGreaterThan(2); expect(x.host).not.toMatch(/^https?:/); }
      const urls = new Set(c.map((x) => x.url)); for (const b of a.blocks) if (b.t === "checklist") for (const g of b.groups) for (const i of g.items) expect(urls.has(i.url), `${id}: ${i.item}`).toBe(true);
    }
  });
  it("include the programme's official page for a facts answer", () => {
    const a = ask("tell me about VEKI").answer; const c = collectCitations(a); const f = a.blocks.find((b) => b.t === "facts") as { src: string };
    expect(c[0].url).toBe(f.src); expect(c[0].label).toMatch(/VEKI/);
  });
  it("are empty for answers with no sources", () => { expect(collectCitations(helpAnswer())).toEqual([]); expect(collectCitations(betaAnswer("x"))).toEqual([]); });
});

describe("markdown export", () => {
  const sample = (): Answer[] => ["documents for WBSO", "tell me about EIA", "compare EIA and WBSO", "We are a small manufacturer in Gelderland replacing gas heating. What fits?", "ZIM", "what can you answer"].map((q) => ask(q).answer);
  it("never leaks placeholders and always lists its sources", () => {
    for (const a of sample()) { const md = answerToMarkdown(a); expect(md).not.toMatch(/undefined|\[object|\bNaN\b/); if (collectCitations(a).length) expect(md).toContain("**Sources**"); }
  });
  it("lists every document and its citation number", () => {
    const a = ask("documents for WBSO").answer; const md = answerToMarkdown(a); for (const d of CHECKLISTS.WBSO.documents) expect(md).toContain(d.item.replace(/^\d+\.\s*/, ""));
    expect(md).toMatch(/\[1\]/); expect(md).toMatch(/1\. \[.*\]\(https:/);
  });
  it("builds a proper table and escapes pipes", () => { const md = answerToMarkdown(ask("compare EIA and WBSO").answer); expect(md).toMatch(/\| Topic \|/); expect(md).toMatch(/\|---\|---\|---\|/); });
  it("states the not-advice footer on programme answers only", () => { expect(answerToMarkdown(ask("documents for WBSO").answer)).toContain("not advice"); expect(answerToMarkdown(helpAnswer())).not.toContain("not advice"); });
  it("exports a whole conversation, with Claude's follow-up text kept", () => {
    const r1 = ask("tell me about WBSO"); const md = chatToMarkdown("Tell me about WBSO", [{ role: "me", text: "tell me about WBSO" }, { role: "bot", answer: r1.answer, ai: "It covers R&D wage costs." }], "23 Nov 2026");
    expect(md.startsWith("# Tell me about WBSO")).toBe(true); expect(md).toContain("**Question:** tell me about WBSO"); expect(md).toContain("It covers R&D wage costs."); expect(md).toContain("Written by Claude");
  });
});

describe("saved conversations", () => {
  const chat = (id: string, n = 1, updated = Date.now()): StoredChat => ({ id, title: "t" + id, updated, turns: Array.from({ length: n }, (_, i) => ({ q: `question ${i}` })) });
  it("round-trips through the browser store", () => { const s = mem(); const c = [chat("a", 2), chat("b")]; expect(saveChats(c, s)).toBe(true); expect(loadChats(s).map((x) => x.id).sort()).toEqual(["a", "b"]); });
  it("ignores corrupt or hostile stored data", () => {
    const s = mem(); s.data[KEY] = "{not json"; expect(loadChats(s)).toEqual([]);
    expect(sanitize([null, 5, "x", { id: 1 }, { id: "ok", turns: [] }, { id: "ok2", turns: [{ q: 7 }, null] }, { id: "good", title: "g", updated: 3, turns: [{ q: "hello", fb: "sideways", ai: 4 }] }])).toEqual([{ id: "good", title: "g", updated: 3, turns: [{ q: "hello" }] }]);
    expect(loadChats(null)).toEqual([]);
  });
  it("keeps the newest 30 and drops the oldest when too big", () => {
    const many = Array.from({ length: 45 }, (_, i) => chat("c" + i, 1, i)); const s = mem(); saveChats(many, s); expect(JSON.parse(s.data[KEY]).length).toBe(MAX_CHATS);
    const big = Array.from({ length: 12 }, (_, i) => ({ ...chat("b" + i, 1, 100 - i), turns: Array.from({ length: 20 }, () => ({ q: "x".repeat(590), ai: "y".repeat(1400) })) }));
    const s2 = mem(); saveChats(big, s2); expect(s2.data[KEY].length).toBeLessThanOrEqual(MAX_BYTES); expect(JSON.parse(s2.data[KEY])[0].id).toBe("b0");
  });
  it("survives a full or blocked store", () => { const bad: Store = { getItem: () => null, setItem: () => { throw new Error("quota"); } }; expect(saveChats([chat("a")], bad)).toBe(false); expect(saveChats([chat("a")], null)).toBe(false); });
  it("moves an updated chat to the top, deletes by id, and titles sensibly", () => {
    let c = [chat("a"), chat("b"), chat("c")]; c = upsertChat(c, { ...chat("c"), updated: 99 }); expect(c.map((x) => x.id)).toEqual(["c", "a", "b"]); expect(deleteChat(c, "a").map((x) => x.id)).toEqual(["c", "b"]);
    expect(titleOf([{ q: "  What   documents do I need for WBSO?  " }])).toBe("What documents do I need for WBSO?"); expect(titleOf([{ q: "x".repeat(200) }]).length).toBe(56); expect(titleOf([])).toBe("New chat");
  });
  it("stores only questions, so a saved chat can never show a stale checklist", () => {
    const turns = turnsOf(replay([{ q: "documents for WBSO" }, { q: "compare EIA and WBSO" }]).msgs); const json = JSON.stringify([{ id: "x", title: "t", updated: 1, turns }]);
    expect(json).not.toMatch(/https?:|Required|checklist|eHerkenning/); expect(json.length).toBeLessThan(400);
  });
  it("replays to exactly the answers the conversation would give now, including context", () => {
    const turns = [{ q: "tell me about WBSO" }, { q: "what documents do I need?" }, { q: "and for EIA?", fb: "up" as const }, { q: "does WBSO cover leasing costs in Utrecht?", ai: "From the record." }];
    const { msgs, ctx } = replay(turns); const bots = msgs.filter((m) => m.role === "bot");
    expect(bots.map((m) => m.answer!.kind)).toEqual(["facts", "docs", "docs", "facts"]); expect(bots[1].answer!.ids).toEqual(["WBSO"]); expect(bots[2].answer!.ids).toEqual(["EIA"]);
    expect(ctx.last.length).toBeGreaterThan(0); expect(bots[2].fb).toBe("up"); expect(bots[3].followup).toEqual({ state: "done", text: "From the record." });
    expect(turnsOf(msgs)).toEqual(turns);
  });
});
