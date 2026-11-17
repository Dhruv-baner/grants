"""Validate data/schemes.json against the JSON schema plus cross-row rules.
Usage: python pipeline/validate.py   (exit code 1 if any error)"""
import json, sys, datetime, pathlib
from jsonschema import Draft202012Validator

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOCAB = json.load(open(ROOT / "schema" / "vocabularies.json"))

def run(path=ROOT / "data" / "schemes.json"):
    errors = []
    data = json.load(open(path))
    rows = data["schemes"]
    meta = data.get("meta", {})
    as_of = datetime.date.fromisoformat(meta.get("as_of", "2026-11-17"))
    v = Draft202012Validator(json.load(open(ROOT / "schema" / "scheme.schema.json")))
    ids = {}
    for r in rows:
        rid = r.get("id", "?")
        for e in v.iter_errors(r):
            errors.append(f"{rid}: schema: {'/'.join(map(str, e.path))} {e.message[:90]}")
        if rid in ids: errors.append(f"{rid}: duplicate id")
        ids[rid] = r
    for r in rows:
        rid = r["id"]
        if r["row_type"] == "call":
            p = ids.get(r["parent_id"])
            if not p: errors.append(f"{rid}: parent '{r['parent_id']}' not found")
            elif p["row_type"] != "scheme": errors.append(f"{rid}: parent is not a scheme row")
        elif r["parent_id"]:
            errors.append(f"{rid}: scheme row must not have a parent_id")
        if r["verification"].startswith("Verified") and not any(s["tier"] == "Official" for s in r["sources"]):
            errors.append(f"{rid}: {r['verification']} but no Official source")
        if r["verification"] == "Verified":
            for k in ("applicants", "window", "status"):
                if not r.get(k): errors.append(f"{rid}: Verified row has empty '{k}'")
        for tag in [t.strip() for t in r["sector"].split(";")]:
            if tag not in VOCAB["sectors"]: errors.append(f"{rid}: unknown sector tag '{tag}'")
        if r["closes_date"]:
            try: cd = datetime.date.fromisoformat(r["closes_date"])
            except ValueError: errors.append(f"{rid}: bad closes_date"); continue
            if r["status_clean"] in ("open", "opening_soon") and cd < as_of:
                errors.append(f"{rid}: {r['status_clean']} but closes_date {cd} is before as_of {as_of}")
            if r["status_clean"] == "closed" and cd >= as_of:
                errors.append(f"{rid}: closed but closes_date {cd} is on or after as_of")
    if meta.get("rows") != len(rows): errors.append("meta.rows does not match number of rows")
    return errors, rows

if __name__ == "__main__":
    errs, rows = run()
    print(f"{len(rows)} rows checked, {len(errs)} problem(s)")
    for e in errs[:50]: print(" -", e)
    sys.exit(1 if errs else 0)
