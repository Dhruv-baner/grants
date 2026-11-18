"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { helpAnswer, respond, type Answer, type Block, type Ctx } from "@/lib/assistant/engine";
import { DATA_AS_OF } from "@/lib/assistant/knowledge";
import { fmtDate } from "@/lib/ui";

interface Followup { state: "loading" | "done" | "none"; text?: string; }
interface Msg { id: number; role: "me" | "bot"; text?: string; answer?: Answer; followup?: Followup; }
interface Status { live: boolean; needsCode: boolean; }
let seq = 0;
const safeHref = (u: string) => (/^https?:\/\//i.test(u) ? u : "#");

function View({ b, ask }: { b: Block; ask: (q: string) => void }) {
  switch (b.t) {
    case "title": return <><h3 className="b-title">{b.text}</h3>{b.sub && <p className="b-sub mono">{b.sub}</p>}</>;
    case "text": return <p className="b-text">{b.text}</p>;
    case "notice": return <p className="b-notice" role="note">{b.text}</p>;
    case "facts": return <dl className="b-facts">{b.rows.map((r) => <div key={r.k} className={r.hi ? "hi" : undefined}><dt>{r.k}</dt><dd>{r.v}</dd></div>)}</dl>;
    case "checklist": return <>{b.groups.map((g) => <div key={g.label} className="b-group"><h4>{g.label}</h4>
      <ul className="b-list">{g.items.map((i) => <li key={i.item}><span className="it">{i.item}</span>{i.note && <span className="nt">{i.note}</span>}<a href={safeHref(i.url)} target="_blank" rel="noopener noreferrer" aria-label={`Source for ${i.item} (opens in a new tab)`}>source ↗</a></li>)}</ul></div>)}</>;
    case "table": return <div className="b-table-wrap" tabIndex={0} role="region" aria-label="Comparison table, scrolls sideways on small screens"><table className="b-table" role="table"><thead><tr role="row"><th role="columnheader" scope="col"><span className="sr">Topic</span></th>{b.cols.map((c) => <th key={c} role="columnheader" scope="col">{c}</th>)}</tr></thead>
      <tbody>{b.rows.map((r) => <tr key={r.label} role="row"><th role="rowheader" scope="row">{r.label}</th>{r.cells.map((c, i) => <td key={i} role="cell" data-label={b.cols[i]}>{c}</td>)}</tr>)}</tbody></table></div>;
    case "picks": return <div className="b-picks">{b.items.map((p, i) => <div key={p.id} className="b-pick"><h4><span>{i + 1}. {p.label}</span><span className="sc" title="Readable fit score, out of 110">{p.score} / 110{p.fit ? ` · ${p.fit}` : ""}</span></h4>
      {p.why.length > 0 && <ul>{p.why.map((w) => <li key={w}>{w}</li>)}</ul>}{p.flags.length > 0 && <><p className="dl2" style={{ marginBottom: 0 }}>To check</p><ul style={{ marginTop: 2 }}>{p.flags.map((w) => <li key={w}>{w}</li>)}</ul></>}{p.deadline && <p className="dl2">Timing: {p.deadline}</p>}</div>)}</div>;
    case "sources": return b.items.length ? <details className="b-src"><summary>Sources ({b.items.length})</summary><ul>{b.items.map((s) => <li key={s.url}><a href={safeHref(s.url)} target="_blank" rel="noopener noreferrer">{s.label} ↗</a></li>)}</ul></details> : null;
    case "chips": return <div className="b-chips">{b.items.map((c) => <button key={c} type="button" className="b-chip" onClick={() => ask(c)}>{c}</button>)}</div>;
  }
}

export default function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ id: ++seq, role: "bot", answer: helpAnswer() }]);
  const [ctx, setCtx] = useState<Ctx>({ last: [] });
  const [input, setInput] = useState(""); const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null); const [code, setCode] = useState("");
  const [narrow, setNarrow] = useState(false);
  const lastRef = useRef<HTMLDivElement>(null); const inputRef = useRef<HTMLInputElement>(null); const first = useRef(true);
  useEffect(() => { const mq = window.matchMedia("(max-width: 520px)"); const on = () => setNarrow(mq.matches); on(); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ live: false, needsCode: false })); }, []);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastRef.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  }, [msgs.length]);

  const patch = (id: number, followup: Followup) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, followup } : x)));
  const send = useCallback(async (text: string) => {
    const q = text.trim().slice(0, 600); if (!q || busy) return;
    setInput(""); const r = respond(q, ctx); setCtx(r.ctx);
    const botId = ++seq; const live = !!(r.followup && status?.live);
    setMsgs((m) => [...m, { id: ++seq, role: "me", text: q }, { id: botId, role: "bot", answer: r.answer, followup: live ? { state: "loading" } : undefined }]);
    inputRef.current?.focus();
    if (!live || !r.followup) return;
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json", ...(code ? { "x-access-code": code } : {}) }, body: JSON.stringify({ programme_id: r.followup.id, question: r.followup.question }) });
      const data = await res.json().catch(() => ({}));
      patch(botId, res.ok && typeof data.answer === "string" ? { state: "done", text: data.answer } : { state: "none" });
    } catch { patch(botId, { state: "none" }); } finally { setBusy(false); }
  }, [busy, ctx, status, code]);
  const submit = (e: FormEvent) => { e.preventDefault(); void send(input); };

  return (
    <div className="chat">
      <div className="chat-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">
        {msgs.map((m, i) => m.role === "me"
          ? <div key={m.id} className="msg me" ref={i === msgs.length - 1 ? lastRef : undefined}><p>{m.text}</p></div>
          : <div key={m.id} className="msg bot" ref={i === msgs.length - 1 ? lastRef : undefined}>
              {m.followup?.state === "loading" && <p className="b-text" aria-busy="true">Checking the record…</p>}
              {m.followup?.state === "done" && <div className="ai-box"><p className="b-text" style={{ margin: 0 }}>{m.followup.text}</p><p className="b-foot" style={{ marginTop: 8 }}>Written by Claude from the programme's record, with numbers checked against the data.</p></div>}
              {m.answer!.blocks.filter((b) => !(b.t === "text" && b.lead && m.followup?.state === "done")).map((b, k) => <View key={k} b={b} ask={send} />)}
              {m.answer!.kind !== "help" && m.answer!.kind !== "beta" && <p className="b-foot">Programme data as of {fmtDate(DATA_AS_OF)}. A checklist says what the official page asks for. It is not advice that a company qualifies.</p>}
            </div>)}
      </div>
      {status?.live && status.needsCode && <div className="field" style={{ marginTop: 16, maxWidth: 320 }}><label htmlFor="ac">Access code (for follow-up questions)</label><input id="ac" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" /></div>}
      <form className="chat-form" onSubmit={submit}>
        <label htmlFor="q" className="sr">Ask about a programme</label>
        <input id="q" ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} maxLength={600} placeholder={narrow ? "Ask a question" : "Ask about documents, deadlines, eligibility, or describe your company"} autoComplete="off" enterKeyHint="send" />
        <button className="btn" type="submit" disabled={busy || !input.trim()}>Ask <span className="arr" aria-hidden="true">→</span></button>
      </form>
    </div>
  );
}
