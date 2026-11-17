# Architecture (planned)

```
Company URL --> Profiler (Claude, cheap model) --> Case record
Case record --> Rule filter (country, size, sector, status, before-start) --> shortlist
shortlist  --> Ranker/explainer (Claude) --> matches with reasons and sources
matches    --> Brief (PDF/Markdown) + CRM export (CSV/JSON)
Documents  --> Readiness checker (Claude) --> gap list per scheme
Scheduler  --> Freshness checker (official URLs) --> issue per changed row
Scheduler  --> Deadline watchlist --> weekly digest
```

- One shared `case` record (see `schema/case.schema.json`) is the only hand-off between tools.
- Rules decide eligibility where the data is structured; Claude only profiles, ranks and explains.
- Every shown fact carries its source tier and `as_of` date; Partial and Candidate rows are flagged and never given invented numbers.
- Cost controls: cheap model for extraction, stronger model for the final brief, prompt caching, per-run spend cap.

## Matcher (built)
`pipeline/matcher.py` is deterministic and free to run. Claude is only planned for profiling a website and for explaining the shortlist. Known limits: eligibility conditions that are not structured (for example 'founded within three years', minimum project size) are not checked, and 60 rows have unknown size eligibility, which the matcher treats as 'check', not 'eligible'.

## Claude layer (built, live call untested)
`profiler.py` (cheap model) and `explainer.py` (prose only) run behind `llm.py` (budget, cache). They are tested with a stand-in client; the real API call path has not been exercised because no API key was available during development. Model IDs default to claude-haiku-5-5 (profile) and claude-sonnet-5-5 (brief) and can be changed with GS_MODEL_PROFILE and GS_MODEL_BRIEF.

## Web app (built)
Next.js 16 App Router, statically generated, TypeScript matcher and template brief ported from Python and verified by 191 parity tests. Not yet built: URL profiling and Claude prose in the web app (they exist in the Python CLI). The interface was type-checked, built and smoke-tested over HTTP, but not inspected visually in a browser during development.

## Live mode (built, real Claude call unverified)
`src/lib/{ssrf,site,profiler,prose,grounding,llm,limits,live}.ts` with routes under `src/app/api/`. Handlers take injected dependencies, so tests run without network or key. A contract test (Python) and the SDK's own types (TypeScript) guard the arguments sent to the Claude API; this caught a real bug (the SDKs do not accept a `temperature` argument) that a permissive stand-in client had hidden.
