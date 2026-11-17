"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/fx";

/** "Which funding can this company *apply for?*": words rise in once; *...* marks italic. */
export function Rise({ text, as: Tag = "h1" }: { text: string; as?: "h1" | "h2" }) {
  let ital = false; let i = 0; const out: ReactNode[] = [];
  for (const part of text.split("*")) {
    for (const word of part.split(" ").filter(Boolean)) {
      const inner = ital ? <em>{word}</em> : word;
      out.push(<span className="w" key={i} style={{ ["--w" as string]: i }}><span>{inner}</span></span>, " "); i++;
    }
    ital = !ital;
  }
  return <Tag className="rise" aria-label={text.replaceAll("*", "")}><span aria-hidden="true">{out}</span></Tag>;
}

export function Spot({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = ref.current; if (!el) return; const on = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; const b = el.getBoundingClientRect(); el.style.setProperty("--mx", e.clientX - b.left + "px"); el.style.setProperty("--my", e.clientY - b.top + "px"); }; el.addEventListener("pointermove", on); return () => el.removeEventListener("pointermove", on); }, []);
  return <div ref={ref} className={"spot " + className}>{children}</div>;
}

export function Magnetic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null); const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current; if (!el || reduced) return;
    const move = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; const b = el.getBoundingClientRect(); const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
      const d = Math.hypot(dx, dy); if (d < 120) el.style.transform = `translate(${Math.max(-8, Math.min(8, dx * 0.18))}px, ${Math.max(-6, Math.min(6, dy * 0.18))}px)`; else el.style.transform = ""; };
    const reset = () => { el.style.transform = ""; };
    window.addEventListener("pointermove", move); el.addEventListener("pointerleave", reset); return () => { window.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", reset); };
  }, [reduced]);
  return <span ref={ref} style={{ display: "inline-block", transition: "transform .25s cubic-bezier(.2,.7,.1,1)" }}>{children}</span>;
}

export function CountUp({ to, duration = 1500 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null); const [v, setV] = useState(to); const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current; if (!el || reduced) return; let raf = 0; let done = false;
    const io = new IntersectionObserver((es) => { if (!es[0].isIntersecting || done) return; done = true; io.disconnect(); const t0 = performance.now();
      const tick = (t: number) => { const p = Math.min(1, (t - t0) / duration); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); }; setV(0); raf = requestAnimationFrame(tick); }, { threshold: 0.4 });
    io.observe(el); return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, duration, reduced]);
  return <span ref={ref} className="num">{v.toLocaleString("en-GB")}</span>;
}
