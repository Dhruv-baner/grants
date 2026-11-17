"""Rules-based matcher: company profile -> ranked schemes. No API calls.
Hard filters: country, region, size, status. Scoring: sector, shared concepts, data confidence, status.
Usage:  python pipeline/matcher.py --fixtures      |   python pipeline/matcher.py --profile profile.json"""
import json, re, sys, pathlib, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
TODAY = datetime.date(2026, 11, 17)

CONCEPTS = {
 "rd_innovation": r"\br&d\b|research|development|innovat|prototype|experimental|\bwbso\b|technolog",
 "ai_digital": r"\bai\b|artificial intelligence|digital|software|\bdata\b|\bict\b|machine learning",
 "cyber": r"cyber|security",
 "energy_saving": r"energy[- ]sav|energy efficien|energiebespar|\bled\b|lighting|insulation|heat pump|isolatie|efficien",
 "renewable_energy": r"renewable|solar|\bwind\b|photovolt|sde|electrif",
 "hydrogen": r"hydrogen|waterstof|wasserstoff|electroly",
 "decarbonisation": r"decarbon|co2|co₂|emission|climate|net-zero|carbon",
 "ccus": r"\bccu\b|\bccs\b|carbon capture|carbon management|capture",
 "site_investment": r"new site|new production|expansion|new jobs|jobs|investment in|investing in|capital investment|production site",
 "startup": r"start-?up|founder|pre-formation|not yet incorporated|young compan|gründung|gruendung|stipend",
 "vessel_inland": r"inland|binnen|barge",
 "vessel_sea": r"sea-going|seagoing|sea vessel|zeeschep|short-sea|sea ship",
 "circular_plastics": r"circular|recycl|plastic|feedstock|waste",
 "games_creative": r"\bgames?\b|creative|immersive|\bmedia\b",
 "financing_gap": r"collateral|guarantee|loan|credit|financ",
 "consortium_crossborder": r"consortium|cross-border|multi-country|partners in|several countries|legal entities|associated countries|member states",
 "training_skills": r"training|skills|apprentic|learning|praktijk",
 "agri": r"agricult|farm|rural|food|landbouw",
 "health": r"health|medical|medtech|pharma|clinical",
 "heat_networks": r"heat network|district heating|warmtenet|wärmenetz|waermenetz",
 "environment_invest": r"environment|milieu|sustainab|green invest|duurzaam|umwelt",
 "social_enterprise": r"gemeinwohl|social enterprise|boost4impact|social impact",
 "industrial_large": r"industrial site|chemical|steel|large[- ]scale|scale[- ]up|very large|eur \d+m",
}
GATE = {"social_enterprise","vessel_inland","vessel_sea","hydrogen","ccus","heat_networks","games_creative","circular_plastics","startup","agri","health"}
CONCEPT_SECTOR = {"energy_saving": "Energy & climate", "renewable_energy": "Energy & climate", "hydrogen": "Energy & climate", "decarbonisation": "Energy & climate",
 "heat_networks": "Energy & climate", "ai_digital": "Digital, AI & ICT", "cyber": "Digital, AI & ICT", "vessel_inland": "Transport & maritime",
 "vessel_sea": "Transport & maritime", "circular_plastics": "Circular economy & environment", "games_creative": "Creative, media & games",
 "health": "Health & life sciences", "agri": "Agriculture & food"}
ADJACENT = {frozenset(p) for p in [
 ("Energy & climate", "Circular economy & environment"), ("Energy & climate", "Industry & manufacturing"),
 ("Energy & climate", "Buildings & real estate"), ("Energy & climate", "Transport & maritime"),
 ("Digital, AI & ICT", "Defence & security"), ("Industry & manufacturing", "Circular economy & environment")]}
REGIONS = {"Lower Saxony": ["lower saxony", "niedersachsen"], "North Rhine-Westphalia": ["north rhine-westphalia", "nordrhein-westfalen", "nrw"],
           "Baden-Württemberg": ["baden-württemberg", "baden-wuerttemberg"], "Saxony": ["saxony", "sachsen"], "Bavaria": ["bavaria", "bayern"],
           "Berlin": ["berlin"], "Gelderland": ["gelderland"], "Limburg": ["limburg"], "Noord-Brabant": ["noord-brabant", "brabant"],
           "Zeeland": ["zeeland"], "Drenthe": ["drenthe"], "Fryslân": ["fryslân", "friesland"]}

def canon_regions(text):
    t = (text or "").lower(); out = set()
    for canon, aliases in REGIONS.items():          # dict order keeps 'Lower Saxony' before 'Saxony'
        for a in aliases:
            if re.search(r"\b" + re.escape(a) + r"\b", t):
                out.add(canon); t = re.sub(r"\b" + re.escape(a) + r"\b", " ", t); break
    return out

def concepts_in(text):
    t = (text or "").lower()
    return {c for c, p in CONCEPTS.items() if re.search(p, t)}

def row_text(r):
    return " ".join(str(r.get(k, "")) for k in ("name", "summary", "activities", "fit_signals", "aliases", "type", "consortium"))

def load_rows(path=ROOT / "data" / "schemes.json"):
    return json.load(open(path))["schemes"]

def country_ok(profile_country, r):
    rc = r["country"]
    if profile_country == "EU":
        return rc.startswith("EU") or r["geo_scope"] == "eu"
    return rc.startswith("EU") or profile_country in re.split(r"[/ ,()]+", rc)

MIN_SCORE, TOP_N = 50, 12

def match(profile, rows=None):
    rows = rows or load_rows()
    p_country, p_size = profile["country"], profile.get("size", "unknown")
    p_sectors = set(profile.get("sectors", []))
    ptext = " ".join(profile.get("signals", [])) + " " + profile.get("description", "")
    p_conc = concepts_in(ptext)
    if p_conc & {"energy_saving", "renewable_energy", "decarbonisation"}: p_conc = p_conc | {"environment_invest"}
    p_regions = canon_regions(profile.get("region", ""))
    p_sectors = p_sectors | {CONCEPT_SECTOR[c] for c in p_conc if c in CONCEPT_SECTOR}
    out = {"matches": [], "not_open": [], "check_manually": [], "excluded": {}}
    def excl(why): out["excluded"][why] = out["excluded"].get(why, 0) + 1
    for r in rows:
        if r["status_clean"] == "varies": excl("umbrella (see call rows)"); continue
        if not country_ok(p_country, r): excl("wrong country"); continue
        flags, reasons = [], []
        region_pen = 0
        rr = canon_regions(r.get("region", ""))
        if r["geo_scope"] == "regional" and rr:
            if not p_regions: flags.append(f"regional scheme ({r['region']}): confirm the company's location"); region_pen = 15
            elif not (p_regions & rr): excl("wrong region"); continue
            else: reasons.append(f"located in {r['region']}")
        elif r["geo_scope"] == "eu" and rr and p_regions and not (p_regions & rr):
            flags.append("limited to specific border or programme regions")
        sizes = r["eligible_sizes"]
        if sizes not in ("any", "unknown") and p_size != "unknown" and p_size not in sizes.split(";"):
            excl("size not eligible"); continue
        size_pts = 10 if (sizes == "any" or (p_size in sizes.split(";"))) else 2
        if sizes == "unknown": flags.append("size eligibility not stated: check")
        gate = concepts_in(r['name'] + ' ' + r.get('aliases', '')) & GATE
        if gate and not (gate & p_conc): excl("targets a specific theme the company does not show"); continue
        # sector
        rs = {s.strip() for s in r["sector"].split(";")}
        tags = rs - {"All sectors"}
        if "All sectors" in rs: sec_pts = 20
        elif rs & p_sectors:
            sec_pts = round(20 + 20 * len(rs & p_sectors) / len(tags)); reasons.append("sector fit: " + ", ".join(sorted(rs & p_sectors)))
        elif any(frozenset((a, b)) in ADJACENT for a in rs for b in p_sectors): sec_pts = 12; reasons.append("adjacent sector fit")
        else: sec_pts = 0
        # concepts
        shared = concepts_in(row_text(r)) & p_conc
        con_pts = min(30, 10 * len(shared))
        if shared: reasons.append("shared themes: " + ", ".join(sorted(shared)).replace("_", " "))
        ver = {"Verified": 10, "Verified (framework)": 7, "Partial": 3, "Candidate": 0}.get(r["verification"], 0)
        st = r["status_clean"]
        st_pts = {"open": 10, "rolling": 10, "opening_soon": 10, "between_rounds": 5}.get(st, 0)
        score = sec_pts + con_pts + size_pts + ver + st_pts - region_pen
        if r["type_group"] == "Tax incentive": score += 10; reasons.append("tax incentive: no competition for funds")
        needs_consortium = re.search(r"consortia only|consortium (of|with)|at least (two|three)|typically 3|cross-border (consortium|partners)|only consortia|joint project", (r.get("consortium", "") + " " + r.get("applicants", "")).lower())
        if needs_consortium and "consortium_crossborder" not in p_conc: score -= 15; flags.append("requires a consortium or partners the company has not mentioned")
        if sec_pts == 0 and not shared: excl("no sector or theme fit"); continue
        if sec_pts <= 20 and not shared and "All sectors" not in rs: excl("no theme fit"); continue
        if "All sectors" in rs and not shared: excl("generic scheme without a theme match"); continue
        entry = {"scheme_id": r["id"], "name": r["name"], "score": score, "reasons": reasons, "flags": flags, "status_clean": st,
                 "next_deadline": r["closes_date"], "data_confidence": r["verification"], "type_group": r["type_group"],
                 "questions_for_consultant": [q.strip() for q in re.split(r"\?\s*", r.get("call_questions", "")) if q.strip()][:3]}
        if r["verification"] in ("Partial", "Candidate"): entry["flags"].append(f"data confidence {r['verification']}: verify before quoting")
        if st == "between_rounds": entry["flags"].append("current round closed; next window" + (f" ends {r['closes_date']}" if r["closes_date"] else " date unknown"))
        if r["before_start_flag"] in ("yes", "at_application"): entry["flags"].append("do not start the project before applying" if r["before_start_flag"] == "yes" else "project may start once the application is filed")
        if r["verification"] == "Candidate" or st == "unknown": out["check_manually"].append(entry)
        elif st in ("closed", "paused"):
            if not r["closes_date"]: entry["flags"].append("not open now; no next window date known")
            out["not_open"].append(entry)
        else: out["matches"].append(entry)
    for k in ("matches", "not_open", "check_manually"): out[k].sort(key=lambda e: -e["score"])
    out["matches"] = [e for e in out["matches"] if e["score"] >= MIN_SCORE][:TOP_N]
    out["not_open"] = [e for e in out["not_open"] if e["score"] >= MIN_SCORE][:6]
    out["check_manually"] = out["check_manually"][:5]
    for e in out["matches"]: e["fit"] = "high" if e["score"] >= 75 else "medium" if e["score"] >= 60 else "low"
    return out

def to_case(profile, result, case_id="case"):
    return {"case_id": case_id, "created_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "company": {"name": profile.get("name", "unnamed"), "country": profile["country"], "region": profile.get("region", ""),
                        "size": profile.get("size", "unknown"), "sectors": profile.get("sectors", []), "activities": profile.get("description", "")},
            "matches": [{"scheme_id": m["scheme_id"], "fit": m["fit"], "score": m["score"], "reasons": m["reasons"], "blocking_issues": [],
                         "status_clean": m["status_clean"], "next_deadline": m["next_deadline"], "data_confidence": m["data_confidence"],
                         "questions_for_consultant": m["questions_for_consultant"]} for m in result["matches"]],
            "audit": {"data_version": "1.0.0", "data_as_of": "2026-11-17", "models_used": [], "cost_usd": 0}}

def check_fixtures(verbose=True, file="companies.json"):
    rows = load_rows(); fx = json.load(open(ROOT / "tests" / file))["companies"]; fails = []
    for c in fx:
        res = match(c["profile"] | {"description": c["description"]}, rows)
        m_ids = [m["scheme_id"] for m in res["matches"]]; seen = set(m_ids) | {m["scheme_id"] for m in res["not_open"]}
        e = c["expected"]
        miss = [i for i in e["must_include"] if i not in m_ids]
        bad = [i for i in e["must_exclude"] if i in m_ids]
        nobt = [i for i in e["relevant_but_not_open"] if i not in seen]
        if miss or bad or nobt: fails.append((c["id"], miss, bad, nobt))
        if verbose: print(f"{c['id']:26} matches={len(m_ids):2} not_open={len(res['not_open']):2} check={len(res['check_manually']):2} | missing={miss} wrongly_in={bad} lost_relevant={nobt}")
    return fails

if __name__ == "__main__":
    if "--fixtures" in sys.argv:
        f = check_fixtures(file=(sys.argv[sys.argv.index("--file") + 1] if "--file" in sys.argv else "companies.json")); print("FIXTURE FAILURES:", len(f)); sys.exit(1 if f else 0)
    if "--profile" in sys.argv:
        prof = json.load(open(sys.argv[sys.argv.index("--profile") + 1]))
        print(json.dumps(match(prof), indent=1, ensure_ascii=False))
