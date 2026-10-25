# Codex local history and OpenAI requests

**Status:** planned. Not started.
**Release:** 1.1.0 for phases 1–4. Phases 5–7 are later minors. Do not bump `package.json` inside a phase turn.
**Baseline:** 1.0.7. `extensionKind` is `ui`. Node `>=18`. Writer is sql.js.

On conflict with the product requirements, the product requirements win. Cursor billing, the one blocking critical-alert modal, and the hidden Leaderboard stay as they are.

One phase per Agent message. Touch only the paths listed under that phase. UI strings in that phase are English and Polish. Other catalogs are the next message.

The shipped Cursor pipeline stays: `UsageService` → `toHistoryRows` → the queries tab. Codex rows never enter it.

---

## 1. Outcome

The history panel gains a source switch: **Cursor**, **Codex local**, **OpenAI API**.

Codex local shows conversations already stored in rollout files on this computer: title or short id, turns, model-request count, model, tokens, input/output, billing kind, and a cost only when a tariff is known. Expanding a conversation loads the model calls. Statistics, Charts, and Optimize follow the selected source.

OpenAI API is a second source for calls an application recorded itself. In 1.1.0 the chip is selectable and the body says the recorder is not connected. Organization usage and cost reports are a later comparison. They never become rows in the request table.

1.1.0 is done when:

- Importing one rollout twice does not change request count or cost.
- The request is `token_usage_record.payload.usage`. `turn_token_usage`, `thread_token_usage`, and `event_msg` / `token_count` are not added again.
- Missing price or usage renders as `—`.
- Cursor Last N, the status bar, burn rate, the monthly forecast, and Cursor CSV stay on Cursor events.
- No Codex auth file, API key, prompt, or tool output reaches the webview, CSV, logs, or settings.

---

## 2. Decisions

1. One Codex root. Precedence: non-empty `cursorCost.codexHome`, else absolute `CODEX_HOME` when it is an existing directory, else `~/.codex`.
2. Import is off until `cursorCost.codexImportEnabled` is true. While off, a directory check may notice `sessions/` and show one dismissible line. File contents are read only after opt-in.
3. `deviceId` is created once in `globalState` (`cursorCost.codexDeviceId`). `sourceInstanceId` is a hash of the resolved realpath.
4. Unknown account scope key is `unknown-source:<sourceInstanceId>`. It is never the Cursor email and never SQL NULL.
5. Known account scope key is `account:<opaque-id>`, confidence `source-reported`. A later hand assignment is `user-assigned` and is not rewritten when the Cursor account changes.
6. Titles in 1.1.0 are `#` plus 8 characters of `thread_id`. Message text is not stored.
7. Group label is `4 turns · 28 model requests` when both counts exist. Snapshot-only files do not invent a request count.
8. Groups key on `(provider, accountScopeKey, conversationId)`. Equal titles do not merge. A missing conversation id is its own short-id group.
9. A copied `responseId` on a fork is one global request. The child may link to it. The child’s own spend counts responses that first appear on that child.
10. Dedup key is `(provider = openai, accountScopeKey, responseId)`. The same response from a later recorder is a second observation and the same request. No dedup by prompt, tokens, time, model, or title.
11. No `responseId`: provisional id `(sourceInstanceId, fileGeneration, byteOffset)`. A `token_usage_record` with a `responseId` is one model request.
12. Status bar stays Cursor. No Codex chip in 1.1.0.
13. `cursorCost.querySource` persists. Current, Today, and a recent-query chip open the panel on Cursor and write the source back to `cursor`. The history command uses the saved source.
14. Codex grouping uses `cursorCost.codexGroupByConversation` (default true). It does not write `cursorCost.groupQueriesByConversation`.
15. Codex dates do not read or write `cursorCost.historyFromDate`.
16. The critical modal does not fire for Codex. The `!` mark uses the same Warn-at threshold.
17. Play on a Codex row opens Optimize for that row. It does not call `composer.openComposer`.
18. Run Optimize, when Codex is selected, pastes a billing-only brief into the open Agent chat and does not submit. The brief has numbers and ids. It has no prompt and no tool text.
19. The Optimized chip matches a saved analysis run. Until phase 7 it matches nothing. Cache hit is not “optimized”.
20. No default map from a Codex model name onto the Cursor price catalog. Token history ships with cost `—` when no tariff is stored.
21. `billingMode = chatgpt-plan` keeps `reportedCostUsd` null unless the file reports a charge. A mapped API tariff is labeled API-equivalent. A path under `.codex` does not by itself mean ChatGPT plan.
22. Estimated API cost, reported organization cost, and API-equivalent never share one total.
23. The UI extension reads the machine where the UI host runs. A Remote SSH window does not scan the SSH host.
24. Store file: `<globalStorageUri>/openai-request-history.sqlite`. Implementation is sql.js: migrate in memory, write a temp sibling, rename. `RequestStore` is the interface. Do not write `~/.codex`, `state.vscdb`, or the workspace.
25. Delete imported data is a two-step control in Settings. It deletes extension rows only.
26. 1.1.0 opens no network client. An admin key is not a setting. Organization endpoints wait for a product-requirements change and then live in `context.secrets`.
27. Parser version for this shape is `rollout-v1`.

---

## 3. Settings

Card **Codex** in the settings view, after Recent queries and before Refresh.

| Field | Key | Default |
|---|---|---|
| Import local Codex sessions | `cursorCost.codexImportEnabled` | false |
| Codex home | `cursorCost.codexHome` | `""` |
| Group Codex by thread | `cursorCost.codexGroupByConversation` | true |
| Query source | `cursorCost.querySource` | `cursor` |

Read-only: resolved directory, this computer, session count, date span, last scan, parser version, unrecognized-line count.

Rescan posts `codex.refresh`. Delete becomes “Delete imported Codex data — confirm”; the second click posts `codex.forget`.

---

## 4. Panel

Markup in `media/history.html`. Behavior in `media/src/`. Rebuild with `npm run build`. Do not hand-edit `media/history.js` or `media/history.css`.

### 4.1 Source switch

Under the tab bar, full width, on Last N, Statistics, Charts, and Optimize. Hidden on Support and Settings. Ghost pills, `aria-pressed`.

```
Source   ( Cursor )  ( Codex local )  ( OpenAI API )
```

Tab label: `Last N Cursor queries`, `Codex queries`, or `OpenAI API`.

Switching source does not call the Cursor usage API. Refresh posts `refresh` on Cursor, `codex.refresh` on Codex, `openai.refresh` on OpenAI API. Until phase 5, OpenAI refresh returns the not-connected state.

OpenAI API body: `OpenAI API recorder is not connected. This extension does not see other programs’ calls to OpenAI.` Statistics, Charts, and Optimize use that empty state. They do not show Cursor totals.

### 4.2 Coverage strip

One monospace line under the switch. Text only. The heaviest state wins. The absolute Codex path is not on this line.

| State | Line |
|---|---|
| Import off, `sessions/` exists | `Codex sessions found on this computer. Turn on import in Settings.` Dismissible. |
| Import off, nothing found | hidden |
| Import on, root missing | `Codex home not found` |
| Import on, root empty | `No local Codex history found` |
| Partial parser coverage | `Partial history · N unrecognized lines` |
| No account id | `account unknown` inside the normal line. Not an error color. |
| Last rescan failed | `Sync failed · showing data from 18:02`. Keep the previous rows. |
| Remote window | prefix `This computer (not the SSH host) ·` |

Normal line: `Local history · this computer · account unknown · 12 sessions · 7 Oct – 14 Oct · last sync 18:12`

### 4.3 Codex toolbar

| Control | Behavior |
|---|---|
| Over Warn at | Request tokens or the group sum ≥ `cursorCost.spikeTokenThreshold`. |
| Optimized | Saved analysis id only. |
| Group by conversation | The Codex setting. Off = flat model requests, newest first. |
| Export CSV | `codex.exportCsv`. Flat requests, active filters, all pages. |
| Date | Last 7 days, This month, All imported, Custom. Custom From/To are local `YYYY-MM-DD`, half-open `[from, to)`, applied on Apply / Enter / blur. Empty custom range means the whole import. |
| Account | All, Unknown, or a discovered scope. |
| Model | Models under the other filters, plus Unknown. |
| Status | completed, failed, cancelled, incomplete, unknown. |
| Sort | `time-desc` default. `cost-desc` and `tokens-desc` run in the store. |

### 4.4 Table

Cursor columns stay: TIME, MODEL, CONTEXT, COST, TOKENS, INPUT / OUTPUT, KIND.

Codex omits CONTEXT. Wide table, horizontal scroll, sticky first column, monospace numbers, theme tokens only.

| Column | Request | Group |
|---|---|---|
| chevron | none | `aria-expanded` |
| TIME | observation time; local zone in the tooltip | `#abcd1234` or a later title; `4 turns · 28 model requests`; `14 Oct 09:07 → 14 Oct 11:02` |
| MODEL | name or `Unknown`; tooltip `response` or `turn context` | one model, or `Mixed (2)` |
| COST | `Est. $0.16`, `API-equiv. $0.16`, a reported amount, or `—`. `< $0.01` when a non-zero stored value rounds away at two places. | One basis only. `9/10 priced` when coverage is partial. |
| TOKENS | `I + O`. `!` when warnings are on and the row is over Warn at. | Sum of unique requests in the filter. Play is in this cell. |
| INPUT / OUTPUT | `15347 / 185`. Tooltip: cached input and reasoning. | Sums. `partial` when any child lacks usage. |
| KIND | `API`, `ChatGPT plan`, `Unknown` | one kind, or `Mixed` |

Children load on expand: `{ type: 'codex.expand', conversationId, accountScopeKey }`. Cursor expand stays index-based and does not post `codex.expand`.

Page size 100. Load more uses keyset cursor `(sort tuple, id)`. Host clamps `limit` to 1–100. The Cursor `data` message does not gain a Codex array.

### 4.5 Drawer

A request click opens a drawer under the table. `textContent` only. Not a modal.

Source, device label, scope, confidence, conversation, session, turn, response id, usage quality, input, cached input, output, reasoning, total, cost basis, formula in words, pricing version or `Price unavailable`, status, error code, observed time. Started and finished only when the file has them. Copy details uses the same plain-text fields.

Enter opens the drawer. Escape closes it. The chevron is a separate button.

### 4.6 Statistics, Charts, Optimize

Cursor selected: current sections, unchanged.

Codex selected:

- Hide Current/Today plan meters, burn rate, generated lines, and the monthly plan forecast. Do not draw them as zero.
- Cards: token mix (input, cached input, output, reasoning); counts (model requests, turns, conversations); priced share (`26/28`); estimated API and API-equivalent side by side. A reported-cost card appears only when a reported amount exists.
- Cache hit is `sum(cached input) / sum(input)` where both are non-null.
- Charts: daily tokens and daily estimated cost. A day with no rows is a gap.
- Optimize hints: input growth versus the previous request in the same thread, low cache share, many model requests in one turn. Each line is a hypothesis. Projected savings are labeled forecast.

---

## 5. Numbers

```text
I = input, including cached
C = cached input, subset of I
O = output, including reasoning
R = reasoning, subset of O
T = I + O
```

Do not add `I + C + O + R`. When all four exist, require `0 ≤ C ≤ I` and `0 ≤ R ≤ O`. If `total_tokens` disagrees, keep the raw numbers and set an anomaly flag.

Money is a fixed-scale bigint, stored as a decimal string. Round only for the cell and for CSV.

```text
((I - C) × inputRate + C × cachedInputRate + O × outputRate) / 1_000_000
```

Fixture rates 2 / 0.5 / 8 per million, I=100000, C=80000, O=10000, R=2000 → **0.16**, T=110000.

Null cached input is not replaced with zero. Unknown model or missing rate is `—`. Non-zero `cache_write_input_tokens` is stored and unpriced. Usage present does not set status to `completed`. `observedAt` is not a start time.

Null means unknown. Zero means a reported zero.

---

## 6. Store

| Table | Holds |
|---|---|
| `schema_migrations` | version |
| `source_instances` | root fingerprint, device id, last scan |
| `source_files` | identity, generation, size, mtime, prefix fingerprint |
| `import_checkpoints` | file id, generation, byte offset, `partial_bytes`, parser context |
| `conversations` | scope, conversation id, parent, title, turn count, first and last time |
| `requests` | one deduped request, nullable usage and cost |
| `request_observations` | one origin per accepted line |
| `usage_snapshots` | cumulative counters, never shown as model requests |

Later migrations: `pricing_versions` (phase 4), `http_attempts` (phase 5), `billing_buckets` (phase 6), `optimization_runs` (phase 7).

Application uniqueness:

```text
requests (provider, account_scope_key, response_id) when response_id is non-empty
request_observations (source_file_id, generation, byte_offset)
```

Indexes: `(source, account_scope_key, observed_at, id)`, `(conversation_id, observed_at, id)`, `(model, observed_at, id)`.

One lease in global storage. A second window reads and does not import. Writes are idempotent. A failed flush keeps the previous file. An import batch and its checkpoint commit together. Yield between batches. `activate()` does not wait.

Origin stays on the observation. Absolute paths stay in `source_files` and on the Settings card. They are not in the webview payload.

Types live in `src/openaiHistory/domain.ts`. Do not extend `UsageQuery`.

```text
RequestSource        codex-local | openai-api
AccountConfidence    source-reported | user-assigned | unknown
ModelEvidence        response | turn-context | requested | unknown
BillingMode          api | chatgpt-plan | unknown
RequestStatus        completed | failed | cancelled | incomplete | unknown
UsageQuality         reported | derived | partial | missing
CostCoverage         complete | tokens-only | partial | unknown
```

---

## 7. Importer

Modules in `src/openaiHistory/codex/`. Read-only. Regular files under `sessions/` and `archived_sessions/`. Do not follow a symlink that resolves outside the root. `history.jsonl` is not usage. A missing root is `Codex home not found`.

Checkpoint stores file id, generation, byte offset, parser context (session, turn, model), and `partial_bytes`. Generation changes when the file shrinks or a bounded prefix fingerprint shows a same-size replacement. Read from the offset. Decode only through the last newline. Keep a split UTF-8 tail. Offsets are bytes. Cap line size. A bad or unknown line increments a counter and is skipped. Deleting a log file does not delete tracker rows.

`fs.watch` is a hint, debounced 750 ms. While import is on, a 30 s scan is authoritative, including with the panel closed. It stats first and reads dirty tails. Queue depth 1. Import off means no watcher and no content reads.

| Line | Action |
|---|---|
| `session_meta` | Fill session, thread, optional account ids. A repeat does not create a conversation. |
| `turn_context` | Model for that turn, evidence `turn-context`. A response-reported model wins. |
| `token_usage_record` | Candidate from `payload.usage` only. Line time is `observedAt`. |
| `event_msg` / `token_count` | Snapshot or cross-check. Not a second request. |
| User, agent, tool, instruction text | Drop the body. |
| Terminal error | Set status only when the payload names the same response or turn. |
| Anything else | Skip. Count it. |

No model → `Unknown`.

Snapshot-only files store deltas as `derived` with a time span. A drop, reset, or missing baseline is a gap. When request-level rows cover that span, derived rows leave the sums.

---

## 8. Host messages

Add variants in `src/webview/messages.ts`. Mirror the strings in `media/src/messages.js`. Do not overload Cursor `refresh` or `exportCsv`.

Webview → host: `setQuerySource`, `codex.refresh`, `codex.query`, `codex.expand`, `codex.details`, `codex.exportCsv`, `codex.forget`, `openai.refresh`, `codex.analyze`.

`codex.query` carries `correlationId`, `filterRevision`, `from`, `to`, `accountScopeKey`, `model`, `status`, `groupBy`, `sort`, `costBasis`, `cursor`, `limit`.

Host → webview, beside the Cursor `data` message: `codex.status`, `codex.result`, `codex.children`, `codex.detail`, `codex.exportReady`, `operation.error`.

`codex.result` carries `correlationId`, `filterRevision`, `rows`, `nextCursor`, `totals`, `coverage`, `lastSyncAt`.

The webview drops a stale correlation id or filter revision. The host rejects paths, SQL, URLs, secrets, and a limit outside 1–100. Rows are the view model in §4.4.

Query order: requests, then source, account, model, status, and `[from, to)`, then one cost basis, then sort and keyset page. Grouped mode aggregates in SQL, then pages groups. Totals are SQL aggregates. Day bounds go through `src/time/`.

`HistoryPanel` routes Codex messages. `UsageService` still owns Cursor cookies and Cursor polling.

CSV is `src/openaiHistory/exportCsv.ts`. One row per request, all matching pages. Decimal point `.`. Null is an empty cell. Quote commas and newlines. A title that starts with `=`, `+`, `-`, `@`, or tab gets a leading single quote. Columns: `source`, `device_id`, `account_scope`, `account_confidence`, `conversation_id`, `conversation_title`, `turn_id`, `response_id`, `observed_at_utc`, `model`, `model_evidence`, `status`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`, `total_tokens`, `estimated_api_cost_usd`, `reported_cost_usd`, `billing_mode`, `pricing_version`, `usage_quality`, `cost_coverage`. Conversation aggregates are a separate later export. Request-file totals match the filtered SQL sums.

---

## 9. Phases

Stop at the end of the phase. If a lettered phase is still too wide, do not start the next letter in the same turn.

Step-by-step files (types, behavior, tests) are indexed in [README.md](./README.md). This section stays the phase boundary. If a step file and this plan disagree, this plan wins.

| Phase | File |
|---|---|
| 1 | [phase-1-parse.md](./phase-1-parse.md) |
| 2a | [phase-2a-store.md](./phase-2a-store.md) |
| 2b | [phase-2b-import.md](./phase-2b-import.md) |
| 3a | [phase-3a-query.md](./phase-3a-query.md) |
| 3b | [phase-3b-host.md](./phase-3b-host.md) |
| 3c | [phase-3c-webview.md](./phase-3c-webview.md) |
| 3d | [phase-3d-stats.md](./phase-3d-stats.md) |
| 4 | [phase-4-pricing.md](./phase-4-pricing.md) |
| 5 | [phase-5-recorder.md](./phase-5-recorder.md) |
| 6 | [phase-6-organization.md](./phase-6-organization.md) |
| 7 | [phase-7-analysis.md](./phase-7-analysis.md) |

### Phase 1 — Parse and usage

```
src/openaiHistory/domain.ts
src/openaiHistory/ids.ts
src/openaiHistory/usage.ts
src/openaiHistory/codex/rolloutTypes.ts
src/openaiHistory/codex/rolloutParser.ts
src/openaiHistory/codex/byteReader.ts
test/openaiHistoryUsage.test.ts
test/codexRolloutParser.test.ts
test/codexByteReader.test.ts
test/fixtures/codex-rollouts/
```

No `vscode` import. Synthetic fixtures only: session meta, turn context, `token_usage_record`, snapshot-only, bad line, split JSON, split UTF-8, fork, unknown account, two models.

Done when a usage record and a token-count snapshot count once, snapshot-only input does not become a request list, T=110000 for the fixture counts, both models are emitted, and a split line plus split UTF-8 complete on the next chunk.

### Phase 2a — Store

```
src/openaiHistory/store/types.ts
src/openaiHistory/store/migrations.ts
src/openaiHistory/store/sqlJsRequestStore.ts
src/openaiHistory/store/storeLease.ts
test/openaiHistoryStore.test.ts
```

Done when restart returns the same totals, a failed flush does not advance the checkpoint, and two unknown source instances stay apart.

### Phase 2b — Import

```
src/openaiHistory/codex/sourceRoot.ts
src/openaiHistory/codex/discover.ts
src/openaiHistory/codex/importer.ts
src/openaiHistory/historyService.ts
test/codexSourceRoot.test.ts
test/codexImporter.test.ts
```

Done when a second import is a no-op, shrink and same-size replace do not duplicate, a fork does not double the global sum, and unknown scope is `unknown-source:…`. Tests use a temp directory. The scheduler stays out of `extension.ts`.

### Phase 3a — Query, rows, CSV, messages

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

Done when Warsaw DST bounds, `Mixed (2)`, `9/10 priced`, keyset paging, and the CSV formula prefix pass.

### Phase 3b — Host wire

```
src/extension.ts
src/ui/historyPanel.ts
src/config.ts
package.json
```

Register the service beside `UsageService`. Start it only when import is enabled. `activate()` does not wait. Cursor publish stays as it is.

### Phase 3c — Queries webview

```
media/history.html
media/src/messages.js
media/src/tabs/queries.js
media/css/queries.css
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
```

`queries.css` only when the switch or the drawer needs a rule. `npm run build` regenerates `media/history.js`.

Done when the switch, strip, groups, lazy children, drawer, filters, empty states, CSV, and two-step delete work, and Cursor still paints from `data.events`.

### Phase 3d — Statistics, Charts, Optimize

```
src/openaiHistory/historyStats.ts
src/openaiHistory/historyCharts.ts
media/src/tabs/stats.js
media/src/tabs/optimize.js
media/src/charts/host.js
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
```

Other locale catalogs are the next message.

### Phase 4 — Tariff

```
src/openaiHistory/pricing/decimal.ts
src/openaiHistory/pricing/types.ts
src/openaiHistory/pricing/catalog.ts
src/openaiHistory/pricing/calculate.ts
src/openaiHistory/pricing/coverage.ts
test/openaiHistoryPricing.test.ts
```

Done when the 0.16 fixture passes, missing rates stay `—`, ChatGPT-plan amounts are labeled API-equivalent, and rows keep `pricingVersion`. The live catalog may be empty. Ship 1.1.0 with `—` when the tokens are right.

### Phase 5 — Recorder

Import a JSONL sink the user’s app appends: `begin`, `finish`, `fail`. Fields: `logicalOperationId`, `attemptId`, local conversation and turn ids, requested model, returned model, final usage, response id, status, safe error code. No API key, Authorization header, prompt, response text, tool arguments, or cookies. Streaming stores the provider’s final usage. An interrupted stream is `partial` or `missing`. A retry with a new response id is a new request. The OpenAI API chip then shows rows.

### Phase 6 — Organization comparison

After the product requirements allow an opt-in admin client: key in Secret Storage, manual refresh, 15-minute poll, replace recent buckets, backoff on 429. Statistics shows the local estimate and the reported organization cost for the same org, project, time, model, and unit. A sync error leaves local rows. Those dollars are not written onto requests and are not a ChatGPT plan balance.

### Phase 7 — Analysis runs

Persist time, range, rule version, and status. Do not rewrite historical cost. The Optimized chip matches those ids. Measure the first warm page at 100,000 rows; 500 ms is the target to measure. Optional app-server titles are a separate change: negotiated schema, no process start, fallback title stays `#` plus the short id.

---

## 10. Acceptance

| # | Rule | Phase |
|---|---|---|
| 1 | Second import does not change count or sums | 2b |
| 2 | Usage record and token-count snapshot count once | 1 |
| 3 | Cumulative snapshots are not a request list | 1 |
| 4 | Forked response ids do not double global usage | 2b |
| 5 | Same title, two scopes, two groups. Unknown stays unknown | 2b, 3a |
| 6 | Fixture counts → T 110000 and 0.16 | 1, 4 |
| 7 | Missing tariff or usage is `—`. Partial group shows `9/10 priced` | 3a, 4 |
| 8 | Two models → `Mixed (2)` | 3a |
| 9 | Split JSONL line and split UTF-8 | 1 |
| 10 | Shrink, same-size replace, archive, restart | 2b |
| 11 | Interrupted stream is partial, not `$0` | 5 |
| 12 | New response id is a new request; the same id is not | 5 |
| 13 | Warsaw DST range does not drop or duplicate | 3a |
| 14 | CSV of all pages matches filtered sums and has no group rows | 3a |
| 15 | Secrets, prompt HTML, and CSV formulas stay non-executable | 1–3c |
| 16 | Admin sync error keeps local rows | 6 |
| 17 | Organization cost is not added to requests or to a ChatGPT plan | 6 |
| 18 | The webview receives one page | 3a, 7 |
| 19 | `activate()` does not wait on import or network | 3b |
| 20 | Current, Today, and recent chips still publish the Cursor payload | 3b, 3d |

Manual check uses a synthetic rollout in a temp root, plus one local session compared with its table and CSV. Do not commit that session.

Before the 1.1.0 merge: `typecheck`, `test`, `build`. Catalog parity check after the extra-locale message. Package is its own message. Product requirements, architecture, security, README, changelog, and the codebase snapshot update in the release turn.

---

## 11. Leave these on the Cursor path

- `src/usage/types.ts`, `service.ts`, `api.ts`, `parse.ts`
- `src/pricing/listPrice.ts`
- `src/ui/historyRows.ts` `toHistoryRows`
- `src/ui/queryGroups.ts` title grouping
- `src/ui/mtdPace.ts`, `src/burnRate/*`, `src/ui/criticalAlert.ts`
- `src/ui/exportCsv.ts` `buildQueriesCsv`
- Status bar builders

Shared: `src/format.ts`, `src/time/`, `isSpike` in `src/spikes/threshold.ts`, `src/webview/messages.ts`, `src/config.ts`.

---

## 12. Security

Read rollout lines as data. Cap the line. Do not execute them. Do not open Codex auth files or cookies to guess an account. Do not send the Cursor token, a Codex token, or an OpenAI key to the webview, CSV, logs, settings, or `globalState`. The schema has no prompt or tool-output columns. Render titles and error codes as text. Keep importer paths inside the resolved root. Delete removes extension data only, after the second click. Fixtures are synthetic.
