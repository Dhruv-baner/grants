"""Grants and Funding command line.
  python pipeline/cli.py list-demos
  python pipeline/cli.py brief --demo nl-software-sme            (offline, no API key)
  python pipeline/cli.py brief --profile examples/profile.example.json
  python pipeline/cli.py brief --url https://example.nl --llm-prose --out out/   (needs ANTHROPIC_API_KEY)"""
import argparse, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import matcher, explainer

ROOT = pathlib.Path(__file__).resolve().parent.parent

def demo_profile(name):
    comps = json.load(open(ROOT / "examples" / "demo_companies.json"))["companies"]
    for c in comps:
        if c["id"] == name: return c
    raise SystemExit(f"unknown demo '{name}'. Options: " + ", ".join(c["id"] for c in comps))

def make_brief(profile, llm=None, rows=None):
    rows = rows or matcher.load_rows()
    res = matcher.match(profile, rows)
    return explainer.build_brief(profile, res, {r["id"]: r for r in rows}, llm=llm)

def main(argv=None):
    ap = argparse.ArgumentParser(description="Grants and Funding")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list-demos")
    b = sub.add_parser("brief")
    g = b.add_mutually_exclusive_group(required=True)
    g.add_argument("--demo"); g.add_argument("--profile"); g.add_argument("--url")
    b.add_argument("--llm-prose", action="store_true", help="use Claude for the short prose (needs API key)")
    b.add_argument("--no-cache", action="store_true"); b.add_argument("--out")
    a = ap.parse_args(argv)
    if a.cmd == "list-demos":
        for c in json.load(open(ROOT / "examples" / "demo_companies.json"))["companies"]: print(f"{c['id']:28} {c['description'][:70]}")
        return 0
    llm = None
    if a.url or a.llm_prose:
        import os, llm as llmmod
        if not os.getenv("ANTHROPIC_API_KEY"):
            print("ANTHROPIC_API_KEY is not set. Use --demo or --profile for offline mode, or set the key.", file=sys.stderr); return 2
        llm = llmmod.LLM(use_cache=not a.no_cache)
    if a.demo: profile = demo_profile(a.demo)
    elif a.profile: profile = json.load(open(a.profile))
    else:
        import fetch, profiler, safeurl, llm as llmmod2
        try: profile = profiler.build_profile(fetch.fetch_company(a.url, use_cache=not a.no_cache), llm)
        except (safeurl.UnsafeURL, PermissionError, llmmod2.BudgetExceeded) as e:
            print(f"Stopped: {e}", file=sys.stderr); return 2
    brief = make_brief(profile, llm=llm if (a.llm_prose) else None)
    md = explainer.render_markdown(brief)
    if a.out:
        out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
        (out / "brief.md").write_text(md); json.dump(brief, open(out / "brief.json", "w"), indent=1, ensure_ascii=False)
        print(f"written to {out}/brief.md and brief.json")
    else: print(md)
    if llm is not None:
        print(f"\n[usage] calls={llm.budget.calls} input_tokens={llm.budget.used_in} output_tokens={llm.budget.used_out} cache_hits={llm.cache_hits} "
              f"cost_usd={llm.cost_usd() if llm.cost_usd() is not None else 'unknown (fill pipeline/pricing.json)'}", file=sys.stderr)
    return 0

if __name__ == "__main__": sys.exit(main())
