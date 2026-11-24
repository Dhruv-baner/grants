import type { Answer } from "./engine";
import { hostOf, labelForUrl } from "./knowledge";

export interface Citation { n: number; url: string; label: string; host: string; }
/** Numbers every source an answer relies on, in order of first use, so the text can say [1] and the cards below can match. */
export function collectCitations(a: Answer): Citation[] {
  const out: Citation[] = []; const idx = new Map<string, number>(); const labels = new Map<string, string>();
  for (const b of a.blocks) if (b.t === "sources") for (const s of b.items) labels.set(s.url, s.label);
  const add = (url: string | undefined) => { if (!url || !/^https?:\/\//i.test(url) || idx.has(url)) return; idx.set(url, out.length + 1); out.push({ n: out.length + 1, url, label: labels.get(url) ?? labelForUrl(url), host: hostOf(url) }); };
  for (const b of a.blocks) {
    if (b.t === "facts") add(b.src);
    else if (b.t === "estimate") add(b.src);
    else if (b.t === "combine") for (const p of b.pairs) add(p.source?.url);
    else if (b.t === "checklist") for (const g of b.groups) for (const i of g.items) add(i.url);
    else if (b.t === "list") for (const g of b.groups) for (const i of g.items) add(i.url);
    else if (b.t === "sources") for (const s of b.items) add(s.url);
  }
  return out;
}
export const citeNumber = (cites: Citation[], url: string) => cites.find((c) => c.url === url)?.n;
