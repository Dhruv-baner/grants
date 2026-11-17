"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import DotField, { SOON_COUNT } from "@/components/DotField";
import SchemeDetail from "@/components/SchemeDetail";
import { Status } from "@/components/Marks";
import { BY_ID, DEMOS, META, SCHEMES } from "@/lib/data";
import { match } from "@/lib/matcher";
import { clean, countryGroup, daysBetween, fmtDate, LABEL, SECTORS } from "@/lib/ui";

const uniq = (f: (s: (typeof SCHEMES)[number]) => string) => [...new Set(SCHEMES.map(f))];
const COUNTRIES = ["NL", "DE", "EU", "Cross-border"].filter((c) => uniq(countryGroup).includes(c));
const TYPES = uniq((s) => s.type_group).sort();
const RANK: Record<string, number> = { open: 0, opening_soon: 1, rolling: 2, between_rounds: 3, varies: 4, paused: 5, unknown: 6, closed: 7 };
const STATUSES = Object.keys(RANK).filter((x) => uniq((s) => s.status_clean).includes(x));
/** Reverse lookup: which of the sample companies each scheme fits, using the real matcher. */
const FITS: Record<string, { id: string; name: string; score: number }[]> = (() => {
  const m: Record<string, { id: string; name: string; score: number }[]> = {};
  for (const d of DEMOS) for (const x of match({ ...d, signals: d.signals ?? [], description: d.description }, SCHEMES).matches) (m[x.scheme_id] ||= []).push({ id: d.id, name: d.name.replace(" (fictional)", ""), score: x.score });
  for (const k of Object.keys(m)) m[k].sort((a, b) => b.score - a.score);
  return m;
})();

function Pick({ label, value, set, options, fmt = (x: string) => x }: { label: string; value: string; set: (v: string) => void; options: string[]; fmt?: (x: string) => string }) {
  return <div className="field" style={{ margin: 0 }}><label>{label}</label><select value={value} onChange={(e) => set(e.target.value)} aria-label={label}><option value="">All</option>{options.map((o) => <option key={o} value={o}>{fmt(o)}</option>)}</select></div>;
}
export default function Programmes() {
  const [q, setQ] = useState(""), [country, setCountry] = useState(""), [tg, setTg] = useState(""), [sector, setSector] = useState(""), [status, setStatus] = useState(""), [open, setOpen] = useState<string | null>(null);
  const filtering = !!(q || country || tg || sector || status);
  const rows = useMemo(() => SCHEMES.filter((s) => (!q || (s.name + " " + s.aliases + " " + s.summary + " " + s.id).toLowerCase().includes(q.toLowerCase())) && (!country || countryGroup(s) === country) && (!tg || s.type_group === tg) &&
    (!sector || s.sector.split(";").map((x) => x.trim()).includes(sector)) && (!status || s.status_clean === status))
    .sort((a, b) => (RANK[a.status_clean] ?? 9) - (RANK[b.status_clean] ?? 9) || (a.closes_date || "9").localeCompare(b.closes_date || "9") || a.name.localeCompare(b.name)), [q, country, tg, sector, status]);
  const lit = useMemo(() => (filtering ? (Object.fromEntries(rows.map((r) => [r.id, "high"])) as Record<string, "high">) : undefined), [filtering, rows]);
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
      <div className="sec-head"><span className="mono">Programmes</span><span className="mono muted">Filter the field, then open any row for terms, sources and the companies it fits.</span></div>
      <input className="search-big" placeholder="Search by name or topic" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search programmes" />
      <div className="fgrid">
        <Pick label="Country" value={country} set={setCountry} options={COUNTRIES} /><Pick label="Type" value={tg} set={setTg} options={TYPES} />
        <Pick label="Status" value={status} set={setStatus} options={STATUSES} fmt={(x) => LABEL[x]} /><Pick label="Sector" value={sector} set={setSector} options={SECTORS} />
      </div>
      <div className="plate" style={{ padding: "24px 24px 18px", margin: "var(--s6) 0" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}><DotField lit={lit} urgent={!filtering} label={filtering ? `${rows.length} of ${SCHEMES.length} schemes match the filters` : "All 127 schemes and calls, one dot each"} onPick={(s) => reveal(s.id)} /></div>
        <div className="legend mono" aria-live="polite">{filtering ? <span><i />{rows.length} of {SCHEMES.length} match</span> : <span><i className="beat" />{SOON_COUNT} beating ember dots close within 35 days</span>}<span>Click a dot to open it.</span>{filtering && <button className="btn on-dark" style={{ padding: "8px 14px", fontSize: 11, marginLeft: "auto" }} onClick={clear}>Clear filters</button>}</div>
      </div>
      <div className="phead mono muted"><span>No.</span><span>Programme</span><span>Country</span><span>Type</span><span>Status</span><span>Closes</span></div>
      {rows.map((s, n) => { const left = s.closes_date && ["open", "opening_soon"].includes(s.status_clean) ? daysBetween(META.as_of, s.closes_date) : -1; const fits = FITS[s.id] ?? [];
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
                <div className="lbl">Sample companies this fits</div>
                {fits.length ? <ul className="srcs">{fits.map((f) => <li key={f.id}><Link href={`/screen#${f.id}`}>{f.name}</Link><span className="mono faint num">{f.score} points</span></li>)}</ul> : <p className="faint" style={{ fontSize: 15 }}>None of the ten sample companies fits this scheme.</p>}
                <dl className="dl" style={{ gridTemplateColumns: "120px minmax(0,1fr)", alignContent: "start", marginTop: 24 }}>
                  {([["Authority", s.authority], ["Legal basis", s.legal_basis], ["Period", clean(String(s["programme_period"] ?? ""))], ["Level", s.level], ["Region", s.region]] as [string, string][]).filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
                  {s.official_url && <><dt>Official page</dt><dd><a href={s.official_url} target="_blank" rel="noopener noreferrer">Open the source page</a></dd></>}
                </dl></div></div></div></div>
        </div>); })}
      {!rows.length && <p style={{ padding: "40px 0", fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 28 }}>Nothing matches these filters.</p>}
    </div>
  );
}
