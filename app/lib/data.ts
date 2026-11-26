import raw from "../data/schemes.json";
import demoRaw from "../data/demo_companies.json";
import realRaw from "../data/real_companies.json";
import type { Profile, Scheme } from "./types";
export const SCHEMES = raw.schemes as unknown as Scheme[];
export const META = raw.meta as { as_of: string; version: string; rows: number; scheme_rows: number; call_rows: number };
export const BY_ID: Record<string, Scheme> = Object.fromEntries(SCHEMES.map((s) => [s.id, s]));
export interface DemoCompany extends Profile { id: string; name: string; description: string; }
export const DEMOS = demoRaw.companies as unknown as DemoCompany[];
export const TODAY = new Date(META.as_of + "T00:00:00Z");
export interface RealCompany extends Profile { id: string; name: string; summary: string; description: string; sources: { label: string; url: string }[]; }
/** Real companies offered on the Screen page, profiled from public reports and websites. */
export const REAL = realRaw.companies as unknown as RealCompany[];
export const REAL_META = realRaw.meta as { as_of: string; note: string };
