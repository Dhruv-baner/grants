"""Matcher result -> consultant brief. Deterministic template mode (free) or Claude prose with a grounding check.
Rates, caps, windows and sources are always copied verbatim from the data, never generated."""
import datetime, json, re

BANNER = "Indicative screening only. Consultant review required. Not legal or financial advice."
FACT_FIELDS = ("funding_rate", "caps", "window", "before_start", "status")
ALLOWED_FIELDS = ("name", "summary", "status", "window", "funding_rate", "caps", "budget", "before_start", "assessment", "applicants",
                  "activities", "instrument_detail", "eligible_costs", "closes_date", "size_rule", "stage")
NUM = re.compile(r"(?<![\w.])(\d+(?:[.,]\d+)*)(\s?(?:%|percent|k\b|m\b|bn\b|million|billion))?", re.I)

def _norm(tok): return tok.replace(",", "").rstrip(".")

def numbers_in(text):
    """Numbers worth checking: anything with a unit, a decimal or thousands separator, or a value above 31 (years, amounts)."""
    out = set()
    for num, unit in NUM.findall(text or ""):
        n = _norm(num)
        small_int = not unit and "." not in num and "," not in num and int(n) <= 31
        if not small_int: out.add(n)
    return out

def allowed_numbers(row, profile=None):
    txt = " ".join(str(row.get(k, "")) for k in ALLOWED_FIELDS) + " " + ((profile or {}).get("activities", ""))
    return {_norm(n) for n, _ in NUM.findall(txt)}

def grounding_violations(text, row, profile=None):
    return sorted(numbers_in(text) - allowed_numbers(row, profile))

def template_prose(m, row):
    _r = "; ".join(m["reasons"]); why = (_r[:1].upper() + _r[1:] + ".") if m["reasons"] else "Passes the country, size and status filters."
    watch = [f for f in m["flags"]]
    if row.get("rejection_risks"): watch.append("Typical rejection risks: " + row["rejection_risks"][:200])
    return why, watch[:4]

def _questions(m, row):
    qs = [q.strip() + "?" for q in re.split(r"\?\s*", row.get("call_questions", "")) if q.strip()]
    return (qs or m["questions_for_consultant"])[:3]

def build_brief(profile, result, rows_by_id, llm=None, mode="template"):
    prose, notes = {}, []
    if llm is not None and result["matches"]:
        prose = llm_prose(profile, result["matches"], rows_by_id, llm, notes)
    items = []
    for m in result["matches"]:
        row = rows_by_id[m["scheme_id"]]
        why, watch = template_prose(m, row)
        if m["scheme_id"] in prose: why, watch = prose[m["scheme_id"]]["why"], prose[m["scheme_id"]]["watch"] or watch
        items.append({"scheme_id": m["scheme_id"], "name": row["name"], "fit": m["fit"], "score": m["score"], "status_clean": m["status_clean"],
                      "next_deadline": m["next_deadline"], "data_confidence": m["data_confidence"], "type_group": m["type_group"],
                      "why_it_fits": why, "watch_outs": watch, "questions": _questions(m, row),
                      "key_terms": {k: row.get(k, "")[:300] for k in FACT_FIELDS},
                      "as_of": row["as_of"], "sources": row["sources"][:4]})
    short = lambda lst: [{"scheme_id": e["scheme_id"], "name": e["name"], "status_clean": e["status_clean"], "next_deadline": e["next_deadline"],
                          "flags": e["flags"]} for e in lst]
    return {"company": {k: profile.get(k) for k in ("name", "website", "country", "region", "size", "sectors", "activities", "signals", "confidence")},
            "generated_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "mode": "llm" if prose else mode,
            "data_as_of": "2026-11-17", "banner": BANNER, "matches": items, "not_open": short(result["not_open"]),
            "check_manually": short(result["check_manually"]), "notes": notes}

LLM_SYSTEM = """You write short factual notes for a business-funding consultant.
Use ONLY the facts provided in <schemes>. Never state any amount, percentage, date or number that is not in those facts.
If a condition is not in the facts, say it needs checking. Do not promise eligibility or funding.
Reply with ONLY a JSON array: [{"scheme_id": "...", "why_it_fits": "max 40 words", "watch_outs": ["max 3 short items"]}]"""

def llm_prose(profile, matches, rows_by_id, llm, notes):
    pack = []
    for m in matches[:8]:
        row = rows_by_id[m["scheme_id"]]
        pack.append({"scheme_id": m["scheme_id"], "name": row["name"], "status": m["status_clean"], "next_deadline": m["next_deadline"],
                     "facts": {k: str(row.get(k, ""))[:260] for k in ("applicants", "funding_rate", "caps", "window", "before_start")},
                     "matcher_reasons": m["reasons"], "matcher_flags": m["flags"]})
    user = ("<company>" + json.dumps({k: profile.get(k) for k in ("country", "region", "size", "sectors", "activities", "signals")}, ensure_ascii=False)
            + "</company>\n<schemes>" + json.dumps(pack, ensure_ascii=False) + "</schemes>")
    try:
        raw = llm.complete(LLM_SYSTEM, user, task="brief", max_tokens=1400)
        arr = json.loads(re.search(r"\[.*\]", raw, re.S).group(0))
    except Exception as e:
        notes.append(f"Claude prose unavailable ({type(e).__name__}); template text used."); return {}
    out = {}
    for it in arr:
        sid = it.get("scheme_id")
        if sid not in rows_by_id or not isinstance(it.get("why_it_fits"), str): continue
        text = it["why_it_fits"] + " " + " ".join(w for w in it.get("watch_outs", []) if isinstance(w, str))
        bad = grounding_violations(text, rows_by_id[sid], profile)
        if bad:
            notes.append(f"{sid}: generated text contained numbers not found in the data ({', '.join(bad)}); template text used instead."); continue
        out[sid] = {"why": it["why_it_fits"][:400], "watch": [w[:200] for w in it.get("watch_outs", []) if isinstance(w, str)][:3]}
    return out

BADGE = {"Verified": "[Verified]", "Verified (framework)": "[Verified: framework]", "Partial": "[Partial: verify before quoting]", "Candidate": "[Candidate]"}

def render_markdown(b):
    c = b["company"]; L = [f"# Funding screening: {c['name']}", "", f"> **{b['banner']}**", f"> Data as of {b['data_as_of']}. Brief generated {b['generated_at']} ({b['mode']} mode).", ""]
    L += ["## Company profile", f"- Country: {c['country']}" + (f", {c['region']}" if c.get("region") else ""), f"- Size: {c['size']}",
          f"- Sectors: {', '.join(c['sectors']) or 'not determined'}", f"- Activities: {c['activities'] or 'not determined'}",
          f"- Profile confidence: {c['confidence']}", ""]
    L += ["## Top matches", ""] if b["matches"] else ["## Top matches", "", "No open scheme passed the filters. See the lists below.", ""]
    for i, m in enumerate(b["matches"], 1):
        dl = f", next deadline {m['next_deadline']}" if m["next_deadline"] else ""
        L += [f"### {i}. {m['name']}  ({m['fit']} fit, score {m['score']})", f"{BADGE.get(m['data_confidence'], m['data_confidence'])} | {m['type_group']} | status: {m['status_clean']}{dl}", "",
              f"**Why it may fit:** {m['why_it_fits']}", ""]
        kt = m["key_terms"]
        L += ["**Key terms (copied from the data, as of " + m["as_of"] + "):**"] + [f"- {k.replace('_', ' ')}: {v}" for k, v in kt.items() if v] + [""]
        if m["watch_outs"]: L += ["**Watch-outs:**"] + [f"- {w}" for w in m["watch_outs"]] + [""]
        if m["questions"]: L += ["**Questions for the consultant:**"] + [f"- {q}" for q in m["questions"]] + [""]
        L += ["**Sources:** " + "; ".join(f"{s['tier']}: {s['url']}" for s in m["sources"]), ""]
    if b["not_open"]: L += ["## Relevant but not open now"] + [f"- {x['name']} ({x['status_clean']})" + (f", next date {x['next_deadline']}" if x["next_deadline"] else "") for x in b["not_open"]] + [""]
    if b["check_manually"]: L += ["## To check manually (unverified or unknown status)"] + [f"- {x['name']}" for x in b["check_manually"]] + [""]
    if b["notes"]: L += ["## Notes"] + [f"- {n}" for n in b["notes"]] + [""]
    L += ["---", "Rates, caps and deadlines are true only as of the data date. Check official sources before advising a client."]
    return "\n".join(L)
