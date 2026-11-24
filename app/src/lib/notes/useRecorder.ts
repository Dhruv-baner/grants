"use client";
// Browser dictation (Web Speech API) plus a microphone level meter, with the awkward parts handled:
// permission prompts and denials, dictation that stops by itself and has to be restarted, a screen wake-lock, and plain error messages.
import { useCallback, useEffect, useRef, useState } from "react";

export type RecState = "idle" | "starting" | "recording" | "stopping";
export interface RecorderOpts { lang: string; onFinal(text: string): void; onInterim(text: string): void; onError(message: string): void; onStopped(): void; }
type Any = any; // the Speech API has no TypeScript types in every browser
export const speechSupported = () => typeof window !== "undefined" && !!((window as Any).SpeechRecognition || (window as Any).webkitSpeechRecognition);
export const MSG = {
  blocked: "The microphone is blocked. Click the lock icon in the address bar, allow the microphone for this site, then press record again.",
  none: "No microphone was found. Plug one in or check the Windows sound settings, then try again.",
  network: "Dictation needs an internet connection, because the browser sends the audio to its speech service. Paste or type a transcript instead, or use the sample call.",
  unsupported: "Live dictation needs Chrome or Edge on a computer. You can paste or type a transcript, or use the sample call.",
  loop: "Dictation keeps stopping. Check the microphone and the connection, then try again.",
};
export function useRecorder(opts: RecorderOpts) {
  const [state, setState] = useState<RecState>("idle"); const [elapsed, setElapsed] = useState(0);
  const levelRef = useRef(0); const o = useRef(opts); o.current = opts; const st = useRef<RecState>("idle"); const set = (s: RecState) => { st.current = s; setState(s); };
  const rec = useRef<Any>(null); const want = useRef(false); const stream = useRef<MediaStream | null>(null); const ctx = useRef<AudioContext | null>(null);
  const raf = useRef(0); const timer = useRef(0); const wake = useRef<Any>(null); const restarts = useRef<number[]>([]); const done = useRef(true);
  const cleanupAudio = useCallback(() => { cancelAnimationFrame(raf.current); stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; ctx.current?.close().catch(() => {}); ctx.current = null; levelRef.current = 0; }, []);
  const finish = useCallback(() => {
    if (done.current) return; done.current = true; want.current = false; window.clearInterval(timer.current); cleanupAudio();
    try { wake.current?.release?.(); } catch { /* ignore */ } wake.current = null; set("idle"); o.current.onStopped();
  }, [cleanupAudio]);
  const start = useCallback(async () => {
    if (st.current !== "idle") return;
    const SR = (window as Any).SpeechRecognition || (window as Any).webkitSpeechRecognition; if (!SR) { o.current.onError(MSG.unsupported); return; }
    set("starting"); setElapsed(0); restarts.current = []; done.current = false;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); stream.current = s;
      const AC = window.AudioContext || (window as Any).webkitAudioContext; const c: AudioContext = new AC(); ctx.current = c; const an = c.createAnalyser(); an.fftSize = 512; c.createMediaStreamSource(s).connect(an); const buf = new Uint8Array(an.fftSize);
      const tick = () => { an.getByteTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; } levelRef.current = Math.min(1, Math.sqrt(sum / buf.length) * 4); raf.current = requestAnimationFrame(tick); }; tick();
    } catch (e: Any) { cleanupAudio(); done.current = true; set("idle"); o.current.onError(e?.name === "NotFoundError" || e?.name === "OverconstrainedError" ? MSG.none : MSG.blocked); return; }
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = o.current.lang; r.maxAlternatives = 1; rec.current = r; want.current = true;
    r.onresult = (e: Any) => { let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i]; const tx: string = res[0]?.transcript ?? ""; if (res.isFinal) o.current.onFinal(tx.trim()); else interim += tx; } o.current.onInterim(interim.trim()); };
    r.onerror = (e: Any) => { const code: string = e?.error ?? ""; if (code === "no-speech" || code === "aborted") return; want.current = false;
      o.current.onError(code === "not-allowed" || code === "service-not-allowed" ? MSG.blocked : code === "network" ? MSG.network : code === "audio-capture" ? MSG.none : `Dictation stopped (${code || "unknown reason"}).`); };
    r.onend = () => {
      if (!want.current) { finish(); return; }
      const now = Date.now(); restarts.current = restarts.current.filter((t) => now - t < 5000); restarts.current.push(now); // the browser ends dictation after silence: start it again
      if (restarts.current.length > 6) { want.current = false; o.current.onError(MSG.loop); finish(); return; }
      try { r.start(); } catch { /* already running */ }
    };
    try { r.start(); } catch { want.current = false; cleanupAudio(); done.current = true; set("idle"); o.current.onError(MSG.unsupported); return; }
    set("recording"); timer.current = window.setInterval(() => setElapsed((x) => x + 1), 1000);
    try { wake.current = await (navigator as Any).wakeLock?.request("screen"); } catch { /* optional */ }
  }, [cleanupAudio, finish]);
  const stop = useCallback(() => {
    if (st.current !== "recording" && st.current !== "starting") return; set("stopping"); want.current = false;
    try { rec.current?.stop(); } catch { finish(); } window.setTimeout(finish, 1800); // dictation ends by itself; this is the safety net
  }, [finish]);
  useEffect(() => () => { want.current = false; try { rec.current?.abort?.(); } catch { /* ignore */ } cleanupAudio(); window.clearInterval(timer.current); try { wake.current?.release?.(); } catch { /* ignore */ } }, [cleanupAudio]);
  return { state, elapsed, levelRef, start, stop };
}
