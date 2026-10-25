# Phase 3d — Statistics, Charts, Optimize

**Parent:** [openai-codex.md](./openai-codex.md) §4.6 and decisions 16–19
**Status:** ready to implement
**Depends on:** [phase-3c-webview.md](./phase-3c-webview.md)
**Next:** [phase-4-pricing.md](./phase-4-pricing.md)
**Polish:** [phase-3d-stats.pl.md](./phase-3d-stats.pl.md)
**Release:** 1.1.0. Do not bump `package.json`.

If this file and the parent plan disagree, **the parent plan wins**. If either disagrees with the PRD, **the PRD wins**.

One Agent message. Touch only the paths in §3. Catalogs: `en` and `pl` only. Other locales are the next message.

---

## 1. Goal

When the source is Codex, Statistics, Charts, and Optimize describe imported requests. They do not draw Cursor plan meters as zero. Run Optimize pastes a billing-only brief into the open Agent chat and does not submit it.

**Done when:**

- Codex Statistics hides Current/Today plan meters, burn rate, generated lines, and the monthly plan forecast.
- Token mix, counts, priced share, and side-by-side estimated API vs API-equivalent render from SQL aggregates.
- A reported-cost card renders only when a reported amount exists.
- Charts leave a gap on a day with no rows.
- Optimize hints are labeled as hypotheses. Projected savings are labeled forecast.
- `codex.analyze` builds the brief in the host and pastes it with `composer.focusComposer`. It does not call `composer.openComposer`.
- Cursor source still shows the current Statistics sections.

---

## 2. Out of scope

| Item | When |
|------|------|
| Persisted analysis runs and the Optimized chip match | phase 7 |
| Filling prices from a catalog | phase 4. Cards sum stored decimal strings and skip nulls. |
| A seventh tab | never |
| Reading the chat transcript | never |

`src/ui/historyPanel.ts` is in this phase for the `codex.analyze` branch only. Phase 3b left that branch as a fixed error so it could not fall through to Cursor optimize.

---

## 3. Files

```
src/openaiHistory/historyStats.ts
src/openaiHistory/historyCharts.ts
src/openaiHistory/optimizeBrief.ts
src/ui/historyPanel.ts
media/src/tabs/stats.js
media/src/tabs/optimize.js
media/src/charts/host.js
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
```

`historyPanel.ts`: replace the phase 3b `codex.analyze` error with the brief paste. Do not restyle the Cursor optimize path.

---

## 4. Statistics (`historyStats.ts`)

Input is the same filter as `codex.query` without paging. Output is a view model the webview can render without summing rows itself.

| Card | Rule |
|------|------|
| Token mix | Sums of input, cached input, output, reasoning. Skip nulls. Do not add C on top of I or R on top of O. |
| Counts | Model requests (`attributes_spend = 1`), distinct turns, conversations. |
| Priced share | `26/28` from coverage. |
| Estimated API and API-equivalent | Two numbers, side by side. Never one total. |
| Reported cost | Omit the card when every `reported_cost_usd` in the filter is null. |
| Cache hit | `sum(C) / sum(I)` where both are non-null on the same row. Not the mean of per-row ratios. |

Hide, do not zero: Current/Today plan meters, burn rate, generated lines, monthly plan forecast. The webview branches on `querySource === 'codex-local'` and does not call the Cursor meter renderers.

OpenAI `not-connected` keeps the empty sentence from phase 3c. No Cursor totals.

---

## 5. Charts (`historyCharts.ts`)

Daily tokens and daily estimated cost for the active filter. One point per local calendar day that has rows. A day with no rows is absent, so the chart has a gap. Do not insert a zero bar.

The webview reuses the daily SVG host. Codex passes its own series. It does not pass the Cursor forecast series.

---

## 6. Optimize

### Hints

Local hypotheses only, each line marked as a hypothesis:

- Input grew versus the previous attributed request in the same thread.
- Cache share is low (`sum(C) / sum(I)` under a fixed display threshold of **0.2**, or C is null — say “cache unknown”, do not say “low”).
- Many model requests in one turn (more than **4** attributed requests sharing a `turn_id`).

No projected dollar until phase 4 has a price. The forecast label still says forecast, and the number stays `—` when cost is null.

### Brief (`optimizeBrief.ts`)

```typescript
export function buildCodexOptimizeBrief(input: {
  depth: 'quick' | 'balanced' | 'deep'
  row: CodexDetailFields
  hints: readonly string[]
}): string
```

The string contains numbers, ids, model name, and the hypothesis lines. It has no prompt, no tool text, and no absolute path. Depth changes how many hint lines are included (quick: one, balanced: all, deep: all plus the token breakdown). It does not add transcript instructions that ask the agent to read the chat.

`historyPanel` pastes that string into the open Agent chat via `composer.focusComposer` and does not submit. Play on a Codex row uses the same brief for that row. It does not call `composer.openComposer`.

The `!` mark uses `isSpike` from `src/spikes/threshold.ts` with `cursorCost.spikeTokenThreshold`. The critical modal is not invoked on this path.

---

## 7. Tests

Add `test/openaiHistoryStats.test.ts` and `test/codexOptimizeBrief.test.ts`.

- Cache hit uses paired non-null rows only.
- Estimated and reported stay separate fields.
- A missing calendar day is absent from the series.
- The brief fixture’s prompt sentence is not in the output.
- The brief does not contain `composer.openComposer`.

`npm test` and `npm run build` once at the end.

---

## 8. Handoff

Phase 4 writes the decimal cost strings these cards already sum. The next message after this one, if catalogs fail to typecheck, is the other locales only — not phase 4 mixed into that message.
