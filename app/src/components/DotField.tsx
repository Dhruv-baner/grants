"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { SCHEMES } from "@/lib/data";
import { useReducedMotion } from "@/lib/fx";
import { countryGroup, fmtDate, LABEL } from "@/lib/ui";
import type { Scheme } from "@/lib/types";

const COLS = 19, GAP = 26, PAD = 18, ORDER = ["NL", "DE", "EU", "Cross-border"];
const SORTED = [...SCHEMES].sort((a, b) => ORDER.indexOf(countryGroup(a)) - ORDER.indexOf(countryGroup(b)) || a.sector.localeCompare(b.sector) || a.name.localeCompare(b.name));
const POS = SORTED.map((s, i) => { const row = Math.floor(i / COLS), col = i % COLS; return { s, x: PAD + col * GAP + (row % 2 ? GAP / 2 : 0), y: PAD + row * GAP * 0.88 }; });
const ROWS = Math.ceil(SORTED.length / COLS), W = PAD * 2 + COLS * GAP + GAP / 2, H = PAD * 2 + (ROWS - 1) * GAP * 0.88;
const rOf = (s: Scheme) => (s.row_type === "call" ? 3.9 : 6);
const describe = (s: Scheme) => `${s.name}. ${s.country}, ${s.type_group}. ${LABEL[s.status_clean] ?? s.status_clean}${s.closes_date ? ", closes " + fmtDate(s.closes_date) : ""}.`;

export interface DotFieldProps { lit?: Record<string, "high" | "medium" | "low">; rings?: string[]; ambient?: boolean; paper?: boolean; onPick?: (s: Scheme) => void; label: string; }
export default function DotField({ lit, rings, ambient, paper, onPick, label }: DotFieldProps) {
  const wrap = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), dots = useRef<(SVGCircleElement | null)[]>([]);
  const reduced = useReducedMotion(); const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null); const [active, setActive] = useState(-1);
  const ringSet = useMemo(() => new Set(rings ?? []), [rings]);
  const rank = useMemo(() => { const m = new Map<string, number>(); Object.keys(lit ?? {}).sort((a, b) => ({ high: 0, medium: 1, low: 2 }[lit![a]] - { high: 0, medium: 1, low: 2 }[lit![b]])).forEach((id, n) => m.set(id, n)); return m; }, [lit]);
  const place = (i: number, el: Element) => { const c = wrap.current!.getBoundingClientRect(), b = el.getBoundingClientRect(); setTip({ i, x: b.left + b.width / 2 - c.left, y: b.top - c.top }); };

  useEffect(() => {   // ambient mode: dots near the pointer warm up; an occasional spark runs while idle
    if (!ambient || reduced) return; const el = svg.current!; let last = 0;
    const move = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; last = Date.now(); const r = el.getBoundingClientRect(); const sx = ((e.clientX - r.left) * W) / r.width, sy = ((e.clientY - r.top) * H) / r.height;
      POS.forEach((p, i) => { const d = dots.current[i]; if (!d) return; const k = Math.max(0, 1 - Math.hypot(p.x - sx, p.y - sy) / 90); d.style.fillOpacity = k > 0.04 ? String(0.17 + k * 0.83) : ""; d.style.fill = k > 0.1 ? "var(--ember)" : ""; d.style.transform = k > 0.04 ? `scale(${1 + k * 0.8})` : ""; }); };
    const leave = () => { dots.current.forEach((d) => { if (d) { d.style.fillOpacity = ""; d.style.fill = ""; d.style.transform = ""; } }); };
    const idle = window.setInterval(() => { if (Date.now() - last < 3500) return; const c = POS[Math.floor(Math.random() * POS.length)];
      POS.forEach((p, i) => { if (Math.hypot(p.x - c.x, p.y - c.y) < 62) { const d = dots.current[i]; if (!d) return; d.style.setProperty("--delay", Math.round(Math.hypot(p.x - c.x, p.y - c.y) * 5) + "ms"); d.classList.add("lit"); window.setTimeout(() => { d.classList.remove("lit"); d.style.removeProperty("--delay"); }, 2000); } }); }, 2300);
    el.addEventListener("pointermove", move); el.addEventListener("pointerleave", leave); return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); window.clearInterval(idle); };
  }, [ambient, reduced]);

  const key = (e: React.KeyboardEvent) => {
    const n = POS.length; let a = active; if (e.key === "ArrowRight") a = a < 0 ? 0 : Math.min(n - 1, a + 1); else if (e.key === "ArrowLeft") a = Math.max(0, a - 1);
    else if (e.key === "ArrowDown") a = a < 0 ? 0 : Math.min(n - 1, a + COLS); else if (e.key === "ArrowUp") a = Math.max(0, a - COLS);
    else if (e.key === "Enter" && active >= 0) { onPick?.(POS[active].s); return; } else if (e.key === "Escape") { setActive(-1); setTip(null); return; } else return;
    e.preventDefault(); setActive(a); const el = dots.current[a]; if (el) place(a, el);
  };
  return (
    <div ref={wrap} className={"dotfield" + (paper ? " on-paper" : "")} tabIndex={0} role="group" aria-label={`${label}. Use the arrow keys to move between schemes and Enter to open one.`} onKeyDown={key} onBlur={() => { setActive(-1); setTip(null); }}>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {POS.map(({ s, x, y }, i) => { const f = lit?.[s.id]; const d = (rank.get(s.id) ?? 0) * 55; const sty = { ["--delay" as string]: Math.min(d, 1300) + "ms" } as React.CSSProperties;
          return (
            <g key={s.id}>
              {f && <circle className="halo on" cx={x} cy={y} r={rOf(s) + 2} style={sty} />}
              <circle ref={(el) => { dots.current[i] = el; }} className={"dot" + (f ? " lit " + f : "") + (ringSet.has(s.id) ? " ring" : "") + (active === i ? " focus" : "")} cx={x} cy={y} r={rOf(s)} style={sty}
                onPointerEnter={(e) => place(i, e.currentTarget)} onPointerLeave={() => setTip(null)} onClick={() => onPick?.(s)} />
            </g>); })}
      </svg>
      {tip && <div className="tip" style={{ left: tip.x, top: tip.y }}><b>{POS[tip.i].s.name}</b><span className="mono">{POS[tip.i].s.country} · {LABEL[POS[tip.i].s.status_clean]}{POS[tip.i].s.closes_date ? " · " + fmtDate(POS[tip.i].s.closes_date) : ""}</span></div>}
      <div className="sr" aria-live="polite">{active >= 0 ? describe(POS[active].s) : ""}</div>
    </div>
  );
}
