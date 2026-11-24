export type FactKey = "company" | "website" | "country" | "region" | "size" | "sector" | "activity" | "project" | "amount" | "timing" | "ordered" | "previous" | "decision";
/** A fact is only ever filled in when the transcript says it; `quote` is the exact passage. `inferred` means derived from a stated fact (for example a size band from a headcount). */
export interface Fact { value: string; quote: string | null; how: "stated" | "inferred"; }
export interface KeyPoint { text: string; quote: string; }
export interface NextStep { what: string; when?: string; quote: string; }
export interface OpenQuestion { text: string; kind: "said" | "gap"; quote?: string; }
export interface ProgRef { id: string; label: string; covered: boolean; quote: string | null; }
export type Ordered = "yes" | "no" | "unknown";
export interface NoteResult {
  summary: string; keyPoints: KeyPoint[]; facts: Partial<Record<FactKey, Fact>>; nums: { amountEur?: number; employees?: number };
  ordered: Ordered; openQuestions: OpenQuestion[]; nextSteps: NextStep[]; programmes: ProgRef[]; words: number; source: "rules" | "claude";
}
