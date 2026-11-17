import json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import validate

ROWS = {r["id"]: r for r in json.load(open(ROOT / "data" / "schemes.json"))["schemes"]}
FIX = json.load(open(ROOT / "tests" / "companies.json"))["companies"]
CASE_SCHEMA_OK = {"open", "rolling", "opening_soon", "between_rounds", "varies"}

def test_dataset_validates():
    errors, _ = validate.run()
    assert errors == [], errors[:5]

def test_fixture_ids_exist():
    for c in FIX:
        e = c["expected"]
        for k in ("must_include", "must_exclude", "relevant_but_not_open"):
            for i in e[k]:
                assert i in ROWS, f"{c['id']}: unknown scheme id {i}"

def test_must_include_are_actually_available():
    for c in FIX:
        for i in c["expected"]["must_include"]:
            assert ROWS[i]["status_clean"] in CASE_SCHEMA_OK, f"{c['id']}: {i} is {ROWS[i]['status_clean']}"

def test_country_fit_of_expected_matches():
    for c in FIX:
        cc = c["profile"]["country"]
        for i in c["expected"]["must_include"]:
            assert cc in ROWS[i]["country"] or ROWS[i]["country"] == "EU", f"{c['id']}: {i} is {ROWS[i]['country']}"

def test_case_example_validates():
    from jsonschema import Draft202012Validator
    s = json.load(open(ROOT / "schema" / "case.schema.json"))
    ex = json.load(open(ROOT / "examples" / "case.example.json"))
    assert list(Draft202012Validator(s).iter_errors(ex)) == []
    for m in ex["matches"]: assert m["scheme_id"] in ROWS
