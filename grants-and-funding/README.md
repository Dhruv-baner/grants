# Grants and Funding

Screening tool for Dutch, German and EU business funding: paste a company website, get a ranked, sourced shortlist of schemes with deadlines, risks and questions for a consultant.

> Indicative only. Consultant review required. Rates, caps and deadlines are true as of 17 Nov 2026.

## Status
- [x] Data layer: 127 rows (84 schemes, 43 calls), every row sourced, with a trust label and conflicts logged
- [x] Structured fields for matching, JSON schema, validation script, CI, case record format, 10 test companies
- [x] Company profiler: website to profile (safe fetch, robots.txt, schema-validated output). Live Claude call not yet run end to end
- [x] Matching engine, rules-based (country, region, size, status filters; scored on sector and themes; no API cost)
- [x] Explainer: template mode (free, offline) and Claude prose mode with a number-grounding check. Live Claude call not yet run end to end
- [x] Brief generator (Markdown + JSON) - see `examples/sample_brief.md`
- [ ] PDF export and CRM export
- [ ] Automation: freshness checker, deadline digest, bulk mode
- [x] Web app (Next.js): screening tool with live results and exports, programme explorer, deadline timeline, data-trust page. Demo mode, no AI calls
- [x] Live mode in the web app: URL to profile and Claude-written explanations, behind a server route with access code, rate limits and token caps. Never run against the real Claude API with a valid key (see Live mode)

## Data at a glance
| | |
|---|---|
| Countries | NL, DE, EU |
| Trust levels | Verified, Verified (framework), Partial, Candidate |
| Sources | Official, Secondary, Trade press, listed per row |
| Derived fields | status, closing date, eligible sizes, before-start rule, type group, sector |

## Repository layout
- `data/` dataset as JSON (source of truth), CSV and Excel
- `schema/` JSON schemas for rows and for the case record, plus shared vocabularies
- `pipeline/validate.py` schema and cross-row checks
- `tests/` pytest checks and fictional test companies
- `docs/` data dictionary and planned architecture
- `examples/` example case record
- `app/` planned web app

## Try it (no API key needed)
```
pip install -r requirements.txt
python pipeline/cli.py list-demos
python pipeline/cli.py brief --demo nl-manufacturer-energy
```
With a key (`export ANTHROPIC_API_KEY=...`): `python pipeline/cli.py brief --url https://company.example --llm-prose --out out/`

## Run the checks
```
python pipeline/validate.py          # data checks
pytest -q                            # data + matcher tests
python pipeline/matcher.py --fixtures                       # 10 tuning companies
python pipeline/matcher.py --fixtures --file holdout.json   # 5 unseen companies
python pipeline/matcher.py --profile examples/profile.example.json
```

## How the matcher works
1. Hard filters: country, region, company size, status (closed schemes go to a separate "not open" list; unverified or unknown-status ones to "check manually").
2. Theme gating: a scheme about vessels, hydrogen, plastics, start-ups, games and similar narrow themes only shows if the company shows that theme.
3. Scoring: sector fit, shared themes, data confidence, status, plus a bonus for tax incentives and a penalty for consortium-only schemes.
4. Output: at most 12 matches, each with reasons, flags (for example "verify before quoting"), next deadline and consultant questions.

## Web app
```
cd app && npm install
npm run dev        # http://localhost:3000
npm test           # 256 tests: parity with Python on 95 profiles, plus live-mode security and handler tests
npm run build
```
- Pages: overview, screen a company (form, live ranked matches, Markdown/CSV/JSON/print export), programme explorer, deadline timeline, data trust.
- The matcher runs in the browser (a tested TypeScript port of `pipeline/matcher.py`), so the deployed demo needs no server, no key and no database.
- Deploy: import the repo in Vercel and set the root directory to `app`. No environment variables are needed for demo mode.
- After changing the data or the Python matcher, run `python pipeline/export_web_assets.py` to refresh the app's data copy and golden test cases (a Python test fails if they are stale).

## Live mode (web app)
Off by default: without `ANTHROPIC_API_KEY` the app is a pure demo and the live buttons are disabled.
```
cd app && cp .env.example .env.local     # then set ANTHROPIC_API_KEY (and GS_ACCESS_CODE for any public deployment)
npm run dev
```
- `POST /api/profile` fetches a company website and drafts a profile with the cheap model; `POST /api/prose` rewrites the short explanations with the stronger model. The matching itself never leaves the browser.
- The server re-computes matches itself and never trusts the client's list; website text is treated as untrusted data; generated numbers that are not in the data are discarded.
- Fetching is public-internet only (private and cloud-metadata addresses are blocked at connect time, redirects re-checked), obeys robots.txt, and caps size, time and pages.
- Limits (per IP per hour, daily calls, daily tokens) are in memory: they reset on cold starts and are not shared between serverless instances. Treat them as a courtesy guard and **also set a spend limit in the Anthropic console**. The access code is a shared secret, not user authentication.
- Status: all of this is tested with a stand-in model and a local web server, and the real SDK path was exercised only far enough to confirm that a bad key is rejected and reported cleanly. A successful live Claude call, the default model IDs (`claude-haiku-5-5`, `claude-sonnet-5-5`) and real-world website fetching have not been verified.

## Safety and cost design
- Website text is treated as untrusted data; the profile output is sanitised and schema-validated (unknown keys dropped), and the explainer never sees raw website text.
- URL fetching blocks private and local addresses, odd ports and credentials, re-checks every redirect, respects robots.txt, caps size and pages.
- Claude only writes short prose; rates, caps, windows and sources are copied verbatim from the data. A grounding check drops any generated number that is not in the data.
- Per-run token budget, disk cache, cheap model for profiling. Cost figures stay unknown until prices are filled into `pipeline/pricing.json`.

## Limits
Partial and Candidate rows are not settled and must not be quoted as fact. Sector, size and status fields are screening aids derived from text, not legal determinations. This is not legal or financial advice.
