# Summary of both approaches — Codex local history and OpenAI requests

**Background comparison.** Implement from [openai-codex.md](../openai-codex.md) · [Polish](../openai-codex.pl.md).
Shelf: [README.md](../README.md).

This file records how the two source plans were merged. It is not the implementation plan.

| Role | Document |
|---|---|
| Spec (product contract) | [cursor-cost-tracker-openai-requests-spec.md](../../../reports/cursor-cost-tracker-openai-requests-spec.md) |
| Approach A — repo-native shipping plan | [codex-openai-queries.md](./codex-openai-queries.md) · [Polish](./codex-openai-queries.pl.md) |
| Approach B — Codex / OpenAI engineering plan | [openai-codex-request-history-plan.md](./openai-codex-request-history-plan.md) · [Polish](./openai-codex-request-history-plan.pl.md) |
| Polish twin of this summary | [openai-codex-history-summary.pl.md](./openai-codex-history-summary.pl.md) |

**Status:** planned. Not started.
**Release:** **1.1.0** MINOR for phases 1–4 (local Codex, table, tokens, unknown cost, CSV). Phases 5–7 are later minors. Do not bump `package.json` inside a phase turn.
**Depends on:** the shipped Cursor pipeline (`UsageService` → `toHistoryRows` → `media/src/tabs/queries.js`). Leave that pipeline in place.
**Conflict:** [prd.md](../../../context/prd.md) wins. This feature does not change Cursor billing, the single blocking critical-alert modal, or the hidden Leaderboard tab.

One phase per Agent message. A phase names only the paths listed under that phase. Locales in a UI phase are `en` and `pl`. Other catalogs are the next message.

---

## 1. Verdict

**Approach A is the better plan to ship from.** It already fits this extension: one webview, Cursor numbers left alone, opt-in import, settings keys, a source switch that cannot leak into the status bar, and phases small enough for one Agent turn.

**Approach B is the better engineering spec** for the store, the byte reader, deduplication, money, privacy, and the gates that must stay closed until a later release. Several of A’s storage choices are wrong for this repo and are replaced below.

Implement from **this summary**. Do not pick one source file and ignore the other.

### What each approach got right

| Topic | Kept from | Why it wins |
|---|---|---|
| First release is local Codex only, useful with no API key | Both | Spec order: importer → table → recorder → organization comparison. |
| Cursor Last N, status bar, burn rate, forecast, critical modal, CSV stay on Cursor events | Both | A Codex row must not change Current, Today, or the `!` modal. |
| Opt-in import, dismissible “sessions found” hint, separate Codex settings | A | Scanning `~/.codex` on activate is a privacy surprise. B starts import at activation. |
| Source switch under the tab bar, ghost pills, CONTEXT column omitted, drawer, `9/10 priced`, coverage strip | A | Matches the existing panel and the screenshots’ information, without a second webview. |
| Open from Current / Today / a recent chip forces source **Cursor** for that open | B | Those controls are Cursor numbers. A persisted Codex source would hide the plan meters. |
| Persist `cursorCost.querySource` for later opens of the history panel | A | Someone working in Codex local should not reset on every panel reopen. |
| Namespace `src/openaiHistory/`, Codex parser under `codex/` | B | Phase 5 is a second source. `src/codex/` would strand the OpenAI recorder. |
| sql.js writer behind a store interface; atomic temp-file rename | B | `node:sqlite` in this repo opens Cursor’s DB **read-only**. Node 18 has no guaranteed `DatabaseSync`. The product forbids a native-only SQLite path. A’s “prefer DatabaseSync for writes” does not ship in 1.1.0. |
| Full 1.1.0 schema, lease, keyset pages, application-level dedup, decimal strings | B | Partial SQL unique indexes and offset cursors are weaker across sql.js and two IDE windows. |
| Absolute paths stay on the host. The strip says “this computer”, not the home path | B | A shows the path on the strip. The resolved directory belongs in the Settings card only. |
| Selectable **OpenAI API** chip with an explicit not-connected body | A, copy from B | A disabled chip hides the boundary. Statistics, Charts, and Optimize must not fall through to Cursor numbers. |
| `en` + `pl` in the webview phase; other catalogs later | A | B’s phase that edits all eleven catalogs in one turn fights the repo’s turn budget. |
| Docs (PRD, security, README, CHANGELOG, snapshot) land with the release that changes behavior | Merge | B’s phase 0 rewrites product docs before any code. Do not describe the feature as shipped until it is. |
| Play opens the Optimize tab. It does not call `composer.openComposer` | Both | A Codex thread id is not a Cursor composer id. |
| Run Optimize, on Codex, pastes a billing-only brief into the open Cursor Agent chat and does not submit | A, constrained by B | Same gesture as today’s Optimize. The brief has numbers and ids only. It is not a rerun and it contains no prompt or tool text. |
| Organization Usage/Costs only after a PRD and security amendment | B | 1.1.0 adds no `api.openai.com` client and no admin key. |
| Recorder is a sanitized JSONL sink the user’s app appends | A’s shape, B’s field ban | No `packages/` workspace, no TLS proxy, no local HTTP server in 1.1.0. |

### Rejected

- Guessing a Codex model’s API price from `src/pricing/` or from a similar name.
- Reading `auth.json`, cookies, or Codex login tokens to infer an account.
- Storing prompt, response, or tool text. 1.1.0 titles are `#` plus 8 characters of `thread_id`.
- Treating `history.jsonl`, `token_count`, `turn_token_usage`, or `thread_token_usage` as extra requests on top of `payload.usage`.
- One shared total of estimated API cost, reported organization cost, and ChatGPT-plan API-equivalent.
- A second blocking modal. Delete-imported-data is a two-step control in Settings.
- Virtualized 100k rows as a 1.1.0 merge gate. 1.1.0 paginates. The 500 ms warm-page figure is a phase 7 measurement target.
- App-server as the importer. Files are the backfill. App-server, later, is optional read-only titles, version-negotiated, and must not start or resume an agent.

---

## 2. Locked product decisions

These close the open questions at the end of approach B.

1. **One Codex root in 1.1.0.** Several roots are a later minor. Precedence: non-empty `cursorCost.codexHome`, else an absolute `CODEX_HOME` that exists and is a directory, else `~/.codex`.
2. **The root is a package setting.** `deviceId` is a random id created once in `globalState` (`cursorCost.codexDeviceId`). `sourceInstanceId` is a hash of the resolved realpath, not an account id and not a repo path.
3. **Import is off by default** (`cursorCost.codexImportEnabled` = false). While off, a cheap existence check may notice `sessions/` and show one dismissible line. File contents are read only after opt-in.
4. **No default model-to-price map.** Token history ships with COST `—`. A later manual map is labeled as a user assumption and can be removed without rewriting usage.
5. **Organization reporting stays out of the extension** until the PRD allows an opt-in `api.openai.com` admin client and the key lives in `context.secrets`. No new modal for the key.
6. **The Optimized chip on Codex** matches a saved analysis run only. Until phase 7 that set is empty. Cache hit alone is not “optimized”.
7. **Status bar stays Cursor.** No Codex chip in 1.1.0.
8. **Group label** is `4 turns · 28 model requests` when both counts exist. Snapshot-only files do not invent a request count.
9. **Unknown account** uses scope key `unknown-source:<sourceInstanceId>`. It is never the Cursor login email and never SQL NULL.
10. **Forks:** a copied `responseId` is one global request. The child conversation may link to it. Its own spend counts responses that first appear on that child.
11. **This computer.** The UI extension reads the machine where the UI host runs. A Remote SSH window does not scan the SSH host. The strip says so.

---

## 3. What 1.1.0 includes

- Discover one local Codex root and incrementally import `sessions/**/*.jsonl` and `archived_sessions/**/*.jsonl`.
- Persist normalized requests in `<ExtensionContext.globalStorageUri>/openai-request-history.sqlite`. Never write `~/.codex`, `state.vscdb`, or the workspace.
- Source switch **Cursor | Codex local | OpenAI API** on Last N, Statistics, Charts, and Optimize. Hidden on Support and Settings.
- Group by `(provider, accountScopeKey, conversationId)`, lazy children, safe detail drawer, filters, host-side sort, keyset pages, CSV of every matching request.
- Tokens when model, account, price, or billing mode is unknown. Missing numbers render as `—`.
- Codex Statistics, Charts, and read-only high-usage hints. Cursor sections stay as they are when Cursor is selected.

### Explicitly out of 1.1.0

| Item | When |
|---|---|
| JSONL sink for an app’s own OpenAI calls | Phase 5, later minor |
| `GET /v1/organization/usage/completions` and Costs API | Phase 6, after PRD/security approval |
| Codex app-server titles | Phase 7 optional, or its own minor. Files remain the backfill. |
| Stored Chat Completions backfill | Not scheduled |
| Personal ChatGPT website history | No source. Do not promise it. |
| TLS interception, Codex auth files, a second modal, status-bar Codex totals | Never in this feature |
| Merging two threads because the titles match | Never. Title grouping stays Cursor-only (`titleGroupKey`). |

---

## 4. Panel

Markup in `media/history.html`. Behavior in `media/src/`. Rebuild with `npm run build`. Do not hand-edit `media/history.js` or `media/history.css`.

### 4.1 Source switch

Segmented control **under the tab bar**, full width, visible on Last N, Statistics, Charts, and Optimize.

```
[ Last 1000 Cursor queries ] [ Statistics ] [ Charts ] [ Optimize ] [ Support ] [ Settings ]

Source   ( Cursor )  ( Codex local )  ( OpenAI API )
```

- Ghost pills. Not `--vscode-button-background`. `aria-pressed` on the selected source.
- Default `cursor`. Persisted as `cursorCost.querySource` (`cursor` | `codex-local` | `openai-api`).
- Current, Today, and a recent-query chip open the panel **on Cursor** and write `querySource` back to `cursor` for that navigation. The history command itself respects the saved source.
- Tab label follows the source: `Last N Cursor queries`, `Codex queries`, or `OpenAI API`.
- Switching source does not call the Cursor usage API.
- Toolbar **Refresh** posts `{ type: 'refresh' }` on Cursor, `{ type: 'codex.refresh' }` on Codex (rescan), `{ type: 'openai.refresh' }` on OpenAI API. Until phase 5 the OpenAI refresh returns the not-connected state.
- **OpenAI API** in 1.1.0 is selectable. Body copy: `OpenAI API recorder is not connected. This extension does not see other programs’ calls to OpenAI.` Statistics, Charts, and Optimize show that empty state. They do not reuse Cursor totals.

### 4.2 Coverage strip (Codex local)

One monospace line under the switch. Text only. Most severe variant wins.

| State | Line |
|---|---|
| Import off, `sessions/` exists | `Codex sessions found on this computer. Turn on import in Settings.` Dismissible. |
| Import off, nothing found | hidden |
| Import on, root missing | `Codex home not found` |
| Import on, root empty | `No local Codex history found` |
| Partial parser coverage | `Partial history · N unrecognized lines` |
| No account id in files | `account unknown` in the normal line. Not an error color. |
| Last rescan failed | `Sync failed · showing data from 18:02` and keep the previous rows |
| Remote window | prefix `This computer (not the SSH host) ·` |

Normal line shape:

`Local history · this computer · account unknown · 12 sessions · 7 Oct – 14 Oct · last sync 18:12`

The strip does not include the absolute Codex path. Settings shows the resolved directory.

### 4.3 Toolbar when Codex is selected

| Control | Behavior |
|---|---|
| Over Warn at | Client filter. A row matches when that **request’s** tokens, or the **group sum**, are ≥ `cursorCost.spikeTokenThreshold`. The `!` uses `isSpike`. The critical **modal** does not fire. |
| Optimized | Saved analysis id only. Hidden matches until phase 7. |
| Group by conversation | `cursorCost.codexGroupByConversation`, default **true**. Does not write `cursorCost.groupQueriesByConversation`. |
| Export CSV | `{ type: 'codex.exportCsv' }`. Flat requests, active filters, all pages. |
| Date | Presets: Last 7 days, This month, All imported, Custom. Custom From/To are local `YYYY-MM-DD`, half-open `[from, to)`, applied on Apply / Enter / blur. Empty custom range means the whole import. Does not read or write `cursorCost.historyFromDate`. |
| Account | All / Unknown / any discovered scope. Unknown is never remapped to the Cursor account. |
| Model | Models present under the other filters, plus Unknown. |
| Status | completed, failed, cancelled, incomplete, unknown. Unknown is normal. |
| Sort | Default time descending. `cost-desc` and `tokens-desc` run in the store. |

### 4.4 Table

Same shell: `.table-wrap`, horizontal scroll, sticky first column, monospace numbers, `--vscode-*` only.

**Cursor columns stay:** TIME, MODEL, CONTEXT, COST, TOKENS, INPUT / OUTPUT, KIND.

**Codex columns.** CONTEXT is omitted. Colspan follows the visible columns.

| Column | Flat request | Conversation group |
|---|---|---|
| chevron | none | button, `aria-expanded` |
| TIME | observation time, local zone in the tooltip | title or `#abcd1234`; `4 turns · 28 model requests`; activity `14 Oct 09:07 → 14 Oct 11:02` |
| MODEL | name, or `Unknown`. Tooltip: `response` or `turn context` | one model, or `Mixed (2)` |
| COST | `Est. $0.16`, `API-equiv. $0.16`, a reported amount, or `—`. `< $0.01` when the stored value is non-zero and rounds away at two places. | Sum of **one** basis. `9/10 priced` when coverage is partial. |
| TOKENS | `I + O`. `!` when warnings are on and the row is over Warn at. | Sum of unique requests in the filter. Play sits in this cell. |
| INPUT / OUTPUT | `15347 / 185`. Tooltip: cached input and reasoning. | Sums. Mark `partial` when any child lacks usage. |
| KIND | `API`, `ChatGPT plan`, `Unknown` | one kind, or `Mixed` |

Children are not in the first paint. The chevron posts `{ type: 'codex.expand', conversationId, accountScopeKey }`. Cursor expand stays index-based inside `queries.js` and must not post `codex.expand`.

Page size 100. Footer **Load more** uses an opaque keyset cursor `(sort tuple, id)`. Host clamps `limit` to 1–100. The Cursor `{ type: 'data' }` message does not grow a Codex array.

Equal titles never merge groups. A missing conversation id becomes its own short-id group, not one global Unknown bucket.

### 4.5 Detail drawer

Clicking a request opens a drawer **under the table**. Not a VS Code modal and not a new editor. Render with `textContent`.

- Source `Codex local`, device label, scope, confidence (`unknown` / `reported by file` / `assigned by you`)
- Conversation, session, turn, response id (masked in the sense of short display; full id allowed in the copy because it is not a secret)
- Usage quality and input, cached input, output, reasoning, total
- Cost basis, formula in words, pricing version, or `Price unavailable`
- Status and error **code** only
- Observed time. Started / finished only when the file has them. `observedAt` is not labeled as start.
- Copy details: the same plain-text fields

Enter on a focused row opens the drawer. Escape closes it. The chevron is a separate button.

### 4.6 Settings card

New **Codex** card in `#settingsView`, after **Recent queries** and before **Refresh**.

| Field | Key | Default |
|---|---|---|
| Import local Codex sessions | `cursorCost.codexImportEnabled` | false |
| Codex home | `cursorCost.codexHome` | `""` |
| Group Codex by thread | `cursorCost.codexGroupByConversation` | true |
| Query source | `cursorCost.querySource` | `cursor` |

Read-only lines: resolved directory, “this computer”, session count, date span, last scan, parser version `rollout-v1`, unrecognized-line count.

**Rescan** posts `codex.refresh`. **Delete imported data** is two-step: the button becomes “Delete imported Codex data — confirm”, and the second click posts `codex.forget`. That deletes extension-owned rows only.

No OpenAI admin-key field in 1.1.0.

### 4.7 Statistics, Charts, Optimize

**Cursor selected:** current sections, unchanged.

**Codex local selected:**

- Hide Current/Today plan meters, burn-rate card, generated-lines card, and the monthly **plan** forecast. Do not render them as zero.
- Four cards: token mix (input, cached input, output, reasoning); counts (model requests, turns, conversations); priced share (`26/28`); estimated API and API-equivalent side by side. A reported-cost card appears only when a reported amount exists. No card adds those amounts.
- Cache hit is `sum(cached input) / sum(input)` where both are non-null. Not the average of row percentages.
- Charts: daily token bars and daily estimated-cost bars from the Codex series. A day with no rows is a gap, not a confirmed zero. No Cursor forecast lines on this series.
- Optimize: hints for the selected Codex row, or the last row at or over Warn at — input growth versus the previous request in the same thread, low cache share, many model requests in one turn. Each line is a hypothesis. Projected savings stay labeled forecast. Findings do not read prompt text.
- **Play** selects that row and opens Optimize. It does not call `composer.openComposer` and it does not start a request.
- **Run Optimize** pastes a billing-only brief into the open Agent chat (`composer.focusComposer`) and does not submit.

---

## 5. Data model

New types in `src/openaiHistory/domain.ts`. Do not extend `UsageQuery`. A Cursor included-plan `$0` and a Codex unknown price are different facts.

```ts
type RequestSource = 'codex-local' | 'openai-api'
type AccountConfidence = 'source-reported' | 'user-assigned' | 'unknown'
type ModelEvidence = 'response' | 'turn-context' | 'requested' | 'unknown'
type BillingMode = 'api' | 'chatgpt-plan' | 'unknown'
type RequestStatus = 'completed' | 'failed' | 'cancelled' | 'incomplete' | 'unknown'
type UsageQuality = 'reported' | 'derived' | 'partial' | 'missing'
type CostCoverage = 'complete' | 'tokens-only' | 'partial' | 'unknown'
```

`TrackedRequest` follows spec section 6: identity, `accountScopeKey` (always non-empty), confidence, conversation / session / turn / response ids, times, model and evidence, billing mode, status, usage, quality, `estimatedApiCostUsd` and `reportedCostUsd` as decimal strings or null, `pricingVersion`, `costCoverage`, `parserVersion`. Origin `(sourceFileId, generation, byteOffset)` lives on the observation, not in the webview payload.

Null means unknown. Zero means a reported zero. Usage present does not set status to `completed`.

### Token and money rules

```text
I = input tokens, including cached
C = cached input, subset of I
O = output tokens, including reasoning
R = reasoning, subset of O
T = I + O
```

Do not compute `I + C + O + R`. When all four are present, validate `0 ≤ C ≤ I` and `0 ≤ R ≤ O`. If `total_tokens` disagrees, keep the raw numbers and set an anomaly flag. Do not rewrite them.

Cost, only when model, tier, and rates are known, via a fixed-scale bigint helper. Store the canonical decimal string. Round only in format and CSV.

```text
((I - C) × inputRate + C × cachedInputRate + O × outputRate) / 1_000_000
```

Fixture (fake rates, not a live tariff): I=100000, C=80000, O=10000, R=2000, rates 2 / 0.5 / 8 per million → **0.16**, T=110000. Reasoning is not a fourth term.

If `C` is null, do not substitute `0` and show one confident price. Show `—` or an explicit range. Unknown model or missing rate → `—`. Non-zero `cache_write_input_tokens` stays stored and unpriced. Do not copy rates from `src/pricing/listPrice.ts`.

`billingMode = chatgpt-plan`: `reportedCostUsd` stays null unless the file reports a charge. An explicit mapped API tariff is labeled **API-equivalent**. Do not divide a ChatGPT subscription by requests. A path under `.codex` does not by itself mean ChatGPT plan; otherwise KIND is `Unknown`.

### Tables in 1.1.0

File: `openai-request-history.sqlite` under global storage.

| Table | Purpose |
|---|---|
| `schema_migrations` | Ordered migrations. |
| `source_instances` | Root fingerprint, device id, last scan. Path is not an account. |
| `source_files` | Identity, generation, size, mtime, prefix fingerprint. Not sent to the webview. |
| `import_checkpoints` | File id, generation, byte offset, `partial_bytes`, parser context. |
| `conversations` | Scope, conversation id, optional parent, title, turn count, first/last time. No body. |
| `requests` | One deduped business request. Nullable usage and cost. |
| `request_observations` | Every origin. Unique on `(source_file_id, generation, byte_offset)`. |
| `usage_snapshots` | Cumulative counters. Never rendered as model requests. |

Later migrations, not created in phase 2: `pricing_versions` (phase 4), `http_attempts` (phase 5), `billing_buckets` (phase 6), `optimization_runs` (phase 7).

Uniqueness the application enforces even when the SQL build is weak:

```text
requests (provider, account_scope_key, response_id) when response_id is non-empty
request_observations (source_file_id, generation, byte_offset)
```

Indexes: `(source, account_scope_key, observed_at, id)`, `(conversation_id, observed_at, id)`, `(model, observed_at, id)`.

One lease in global storage. The second window reads the store and does not import. Writes are idempotent. A failed flush keeps the previous file and surfaces a sync error. Import batch and checkpoint commit together. Yield between batches. Do not await import in `activate()`.

`RequestStore` is an interface. 1.1.0 has one implementation: sql.js, migrate in memory, write a temp sibling, rename. A native writer can be measured later behind the same interface.

---

## 6. Importer

Modules under `src/openaiHistory/codex/`. Parser version **`rollout-v1`**. A new rollout shape gets its own version and an anonymized fixture.

### Discovery

Read-only. Enumerate regular files under `sessions/` and `archived_sessions/`. Do not follow a symlink that resolves outside the chosen root after `realpath`. `history.jsonl` is not usage. A missing root is `Codex home not found`, not a thrown activation error.

### Incremental read

- Checkpoint: file id, generation (size plus a bounded prefix fingerprint; a shrink or a same-size replacement starts a new generation), committed byte offset, parser context (session, turn, model), and `partial_bytes`.
- Read buffers from the offset. Decode only bytes up to the last `\n`. Keep the tail, including a split UTF-8 sequence.
- Offsets are bytes, not JavaScript string length.
- Cap line size. A malformed or unknown line increments the diagnostic counter and is not shown.
- Do not delete tracker rows because a log file disappeared.
- `fs.watch` is a hint, debounced 750 ms. A 30 s control scan is authoritative while import is on, including when the panel is closed. The scan stats first and reads dirty tails. Queue depth 1. Import off means no watcher and no scan of contents.

### Line mapping

| `type` | Action |
|---|---|
| `session_meta` | Fill session, thread, optional account ids. A repeat does not create another conversation. |
| `turn_context` | Remember model for that turn (`modelEvidence: turn-context`). Lower priority than a response-reported model. |
| `token_usage_record` | Request candidate from `payload.usage` only, plus ids. Line timestamp is `observedAt`. |
| `event_msg` with `token_count` | Snapshot or cross-check. Not a second request. |
| User, agent, tool, instruction text | Ignore the body. Do not persist it and do not use it as a title in 1.1.0. |
| Terminal error event | Set status only when the payload names the same response or turn. |
| Anything else | Skip. Increment unrecognized count. |

No model → `Unknown`, not the user’s current Codex default.

### Identity

Preferred key: `(provider = openai, accountScopeKey, responseId)`.

No `responseId`: provisional id `(sourceInstanceId, fileGeneration, byteOffset)`. A `token_usage_record` **with** `responseId` is one model request. The same response seen later from the API recorder is a second observation and the same request.

Do not dedupe by prompt text, token counts, timestamp, model, or title.

Cumulative snapshots only: store deltas as `derived` with a time span. A drop, reset, or missing baseline is a gap, not `max(delta, 0)`. When request-level rows cover that span, exclude the overlapping derived rows from sums.

---

## 7. Host contract

Add variants in `src/webview/messages.ts`. Do not overload Cursor `refresh` or `exportCsv`. Mirror the type strings in `media/src/messages.js`.

Webview → host:

- `setQuerySource` `{ value }`
- `codex.refresh`
- `codex.query` `{ correlationId, filterRevision, from, to, accountScopeKey, model, status, groupBy, sort, costBasis, cursor, limit }`
- `codex.expand` `{ correlationId, filterRevision, conversationId, accountScopeKey }`
- `codex.details` `{ correlationId, id }`
- `codex.exportCsv` — last query’s filters, all pages
- `codex.forget`
- `openai.refresh` — not-connected until phase 5
- `codex.analyze` `{ id }` — phase 7; until then the Optimize tab can render local hints without persisting a run

Host → webview, beside the current Cursor `data` message:

- `codex.status`
- `codex.result` `{ correlationId, filterRevision, rows, nextCursor, totals, coverage, lastSyncAt }`
- `codex.children`
- `codex.detail`
- `codex.exportReady` — host also opens the save dialog, same as Cursor CSV
- `operation.error` `{ correlationId, message }`

The webview drops a reply whose correlation id or filter revision is stale. The host rejects paths, SQL, URLs, secrets, and limits outside 1–100. Payload rows are the view model in §4.4, not the JSONL line and not the full `TrackedRequest`.

Query order: normalized requests → source, account, model, status, `[from, to)` → one cost basis → sort and keyset-page. Grouped mode aggregates in SQL, then pages groups. Totals come from SQL aggregates, not from the first page and not from the DOM. Time bounds use `src/time/` so a Warsaw DST day is not assumed to be 24 hours.

`HistoryPanel` gains a Codex router. `UsageService` remains the only owner of Cursor cookies and Cursor polling. `PanelPublisher` keeps publishing the Cursor payload only.

### CSV

`src/openaiHistory/exportCsv.ts`. Columns, in spec section 16 order. Decimal point `.`. Null → empty cell. Quote commas and newlines. If a title starts with `=`, `+`, `-`, `@`, or tab, prefix a single quote. No prompts, no secrets, no absolute paths. Conversation aggregates are a separate later action, not extra rows in this file. Request-file totals match the filtered SQL sums.

---

## 8. Phases

Each phase is one Agent turn: the files listed, Vitest for those files, one `npm test` and `typecheck` at the end. If a phase still feels wide, split on the lettered boundary and stop. Do not start the next letter in the same turn.

### Phase 1 — Parse and usage math

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

No `vscode` import. Fixtures are synthetic: session meta, turn context, `token_usage_record`, snapshot-only, malformed line, split JSON, split UTF-8, fork, unknown account, two models. No real rollout, no account id, no prompt.

Done when spec acceptance items 2, 3, 6 (token half: T=110000), 8 (parser emits both models), and 9 pass. Double import is a pure merge by response id.

### Phase 2a — Store

```
src/openaiHistory/store/types.ts
src/openaiHistory/store/migrations.ts
src/openaiHistory/store/sqlJsRequestStore.ts
src/openaiHistory/store/storeLease.ts
test/openaiHistoryStore.test.ts
```

Done when a restarted store returns the same totals, a failed flush does not advance the checkpoint, and two unknown source instances do not collapse.

### Phase 2b — Discover and import

```
src/openaiHistory/codex/sourceRoot.ts
src/openaiHistory/codex/discover.ts
src/openaiHistory/codex/importer.ts
src/openaiHistory/historyService.ts
test/codexSourceRoot.test.ts
test/codexImporter.test.ts
```

Done when a second import is a no-op, a shrunk or replaced file reimports without duplicates, a fork does not double the global sum, and unknown scope is `unknown-source:…`. Scheduler stays out of `extension.ts` until phase 3b. Tests use a temp directory and a fake clock.

### Phase 3a — Queries, rows, CSV, messages

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

Done when filters, Warsaw DST bounds, `Mixed (2)`, `9/10 priced`, keyset paging, and CSV formula-prefix pass without a webview.

### Phase 3b — Wire the host

```
src/extension.ts
src/ui/historyPanel.ts
src/config.ts
package.json
```

Register the service beside `UsageService`. Start it only when import is enabled. `activate()` does not wait on it. Settings keys from §4.6. Cursor publish path unchanged.

### Phase 3c — Queries webview

```
media/history.html
media/src/messages.js
media/src/tabs/queries.js
media/css/queries.css
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
```

`queries.css` only if the drawer or the source switch needs a rule. `npm run build` regenerates `media/history.js`. Done when the switch, strip, grouped table, lazy children, drawer, filters, empty states, CSV, and two-step delete work against the phase 2 database, and Cursor source still paints from `data.events`.

### Phase 3d — Statistics, Charts, Optimize for the source

```
src/openaiHistory/historyStats.ts
src/openaiHistory/historyCharts.ts
media/src/tabs/stats.js
media/src/tabs/optimize.js
media/src/charts/host.js
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
```

Other locale catalogs are the **next** message, then `npm run sync-i18n -- check` once.

### Phase 4 — Tariff

```
src/openaiHistory/pricing/decimal.ts
src/openaiHistory/pricing/types.ts
src/openaiHistory/pricing/catalog.ts
src/openaiHistory/pricing/calculate.ts
src/openaiHistory/pricing/coverage.ts
test/openaiHistoryPricing.test.ts
```

Done when the 0.16 fixture passes, missing rates stay `—`, ChatGPT-plan amounts are labeled API-equivalent, and rows keep `pricingVersion`. The live catalog may be empty. Ship 1.1.0 with honest `—` costs when tokens are right. No silent map onto `src/pricing`.

### Phase 5 — Recorder ingest (later minor)

Document and import a sanitized JSONL sink: `begin` / `finish` / `fail` with `logicalOperationId`, `attemptId`, local conversation and turn ids, requested and returned model, final usage, response id, status, safe error code. No API key, Authorization header, prompt, response text, tool arguments, or cookies. Streaming keeps the provider’s final usage object. An interrupted stream is `partial` or `missing`, not `$0`. A retry with a new response id is a new request. The OpenAI API chip then shows rows.

### Phase 6 — Organization comparison (later minor)

Blocked on a PRD/security edit that allows only the documented organization endpoints after opt-in. Admin key in Secret Storage. Manual refresh plus a 15-minute poll, re-fetch recent buckets, replace buckets, backoff on 429. Statistics shows local estimate and organization reported cost for the **same** org, project, time, model, and unit. Failure leaves local rows in place. Those dollars are not written onto requests and are not a ChatGPT plan balance.

### Phase 7 — Optimize runs and the warm-page measurement (later minor)

Persist an analysis record (time, range, rule version, status). Do not rewrite historical cost. The Optimized chip starts matching those ids. Measure the first warm page at 100,000 rows. The spec’s 500 ms is a target, not a claim. Optional app-server title enrichment is a separate change: negotiated schema, no process start, rollout title remains the fallback (`#` + short id).

---

## 9. Acceptance

| # | Rule | Phase |
|---|---|---|
| 1 | Second import does not change request count or sums | 2b |
| 2 | `token_usage_record` and `token_count` count once | 1 |
| 3 | Cumulative snapshots are not a fake request list | 1 |
| 4 | Forked copied response ids do not double global usage | 2b |
| 5 | Same title, two scopes, two groups. Unknown stays unknown across Cursor sign-in | 2b, 3a |
| 6 | 100000 / 80000 / 10000 / 2000 → T 110000 and 0.16 at the fake tariff | 1 and 4 |
| 7 | Missing tariff or usage is `—`. Partial group shows `9/10 priced` | 3a, 4 |
| 8 | Two models → `Mixed (2)`, not the last model on every row | 3a |
| 9 | Split JSONL line and split UTF-8 | 1 |
| 10 | Shrink, same-size replace, archive, restart | 2b |
| 11 | Interrupted stream is partial, not `$0` | 5 |
| 12 | New response id on retry is a new request; same id is not | 5 |
| 13 | Warsaw DST range does not drop or duplicate | 3a |
| 14 | CSV of all pages matches filtered sums and has no group rows | 3a |
| 15 | Secrets, prompt HTML, and CSV formulas stay non-executable | 1–3c |
| 16 | Admin sync error keeps local rows | 6 |
| 17 | Organization cost is not added to requests or to a ChatGPT plan | 6 |
| 18 | The webview receives a page, not the log and not 100k rows | 3a, 7 |
| 19 | `activate()` does not wait on discovery, import, or network | 3b |
| 20 | Current / Today / recent chips still publish the Cursor payload | 3b, 3d |

Manual check: one synthetic rollout in a temp root, plus one local session compared with its table and CSV on the maintainer’s machine. Do not commit that file.

Before the 1.1.0 merge: `npm run typecheck`, `npm test`, `npm run build`. `npm run sync-i18n -- check` after the catalog message. `npm run package` is its own message. Update PRD, architecture, security, README, CHANGELOG, and the codebase snapshot in that release turn, not before phase 1.

---

## 10. Files that stay Cursor-only

Do not route Codex rows through:

- `src/usage/types.ts` `UsageQuery`
- `src/usage/service.ts`, `api.ts`, `parse.ts`
- `src/pricing/listPrice.ts`
- `src/ui/historyRows.ts` `toHistoryRows`
- `src/ui/queryGroups.ts` `titleGroupKey`
- `src/ui/mtdPace.ts`, `src/burnRate/*`, `src/ui/criticalAlert.ts`
- `src/ui/exportCsv.ts` `buildQueriesCsv`
- Status bar builders

Shared, allowed: `src/format.ts` (add Codex formatters beside existing ones), `src/time/` day bounds, `src/spikes/threshold.ts` `isSpike` for the `!` mark, `src/webview/messages.ts` as the message union, `src/config.ts` for the new keys.

---

## 11. Security

- Read rollout files as data. Cap line size. Never execute strings from them.
- Do not open `auth.json`, session cookies, or Codex auth files to guess an account.
- Do not send the Cursor access token, a Codex token, or an OpenAI key to the webview, CSV, logs, `settings.json`, or `globalState`.
- Parser drops bodies. The schema has no prompt or tool-output columns.
- Titles and error codes render as text. CSV formula prefix as in §7.
- Absolute source paths stay in the host store’s file table and in the Settings card. Diagnostics hash them when a path must be logged.
- Importer paths stay inside the resolved root after `realpath`.
- 1.1.0 opens no new network client.
- Delete removes extension-owned data only, after the in-panel second click.
- Fixtures are synthetic. Real rollout files never enter the repository.
