# Phase 5 — Recorder

**Parent:** [openai-codex.md](./openai-codex.md) §9 phase 5
**Status:** later minor. Do not start during 1.1.0.
**Depends on:** [phase-4-pricing.md](./phase-4-pricing.md) shipped
**Next:** [phase-6-organization.md](./phase-6-organization.md)
**Polish:** [phase-5-recorder.pl.md](./phase-5-recorder.pl.md)

If this file and the parent plan disagree, **the parent plan wins**. If either disagrees with the PRD, **the PRD wins**. The PRD must allow this client before the phase starts.

One Agent message. Touch only the paths in §3.

---

## 1. Goal

Import a JSONL sink the user’s own application appends. The OpenAI API chip then shows those rows. The extension still does not see other programs’ calls by itself.

**Done when:**

- An interrupted stream is `partial` or `missing`, not a confirmed `$0` (acceptance 11).
- A retry with a new `responseId` is a new request. The same `responseId` is a second observation of the same request (acceptance 12).
- The sink line never stores an API key, Authorization header, prompt, response text, tool arguments, or cookies.
- `openai.refresh` returns rows instead of `not-connected` when the sink path is set and readable.

---

## 2. Out of scope

| Item | Why |
|------|-----|
| TLS interception, ChatGPT cookies | Product rule |
| Organization usage and costs | phase 6 |
| A default admin key setting | never. Keys wait for phase 6 and `context.secrets`. |

---

## 3. Files

```
src/openaiHistory/recorder/sinkTypes.ts
src/openaiHistory/recorder/sinkParser.ts
src/openaiHistory/recorder/importer.ts
src/openaiHistory/store/migrations.ts
test/openaiRecorder.test.ts
test/fixtures/openai-sink/
```

Migration **3** adds `http_attempts`. Do not edit migrations 1–2.

Settings added in this phase, in `package.json` and `src/config.ts` only: `cursorCost.openaiSinkPath` (string, default `""`). Empty path keeps the not-connected state. Wire the Settings field in `media/src/tabs/settings.js` in this same phase because the chip cannot leave not-connected without it. `en` and `pl` only.

---

## 4. Sink lines

Three record types, one JSON object per line: `begin`, `finish`, `fail`.

| Field | On |
|-------|-----|
| `logicalOperationId`, `attemptId`, local `conversationId`, `turnId`, `requestedModel` | `begin` |
| returned model, final usage, `responseId`, status, `completedAt` | `finish` |
| safe `errorCode` | `fail` |

`begin` inserts an `http_attempts` row and a request with `usageQuality: 'missing'` and null cost. `finish` fills usage from the provider’s final usage object only. Do not sum tokens guessed from streamed text fragments. A `finish` without usage sets `partial` when the attempt had started, else `missing`. `fail` sets status and does not set cost to zero.

Normalize Responses usage (`input_tokens`, `input_tokens_details.cached_tokens`, `output_tokens`, `output_tokens_details.reasoning_tokens`, `total_tokens`) and Chat Completions (`prompt_tokens`, `completion_tokens`) in the parser. Keep one fixture per shape.

Dedup matches phase 2a: `(provider = openai, accountScopeKey, responseId)`. A new response id inserts. The same id adds an observation with `attributes_spend = 0`.

Account scope uses the sink’s own opaque project or key id when the line has one (`account:<id>`, confidence `source-reported`). Else `unknown-source:<sourceInstanceId>` for this sink file. Never the Cursor email.

---

## 5. Tests

- `begin` + `finish` with usage → one request, `reported`.
- `begin` without `finish` → `partial` or `missing`, null cost.
- Two finishes, two response ids, one `logicalOperationId` → two requests.
- Two finishes, one response id → one request, two observations.
- A line that contains `Authorization` or a prompt field is skipped and counted, and the forbidden text is absent from the database.

---

## 6. Handoff

Phase 6 may compare these rows with organization buckets. It must not write organization dollars onto them.
