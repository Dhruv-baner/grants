"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { download } from "@/lib/browser";
import { REAL, SCHEMES } from "@/lib/data";
import { heatmap, MAX_BYTES, MAX_ROWS, parseCsv, rowsToCsv, screenAll, TEMPLATE, toProfiles, type Entry, type Parsed, type Row } from "@/lib/screen/bulk";
import type { Profile } from "@/lib/types";

type SortKey = "name" | "matches" | "best";
const fromReal = (): Entry[] => REAL.map((d, i) => ({ row: i + 2, notes: [], profile: { name: d.name, country: d.country as Profile["country"], region: d.region ?? "", size: d.size, sectors: d.sectors ?? [], description: d.description, activities: d.description, signals: d.signals ?? [] } }));
export default function Bulk() {
  const router = useRouter(); const [parsed, setParsed] = useState<Parsed | null>(null); const [entries, setEntries] = useState<Entry[]>([]); const [fileName, setFileName] = useState(""); const [err, setErr] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "best", dir: -1 }); const [drag, setDrag] = useState(false); const input = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => screenAll(entries, SCHEMES), [entries]);
  const view = useMemo(() => [...rows].sort((a, b) => { const x = sort.key === "name" ? a.name.toLowerCase() : a[sort.key], y = sort.key === "name" ? b.name.toLowerCase() : b[sort.key]; return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.row - b.row; }), [rows, sort]);
  const heat = useMemo(() => heatmap(view, 10), [view]);
  async function load(file: File | undefined) {
    if (!file) return; setErr(""); if (file.size > MAX_BYTES) { setErr("That file is over 1 MB. Split the list and screen it in parts."); return; }
    try { const p = toProfiles(parseCsv(await file.text())); if (!p.entries.length && !p.skipped.length) { setErr("No rows were found. The first row must be the column names, with at least a company and a country column."); return; } setParsed(p); setEntries(p.entries); setFileName(file.name); } catch { setErr("Could not read that file as a CSV."); }
  }
  const useExamples = () => { setErr(""); setParsed({ entries: fromReal(), skipped: [], columns: {}, unmapped: [], truncated: false }); setEntries(fromReal()); setFileName("the five example companies"); };
  const open = (r: Row) => { const e = entries.find((x) => x.row === r.row); if (!e) return; try { sessionStorage.setItem("gf-screen-prefill", JSON.stringify({ ...e.profile, signals: "" })); } catch { /* ignore */ } router.push("/screen"); };
  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" ? 1 : -1 }));
  const head = (key: SortKey, label: string) => <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}><button type="button" onClick={() => sortBy(key)}>{label}{sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}</button></th>;
  return (
    <div className="wrap bulk" style={{ paddingTop: "var(--s7)" }}>
      <div className="sec-head" style={{ marginBottom: "var(--s5)" }}><span className="mono">Screen a list</span><span className="mono muted"><Link href="/screen">Back to one company</Link></span></div>
      <h1 className="bk-h">Screen a whole list at once</h1>
      <p className="bk-lede">Upload a CSV of companies and each one is matched with the same fixed rules as the single-company page. You get a ranked table, a heat map of which programmes fit most of the list, and a CSV to take away. It runs in your browser: nothing is uploaded.</p>
      <div className={`drop${drag ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); void load(e.dataTransfer.files?.[0]); }}>
        <p><b>Drop a CSV here</b>, or <button type="button" className="linkbtn" onClick={() => input.current?.click()}>choose a file</button>.</p>
        <input ref={input} id="csv" type="file" accept=".csv,.tsv,.txt,text/csv" aria-label="Choose a CSV file" onChange={(e) => { void load(e.target.files?.[0]); e.target.value = ""; }} />
        <p className="faint" style={{ fontSize: 13.5 }}>Columns: company, country (required), region, employees or size, sector, description. Up to {MAX_ROWS} companies, 1 MB. Headers in Dutch or German work too.</p>
        <div className="drop-acts"><button type="button" className="btn alt" onClick={useExamples}>Try the five example companies</button><button type="button" className="btn alt" onClick={() => download("companies-template.csv", TEMPLATE, "text/csv;charset=utf-8")}>Download a template</button></div></div>
      {err && <div className="note err" role="alert">{err}</div>}
      {parsed && <>
        <div className="note" role="status"><b>{rows.length}</b> {rows.length === 1 ? "company" : "companies"} screened from {fileName}.{parsed.skipped.length > 0 && <> <b>{parsed.skipped.length}</b> left out.</>}{parsed.truncated && <> Only the first {MAX_ROWS} rows were used.</>}
          {Object.keys(parsed.columns).length > 0 && <> Columns understood: {Object.entries(parsed.columns).map(([k, v]) => `${v} as ${k}`).join(", ")}.</>}{parsed.unmapped.length > 0 && <> Ignored: {parsed.unmapped.join(", ")}.</>}
          {parsed.skipped.length > 0 && <details style={{ marginTop: 8 }}><summary>Why some rows were left out</summary><ul>{parsed.skipped.map((s) => <li key={s.row}>Row {s.row}, {s.name}: {s.reason}.</li>)}</ul></details>}</div>
        {rows.length > 0 && <>
          <div className="toolbar" style={{ margin: "22px 0 12px" }}><h2 className="bk-h2">Ranked by best match</h2><button type="button" className="btn" onClick={() => download("screening-results.csv", rowsToCsv(view), "text/csv;charset=utf-8")}>Download CSV</button></div>
          <div className="cl-wrap" role="region" aria-label="Screening results" tabIndex={0}>
            <table className="bk-table"><caption className="sr">One row per company. Scores are out of 110.</caption>
              <thead><tr>{head("name", "Company")}<th scope="col">Country</th><th scope="col">Size</th>{head("matches", "Matches")}{head("best", "Best score")}<th scope="col">Top three programmes</th><th scope="col"><span className="sr">Open</span></th></tr></thead>
              <tbody>{view.map((r) => <tr key={r.row}><th scope="row" className="bk-name">{r.name}{r.notes.length > 0 && <span className="bk-note">{r.notes.join("; ")}</span>}</th><td>{r.country}</td><td>{r.size}</td><td className="num">{r.matches}</td><td className="num">{r.best || "none"}</td>
                <td>{r.top.length ? <ol className="bk-top">{r.top.map((t) => <li key={t.id}><Link href={`/programmes#${t.id}`}>{t.name}</Link> <span className={`bk-fit ${t.fit}`}>{t.score}</span></li>)}</ol> : <span className="nt-muted">No open programme matched</span>}</td>
                <td><button type="button" className="mini" onClick={() => open(r)} aria-label={`Open ${r.name} in Screen`}>Open in Screen</button></td></tr>)}</tbody></table></div>
          {heat.programmes.length > 0 && <>
            <h2 className="bk-h2" style={{ margin: "34px 0 6px" }}>Which programmes fit most of the list</h2><p className="faint" style={{ fontSize: 13.5, margin: "0 0 12px" }}>Each cell is the readable score for that company and programme. Empty means no match. Darker means a higher score.</p>
            <div className="cl-wrap" role="region" aria-label="Heat map of programmes by company" tabIndex={0}>
              <table className="heat"><caption className="sr">Companies down the side, the ten programmes that match most of them across the top.</caption>
                <thead><tr><th scope="col">Company</th>{heat.programmes.map((p) => <th scope="col" key={p.id} title={p.name}><Link href={`/programmes#${p.id}`}>{p.name.length > 22 ? p.name.slice(0, 20) + "…" : p.name}</Link><span className="mono">{p.count} of {rows.length}</span></th>)}</tr></thead>
                <tbody>{view.map((r, i) => <tr key={r.row}><th scope="row">{r.name}</th>{heat.cells[i].map((v, j) => <td key={j} className={v ? "on" : ""} style={v ? { background: `color-mix(in srgb, var(--ember) ${Math.round(18 + (v / 110) * 72)}%, var(--sheet))` } : undefined}>{v || ""}</td>)}</tr>)}</tbody></table></div></>}
        </>}
      </>}
    </div>
  );
}
