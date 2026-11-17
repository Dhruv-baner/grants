"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/fx";

export interface FuseItem { id: string; name: string; date: string; days: number; country: string }
const PX = 16, ORIGIN = 150, MINGAP = 124, MAXGAP = 300, CENTER = 230, STEP = 84, BASE = 36;
const fmt = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function Countdown({ items }: { items: FuseItem[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (now === null) return <div className="countdown num" aria-hidden="true">&nbsp;</div>;
  const next = items.find((i) => Date.parse(i.date + "T23:59:59") >= now);
  if (!next) return <div><div className="countdown">No later dates</div><p className="muted">Every closing date in the table has passed. The data was last checked on 17 Nov 2026.</p></div>;
  const ms = Date.parse(next.date + "T23:59:59") - now, d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60, p = (n: number) => String(n).padStart(2, "0");
  return <div><div className="countdown num" role="timer" aria-label={`${d} days ${h} hours until ${next.name} closes`}>{d}<span style={{ fontSize: ".35em", marginRight: ".5em" }}> days</span>{p(h)}:{p(m)}:{p(s)}</div><p style={{ marginTop: 12 }} className="mono">Next to close · <Link href={`/programmes#${next.id}`}>{next.name}</Link> · {fmt(next.date)}</p></div>;
}

export default function Fuse({ items, asOf }: { items: FuseItem[]; asOf: string }) {
  const router = useRouter(); const reduced = useReducedMotion(); const sc = useRef<HTMLDivElement>(null); const [spark, setSpark] = useState(ORIGIN); const drag = useRef<{ x: number; l: number } | null>(null); const [dragging, setDragging] = useState(false);
  const placed = useMemo(() => { let x = ORIGIN; let prev = 0;   // knots follow the order of the dates, with a minimum gap so labels never collide
    return items.map((it, i) => { x += Math.max(i === 0 ? 150 : MINGAP, Math.min(MAXGAP, (it.days - prev) * PX)); prev = it.days; return { ...it, x, above: i % 2 === 0, h: BASE + (Math.floor(i / 2) % 2) * STEP }; }); }, [items]);
  const width = (placed.at(-1)?.x ?? ORIGIN) + 340;
  const months = useMemo(() => { const out: { x: number; label: string }[] = []; const a = new Date(asOf + "T00:00:00Z"); const anchors = [{ d: 0, x: ORIGIN }, ...placed.map((p) => ({ d: p.days, x: p.x }))]; const lastD = anchors[anchors.length - 1].d;
    for (let m = 1; m < 12; m++) { const dt = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + m, 1)); const d = Math.round((+dt - +a) / 864e5); if (d > lastD) break;
      let x = ORIGIN; for (let i = 0; i < anchors.length - 1; i++) { const p = anchors[i], q = anchors[i + 1]; if (d >= p.d && d <= q.d) { x = q.d === p.d ? p.x : p.x + ((d - p.d) / (q.d - p.d)) * (q.x - p.x); break; } }
      out.push({ x, label: dt.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) }); } return out; }, [asOf, placed]);
  useEffect(() => { const el = sc.current!; let raf = 0; const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setSpark(el.scrollLeft + ORIGIN)); }; el.addEventListener("scroll", on, { passive: true }); return () => { el.removeEventListener("scroll", on); cancelAnimationFrame(raf); }; }, []);
  const by = (dx: number) => sc.current?.scrollBy({ left: dx, behavior: reduced ? "auto" : "smooth" });
  return (
    <div className="fuse-wrap">
      <div ref={sc} className={"fuse-scroll" + (dragging ? " drag" : "")} tabIndex={0} role="region" aria-label="Deadline timeline. Scroll sideways, drag, or use the arrow keys."
        onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); by(260); } else if (e.key === "ArrowLeft") { e.preventDefault(); by(-260); } else if (e.key === "Home") { e.preventDefault(); sc.current!.scrollTo({ left: 0 }); } else if (e.key === "End") { e.preventDefault(); sc.current!.scrollTo({ left: width }); } }}
        onPointerDown={(e) => { if (e.pointerType !== "mouse" || (e.target as HTMLElement).closest("button, a")) return; drag.current = { x: e.clientX, l: sc.current!.scrollLeft }; setDragging(true); sc.current!.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (drag.current) sc.current!.scrollLeft = drag.current.l - (e.clientX - drag.current.x); }}
        onPointerUp={() => { drag.current = null; setDragging(false); }} onPointerCancel={() => { drag.current = null; setDragging(false); }}>
        <div className="fuse-inner" style={{ width, height: CENTER * 2 }}>
          {months.map((m) => <div key={m.label} className="fuse-month" style={{ left: m.x }}>{m.label}</div>)}
          <div className="fuse-month" style={{ left: ORIGIN, color: "var(--spark)", borderColor: "var(--spark)" }}>Today</div>
          <div className="fuse-line fuse-char" style={{ width: spark }} /><div className="fuse-line fuse-fire" style={{ left: spark, width: Math.max(0, width - spark) }} /><div className="fuse-spark" style={{ left: spark }} aria-hidden="true" />
          {placed.map((p) => (
            <div key={p.id} className={"fuse-mark" + (p.x < spark - 4 ? " past" : "") + (p.days <= 14 ? " hot" : "")} style={{ left: p.x }}>
              <button aria-label={`${p.name}, closes ${fmt(p.date)}`} onClick={() => { router.push(`/programmes#${p.id}`); setTimeout(() => window.dispatchEvent(new CustomEvent("gf:scheme", { detail: p.id })), 80); }} />
              <span className="stem" style={p.above ? { bottom: 0, height: p.h } : { top: 0, height: p.h }} />
              <span className="lab" style={p.above ? { bottom: p.h } : { top: p.h }}><b>{p.name.length > 52 ? p.name.slice(0, 51) + "…" : p.name}</b><span className="mono num" style={{ color: "var(--cream-2)" }}>{fmt(p.date)} · {p.days} days</span></span>
            </div>))}
        </div>
      </div>
      <p className="mono fuse-note">Knots follow the order of the dates and are spaced for reading, not drawn to an exact scale.</p>
      <div className="fuse-ctl mono"><button onClick={() => by(-480)}>← Earlier</button><button onClick={() => by(480)}>Later →</button></div>
    </div>
  );
}
