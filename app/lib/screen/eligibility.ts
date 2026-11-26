// Three-valued eligibility checks: pass, fail, or unknown. Unknown is never treated as a pass or a fail, and says what would settle it.
import { canonRegions, countryOk, rowText } from "../matcher";
import type { Profile, Scheme } from "../types";
import { fmtDate, plain } from "../ui";
import type { Project } from "./types";

export type Verdict = "pass" | "fail" | "unknown";
export interface Check { id: "country" | "region" | "size" | "timing" | "start" | "partners"; label: string; verdict: Verdict; detail: string; settle?: string; }
const FIRST = /^\s*yes\b/i, EARLY = /early start|permission|apply before|mandatory .*consultation/i, CLOCK = /order date|within \d+ months|three months|3 months|months? (?:of|after|from)/i;
const nice = (s: Iterable<string>) => [...s].join(", ");

export function checksFor(p: Profile, project: Project, r: Scheme): Check[] {
  const out: Check[] = [];
  out.push(countryOk(p.country, r) ? { id: "country", label: "Country", verdict: "pass", detail: `Open to companies in ${p.country === "OTHER" ? "the EU" : p.country} (${r.country})` } : { id: "country", label: "Country", verdict: "fail", detail: `For ${r.country}; the company is in ${p.country}` });
  if (r.geo_scope !== "regional") out.push({ id: "region", label: "Region", verdict: "pass", detail: r.geo_scope === "eu" ? "EU-wide" : "Open across the country" });
  else { const rr = canonRegions(rowText(r)), pr = canonRegions(p.region);
    if (!rr.size) out.push({ id: "region", label: "Region", verdict: "unknown", detail: "A regional programme, but the recorded text does not name the region", settle: "Check the region on the programme page" });
    else if (!pr.size) out.push({ id: "region", label: "Region", verdict: "unknown", detail: `For ${nice(rr)}; the company's region is not given`, settle: "Add the company's region" });
    else if ([...pr].some((x) => rr.has(x))) out.push({ id: "region", label: "Region", verdict: "pass", detail: `For ${nice(rr)}; the company is in ${nice(pr)}` });
    else out.push({ id: "region", label: "Region", verdict: "fail", detail: `For ${nice(rr)}; the company is in ${nice(pr)}` }); }
  const es = String(r.eligible_sizes ?? "unknown"), list = es.split(";").filter(Boolean);
  if (es === "any") out.push({ id: "size", label: "Company size", verdict: "pass", detail: "No size limit recorded" });
  else if (es === "unknown" || !list.length) out.push({ id: "size", label: "Company size", verdict: "unknown", detail: "The size rule is not recorded", settle: "Check the size limits on the programme page" });
  else if (!p.size || p.size === "unknown") out.push({ id: "size", label: "Company size", verdict: "unknown", detail: `Open to ${nice(list)} companies; the company's size is not given`, settle: "Add the headcount or size band" });
  else out.push(list.includes(p.size) ? { id: "size", label: "Company size", verdict: "pass", detail: `Open to ${nice(list)}; the company is ${p.size}` } : { id: "size", label: "Company size", verdict: "fail", detail: `For ${nice(list)} companies; this one is ${p.size}` });
  const st = r.status_clean, closes = r.closes_date ? fmtDate(r.closes_date) : "";
  if (st === "open") out.push({ id: "timing", label: "Open now", verdict: "pass", detail: closes ? `Open, closes ${closes}` : "Open now" });
  else if (st === "rolling") out.push({ id: "timing", label: "Open now", verdict: "pass", detail: "Continuous: applications accepted all year" });
  else if (st === "opening_soon") out.push({ id: "timing", label: "Open now", verdict: "unknown", detail: "Opens soon", settle: "Check the opening date" });
  else if (st === "varies" || st === "unknown") out.push({ id: "timing", label: "Open now", verdict: "unknown", detail: "The status varies by call or is not confirmed", settle: "Check the programme page for the current call" });
  else out.push({ id: "timing", label: "Open now", verdict: "fail", detail: `Not open now (${st.replace("_", " ")})` });
  const bs = String(r.before_start ?? ""), first = FIRST.test(bs), early = !first && EARLY.test(bs), clock = !first && !early && CLOCK.test(bs), s = project.started;
  if (first) out.push(s === "yes" ? { id: "start", label: "Apply before starting", verdict: "fail", detail: "Must be applied for before work starts, and the work has started" }
    : s === "no" ? { id: "start", label: "Apply before starting", verdict: "pass", detail: "Must be applied for before ordering or starting; nothing is ordered yet, so this is still possible" }
    : { id: "start", label: "Apply before starting", verdict: "unknown", detail: "Must be applied for before ordering or starting", settle: "Confirm that nothing is ordered or started" });
  else if (early) out.push({ id: "start", label: "Apply before starting", verdict: s === "no" ? "pass" : "unknown", detail: `${plain(bs).slice(0, 140)}`, ...(s === "no" ? {} : { settle: "Confirm whether work has started, and whether permission is needed" }) });
  else if (clock) out.push({ id: "start", label: "Apply before starting", verdict: s === "no" ? "pass" : "unknown", detail: s === "no" ? "A deadline runs from the order date; nothing is ordered, so the clock has not started" : "A deadline runs from the order date", ...(s === "no" ? {} : { settle: "Check the order date against the deadline" }) });
  else if (/^\s*no\b/i.test(bs)) out.push({ id: "start", label: "Apply before starting", verdict: "pass", detail: "No apply-first rule recorded" });
  else out.push({ id: "start", label: "Apply before starting", verdict: "unknown", detail: bs ? plain(bs).slice(0, 140) : "Not recorded", settle: "Check the start rules on the programme page" });
  const cs = String(r.consortium ?? "");
  if (/^yes/i.test(cs)) out.push({ id: "partners", label: "Partners", verdict: "unknown", detail: "Needs partners (a consortium)", settle: "Confirm whether the company has partners" });
  else if (/single/i.test(cs)) out.push({ id: "partners", label: "Partners", verdict: "pass", detail: "A single company can apply" });
  return out;
}
export interface Summary { pass: number; fail: number; unknown: number; headline: "blocked" | "confirm" | "clear"; }
export function summarise(c: Check[]): Summary {
  const n = (v: Verdict) => c.filter((x) => x.verdict === v).length; const s = { pass: n("pass"), fail: n("fail"), unknown: n("unknown") };
  return { ...s, headline: s.fail ? "blocked" : s.unknown ? "confirm" : "clear" };
}
