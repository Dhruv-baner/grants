import { describe, expect, it } from "vitest";
import golden from "./golden.json";
import { match } from "@/lib/matcher";
import { buildBrief } from "@/lib/explainer";
import { SCHEMES, BY_ID } from "@/lib/data";
import type { Profile } from "@/lib/types";

const slim = (l: any[]) => l.map((e) => ({ scheme_id: e.scheme_id, score: e.score, fit: e.fit ?? null, reasons: e.reasons, flags: e.flags }));
const gslim = (l: any[]) => l.map((e) => ({ ...e, fit: e.fit ?? null }));

describe("TypeScript matcher equals the Python matcher", () => {
  it("has the golden cases", () => expect(golden.length).toBe(95));
  golden.forEach((g: any, i: number) => {
    it(`case ${i}: ${g.profile.country} ${g.profile.size} ${g.profile.region || "-"}`, () => {
      const r = match(g.profile as Profile, SCHEMES);
      expect(slim(r.matches)).toEqual(gslim(g.matches));
      expect(slim(r.not_open)).toEqual(gslim(g.not_open));
      expect(slim(r.check_manually)).toEqual(gslim(g.check_manually));
      expect(r.excluded).toEqual(g.excluded);
    });
    it(`case ${i}: template brief text equals Python`, () => {
      const r = match(g.profile as Profile, SCHEMES);
      const b = buildBrief(g.profile as Profile, r, BY_ID, "2026-11-17");
      expect(b.matches.map((m) => ({ scheme_id: m.scheme_id, why: m.why_it_fits, watch: m.watch_outs, questions: m.questions, key_terms: m.key_terms }))).toEqual(g.brief);
    });
  });
});
