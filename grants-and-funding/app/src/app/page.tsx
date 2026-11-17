import Link from "next/link";
import { DEMOS, META, SCHEMES } from "@/lib/data";
import { daysBetween } from "@/lib/ui";

export default function Home() {
  const open = SCHEMES.filter((s) => ["open", "opening_soon", "rolling"].includes(s.status_clean)).length;
  const soon = SCHEMES.filter((s) => ["open", "opening_soon"].includes(s.status_clean) && s.closes_date && daysBetween(META.as_of, s.closes_date) >= 0 && daysBetween(META.as_of, s.closes_date) <= 35);
  const verified = SCHEMES.filter((s) => s.verification.startsWith("Verified")).length;
  const official = SCHEMES.reduce((n, s) => n + s.sources.filter((x) => x.tier === "Official").length, 0);
  return (
    <>
      <div className="hero">
        <h1>Find the funding a company can actually apply for, <em>with the sources to prove it.</em></h1>
        <p className="lead">Grants and Funding screens a company against {META.rows} sourced Dutch, German and EU funding schemes and calls, ranks the fits, flags what is closed or unverified, and hands a consultant a brief with questions to ask.</p>
        <div className="row" style={{ marginTop: 16 }}><Link className="btn" href="/screen">Screen a company</Link><Link className="btn ghost" href="/programmes">Browse programmes</Link><Link className="btn ghost" href="/deadlines">See deadlines</Link></div>
      </div>
      <h2>The data layer</h2>
      <div className="grid g4">
        <div className="card stat"><div className="n">{META.rows}</div><div className="l">rows: {META.scheme_rows} schemes and {META.call_rows} individual calls</div></div>
        <div className="card stat"><div className="n">{open}</div><div className="l">schemes open, opening soon or rolling today</div></div>
        <div className="card stat"><div className="n" style={{ color: "var(--warn)" }}>{soon.length}</div><div className="l">close within 35 days of {META.as_of}</div></div>
        <div className="card stat"><div className="n">{official}</div><div className="l">official source links; {verified} rows at Verified or framework level</div></div>
      </div>
      <h2>How it stays honest</h2>
      <div className="grid g3">
        <div className="card"><h3>Every row has a trust label</h3><p className="muted">Verified, Verified (framework), Partial or Candidate. Weak rows are flagged in every brief and never given invented numbers.</p></div>
        <div className="card"><h3>Rates are copied, not generated</h3><p className="muted">Funding rates, caps and windows come verbatim from the data with a source and an as-of date. Where sources disagree, the conflict is logged.</p></div>
        <div className="card"><h3>Matching is auditable</h3><p className="muted">Deterministic rules decide eligibility; a "why others were left out" list shows every filter that fired. A parity-tested Python and TypeScript pair produce identical results.</p></div>
      </div>
      <h2>Try a demo company</h2>
      <div className="grid g3">
        {DEMOS.slice(0, 6).map((d) => (
          <Link key={d.id} href={`/screen#${d.id}`} className="card" style={{ color: "inherit" }}>
            <h3>{d.name}</h3><div className="muted small">{d.country} · {d.size} · {(d.sectors ?? []).join(", ")}</div><p className="muted small" style={{ marginBottom: 0 }}>{d.description.replace("Fictional ", "")}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
