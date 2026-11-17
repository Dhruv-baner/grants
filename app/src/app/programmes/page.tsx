"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import SchemeDetail from "@/components/SchemeDetail";
import { Status, Trust } from "@/components/Marks";
import { BY_ID, SCHEMES } from "@/lib/data";
import { countryGroup, fmtDate, LABEL, SECTORS } from "@/lib/ui";

const uniq = (f: (s: (typeof SCHEMES)[number]) => string) => [...new Set(SCHEMES.map(f))];
const COUNTRIES = ["NL", "DE", "EU", "Cross-border"].filter((c) => uniq(countryGroup).includes(c));
const TYPES = uniq((s) => s.type_group).sort(); const STATUSES = ["open", "opening_soon", "rolling", "between_rounds", "paused", "closed", "varies", "unknown"].filter((x) => uniq((s) => s.status_clean).includes(x));
const RANK: Record<string, number> = { open: 0, opening_soon: 1, rolling: 2, between_rounds: 3, varies: 4, paused: 5, unknown: 6, closed: 7 };
const TRUST = ["Verified", "Verified (framework)", "Partial", "Candidate"];

function Group({ label, value, set, options, big, fmt = (x: string) => x }: { label: string; value: string; set: (v: string) => void; options: string[]; big?: boolean; fmt?: (x: string) => string }) {
  return <div className="filter-row"><span className="lbl">{label}</span><div className="tog-group" role="group" aria-label={label}>{["", ...options].map((o) => <button key={o || "all"} className={"tog" + (big ? " big" : "")} aria-pressed={value === o} onClick={() => set(o)}>{o ? fmt(o) : "All"}</button>)}</div></div>;
}
export default function Programmes() {
  const [q, setQ] = useState(""), [country, setCountry] = useState(""), [tg, setTg] = useState(""), [sector, setSector] = useState(""), [status, setStatus] = useState(""), [ver, setVer] = useState(""), [calls, setCalls] = useState(true), [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => SCHEMES.filter((s) => (!q || (s.name + " " + s.aliases + " " + s.summary + " " + s.id).toLowerCase().includes(q.toLowerCase())) && (!country || countryGroup(s) === country) && (!tg || s.type_group === tg) &&
    (!sector || s.sector.split(";").map((x) => x.trim()).includes(sector)) && (!status || s.status_clean === status) && (!ver || s.verification === ver) && (calls || s.row_type === "scheme"))
    .sort((a, b) => (RANK[a.status_clean] ?? 9) - (RANK[b.status_clean] ?? 9) || (a.closes_date || "9").localeCompare(b.closes_date || "9") || a.name.localeCompare(b.name)), [q, country, tg, sector, status, ver, calls]);
  useEffect(() => {
    const reveal = (id: string) => { if (!BY_ID[id]) return; setQ(""); setCountry(""); setTg(""); setSector(""); setStatus(""); setVer(""); setCalls(true); setOpen(id); };
    const h = () => { const id = decodeURIComponent(window.location.hash.slice(1)); if (id) reveal(id); }; h();
    const ev = (e: Event) => reveal((e as CustomEvent<string>).detail); window.addEventListener("hashchange", h); window.addEventListener("gf:scheme", ev);
    return () => { window.removeEventListener("hashchange", h); window.removeEventListener("gf:scheme", ev); };
  }, []);
  useEffect(() => { if (open) { const t = setTimeout(() => document.getElementById("p-" + open)?.scrollIntoView({ block: "start", behavior: "smooth" }), 60); return () => clearTimeout(t); } }, [open]);
  return (
    <div className="wrap" style={{ paddingTop: "var(--s7)" }}>
      <div className="sec-head"><span className="mono">Programmes</span><span className="mono muted">Every scheme and call in the table. Open a row for terms and sources.</span></div>
      <input className="search-big" placeholder="Search by name or topic" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search programmes" />
      <div className="filters" style={{ marginTop: "var(--s6)" }}>
        <Group label="Country" value={country} set={setCountry} options={COUNTRIES} big />
        <Group label="Type" value={tg} set={setTg} options={TYPES} />
        <Group label="Status" value={status} set={setStatus} options={STATUSES} fmt={(x) => LABEL[x]} />
        <Group label="Sector" value={sector} set={setSector} options={SECTORS} />
        <Group label="Data quality" value={ver} set={setVer} options={TRUST} />
        <div className="filter-row"><span className="lbl">Rows</span><div className="tog-group"><button className="tog" aria-pressed={calls} onClick={() => setCalls(true)}>Schemes and calls</button><button className="tog" aria-pressed={!calls} onClick={() => setCalls(false)}>Schemes only</button></div></div>
      </div>
      <div className="mono muted num" style={{ marginBottom: 12 }} aria-live="polite">{rows.length} of {SCHEMES.length} shown</div>
      <div className="phead mono muted"><span>No.</span><span>Programme</span><span>Country</span><span>Type</span><span>Status</span><span>Closes</span><span>Data quality</span></div>
      {rows.map((s, n) => (
        <div className={"prow" + (open === s.id ? " open" : "")} id={"p-" + s.id} key={s.id}>
          <button aria-expanded={open === s.id} aria-controls={"d-" + s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
            <span className="mono faint num">{String(n + 1).padStart(2, "0")}</span>
            <span className="nm">{s.name}<small>{s.row_type === "call" ? `Call under ${s.parent_id} · ` : ""}{s.sector}</small></span>
            <span className="mono hide-s">{countryGroup(s)}</span><span className="mono hide-s">{s.type_group}</span>
            <span><Status s={s.status_clean} /></span><span className="mono num hide-s">{fmtDate(s.closes_date)}</span><span className="hide-s"><Trust v={s.verification} /></span>
          </button>
          <div className="prow-detail" id={"d-" + s.id} role="region" aria-label={s.name} {...(open === s.id ? {} : { inert: true })}>
            <div><div className="detail-in"><SchemeDetail s={s} />
              <dl className="dl" style={{ gridTemplateColumns: "120px minmax(0,1fr)", alignContent: "start" }}>
                {([["Authority", s.authority], ["Legal basis", s.legal_basis], ["Period", String(s["programme_period"] ?? "")], ["Level", s.level], ["Region", s.region]] as [string, string][]).filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
                {s.official_url && <><dt>Official page</dt><dd><a href={s.official_url} target="_blank" rel="noopener noreferrer">Open the source page</a></dd></>}
              </dl></div></div></div>
        </div>))}
      {!rows.length && <p style={{ padding: "40px 0", fontFamily: "var(--f-display)", fontSize: 32 }}>Nothing matches these filters.</p>}
    </div>
  );
}
