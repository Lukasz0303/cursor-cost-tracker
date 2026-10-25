# Implementation plan — Codex local history and OpenAI requests

**Background.** Implement from [openai-codex.md](../openai-codex.md) · [Polish](../openai-codex.pl.md).
Shelf: [README.md](../README.md).

**English canonical of this input.** Polish: [codex-openai-queries.pl.md](./codex-openai-queries.pl.md)
**Status:** superseded as a standalone plan. Kept as an input to the summary.
**Spec:** [cursor-cost-tracker-openai-requests-spec.md](../../../reports/cursor-cost-tracker-openai-requests-spec.md) (2026-10-07).
**Depends on:** shipped Cursor pipeline (`UsageService` → `toHistoryRows` → `media/src/tabs/queries.js`). Do not rewrite it.
**Version:** **1.1.0** MINOR for phases 1–4 (Codex local, table, tokens, unknown cost, CSV). Phases 5–7 are later minors. Do not bump `package.json` inside a phase turn.
**Packaged baseline:** **1.0.7**.

If this file and [prd.md](../../../context/prd.md) disagree, **the PRD wins**. This feature does not change Cursor billing, the single blocking critical-alert modal, or the hidden Leaderboard tab.

One phase per Agent message. A phase names at most the paths listed under that phase. Do not paste Optimize Deep into the same chat.

---

## 1. Goal

Show **Codex — OpenAI’s coding agent** sessions that already exist on this computer, in the same panel as Cursor queries, without pretending they are Cursor usage.

The user opens the history panel, switches the source from **Cursor** to **Codex local**, and sees conversations from `~/.codex` rollout files: title, turn count, model-request count, model, tokens, input/output, billing kind, and a cost only when a tariff is known. Expanding a conversation lists recognized model calls. Statistics, Charts, and Optimize follow the selected source. **OpenAI API** is a second source for calls an app recorded itself. Organization Usage and Costs APIs are a separate comparison, never a line in the request table.

**Done for 1.1.0 when:**

- A rollout imported twice does not increase request count or cost.
- `token_usage_record.payload.usage` is the request. `turn_token_usage`, `thread_token_usage`, and `event_msg` / `token_count` are not added again.
- Missing price or usage renders as `—`, never `$0.00` or `0` tokens.
- Cursor Last N, status bar, burn rate, monthly forecast, and CSV stay on Cursor events only.
- No Codex auth file, API key, prompt, or tool output reaches the webview, CSV, logs, or settings.

---

## 2. What the spec asks, mapped onto this repo

The spec’s module tree (`src/providers/…`, `src/webview/openaiHistoryView.ts`) does not exist. The extension already has one webview (`media/history.html`, entry `media/src/main.js`) and one in-memory Cursor sample. Fit the feature into that shape.

| Spec need | What the code does today | Decision |
|---|---|---|
| Source switch Cursor / Codex / OpenAI API | One queries table fed by `UsageQuery[]` | Add a source switch. Cursor keeps the current payload. Codex and OpenAI API use a new payload. |
| Conversation groups with expand | `src/ui/queryGroups.ts` groups the **already loaded** sample by **normalized title**. Expand uses `rowIndexes` in the webview. | Keep that for Cursor. Codex groups by `(source, accountScope, conversationId)` and loads children from the database on expand. |
| Per-request usage, cache subset, reasoning subset | `UsageQuery.tokens` plus `queryListPrice`, which **adds** cache-read and cache-write on top of input and output | New normalizer. Codex total is `input + output`. Cache is a subset of input. Reasoning is a subset of output. Do not call `queryListPrice`. |
| Unknown vs zero | `costUsd: number` — `0` is a real Cursor included-plan zero | Codex money and token fields are `number \| null`. `null` is unknown. |
| Local SQLite for a large history | sql.js / `node:sqlite` only **read** Cursor `state.vscdb`. Tracker state is `globalState` and memory. | New database file in extension global storage. Never write `~/.codex` or `state.vscdb`. |
| Incremental JSONL import | No file watcher on Codex | New importer. `activate()` only schedules it. |
| Pricing | `src/pricing/` is the Cursor public catalog | Separate Codex tariff table. No automatic rename of a Codex model onto an API model. |
| Optimize play button | `composer.openComposer` with a **Cursor** conversation id, then paste | Codex play opens the analysis for that row. It does not open a Cursor composer with a Codex thread id and it does not start a paid rerun. |
| Organization usage vs local rows | Cursor summary is the Cursor plan | Later phase. Never added into `usedUsd`, MTD forecast, or the request cost column. |
| CSV | `buildQueriesCsv` in `src/ui/exportCsv.ts` | New builder. Cursor export unchanged. |
| Account | Cursor email from the usage API, not sent as a secret to the webview beyond the PRD | Codex account stays unknown unless rollout metadata reports an id. Do not read Codex auth files. Do not copy the Cursor email onto Codex rows. |

---

## 3. Locked product decisions

1. **Codex local is the first release.** OpenAI API recording and organization reports ship later. The source chip for OpenAI API is visible in 1.1.0 and explains that nothing is connected.
2. **Import is off by default** (`cursorCost.codexImportEnabled` = false). Scanning `~/.codex` is opt-in. If `sessions/` exists and import is off, the queries toolbar shows one dismissible line: “Codex sessions found on this computer.” Turning it on is a settings switch, not a modal.
3. **Status bar stays Cursor.** Current, Today, recent chips, burn tint, and the critical modal read `UsageSnapshot` only. Codex does not add a status-bar chip in 1.1.0.
4. **No new tab and no React.** Support and Settings ignore the source switch. Leaderboard stays hidden and is not a Codex ranking.
5. **One blocking modal remains** the last Cursor query critical alert. Delete-imported-data is a two-step control inside Settings, not `showWarningMessage`.
6. **Extension kind is `ui`.** The importer reads the computer where the UI extension runs. The coverage line says so. A Remote SSH window does not automatically see Codex files on the SSH host.
7. **Titles are metadata, not prompts.** Prefer a Codex thread title when a later adapter has one. Otherwise the first real user message **text is not stored**; 1.1.0 uses `#` + 8 characters of `thread_id`. Environment instruction blocks are never titles.
8. **Group label** is `4 turns · 28 model requests`, not `4 requests`, when both counts exist. Snapshot-only files do not invent a request count.
9. **Costs of different kinds never share one total.** Estimated API, reported organization cost, and ChatGPT-plan API-equivalent stay in separate figures.
10. **Forks:** a copied `responseId` stays one global request. The child conversation may link to it. Its own spend counts only responses that first appear on that child.

---

## 4. Out of scope for 1.1.0

| Item | When |
|---|---|
| Wrapper that records another app’s OpenAI calls | Phase 5 |
| `GET /v1/organization/usage/completions` and Costs API | Phase 6 |
| Codex app-server `thread/list` (titles, live events) | After 1.1.0, optional. Files remain the backfill. |
| Stored Chat Completions backfill | Not scheduled |
| Personal ChatGPT website history | No source. Do not promise it. |
| TLS interception, Codex login cookie, auth.json | Never |
| Codex rows on the status bar, in burn rate, or in the Cursor monthly forecast | Not in 1.1.0 |
| Merging two Codex threads because the titles match | Never. That rule is Cursor-only (`titleGroupKey`). |
| Virtualized 100k-row benchmark as a merge gate | Phase 7 target. 1.1.0 must paginate, not render the whole table. |

---

## 5. Where it appears

The panel is the existing `WebviewPanel` `cursorCost.history`. Markup lives in `media/history.html`. Behavior lives in `media/src/` (rebuild `media/history.js` with `npm run build`). Do not hand-edit `media/history.js`.

### 5.1 Source switch

Place a segmented control **under the tab bar**, full width of the panel, visible only while **Last N**, **Statistics**, **Charts**, or **Optimize** is active. Hidden on Support and Settings.

```
[ Last 1000 Cursor queries ] [ Statistics ] [ Charts ] [ Optimize ] [ Support ] [ Settings ]

Source   ( Cursor )  ( Codex local )  ( OpenAI API )
```

- Ghost pills, same family as the existing switches. Not `vscode-button-background`.
- `Cursor` is selected by default. Persisted as `cursorCost.querySource` (`cursor` | `codex-local` | `openai-api`).
- The queries tab label follows the source: `Last N Cursor queries` or `Codex queries` or `OpenAI API`.
- `OpenAI API` in 1.1.0 is selectable. The view body is the empty state in §5.6, not a fake table.

Switching source repaints from data the host already has or from a new `codex.result`. It does not call the Cursor usage API. The toolbar **Refresh** on Cursor still posts `{ type: 'refresh' }`. On Codex it posts `{ type: 'codex.refresh' }` (rescan). On OpenAI API it posts `{ type: 'openai.refresh' }` and, until phase 5, returns the not-connected state.

### 5.2 Coverage strip (Codex local only)

Directly under the source switch, one monospace line, text only:

`Local history · this computer · account unknown · 12 sessions · 7 Oct – 14 Oct · last sync 18:12`

Variants, one at a time, most severe wins:

| State | Line |
|---|---|
| Import off, sessions exist | `Codex sessions found on this computer. Turn on import in Settings.` |
| Import off, nothing found | hidden |
| Import on, folder missing | `Codex home not found · <path>` |
| Import on, folder empty | `No local Codex history found` |
| Partial parser coverage | `Partial history · N unrecognized lines` |
| No account id in files | `account unknown` (this is normal, not an error color) |
| Last rescan failed | `Sync failed · showing data from 18:02` and keep the previous rows |
| Remote window | prefix `This computer (not the SSH host) ·` |

No HTML from file paths beyond escaping. Paths are shown because the user set them.

### 5.3 Queries toolbar when Codex is selected

Keep the existing `view-actions` row. Change what the controls mean:

| Control | Codex behavior |
|---|---|
| Over Warn at | Client filter on rows whose **request** tokens, or the **group sum**, are ≥ `cursorCost.spikeTokenThreshold`. The `!` uses the same threshold as Cursor. The critical **modal** does not fire for Codex. |
| Optimized | Rows with a saved Codex analysis id. Cache hit alone is not “optimized”. |
| Group by conversation | Separate setting `cursorCost.codexGroupByConversation`, default **true**. Off = flat model requests, newest first. On = one row per thread. Does not write `cursorCost.groupQueriesByConversation`. |
| Export CSV | `{ type: 'codex.exportCsv' }`. Flat requests for the active filters, all pages. |

Add a second filter row, Codex only, under `view-actions`:

`From` `To` (local `YYYY-MM-DD`, half-open `[from, to)`), `Account` (All / Unknown / any discovered scope), `Model`, `Status` (completed, failed, cancelled, incomplete, unknown).

Date fields apply on Apply / Enter / blur, same reason as Show last: partial typing must not query. Empty From+To means the imported range, not 1 Sep 2026 and not the Cursor `historyFromDate` window. Cursor From–To stays on the Cursor sample only.

### 5.4 Table

Same wide table shell: `.table-wrap`, horizontal scroll, sticky first column, monospace numbers, theme tokens only.

**Cursor columns stay:** TIME, MODEL, CONTEXT, COST, TOKENS, INPUT / OUTPUT, KIND.

**Codex columns** (CONTEXT is omitted — there is no Cursor composer window meter):

| Column | Flat request | Conversation group |
|---|---|---|
| (chevron) | none | button, `aria-expanded`, left of TIME |
| TIME | observation time, local, with zone in the tooltip; id in the details | title or `#abcd1234`; second line `4 turns · 28 model requests`; third line `14 Oct 09:07 → 14 Oct 11:02` |
| MODEL | model name, or `Unknown`. Tooltip: `response` or `turn context` | one model, or `Mixed (2)` |
| COST | `Est. $0.16`, `API-equiv. $0.16`, reported amount, or `—`. Tooltip names the basis. `< $0.01` when the stored value is non-zero and rounds to nothing at two places. | Sum of **one** basis. If 9 of 10 are priced: `$1.20 · 9/10 priced`. Never a bare sum that looks complete. |
| TOKENS | `I + O`. `!` when over Warn at and warnings are on. | Sum of unique requests in the filter. Play control sits in this cell. |
| INPUT / OUTPUT | `15347 / 185`. Tooltip: cached input and reasoning. | Sums. Mark `partial` when any child lacks usage. |
| KIND | `API`, `ChatGPT plan`, `Unknown` | one kind, or `Mixed` |

Group row background uses the existing grouped-row treatment. Expanded children are indented one level and use a quieter row background. Children are not in the first paint: the chevron posts `{ type: 'codex.expand', conversationId, accountScopeId }` and the host returns that page. Cursor expand stays index-based inside `queries.js` and must not call `codex.expand`.

Sort: time descending by default. Optional cost and token sorts are host-side (`time-desc` | `cost-desc` | `tokens-desc`) so a 100k store is not sorted in the webview. Page size 100. A footer `Load more` uses `nextCursor`. Do not ship the whole result in the `{ type: 'data' }` Cursor message.

### 5.5 Request details

Clicking a Codex request row opens a **drawer under the table** (not a VS Code modal, not a new editor). Contents are text:

- Source `Codex local`, device label, account scope, confidence (`unknown` / `reported by file` / `assigned by you`)
- Conversation, session, turn, response id
- Usage quality and the four numbers: input, cached input, output, reasoning, plus total
- Cost basis, formula in words (`uncached input × rate + cached input × cached rate + output × output rate`), pricing version, or `Price unavailable`
- Status, error code only (no HTML, no stack pasted from the log)
- Observed time. Started / finished only when the file actually has them. `observedAt` is not labeled as start.
- Copy details (plain text, same fields as the drawer)

Keyboard: Enter on a focused row opens the drawer, Escape closes it, chevron is a separate button so Enter does not also toggle the group.

### 5.6 Empty and partial states

Shown in `#empty` / the coverage strip. They replace the table body only when there are no rows to show.

- `No local Codex history found` — directory readable, zero sessions.
- `Partial history` — unknown line types, gaps, or snapshot-only usage. The table may still list derived rows, labeled `derived`, and must not call them model requests.
- `Account unknown` — import works. Not a blocker.
- `Price unavailable` — tokens present, `estimatedApiCostUsd` null. COST column `—`.
- `Sync failed · showing data from …` — keep rows.
- `No matching requests` — filters excluded everything. Coverage strip stays.
- OpenAI API before phase 5: `OpenAI API recorder is not connected. This extension does not see other programs’ calls to OpenAI.`

Missing numbers stay blank. They are never coerced to zero.

### 5.7 Settings

New card **Codex** in `#settingsView`, after **Recent queries** and before **Refresh** (`media/history.html` around the `settings.recentQueries` fieldset).

| Field | Key | Default | Notes |
|---|---|---|---|
| Import local Codex sessions | `cursorCost.codexImportEnabled` | false | Off skips the watcher. |
| Codex home | `cursorCost.codexHome` | `""` | Empty resolves `CODEX_HOME`, then `~/.codex`. |
| Group Codex by thread | `cursorCost.codexGroupByConversation` | true | Independent of the Cursor title toggle. |
| Query source | `cursorCost.querySource` | `cursor` | Also written by the segmented control. |

Read-only lines in the card: resolved directory, “this computer”, session count, date span, last scan, parser version, unrecognized-line count.

Buttons: **Rescan** (`codex.refresh`), **Delete imported data** (two-step: the button becomes “Delete imported Codex data — confirm”, second click posts `codex.forget`). Deleting tracker rows does not delete `~/.codex`.

OpenAI admin key is **not** a 1.1.0 field. Phase 6 adds it through `context.secrets`, never `settings.json` and never the webview.

### 5.8 Statistics, Charts, Optimize when the source changes

**Cursor selected:** current sections, unchanged. Host keeps sending `stats`, `charts`, `mtd`, `burnRate`, `codeLines`, `optimize` from the Cursor sample.

**Codex local selected:**

- Statistics hides Current/Today plan meters, burn-rate card, generated-lines card, and monthly **plan** forecast. Those numbers are Cursor billing.
- Statistics shows four cards: token mix (input, cached input, output, reasoning), counts (model requests, turns, conversations), priced share (`26/28`), and two cost cards side by side (estimated API, API-equivalent). A third card appears only when a reported cost exists. No card adds those amounts together.
- Cache hit is `sum(cached input) / sum(input)` on rows where both are non-null. It is not the average of row percentages.
- Charts reuse the daily SVG bars with a Codex series: tokens per local day, estimated cost per day. A day with no rows is a gap, not a zero-height “confirmed zero”. No Cursor forecast lines on this series.
- Optimize shows findings for the last Codex row at or over Warn at: input growth versus the previous request in the same thread, low cache share, many model requests in one turn. Each line is a hint. Projected savings stay labeled forecast. Run copies a brief into the open Cursor Agent chat the same way as today (`composer.focusComposer`) and does **not** submit. The red play control selects that Codex row and opens the Optimize tab; it does not call `composer.openComposer`.

**OpenAI API selected (1.1.0):** the three tabs show the not-connected empty state. They do not fall through to Cursor numbers.

### 5.9 What the user should understand at a glance

Every Codex cost cell answers three questions in the tooltip: where the tokens came from (rollout file), which clock they use (observed time, local zone), and whether the money is an estimate, an API-equivalent of a ChatGPT plan, a reported charge, or unknown. The coverage strip answers whose computer and which account scope.

---

## 6. Data model

New types in `src/codex/types.ts`. Do not extend `UsageQuery` in `src/usage/types.ts`. A Cursor included-plan `$0` and a Codex unknown price are different facts; one number cannot hold both.

Tracked request fields follow the spec contract (section 6 of the report): identity, account scope and confidence, conversation / session / turn / response ids, times, model and `modelEvidence`, `billingMode`, status, usage, `usageQuality`, `estimatedApiCostUsd` and `reportedCostUsd` as decimal strings or null, `pricingVersion`, `costCoverage`, origin `(fileId, byteOffset)`, `parserVersion`.

Extra entities, same database:

- `conversations` — scope, conversation id, optional parent, title, turn count
- `observations` — one row per accepted log line, unique on `(sourceInstanceId, fileGeneration, byteOffset)`
- `usage_snapshots` — cumulative counters only; never shown as model requests
- `import_checkpoints` — file id, generation, byte offset, parser context (session, turn, model)
- `pricing_versions` — phase 4
- `billing_buckets` — phase 6, not joined into request cost

`deviceId` is a random id created once in `globalState` (`cursorCost.codexDeviceId`). `sourceInstanceId` is a hash of the resolved Codex home, not an account id and not a repo path.

Account scope: when the file has no account id, the scope key is `unknown:` + `sourceInstanceId`, never SQL NULL and never the Cursor login email. A hand assignment (later) is `user-assigned` and is not rewritten when the Cursor account changes.

---

## 7. Token and money rules

Normal form for OpenAI-shaped usage:

```text
I = input tokens, including cached
C = cached input, subset of I
O = output tokens, including reasoning
R = reasoning, subset of O
T = I + O
```

Do not compute `I + C + O + R`. Validate `0 ≤ C ≤ I` and `0 ≤ R ≤ O` when all four are present. If `total_tokens` disagrees, keep the raw numbers and set an anomaly flag. Do not silently rewrite them.

Cost, only when model, tier, and rates are known:

```text
((I - C) × input + C × cachedInput + O × output) / 1_000_000
```

Fixture (fake rates, not a live tariff): I=100000, C=80000, O=10000, R=2000, rates 2 / 0.5 / 8 per million → **0.16**, T=110000. Reasoning does not add a fourth term.

If `C` is null, do not substitute `0` and then show a single confident price. Show `—` or a range. Unknown model or missing rate → `—`. Non-zero `cache_write_input_tokens` stays stored and **unpriced** until an adapter documents it. Do not copy Cursor cache-write rates from `src/pricing/listPrice.ts`.

`billingMode = chatgpt-plan`: `reportedCostUsd` stays null unless the file reports a charge. An API tariff, if explicitly mapped, is labeled **API-equivalent**, not invoice. Do not divide a monthly ChatGPT subscription by requests. A path under `.codex` does not by itself mean ChatGPT plan; otherwise KIND is `Unknown`.

Store more than two decimal places. Round only in `format` for the cell.

---

## 8. Importer

### 8.1 Discovery

`src/codex/discover.ts` (pure, given `homedir` and `env`):

1. `cursorCost.codexHome` when non-empty.
2. Else `CODEX_HOME`.
3. Else `~/.codex`.

Scan `sessions/**/*.jsonl` and `archived_sessions/**/*.jsonl`. `history.jsonl` may supply a title later; it is not usage. Read-only. Ignore files that are not regular files.

### 8.2 Read

`src/codex/import.ts` plus `src/codex/jsonl.ts`:

- Checkpoint stores file id, generation (size + inode or content hash when the file shrinks), committed byte offset, and parser context.
- Read from the offset. Accept only complete lines ending in `\n`. Keep a short byte tail for a split UTF-8 sequence. Offsets are bytes, not JavaScript string length.
- One transaction: observations + requests + checkpoint.
- Shrink or replace → new generation, re-import, dedupe. Do not delete tracker rows because the log disappeared.
- Debounce filesystem events 750 ms. Safety scan every 30 s while import is on and the panel is open or a scan is already dirty. Queue depth 1. Never await this in `activate()`.
- Second window: a lock file or `globalState` lease with a stale timeout. Writes are idempotent either way.

### 8.3 Line mapping

| `type` | Action |
|---|---|
| `session_meta` | Fill session, thread, optional account ids. A repeat does not create another conversation. |
| `turn_context` | Remember model for that turn (`modelEvidence: turn-context`). |
| `token_usage_record` | Request candidate from `payload.usage` only, plus ids and the line timestamp as `observedAt`. |
| `event_msg` with `token_count` | Snapshot or cross-check. Not a second request. |
| User message | Turn counter only. Do not persist the text in 1.1.0. |
| Terminal error event | Set status only when the payload clearly names the same response or turn. Usage present ≠ `completed`. |
| Anything else | Skip. Increment unrecognized count. |

Model on the response, when a later source has it, replaces turn-context. No model → `Unknown`, not the user’s current Codex default.

### 8.4 Identity

Preferred key: `(provider, accountScope, responseId)`.

No `responseId`: id is `(sourceInstanceId, fileGeneration, byteOffset)` and `usageQuality` cannot be `reported` as a confirmed single call unless the line type itself is `token_usage_record` **and** it carries a response id. A `token_usage_record` **with** `responseId` is one model request.

Same response seen in a rollout and, later, the API recorder: two observations, one request.

Do not dedupe by prompt text, token counts, or timestamp.

Cumulative snapshots only: store deltas as `derived` with a time span. A drop, reset, or missing baseline is a gap, not `max(delta, 0)`. When request-level rows exist for that span, exclude the overlapping derived rows from sums.

---

## 9. Storage

File: `<ExtensionContext.globalStorageUri>/codex-history.sqlite`. Not the workspace, not `~/.codex`.

`engines.node` is `>=18`. `node:sqlite` `DatabaseSync` is already the preferred **reader** for Cursor’s DB and is not always present. Plan:

- If `DatabaseSync` can open a file read-write, use it.
- Else sql.js: apply the transaction in memory and write the file atomically (`write temp + rename`). Document that the 100k target waits on `node:sqlite` if the export path is too slow. The UI must stay correct either way.

Indexes as in the spec: unique `(scope_id, response_id)` where response id is non-empty; unique observations; `(source, account_scope_id, observed_at)`; `(conversation_id, observed_at)`; `(model, observed_at)`. Schema version table. Migration runs before the first import in a process.

Queries for the panel: filter, dedupe, group, aggregate, sort, limit — in SQL. The webview never receives the log.

---

## 10. Host ↔ webview

Add variants to `src/webview/messages.ts`. Do not overload `refresh` or `exportCsv` (those stay Cursor).

Webview → host:

- `setQuerySource` `{ value }`
- `codex.refresh`
- `codex.query` `{ from, to, accountScopeId, model, status, groupBy, sort, costBasis, cursor, limit }`
- `codex.expand` `{ conversationId, accountScopeId }`
- `codex.details` `{ id }`
- `codex.exportCsv` (same filters as the last query, all pages)
- `codex.forget`
- `codex.analyze` `{ id }` — phase 7; 1.1.0 may no-op with an empty finding list

Host → webview, in addition to the current `data` message:

- `codex.status` `{ enabled, resolvedHome, machineLabel, sessionCount, from, to, lastSyncAt, lastError, unrecognizedLines, parserVersion, accountKnown }`
- `codex.result` `{ correlationId, rows, groups, nextCursor, totals, coverage }`
- `codex.children` `{ correlationId, conversationId, rows }`
- `codex.detail` `{ correlationId, detail }`
- `codex.exportReady` — host also opens the save dialog, same as Cursor CSV
- `operation.error` `{ correlationId, message }`

Each query carries `correlationId`. The webview drops a late reply whose id is not current. Host clamps `limit` to 1–200. Payload rows are the view model in §5.4, not `TrackedRequest` and not the JSONL line.

Cursor `{ type: 'data' }` does not grow a Codex event array.

---

## 11. CSV

`src/codex/csv.ts`. Columns as in spec section 16, in that order. Decimal point `.`. Null → empty cell, not `0`. Quote commas and newlines. If a title starts with `=`, `+`, `-`, `@`, or tab, prefix a single quote. No prompts, no secrets.

Conversation aggregates are a second export action, not extra rows under the request export. Totals of the request file must match the filtered request sums on screen.

---

## 12. Phases

Each phase is one Agent turn: the files below, Vitest for that phase, one `npm test` and `typecheck` at the end. Locales: `en` and `pl` only in the phase that adds strings. Other catalogs are a later message.

### Phase 1 — Parse and normalize

```
src/codex/types.ts
src/codex/jsonl.ts
src/codex/parseRollout.ts
src/codex/usage.ts
test/codexParse.test.ts
test/fixtures/codex/*.jsonl
```

Done when acceptance items 1–4, 6, 8, 9 from the spec’s section 20 pass on synthetic fixtures (double import is a pure function here: parse twice, merge by response id). No `vscode` import.

### Phase 2 — Discover, store, import

```
src/codex/discover.ts
src/codex/store.ts
src/codex/import.ts
src/codex/identity.ts
test/codexImport.test.ts
```

Done when a second import is a no-op, a split line completes on the next chunk, a shrunk file reimports without duplicates, unknown account is not the string `null`, and a copied response id on a fork does not double the global sum. Still no webview.

Wire the scheduler only in phase 3 (`src/extension.ts`), so this phase stays unit-testable with a fake clock and a temp directory.

### Phase 3 — Panel

```
src/webview/messages.ts
src/ui/codexRows.ts
src/extension.ts
media/history.html
media/src/tabs/queries.js
```

If that set is too wide for one turn, split **3a** host (`messages.ts`, `codexRows.ts`, `extension.ts`) and **3b** webview (`history.html`, `queries.js`, and `media/css/base.css` only if a drawer rule is required).

Settings card and `package.json` contribution keys belong to **3a**. Strings: `src/i18n/catalogs/en.ts` and `pl.ts` in **3b** only.

Done when the switch, coverage strip, grouped table, lazy children, drawer, filters, empty states, CSV, and delete-imported-data work against the phase 2 database. Cursor source still paints from `data.events` / `queryGroups`. `npm run build` regenerates `media/history.js`.

### Phase 4 — Tariff

```
src/codex/pricing.ts
src/codex/tariff.ts
test/codexPricing.test.ts
```

Done when the 0.16 fixture is covered, missing rates stay `—`, ChatGPT-plan amounts are labeled API-equivalent, and historical rows keep `pricingVersion`. No silent map from a Codex model name to `src/pricing` catalog rows. Ship 1.1.0 even if every live model is `—`, as long as tokens are right.

### Phase 5 — OpenAI API recorder ingest (later minor)

The extension cannot see other processes. Phase 5 adds an **opt-in ingest file** the user’s app appends (JSONL of begin/finish/fail), normalized into the same `TrackedRequest` with `source: openai-api`. Document the wrapper shape from spec section 9. Streaming usage is the final usage object only. Transport failure is not cost zero. A retry with a new response id is a new request. No TLS proxy. The source chip then shows real rows instead of the not-connected state.

### Phase 6 — Organization comparison (later minor)

Admin key in Secret Storage. Manual refresh plus 15-minute poll, re-fetch recent buckets, replace buckets, backoff on 429. Statistics shows `local estimate` and `organization reported` for the **same** org, project, time, model, and unit. Failure leaves local rows in place. Those dollars are not written onto requests and are not a ChatGPT plan balance.

### Phase 7 — Optimize hints and scale (later minor)

Rules in `src/codex/optimize.ts`: input growth, repeated context size, low cache share, many calls per turn. Persist an analysis record (time, range, rule version, status). Do not rewrite historical cost to “show savings”. Pagination and a measured first page from a warm database are the performance bar (spec’s 500 ms is a target, not a claim).

---

## 13. Acceptance tests (owner)

| # | Rule | Phase | Test |
|---|---|---|---|
| 1 | Second import does not change sums | 2 | `codexImport.test.ts` |
| 2 | `token_usage_record` and `token_count` count once | 1 | `codexParse.test.ts` |
| 3 | Cumulative snapshots are not a fake request list | 1 | `codexParse.test.ts` |
| 4 | Fork with copied response ids does not double global usage | 2 | `codexImport.test.ts` |
| 5 | Same title, two account scopes, two groups; unknown ≠ current Cursor account | 2 and 3 | `identity` + `codexRows` |
| 6 | 100000 / 80000 / 10000 / 2000 → T 110000 and 0.16 at the fake tariff | 1 and 4 | `usage` + `pricing` |
| 7 | Missing tariff or usage is `—`; partial group shows `9/10 priced` | 3 and 4 | `codexRows` |
| 8 | Two models → `Mixed (2)` | 3 | `codexRows` |
| 9 | Split JSONL line and split UTF-8 | 1 | `jsonl` |
| 10 | Shrink, rotate, archive, restart | 2 | `codexImport` |
| 11 | Interrupted stream is partial, not `$0` | 5 | recorder fixture |
| 12 | New response id on retry is a new request; same id is not | 5 | recorder fixture |
| 13 | Warsaw DST range does not drop or duplicate | 3 | query bounds via `src/time/` |
| 14 | CSV all pages matches filtered sums, no group rows | 3 | `codex/csv.ts` |
| 15 | Secrets, prompt HTML, CSV formulas | 1–3 | title/error fixtures; csv prefix |
| 16 | Admin sync error keeps local rows | 6 | store untouched on throw |
| 17 | Organization cost is not added to requests or to a ChatGPT plan | 6 | comparison payload |
| 18 | Large store stays off the renderer | 3 and 7 | page limit; no full-table postMessage |

UI fixture set for phase 3: mixed models in one thread, unknown price, partial usage, unknown account, one row over Warn at. Compare one real private rollout only on the maintainer’s machine; do not commit that file.

---

## 14. Files that must stay Cursor-only

Do not route Codex rows through:

- `src/usage/types.ts` `UsageQuery`
- `src/usage/service.ts` / `api.ts` / `parse.ts`
- `src/pricing/listPrice.ts`
- `src/ui/historyRows.ts` `toHistoryRows`
- `src/ui/queryGroups.ts` `titleGroupKey` path
- `src/ui/mtdPace.ts`, `src/burnRate/*`, `src/ui/criticalAlert.ts`
- `src/ui/exportCsv.ts` `buildQueriesCsv`
- Status bar builders

Shared, allowed to call: `src/format.ts` (add Codex formatters beside existing ones), `src/time/` day bounds, `src/spikes/threshold.ts` `isSpike` for the `!` mark, `src/webview/messages.ts` as the message union, `src/config.ts` for the new keys.

---

## 15. Security

- Read rollout files as data. Render titles and error codes with `textContent`.
- Do not open `auth.json`, `session.json`, or cookies to guess an account.
- Do not send the Cursor access token, a Codex token, or an OpenAI key to the webview.
- Phase 6 key lives in `context.secrets` only.
- CSV and details copy contain ids and numbers, not prompts or tool output.
- Importer paths stay inside the resolved Codex home after `realpath`. Reject a home that resolves outside the user-chosen directory.

---

## 16. Implementation order reminder

1. Parser and usage math.
2. SQLite import and dedupe.
3. Source switch, Codex table, drawer, CSV.
4. Explicit tariff, or an honest `—`.
5. Only then recorder, organization totals, and Optimize hints.

Ship step 3–4 to users as **1.1.0** without a price table if tokens are trustworthy. Do not block that release on an admin API key.
