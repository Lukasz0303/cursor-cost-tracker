# Codex local history and OpenAI API guide

Use this guide only when a task touches `src/openaiHistory/`, the history-source
switch, local Codex rollout files, OpenAI credentials, or a proposed API-backed
capability. It prevents two common mistakes: treating local Codex history as
OpenAI API usage, and exposing credentials or prompt content while wiring UI.

## Current product boundary

| Source in the panel | What the extension does now | What it must not imply |
|---|---|---|
| Cursor | reads the local Cursor session and calls Cursor usage endpoints | OpenAI/Codex usage or an OpenAI invoice |
| Codex local | imports usage metadata from local Codex rollout files into extension global storage and estimates list price locally | prompts/tool output were read, uploaded, or billed as API calls |
| OpenAI API | presents a connect path; an organization admin key can be checked from Secret Storage and a local JSONL path can be configured | the extension can discover or table arbitrary calls made by other programs |

The status bar, Cursor forecast, burn-rate guard, and Coding stats remain on the
Cursor source. A Codex estimate is not an invoice. OpenAI API screens must use
their own empty/connect state, never a Cursor total as fallback.

## Security and data contract

- Never add a Cursor session token, cookie, OpenAI API/admin key, rollout prompt
  body, tool output, or absolute local path to a log, setting, CSV, or webview
  message.
- Cursor credentials remain extension-host-only. An OpenAI organization admin
  key belongs in VS Code Secret Storage, not `cursorCost.*` configuration.
- The local Codex importer is read-only. Its imported copy belongs in extension
  global storage; it must not modify `~/.codex`, `state.vscdb`, the workspace,
  or rollout files.
- A Webview message is an untrusted input. Parse and clamp it in
  `src/webview/messages.ts`; keep the host payload to validated metadata.
- No API request is added “for verification.” Current behavior permits an
  `api.openai.com` organization-key check only after user action; there is no
  product telemetry and no stored organization bucket history.

Read [`../context/security.md`](../context/security.md) with every change to
this boundary.

## Correct planning route

| Proposed change | Start with | Required decision before code |
|---|---|---|
| Parse a rollout field or usage shape | `codex/rolloutParser.ts`, `domain.ts`, parser fixture/test, phase 1 only if the field is truly absent | whether it is a request, a cumulative snapshot, or metadata; prompt/tool bodies are always dropped |
| Local import/store/query bug | exact `codex/` or `store/` module and focused test | idempotency key, source/account scope, and data-retention effect |
| Table/Stats/Charts for Codex local | `historyQuery.ts` / host payload / exact `media/src` owner and test | separate source and cost basis; no Cursor fallback |
| Pricing/table estimate | `pricing/`, decimal/cost tests, phase 4 for missing behavior | price basis and nullable/partial coverage; never present estimate as invoice |
| New application-call recorder | PRD change first, then phase 5 | explicit user opt-in, record schema, retention, and how the app writes the sink |
| Organization comparison or usage buckets | PRD change first, then phase 6 | authorization, endpoint/account scope, secure storage, and label separation from estimates |

The phase files under `implementation-plans/openai-codex/` are useful detailed
design records, but their status is stale. Use the current source and tests to
find what already landed; read one phase only to design a missing capability.

## Numeric and UI invariants

For reported Codex usage, input includes cached input and output includes
reasoning. Do not add cache or reasoning a second time to totals. Preserve
unknown as `null`/`—`; never replace unknown cached usage with zero. Keep
reported cost, estimated API cost, and API-equivalent cost in distinct labeled
totals.

Any money calculation must keep its fixed-scale representation until rendering
or CSV output. A model with no known rate yields an unavailable price, not a
best guess. Date/filter behavior must use the selected source and its local
calendar semantics.

## When an OpenAI API client is genuinely added

This repository does not currently send model-generation requests to OpenAI.
If a future approved feature does, first make the product decision and add a
small, separately tested client boundary. It must have:

1. an explicit user-triggered action and documented key ownership;
2. a host-only credential path, timeout/abort/error behavior, and no key in
   exceptions or telemetry;
3. a minimal request/response schema that stores only approved metadata;
4. explicit pricing/billing labels rather than an inferred invoice; and
5. unit fixtures with synthetic identifiers and no real credentials.

Consult the current official OpenAI documentation before choosing an endpoint,
model, price, or API field. For Codex-oriented prompting and tool workflows,
start with the [official Codex Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide); do not copy model or pricing claims from this repository into the product.
