"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { META, SCHEMES } from "@/lib/data";
import { useReducedMotion } from "@/lib/fx";
import { countryGroup, daysBetween, fmtDate, LABEL } from "@/lib/ui";
import type { Scheme } from "@/lib/types";

const COLS = 19, GAP = 26, PAD = 18, ORDER = ["NL", "DE", "EU", "Cross-border"];
const SORTED = [...SCHEMES].sort((a, b) => ORDER.indexOf(countryGroup(a)) - ORDER.indexOf(countryGroup(b)) || a.sector.localeCompare(b.sector) || a.name.localeCompare(b.name));
const POS = SORTED.map((s, i) => { const row = Math.floor(i / COLS), col = i % COLS; return { s, x: PAD + col * GAP + (row % 2 ? GAP / 2 : 0), y: PAD + row * GAP * 0.88 }; });
const ROWS = Math.ceil(SORTED.length / COLS), W = PAD * 2 + COLS * GAP + GAP / 2, H = PAD * 2 + (ROWS - 1) * GAP * 0.88, CX = W / 2, CY = H / 2;
const rOf = (s: Scheme) => (s.row_type === "call" ? 3.9 : 6);
const rnd = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const SOON = POS.map(({ s }) => ["open", "opening_soon"].includes(s.status_clean) && !!s.closes_date && daysBetween(META.as_of, s.closes_date) >= 0 && daysBetween(META.as_of, s.closes_date) <= 35);
const describe = (s: Scheme) => `${s.name}. ${s.country}, ${s.type_group}. ${LABEL[s.status_clean] ?? s.status_clean}${s.closes_date ? ", closes " + fmtDate(s.closes_date) : ""}.`;
export const SOON_COUNT = SOON.filter(Boolean).length;

export interface DotFieldProps { lit?: Record<string, "high" | "medium" | "low">; rings?: string[]; ambient?: boolean; urgent?: boolean; paper?: boolean; onPick?: (s: Scheme) => void; label: string; }
export default function DotField({ lit, rings, ambient, urgent, paper, onPick, label }: DotFieldProps) {
  const wrap = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), dots = useRef<(SVGCircleElement | null)[]>([]);
  const reduced = useReducedMotion(); const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null); const [active, setActive] = useState(-1);
  const ringSet = useMemo(() => new Set(rings ?? []), [rings]);
  const halos = Object.keys(lit ?? {}).length <= 18;   // glow rings blur together when many dots are lit
  const rank = useMemo(() => { const m = new Map<string, number>(); const o = { high: 0, medium: 1, low: 2 }; Object.keys(lit ?? {}).sort((a, b) => o[lit![a]] - o[lit![b]]).forEach((id, n) => m.set(id, n)); return m; }, [lit]);
  const place = (i: number, el: Element) => { const c = wrap.current!.getBoundingClientRect(), b = el.getBoundingClientRect(); setTip({ i, x: b.left + b.width / 2 - c.left, y: b.top - c.top }); };
  const toSvg = (e: { clientX: number; clientY: number }) => { const r = svg.current!.getBoundingClientRect(); return { sx: ((e.clientX - r.left) * W) / r.width, sy: ((e.clientY - r.top) * H) / r.height }; };

  useEffect(() => {   // pointer: nearby dots swell and are pushed away; in ambient mode they also warm up; idle sparks run on their own
    if (reduced) return; const el = svg.current!; let last = 0;
    const clear = () => dots.current.forEach((d) => { if (d) { d.style.translate = ""; d.style.scale = ""; if (ambient) { d.style.fillOpacity = ""; d.style.fill = ""; } } });
    const move = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; last = Date.now(); const { sx, sy } = toSvg(e);
      POS.forEach((p, i) => { const d = dots.current[i]; if (!d) return; const dx = p.x - sx, dy = p.y - sy, dist = Math.hypot(dx, dy), k = Math.max(0, 1 - dist / 85);
        if (k > 0.02) { const push = (k * 13) / (dist || 1); d.style.translate = `${dx * push}px ${dy * push}px`; d.style.scale = String(1 + k * 0.9); if (ambient) { d.style.fillOpacity = String(Math.min(1, 0.2 + k)); d.style.fill = "var(--ember)"; } }
        else { d.style.translate = ""; d.style.scale = ""; if (ambient) { d.style.fillOpacity = ""; d.style.fill = ""; } } }); };
    const idle = ambient ? window.setInterval(() => { if (Date.now() - last < 3500) return; const c = POS[Math.floor(Math.random() * POS.length)];
      POS.forEach((p, i) => { const dist = Math.hypot(p.x - c.x, p.y - c.y); if (dist < 62) { const d = dots.current[i]; if (!d) return; d.style.setProperty("--delay", Math.round(dist * 5) + "ms"); d.classList.add("lit"); window.setTimeout(() => { d.classList.remove("lit"); d.style.removeProperty("--delay"); }, 2000); } }); }, 2300) : 0;
    el.addEventListener("pointermove", move); el.addEventListener("pointerleave", clear);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", clear); if (idle) window.clearInterval(idle); };
  }, [ambient, reduced]);

  const ripple = (e: React.MouseEvent) => {   // a shockwave spreads from the click through the whole field
    if (reduced) return; const { sx, sy } = toSvg(e);
    POS.forEach((p, i) => { const d = dots.current[i]; if (!d || !d.animate) return; d.animate({ scale: ["1", "2.7", "1"] } as PropertyIndexedKeyframes, { duration: 800, delay: Math.hypot(p.x - sx, p.y - sy) * 2.6, easing: "cubic-bezier(.2,.7,.1,1)" }); });
  };
  const key = (e: React.KeyboardEvent) => {
    const n = POS.length; let a = active; if (e.key === "ArrowRight") a = a < 0 ? 0 : Math.min(n - 1, a + 1); else if (e.key === "ArrowLeft") a = Math.max(0, a - 1);
    else if (e.key === "ArrowDown") a = a < 0 ? 0 : Math.min(n - 1, a + COLS); else if (e.key === "ArrowUp") a = Math.max(0, a - COLS);
    else if (e.key === "Enter" && active >= 0) { onPick?.(POS[active].s); return; } else if (e.key === "Escape") { setActive(-1); setTip(null); return; } else return;
    e.preventDefault(); setActive(a); const el = dots.current[a]; if (el) place(a, el);
  };
  return (
    <div ref={wrap} className={"dotfield" + (paper ? " on-paper" : "")} tabIndex={0} role="group" aria-label={`${label}. Use the arrow keys to move between schemes and Enter to open one.`} onKeyDown={key} onBlur={() => { setActive(-1); setTip(null); }}>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" onClick={ripple}>
        {POS.map(({ s, x, y }, i) => { const f = lit?.[s.id]; const d = (rank.get(s.id) ?? 0) * 55;
          const g = { ["--dx" as string]: ((rnd(i, 1) - 0.5) * 7).toFixed(2) + "px", ["--dy" as string]: ((rnd(i, 2) - 0.5) * 7).toFixed(2) + "px", ["--dp" as string]: (5 + rnd(i, 3) * 6).toFixed(1) + "s", ["--dd" as string]: (-rnd(i, 4) * 8).toFixed(1) + "s" } as React.CSSProperties;
          const sty = { ["--delay" as string]: Math.min(d, 1300) + "ms", ["--bd" as string]: (Math.hypot(x - CX, y - CY) * 0.0065).toFixed(2) + "s" } as React.CSSProperties;
          return (
            <g key={s.id} className="dg" style={g}>
              {f && halos && <circle className="halo on" cx={x} cy={y} r={rOf(s) + 2} style={sty} />}
              <circle ref={(el) => { dots.current[i] = el; }} className={"dot" + (f ? " lit " + f : "") + (!f && urgent && SOON[i] ? " urgent" : "") + (ringSet.has(s.id) ? " ring" : "") + (active === i ? " focus" : "")} cx={x} cy={y} r={rOf(s)} style={sty}
                onPointerEnter={(e) => place(i, e.currentTarget)} onPointerLeave={() => setTip(null)} onClick={() => onPick?.(s)} />
            </g>); })}
      </svg>
      {tip && <div className="tip" style={{ left: tip.x, top: tip.y }}><b>{POS[tip.i].s.name}</b><span className="mono">{POS[tip.i].s.country} · {LABEL[POS[tip.i].s.status_clean]}{POS[tip.i].s.closes_date ? " · " + fmtDate(POS[tip.i].s.closes_date) : ""}</span></div>}
      <div className="sr" aria-live="polite">{active >= 0 ? describe(POS[active].s) : ""}</div>
    </div>
  );
}
