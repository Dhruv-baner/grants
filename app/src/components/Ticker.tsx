import Link from "next/link";
import { META, SCHEMES } from "@/lib/data";
import { daysBetween, fmtDate } from "@/lib/ui";
export default function Ticker() {
  const items = SCHEMES.filter((s) => ["open", "opening_soon"].includes(s.status_clean) && s.closes_date && daysBetween(META.as_of, s.closes_date) >= 0 && daysBetween(META.as_of, s.closes_date) <= 140)
    .sort((a, b) => a.closes_date.localeCompare(b.closes_date)).slice(0, 14);
  const row = (k: string) => items.map((s) => (
    <Link key={k + s.id} href={`/programmes#${s.id}`} className="ticker-item" tabIndex={k === "b" ? -1 : 0} aria-hidden={k === "b" ? true : undefined}>
      <span className="d num">{fmtDate(s.closes_date).replace(/ 20\d\d$/, "")}</span><span style={{ fontSize: 15 }}>{s.name.length > 46 ? s.name.slice(0, 45) + "…" : s.name}</span><span className="mono" style={{ color: "var(--cream-2)" }}>in {daysBetween(META.as_of, s.closes_date)} days</span>
    </Link>));
  return <div className="ticker band-char" aria-label="Upcoming closing dates"><div className="ticker-track">{row("a")}{row("b")}</div></div>;
}
