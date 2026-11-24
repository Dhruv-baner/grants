"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { browserStore, type Store } from "@/lib/assistant/history";
import { copyText, download } from "@/lib/browser";
import { formatEur } from "@/lib/notes/numbers";
import { buildRow, callStats, callsToCsv, callsToJson, callsToTsv, COUNTRIES, EXTRA, filterRows, fmtDay, MAIN, sampleCalls, sectorOptions, SIZES, sortRows, STATUS_OPTIONS, statusLabel, type CallRow, type Col } from "@/lib/notes/calls";
import { deleteNote, loadNotes, saveNotes, upsertNote, type SavedNote } from "@/lib/notes/store";

const WIDTH: Record<string, number> = { call_date: 88, company_name: 116, sector: 124, country: 104, region: 98, size_band: 72, project_description: 126, planned_investment_eur: 80, ordered_or_started: 120, notes_summary: 212 }; const ACTIONS = 56;

/** A text cell that grows to show everything in it, instead of clipping. */
function Auto({ value, onChange, label, placeholder }: { value: string; onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void; label: string; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (!el) return; const fit = () => { el.style.height = "auto"; el.style.height = el.scrollHeight + 2 + "px"; }; fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect(); }, [value]);
  return <textarea ref={ref} rows={1} aria-label={label} value={value} placeholder={placeholder} onChange={onChange} />;
}
/** A dropdown whose chosen value is shown as wrapping text; the real select sits invisibly on top, so keyboard and screen readers still use it. */
function Pick({ label, value, shown, onChange, children }: { label: string; value: string; shown: string; onChange: (e: ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }) {
  return <div className="cl-sel"><span aria-hidden="true" className={value ? undefined : "cl-none"}>{shown}</span><select aria-label={label} value={value} onChange={onChange}>{children}</select></div>;
}
function Cell({ r, c, set, open, toggle }: { r: CallRow; c: Col; set: (id: string, key: string, v: string) => void; open: boolean; toggle: () => void }) {
  const v = r.fields[c.key] ?? ""; const edited = r.edited.has(c.key); const name = `${c.label} for ${r.fields.company_name || "this call"}${edited ? " (edited)" : ""}`; const on = (e: { target: { value: string } }) => set(r.id, c.key, e.target.value);
  if (c.key === "call_date") return <span className="cl-date">{fmtDay(r.created)}</span>;
  if (c.kind === "readonly") return <span className="cl-ro">{v || <span className="cl-none">None</span>}</span>;
  if (c.key === "ordered_or_started") return <Pick label={name} value={v} shown={statusLabel(v)} onChange={on}>{STATUS_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Pick>;
  if (c.key === "country") return <Pick label={name} value={v} shown={v || "Not mentioned"} onChange={on}><option value="">Not mentioned</option>{COUNTRIES.map((x) => <option key={x}>{x}</option>)}{v && !COUNTRIES.includes(v) && <option>{v}</option>}</Pick>;
  if (c.key === "size_band") return <Pick label={name} value={v} shown={v || "Not mentioned"} onChange={on}><option value="">Not mentioned</option>{SIZES.map((x) => <option key={x}>{x}</option>)}{v && !SIZES.includes(v) && <option>{v}</option>}</Pick>;
  if (c.kind === "long") return open ? <div><Auto label={name} value={v} placeholder="Not mentioned" onChange={on} /><button type="button" className="cl-more" onClick={toggle}>Show less</button></div>
    : <div><button type="button" className="cl-clamp" onClick={toggle} aria-label={`${name}. Press to read and edit the full summary`}>{v || <span className="cl-none">Not mentioned</span>}</button>{v.length > 100 && <button type="button" className="cl-more" onClick={toggle}>Show all</button>}</div>;
  if (c.kind === "number") return <input aria-label={name} value={v} placeholder="Not mentioned" inputMode="numeric" onChange={on} />;
  return <Auto label={name} value={v} placeholder="Not mentioned" onChange={on} />;
}

export default function Calls() {
  const [notes, setNotes] = useState<SavedNote[]>([]); const [ready, setReady] = useState(false); const store = useRef<Store | null>(null);
  const [q, setQ] = useState(""); const [fSector, setFSector] = useState(""); const [fCountry, setFCountry] = useState(""); const [fStatus, setFStatus] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "call_date", dir: -1 }); const [extra, setExtra] = useState<string[]>([]); const [copied, setCopied] = useState(""); const [openSum, setOpenSum] = useState<string[]>([]); const [lit, setLit] = useState<string | null>(null);
  useEffect(() => {
    store.current = browserStore(); setNotes(loadNotes(store.current)); setReady(true);
    try { const c = JSON.parse(localStorage.getItem("gf-calls-cols") ?? "[]"); if (Array.isArray(c)) setExtra(c.filter((k: unknown) => EXTRA.some((e) => e.key === k))); } catch { /* ignore */ }
  }, []);
  const rows = useMemo(() => notes.map(buildRow), [notes]); const stats = useMemo(() => callStats(rows), [rows]);
  useEffect(() => { // the call you just made lights up
    if (!ready) return; let id: string | null = null; try { id = sessionStorage.getItem("gf-calls-focus"); sessionStorage.removeItem("gf-calls-focus"); } catch { /* ignore */ }
    if (!id || !notes.some((n) => n.id === id)) return; setLit(id); const t = window.setTimeout(() => setLit(null), 2800); return () => window.clearTimeout(t);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (lit) document.querySelector(`[data-row-id="${CSS.escape(lit)}"]`)?.scrollIntoView({ block: "center" }); }, [lit, rows.length]); const cols = useMemo(() => [...MAIN, ...EXTRA.filter((e) => extra.includes(e.key))], [extra]);
  const view = useMemo(() => sortRows(filterRows(rows, { q, sector: fSector, country: fCountry, status: fStatus }), sort.key, sort.dir), [rows, q, fSector, fCountry, fStatus, sort]);
  const sectors = useMemo(() => sectorOptions(rows), [rows]); const filtered = !!(q || fSector || fCountry || fStatus);
  const persist = (next: SavedNote[]) => { setNotes(next); saveNotes(next, store.current); };
  const setCell = (id: string, key: string, value: string) => persist(notes.map((n) => (n.id === id ? { ...n, updated: Date.now(), edits: { ...n.edits, [key]: value } } : n)));
  const remove = (id: string) => { if (window.confirm("Delete this call? It is removed from the table and from Notes.")) persist(deleteNote(notes, id)); };
  const addSamples = () => persist(sampleCalls().reduce((acc, s) => upsertNote(acc, s), notes));
  const toggleCol = (k: string) => { const next = extra.includes(k) ? extra.filter((x) => x !== k) : [...extra, k]; setExtra(next); try { localStorage.setItem("gf-calls-cols", JSON.stringify(next)); } catch { /* ignore */ } };
  const sortBy = (k: string) => setSort((s) => (s.key === k ? { key: k, dir: (s.dir * -1) as 1 | -1 } : { key: k, dir: k === "call_date" || k === "planned_investment_eur" ? -1 : 1 }));
  const flash = (k: string) => { setCopied(k); window.setTimeout(() => setCopied((c) => (c === k ? "" : c)), 1800); };
  const clear = () => { setQ(""); setFSector(""); setFCountry(""); setFStatus(""); };

  return (
    <div className="cl">
      <header className="cl-head"><p className="mono nt-kick">Calls <span className="beta-tag">Beta</span></p><h1>Every call in one table</h1>
        <p>One row per call you recorded or pasted. It fills itself from the notes: edit any cell, filter, then export for your CRM. Only what a call said is filled in, so empty cells say "Not mentioned". Saved in this browser only.</p></header>
      {!ready ? null : rows.length === 0 ? (
        <div className="cl-empty"><h2>No calls yet</h2><p className="nt-muted">Record or paste a call and it appears here as a row. To see how the table works first, add a few fictional calls.</p>
          <div className="cl-actions" style={{ justifyContent: "center" }}><button type="button" className="nbtn pri" onClick={addSamples}>Add sample calls</button><Link className="nbtn" href="/notes">Record a call</Link></div></div>
      ) : (
        <>
          <div className="cl-stats" role="group" aria-label="At a glance">
            <button type="button" className="cl-stat" aria-pressed={!filtered} onClick={clear}><b>{stats.total}</b><span>{stats.total === 1 ? "Call" : "Calls"}</span></button>
            <button type="button" className="cl-stat" aria-pressed={fStatus === "No"} onClick={() => setFStatus(fStatus === "No" ? "" : "No")}><b>{stats.notOrdered}</b><span>Nothing ordered yet</span></button>
            <button type="button" className="cl-stat" aria-pressed={fStatus === "Yes"} onClick={() => setFStatus(fStatus === "Yes" ? "" : "Yes")}><b>{stats.ordered}</b><span>Already ordered or started</span></button>
            <div className="cl-stat static"><b>{stats.withBudget ? formatEur(stats.budget) : "None"}</b><span>{stats.withBudget ? `Budget mentioned, ${stats.withBudget} ${stats.withBudget === 1 ? "call" : "calls"}` : "Budget mentioned"}</span></div>
          </div>
          <div className="cl-bar" role="search">
            <input type="search" aria-label="Search calls" placeholder="Search calls" value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="Filter by sector" value={fSector} onChange={(e) => setFSector(e.target.value)}><option value="">All sectors</option>{sectors.map((s) => <option key={s}>{s}</option>)}</select>
            <select aria-label="Filter by country" value={fCountry} onChange={(e) => setFCountry(e.target.value)}><option value="">All countries</option>{COUNTRIES.map((s) => <option key={s}>{s}</option>)}</select>
            <select aria-label="Filter by status" value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">All statuses</option><option value="No">Nothing ordered yet</option><option value="Yes">Already ordered or started</option><option value="none">Not mentioned</option></select>
            <details className="cl-cols"><summary>Columns</summary><div className="cl-pop">{EXTRA.map((e) => <label key={e.key}><input type="checkbox" checked={extra.includes(e.key)} onChange={() => toggleCol(e.key)} />{e.label}</label>)}</div></details>
            {filtered && <button type="button" className="mini" onClick={clear}>Clear filters</button>}
            <p className="cl-count" role="status">{view.length} of {rows.length} {rows.length === 1 ? "call" : "calls"}</p>
          </div>
          <div className="cl-actions">
            <button type="button" className="nbtn" disabled={!view.length} onClick={() => download("calls.csv", callsToCsv(view), "text/csv;charset=utf-8")}>Download CSV</button>
            <button type="button" className="nbtn" disabled={!view.length} onClick={() => download("calls.json", callsToJson(view), "application/json")}>Download JSON</button>
            <button type="button" className="nbtn" disabled={!view.length} onClick={async () => { if (await copyText(callsToTsv(view, cols))) flash("tsv"); }}>{copied === "tsv" ? "Copied" : "Copy for spreadsheet"}</button>
            <button type="button" className="nbtn" onClick={addSamples}>Add sample calls</button><Link className="nbtn pri" href="/notes">New call →</Link>
          </div>
          {view.length === 0 ? <div className="cl-empty"><p>No calls match these filters.</p><button type="button" className="mini" onClick={clear}>Clear filters</button></div> : (
            <div className="cl-wrap" role="region" aria-label="Calls table" tabIndex={0}>
              <table className="cl-table" style={{ minWidth: cols.reduce((n, c) => n + (WIDTH[c.key] ?? 140), ACTIONS) }}><caption className="sr">One row per saved call. Cells are editable.</caption><colgroup>{cols.map((c) => <col key={c.key} style={{ width: WIDTH[c.key] ?? 140 }} />)}<col style={{ width: ACTIONS }} /></colgroup>
                <thead><tr>{cols.map((c) => <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}><button type="button" onClick={() => sortBy(c.key)}>{c.label}{sort.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}</button></th>)}<th scope="col"><span className="sr">Actions</span></th></tr></thead>
                <tbody>{view.map((r) => <tr key={r.id} data-row-id={r.id} data-flash={lit === r.id ? "true" : undefined}>{cols.map((c) => <td key={c.key} data-label={c.label} data-edited={r.edited.has(c.key) ? "true" : undefined}><Cell r={r} c={c} set={setCell} open={openSum.includes(r.id)} toggle={() => setOpenSum((o) => (o.includes(r.id) ? o.filter((x) => x !== r.id) : [...o, r.id]))} /></td>)}
                  <td className="cl-act"><Link href={`/notes#${r.id}`} aria-label={`Open the notes for ${r.fields.company_name || "this call"}`}>Open</Link><button type="button" className="cl-del" aria-label={`Delete the call with ${r.fields.company_name || "no company named"}`} onClick={() => remove(r.id)}>×</button></td></tr>)}</tbody></table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
