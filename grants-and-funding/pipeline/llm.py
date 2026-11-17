"""Thin Claude wrapper: model choice per task, per-run token budget, disk cache, optional cost estimate.
The API key is read from ANTHROPIC_API_KEY and is never logged or stored."""
import hashlib, json, os, pathlib, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODELS = {"profile": os.getenv("GS_MODEL_PROFILE", "claude-haiku-5-5"), "brief": os.getenv("GS_MODEL_BRIEF", "claude-sonnet-5-5")}

class BudgetExceeded(RuntimeError): pass
class NoApiKey(RuntimeError): pass

class Budget:
    def __init__(self, max_input=40000, max_output=6000):
        self.max_input, self.max_output, self.used_in, self.used_out, self.calls = max_input, max_output, 0, 0, 0
    def check(self, est_in, est_out):
        if self.used_in + est_in > self.max_input or self.used_out + est_out > self.max_output:
            raise BudgetExceeded(f"run budget would be exceeded (in {self.used_in}+{est_in}/{self.max_input}, out {self.used_out}+{est_out}/{self.max_output})")
    def record(self, usage):
        self.used_in += getattr(usage, "input_tokens", 0) or 0; self.used_out += getattr(usage, "output_tokens", 0) or 0; self.calls += 1

class LLM:
    def __init__(self, client=None, budget=None, cache_dir=ROOT / ".cache" / "llm", use_cache=True, models=None):
        self._client, self.budget, self.use_cache = client, budget or Budget(), use_cache
        self.cache_dir, self.models, self.cache_hits, self.usage = pathlib.Path(cache_dir), models or MODELS, 0, {}
    def client(self):
        if self._client is None:
            if not os.getenv("ANTHROPIC_API_KEY"): raise NoApiKey("ANTHROPIC_API_KEY is not set; run in demo mode or set the key")
            import anthropic; self._client = anthropic.Anthropic(max_retries=2, timeout=60)
        return self._client
    def complete(self, system, user, task="profile", max_tokens=700):
        model = self.models[task]
        key = hashlib.sha256(json.dumps([model, system, user, max_tokens]).encode()).hexdigest()[:32]
        cf = self.cache_dir / f"{key}.txt"
        if self.use_cache and cf.exists(): self.cache_hits += 1; return cf.read_text()
        self.budget.check(int((len(system) + len(user)) / 3), max_tokens)
        resp = self.client().messages.create(model=model, max_tokens=max_tokens, system=system, messages=[{"role": "user", "content": user}])
        self.budget.record(resp.usage)
        u = self.usage.setdefault(model, [0, 0]); u[0] += getattr(resp.usage, 'input_tokens', 0) or 0; u[1] += getattr(resp.usage, 'output_tokens', 0) or 0
        text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
        if self.use_cache:
            self.cache_dir.mkdir(parents=True, exist_ok=True); cf.write_text(text)
        return text
    def cost_usd(self):
        """Estimated cost, or None if prices are not filled in pipeline/pricing.json."""
        prices = json.load(open(ROOT / "pipeline" / "pricing.json")); total = 0.0
        for model, (tin, tout) in self.usage.items():
            p = prices.get(model, {})
            if p.get("input_per_mtok_usd") is None or p.get("output_per_mtok_usd") is None: return None
            total += tin / 1e6 * p["input_per_mtok_usd"] + tout / 1e6 * p["output_per_mtok_usd"]
        return round(total, 6)
