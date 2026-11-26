"use client";
import { companion, coveredCount } from "@/lib/notes/companion";
import type { NoteResult } from "@/lib/notes/types";

/** What a call should cover, ticking itself as the transcript says it. A tick by hand is possible for anything the transcript missed. */
export default function Companion({ note, manual, onToggle }: { note: NoteResult; manual: Record<string, boolean>; onToggle: (id: string) => void }) {
  const items = companion(note), n = coveredCount(items, manual);
  return (
    <details className="cmp" open>
      <summary><span>To cover on the call</span><span className="cmp-n mono" aria-live="polite">{n} of {items.length} covered</span></summary>
      <div className="cmp-bar" role="progressbar" aria-label="Items covered" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={n}><i style={{ width: `${(n / items.length) * 100}%` }} /></div>
      <ul className="cmp-list">{items.map(({ item, value }) => { const done = !!value, hand = !done && !!manual[item.id]; const body = <><span className="cmp-box" aria-hidden="true">{done || hand ? "✓" : ""}</span><span className="cmp-t"><b>{item.label}</b><span>{done ? value : hand ? "Covered, ticked by you" : item.ask}</span></span></>;
        return <li key={item.id} className={done ? "done" : hand ? "hand" : ""} title={item.why}>{done ? <div className="cmp-row"><span className="sr">Covered: </span>{body}</div> : <button type="button" className="cmp-row" aria-pressed={hand} onClick={() => onToggle(item.id)}>{body}</button>}</li>; })}</ul>
      <p className="cmp-foot">Ticks come only from what was said. Tap an open item once you have covered it.</p>
    </details>
  );
}
