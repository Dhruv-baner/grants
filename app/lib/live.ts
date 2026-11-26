// Request handlers for live mode, with injected dependencies so they can be tested without network or API key.
import { timingSafeEqual } from "node:crypto";
import { BY_ID, SCHEMES } from "./data";
import type { Llm } from "./llm";
import { LlmError } from "./llm";
import { Limiter } from "./limits";
import { match } from "./matcher";
import { DocumentError, extractDocumentText, MAX_DOC_BYTES } from "./document";
import { buildProfile } from "./profiler";
import { llmProse } from "./prose";
import { fetchCompany, type Site } from "./site";
import { UnsafeUrl } from "./ssrf";
import { askAbout } from "./assistant/followup";
import { enhanceNotes } from "./notes/enhance";
import { inScope } from "./assistant/knowledge";
import { routeQuestion } from "./assistant/router";
import type { Profile } from "./types";

export interface Deps { llm?: Llm; fetchSite?: (url: string) => Promise<Site>; limiter: Limiter; accessCode?: string; cacheNow?: () => number; }
const MAX_BODY = 20_000;
const cache = new Map<string, { at: number; value: unknown }>();
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const ipOf = (req: Request) => (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

async function guard(req: Request, d: Deps): Promise<{ body: any } | Response> {
  if (!d.llm) return json({ error: "Live mode is not configured on this server." }, 503);
  if (d.accessCode && !same(req.headers.get("x-access-code") ?? "", d.accessCode)) return json({ error: "Access code required or incorrect." }, 401);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return json({ error: "Request too large." }, 413);
  let text = ""; try { text = await req.text(); } catch { return json({ error: "Could not read the request." }, 400); }
  if (text.length > MAX_BODY) return json({ error: "Request too large." }, 413);
  let body: any; try { body = JSON.parse(text); } catch { return json({ error: "Body must be JSON." }, 400); }
  const lim = d.limiter.check(ipOf(req)); if (!lim.ok) return json({ error: lim.reason }, 429);
  return { body };
}
export function handleStatus(d: Deps) { return json({ live: !!d.llm, needsCode: !!d.accessCode, limits: d.limiter.snapshot() }); }

export async function handleProfile(req: Request, d: Deps) {
  const g = await guard(req, d); if (g instanceof Response) return g;
  const url = String(g.body?.url ?? "").trim(); if (!url || url.length > 300) return json({ error: "Provide a company website URL." }, 400);
  const key = url.toLowerCase(); const hit = cache.get(key); const now = (d.cacheNow ?? Date.now)();
  if (hit && now - hit.at < 3_600_000) return json({ ...(hit.value as object), cached: true });
  try {
    const site = await (d.fetchSite ?? ((u: string) => fetchCompany(u)))(url);
    const { profile, fields, usage } = await buildProfile(site, d.llm!);
    d.limiter.addTokens(usage.in + usage.out);
    const value = { profile, fields, pages: site.pages, usage };
    cache.set(key, { at: now, value }); if (cache.size > 200) cache.delete(cache.keys().next().value!);
    return json(value);
  } catch (e: any) {
    if (e instanceof UnsafeUrl) return json({ error: `That URL cannot be fetched: ${e.message}.` }, 400);
    if (e instanceof LlmError) return json({ error: e.message }, e.status);
    if (/robots/i.test(String(e?.message))) return json({ error: "The site's robots.txt does not allow automated reading. Enter the profile by hand." }, 422);
    return json({ error: "Could not read that website. Enter the profile by hand." }, 422);
  }
}
export async function handleProse(req: Request, d: Deps) {
  const g = await guard(req, d); if (g instanceof Response) return g;
  const p = g.body?.profile; if (!p || !["NL", "DE", "EU", "OTHER"].includes(p.country)) return json({ error: "Provide a profile with a country." }, 400);
  const profile: Profile = { name: String(p.name ?? "").slice(0, 120), country: p.country, region: String(p.region ?? "").slice(0, 60),
    size: ["micro", "small", "medium", "large"].includes(p.size) ? p.size : "unknown", sectors: (Array.isArray(p.sectors) ? p.sectors : []).filter((s: unknown) => typeof s === "string").slice(0, 3),
    signals: (Array.isArray(p.signals) ? p.signals : []).filter((s: unknown) => typeof s === "string").map((s: string) => s.slice(0, 80)).slice(0, 8),
    description: String(p.description ?? p.activities ?? "").slice(0, 400), activities: String(p.activities ?? p.description ?? "").slice(0, 400) };
  const matches = match(profile, SCHEMES).matches;            // recomputed on the server: the client's match list is never trusted
  if (!matches.length) return json({ prose: {}, notes: ["No matches to describe."], usage: { in: 0, out: 0 } });
  try { const r = await llmProse(profile, matches, BY_ID, d.llm!); d.limiter.addTokens(r.usage.in + r.usage.out); return json(r); }
  catch (e: any) { if (e instanceof LlmError) return json({ error: e.message }, e.status); return json({ error: "Could not generate text." }, 502); }
}

export async function handleAsk(req: Request, d: Deps) {
  const g = await guard(req, d); if (g instanceof Response) return g;
  const id = String(g.body?.programme_id ?? ""); const q = String(g.body?.question ?? "").trim().slice(0, 300);
  if (!inScope(id)) return json({ error: "That programme is not covered yet." }, 400);
  if (q.length < 3) return json({ error: "Ask a question about the programme." }, 400);
  try { const r = await askAbout(id, q, d.llm!); d.limiter.addTokens(r.usage.in + r.usage.out); return json(r); }
  catch (e: any) { if (e instanceof LlmError) return json({ error: e.message }, e.status); return json({ error: "Could not answer that." }, 502); }
}

export async function handleNotes(req: Request, d: Deps) {
  const g = await guard(req, d); if (g instanceof Response) return g;
  const transcript = String(g.body?.transcript ?? "").slice(0, 30000); const jottings = String(g.body?.jottings ?? "").slice(0, 3000);
  if (transcript.trim().length < 20) return json({ error: "The transcript is too short to enhance." }, 400);
  try { const r = await enhanceNotes(transcript, d.llm!, jottings); d.limiter.addTokens(r.usage.in + r.usage.out); return json(r); }
  catch (e: any) { if (e instanceof LlmError) return json({ error: e.message }, e.status); return json({ error: "Could not enhance the notes." }, 502); }
}

/** A company profile read from an uploaded PDF, Word or text file. */
export async function handleDocument(req: Request, d: Deps) {
  if (!d.llm) return json({ error: "Live mode is not configured on this server." }, 503);
  if (d.accessCode && !same(req.headers.get("x-access-code") ?? "", d.accessCode)) return json({ error: "Access code required or incorrect." }, 401);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_DOC_BYTES + 300_000) return json({ error: "That file is too large (4 MB at most)." }, 413);
  const lim = d.limiter.check(ipOf(req)); if (!lim.ok) return json({ error: lim.reason }, 429);
  let form: FormData; try { form = await req.formData(); } catch { return json({ error: "Upload the file as a form." }, 400); }
  const f = form.get("file"); if (!(f instanceof File)) return json({ error: "Choose a file to read." }, 400); if (f.size > MAX_DOC_BYTES) return json({ error: "That file is too large (4 MB at most)." }, 413);
  const name = f.name.replace(/[^\w .()-]/g, "").slice(0, 80) || "document";
  try {
    const { text, kind } = await extractDocumentText(f.name, new Uint8Array(await f.arrayBuffer())); const { profile, fields, usage } = await buildProfile({ url: "", pages: [name], text }, d.llm);
    d.limiter.addTokens(usage.in + usage.out); return json({ profile, fields, pages: [name], kind, chars: text.length, usage });
  } catch (e: any) { if (e instanceof DocumentError) return json({ error: e.message }, e.status); if (e instanceof LlmError) return json({ error: e.message }, e.status); return json({ error: "Could not read that file." }, 422); }
}

/** Works out how a question the rules could not place should be answered. The model only chooses; the answer is built from the data. */
export async function handleIntent(req: Request, d: Deps) {
  const g = await guard(req, d); if (g instanceof Response) return g;
  const question = String(g.body?.question ?? "").trim().slice(0, 600); if (question.length < 3) return json({ error: "Ask a question." }, 400);
  try { const r = await routeQuestion(question, g.body?.hasCompany === true, d.llm!); d.limiter.addTokens(r.usage.in + r.usage.out); return json({ intent: r.route.intent, canonical: r.canonical, usage: r.usage }); }
  catch (e: any) { if (e instanceof LlmError) return json({ error: e.message }, e.status); return json({ error: "Could not work out that question." }, 502); }
}
