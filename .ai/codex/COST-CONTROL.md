# Codex cost control

This repository already contains detailed Cursor rules for expensive patterns.
This document adapts their intent to Codex: use a compact request, a focused
change session, and a fresh session when accumulated context would dominate the
next task. It does not change product behavior or API billing.

## Default operating policy

| Work shape | Codex mode | Scope and proof |
|---|---|---|
| Explanation, product question, or code review | Read-only answer | named docs/files; no patch or package |
| One-file defect or mechanical docs correction | Focused change | target file and matching test/check |
| Multi-file implementation | Focused change session | one vertical slice and the smallest validation |
| Cross-layer minor feature | Separate sessions | core + tests, host/UI, then docs/locales |
| VSIX build | Dedicated session | one `npm run package`; no feature crawl |

Where a Codex surface offers reasoning levels, choose the lowest level that can
reliably prove the requested result. A balanced/default level is appropriate for
bounded implementation; reserve high reasoning for an ambiguous design,
security boundary, or difficult failure after focused evidence. Do not encode a
model name or price in repo instructions: availability and pricing are account
and product dependent. This follows the official OpenAI guidance that recommends
a medium reasoning level as the general interactive coding balance and higher
levels for harder work. [Codex Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide)

## Rules that prevent expensive turns

1. Write the request as **one outcome + named paths + proof**. “Scan the whole
   project and improve it” has no useful stopping rule.
2. Load the task-router row from [`README.md`](./README.md), not the entire
   `.ai/` directory. Search only when it resolves a specific ownership question.
3. Read enough context before one logical edit; avoid re-opening large files or
   making a chain of micro-patches that rediscover the same facts.
4. Keep generated artifacts out of the read/edit loop. Change source once, then
   build once when the task needs generated output.
5. Run one proportionate validation near the end. Do not run packaging, the
   entire test suite, or a visual-review loop after every small change.
6. Stop when the requested acceptance evidence exists. A passing check is not a
   reason to expand into nearby features, catalogs, release notes, or cleanup.

## Session boundaries

Start a fresh Codex session when the next request changes surface or would need
to reload a large, previous investigation. In particular, do this after a token
warning or a long implementation session before:

- a second feature slice, Codex screenshot parity, broad webview polish, or a
  new coding-stats/git/polyrepo task;
- an Optimize Deep follow-up or a request expressed only as “continue”;
- VSIX packaging after implementation; make packaging a short, dedicated task.

Use at most the relevant files for a narrow follow-up: five paths for a normal
feature/bug slice and two paths for visual polish. A new session is not a loss
of useful state: the plan, diff, tests, and the focused request are the handoff.

## Repository-specific high-cost traps

| Trigger | Do | Do not |
|---|---|---|
| Alarm seems wrong | first compare observed behavior with configured threshold/window; then open only the listed hot path and test | reread guards, status bar, charts, and product docs |
| One webview control/screenshot | one screen and up to two owner paths | rebuild every tab, CSS area, catalog, and VSIX |
| Model catalog grouping | stay in the prescribed catalog/UI helper/test slice | mine Cursor.app, fetch long pricing text, or load all locales |
| Local Codex view | keep Cursor and Codex totals/charts separate | attach Cursor forecast or billing data to Codex output |
| Docs synchronization | use the named command's file list | turn one wording fix into a site/localization sweep |
| `npm run package` | run it only when requested, after source is ready | use package as a routine correctness check |

The detailed examples and path limits remain authoritative in
`.cursor/rules/optimize-*.mdc`. In Codex terminology, a Cursor “Ask” maps to a
read-only diagnosis/review; a Cursor “Agent” maps to a focused implementation
session.

## Good request examples

```text
Fix the Codex request CSV escaping. Touch only
src/openaiHistory/exportCsv.ts and test/openaiHistoryExportCsv.test.ts.
Preserve all source boundaries. Run the focused test and typecheck.
```

```text
Review why the Burn Rate toast did not fire. Do not edit yet. Compare the
configured threshold, window, and minQueries using only src/ui/burnRateAlert.ts,
src/burnRate/detect.ts, src/burnRate/window.ts, and their tests.
```

```text
Build the named core phase only: parser and tests. Do not wire the webview,
locales, documentation, version, or VSIX in this task.
```

## Evidence and cost observability

`.ai/optimize-savings.md` contains project-local measurements from prior
Optimize runs. It is a planning signal, not a product requirement or benchmark.
Keep its `cct-savings` record intact unless the task is specifically an Optimize
handoff. Use it to choose a smaller next slice, not as permission to modify the
extension's cost estimates.

For a broad workflow adjustment, compare a small sample of before/after task
cost, elapsed time, and acceptance results. Keep only guidance that improves the
result; avoid adding a permanent rule for a one-off incident.
