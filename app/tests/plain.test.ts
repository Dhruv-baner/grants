import { describe, expect, it } from "vitest";
import { SCHEMES } from "@/lib/data";
import { plain } from "@/lib/ui";

describe("programme detail text", () => {
  it("drops notes about how a fact was sourced and keeps the information", () => {
    expect(plain("Flat rate EUR 29 (2026) rising to EUR 33 (2027) [secondary].")).toBe("Flat rate EUR 29 (2026) rising to EUR 33 (2027).");
    expect(plain("Yes, application must precede the work (secondary)")).toBe("Yes, application must precede the work");
    expect(plain("Rate is 40% (2026, law-firm summary) and rises later")).toBe("Rate is 40% (2026) and rises later");
    expect(plain("Needed (mandatory for installations under 1 MWp, secondary)")).toBe("Needed (mandatory for installations under 1 MWp)");
    expect(plain("Open until June (adviser source: 16 Sep)")).toBe("Open until June (16 Sep)");
    expect(plain("Period (adviser sources say 2024 to 2030)")).toBe("Period (2024 to 2030)");
    expect(plain("Loan up to EUR 250,000 (consultancy summary); 6.9% a year (comparison site)")).toBe("Loan up to EUR 250,000; 6.9% a year");
  });
  it("keeps ordinary brackets, numbers and dates", () => {
    const t = "2026: 40% of the investment (statute and Energielijst 2026). Minimum EUR 2,500 per asset (per application).";
    expect(plain(t)).toBe(t);
  });
  it("leaves no source-quality tags in brackets in any programme's displayed fields", () => {
    const fields = ["summary", "status", "applicants", "funding_rate", "caps", "budget", "window", "before_start", "assessment", "rejection_risks"];
    const tag = /[(\[][^()\[\]]*\b(?:secondary|aggregator|consultancy|law-?firm|trade press|adviser sources?)\b[^()\[\]]*[)\]]/i; const bad: string[] = [];
    for (const r of SCHEMES) for (const f of fields) { const v = plain(String(r[f] ?? "")); const m = v.match(tag); if (m) bad.push(`${r.id}.${f}: ${m[0]}`); }
    expect(bad).toEqual([]);
  });
  it("turns tag-led notes into plain information", () => {
    expect(plain("Subsidy (trade press: EUR 0.55 per kWh of yearly yield)")).toBe("Subsidy (EUR 0.55 per kWh of yearly yield)");
    expect(plain("Budget (development about EUR 676M per a consultancy summary)")).toBe("Budget (development about EUR 676M)");
    expect(plain("Dates (adviser sources list 11 Feb and 6 May 2026)")).toBe("Dates (11 Feb and 6 May 2026)");
  });
  it("never shows research notes about a company's own listing", () => { for (const r of SCHEMES) for (const f of ["summary", "applicants", "assessment", "rejection_risks"]) expect(plain(String(r[f] ?? ""))).not.toMatch(/ignite/i); });
});
