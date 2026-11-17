import Fuse, { Countdown, type FuseItem } from "@/components/Fuse";
import { Status, Trust } from "@/components/Marks";
import { META, SCHEMES } from "@/lib/data";
import { clean, daysBetween, fmtDate } from "@/lib/ui";

export default function Deadlines() {
  const up = SCHEMES.filter((s) => ["open", "opening_soon"].includes(s.status_clean) && s.closes_date && daysBetween(META.as_of, s.closes_date) >= 0).sort((a, b) => a.closes_date.localeCompare(b.closes_date));
  const items: FuseItem[] = up.filter((s) => daysBetween(META.as_of, s.closes_date) <= 200).map((s) => ({ id: s.id, name: s.name, date: s.closes_date, days: daysBetween(META.as_of, s.closes_date), country: s.country }));
  const rolling = SCHEMES.filter((s) => s.status_clean === "rolling").length;
  return (
    <>
      <div className="wrap" style={{ paddingTop: "var(--s7)" }}>
        <div className="sec-head"><span className="mono">Deadlines</span><span className="mono muted">{up.length} known closing dates. {rolling} more schemes have no closing date.</span></div>
        <div className="grid12" style={{ rowGap: 24, alignItems: "end" }}><div style={{ gridColumn: "span 8" }} className="col-a"><Countdown items={items} /></div>
          <p className="muted col-b" style={{ gridColumn: "span 4" }}>The clock runs on your device. Dates come from the table and are true as of {fmtDate(META.as_of)}.</p></div>
      </div>
      <section className="band-char" style={{ marginTop: "var(--s7)", padding: "var(--s6) 0 var(--s5)" }}><div className="wrap"><Fuse items={items} asOf={META.as_of} /></div></section>
      <div className="wrap" style={{ marginTop: "var(--s8)" }}>
        <div className="sec-head"><span className="mono">All dates</span></div>
        {up.map((s) => (<div className="drow" key={s.id}><span className="mono num">{fmtDate(s.closes_date)}</span><span className="mono num muted">{daysBetween(META.as_of, s.closes_date)} days</span>
          <span><a className="nm" href={`/programmes#${s.id}`} style={{ textDecoration: "none" }}>{s.name}</a><div className="faint" style={{ fontSize: 13.5, marginTop: 4, maxWidth: "70ch" }}>{clean(s.status)}</div></span><span className="mono">{s.country}</span><span><Trust v={s.verification} /> <Status s={s.status_clean} /></span></div>))}
      </div>
    </>
  );
}
