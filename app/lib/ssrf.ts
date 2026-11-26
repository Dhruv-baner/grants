// Safe outbound HTTP for fetching company websites: public hosts only, checked at connect time (defeats DNS rebinding),
// redirects re-validated, size/time/type caps, no credentials, ports 80/443 only.
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

export class UnsafeUrl extends Error {}

export function isPublicIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || b === 0)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === "::" || l === "::1") return false;
    const dotted = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); if (dotted) return isPublicIp(dotted[1]);
    const hex = l.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) { const n = (parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16); return isPublicIp([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".")); }
    if (/^f[cd]/.test(l) || /^fe[89ab]/.test(l) || l.startsWith("ff") || l.startsWith("2001:db8")) return false;
    return true;
  }
  return false;
}

export function validateUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new UnsafeUrl("not a valid URL"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new UnsafeUrl("only http and https are allowed");
  if (u.username || u.password) throw new UnsafeUrl("credentials in URL are not allowed");
  if (u.port && u.port !== "80" && u.port !== "443") throw new UnsafeUrl("port not allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new UnsafeUrl("host not allowed");
  if (net.isIP(host) && !isPublicIp(host)) throw new UnsafeUrl("non-public address");
  return u;
}

type Lookup = NonNullable<http.RequestOptions["lookup"]>;
export const safeLookup: Lookup = (hostname, options, cb) => {
  dns.lookup(hostname, { ...(options as object), all: true }, (err, addrs) => {
    if (err) return (cb as any)(err);
    const list = addrs as unknown as dns.LookupAddress[];
    for (const a of list) if (!isPublicIp(a.address)) return (cb as any)(new UnsafeUrl(`non-public address ${a.address}`));
    if ((options as any)?.all) (cb as any)(null, list); else (cb as any)(null, list[0].address, list[0].family);
  });
};

export interface GetOpts { allowPrivateForTests?: boolean; maxBytes?: number; timeoutMs?: number; maxRedirects?: number; }
export const UA = "GrantsAndFundingBot/0.1 (funding screening tool; respects robots.txt)";

export function httpGet(raw: string, o: GetOpts = {}): Promise<{ text: string; finalUrl: string }> {
  const { maxBytes = 1_500_000, timeoutMs = 10_000, maxRedirects = 3 } = o;
  const step = (url: string, left: number): Promise<{ text: string; finalUrl: string }> => new Promise((resolve, reject) => {
    let u: URL;
    try { u = o.allowPrivateForTests ? new URL(url) : validateUrl(url); } catch (e) { return reject(e); }
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(u, { method: "GET", headers: { "User-Agent": UA, "Accept": "text/html,text/plain;q=0.9", "Accept-Encoding": "identity" },
      timeout: timeoutMs, lookup: o.allowPrivateForTests ? undefined : safeLookup }, (res) => {
      const code = res.statusCode ?? 0;
      if (code >= 300 && code < 400 && res.headers.location) {
        res.resume(); if (left <= 0) return reject(new Error("too many redirects"));
        return step(new URL(res.headers.location, u).toString(), left - 1).then(resolve, reject);
      }
      if (code >= 400) { res.resume(); return reject(new Error(`HTTP ${code}`)); }
      const ct = String(res.headers["content-type"] ?? "");
      if (ct && !/text\/|xml|json/i.test(ct)) { res.resume(); return reject(new Error(`unsupported content type ${ct.slice(0, 40)}`)); }
      const chunks: Buffer[] = []; let n = 0;
      res.on("data", (c: Buffer) => { n += c.length; if (n > maxBytes) { chunks.push(c.subarray(0, c.length - (n - maxBytes))); res.destroy(); } else chunks.push(c); });
      res.on("close", () => resolve({ text: Buffer.concat(chunks).toString("utf-8"), finalUrl: u.toString() }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject); req.end();
  });
  return step(raw, maxRedirects);
}
