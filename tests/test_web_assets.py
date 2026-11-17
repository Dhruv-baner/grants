import json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import matcher

def test_app_data_copy_is_current():
    assert json.load(open(ROOT / "app/src/data/schemes.json")) == json.load(open(ROOT / "data/schemes.json")), "run: python pipeline/export_web_assets.py"
    assert json.load(open(ROOT / "app/src/data/demo_companies.json")) == json.load(open(ROOT / "examples/demo_companies.json"))

def test_matcher_config_matches_python_constants():
    cfg = json.load(open(ROOT / "app/src/lib/matcher-config.json"))
    assert cfg["CONCEPTS"] == matcher.CONCEPTS and cfg["REGIONS"] == matcher.REGIONS and cfg["CONCEPT_SECTOR"] == matcher.CONCEPT_SECTOR
    assert sorted(cfg["GATE"]) == sorted(matcher.GATE) and cfg["MIN_SCORE"] == matcher.MIN_SCORE and cfg["TOP_N"] == matcher.TOP_N

def test_golden_file_is_current():
    rows = matcher.load_rows(); g = json.load(open(ROOT / "app/tests/golden.json"))
    for case in g[:25]:
        r = matcher.match(case["profile"], rows)
        assert [m["scheme_id"] for m in r["matches"]] == [m["scheme_id"] for m in case["matches"]], "golden file stale: run python pipeline/export_web_assets.py"
