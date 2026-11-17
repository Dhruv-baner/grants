// Best-effort in-memory limits. They reset on cold start and are not shared across serverless instances, so they are a
// courtesy guard, not a hard cap: also set a spend limit in the Anthropic console.
export interface LimitConfig { perIpPerHour: number; dailyCalls: number; dailyTokens: number; }
export class Limiter {
  private ip = new Map<string, number[]>(); private day = ""; private calls = 0; private tokens = 0;
  constructor(private cfg: LimitConfig, private now: () => number = Date.now) {}
  private roll() { const d = new Date(this.now()).toISOString().slice(0, 10); if (d !== this.day) { this.day = d; this.calls = 0; this.tokens = 0; } }
  check(ip: string): { ok: true } | { ok: false; reason: string } {
    this.roll();
    if (this.calls >= this.cfg.dailyCalls) return { ok: false, reason: "Daily live-call limit reached for this demo." };
    if (this.tokens >= this.cfg.dailyTokens) return { ok: false, reason: "Daily token budget reached for this demo." };
    const cutoff = this.now() - 3_600_000; const hits = (this.ip.get(ip) ?? []).filter((t) => t > cutoff);
    if (hits.length >= this.cfg.perIpPerHour) return { ok: false, reason: "Too many live requests from this address; try again later." };
    hits.push(this.now()); this.ip.set(ip, hits); this.calls++; return { ok: true };
  }
  addTokens(n: number) { this.roll(); this.tokens += n; }
  snapshot() { this.roll(); return { calls: this.calls, tokens: this.tokens, ...this.cfg }; }
}
