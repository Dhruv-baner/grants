const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Finds a quoted passage in the transcript, forgiving differences in case, spacing and punctuation. Returns its position in the original text, or null. */
export function findInTranscript(transcript: string, quote: string): { start: number; end: number } | null {
  const q = (quote ?? "").trim(); if (q.length < 4) return null;
  const direct = transcript.indexOf(q); if (direct >= 0) return { start: direct, end: direct + q.length };
  const toks = q.split(/\s+/).map((x) => x.replace(/^[^\p{L}\p{N}€$]+|[^\p{L}\p{N}%]+$/gu, "")).filter(Boolean); if (toks.length < 2) return null;
  const m = new RegExp(toks.map(esc).join("[\\s,.;:!?\"'\u2019\u201c\u201d()\\-\u2013\u2014]+"), "iu").exec(transcript);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}
export const quoteInTranscript = (t: string, q: string) => findInTranscript(t, q) !== null;
