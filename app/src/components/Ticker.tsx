"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { META, SCHEMES } from "@/lib/data";
import { daysBetween, fmtDate } from "@/lib/ui";
/** The next closing dates. Days left count from today on this device, and dates that have passed drop off; the data itself is as of META.as_of. */
export default function Ticker() {
  const [today, setToday] = useState(META.as_of);
  useEffect(() => { setToday(new Date().toLocaleDateString("en-CA")); }, []);
  const items = SCHEMES.filter((s) => ["open", "opening_soon"].includes(s.status_clean) && s.closes_date && daysBetween(today, s.closes_date) >= 0 && daysBetween(today, s.closes_date) <= 140)
    .sort((a, b) => a.closes_date.localeCompare(b.closes_date)).slice(0, 14);
  const left = (d: number) => (d === 0 ? "closes today" : d === 1 ? "in 1 day" : `in ${d} days`);
  const row = (k: string) => items.map((s) => (
    <Link key={k + s.id} href={`/programmes#${s.id}`} className="ticker-item" tabIndex={k === "b" ? -1 : 0} aria-hidden={k === "b" ? true : undefined}>
      <span className="d num">{fmtDate(s.closes_date).replace(/ 20\d\d$/, "")}</span><span style={{ fontSize: 15 }}>{s.name.length > 46 ? s.name.slice(0, 45) + "…" : s.name}</span><span className="mono" style={{ color: "var(--cream-2)" }}>{left(daysBetween(today, s.closes_date))}</span>
    </Link>));
  return <div className="ticker band-char" aria-label="Upcoming closing dates"><div className="ticker-track">{row("a")}{row("b")}</div></div>;
}
