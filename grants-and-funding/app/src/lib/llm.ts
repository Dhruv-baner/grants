import Anthropic from "@anthropic-ai/sdk";
export interface LlmResult { text: string; inputTokens: number; outputTokens: number; }
export interface Llm { complete(a: { system: string; user: string; task: "profile" | "brief"; maxTokens: number }): Promise<LlmResult>; }
export class LlmError extends Error { constructor(msg: string, public status = 502) { super(msg); } }
export const MODELS = { profile: process.env.GS_MODEL_PROFILE || "claude-haiku-5-5", brief: process.env.GS_MODEL_BRIEF || "claude-sonnet-5-5" };

export class AnthropicLlm implements Llm {
  private client: Anthropic;
  constructor(apiKey: string) { this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 }); }
  async complete({ system, user, task, maxTokens }: Parameters<Llm["complete"]>[0]): Promise<LlmResult> {
    const base = { model: MODELS[task], max_tokens: maxTokens, system, messages: [{ role: "user" as const, content: user }] };
    try {
      const resp = await this.client.messages.create(base);
      const text = resp.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");
      return { text, inputTokens: resp.usage?.input_tokens ?? 0, outputTokens: resp.usage?.output_tokens ?? 0 };
    } catch (e: any) {
      const s = Number(e?.status) || 502;
      throw new LlmError(s === 401 || s === 403 ? "The AI provider rejected the server's credentials." : s === 429 ? "The AI provider is rate limiting; try again shortly." : s === 400 ? "The AI provider rejected the request (check model settings)." : "The AI provider is unavailable.", s === 429 ? 429 : 502);
    }
  }
}
