import docsRaw from "../../data/documents.json";
import { BY_ID, META, SCHEMES } from "../data";
import type { Scheme } from "../types";
import { AMBIGUOUS, CONFIG, PARTIAL_PARENT } from "./config";
import { norm } from "./text";

export type Req = "required" | "conditional" | "after approval" | "optional";
export interface DocItem { item: string; required: Req; note: string; source_url: string; }
export interface SourceRef { label: string; url: string; tier: string; }
export interface Checklist { status: "recorded" | "partly recorded" | "not publicly listed"; channel: string; documents: DocItem[]; notes: string; sources: SourceRef[]; confidence: string; checked: string; }
export const CHECKLISTS = docsRaw.schemes as unknown as Record<string, Checklist>;
export const DOCS_AS_OF: string = docsRaw.meta.as_of;
export const DATA_AS_OF: string = META.as_of;
/** The assistant answers only about programmes whose checklist is fully recorded. */
export const IN_SCOPE: string[] = Object.keys(CHECKLISTS).filter((id) => CHECKLISTS[id].status === "recorded" && BY_ID[id]);
export const inScope = (id: string) => IN_SCOPE.includes(id);
export const labelOf = (id: string) => CONFIG[id]?.label ?? BY_ID[id]?.name ?? id;
export const IN_SCOPE_ROWS: Scheme[] = IN_SCOPE.map((id) => BY_ID[id]);

export interface AliasEntry { key: string; alias: string; kind: "in" | "out" | "ambiguous" | "partial"; }
// Real words (or other things people type) that are also programme acronyms: never treated as a programme name.
const DENY = new Set(["life", "via", "slim", "exist", "oost", "noord", "sig", "kis", "rif", "brf", "edf", "ckp", "cef e", "514", "bafa", "europe", "digital", "profit", "leader", "factoring", "000 net", "north sea"]);
const STOP = new Set(["scheme", "call", "fund", "grant", "loan", "programme", "program", "energy", "innovation", "research", "state aid", "subsidy", "funding", "guarantee", "credit", "support", "cooperation", "projects"]);
function derive(s: Scheme): string[] {
  const out = new Set<string>(); const base = s.name.replace(/\s*\([^)]*\)/g, "").trim();
  if (base.length >= 5 || /^[A-Z][A-Za-z0-9+]{2,6}$/.test(base)) out.add(base);
  for (const m of s.name.matchAll(/\(([^)]+)\)/g)) for (const x of m[1].split(/[;/,]| or /)) { const t = x.trim(); if (t.length >= 3 && t.length <= 60) out.add(t); }
  for (const a of (s.aliases || "").split(";")) { const t = a.trim(); if (t.length >= 4 && t.length <= 50) out.add(t); }
  if (s.id.length >= 3 && !s.id.includes("_")) out.add(s.id);
  return [...out];
}
function build(): AliasEntry[] {
  const out: AliasEntry[] = [];
  for (const id of IN_SCOPE) for (const a of CONFIG[id]?.aliases ?? []) out.push({ key: id, alias: norm(a), kind: "in" });
  for (const [a, v] of Object.entries(AMBIGUOUS)) out.push({ key: a, alias: norm(a), kind: "ambiguous" });
  for (const a of Object.keys(PARTIAL_PARENT)) out.push({ key: a, alias: norm(a), kind: "partial" });
  const taken = new Set(out.map((e) => e.alias));
  for (const s of SCHEMES) {
    if (inScope(s.id)) continue;
    for (const a of derive(s)) { const n = norm(a); if (n.length >= 3 && !STOP.has(n) && !DENY.has(n) && !/^\d+$/.test(n) && !taken.has(n)) out.push({ key: s.id, alias: n, kind: "out" }); }
  }
  return out;
}
export const ALIASES: AliasEntry[] = build();
export const ALIAS_LIST = ALIASES.map((e) => ({ key: e.key, alias: e.alias }));
export const KIND_OF = new Map(ALIASES.map((e) => [e.key + "|" + e.alias, e.kind]));
