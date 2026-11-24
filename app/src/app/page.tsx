import Link from "next/link";
import { Magnetic, Rise, Spot } from "@/components/Fx";
import Ticker from "@/components/Ticker";

export default function Home() {
  return (
    <>
      <Spot className="hero wrap">
        <div className="mono muted" style={{ marginBottom: 28 }}>For funding consultants · Netherlands · Germany · EU</div>
        <Rise text="Your complete guide for *grants*" />
        <div style={{ marginTop: "var(--s7)" }}>
          <p className="hero-sub">Built for funding consultants: screen a company, check eligibility, estimate the aid and keep your call notes, on carefully sourced programmes</p>
          <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap", marginTop: 28 }}><Magnetic><Link className="btn" href="/screen">Screen a company <span className="arr">→</span></Link></Magnetic><Link className="link-u" href="/method">How fit is judged</Link></div>
        </div>
      </Spot>
      <div style={{ marginTop: "var(--s8)" }}><Ticker /></div>

      <section className="band-ember section-tight" style={{ marginTop: "var(--s7)" }}>
        <div className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 32, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: "var(--t-3xl)", maxWidth: "11ch", color: "var(--ink)" }}>Start with a company. See what lights up.</h2>
          <Magnetic><Link className="btn on-dark" href="/screen">Screen a company <span className="arr">→</span></Link></Magnetic>
        </div>
      </section>

      <section className="section-tight wrap">
        <div className="sec-head"><span className="mono">01</span><span className="mono">A match, step by step</span></div>
        <div className="steps">
          {[["1", "Filter", "Country, region, company size and status remove what cannot apply."], ["2", "Gate", "Schemes about vessels, hydrogen or start-ups appear only for companies that show that theme."], ["3", "Score", "Sector, shared themes, size, data quality and timing add up to a number you can read."], ["4", "Rank", "The top twelve are shown. Closed schemes are listed apart, never mixed in."]].map(([n, h, t]) => (
            <div className="step" key={n}><div className="big">{n}</div><h3>{h}</h3><p className="muted" style={{ fontSize: 15.5 }}>{t}</p></div>))}
        </div>
        <p style={{ marginTop: 28 }}><Link className="link-u" href="/method">Read the full method, with every point value</Link></p>
      </section>
    </>
  );
}
