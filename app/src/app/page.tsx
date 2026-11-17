import Link from "next/link";
import { CountUp, Magnetic, Rise, Spot } from "@/components/Fx";
import HeroField from "@/components/HeroField";
import Ticker from "@/components/Ticker";
import { DEMOS, META, SCHEMES } from "@/lib/data";
import { daysBetween, fmtDate } from "@/lib/ui";

export default function Home() {
  const open = SCHEMES.filter((s) => ["open", "opening_soon", "rolling"].includes(s.status_clean)).length;
  const soon = SCHEMES.filter((s) => ["open", "opening_soon"].includes(s.status_clean) && s.closes_date && daysBetween(META.as_of, s.closes_date) >= 0 && daysBetween(META.as_of, s.closes_date) <= 35).length;
  const links = SCHEMES.reduce((n, s) => n + s.sources.length, 0), official = SCHEMES.reduce((n, s) => n + s.sources.filter((x) => x.tier === "Official").length, 0);
  const weak = SCHEMES.filter((s) => s.verification === "Partial" || s.verification === "Candidate").length;
  return (
    <>
      <Spot className="hero wrap">
        <div className="mono muted" style={{ marginBottom: 28 }}>Funding screening · Netherlands · Germany · EU</div>
        <Rise text="Which funding can this company actually *apply for?*" />
        <div className="hero-stage">
          <div className="plate"><HeroField /><div className="legend mono"><span><i className="beat" />Beating ember: closing within 35 days</span><span>Move over the field and click to send a ripple. Screen a company to light up its matches.</span></div></div>
          <div className="overlap">
            <p className="hero-sub">Match a company against {META.rows} sourced Dutch, German and EU schemes and calls. Every match comes with its score, its terms and the source of each fact.</p>
            <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}><Magnetic><Link className="btn" href="/screen">Screen a company <span className="arr">→</span></Link></Magnetic><Link className="link-u" href="/method">How fit is judged</Link></div>
          </div>
        </div>
      </Spot>
      <div style={{ marginTop: "var(--s8)" }}><Ticker /></div>

      <section className="section wrap">
        <div className="sec-head"><span className="mono">01</span><span className="mono">The table</span></div>
        <div className="grid12" style={{ rowGap: 48 }}>
          <div style={{ gridColumn: "span 5" }} className="col-a"><div className="ledger-big"><CountUp to={META.rows} /></div><p className="muted" style={{ marginTop: 16 }}>rows: {META.scheme_rows} schemes and {META.call_rows} individual calls, each with its terms, deadline and sources.</p></div>
          <div style={{ gridColumn: "span 7" }} className="col-b">
            {[[open, "open, opening soon or rolling today"], [soon, `close within 35 days of ${fmtDate(META.as_of)}`], [official, `official source links, out of ${links} in total`], [weak, "rows still partial or unverified, flagged wherever they appear"]].map(([n, l]) => (
              <div className="led-row" key={l as string}><span style={{ fontSize: 18 }}>{l}</span><span className="n"><CountUp to={n as number} /></span></div>))}
          </div>
        </div>
      </section>

      <section className="section-tight wrap">
        <div className="sec-head"><span className="mono">02</span><span className="mono">A match, step by step</span></div>
        <div className="steps">
          {[["1", "Filter", "Country, region, company size and status remove what cannot apply."], ["2", "Gate", "Schemes about vessels, hydrogen or start-ups appear only for companies that show that theme."], ["3", "Score", "Sector, shared themes, size, data quality and timing add up to a number you can read."], ["4", "Rank", "The top twelve are shown. Closed schemes are listed apart, never mixed in."]].map(([n, h, t]) => (
            <div className="step" key={n}><div className="big">{n}</div><h3>{h}</h3><p className="muted" style={{ fontSize: 15.5 }}>{t}</p></div>))}
        </div>
        <p style={{ marginTop: 28 }}><Link className="link-u" href="/method">Read the full method, with every point value</Link></p>
      </section>

      <section className="section wrap">
        <div className="sec-head"><span className="mono">03</span><span className="mono">Try a sample company</span></div>
        <div style={{ borderBottom: "1px solid var(--rule)" }}>
          {DEMOS.map((d, i) => (
            <Link key={d.id} href={`/screen#${d.id}`} className="sample"><span className="mono faint num">{String(i + 1).padStart(2, "0")}</span><span className="nm">{d.name.replace(" (fictional)", "")}</span>
              <span className="meta mono muted">{d.country} · {d.size} · {(d.sectors ?? []).join(", ")}</span><span className="arr">→</span></Link>))}
        </div>
      </section>

      <section className="band-ember section-tight" style={{ marginTop: "var(--s7)" }}>
        <div className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 32, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: "var(--t-3xl)", maxWidth: "11ch", color: "var(--ink)" }}>Start with a company. See what lights up.</h2>
          <Magnetic><Link className="btn on-dark" href="/screen">Screen a company <span className="arr">→</span></Link></Magnetic>
        </div>
      </section>
    </>
  );
}
