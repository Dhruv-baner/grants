import type { Scheme } from "../types";
import { daysBetween, fmtDate } from "../ui";
import type { Project } from "./types";

export interface TItem { id: string; name: string; date: string; kind: "closes" | "opens" | "window-ends"; note: string; urgency: "passed" | "now" | "soon" | "later"; beforeStart?: boolean; url: string; }
/** Dates that matter, soonest first, set against the planned start. Programmes with no fixed date are listed separately. */
export function buildTimeline(ids: string[], by: Record<string, Scheme>, project: Project, asOf: string): { items: TItem[]; rolling: { id: string; name: string }[] } {
  const items: TItem[] = [], rolling: { id: string; name: string }[] = [];
  for (const id of ids) { const r = by[id]; if (!r) continue;
    const opens = String(r.opens_on ?? ""); if (opens && opens > asOf) items.push({ id, name: r.name, date: opens, kind: "opens", note: "Opens", urgency: "later", url: r.official_url });
    if (r.closes_date) { const n = daysBetween(asOf, r.closes_date); const urgency = n < 0 ? "passed" : n <= 14 ? "now" : n <= 45 ? "soon" : "later";
      const before = !!project.start && r.closes_date < project.start;
      items.push({ id, name: r.name, date: r.closes_date, kind: "closes", urgency, beforeStart: before, url: r.official_url,
        note: n < 0 ? `Closed ${fmtDate(r.closes_date)}` : `Closes ${fmtDate(r.closes_date)} (${n} ${n === 1 ? "day" : "days"})${before ? ", before the planned start: apply early or look for the next round" : project.start ? ", before the planned start is fine if you apply first" : ""}` }); }
    else if (r.status_clean === "rolling") rolling.push({ id, name: r.name }); }
  return { items: items.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)), rolling };
}
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/** RFC 5545 lines must be at most 75 octets: longer ones are folded onto continuation lines. */
function fold(line: string): string { const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line; const out: string[] = []; let cur = ""; for (const ch of line) { if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch; } out.push(cur); return out.join("\r\n "); }
const ymd = (d: string) => d.replace(/-/g, ""); const nextDay = (d: string) => new Date(Date.parse(d + "T00:00:00Z") + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
/** An iCalendar file with one all-day event per date, ready for Outlook or Google Calendar. */
export function toIcs(items: TItem[], company: string, stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Grants & Funding//Screen//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const it of items.filter((x) => x.urgency !== "passed")) lines.push("BEGIN:VEVENT", `UID:${it.id}-${it.kind}-${ymd(it.date)}@grants-and-funding`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(it.date)}`, `DTEND;VALUE=DATE:${nextDay(it.date)}`,
    `SUMMARY:${esc(`${it.name}: ${it.kind === "opens" ? "opens" : "closes"}${company ? ` (${company})` : ""}`)}`, `DESCRIPTION:${esc(`${it.note}. Check the official page before relying on this date: ${it.url}`)}`, "END:VEVENT");
  lines.push("END:VCALENDAR"); return lines.map(fold).join("\r\n") + "\r\n";
}
