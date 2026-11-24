// A quality report for Claude's notes on the twelve fictional calls. It does nothing unless you ask for it, because it needs a real key and costs a few cents:
//   RUN_LIVE=1 ANTHROPIC_API_KEY=sk-ant-... npx vitest run tests/notes.live.test.ts
import { describe, expect, it } from "vitest";
import { AnthropicLlm } from "@/lib/llm";
import { enhanceNotes } from "@/lib/notes/enhance";
import { extractNotes } from "@/lib/notes/extract";
import { FIXTURES } from "@/lib/notes/fixtures";
import { quoteInTranscript } from "@/lib/notes/quote";

const live = !!process.env.RUN_LIVE && !!process.env.ANTHROPIC_API_KEY;
describe.skipIf(!live)("Claude's notes on the fictional calls (needs RUN_LIVE=1 and a key)", () => {
  it("reports what it caught, what it dropped, and what it cost", async () => {
    const llm = new AnthropicLlm(process.env.ANTHROPIC_API_KEY!); const rows: string[] = []; let tokensIn = 0, tokensOut = 0, kept = 0, dropped = 0, caught = 0, expected = 0;
    for (const f of FIXTURES) {
      const rules = extractNotes(f.text); const r = await enhanceNotes(f.text, llm); tokensIn += r.usage.in; tokensOut += r.usage.out; kept += r.kept; dropped += r.dropped;
      const e = f.expect; const n = r.note; const checks: [string, boolean][] = [];
      if (e.amountEur) checks.push(["amount", n.nums.amountEur === e.amountEur]); if (e.employees) checks.push(["employees", n.nums.employees === e.employees]);
      if (e.ordered) checks.push(["ordered", n.ordered === e.ordered]); if (e.timing) checks.push(["timing", (n.facts.timing?.value ?? "").toLowerCase().includes(e.timing.toLowerCase())]);
      if (e.project) checks.push(["project", (n.facts.project?.value ?? "").toLowerCase().includes(e.project.toLowerCase())]); if (e.decision) checks.push(["decision", (n.facts.decision?.value ?? "").toLowerCase().includes(e.decision.toLowerCase())]);
      if (e.nextWhen) checks.push(["next step date", n.nextSteps.some((s) => s.when === e.nextWhen)]);
      expected += checks.length; caught += checks.filter(([, ok]) => ok).length;
      // these must hold whatever the model says: nothing unverified gets through
      for (const p of n.keyPoints) expect(quoteInTranscript(f.text, p.quote), `${f.id}: ${p.text}`).toBe(true);
      for (const bad of e.forbid ?? []) expect(JSON.stringify(n).toLowerCase(), `${f.id} must not contain ${bad}`).not.toContain(bad.toLowerCase());
      if (e.noFacts) expect(n.keyPoints.length, `${f.id} is chit-chat`).toBe(0);
      rows.push(`${f.id.padEnd(11)} ${r.reason ?? "ok".padEnd(16)} kept ${String(r.kept).padStart(2)} dropped ${String(r.dropped).padStart(2)}  facts ${checks.filter(([, ok]) => ok).length}/${checks.length}  (rules alone: ${rules.keyPoints.length} points)${checks.filter(([, ok]) => !ok).length ? "  missed: " + checks.filter(([, ok]) => !ok).map(([k]) => k).join(", ") : ""}`);
    }
    console.log("\nCLAUDE NOTES REPORT\n" + rows.join("\n") + `\nfacts caught ${caught}/${expected} (${Math.round((100 * caught) / Math.max(1, expected))}%) | statements kept ${kept}, dropped ${dropped} | tokens in ${tokensIn}, out ${tokensOut} over ${FIXTURES.length} calls\n`);
    expect(expected).toBeGreaterThan(0);
  }, 300_000);
});
