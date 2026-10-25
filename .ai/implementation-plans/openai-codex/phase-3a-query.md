# Phase 3a — Query, rows, CSV, messages

**Parent:** [openai-codex.md](./openai-codex.md)
**Status:** ready to implement
**Depends on:** [phase-2a-store.md](./phase-2a-store.md) (read path). Import fixtures may be inserted with `applyBatch` directly.
**Next:** [phase-3b-host.md](./phase-3b-host.md)
**Polish:** [phase-3a-query.pl.md](./phase-3a-query.pl.md)
**Release:** 1.1.0. Do not bump `package.json`.

If this file and the parent plan disagree, **the parent plan wins**. If either disagrees with the PRD, **the PRD wins**.

One Agent message. Touch only the paths in §3. No webview edits.

---

## 1. Goal

Turn store rows into one page of view models, plus a CSV of every matching page. Add host/webview message variants without overloading Cursor `refresh` or `exportCsv`.

**Done when:**

- A Warsaw DST range does not drop or duplicate a row (acceptance 13).
- Two models in one group render `Mixed (2)` (acceptance 8).
- Nine priced requests out of ten render `9/10 priced` (acceptance 7, label half; prices may be fixture strings already on the row).
- Keyset paging returns a stable `nextCursor` and does not repeat an id.
- CSV of all pages matches the filtered SQL sums, has no group rows, and prefixes a title that starts with `=`, `+`, `-`, `@`, or a tab with a single quote (acceptance 14 and 15).
- `npm test` is green for the three new test files.

---

## 2. Out of scope

| Item | When |
|------|------|
| `extension.ts`, panel routing | phase 3b |
| HTML / CSS | phase 3c |
| Computing a price from a tariff | phase 4. This phase prints a cost string already stored, or `—`. |
| Cursor `toHistoryRows` | do not edit |

---

## 3. Files

```
src/openaiHistory/historyQuery.ts
src/openaiHistory/historyRows.ts
src/openaiHistory/historyGroups.ts
src/openaiHistory/historyDetails.ts
src/openaiHistory/exportCsv.ts
src/webview/messages.ts
test/openaiHistoryQuery.test.ts
test/openaiHistoryExportCsv.test.ts
test/webviewMessages.test.ts
```

Day bounds go through `src/time/`. Import it. Do not rewrite it.

---

## 4. Query (`historyQuery.ts`)

```typescript
export type CodexQuery = {
  correlationId: string
  filterRevision: number
  from: string | null
  to: string | null
  accountScopeKey: string | null
  model: string | null
  status: RequestStatus | null
  groupBy: 'conversation' | 'none'
  sort: 'time-desc' | 'cost-desc' | 'tokens-desc'
  costBasis: 'estimated-api' | 'reported' | 'api-equivalent'
  cursor: string | null
  limit: number
}

export function parseCodexQuery(input: unknown): CodexQuery | { error: string }
```

Reject a limit outside **1–100** (clamp is not enough: return `error`). Reject `cursor`, filter strings, or ids that contain a path separator, a SQL comment, a URL scheme, or look like a secret (`sk-`, `Bearer `, a JWT-shaped string). The SQL itself uses bound parameters only.

Order of operations: requests that `attributes_spend = 1` for the grouped conversation, then `source`, account, model, status, then half-open `[from, to)` on `observed_at`, then one `costBasis`, then sort and keyset page.

`from` / `to` are local `YYYY-MM-DD`. Empty means no bound. Convert with `src/time/` so the Warsaw spring-forward and fall-back days stay half-open in absolute time. A local time that does not exist is not invented. A repeated local hour on the fall-back day is included once.

`costBasis` selects which stored money column is sorted and totaled. It does not add estimated, reported, and API-equivalent into one number. Null money sorts last on `cost-desc`.

Keyset cursor is an opaque string of the sort tuple plus `id`. The next page starts strictly after that tuple. Grouped mode aggregates in SQL, then pages groups.

```typescript
export type CodexPage = {
  correlationId: string
  filterRevision: number
  rows: CodexRow[]
  nextCursor: string | null
  totals: CodexTotals
  coverage: CodexCoverage
  lastSyncAt: string | null
}
```

`totals` are SQL aggregates for the whole filter, not the page. `coverage` includes `priced`, `pricedDenom`, `missingUsage`, `missingAccount`, `partial`.

Derived snapshot rows are excluded from request totals. When a conversation has any `attributes_spend = 1` request in a span, snapshot rows in that span do not add tokens to the totals.

---

## 5. Rows and groups

`historyRows.ts` maps one request to the flat view model. `historyGroups.ts` maps one aggregated group.

Shared shape used by the webview in phase 3c:

| Field | Request | Group |
|-------|---------|-------|
| `rowKind` | `'request'` | `'group'` |
| `id` | request id | `provider + accountScopeKey + conversationId` |
| `timeLabel` | observation time, local | `#` + 8 characters, or the stored title |
| `timeTitle` | local zone name | `4 turns · 28 model requests` when both counts exist. Omit a missing count. Snapshot-only: no invented request count. |
| `rangeLabel` | — | `14 Oct 09:07 → 14 Oct 11:02` |
| `modelLabel` | name, or `Unknown` | one model, or `Mixed (2)` |
| `modelTitle` | `response` or `turn context` | — |
| `costLabel` | `Est. $0.16`, `API-equiv. $0.16`, a reported amount, or `—` | One basis only. `9/10 priced` when `priced < pricedDenom`. |
| `tokensLabel` | `I + O` via existing token format, or `—` | Sum of unique attributed requests in the filter. |
| `spike` | tokens ≥ threshold argument | group sum ≥ threshold |
| `inputOutputLabel` | `15347 / 185` | Sums. Suffix `partial` when any child lacks usage. |
| `inputOutputTitle` | cached input and reasoning when present | — |
| `kindLabel` | `API`, `ChatGPT plan`, `Unknown` | one kind, or `Mixed` |
| `conversationId`, `accountScopeKey` | for expand | for expand |

`< $0.01` when a non-zero stored decimal rounds away at two places. Do not display `$0.00` for that case.

`historyDetails.ts` returns the drawer fields as plain strings: source, device label (`this computer`), scope, confidence, conversation, session, turn, response id, usage quality, I, C, O, R, T, cost basis, formula in words, pricing version or `Price unavailable`, status, error code, observed time. `started` and `finished` only when the columns are non-null. No HTML. No absolute path.

---

## 6. CSV (`exportCsv.ts`)

```typescript
export function buildCodexCsv(rows: readonly CodexCsvSourceRow[]): string
```

The query walks every matching page. One output row per request. No group rows.

Decimal point `.`. Null is an empty cell. Quote commas and newlines. A title that starts with `=`, `+`, `-`, `@`, or a tab gets a leading single quote.

Columns, in order: `source`, `device_id`, `account_scope`, `account_confidence`, `conversation_id`, `conversation_title`, `turn_id`, `response_id`, `observed_at_utc`, `model`, `model_evidence`, `status`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`, `total_tokens`, `estimated_api_cost_usd`, `reported_cost_usd`, `billing_mode`, `pricing_version`, `usage_quality`, `cost_coverage`.

No absolute path, no prompt, no error message body beyond `error` not in this column list. `error_code` stays out of the CSV in 1.1.0 (the drawer has it). Device id is the opaque installation id, not a hostname.

---

## 7. Messages (`src/webview/messages.ts`)

Add variants. Do not change the meaning of `refresh` or `exportCsv`.

Webview → host:

| `type` | Payload |
|--------|---------|
| `setQuerySource` | `value: unknown` (host accepts `cursor` \| `codex-local` \| `openai-api`) |
| `setCodexImportEnabled` | `value: unknown` |
| `setCodexHome` | `value: unknown` |
| `setCodexGroupByConversation` | `value: unknown` |
| `codex.refresh` | none |
| `codex.query` | the `CodexQuery` fields |
| `codex.expand` | `conversationId`, `accountScopeKey` |
| `codex.details` | `requestId` |
| `codex.exportCsv` | the filter without `cursor` / `limit` |
| `codex.forget` | none |
| `openai.refresh` | none |
| `codex.analyze` | optional `requestId`, `conversationId`, `depth` |

Host → webview, as a separate union the panel already posts (add the variants next to the Cursor `data` message, do not add a Codex array onto `data`):

| `type` | Payload |
|--------|---------|
| `codex.status` | import flag, root state, partial flag, unrecognized count, session count, date span, `lastSyncAt`, parser version, account list, model list, `remoteWindow`. `resolvedHome` is included for the Settings card only. |
| `codex.result` | `CodexPage` |
| `codex.children` | `conversationId`, `accountScopeKey`, `rows` |
| `codex.detail` | drawer fields |
| `codex.exportReady` | `{ correlationId, ok }` |
| `operation.error` | `{ correlationId?, message }` with a fixed safe sentence, not a raw exception |

`parseWebviewMessage` (or the existing parser in this file) must accept the new types and reject a `codex.query` that fails `parseCodexQuery`.

Settings setters are the same shape as `setHistoryLimit`. The parent’s operation list did not name them; the Settings card cannot persist without them.

---

## 8. Tests

### `test/openaiHistoryQuery.test.ts`

- Seed rows around Europe/Warsaw spring-forward and fall-back. A `[from, to)` that covers each transition returns each row once.
- Group with models `a` and `b` → `Mixed (2)`.
- 9 rows with a cost string and 1 with null, basis `estimated-api` → label contains `9/10 priced`. The summed money is the sum of the 9, not a fake tenth.
- Page size 2 over 5 rows → cursors do not repeat ids and the union is the full set.
- Same title, two `account_scope_key` values → two groups.
- Filter `status` and `model` change the SQL aggregate, not only the page.

### `test/openaiHistoryExportCsv.test.ts`

- All pages match the filtered sums.
- No group header row.
- Title `=cmd` becomes `'=cmd`.
- Null usage is an empty cell.
- A prompt-like string is not a column and is absent from the CSV.

### `test/webviewMessages.test.ts`

- `codex.query` with `limit: 0` and `limit: 500` is rejected.
- `codex.query` whose `accountScopeKey` contains `../` or `sk-` is rejected.
- Cursor `refresh` still parses as refresh, not as `codex.refresh`.

---

## 9. Handoff

Phase 3b routes these messages. It does not rebuild the SQL.
