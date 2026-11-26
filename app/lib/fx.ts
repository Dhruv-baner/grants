"use client";
import { useEffect, useRef, useState } from "react";
export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => { const m = window.matchMedia("(prefers-reduced-motion: reduce)"); setR(m.matches); const f = () => setR(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return r;
}
/** Sets --mx/--my on an element while the pointer moves over it (cursor-following warmth). */
export function useSpot<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const on = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; const b = el.getBoundingClientRect(); el.style.setProperty("--mx", e.clientX - b.left + "px"); el.style.setProperty("--my", e.clientY - b.top + "px"); };
    el.addEventListener("pointermove", on); return () => el.removeEventListener("pointermove", on);
  }, []);
  return ref;
}
