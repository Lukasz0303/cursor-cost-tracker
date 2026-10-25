# OpenAI Codex request history — implementation plan

**Background.** Implement from [openai-codex.md](../openai-codex.md) · [Polish](../openai-codex.pl.md).
Shelf: [README.md](../README.md).

**Prepared by:** Codex — OpenAI's coding agent
**Prepared on:** 2026-10-14
**Status:** superseded as a standalone plan. Kept as an input to the summary. This document is a plan, not an implementation.
**Primary input:** [OpenAI/Codex request specification](../../../reports/cursor-cost-tracker-openai-requests-spec.md)  
**Recommended release split:** Codex local history in 1.1.0; an API recorder and organization reporting only in later minor releases.

## 1. Product decision

Add a source-aware request-history experience to the existing History panel:

- **Cursor** — the existing Cursor usage-event experience, unchanged;
- **Codex local** — request-level records imported from locally preserved Codex rollout JSONL files;
- **OpenAI API** — a visibly scoped future source containing only calls written by an instrumented application.

The first releasable slice is **Codex local only**. It is useful without an API key, never reads private ChatGPT conversations, and never claims to be complete account history.

The source selection drives Queries, Statistics, Charts, and Optimize analysis. The status bar remains Cursor-only. Current, Today, forecast, alert, and polling calculations are Cursor-specific and must never include Codex or OpenAI values.

> A local Codex record is a locally observed usage record. It is not proof of a ChatGPT invoice amount, organization API usage, or full account history.

## 2. Codebase analysis and implementation consequences

| Current implementation | Observation | Required decision |
|---|---|---|
| src/usage/types.ts | UsageQuery has numeric costUsd and numeric token fields. Numeric zero currently means either a real zero or unavailable data. | Do not add Codex records to UsageQuery. Create a nullable provider-neutral request ledger. |
| src/usage/service.ts | It owns Cursor session access, cursor.com polling, and an in-memory Cursor cache. | Leave it intact. Add a separate CodexHistoryService and source registry. |
| src/ui/historyRows.ts | It generates one Cursor payload for table, stats, charts, pricing, and Optimize. | Preserve its Cursor path; publish separate host-query results for Codex/OpenAI. |
| src/ui/queryGroups.ts | It groups Cursor rows by normalized local Cursor title. | Never reuse it for Codex. Codex groups are keyed by provider, account scope, and conversation ID; title is presentation only. |
| src/ui/historyPanel.ts | It owns the reusable WebviewPanel, validated messages, and Cursor CSV export. | Inject the source registry and a non-Cursor message router here. |
| media/history.html and media/src/tabs/queries.js | The existing table already supports filters, expansion, keyboard navigation, and a generated browser bundle. | Extend this view. Edit media/src and media/css, never generated media/history.js/history.css. |
| src/pricing/ | It loads Cursor pricing and calculates a Cursor list-price split. | Keep it Cursor-only. Create a separate versioned OpenAI price catalog with nullable estimates. |
| sql.js | It currently reads an external Cursor SQLite database; the extension owns no history store. | Add an extension-private SQLite store in global storage, backed by the installed sql.js dependency. |
| src/webview/messages.ts | It validates the webview command allowlist. | Add source-query messages there before HistoryPanel handles them. |
| src/i18n/catalogs/ | Eleven catalogue files must match English keys. | Add, translate, and parity-test all new labels/states. |

The current Queries table also has a **Cursor-only Context** column. Codex data does not establish the same Cursor context meter, so non-Cursor rows must not fabricate one.

## 3. Verified Codex constraint

The Codex app-server is useful for optional thread names and metadata, but it is not the primary importer. The official documentation describes thread/turn/item APIs and aggregate ChatGPT token-usage summaries; it does not make a durable, account-wide request ledger available to this extension. The documented WebSocket transport is also experimental/unsupported for production workloads. [Codex App Server](https://learn.chatgpt.com/docs/app-server)

Accordingly:

1. The first release reads preserved local rollout files and never starts, resumes, or steers a Codex agent to collect usage.
2. App-server is a later, best-effort title/metadata enrichment only, using a version-negotiated schema.
3. Account usage and rate-limit summaries are never converted to request rows or combined with request costs.
4. The extension never reads, reuses, or sends Codex login credentials, app-server transport tokens, private cookies, prompt text, response text, tool output, or instruction files.

## 4. Scope and release gates

### 4.1 Included in 1.1.0

- Discover one local Codex source root: private configured root, then CODEX_HOME, then the default Codex directory.
- Incrementally import active and archived rollout JSONL files.
- Persist normalized request observations in private extension storage across IDE restarts.
- Render Codex conversation and request history with coverage states.
- Filter, sort, group by actual conversation ID, expand lazily, inspect safe request detail, and export selected results as CSV.
- Show tokens even when model, account, pricing, or billing mode is unknown.
- Show local-source Statistics, Charts, and read-only high-usage analysis.

### 4.2 Explicitly excluded in 1.1.0

- Passive interception of TLS traffic, Codex CLI traffic, another editor, or another application's OpenAI calls.
- A claim to retrieve all personal ChatGPT conversations or all account requests.
- API-key input, Organization Usage/Costs polling, or OpenAI network requests.
- A default API-price mapping for a Codex model.
- Prompt/response/transcript storage, transcript search, workspace scans, auto-fixes, rerunning a Codex request, or automatic account identity inference.
- Any change to Cursor status-bar behavior, Cursor Current/Today/forecast calculations, or existing Cursor event grouping.

### 4.3 Later gates

| Release | Capability | Gate |
|---|---|---|
| 1.2.x | Instrumented OpenAI API recorder import | A separately versioned recorder contract proves stream, retry, and rotation behavior in one controlled application. |
| 1.3.x | Organization Usage/Costs comparison | PRD/security approval for api.openai.com and approved SecretStorage credential UX. |
| 1.4.x | Optional app-server title enrichment | Per-version schema negotiation, no process side effects, and compatibility fixtures. |

The first release is publishable when prices are unavailable. Token history is useful and more honest than a guessed cost.

## 5. UI proposal

Use the existing Queries tab, with no Activity Bar, second webview, React, or modal connection flow.

~~~text
History panel toolbar
[Last 1000 Cursor queries] [Statistics] [Charts] [Optimize] [Support] [Settings]     [Run Optimize] [Refresh]

Queries — Cursor
[Source: Cursor | Codex local | OpenAI API] [Over Warn at] [Optimized] [Group by conversation] [Export CSV]
TIME | MODEL | Context | COST | TOKENS | INPUT / OUTPUT | KIND

Queries — Codex local
[Source: Cursor | Codex local | OpenAI API] [Date] [Account] [Model] [Status] [Group by conversation] [Export CSV]
Codex local · This device · Account unknown · 18 sessions · 2026-09-01–2026-10-14 · Last scan 10:24 [Refresh local]
TIME / CONVERSATION | MODEL | COST | TOKENS | INPUT / OUTPUT | KIND
▸ Refactor importer                gpt-…  —                 1.25M  1.1M / 150k  ChatGPT plan
  4 turns · 28 model requests · 2026-10-13 09:12 → 10:17 · 26/28 usage reported
    10:02:18                         gpt-…  API-equiv. $…    155,532 15,347 / 185 ChatGPT plan

Request detail
Source: Codex local · observed 10:02:18 · status unknown
Account: unknown · Usage: reported · Pricing: unavailable
Input 15,347 (cache 12,160) · Output 185 (reasoning 32) · Total 15,532
IDs: thread #… · turn #… · response #… · parser rollout-v1
~~~

### 5.1 Source switching

- Place an accessible three-button segmented control as the first Queries action. Use aria-pressed.
- Default to Cursor whenever the panel is opened from Current, Today, a recent chip, or the current history command.
- Keep selection only for the active panel session in 1.1.0; do not write it to workspace settings.
- Cursor retains its present toolbar and Settings-controlled Last N/From/To behavior.
- Codex local has independent host-side query dates. Changing them must not fetch cursor.com or modify cursorCost.historyFromDate.
- OpenAI API is visible but disabled in 1.1.0. Its empty state says that the extension cannot automatically observe calls from other applications.
- Update the tab/document title to Codex local requests when the source is selected.

### 5.2 Codex local filters

| Control | Behavior |
|---|---|
| Date | Last 7 days, This month, All imported history, Custom From/To. Convert custom dates to local [from, to) bounds. |
| Account | All, Unknown account, a source-reported account, or user-assigned scope. Unknown is never silently mapped to Cursor's account. |
| Model | All models present under active filters plus Unknown. |
| Status | All, completed, failed, cancelled, incomplete, unknown. Unknown is normal for initial rollout imports. |
| Group | Off means request rows. On means groups keyed by provider + scope + conversation ID. |
| Sort | Newest first default; Cost and Tokens sorts are host/database sorts. |
| Export | Exports every matching request, not only the browser page. Future aggregate export is separate. |

Always show a Codex source-status strip: scope, account confidence, imported date range, file/session count, partial-data count, last successful scan, and Refresh local. It is also where No local Codex history found, Partial history, and Sync failed while showing data from are rendered.

### 5.3 Table and interaction rules

- Keep the wide, monospaced, horizontal-scroll table. Hide Context for Codex/OpenAI; calculate detail colspan from active columns.
- Conversation rows show title or short ID, turn count, model-request count, activity range, and coverage. Never call turns requests.
- Equal titles never merge different account/conversation groups. Missing conversation IDs become deterministic individual short-ID groups, not one global Unknown group.
- Group expansion sends a host request and fetches child rows lazily from SQLite.
- Details contain safe metadata only: source, known times, usage/pricing quality, formula/version, numeric usage, masked IDs, status, and safe error code/message.
- A high-token Codex row opens read-only Analyze usage in Optimize. It never opens a Codex chat, sends a prompt, or starts a paid request.
- Preserve existing keyboard, aria-expanded, focus, and horizontal-scroll behavior.

### 5.4 Statistics, Charts, and Optimize

| Tab | Cursor | Codex local in 1.1.0 |
|---|---|---|
| Statistics | Existing behavior untouched. | Source coverage, request/turn count, input/cache/output/reasoning/total tokens, usage/pricing/account coverage, separate estimate and reported-cost lines. Cursor Current/Today/forecast are unavailable, never zero. |
| Charts | Existing behavior untouched. | Daily known-token series, model-token mix, request/turn counts, known-cost series. Missing price is a gap/unknown state, never a confirmed zero bar. |
| Optimize | Existing Cursor Agent workflow untouched. | Read-only metadata analysis of high input growth, repeated context, cache share, and requests per turn. Findings are hypotheses and never inspect prompt text. |

## 6. Provider-neutral request model

Create src/openaiHistory/ rather than changing src/usage/. The name identifies the provider; Cursor code remains where it is.

~~~ts
type RequestSource = 'codex-local' | 'openai-api'
type AccountConfidence = 'source-reported' | 'user-assigned' | 'unknown'
type ModelEvidence = 'response' | 'turn-context' | 'requested' | 'unknown'
type BillingMode = 'api' | 'chatgpt-plan' | 'unknown'
type RequestStatus = 'completed' | 'failed' | 'cancelled' | 'incomplete' | 'unknown'
type UsageQuality = 'reported' | 'derived' | 'partial' | 'missing'
type CostCoverage = 'complete' | 'tokens-only' | 'partial' | 'unknown'

type RequestUsage = {
  inputTokens: number | null
  cachedInputTokens: number | null
  cacheWriteInputTokens: number | null
  outputTokens: number | null
  reasoningOutputTokens: number | null
  totalTokens: number | null
}

type TrackedRequest = {
  id: string
  source: RequestSource
  sourceInstanceId: string
  deviceId: string
  accountScopeId: string | null
  accountScopeKey: string
  accountConfidence: AccountConfidence
  conversationId: string
  sessionId: string | null
  turnId: string | null
  rootTurnId: string | null
  parentConversationId: string | null
  responseId: string | null
  providerRequestId: string | null
  logicalOperationId: string | null
  attemptId: string | null
  observedAt: string
  startedAt: string | null
  completedAt: string | null
  model: string | null
  modelEvidence: ModelEvidence
  serviceTier: string | null
  billingMode: BillingMode
  status: RequestStatus
  errorCode: string | null
  usage: RequestUsage
  usageQuality: UsageQuality
  estimatedApiCostUsd: string | null
  reportedCostUsd: string | null
  pricingVersion: string | null
  costCoverage: CostCoverage
  parserVersion: string
}
~~~

Invariants:

1. Null means unknown; zero means a positively reported zero.
2. Store money as canonical decimal text and calculate with a fixed-scale bigint decimal helper. Round only for display/export.
3. For text usage I=input, C=cached input, O=output, R=reasoning output, and T=I+O. C is a subset of I and R is a subset of O.
4. Validate 0 <= C <= I and 0 <= R <= O. Record anomalies without silently correcting source values.
5. Usage does not prove completed status.
6. Unknown accounts use non-empty source-instance scope keys. Nullable SQL uniqueness must not collapse them.
7. Observations preserve file/generation/byte-offset origin; requests are deduplicated business facts.

## 7. Durable private storage

### 7.1 Location and implementation

Store the request ledger below context.globalStorageUri, for example in codex-request-history.sqlite. It is private extension data: never a workspace file, never a Codex database, and never a file in the user repository.

Use the already installed sql.js dependency for the first write-capable store so the feature remains portable across supported operating systems. The store loads asynchronously after activation, runs migrations in memory, writes a committed database through a temporary sibling file, then renames it into place. A failed flush preserves the last valid database and surfaces a source-sync error; it never removes imported history.

Keep a RequestStore interface independent of sql.js. A later native implementation can be measured and introduced behind it, but node:sqlite must not become a required writer: the extension supports Node 18 and the product explicitly rejects a native-only SQLite path.

### 7.2 Minimum schema

| Table | Essential fields | Purpose |
|---|---|---|
| schema_migrations | version, applied_at | Ordered idempotent schema tracking. |
| source_instances | id, source, root_fingerprint, device_id, configured_at, last_scan_at, status | Identifies a source root without treating its path as an account. |
| source_files | id, source_instance_id, canonical_path, file_identity, generation, size, mtime, fingerprint | Rotation/truncation/replacement detection. Never sent to the webview. |
| import_checkpoints | source_file_id, generation, byte_offset, partial_bytes, parser_context_json, committed_at | Byte-accurate incremental import. |
| conversations | id, provider, scope_key, conversation_id, title, title_evidence, parent_id, first_at, last_at | Safe metadata and display title, no transcript body. |
| requests | id, provider, account_scope_key, response_id, source fields, times, model, billing/status, nullable usage/cost fields, pricing_version | One de-duplicated business request. |
| request_observations | id, request_id, source_instance_id, source_file_id, generation, byte_offset, parser_version, observed_at, raw_kind | Preserves every origin. |
| usage_snapshots | id, source_instance_id, conversation_id, range_start/end, usage fields, quality | Cumulative fallback, never rendered as request rows. |
| http_attempts | id, request_id, logical_operation_id, attempt_id, times, status, safe_error | Reserved for recorder retries. |
| pricing_versions | id, source_url, verified_at, effective_from, assumptions_json | Auditable rate snapshots. |
| billing_buckets | id, scope_key, start/end, dimensions_hash, currency, reported_cost | Later organization aggregate comparison. |
| optimization_runs | id, source/request/conversation ID, rule_version, created_at, status | Future source-neutral analysis state. |

Required indexes and uniqueness:

~~~text
UNIQUE requests(provider, account_scope_key, response_id) WHERE response_id IS NOT NULL
UNIQUE request_observations(source_file_id, generation, byte_offset)
INDEX requests(source, account_scope_key, observed_at DESC, id)
INDEX requests(conversation_id, observed_at DESC, id)
INDEX requests(model, observed_at DESC, id)
INDEX source_files(source_instance_id, canonical_path)
UNIQUE billing_buckets(scope_key, start_at, end_at, dimensions_hash)
~~~

The migration/store helper also implements application-level deduplication, rather than relying only on partial-index support across host SQLite versions. Import records, observations, and checkpoint updates commit in one transaction.

### 7.3 Multi-window, failure, and cleanup behavior

- Create one lease in private global storage before importing. A second local IDE window reads the persisted store but does not run a competing importer.
- Make writes idempotent. Lease recovery after a crash can re-read files without changing totals.
- Commit short line batches, not one transaction per large file, and yield to the extension host between batches.
- Do not persist raw JSONL, messages, tool output, authentication material, or user-facing absolute source paths.
- Add a Settings subsection with an inline expanded confirmation: Remove imported Codex history from this extension. It deletes only extension-owned storage/metadata and never deletes or edits rollout files. It must not introduce a second blocking modal.

## 8. Codex local importer

### 8.1 Source discovery

Create:

~~~text
src/openaiHistory/codex/sourceRoot.ts
src/openaiHistory/codex/discover.ts
src/openaiHistory/codex/diagnostics.ts
~~~

Algorithm:

1. Resolve an explicit root stored in extension globalState.
2. If none is present, accept an absolute, non-empty CODEX_HOME only when it exists and is a directory.
3. Otherwise use the platform home directory plus .codex.
4. Recursively enumerate JSONL files below sessions and archived_sessions. Never treat history.jsonl as a complete request source.
5. Generate deviceId once per extension installation and sourceInstanceId once per root. A root path is not an account ID.
6. Report This device plus the extension-host locality in the source strip. Remote SSH/dev-container wording states which filesystem was scanned and never implies that a second machine was scanned.

Use asynchronous fs/promises traversal with directory/error guards. Do not follow symlinked directories outside the chosen root. A missing root is a normal No local Codex history found state.

### 8.2 Incremental byte reader

Create:

~~~text
src/openaiHistory/codex/byteReader.ts
src/openaiHistory/codex/checkpoint.ts
src/openaiHistory/codex/importer.ts
src/openaiHistory/codex/watch.ts
~~~

For every file/generation:

1. Compare checkpoint state to current stat data and a bounded prefix fingerprint.
2. If size shrinks, identity changes, or fingerprint proves replacement, close the current generation and start a new one at byte offset zero. Do not erase earlier observations.
3. Read from committed byte offset as Buffer chunks; find the final newline byte and decode only complete newline-delimited bytes.
4. Retain all trailing bytes as partial_bytes. This handles unfinished JSON and UTF-8 sequences split across writes.
5. Compute observation offsets from byte positions, never JavaScript string length.
6. Parse each complete line independently. Malformed/unsupported lines increment diagnostics and continue; raw content is never surfaced.
7. Normalize, deduplicate, write records + observations + checkpoint in one transaction, then advance the committed offset.
8. Yield after a bounded byte/line batch. The importer queue has concurrency one.

Use fs.watch only as a low-latency hint with a 750 ms debounce. A 30-second control scan is authoritative because watcher events can be dropped and recursive behavior differs by platform. Import errors use bounded retry/backoff and never block activation.

### 8.3 Rollout parser

Create:

~~~text
src/openaiHistory/codex/rolloutTypes.ts
src/openaiHistory/codex/rolloutContext.ts
src/openaiHistory/codex/rolloutParser.ts
src/openaiHistory/codex/usageAdapter.ts
~~~

| Rollout event | Parser behavior |
|---|---|
| session_meta | Upsert source/session metadata and optional source-reported account ID. Repetition does not create a request. |
| turn_context | Save model/context evidence for a matching turn. It is lower priority than a response-reported model. |
| token_usage_record | Make a candidate request from payload.usage only; carry IDs and event timestamp as observedAt. |
| event_msg containing token_count | Store a snapshot only when semantic evidence says it is cumulative. Never add it to token_usage_record totals. |
| Explicit terminal/error event | Update status only with a reliable request/turn link; otherwise keep unknown. |
| User, agent, tool, instruction, arbitrary text | Ignore body completely. Do not use user text as a title because the product forbids transcript reads. |
| Unknown event | Ignore safely and increment a diagnostic counter. |

Initial parser name is rollout-v1. Every later rollout shape gets its own parser version and anonymized fixture. A source with only cumulative snapshots has derived usage intervals and no fabricated request count.

### 8.4 Deduplication, forks, and accounts

- Primary request key: provider openai + accountScopeKey + responseId. Known scope is account:<opaque-id>; unknown is unknown-source:<sourceInstanceId>.
- With no response ID, create an observation-backed provisional record keyed by source/generation/offset and label its certainty/quality clearly.
- Never deduplicate by prompt similarity, model, title, tokens, or timestamp.
- A later recorder observation with the same known provider/account/response ID attaches to the existing request while preserving both origins.
- Forks retain parent conversation/session lineage. Inherited response IDs are counted once; a child conversation's default total contains only new observations.
- User assignment creates a separately labelled mapping and never rewrites historical unknown or source-reported identity.

## 9. Host service, querying, and webview contract

### 9.1 New modules

~~~text
src/openaiHistory/domain.ts
src/openaiHistory/ids.ts
src/openaiHistory/usage.ts
src/openaiHistory/store/types.ts
src/openaiHistory/store/migrations.ts
src/openaiHistory/store/sqlJsRequestStore.ts
src/openaiHistory/store/storeLease.ts
src/openaiHistory/historyService.ts
src/openaiHistory/sourceRegistry.ts
src/openaiHistory/historyQuery.ts
src/openaiHistory/historyRows.ts
src/openaiHistory/historyGroups.ts
src/openaiHistory/historyDetails.ts
src/openaiHistory/historyStats.ts
src/openaiHistory/historyCharts.ts
src/openaiHistory/exportCsv.ts
src/openaiHistory/webviewRouter.ts
~~~

In src/extension.ts, construct the source registry next to the existing UsageService, start it in the background, register disposal, and pass it to HistoryPanel. UsageService remains the sole owner of Cursor cookies and Cursor API polling.

HistoryPanel receives registry/router dependencies. PanelPublisher continues to produce the current Cursor payload only. The new router publishes source metadata and handles non-Cursor queries. This avoids rewriting existing forecast, Burn Rate, coding-stat, model-pricing, and Cursor Optimize code in the same change.

### 9.2 Typed protocol

Every browser request includes a client correlationId and filterRevision.

~~~ts
type RequestHistoryQuery = {
  source: 'codex-local' | 'openai-api'
  from: string | null
  to: string | null
  accountScopeId: string | null
  includeUnknownAccounts: boolean
  sourceInstanceId: string | null
  model: string | null
  status: RequestStatus | null
  groupBy: 'conversation' | 'none'
  sort: 'time-desc' | 'cost-desc' | 'tokens-desc'
  costBasis: 'estimated-api' | 'reported' | 'api-equivalent'
  pageCursor: string | null
  limit: number
}

// Browser -> host:
// requestHistory.query, requestHistory.expandConversation,
// requestHistory.details, requestHistory.refreshSource,
// requestHistory.exportCsv, requestHistory.analyze

// Host -> browser:
// requestHistory.result, requestHistory.conversation,
// requestHistory.details, requestHistory.sourceStatus,
// requestHistory.exportComplete, requestHistory.operationError
~~~

Add strict variants to src/webview/messages.ts and mirror known strings in media/src/messages.js. Requirements:

- Clamp limit to 25–100 in the host.
- Parse ISO days, enum values, booleans, IDs, sort, and cost basis strictly.
- Reject paths, SQL, URLs, auth data, raw token strings, and unbounded page sizes.
- Include normalized filters in a query fingerprint; browser ignores stale responses.
- Use opaque keyset cursors built from sort tuple + request ID, never browser-controlled offsets.

### 9.3 Query order

1. Start from normalized requests, not raw observations/snapshots.
2. Apply source, account, source-instance, model, status, and local [from,to) filters.
3. Select one labelled cost basis; never mix estimated, reported, and API-equivalent values.
4. Ungrouped mode sorts/keyset-pages request rows.
5. Grouped mode groups provider + account scope + conversation ID, calculates matching-child totals/coverage, sorts, then pages groups.
6. Children are fetched only on expansion under the same frozen filter fingerprint.
7. Totals/coverage use dedicated SQL aggregates, never browser DOM or first-page values.

Each result includes rows, nextCursor, totals, coverage, source status, and lastSyncAt.

## 10. Pricing and cost semantics

Create a separate src/openaiHistory/pricing/ namespace:

~~~text
src/openaiHistory/pricing/decimal.ts
src/openaiHistory/pricing/types.ts
src/openaiHistory/pricing/catalog.ts
src/openaiHistory/pricing/calculate.ts
src/openaiHistory/pricing/coverage.ts
~~~

The catalog is a pinned local manifest with verified date, source URL, effective date, service tier, standard/batch mode, pricing dimensions, and assumptions. Do not scrape a public pricing page on extension startup and do not reuse Cursor's model catalog.

When model, rate version, input, cached input, and output are known:

~~~text
estimated API cost =
  ((input - cached input) * input price per million
   + cached input * cached-input price per million
   + output * output price per million) / 1,000,000
~~~

Rules:

- Reasoning tokens are part of output and never charged twice.
- Unknown cached input is not replaced with zero. Render unavailable, partial, or an explicit range only with visible assumptions.
- Unknown model/rate is an em dash, never 0.00 USD.
- A Codex record marked ChatGPT plan shows API-equivalent estimate only with explicit auditable mapping. It is never described as billed cost and is never subtracted from a subscription limit.
- Codex mappings are absent by default. A later user mapping displays Assumption: user mapping plus mapping/version metadata and can be removed without mutating source usage.
- Reported organization cost is a separate field and never joins a per-request estimate into one total.
- Sum high-precision decimal values before rendering. Small positive values can display as less than 0.01 USD, with exact values retained in detail and CSV.

## 11. Later OpenAI API recorder and organization reporting

### 11.1 Recorder, not passive interception

The extension cannot observe arbitrary applications. After 1.1.0, create a companion package such as packages/openai-request-recorder with an explicitly configured local JSONL sink. An application wraps its own client:

1. recorder.begin saves logicalOperationId, attemptId, safe local conversation/turn ID, requested model, start time, and non-secret scope identifiers;
2. the application sends its request;
3. recorder.finish saves returned model, usage, response/provider IDs, completion time, and status;
4. recorder.fail saves safe error/status without masking the application's original failure;
5. the extension imports only the recorder's sanitized JSONL sink using the same checkpoint/store architecture.

The recorder schema contains no API key, Authorization header, prompt, response text, tool arguments, or cookies. Streaming stores final provider usage when available; text deltas are never counted as usage. Interrupted streams are partial/missing, not zero-cost. Retry attempts relate to a logical operation, while different response IDs remain separate requests.

This design avoids local HTTP servers, TLS interception, and breaking applications when the tracker is unavailable.

### 11.2 Organization Usage/Costs comparison

This capability needs a separate product/security decision: the current PRD limits extension network traffic to Cursor services and has no credential-connection flow.

Before code is written, amend the PRD/security document to allow only documented OpenAI organization endpoints after explicit user opt-in. Store a separately entered admin credential only in ExtensionContext.secrets. It must never occur in package configuration, globalState, CSV, logs, browser payloads, or workspace files.

When approved:

- Page all Usage/Costs results, including next_page.
- Re-fetch/replace recent buckets to tolerate reporting delay.
- Preserve currency, dimensions, scope, and time bucket.
- Compare only matching organization/project/key/model/time/unit filters.
- Render local token estimate and reported organization cost as separate labelled values.
- Never add them, apportion their difference to requests, or use aggregates as ChatGPT-plan billing proof.
- Retain imported history when an admin sync fails and show freshness.

## 12. Security and privacy requirements

Update .ai/context/security.md before release while retaining every Cursor-token restriction.

| Risk | Required control |
|---|---|
| Codex auth material near rollouts | Read selected JSONL locations only. Never probe auth/config files to infer an account. |
| Prompt/response/tool leakage | Ignore bodies in parser, omit body columns from schema, and send only safe labels/IDs/timestamps/status/numbers to browser. |
| HTML/CSV injection | Use textContent/DOM nodes. Escape CSV quotes/newlines and prefix title values beginning with =, +, -, or @. |
| Secret leakage | No OpenAI/Codex credential in logs, OutputChannel, browser message, URL, settings JSON, globalState, export, or fixture. |
| Source-path privacy | Keep absolute paths host-side; UI shows generic source/device labels. Hash paths in diagnostics when feasible. |
| Malformed/adversarial JSONL | Treat as data, cap line size, guard shapes/numbers, and never execute strings. |
| Destructive cleanup | Remove only extension-owned data after explicit in-panel confirmation. Never modify rollout files. |
| Multiple windows | Lease plus transaction/idempotence prevents duplicate import. |
| New network surface | 1.1.0 adds none. Any later api.openai.com client is opt-in, timeout/backoff limited, and isolated from Cursor cookies. |

The existing security audit must include this new source tree and dist output. Fixtures must be synthetic/anonymized; real rollout files never enter the repository.

## 13. Phased implementation with exact files

### Phase 0 — contract, docs, and fixtures

**Files**

~~~text
.ai/context/prd.md
.ai/context/architecture.md
.ai/context/security.md
.ai/context/codebase-snapshot.md
test/fixtures/codex-rollouts/
.ai/implementation-plans/README.md
~~~

**Work**

1. Record source boundary, no-transcript rule, status-bar exclusion, no-network-in-1.1.0 rule, and private store location.
2. Add synthetic fixture variants: session metadata, turn context, request usage, snapshot-only usage, malformed record, split JSON/UTF-8, rotation, fork, unknown account, and mixed models.
3. Confirm the source selector/status strip/table behavior before translating strings.
4. Do not update current behavior documentation as shipped until code actually lands.

**Done when**

- No design assumes a private ChatGPT request-history endpoint.
- Fixtures contain no account IDs, prompts, repo paths, secrets, or real rollout text.

### Phase 1 — domain, decimal arithmetic, store

**New files**

~~~text
src/openaiHistory/domain.ts
src/openaiHistory/ids.ts
src/openaiHistory/usage.ts
src/openaiHistory/store/types.ts
src/openaiHistory/store/migrations.ts
src/openaiHistory/store/sqlJsRequestStore.ts
src/openaiHistory/store/storeLease.ts
src/openaiHistory/pricing/decimal.ts
src/openaiHistory/pricing/types.ts
test/openaiHistoryDomain.test.ts
test/openaiHistoryDecimal.test.ts
test/openaiHistoryStore.test.ts
test/openaiHistoryMigrations.test.ts
~~~

**Work**

1. Normalize strict enums, IDs, ISO times, nullable non-negative usage, and account scope keys.
2. Record source anomalies instead of mutating data.
3. Define repository operations for import batches, source status, pages, children, safe detail, aggregates, CSV iteration, cleanup, and close.
4. Implement migrations, private-file lifecycle, serialized flush, temporary replacement, lease, and restart recovery.
5. Extend the local sql.js declaration only as required and test against the installed runtime API.

**Done when**

- Restart reads identical request/observation totals.
- A rollback leaves neither a checkpoint advance nor a half-written request.
- Unknown source instances cannot collide.

### Phase 2 — discovery, parser, incremental importer

**New files**

~~~text
src/openaiHistory/codex/sourceRoot.ts
src/openaiHistory/codex/discover.ts
src/openaiHistory/codex/byteReader.ts
src/openaiHistory/codex/checkpoint.ts
src/openaiHistory/codex/rolloutTypes.ts
src/openaiHistory/codex/rolloutContext.ts
src/openaiHistory/codex/rolloutParser.ts
src/openaiHistory/codex/usageAdapter.ts
src/openaiHistory/codex/importer.ts
src/openaiHistory/codex/watch.ts
src/openaiHistory/codex/diagnostics.ts
src/openaiHistory/historyService.ts
test/codexSourceRoot.test.ts
test/codexDiscover.test.ts
test/codexByteReader.test.ts
test/codexRolloutParser.test.ts
test/codexImporter.test.ts
~~~

**Work**

1. Implement root precedence and validation.
2. Discover active/archive JSONL with stable identity/generation detection.
3. Implement byte-safe checkpoints and bounded import queue.
4. Map payload.usage from token_usage_record only.
5. Carry turn model context as lower-priority evidence and never use configured model as fallback.
6. Persist coverage/parser diagnostics/source status.
7. Start discovery/import asynchronously at extension activation; dispose streams, timer, watcher.

**Done when**

- Reimport, rotation, truncation, archive move, and restart leave totals unchanged.
- Incomplete JSONL/UTF-8 append becomes exactly one record after completion.
- token_count snapshot never duplicates token_usage_record usage.

### Phase 3 — registry, host queries, CSV, source aggregates

**New files**

~~~text
src/openaiHistory/sourceRegistry.ts
src/openaiHistory/historyQuery.ts
src/openaiHistory/historyRows.ts
src/openaiHistory/historyGroups.ts
src/openaiHistory/historyDetails.ts
src/openaiHistory/historyStats.ts
src/openaiHistory/historyCharts.ts
src/openaiHistory/exportCsv.ts
src/openaiHistory/webviewRouter.ts
test/openaiHistoryQuery.test.ts
test/openaiHistoryGroups.test.ts
test/openaiHistoryStats.test.ts
test/openaiHistoryCharts.test.ts
test/openaiHistoryExportCsv.test.ts
test/openaiHistoryRouter.test.ts
~~~

**Changed files**

~~~text
src/extension.ts
src/ui/historyPanel.ts
src/webview/messages.ts
test/webviewMessages.test.ts
~~~

**Work**

1. Register CodexHistoryService alongside UsageService, not inside it.
2. Inject source registry/router into HistoryPanel.
3. Add strict source message parsing, correlation, refresh, page/detail/child query handling, and errors.
4. Create separate source-neutral rows/groups/details without overloading HistoryRow or QueryGroupPayload.
5. Implement host-side aggregates and 100-row keyset pages.
6. Build safe full-result request CSV with ISO UTC dates and source-specific filename.
7. Keep current Cursor CSV command/builder unchanged.

**Done when**

- A 100,000-row database pages, filters, and sorts without sending raw logs or all rows to the browser.
- CSV totals match filtered SQL totals and no group/child double count occurs.

### Phase 4 — webview, styles, localisation

**Changed files**

~~~text
media/history.html
media/src/messages.js
media/src/session.js
media/src/tabs/queries.js
media/src/tabs/stats.js
media/src/tabs/optimize.js
media/src/charts/host.js
media/css/queries.css
media/css/stats.css
media/css/charts.css
media/css/optimize.css
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
src/i18n/catalogs/zh-cn.ts
src/i18n/catalogs/fr.ts
src/i18n/catalogs/de.ts
src/i18n/catalogs/ja.ts
src/i18n/catalogs/ko.ts
src/i18n/catalogs/pt-br.ts
src/i18n/catalogs/ru.ts
src/i18n/catalogs/es.ts
src/i18n/catalogs/uk.ts
test/i18nKeys.test.ts
~~~

**Work**

1. Add source selector, Codex controls, source-status strip, local refresh, paging, all empty/partial/error states, and dynamic headers/colspan.
2. Split the browser table into behavior-identical Cursor rendering and host-paged request-history rendering.
3. Render all external values as DOM text nodes and preserve focus/expansion patterns.
4. Make Statistics/Charts/Optimize source-aware without rebuilding current Cursor markup for Cursor.
5. Add English strings, run npm run sync-i18n -- sync, then translate/review every locale.
6. Build generated webview assets from their source files.

**Done when**

- Source/filter/group/detail/pager/export paths work by mouse and keyboard.
- Cursor remains visually/functionally unchanged under Cursor source.
- Codex shows no fabricated Context/cost/account/status.

### Phase 5 — pricing and read-only analysis

**New files**

~~~text
src/openaiHistory/pricing/catalog.ts
src/openaiHistory/pricing/calculate.ts
src/openaiHistory/pricing/coverage.ts
src/openaiHistory/optimize/insights.ts
src/openaiHistory/optimize/runs.ts
test/openaiHistoryPricing.test.ts
test/openaiHistoryOptimize.test.ts
~~~

**Work**

1. Add pinned pricing-manifest format and fictional-rate test fixture.
2. Implement complete/partial/unknown price coverage and separate cost-basis labels.
3. Add source Statistics/Charts price labels and a detail formula explanation.
4. Implement read-only Codex metadata insights; record an analysis run without touching existing Cursor optimized-target state.
5. Wire high-token action to Analyze usage only. No chat opens, prompts, or request execution.

**Done when**

- I=100,000, C=80,000, O=10,000, R=2,000 with fixture prices 2/0.5/8 per million yields T=110,000 and 0.16 USD.
- Missing rate/model/cache renders unavailable/partial, never zero price.
- Reasoning is never double counted.

### Phase 6 — optional recorder, organization comparison, app-server

Ship each capability as a separate pull request/release, not as a 1.1.0 stabilisation change:

- Recorder: companion contract, sanitized sink, application integration example, streaming/retry fixtures, and importer adapter.
- Organization: product/security approval, SecretStorage lifecycle, pagination/backoff, fresh-bucket replacement, comparison card, and no-merge total tests.
- App-server: generated schema for installed version, capability handshake, read-only title/thread pagination, local-rollout fallback, and no process start/resume.

## 14. Test matrix

| Area | Required automated cases |
|---|---|
| Parser | payload.usage only; model-evidence priority; malformed records; null/zero; snapshot fallback; unknown event; no text persistence. |
| Import/checkpoint | Duplicate import; JSON split; UTF-8 split; byte offsets; truncate; same-size replacement; archive move; restart; debounce; lease. |
| Deduplication/forks | Same response in two observations; same known response from two sources; unknown-source isolation; retry/new response; inherited fork response once. |
| Money/usage | Cache/reasoning subset validation; fixture formula; partial coverage; decimal sum; known zero vs unknown; no name-similarity model mapping. |
| Queries | Europe/Warsaw DST [from,to); all filters; database sort; keyset cursor; matching-only group total; titles do not merge; lazy children. |
| Webview | Strict command rejection; stale correlation; source switch; status states; dynamic columns; keyboard expansion; safe text. |
| CSV | All pages; UTC fields; empty unknowns; formula-injection title; quote/newline escaping; no secret/prompt text; no double count. |
| Regression | Current UsageService, Cursor table/groups, history sample, Current/Today, forecast, status bar, export, catalogue parity. |

## 15. Acceptance criteria

1. Importing one rollout twice changes neither request count nor totals.
2. token_usage_record plus token_count for the same activity is counted exactly once.
3. Snapshot-only logs never produce a fake request list.
4. Forked inherited response IDs do not increase global usage.
5. An unknown account remains unknown after Cursor sign-in/session refresh.
6. Same titles across accounts/conversations remain separate groups.
7. Mixed-model groups render Mixed (N), not the last model on every request.
8. Missing model, usage, price, and account remain visibly unavailable.
9. Source scope/freshness/coverage appears before numbers that could be mistaken for account-wide data.
10. Export covers all matching pages and matches the same filter totals.
11. Import failure retains previously stored rows and reports freshness.
12. OpenAI API source makes no passive-observation promise in 1.1.0.
13. No Cursor token, Codex credential, API credential, prompt, response, or raw JSONL reaches browser payloads, CSV, fixtures, logs, or output channels.
14. Extension activation does not wait for discovery, import, or network work.
15. Existing Cursor Current/Today/recent chips retain byte-for-byte equivalent regression output.
16. First warm Codex page is measured below 500 ms on the reference machine with 100,000 request rows; page size bounds browser DOM.

Run before merge:

~~~text
npm run typecheck
npm run lint
npm test
npm run sync-i18n -- check
npm run build
npm run package
~~~

Manual verification uses only a copied synthetic rollout fixture in a temporary root plus one deliberately created local Codex session compared against its table and CSV. No real account log is committed.

## 16. Documentation and rollout

- Treat Codex local history as a MINOR release, 1.1.0, after compatibility testing.
- Update README, site, CHANGELOG, PRD, architecture, security document, and codebase snapshot only when implementation is merged.
- Describe the capability as local Codex rollout history, never all ChatGPT/OpenAI history.
- Document parser versions, data gaps, cleanup behavior, and the distinction among token usage, API-equivalent estimate, reported organization cost, and ChatGPT-plan billing.
- The filename and Prepared by line identify this document as the OpenAI/Codex-authored plan for comparison with plans prepared by other models.

## 17. Product decisions still required

1. Is 1.1.0 limited to one configured Codex root, or must it support several imported roots/devices from day one?
2. Should the root selector remain private globalState as proposed, or also become a package configuration key?
3. Is a visible, manual Codex-model-to-API-price mapping desirable after token-only history ships?
4. Is a future SecretStorage credential-entry UX acceptable under the current no-extra-modal rule, or should organization reporting remain out of the extension?
5. Should Codex analysis runs gain an Optimized-style filter only after a true source-neutral analysis record is implemented?

Until these choices are approved, phases 1–4 provide an honest, complete local Codex history without expanding network, credential, or transcript scope.
