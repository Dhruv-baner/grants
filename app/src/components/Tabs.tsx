"use client";
import { useRef, type KeyboardEvent } from "react";

export interface TabDef { id: string; label: string; count?: number; }
/** Accessible tabs: arrow keys move between them, Home and End jump to the ends. The panels are rendered by the page with role="tabpanel". */
export default function Tabs({ tabs, active, onChange, label }: { tabs: TabDef[]; active: string; onChange: (id: string) => void; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1; if (to < 0) return;
    e.preventDefault(); onChange(tabs[to].id); refs.current[tabs[to].id]?.focus();
  };
  return <div className="tabs noprint" role="tablist" aria-label={label}>{tabs.map((t, i) => <button key={t.id} ref={(el) => { refs.current[t.id] = el; }} type="button" role="tab" id={`tab-${t.id}`} aria-selected={active === t.id} aria-controls={`panel-${t.id}`} tabIndex={active === t.id ? 0 : -1} onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}>{t.label}{t.count !== undefined && <span className="tcount mono">{t.count}</span>}</button>)}</div>;
}
