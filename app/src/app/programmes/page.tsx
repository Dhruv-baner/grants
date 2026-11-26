"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Fuse, { Countdown, type FuseItem } from "@/components/Fuse";
import { download } from "@/lib/browser";
import { buildPortfolio, loadClients, type Client } from "@/lib/notes/clients";
import { SCREEN_PREFILL_KEY } from "@/lib/notes/handoff";
import { toIcs } from "@/lib/screen/timeline";
import SchemeDetail from "@/components/SchemeDetail";
import { Status } from "@/components/Marks";
import { BY_ID, META, REAL, SCHEMES } from "@/lib/data";
import { match } from "@/lib/matcher";
import { clean, countryGroup, daysBetween, fmtDate, LABEL, SECTORS } from "@/lib/ui";

const uniq = (f: (s: (typeof SCHEMES)[number]) => string) => [...new Set(SCHEMES.map(f))];
const COUNTRIES = ["NL", "DE", "EU", "Cross-border"].filter((c) => uniq(countryGroup).includes(c));
const TYPES = uniq((s) => s.type_group).sort();
const RANK: Record<string, number> = { open: 0, opening_soon: 1, rolling: 2, between_rounds: 3, varies: 4, paused: 5, unknown: 6, closed: 7 };
const STATUSES = Object.keys(RANK).filter((x) => uniq((s) => s.status_clean).includes(x));
/** Closing dates still ahead of the given day, soonest first: the deadlines at the top of the page. */
const upFrom = (day: string) => SCHEMES.filter((s) => ["open", "opening_soon"].includes(s.status_clean) && s.closes_date && daysBetween(day, s.closes_date) >= 0).sort((a, b) => a.closes_date.localeCompare(b.closes_date));
const ROLLING = SCHEMES.filter((s) => s.status_clean === "rolling").length;
/** Reverse lookup: which of the companies on the Screen page each scheme fits, using the same matcher. */
const FITS: Record<string, { id: string; name: string; score: number }[]> = (() => {
  const m: Record<string, { id: string; name: string; score: number }[]> = {};
  for (const d of REAL) for (const x of match({ ...d, signals: d.signals ?? [], description: d.description }, SCHEMES).matches) (m[x.scheme_id] ||= []).push({ id: d.id, name: d.name, score: x.score });
  for (const k of Object.keys(m)) m[k].sort((a, b) => b.score - a.score);
  return m;
})();

function Pick({ label, value, set, options, fmt = (x: string) => x }: { label: string; value: string; set: (v: string) => void; options: string[]; fmt?: (x: string) => string }) {
  return <div className="field" style={{ margin: 0 }}><label>{label}</label><select value={value} onChange={(e) => set(e.target.value)} aria-label={label}><option value="">All</option>{options.map((o) => <option key={o} value={o}>{fmt(o)}</option>)}</select></div>;
}
export default function Programmes() {
  const [q, setQ] = useState(""), [country, setCountry] = useState(""), [tg, setTg] = useState(""), [sector, setSector] = useState(""), [status, setStatus] = useState(""), [open, setOpen] = useState<string | null>(null), [today, setToday] = useState(META.as_of), [mine, setMine] = useState<{ n: number; by: Record<string, Client[]> }>({ n: 0, by: {} }), [mineOnly, setMineOnly] = useState(false); const router = useRouter();
  useEffect(() => { setToday(new Date().toLocaleDateString("en-CA")); }, []); // days left count from today on this device; the data itself is as of META.as_of
  useEffect(() => { let st: Storage | null = null; try { st = window.localStorage; } catch { /* ignore */ } const { clients } = loadClients(st); const p = buildPortfolio(clients, SCHEMES, 1); setMine({ n: clients.length, by: Object.fromEntries(p.ranked.map((e) => [e.id, e.clients])) }); }, []); // your saved calls, matched against every programme
  const screenClient = (c: Client) => { try { sessionStorage.setItem(SCREEN_PREFILL_KEY, JSON.stringify({ ...c.profile, signals: "" })); } catch { /* ignore */ } router.push("/screen"); };
  const UP = useMemo(() => upFrom(today), [today]); const SHOWN = useMemo(() => (mineOnly ? UP.filter((s) => mine.by[s.id]) : UP), [UP, mineOnly, mine]);
  const TL: FuseItem[] = useMemo(() => SHOWN.filter((s) => daysBetween(today, s.closes_date) <= 200).map((s) => ({ id: s.id, name: s.name, date: s.closes_date, days: daysBetween(today, s.closes_date), country: s.country })), [SHOWN, today]); // the timeline follows the toggle; the countdown above it always counts the next date of all
  const ics = () => download(mineOnly ? "client-deadlines.ics" : "programme-deadlines.ics", toIcs(SHOWN.map((s) => ({ id: s.id, name: s.name, date: s.closes_date, kind: "closes" as const, note: mine.by[s.id] ? `Fits your clients: ${mine.by[s.id].map((c) => c.name).join(", ")}` : clean(s.status).slice(0, 140), urgency: "soon" as const, url: s.official_url })), mineOnly ? "your clients" : "Programme deadlines"), "text/calendar;charset=utf-8"); const FUSE: FuseItem[] = useMemo(() => UP.filter((s) => daysBetween(today, s.closes_date) <= 200).map((s) => ({ id: s.id, name: s.name, date: s.closes_date, days: daysBetween(today, s.closes_date), country: s.country })), [UP, today]);
  const filtering = !!(q || country || tg || sector || status);
  const rows = useMemo(() => SCHEMES.filter((s) => (!q || (s.name + " " + s.aliases + " " + s.summary + " " + s.id).toLowerCase().includes(q.toLowerCase())) && (!country || countryGroup(s) === country) && (!tg || s.type_group === tg) &&
    (!sector || s.sector.split(";").map((x) => x.trim()).includes(sector)) && (!status || s.status_clean === status))
    .sort((a, b) => (RANK[a.status_clean] ?? 9) - (RANK[b.status_clean] ?? 9) || (a.closes_date || "9").localeCompare(b.closes_date || "9") || a.name.localeCompare(b.name)), [q, country, tg, sector, status]);
  const clear = () => { setQ(""); setCountry(""); setTg(""); setSector(""); setStatus(""); };
  const reveal = (id: string) => { if (!BY_ID[id]) return; clear(); setOpen(id); };
  useEffect(() => {
    const h = () => { const id = decodeURIComponent(window.location.hash.slice(1)); if (id) reveal(id); }; h();
    const ev = (e: Event) => reveal((e as CustomEvent<string>).detail); window.addEventListener("hashchange", h); window.addEventListener("gf:scheme", ev);
    return () => { window.removeEventListener("hashchange", h); window.removeEventListener("gf:scheme", ev); };
  }, []);
  useEffect(() => { if (open) { const t = setTimeout(() => document.getElementById("p-" + open)?.scrollIntoView({ block: "start", behavior: "smooth" }), 60); return () => clearTimeout(t); } }, [open]);
  return (
    <div className="wrap" style={{ paddingTop: "var(--s7)" }}>
      <section id="deadlines" aria-labelledby="dl-h">
        <div className="sec-head"><span className="mono" id="dl-h">Deadlines</span><span className="mono muted">{UP.length} known closing dates. {ROLLING} more programmes have no closing date.</span></div>
        <div className="dl-top"><div><Countdown items={FUSE} /></div>
          <p className="muted">The clock runs on your device. Dates are true as of {fmtDate(META.as_of)}. Open a programme below for its terms.</p></div>
        <div className="dl-tools">{mine.n > 0 && <label className="pf-toggle"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />Only programmes that fit my clients ({Object.keys(mine.by).filter((id) => UP.some((s) => s.id === id)).length})</label>}<button type="button" className="btn alt" disabled={!SHOWN.length} onClick={ics}>Add these dates to my calendar</button></div>
        {TL.length > 0 ? <div className="dl-plate"><Fuse items={TL} asOf={today} /></div> : <p className="faint" style={{ marginTop: 18 }}>{SHOWN.length ? "No closing dates in the next 200 days." : "None of the programmes with a closing date ahead fits your saved clients."}</p>}
        {TL.length > 0 && SHOWN.length > TL.length && <p className="faint dl-more">{SHOWN.length - TL.length} later {SHOWN.length - TL.length === 1 ? "date is" : "dates are"} not drawn here. {SHOWN.length - TL.length === 1 ? "It is" : "They are"} in the calendar file.</p>}
      </section>
      <section id="programmes" aria-labelledby="pr-h" style={{ marginTop: "var(--s9)" }}>
        <div className="sec-head"><span className="mono" id="pr-h">Programmes</span><span className="mono muted">{rows.length} of {SCHEMES.length}. Filter, then open any row for terms, sources and the companies it fits.</span></div>
        <input className="search-big" placeholder="Search by name or topic" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search programmes" />
        <div className="fgrid">
          <Pick label="Country" value={country} set={setCountry} options={COUNTRIES} /><Pick label="Type" value={tg} set={setTg} options={TYPES} />
          <Pick label="Status" value={status} set={setStatus} options={STATUSES} fmt={(x) => LABEL[x]} /><Pick label="Sector" value={sector} set={setSector} options={SECTORS} />
        </div>
        {filtering && <div style={{ margin: "var(--s4) 0 var(--s2)" }}><button type="button" className="btn alt" onClick={clear}>Clear filters</button></div>}
        <div style={{ height: "var(--s5)" }} />
      <div className="phead mono muted"><span>No.</span><span>Programme</span><span>Country</span><span>Type</span><span>Status</span><span>Closes</span></div>
      {rows.map((s, n) => { const left = s.closes_date && ["open", "opening_soon"].includes(s.status_clean) ? daysBetween(today, s.closes_date) : -1; const fits = FITS[s.id] ?? [];
        return (
        <div className={"prow" + (open === s.id ? " open" : "")} id={"p-" + s.id} key={s.id}>
          <button aria-expanded={open === s.id} aria-controls={"d-" + s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
            <span className="mono faint num">{String(n + 1).padStart(2, "0")}</span>
            <span className="nm">{s.name}<small>{s.row_type === "call" ? `Call under ${s.parent_id} · ` : ""}{s.sector}</small></span>
            <span className="mono hide-s">{countryGroup(s)}</span><span className="mono hide-s">{s.type_group}</span>
            <span><Status s={s.status_clean} /></span>
            <span className="mono num hide-s">{fmtDate(s.closes_date)}{left >= 0 && <span className="faint" style={{ display: "block" }}>{left === 0 ? "today" : `in ${left} days`}</span>}</span>
          </button>
          <div className="prow-detail" id={"d-" + s.id} role="region" aria-label={s.name} {...(open === s.id ? {} : { inert: true })}>
            <div><div className="detail-in"><SchemeDetail s={s} />
              <div>
                <div className="lbl">Your saved clients this fits</div>
                {mine.n === 0 ? <p className="faint" style={{ fontSize: 15 }}>No saved calls yet. <Link href="/notes">Record a call</Link> and the programmes it fits appear here.</p> : (mine.by[s.id] ?? []).length ? <ul className="srcs">{mine.by[s.id].map((c) => <li key={c.id}><button type="button" className="linkbtn" onClick={() => screenClient(c)}>{c.name}</button></li>)}</ul> : <p className="faint" style={{ fontSize: 15 }}>None of your {mine.n} saved {mine.n === 1 ? "client fits" : "clients fit"} this programme.</p>}
                <div className="lbl" style={{ marginTop: 18 }}>Companies on the Screen page this fits</div>
                {fits.length ? <ul className="srcs">{fits.map((f) => <li key={f.id}><Link href={`/screen#${f.id}`}>{f.name}</Link></li>)}</ul> : <p className="faint" style={{ fontSize: 15 }}>None of the five companies on the Screen page fits this scheme.</p>}
                <dl className="dl" style={{ gridTemplateColumns: "120px minmax(0,1fr)", alignContent: "start", marginTop: 24 }}>
                  {([["Authority", s.authority], ["Legal basis", s.legal_basis], ["Period", clean(String(s["programme_period"] ?? ""))], ["Level", s.level], ["Region", s.region]] as [string, string][]).filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
                  {s.official_url && <><dt>Official page</dt><dd><a href={s.official_url} target="_blank" rel="noopener noreferrer">Open the source page</a></dd></>}
                </dl></div></div></div></div>
        </div>); })}
      {!rows.length && <p style={{ padding: "40px 0", fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 28 }}>Nothing matches these filters.</p>}
      </section>
    </div>
  );
}
