"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { download } from "@/lib/browser";
import { BY_ID } from "@/lib/data";
import { sampleCalls } from "@/lib/notes/calls";
import { buildPortfolio, deadlineItems, loadClients, type Client } from "@/lib/notes/clients";
import { SCREEN_PREFILL_KEY } from "@/lib/notes/handoff";
import { loadNotes, saveNotes, upsertNote } from "@/lib/notes/store";
import { toIcs } from "@/lib/screen/timeline";
import { fmtDate } from "@/lib/ui";

const store = () => { try { return window.localStorage; } catch { return null; } };
/** Every saved call screened at once: which programmes fit most of your clients, and who to call about each. */
export default function Portfolio() {
  const router = useRouter(); const [ready, setReady] = useState(false); const [data, setData] = useState<{ clients: Client[]; skipped: string[] }>({ clients: [], skipped: [] }); const [today, setToday] = useState("");
  const load = useCallback(() => { setData(loadClients(store())); setToday(new Date().toLocaleDateString("en-CA")); setReady(true); }, []);
  useEffect(() => { load(); }, [load]);
  const pf = useMemo(() => buildPortfolio(data.clients), [data.clients]), items = useMemo(() => (today ? deadlineItems(pf.ranked, today) : []), [pf, today]), total = data.clients.length;
  const addSamples = () => { const st = store(); let next = loadNotes(st); for (const n of sampleCalls()) next = upsertNote(next, n); saveNotes(next, st); load(); };
  const toScreen = (c: Client) => { try { sessionStorage.setItem(SCREEN_PREFILL_KEY, JSON.stringify({ ...c.profile, signals: "" })); } catch { /* ignore */ } router.push("/screen"); };
  const closes = (id: string) => { const s = BY_ID[id]; return s?.closes_date && s.closes_date >= today && ["open", "opening_soon"].includes(s.status_clean) ? `Closes ${fmtDate(s.closes_date)}` : s?.status_clean === "rolling" ? "Open on a rolling basis" : ""; };
  return (
    <div className="wrap pf">
      <header className="pf-head"><p className="pf-kick mono">Portfolio</p><h1>Your clients across the programmes</h1>
        <p className="pf-lede">Every saved call is screened with the same fixed rules as the Screen page. See which programmes fit most of your clients, and who to call about each. Saved in this browser only.</p></header>
      {!ready ? null : total === 0 ? (
        <div className="pf-empty"><h2>No clients to compare yet</h2><p>Record or paste a call and say where the company is. It appears here, screened against every programme. To see how it works first, add a few fictional calls.</p>
          <div className="pf-acts"><button type="button" className="nbtn pri" onClick={addSamples}>Add sample calls</button><Link className="nbtn" href="/notes">Record a call</Link></div>
          {data.skipped.length > 0 && <p className="pf-skip">{data.skipped.length} saved {data.skipped.length === 1 ? "call does" : "calls do"} not say where the company is, so nothing can be matched yet: {data.skipped.join(", ")}.</p>}</div>
      ) : (
        <>
          <div className="pf-tiles"><div><b>{total}</b><span>{total === 1 ? "client screened" : "clients screened"}</span></div><div><b>{pf.ranked.length}</b><span>programmes fit at least one</span></div><div><b>{pf.ranked[0] ? `${pf.ranked[0].clients.length} of ${total}` : "None"}</b><span>{pf.ranked[0] ? `fit ${pf.ranked[0].name.replace(/\s*\(.*$/, "")}` : "no programme fits yet"}</span></div></div>
          {data.skipped.length > 0 && <p className="pf-skip">Left out because the call does not say where the company is: {data.skipped.join(", ")}.</p>}
          <section aria-labelledby="pf-r"><h2 id="pf-r">Programmes that fit most of your clients</h2>
            {pf.ranked.length ? <ol className="pf-rank">{pf.ranked.slice(0, 8).map((e) => (
              <li key={e.id}><div className="pf-r1"><Link className="pf-nm" href={`/programmes#${e.id}`}>{e.name}</Link><span className="pf-ct mono">{e.clients.length} of {total} {total === 1 ? "client" : "clients"}</span></div>
                <div className="pf-r2">{e.clients.map((c) => <button type="button" key={c.id} className="pf-chip" onClick={() => toScreen(c)} title={`Screen ${c.name}`}>{c.name}</button>)}</div>{closes(e.id) && <p className="pf-dl mono">{closes(e.id)}</p>}</li>))}</ol> : <p className="faint">No open programme fits these clients yet.</p>}
            <div className="pf-acts"><button type="button" className="nbtn" disabled={!items.length} onClick={() => download("client-deadlines.ics", toIcs(items, "your clients"), "text/calendar;charset=utf-8")}>Add the closing dates to my calendar</button><span className="nt-muted">{items.length ? `${items.length} dates, for the programmes that fit your clients.` : "No closing dates ahead for these programmes."}</span></div>
          </section>
          {pf.heat.programmes.length > 0 && <section aria-labelledby="pf-h"><h2 id="pf-h">Who fits what</h2>
            <div className="pf-heat-wrap" tabIndex={0} role="region" aria-label="Which clients each programme fits"><table className="heat"><caption className="sr">Clients down the side, the programmes that fit most of them across the top. A tick means the programme fits.</caption>
              <thead><tr><th scope="col">Client</th>{pf.heat.programmes.map((p) => <th scope="col" key={p.id} title={p.name}><Link href={`/programmes#${p.id}`}>{p.name.length > 22 ? p.name.slice(0, 20) + "…" : p.name}</Link></th>)}</tr></thead>
              <tbody>{data.clients.map((c, i) => <tr key={c.id}><th scope="row">{c.name}</th>{pf.heat.cells[i].map((v, j) => <td key={j} className={v ? "on" : ""} style={v ? { background: "color-mix(in srgb, var(--ember) 38%, var(--sheet))" } : undefined}>{v ? <><span aria-hidden="true">✓</span><span className="sr">Fits</span></> : <span className="sr">Does not fit</span>}</td>)}</tr>)}</tbody></table></div></section>}
          <section aria-labelledby="pf-c"><h2 id="pf-c">Each client</h2>
            <ul className="pf-clients">{data.clients.map((c, i) => <li key={c.id}><div><b>{c.name}</b><span className="pf-meta mono">{[c.profile.region, c.profile.country, c.profile.size !== "unknown" ? c.profile.size : ""].filter(Boolean).join(" · ")}</span></div>
              <p>{pf.rows[i].top.length ? pf.rows[i].top.map((t) => t.name).join("; ") : "No open programme fits yet."}</p>
              <div className="pf-acts"><button type="button" className="nbtn" onClick={() => toScreen(c)}>Screen →</button><Link className="nbtn" href="/notes/calls" onClick={() => { try { sessionStorage.setItem("gf-calls-focus", c.id); } catch { /* ignore */ } }}>Open call</Link></div></li>)}</ul></section>
        </>
      )}
    </div>
  );
}
