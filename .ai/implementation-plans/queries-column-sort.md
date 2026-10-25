# Query sheet — sort by column header

**English canonical.** Polish: [queries-column-sort.pl.md](./queries-column-sort.pl.md)
**Parent:** [feedback-2026-10-25.md](./feedback-2026-10-25.md)
**Status:** not started. Do not schedule ahead of an open bug.
**Depends on:** Last N rows (`src/ui/historyRows.ts`) and conversation groups (`src/ui/queryGroups.ts`). Grouping itself is shipped.
**Version:** unset.

If this file and [prd.md](../context/prd.md) disagree, **the PRD wins**.

The ask: on the query sheet, click a header to sort. It works in the flat list and in the grouped list. Export CSV follows that order.

Checked 2026-10-25: the Cursor table headers in `media/history.html` are plain `<th>` text. `buildQueriesCsv` (`src/ui/exportCsv.ts`) always sorts newest first and ignores the sheet. Codex already has a sort dropdown (`#codexSort`) and `codex.exportCsv` already receives `sort`. This plan is the Cursor sheet. Codex header-click parity is out of the first slice.

---

## 1. Goal

Clicking TIME, MODEL, CONTEXT, COST, TOKENS, INPUT / OUTPUT, or KIND reorders the rows on screen. A second click flips the direction. The active header exposes `aria-sort`.

- **Flat:** every visible request follows that key.
- **Grouped:** group rows follow that key on the **group** totals. Expanding a group lists its requests by the same key. Grouping stays title-based (`titleGroupKey`). Sort does not regroup.
- **Export CSV** writes the same request order. It stays one row per request, including when the sheet is grouped. It does not become one row per conversation.

**Done when:**

- One comparator in `src/ui/querySort.ts`, Vitest for flat order, group order, and the flattened CSV order.
- The sheet and `buildQueriesCsv` call that comparator. They do not each invent a sort.
- Default with no click remains newest first, which is today’s order.
- Command-palette export with the panel closed stays newest first.
- Over Warn at, Optimized, and Hide CLI threads stay view filters. CSV still exports the sample those filters do not narrow. Only the **order** changes. That is what “respects sorting” asked for.

---

## 2. Keys

Rows today carry formatted strings (`cost`, `tokens` with a leading `!`). Do not sort by those strings. Add numeric fields next to the labels on `HistoryRow` and on `QueryGroupPayload`:

| Header | Request key | Group key |
|--------|-------------|-----------|
| TIME | `timestamp` | newest `timestamp` in the group |
| MODEL | model label | the label already on the group row |
| CONTEXT | context percent, missing last | the group’s context percent (newest turn, already on the payload) |
| COST | `costUsd` | sum of `costUsd` |
| TOKENS | `tokens` | sum of `tokens` |
| INPUT / OUTPUT | `inputTokens`, then `outputTokens` | same sums |
| KIND | kind label | the label already on the group row |

Tie-break, always: newer `timestamp` first, then the original sample index. Sort is stable across a refresh that does not change the sample.

First click on a number or time column sorts descending (largest / newest). First click on MODEL or KIND sorts ascending. The next click flips.

Sort lives in the open panel’s memory. It is not a `cursorCost.*` setting and it does not survive reload. Reloading returns to newest first.

---

## 3. Export

The toolbar Export is a `command:` link, so the host never sees the click order. Change the toolbar control so the webview posts `{ type: 'exportCsv', sort }` with `{ key, dir }`. The host allowlist stays `cursorCost.exportCsv` for the command palette.

`saveQueriesCsv` applies `sortQueryRows` before the existing cap. Grouped mode: order groups with `sortQueryGroups`, then flatten each group’s requests with the same key. The file is still flat.

Palette invocation, or a missing `sort`, keeps `timestamp` descending.

Codex export already passes its dropdown value. Do not retune Codex in this slice.

---

## 4. Files

| Phase | Paths |
|-------|--------|
| 1. Core + Vitest | `src/ui/querySort.ts`, `test/querySort.test.ts`. `buildQueriesCsv` takes an optional sort and uses the helper. |
| 2. Wire | Numeric fields in `src/ui/historyRows.ts` and `src/ui/queryGroups.ts`. Header buttons in `media/history.html` (Cursor `<thead>` only). Click handling in `media/src/tabs/queries.js`. `exportCsv` message in `src/webview/messages.ts` and `src/ui/historyPanel.ts`. `en` + `pl` aria labels only. |

Phase 1 does not edit `media/`. Do not hand-edit `media/history.js`; `npm run build` regenerates it in the wire turn.

Paint still happens in `paintRows` / `paintGroupedRows`. Sort the in-memory `tableEvents` / `tableGroups` before paint. Do not reorder the DOM by moving `<tr>` nodes after the fact.

---

## 5. Out of scope

| Item | Why |
|------|-----|
| Persisting the column in settings | Session sort is enough. A setting is a second product. |
| CSV limited to Over Warn at / Optimized rows | Those filters stay on-screen. Export scope stays the sample. |
| One CSV row per group | Current contract is a flat request list. |
| Codex header buttons | Dropdown + `codex.exportCsv` `sort` already agree. |
| Sorting Statistics, Charts, or the model-pricing table | The model table already sorts on its own. |
| Multi-column sort (Shift-click) | One column. |

---

## 6. Tests

- Time desc is the identity order of a newest-first sample.
- Cost desc puts a $0 row after a billed row. Equal cost falls through to time.
- A formatted `! 1.2M` token label is never the sort key.
- Two groups: the group with the higher token **sum** comes first even if its newest request is older.
- Flattened CSV order equals group order, then child order. Child order uses the same key, not “newest inside the group” unless the key is TIME.
- Unknown `key` / `dir` from the webview is rejected and the host sorts by time desc.
