"""Export matcher constants and Python 'golden' results for the TypeScript port, plus a copy of the data."""
import json, pathlib, random, shutil, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import matcher
ROOT = matcher.ROOT; APP = ROOT / "app"

cfg = {"CONCEPTS": matcher.CONCEPTS, "GATE": sorted(matcher.GATE), "CONCEPT_SECTOR": matcher.CONCEPT_SECTOR,
       "ADJACENT": sorted(sorted(p) for p in matcher.ADJACENT), "REGIONS": matcher.REGIONS, "MIN_SCORE": matcher.MIN_SCORE, "TOP_N": matcher.TOP_N}
json.dump(cfg, open(APP / "src/lib/matcher-config.json", "w"), indent=1, ensure_ascii=False)
shutil.copy(ROOT / "data/schemes.json", APP / "src/data/schemes.json")
shutil.copy(ROOT / "examples/demo_companies.json", APP / "src/data/demo_companies.json")

rows = matcher.load_rows()
profiles = []
for f in ("companies.json", "holdout.json"):
    for c in json.load(open(ROOT / "tests" / f))["companies"]: profiles.append(c["profile"] | {"description": c["description"]})
rnd = random.Random(7)
SIGNALS = ["own R&D staff", "AI software", "new production site and new jobs", "LED lighting and heat pumps", "hydrogen electrolyser", "recycled plastics test",
           "vessel retrofit inland waterway", "sea-going vessel methanol", "start-up founder not yet incorporated", "games prototype", "cyber security consortium cross-border",
           "carbon capture CCU", "district heating network", "medical device clinical", "farm rural food", "training and skills apprentices", "solar panels",
           "collateral for a bank loan", "large decarbonisation investment chemical site", "social enterprise impact"]
SECT = ["Energy & climate", "Industry & manufacturing", "Digital, AI & ICT", "Health & life sciences", "Agriculture & food", "Buildings & real estate",
        "Transport & maritime", "Circular economy & environment", "Creative, media & games", "Defence & security", "Education & skills", "Public sector & municipalities"]
REG = {"DE": ["", "Bavaria", "Saxony", "Lower Saxony", "NRW", "Berlin", "Baden-Württemberg"], "NL": ["", "Gelderland", "Limburg", "Zeeland"], "EU": [""]}
for _ in range(80):
    c = rnd.choice(["NL", "DE", "EU"])
    profiles.append({"country": c, "region": rnd.choice(REG[c]), "size": rnd.choice(["micro", "small", "medium", "large", "unknown"]),
                     "sectors": rnd.sample(SECT, rnd.randint(0, 2)), "signals": rnd.sample(SIGNALS, rnd.randint(0, 3)), "description": rnd.choice(["", "Fictional company"])})
def slim(lst): return [{"scheme_id": e["scheme_id"], "score": e["score"], "fit": e.get("fit"), "reasons": e["reasons"], "flags": e["flags"]} for e in lst]
import explainer
by = {r["id"]: r for r in rows}
golden = []
for p in profiles:
    r = matcher.match(p, rows)
    b = explainer.build_brief(p | {"name": "x", "activities": p.get("description", "")}, r, by)
    golden.append({"profile": p, "matches": slim(r["matches"]), "not_open": slim(r["not_open"]), "check_manually": slim(r["check_manually"]), "excluded": r["excluded"],
                   "brief": [{"scheme_id": m["scheme_id"], "why": m["why_it_fits"], "watch": m["watch_outs"], "questions": m["questions"], "key_terms": m["key_terms"]} for m in b["matches"]]})
json.dump(golden, open(APP / "tests/golden.json", "w"), ensure_ascii=False)
print("exported config, data copy and", len(golden), "golden cases")

import explainer
vec = []
for r in rows[:70]:
    base = (r.get("funding_rate", "") + " " + r.get("caps", "")).strip()
    for text in (base, base + " plus EUR 987,654 and 3.7% and 2031", "A short note with no figures.", "Deadline 12 March 2027 and 150 staff."):
        vec.append({"id": r["id"], "text": text, "violations": explainer.grounding_violations(text, r)})
json.dump(vec, open(APP / "tests/grounding_golden.json", "w"), ensure_ascii=False)
print("grounding vectors:", len(vec))
