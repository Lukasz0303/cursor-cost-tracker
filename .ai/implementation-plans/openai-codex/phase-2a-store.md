# Phase 2a — Store

**Parent:** [openai-codex.md](./openai-codex.md)
**Status:** ready to implement
**Depends on:** [phase-1-parse.md](./phase-1-parse.md)
**Next:** [phase-2b-import.md](./phase-2b-import.md)
**Polish:** [phase-2a-store.pl.md](./phase-2a-store.pl.md)
**Release:** 1.1.0. Do not bump `package.json`.

If this file and the parent plan disagree, **the parent plan wins**. If either disagrees with the PRD, **the PRD wins**.

One Agent message. Touch only the paths in §3. No `vscode` import. Tests inject sql.js and a fake file writer.

---

## 1. Goal

A versioned sql.js store for normalized Codex rows. Migrate in memory, write a temp sibling, rename over the destination. One lease so a second caller can read and must not import.

**Done when:**

- Reopen of the written file returns the same request count and the same token sums.
- A failed flush leaves the previous file in place and the reopened checkpoint is the old offset.
- Two source instances with unknown accounts stay apart (`unknown-source:<id>` is never SQL NULL and never a shared NULL).
- `npm test` is green for `test/openaiHistoryStore.test.ts`.

---

## 2. Out of scope

| Item | When |
|------|------|
| Walking `sessions/` | phase 2b |
| `globalState` adapter | phase 3b (this phase takes a `LeaseStore` interface) |
| Pricing rows | phase 4 adds `pricing_versions` |
| `http_attempts`, `billing_buckets`, `optimization_runs` | phases 5–7 |
| Writing `~/.codex`, `state.vscdb`, or the workspace | never |

---

## 3. Files

```
src/openaiHistory/store/types.ts
src/openaiHistory/store/migrations.ts
src/openaiHistory/store/sqlJsRequestStore.ts
src/openaiHistory/store/storeLease.ts
test/openaiHistoryStore.test.ts
```

File name the host will use in phase 3b: `openai-request-history.sqlite` under `globalStorageUri`. This phase accepts a path argument and does not look up `globalStorageUri`.

---

## 4. Lease (`storeLease.ts`)

```typescript
export type LeaseStore = {
  read(): Promise<string | null>
  write(value: string): Promise<void>
}

export type LeaseRole = 'writer' | 'reader'

export function tryAcquireImportLease(
  store: LeaseStore,
  ownerId: string,
  nowMs: number,
): Promise<LeaseRole>
```

Persisted JSON: `{ ownerId, expiresAt }`. TTL **60_000** ms. The current owner renews by writing a later `expiresAt`. A missing or expired record lets the caller become `writer`. Anyone else gets `reader`.

The storage key, applied by phase 3b, is `cursorCost.codexImportLease`. Tests use an in-memory `LeaseStore`.

A `reader` may call query methods. `applyBatch` throws if the caller is not the writer. Phase 2b enforces that; this phase exposes `assertWriter()`.

---

## 5. Schema (`migrations.ts`)

`schema_migrations(version INTEGER PRIMARY KEY)`. Migration **1** creates the tables below. Later phases append migrations; they do not edit migration 1 after it has shipped.

### `source_instances`

`id` (source instance id, PK), `provider` (`openai`), `root_realpath`, `device_id`, `last_scan_at`, `parser_version`, `unrecognized_lines INTEGER NOT NULL DEFAULT 0`.

### `source_files`

`id` PK, `source_instance_id`, `absolute_path`, `generation INTEGER`, `size_bytes`, `mtime_ms`, `prefix_fingerprint`. Unique `(source_instance_id, absolute_path)`.

Absolute paths live here only. Query rows built in phase 3a must not select this column into the webview.

### `import_checkpoints`

`source_file_id` PK, `generation`, `byte_offset`, `partial_bytes` (nullable blob), `parser_context` (JSON text of `ParserContext`).

### `conversations`

`id` PK, `provider`, `account_scope_key`, `conversation_id`, `parent_conversation_id`, `title`, `turn_count` nullable, `first_observed_at`, `last_observed_at`. Unique `(provider, account_scope_key, conversation_id)`.

### `requests`

One deduped request. Nullable usage and cost. Columns:

`id`, `provider` (`openai`), `source` (`codex-local` | `openai-api`), `account_scope_key` **NOT NULL**, `account_confidence`, `conversation_id`, `session_id`, `turn_id`, `response_id`, `provisional_key`, `observed_at`, `started_at`, `completed_at`, `model`, `model_evidence`, `billing_mode`, `status`, `error_code`, `input_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, `output_tokens`, `reasoning_output_tokens`, `total_tokens`, `usage_quality`, `usage_anomaly`, `estimated_api_cost_usd` (decimal string, null in this phase), `reported_cost_usd`, `pricing_version`, `cost_coverage`, `device_id`, `source_instance_id`.

Partial unique index, because SQL NULL is not a key:

```sql
CREATE UNIQUE INDEX requests_response_uid
ON requests(provider, account_scope_key, response_id)
WHERE response_id IS NOT NULL AND response_id != '';

CREATE UNIQUE INDEX requests_provisional_uid
ON requests(provisional_key)
WHERE provisional_key IS NOT NULL AND provisional_key != '';
```

Lookup indexes:

```text
(source, account_scope_key, observed_at, id)
(conversation_id, observed_at, id)
(model, observed_at, id)
```

### `request_observations`

`id` PK, `request_id`, `source_file_id`, `generation`, `byte_offset`, `observed_at`, `attributes_spend INTEGER NOT NULL`.

Unique `(source_file_id, generation, byte_offset)`.

`attributes_spend = 1` only for the observation that created the request (or the first one applied). A later observation of the same `(provider, account_scope_key, response_id)` inserts another observation with `attributes_spend = 0`. Global sums count the request once. Phase 3a group sums count a request toward a conversation only when that conversation’s observation has `attributes_spend = 1`.

### `usage_snapshots`

Cumulative counters. Never a model request. `id` PK, `source_file_id`, `generation`, `byte_offset`, `conversation_id`, `observed_at`, the same nullable token columns, `gap INTEGER NOT NULL DEFAULT 0`. Unique `(source_file_id, generation, byte_offset)`.

---

## 6. Store (`sqlJsRequestStore.ts`)

```typescript
export type RequestStore = {
  applyBatch(batch: ImportBatch): Promise<void>
  readCheckpoint(fileId: string): Promise<Checkpoint | null>
  totals(sourceInstanceId: string): Promise<{ requests: number; inputTokens: number; outputTokens: number }>
  exportBytes(): Uint8Array
  flush(destinationPath: string): Promise<void>
  close(): Promise<void>
}

export function openRequestStore(bytes: Uint8Array | null, sql: SqlJsStatic): RequestStore
```

`ImportBatch` is an insert-only description: instance upsert, file upsert, checkpoint, conversations, request upserts, observations, snapshots, and `unrecognizedDelta`. Phase 2b builds it. This phase accepts it.

Upsert rules:

- Same `(provider, account_scope_key, response_id)` updates nullable fields only when the new value is non-null and does not add a second request. Status may move from `unknown` to a terminal status. It must not move from a terminal status back to `unknown`.
- Missing `responseId` uses `provisional_key`. Same key updates; it does not insert again.
- Cost strings stay null. `cost_coverage` is `tokens-only` when any token column is non-null, else `unknown`.

`applyBatch` and its checkpoint are one sql.js transaction. A throw inside the batch rolls the transaction back.

### Flush

1. Export bytes from memory.
2. Write `<destination>.tmp` beside the destination.
3. Rename over the destination.
4. On any failure: delete the temp if it exists, leave the destination untouched, reload memory from the destination bytes when the destination exists, and rethrow.

Do not truncate the destination first.

---

## 7. Tests (`test/openaiHistoryStore.test.ts`)

Use a temp directory. No `vscode`.

- Apply a batch with two requests, flush, open the bytes again → same count and same I/O sums.
- Apply a second batch that repeats the same `responseId` → still one request, two observations, one of them `attributes_spend = 0`. Totals unchanged.
- Two batches with `unknown-source:aaa` and `unknown-source:bbb` and the same `responseId` → two requests.
- Checkpoint and request insert share a transaction: a batch that throws before commit does not advance `readCheckpoint`.
- Flush writer throws → destination bytes stay the previous export; reopening them shows the old checkpoint.
- `tryAcquireImportLease`: first caller `writer`, second `reader`, expired lease lets a third become `writer`.

---

## 8. Security

The schema has no prompt or tool-output column. `applyBatch` rejects a batch object that carries a `prompt`, `text`, or `arguments` field (throw). Tests pass a candidate that still has those keys and expect the throw, so a later importer cannot sneak them in.

---

## 9. Handoff

Phase 2b builds `ImportBatch` from the parser and calls `applyBatch` / `flush`. It does not add tables.
