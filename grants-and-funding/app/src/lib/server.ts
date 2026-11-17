import { AnthropicLlm } from "./llm";
import { Limiter } from "./limits";
import type { Deps } from "./live";
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
let deps: Deps | null = null;
export function defaultDeps(): Deps {
  if (!deps) {
    const key = process.env.ANTHROPIC_API_KEY;
    deps = { llm: key ? new AnthropicLlm(key) : undefined, accessCode: process.env.GS_ACCESS_CODE || undefined,
      limiter: new Limiter({ perIpPerHour: num(process.env.GS_RATE_PER_IP_HOUR, 8), dailyCalls: num(process.env.GS_DAILY_CALLS, 150), dailyTokens: num(process.env.GS_DAILY_TOKENS, 400_000) }) };
  }
  return deps;
}
