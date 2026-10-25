# Phase 2b — Import

**Parent:** [openai-codex.md](./openai-codex.md)
**Status:** ready to implement
**Depends on:** [phase-1-parse.md](./phase-1-parse.md), [phase-2a-store.md](./phase-2a-store.md)
**Next:** [phase-3a-query.md](./phase-3a-query.md)
**Polish:** [phase-2b-import.pl.md](./phase-2b-import.pl.md)
**Release:** 1.1.0. Do not bump `package.json`.

If this file and the parent plan disagree, **the parent plan wins**. If either disagrees with the PRD, **the PRD wins**.

One Agent message. Touch only the paths in §3. The scheduler is not registered from `extension.ts` in this phase.

---

## 1. Goal

Read rollout files under one Codex root and apply idempotent batches. A second import of the same bytes does not change request count or token sums.

**Done when:**

- A second import is a no-op on totals.
- A shrink and a same-size replacement do not duplicate requests.
- A fork that copies `responseId` does not double the global sum. The child conversation links to the parent. Spend attributed to the child counts only responses that first appear on the child.
- Unknown account scope is `unknown-source:<sourceInstanceId>`, never the Cursor email and never SQL NULL.
- Tests use a temp directory. `npm test` is green for the two new test files.

---

## 2. Out of scope

| Item | When |
|------|------|
| `activate()`, settings UI, webview | phase 3 |
| `fs.watch` wired to the extension host | phase 3b calls `start()`; this phase implements the timer but nothing starts it |
| Network, admin key | phases 5–6 |
| Deleting tracker rows because a log file disappeared | never. Delete is `codex.forget` in phase 3 |

---

## 3. Files

```
src/openaiHistory/codex/sourceRoot.ts
src/openaiHistory/codex/discover.ts
src/openaiHistory/codex/importer.ts
src/openaiHistory/historyService.ts
test/codexSourceRoot.test.ts
test/codexImporter.test.ts
```

---

## 4. Root (`sourceRoot.ts`)

```typescript
export type ResolvedCodexRoot =
  | { ok: true; realpath: string; sourceInstanceId: string; via: 'setting' | 'env' | 'home' }
  | { ok: false; reason: 'missing' | 'not-directory' }

export function resolveCodexRoot(input: {
  codexHomeSetting: string
  codexHomeEnv: string | undefined
  homeDir: string
  stat: (path: string) => Promise<'dir' | 'file' | 'missing'>
  realpath: (path: string) => Promise<string>
}): Promise<ResolvedCodexRoot>
```

Precedence:

1. Non-empty `codexHomeSetting`, after `~` expansion, if `stat` says directory.
2. Else `codexHomeEnv` only when it is absolute and `stat` says directory. A relative `CODEX_HOME` is ignored.
3. Else `homeDir + '/.codex'` when that is a directory.
4. Else `{ ok: false, reason: 'missing' }`.

`sourceInstanceId` is the hex sha256 of the resolved realpath. It is not the path itself.

`sessionsDirectoryExists(rootRealpath, stat): Promise<boolean>` stats `<root>/sessions` only. It does not read file contents. Phase 3 uses this while import is off.

---

## 5. Discover (`discover.ts`)

```typescript
export function discoverRolloutFiles(rootRealpath: string, deps: FsDeps): Promise<DiscoveredFile[]>
```

- Include regular files under `<root>/sessions/` and `<root>/archived_sessions/`.
- Skip `history.jsonl` by basename. It is not usage.
- `realpath` each file. If the realpath is not under `rootRealpath`, skip it. Do not follow a symlink that leaves the root.
- Return `{ absolutePath, size, mtimeMs }`. No file contents in this function.

---

## 6. Importer (`importer.ts`)

```typescript
export function importDiscoveredFile(input: {
  file: DiscoveredFile
  root: ResolvedCodexRoot & { ok: true }
  deviceId: string
  store: RequestStore
  readFrom: (path: string, offset: number) => Promise<Uint8Array>
}): Promise<{ unrecognized: number }>
```

Generation:

- Prefix fingerprint is sha256 of the first **4096** bytes, or of the whole file when it is shorter.
- Generation increments when `size` shrinks, or when size is unchanged and the prefix fingerprint differs from the stored one.
- A new generation reads from offset **0**. The same generation reads from the checkpoint offset.
- Same size and same fingerprint: read the tail from the checkpoint only.

Read loop:

- Seed the byte reader with `partial_bytes` from the checkpoint.
- Decode only through the last newline. Store the split tail back into `partial_bytes`.
- Parse each line with phase 1. A skip increments `unrecognized`.
- `session_meta` / `turn_context` update the checkpoint `parser_context` and may upsert a conversation (title = `shortThreadTitle(threadId)`, no message text). A repeated meta does not create a second conversation.
- A request candidate becomes one request plus one observation.
- Scope: `accountScopeKey(opaqueId)` with confidence `source-reported` when the context has an opaque id. Else `unknownScopeKey(sourceInstanceId)` with confidence `unknown`.
- No `responseId`: `provisionalRequestKey(sourceInstanceId, generation, byteOffset)`.
- Same response id already stored for that scope: second observation, `attributes_spend = 0`, no added tokens. If this file’s thread id differs, set `parent_conversation_id` on the child conversation when the candidate carries a parent. The child’s own later requests (new response ids) get `attributes_spend = 1`.
- A `status` outcome updates the matching request’s status and `error_code` only. It does not insert usage.
- Snapshots go to `usage_snapshots`. A drop or a missing baseline sets `gap = 1`. Do not invent a request row from a delta. Do not turn a negative delta into zero.
- Turn count on the conversation is the count of distinct `turn_id` values seen on `turn_context` and request candidates. Snapshot-only files leave `turn_count` null. They do not get a fabricated request count.
- Deleting or missing a previously imported file does not delete requests.

Commit each file’s batch and its checkpoint together via `applyBatch`. Yield between files (`await` a macrotask) so a long import can be cancelled by the service. Cap one batch at **200** outcomes; flush the batch and continue the same generation from the new offset.

`deviceId` is an argument. This phase does not read `globalState`. Tests pass `'device-test'`.

---

## 7. Service (`historyService.ts`)

```typescript
export type HistoryServiceOptions = {
  importEnabled: boolean
  resolveRoot: () => Promise<ResolvedCodexRoot>
  discover: typeof discoverRolloutFiles
  store: RequestStore
  lease: () => Promise<LeaseRole>
  now: () => number
}

export class HistoryService {
  start(): void
  refresh(): Promise<void>
  stop(): void
}
```

- `start()` returns immediately. It does not await the first scan.
- While `importEnabled` is false: no watcher, no content reads. `refresh()` may call `sessionsDirectoryExists` and remember a boolean for phase 3. It does not open rollout files.
- While enabled: queue depth **1**. A second `refresh()` while one is running sets a dirty bit and runs once more after the current pass.
- `fs.watch` on the root is a hint, debounced **750** ms, then `refresh()`.
- A **30_000** ms timer is authoritative. It stats first and reads only dirty tails (size, mtime, or fingerprint changed, or no checkpoint).
- Lease `reader`: skip content reads. Query methods from phase 3a still work.
- `stop()` clears the timer and the watcher.

Do not construct this from `extension.ts` in this phase. Tests call `start` / `refresh` / `stop` on a temp root.

---

## 8. Tests

### 8.1 `test/codexSourceRoot.test.ts`

- Setting wins over env and over `~/.codex`.
- Empty setting falls through to an absolute existing `CODEX_HOME`.
- Relative `CODEX_HOME` is ignored.
- Missing directories → `missing`.
- `sourceInstanceId` changes when the realpath changes and stays stable for the same realpath.

### 8.2 `test/codexImporter.test.ts`

Temp directory with synthetic JSONL. No real Codex home.

- Import twice → same request count and same token sums (acceptance 1).
- Usage record plus token-count snapshot → one request, one snapshot row (acceptance 2).
- Snapshot-only file → zero requests (acceptance 3).
- Fork file reuses `responseId` → one global request; child conversation has `parent_conversation_id`; a new response id on the child increases the global count by one and is the only spend row for the child (acceptance 4).
- Two roots (two instance ids), same title, no account id → two scope keys, both `unknown-source:…` (acceptance 5, store half).
- Shrink the file, import again → new generation, no duplicate request.
- Same size, different prefix, import again → new generation, no duplicate.
- Move the file under `archived_sessions/` → still one request.
- Reopen the store and import again → still one request.
- A rollout line that contains a prompt sentence does not appear in any SQL text column (dump the schema values).
- Symlink whose realpath leaves the root is skipped.
- `history.jsonl` is skipped.
- Import disabled → `refresh()` does not call `readFrom`.

---

## 9. Security

Stay inside the resolved root. Do not open Codex auth files. Do not log absolute paths at info level in this phase (tests may assert on returned structures). Unrecognized lines increment a counter only.

---

## 10. Handoff

Phase 3a reads the store. It does not import. Phase 3b is what calls `HistoryService.start` from `activate()` without awaiting it.
