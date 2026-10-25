# Phase 7 — Analysis runs

**Parent:** [openai-codex.md](./openai-codex.md) §9 phase 7
**Status:** later minor. Do not start during 1.1.0.
**Depends on:** [phase-3d-stats.md](./phase-3d-stats.md). Phase 6 is not required for the chip.
**Next:** none in this folder
**Polish:** [phase-7-analysis.pl.md](./phase-7-analysis.pl.md)

If this file and the parent plan disagree, **the parent plan wins**. If either disagrees with the PRD, **the PRD wins**.

One Agent message. Touch only the paths in §3.

---

## 1. Goal

Persist an analysis run so the Optimized chip can match it. Do not rewrite historical cost. Measure the first warm page at 100,000 rows; 500 ms is the target to measure, not a gate this phase must already hit.

**Done when:**

- A saved run makes the Optimized filter include that request or conversation id and exclude rows that only have a cache hit (acceptance: decision 19).
- Re-running analysis does not change `estimated_api_cost_usd` or `pricing_version` on the request.
- The webview still receives one page (acceptance 18). The 100,000-row check is a measured note in the test output, not a load of 100,000 DOM nodes.

---

## 2. Out of scope

| Item | Why |
|------|-----|
| Optional Codex app-server titles | Separate change. Negotiated schema, no process start. Fallback title stays `#` plus the short id. |
| Rewriting tokens to show “savings” | Historical cost stays |
| Virtualizing the Cursor table | Only the Codex page path, if the measure says the host query is fine and the DOM is the cost |

---

## 3. Files

```
src/openaiHistory/analysis/runs.ts
src/openaiHistory/store/migrations.ts
src/openaiHistory/historyQuery.ts
src/ui/historyPanel.ts
media/src/tabs/queries.js
test/openaiAnalysisRuns.test.ts
```

Migration **5** adds `optimization_runs(id, started_at, range_from, range_to, rule_version, status, request_id, conversation_id)`.

`historyQuery.ts` gains an `optimized: boolean` filter. When true, the page keeps rows whose id is referenced by a run. Cache hit is not a match.

`queries.js` enables the Optimized chip that phase 3c left unmatched. `historyPanel.ts` writes a run when `codex.analyze` pastes a brief, status `pasted`. It does not mark `applied`.

---

## 4. Measure

A test inserts 100,000 synthetic request rows in a temp database and times `historyQuery` for `limit: 100` with a warm file. Record the milliseconds. Do not fail the suite on 500 ms. Do not render the page in a webview.

---

## 5. Tests

- Insert a run for request A. Optimized filter returns A and not request B, even when B has cached input tokens.
- After the run, A’s cost string is unchanged.
- Two pages still keyset without repeating ids at the larger row count used by the existing paging test (the 100,000 case is the measure, not the paging assertion).

---

## 6. Handoff

No further phase in this folder. A title source from the Codex app server is a new plan, not an extension of this file.
