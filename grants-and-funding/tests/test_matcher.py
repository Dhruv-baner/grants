import json, pathlib, sys, itertools
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import matcher
from jsonschema import Draft202012Validator

ROWS = matcher.load_rows(); BY = {r["id"]: r for r in ROWS}

def test_tuning_set_passes():
    assert matcher.check_fixtures(verbose=False) == []

def test_holdout_set_passes():
    assert matcher.check_fixtures(verbose=False, file="holdout.json") == []

def _all_profiles():
    for c in json.load(open(ROOT / "tests" / "companies.json"))["companies"] + json.load(open(ROOT / "tests" / "holdout.json"))["companies"]:
        yield c["profile"] | {"description": c["description"]}

def test_invariants_hold_for_every_company():
    for p in _all_profiles():
        res = matcher.match(p, ROWS)
        assert len(res["matches"]) <= matcher.TOP_N
        for m in res["matches"]:
            row = BY[m["scheme_id"]]
            assert row["status_clean"] in ("open", "rolling", "opening_soon", "between_rounds"), (p["country"], m["scheme_id"])
            assert row["verification"] != "Candidate"
            assert matcher.country_ok(p["country"], row), (p["country"], m["scheme_id"], row["country"])
            sizes = row["eligible_sizes"]
            if sizes not in ("any", "unknown") and p.get("size", "unknown") != "unknown":
                assert p["size"] in sizes.split(";"), (m["scheme_id"], sizes, p["size"])
        for m in res["not_open"]: assert BY[m["scheme_id"]]["status_clean"] in ("closed", "paused")

def test_every_partial_match_is_flagged():
    for p in _all_profiles():
        for m in matcher.match(p, ROWS)["matches"]:
            if m["data_confidence"] in ("Partial", "Candidate"):
                assert any("verify before quoting" in f for f in m["flags"])

def test_case_output_validates():
    schema = json.load(open(ROOT / "schema" / "case.schema.json"))
    for p in _all_profiles():
        case = matcher.to_case(p | {"name": "test"}, matcher.match(p, ROWS))
        assert list(Draft202012Validator(schema).iter_errors(case)) == []
