"use client";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { companyToText } from "@/lib/assistant/company";
import { clearSamples, DEMO_KEY, readDemo, seedSamples, STEPS, type DemoState } from "@/lib/demo";
import { extractNotes } from "@/lib/notes/extract";
import { profileFromNote, SCREEN_PREFILL_KEY } from "@/lib/notes/handoff";
import { SAMPLE_TITLE, sampleText } from "@/lib/notes/sample";

const store = () => { try { return window.localStorage; } catch { return null; } };
/** A page asks to be told something (play the sample, open a tab). The signal is kept for a page that is not open yet, and sent to one that is. */
const signal = (name: string, detail = "1") => { try { sessionStorage.setItem("gf-sig-" + name, detail); } catch { /* ignore */ } window.dispatchEvent(new CustomEvent("gf:" + name, { detail })); };
const clearSignals = () => { try { for (const k of Object.keys(sessionStorage)) if (k.startsWith("gf-sig-")) sessionStorage.removeItem(k); } catch { /* ignore */ } };
/** A short walk through the whole story, from a call to a client brief. It drives the real pages with the sample call. */
export default function DemoGuide() {
  const router = useRouter(), path = usePathname(); const [st, setSt] = useState<DemoState | null>(null); const [ending, setEnding] = useState<{ seeded: boolean } | null>(null); const [min, setMin] = useState(false); const box = useRef<HTMLElement>(null);
  const pathRef = useRef(path); pathRef.current = path;
  useEffect(() => { try { setSt(readDemo(sessionStorage)); } catch { /* ignore */ } }, []);
  const save = (s: DemoState | null) => { setSt(s); try { if (s) sessionStorage.setItem(DEMO_KEY, JSON.stringify(s)); else sessionStorage.removeItem(DEMO_KEY); } catch { /* ignore */ } };
  const enter = useCallback((i: number, seeded: boolean): boolean => {
    const here = pathRef.current, want = STEPS[i].path; let didSeed = seeded;
    const profile = () => profileFromNote(extractNotes(sampleText()), SAMPLE_TITLE);
    if (i === 0) signal("demo-sample");
    if (i === 1) { if (here !== "/notes") signal("demo-sample", "instant"); signal("demo-recap"); }
    if (i === 2) { if (here !== "/screen") { const p = profile(); try { if (p) sessionStorage.setItem(SCREEN_PREFILL_KEY, JSON.stringify({ ...p, signals: "" })); } catch { /* ignore */ } } signal("screen-tab", "matches"); }
    if (i === 3) signal("screen-tab", "aid"); if (i === 4) signal("screen-tab", "report");
    if (i === 5 && here !== "/assistant") { const p = profile(); try { if (p) sessionStorage.setItem("gf-chat-start", companyToText(p, { started: "no", budget: 300000 })); } catch { /* ignore */ } }
    if (i === 6 && seedSamples(store())) didSeed = true;
    if (here !== want) router.push(want); return didSeed;
  }, [router]);
  const go = useCallback((i: number) => { const seeded = enter(i, st?.seeded ?? false); save({ step: i, seeded }); setMin(false); setEnding(null); }, [enter, st]);
  useEffect(() => { const h = () => { const seeded = enter(0, false); save({ step: 0, seeded }); setMin(false); setEnding(null); }; window.addEventListener("gf:demo-start", h); return () => window.removeEventListener("gf:demo-start", h); }, [enter]);
  const finish = useCallback((clear: boolean) => { if (clear) clearSamples(store()); clearSignals(); setEnding(null); save(null); }, []);
  const stop = useCallback(() => { if (st?.seeded) { setEnding({ seeded: true }); save(null); } else finish(false); }, [st, finish]);
  useEffect(() => { if (!st && !ending) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { if (st) stop(); else finish(false); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [st, ending, stop, finish]);
  useEffect(() => { const el = box.current, root = document.documentElement; if (!el) { root.style.removeProperty("--demo-h"); return; } const set = () => root.style.setProperty("--demo-h", `${el.offsetHeight}px`); set(); const ro = new ResizeObserver(set); ro.observe(el); return () => { ro.disconnect(); root.style.removeProperty("--demo-h"); }; }, [st, ending, min]);
  if (!st && !ending) return null;
  const i = st?.step ?? STEPS.length - 1, step = STEPS[i], last = i === STEPS.length - 1;
  if (ending) return (
    <aside className="demo" ref={box} role="region" aria-label="Guided demo"><div className="demo-in"><p className="demo-k mono">Demo finished</p><div className="demo-tx"><b>Keep the sample calls?</b><span>The demo added fictional calls to this browser so the portfolio had something to show.</span></div>
      <div className="demo-acts"><button type="button" className="demo-btn" onClick={() => finish(false)}>Keep them</button><button type="button" className="demo-btn pri" onClick={() => finish(true)}>Clear the sample calls</button></div></div></aside>
  );
  return (
    <aside className="demo" ref={box} role="region" aria-label="Guided demo"><div className="demo-in">
      <p className="demo-k mono">Demo · step {i + 1} of {STEPS.length}</p>
      {!min && <div className="demo-tx" aria-live="polite"><b>{step.title}</b><span>{step.text}</span></div>}
      <div className="demo-acts"><button type="button" className="demo-btn" disabled={i === 0} onClick={() => go(i - 1)}>Back</button>
        <button type="button" className="demo-btn pri" onClick={() => (last ? stop() : go(i + 1))}>{last ? "Finish" : "Next"}</button>
        <button type="button" className="demo-btn" aria-expanded={!min} onClick={() => setMin((v) => !v)}>{min ? "Show" : "Hide"}</button>
        <button type="button" className="demo-btn" onClick={stop}>Exit</button></div></div>
      <div className="demo-prog" aria-hidden="true"><i style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} /></div></aside>
  );
}
