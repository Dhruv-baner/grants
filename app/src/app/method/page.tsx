import Link from "next/link";
import WorkedExample from "@/components/WorkedExample";
import cfg from "@/lib/matcher-config.json";

const THEMES: Record<string, [string, string]> = {
  rd_innovation: ["R&D and innovation", "research, development, prototype, experimental"], ai_digital: ["AI and digital", "AI, software, data, ICT"], cyber: ["Cyber and security", "cyber, security"],
  energy_saving: ["Energy saving", "LED, insulation, heat pumps, efficiency"], renewable_energy: ["Renewable energy", "solar, wind, electrification"], hydrogen: ["Hydrogen", "electrolysers, hydrogen"],
  decarbonisation: ["Decarbonisation", "CO2, emissions, net zero"], ccus: ["Carbon capture", "capture, storage, carbon management"], site_investment: ["Site investment", "new site, expansion, new jobs"],
  startup: ["Start-ups", "founders, pre-formation"], vessel_inland: ["Inland vessels", "barges, inland waterways"], vessel_sea: ["Sea-going vessels", "sea ships, short-sea"],
  circular_plastics: ["Circular economy", "recycling, plastics, waste"], games_creative: ["Games and creative media", "games, creative, immersive"], financing_gap: ["Financing", "loans, guarantees, collateral"],
  consortium_crossborder: ["Consortia", "consortium, cross-border partners"], training_skills: ["Training and skills", "training, apprentices"], agri: ["Agriculture and food", "farm, rural, food"],
  health: ["Health and medical", "medical, clinical, pharma"], heat_networks: ["Heat networks", "district heating"], environment_invest: ["Environmental investment", "sustainable, environmental"],
  social_enterprise: ["Social enterprises", "social impact"], industrial_large: ["Large industrial projects", "chemical, steel, scale-up"],
};
const ROWS: [string, string, string, boolean?][] = [
  ["Sector fit", "20 to 40", "Open to all sectors: 20. Tagged with sectors the company works in: 20 plus 20 times the share of the scheme's sector tags that match. Only an adjacent sector, such as energy and industry: 12."],
  ["Shared themes", "0 to 30", `10 for each theme found in both the company description and the scheme, up to 30. There are ${Object.keys(cfg.CONCEPTS).length} themes, listed below.`],
  ["Company size", "2 or 10", "10 when the scheme is open to every size or lists the company's size. 2 when the scheme does not say, or the company's size is unknown."],
  ["Data quality", "0 to 10", "Verified 10. Verified, framework 7. Partial 3. Candidate 0. A weaker source ranks lower, never higher."],
  ["Timing", "0 to 10", "Open, rolling or opening soon: 10. Between rounds: 5."],
  ["Tax incentive", "+10", "Entitlements such as R&D tax credits: no competition for funds, so they score higher."],
  ["Location not given", "-15", "A regional scheme when the company's state or province is unknown.", true],
  ["Needs a consortium", "-15", "The scheme requires partners the company has not mentioned.", true],
];
export const metadata = { title: "How fit is judged · Grants and Funding" };

export default function Method() {
  return (
    <div className="wrap" style={{ paddingTop: "var(--s7)" }}>
      <div className="sec-head"><span className="mono">Method</span><span className="mono muted">How fit is judged</span></div>
      <div className="method-grid"><h1 style={{ fontSize: "var(--t-3xl)" }}>Fit is a score you can <em>read.</em></h1>
        <div><p style={{ fontSize: 21, lineHeight: 1.45 }}>Fit is not a model&apos;s opinion. It is a fixed set of rules, applied the same way every time. The same company description always gives the same ranking, and every match shows how many points came from where.</p>
          <p className="muted">Claude is never used to decide a match. When live mode is on, the curated AI brief uses it to write the short explanations, and any number it writes that is not in the data is thrown away.</p></div></div>

      <section className="section-tight"><div className="sec-head"><span className="mono">Step 1</span><span className="mono">Filter</span></div>
        <div className="method-grid"><h2>What cannot apply is removed.</h2><ul style={{ margin: 0, paddingLeft: 20, fontSize: 18, lineHeight: 1.6 }}>
          <li>Wrong country. A Dutch company never sees a German-only scheme. EU-wide schemes stay.</li>
          <li>Wrong region. A regional scheme needs a matching state or province. If the location is not given, the scheme stays, with a penalty.</li>
          <li>Company size not eligible, when the scheme states which sizes may apply.</li>
          <li>Umbrella programmes. Their individual calls are matched instead.</li>
          <li>Nothing in common. A scheme must share a theme with the company or match its sector directly. A scheme open to all sectors needs a shared theme.</li></ul></div></section>

      <section className="section-tight"><div className="sec-head"><span className="mono">Step 2</span><span className="mono">Gate by theme</span></div>
        <div className="method-grid"><h2>Narrow schemes need a matching company.</h2><div><p style={{ fontSize: 18 }}>Some schemes only make sense for one kind of company: inland vessels, sea-going vessels, hydrogen, carbon capture, heat networks, games, plastics recycling, start-ups, agriculture, health and social enterprises. They appear only when the company description shows that theme.</p></div></div></section>

      <section className="section-tight"><div className="sec-head"><span className="mono">Step 3</span><span className="mono">Score</span></div>
        <div className="method-grid"><h2>Points are added, then adjusted.</h2>
          <div><table className="pts"><thead><tr><th>Component</th><th>Points</th><th>Rule</th></tr></thead><tbody>{ROWS.map(([a, b, c, neg]) => <tr key={a}><td><b style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 18 }}>{a}</b></td><td className={"p num" + (neg ? " neg" : "")}>{b}</td><td>{c}</td></tr>)}</tbody></table>
            <p className="faint" style={{ marginTop: 14, fontSize: 14 }}>The best possible score is 110. Scores can pass 100 because of the tax bonus.</p></div></div></section>

      <section className="section-tight"><div className="sec-head"><span className="mono">Step 4</span><span className="mono">Rank and show</span></div>
        <div className="bands">{[["75+", "High fit", "Strong match on sector, themes and timing."], ["60 to 74", "Medium fit", "A real overlap, with at least one gap."], ["50 to 59", "Low fit", "Worth a look, not a priority."], ["Under 50", "Not shown", "Too little in common."]].map(([r, h, t]) => <div className="band" key={r}><div className="r num">{r}</div><div className="mono" style={{ margin: "6px 0 8px" }}>{h}</div><p className="muted" style={{ fontSize: 15 }}>{t}</p></div>)}</div>
        <p style={{ marginTop: 24, maxWidth: "70ch" }}>Only the top {cfg.TOP_N} are shown. Closed or paused schemes that would otherwise score 50 or more are listed apart as relevant but not open, up to six. Unverified rows and rows with no clear status go to a short check by hand list, with no ranking.</p></section>

      <section className="section-tight"><div className="sec-head"><span className="mono">Not checked</span><span className="mono">What a consultant still decides</span></div>
        <div className="method-grid"><h2>The score does not know everything.</h2><div><p style={{ fontSize: 18 }}>These conditions are not tested by the score. They appear as key terms, watch-outs and questions on each match, and a consultant decides.</p>
          <ul style={{ paddingLeft: 20, fontSize: 17.5, lineHeight: 1.6 }}><li>Company age limits, such as founded within three years.</li><li>Minimum or maximum project size.</li><li>Whether the project has already started.</li><li>State aid ceilings and the exact rate that applies.</li><li>Whether the partners a consortium needs actually exist.</li><li>The quality of the project itself.</li></ul>
          <p>Missing information never counts as eligibility. If a scheme does not say which sizes may apply, it stays in the list and is flagged to check.</p></div></div></section>

      <section className="section-tight"><div className="sec-head"><span className="mono">Data quality</span><span className="mono">What the marks mean</span></div>
        <div className="bands">{[["v", "Verified", "Every key fact traces to an official page or legal text."], ["f", "Verified, framework", "Rules and dates are official. At least one detail, often a rate, is not."], ["p", "Partial", "Some fields checked. Verify before quoting."], ["c", "Candidate", "Looks relevant, barely checked. Never ranked."]].map(([m, h, t]) => <div className="band" key={h}><div style={{ marginBottom: 8 }}><span className={"mark " + m} /></div><div className="mono" style={{ marginBottom: 8 }}>{h}</div><p className="muted" style={{ fontSize: 15 }}>{t}</p></div>)}</div></section>

      <section className="section-tight"><div className="sec-head"><span className="mono">Example</span><span className="mono">Run the real matcher</span></div><WorkedExample /></section>

      <section className="section-tight"><div className="sec-head"><span className="mono">Themes</span><span className="mono">{Object.keys(cfg.CONCEPTS).length} topics the matcher looks for</span></div>
        <ul className="themes">{Object.entries(THEMES).map(([k, [n, ex]]) => <li key={k}><b>{n}</b><span className="muted">{ex}</span></li>)}</ul>
        <p style={{ marginTop: 32 }}><Link className="link-u" href="/screen">Screen a company</Link></p></section>
    </div>
  );
}
