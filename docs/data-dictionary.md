# Data dictionary

One row per programme (`row_type = scheme`) or per individual call under an umbrella programme (`row_type = call`, with `parent_id`).
Source of truth: `data/schemes.json`, validated by `schema/scheme.schema.json` and `pipeline/validate.py`.

## Fields used for matching (structured)
| Field | Meaning |
|---|---|
| `country` | NL, DE or EU (a few cross-border rows carry a combined value) |
| `geo_scope` | national, regional or eu |
| `region` | State or province for regional rows |
| `type_group` | Grant, Loan, Tax incentive, Guarantee, Equity, Mixed (grant and loan), Mixed (grant and equity), Other |
| `sector` | Up to three tags from `schema/vocabularies.json`, or "All sectors". Our judgment, not Ignite's tags |
| `eligible_sizes` | any, unknown, or a list of micro, small, medium, large |
| `status_clean` | open, opening_soon, rolling, between_rounds, paused, varies (umbrella), closed, unknown |
| `closes_date` | ISO date of the next closing, when known; empty otherwise |
| `before_start_flag` | yes, no, at_application, not_applicable, unknown |
| `verification` | Verified, Verified (framework), Partial, Candidate |

## Fields used for explanation (free text)
`summary`, `status`, `applicants`, `activities`, `funding_rate`, `caps`, `budget`, `window`, `before_start`, `assessment`,
`fit_signals`, `rejection_risks`, `call_questions`, `confidence`, `conflicts`, `open_questions`.

## Trust model
- **Verified**: every key field traces to an official page or legal text.
- **Verified (framework)**: mechanics, window and conditions are official, but at least one key field (often a rate) is not.
- **Partial / Candidate**: some or few fields checked. Never present figures from these rows as settled.
- Each row lists `sources` with a tier: Official, Secondary or Trade press. Source disagreements are kept in `conflicts`.

## Caveats
- Rates, caps and deadlines are true as of `as_of` (dataset-level `meta.as_of` is 2026-11-17).
- `status_clean`, `closes_date`, `eligible_sizes`, `before_start_flag`, `type_group` and `sector` were derived from the text and hand-corrected; they are screening aids, not legal determinations.
- 60 rows have `eligible_sizes = unknown` and 76 have `before_start_flag = unknown`: the source text did not say.
