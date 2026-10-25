# Phase 1 — Parse and usage

**Parent:** [openai-codex.md](./openai-codex.md)
**Status:** implemented
**Depends on:** nothing in `src/openaiHistory/`
**Next:** [phase-2a-store.md](./phase-2a-store.md)
**Polish:** [phase-1-parse.pl.md](./phase-1-parse.pl.md)
**Release:** 1.1.0. Do not bump `package.json`.

If this file and the parent plan disagree, **the parent plan wins**. If either disagrees with the PRD, **the PRD wins**.

One Agent message. Touch only the paths in §3.

---

## 1. Goal

Pure functions that turn one Codex rollout line into a request candidate, a usage snapshot, or a skip. No `vscode`, no `fs`, no SQLite, no network.

**Done when:**

- A `token_usage_record` and an `event_msg` / `token_count` for the same response count as **one** request candidate. The snapshot is not a second request.
- Snapshot-only input does not become a request list.
- Fixture counts I=100000, C=80000, O=10000, R=2000 produce **T=110000**.
- Both models in a two-model fixture are emitted. A response-reported model wins over turn context on that request.
- A JSONL line split across chunks, and a UTF-8 sequence split across chunks, complete on the next chunk.
- `npm test` is green for the three new test files.

---

## 2. Out of scope

| Item | When |
|------|------|
| Dedup, fork sums, SQLite | phase 2 |
| Dollar amount **0.16** | phase 4 (this phase only checks T) |
| Webview, settings, `extension.ts` | phase 3 |
| Reading a real `~/.codex` tree | never in tests |

---

## 3. Files

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

Fixtures are synthetic. Invent ids. No auth files, cookies, prompts that look copied from a real session, or tool output.

---

## 4. Domain (`src/openaiHistory/domain.ts`)

Do not extend `UsageQuery`. Parser version constant: `rollout-v1`.

```typescript
export const ROLLOUT_PARSER_VERSION = 'rollout-v1'

export type RequestSource = 'codex-local' | 'openai-api'
export type AccountConfidence = 'source-reported' | 'user-assigned' | 'unknown'
export type ModelEvidence = 'response' | 'turn-context' | 'requested' | 'unknown'
export type BillingMode = 'api' | 'chatgpt-plan' | 'unknown'
export type RequestStatus = 'completed' | 'failed' | 'cancelled' | 'incomplete' | 'unknown'
export type UsageQuality = 'reported' | 'derived' | 'partial' | 'missing'
export type CostCoverage = 'complete' | 'tokens-only' | 'partial' | 'unknown'

export type TokenUsage = {
  inputTokens: number | null
  cachedInputTokens: number | null
  cacheWriteInputTokens: number | null
  outputTokens: number | null
  reasoningOutputTokens: number | null
  totalTokens: number | null
  anomaly: boolean
}

export type RequestCandidate = {
  kind: 'request'
  responseId: string | null
  conversationId: string | null
  parentConversationId: string | null
  sessionId: string | null
  turnId: string | null
  observedAt: string
  model: string | null
  modelEvidence: ModelEvidence
  billingMode: BillingMode
  status: RequestStatus
  errorCode: string | null
  accountOpaqueId: string | null
  usage: TokenUsage
  usageQuality: UsageQuality
  byteOffset: number
}

export type UsageSnapshotEvent = {
  kind: 'snapshot'
  conversationId: string | null
  sessionId: string | null
  turnId: string | null
  observedAt: string
  usage: TokenUsage
  byteOffset: number
}

export type ParserContext = {
  sessionId: string | null
  threadId: string | null
  turnId: string | null
  model: string | null
  accountOpaqueId: string | null
  parentConversationId: string | null
  billingMode: BillingMode
}
```

`billingMode` stays `unknown` unless the line itself names a plan or API charge. A path is not available here, and a path must not set `chatgpt-plan`.

---

## 5. Ids (`src/openaiHistory/ids.ts`)

| Function | Result |
|----------|--------|
| `shortThreadTitle(threadId: string): string` | `#` + the first 8 characters. Shorter ids use the whole id after `#`. |
| `unknownScopeKey(sourceInstanceId: string): string` | `unknown-source:` + id. Never empty. |
| `accountScopeKey(opaqueId: string): string` | `account:` + id. |
| `provisionalRequestKey(sourceInstanceId, fileGeneration, byteOffset): string` | Stable join of the three. Used only when `responseId` is missing. |

No hashing in this phase. `sourceInstanceId` arrives already computed in phase 2b.

---

## 6. Usage (`src/openaiHistory/usage.ts`)

```text
I = input, including cached
C = cached input, subset of I
O = output, including reasoning
R = reasoning, subset of O
T = I + O
```

Do not add `I + C + O + R`. Null means unknown. Zero means a reported zero. Do not replace null `C` with zero.

| Function | Behavior |
|----------|----------|
| `readTokenCount(value: unknown): number \| null` | Finite integer ≥ 0, else `null`. |
| `normalizeUsage(raw: unknown): TokenUsage` | Map `input_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, `output_tokens`, `reasoning_output_tokens`, `total_tokens`. Ignore every other key, including `turn_token_usage` and `thread_token_usage`. |
| `applyUsageRules(usage: TokenUsage): TokenUsage` | When `I` and `C` are both numbers and `C` is outside `0…I`, set `anomaly` and **keep** the raw numbers. Same for `R` outside `0…O`. When `total_tokens` is a number and `I` and `O` are numbers and `total_tokens !== I + O`, set `anomaly` and keep the raw numbers. |
| `billableTotal(usage: TokenUsage): number \| null` | `I + O` when both are numbers. Else `null`. Do not fall back to `total_tokens` for T. Do not add cache-write tokens. |

Fixture: I=100000, C=80000, O=10000, R=2000 → `billableTotal` **110000**, `anomaly` false.

---

## 7. Parser (`rolloutTypes.ts`, `rolloutParser.ts`)

Treat each decoded line as data. Do not `eval`. Cap is enforced by the byte reader before parse.

```typescript
export type ParseOutcome =
  | { type: 'request'; candidate: RequestCandidate; context: ParserContext }
  | { type: 'snapshot'; snapshot: UsageSnapshotEvent; context: ParserContext }
  | { type: 'context'; context: ParserContext }
  | { type: 'skip'; reason: 'empty' | 'bad-json' | 'unknown-type' | 'dropped-body' }

export function parseRolloutLine(
  line: string,
  context: ParserContext,
  byteOffset: number,
): ParseOutcome
```

`emptyParserContext(): ParserContext` returns all nulls and `billingMode: 'unknown'`.

| Line | Action |
|------|--------|
| `session_meta` | Copy session id, thread id, optional `creator_account_id` or `creator_user_id` (first non-empty wins), optional parent thread id. Does not emit a request. A repeat only refreshes context. |
| `turn_context` | Remember `turnId` and model. Evidence for a later request that has no response model is `turn-context`. |
| `token_usage_record` | One request candidate from `payload.usage` only. `observedAt` is the line `timestamp`. Model on the payload wins (`response`); else the context model (`turn-context`); else `model: null` (UI later says Unknown). `usageQuality` is `reported` when any of I/O is a number, else `missing`. Status stays `unknown`. Usage does not set `completed`. |
| `event_msg` with `token_count` | Snapshot. Not a request. |
| User, agent, tool, or instruction text | `skip` / `dropped-body`. The returned value contains no message text. |
| Terminal error whose payload names the same `response_id` or `turn_id` as the current context | `context` update is not enough: emit `type: 'request'` only when this line also has `payload.usage`. Otherwise return a small `{ type: 'status'; status; errorCode; responseId; turnId }` outcome added next to the union above, so phase 2 can patch status without inventing usage. |
| Anything else, or invalid JSON | `skip`. The caller counts it. |

No model string on the candidate means `model: null`. Do not substitute a default model name.

Status outcome (add to the union):

```typescript
| {
    type: 'status'
    status: RequestStatus
    errorCode: string | null
    responseId: string | null
    turnId: string | null
    context: ParserContext
  }
```

A terminal line that does not name a response id or turn id is `unknown-type` (skipped, counted). Do not attach it to “the latest request”.

---

## 8. Byte reader (`byteReader.ts`)

```typescript
export const MAX_ROLLOUT_LINE_BYTES = 1_048_576

export type ByteReader = {
  push(chunk: Uint8Array): string[]
  byteOffset(): number
}

export function createByteReader(): ByteReader
```

- `push` appends bytes, decodes only through the last `\n` (byte `0x0A`), and returns those complete lines without the newline.
- A UTF-8 sequence cut by the chunk boundary stays in the tail until the next `push` completes it.
- Offsets are byte offsets of the start of each returned line, counted from the start of the stream.
- A line longer than `MAX_ROLLOUT_LINE_BYTES` is dropped, counted by the caller via a thrown `LineTooLong` or a returned `{ dropped: true }` — pick one, test it. Resume after the next newline. Do not parse the oversized line.
- `\r\n` is one line ending. Do not leave a trailing `\r` in the JSON.

---

## 9. Tests

### 9.1 `test/openaiHistoryUsage.test.ts`

- Fixture counts → T=110000, anomaly false.
- Null `cached_input_tokens` stays null.
- `cached_input_tokens: 0` stays 0.
- `C > I` sets anomaly and keeps both numbers.
- `total_tokens` that disagrees with `I + O` sets anomaly.
- `turn_token_usage` / `thread_token_usage` objects sitting beside `usage` are not read by `normalizeUsage` (pass only the `usage` object; the parser test proves the record ignores the siblings).
- Non-zero `cache_write_input_tokens` is stored and is not part of T.

### 9.2 `test/codexRolloutParser.test.ts`

Fixtures under `test/fixtures/codex-rollouts/`:

| File | Assert |
|------|--------|
| `session-meta.jsonl` | Context filled. No request. Second meta does not emit a request. |
| `turn-context.jsonl` | Model remembered. |
| `token-usage-record.jsonl` | One candidate from `payload.usage`. Sibling `turn_token_usage` and `thread_token_usage` do not change I/O. |
| `token-count-snapshot.jsonl` | One request line plus one `token_count` → one request outcome and one snapshot outcome. |
| `snapshot-only.jsonl` | Zero request outcomes. |
| `bad-line.jsonl` | Invalid JSON → `bad-json`. |
| `dropped-body.jsonl` | A user message line → `dropped-body`, and `JSON.stringify(outcome)` does not contain the fixture sentence. |
| `fork.jsonl` | Two candidates, same `responseId`, second carries `parentConversationId`. This phase does not merge them. |
| `unknown-account.jsonl` | `accountOpaqueId` null. |
| `two-models.jsonl` | Turn context model A, later record with model B → candidate model B, evidence `response`. A record with no model → model A, evidence `turn-context`. |

### 9.3 `test/codexByteReader.test.ts`

- Split a JSONL line into two chunks → one line, same as feeding it whole.
- Split a multibyte UTF-8 character (put it in a dropped text field) across chunks → one valid line after the second push.
- Offset of the second line is the byte length of the first line including its newline.
- A line over the cap is dropped; the following short line still returns.

---

## 10. Security

Read lines as data. Fixtures are synthetic. No column and no returned field holds prompt text or tool output.

---

## 11. Handoff

Phase 2a stores candidates and snapshots. It does not re-parse. Phase 2b is the first module allowed to call `fs`.
