import type { Brief } from "@/lib/explainer";
import { formatEur } from "@/lib/notes/numbers";
import type { CalcOut } from "@/lib/screen/calculators";
import { summarise, type Check } from "@/lib/screen/eligibility";
import type { Plan } from "@/lib/screen/stack";
import type { TItem } from "@/lib/screen/timeline";
import type { Project } from "@/lib/screen/types";
import type { Profile } from "@/lib/types";
import { clean, fmtDate } from "@/lib/ui";

const COUNTRY: Record<string, string> = { NL: "Netherlands", DE: "Germany", EU: "EU-wide", OTHER: "Outside NL, DE and the EU" };
export interface ReportProps { brief: Brief; profile: Profile; project: Project; checks: Record<string, Check[]>; estimates: Record<string, CalcOut>; plan: Plan; timeline: TItem[]; names: Record<string, string>; today: string; }
/** A client-ready summary, laid out for A4. Shown as a preview in its tab and the only thing printed from there. */
export default function ClientReport({ brief, profile, project, checks, estimates, plan, timeline, names, today }: ReportProps) {
  const top = brief.matches.slice(0, 8); const ests = top.map((m) => estimates[m.scheme_id]).filter(Boolean);
  const confirm = [...new Set(top.flatMap((m) => (checks[m.scheme_id] ?? []).filter((c) => c.verdict === "unknown" && c.settle).map((c) => c.settle!)))];
  const started = project.started === "yes" ? "Already ordered or started" : project.started === "no" ? "Nothing ordered yet" : "Not known";
  return (
    <article className="client-report" aria-label="Client brief">
      <header className="cr-head"><p className="mono">Grants &amp; Funding · Funding screening</p><h2>{profile.name || "Company"}</h2><p className="cr-sub">Prepared {today}. Programme data as of {fmtDate(brief.data_as_of)}.</p></header>
      <section className="cr-sec"><h3>The company and the project</h3>
        <dl className="cr-dl"><dt>Country</dt><dd>{COUNTRY[profile.country] ?? profile.country}{profile.region ? `, ${profile.region}` : ""}</dd><dt>Size</dt><dd>{profile.size ?? "unknown"}</dd><dt>Sectors</dt><dd>{profile.sectors?.length ? profile.sectors.join("; ") : "Not given"}</dd><dt>What it does</dt><dd>{profile.description || "Not given"}</dd>
          <dt>Project budget</dt><dd>{project.budget ? formatEur(project.budget) : "Not given"}</dd><dt>Planned start</dt><dd>{project.start ? fmtDate(project.start) : "Not given"}</dd><dt>Ordered or started</dt><dd>{started}</dd></dl></section>
      <section className="cr-sec"><h3>Programmes that fit</h3>
        {top.length === 0 ? <p>No open programme passed the filters for this profile.</p> : top.map((m, i) => { const c = checks[m.scheme_id], s = c ? summarise(c) : null, e = estimates[m.scheme_id];
          return (
            <div className="cr-match" key={m.scheme_id}>
              <h4><span>{i + 1}. {m.name}</span></h4>
              <p className="cr-meta mono">{m.type_group}{m.next_deadline ? ` · closes ${fmtDate(m.next_deadline)}` : ""}</p>
              <p>{m.why_it_fits}</p>
              {s && <p className="cr-chk"><b>Checks:</b> {s.pass} clear, {s.unknown} to confirm, {s.fail} blocked.{c!.filter((x) => x.verdict !== "pass").map((x) => ` ${x.label}: ${x.detail}.`).join("")}</p>}
              {e && <p className="cr-est"><b>Estimate:</b> {e.headline}. {e.warnings.join(" ")}</p>}
              {Object.entries(m.key_terms).filter(([k, v]) => v && (k === "funding_rate" || k === "caps")).map(([k, v]) => <p className="cr-term" key={k}><b>{k.replace("_", " ")}:</b> {clean(v)}</p>)}
            </div>); })}</section>
      {ests.length > 0 && <section className="cr-sec"><h3>Estimated support</h3><p>Estimates from the recorded rates, for discussion. They are not an offer or a decision, and programmes covering the same costs cannot always be added together.</p><ul>{top.filter((m) => estimates[m.scheme_id]).map((m) => <li key={m.scheme_id}><b>{m.name}:</b> {estimates[m.scheme_id].headline}</li>)}</ul></section>}
      {plan.order.length > 0 && <section className="cr-sec"><h3>How to combine them, and in what order</h3><ol>{plan.order.map((s) => <li key={s.id}><b>{s.name}.</b> {s.why}</li>)}</ol>{plan.conflicts.map((c) => <p key={c.a + c.b}><b>{names[c.a]} and {names[c.b]}:</b> {c.rule.note} ({c.rule.source.label})</p>)}{plan.notes.map((n) => <p key={n} className="cr-note">{n}</p>)}</section>}
      {timeline.length > 0 && <section className="cr-sec"><h3>Dates that matter</h3><ul>{timeline.filter((t) => t.urgency !== "passed").map((t) => <li key={t.id + t.kind}><b>{fmtDate(t.date)}.</b> {t.name}: {t.note}.</li>)}</ul></section>}
      {confirm.length > 0 && <section className="cr-sec"><h3>To confirm next</h3><ul>{confirm.map((c) => <li key={c}>{c}</li>)}</ul></section>}
      <section className="cr-sec cr-src"><h3>Sources</h3><ul>{top.map((m) => <li key={m.scheme_id}><b>{m.name}:</b> {m.sources.slice(0, 2).map((s) => s.url).join(" · ")}</li>)}</ul></section>
      <footer className="cr-foot">This screening uses fixed rules and the programme data recorded on {fmtDate(brief.data_as_of)}. It shows which programmes look worth a closer look. It is not advice, and it does not say that the company is eligible for any programme: each one's own conditions decide that.</footer>
    </article>
  );
}
