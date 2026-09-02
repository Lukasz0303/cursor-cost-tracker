# Phase 3 — Cursor usage HTTP API

**Parent:** [mvp.md](./mvp.md)  
**Status:** ready to implement  
**Depends on:** [phase-1-parse-format.md](./phase-1-parse-format.md) (`mapEventToQuery`, pool helpers); cookie shape from [phase-2-session.md](./phase-2-session.md)  
**Next:** [phase-4-usage-service.md](./phase-4-usage-service.md)  
**Polish:** [phase-3-cursor-api.pl.md](./phase-3-cursor-api.pl.md)  
**PRD:** §8 Current / Today / Last 100, A1 A2 A5  
**Security:** [security.md](../context/security.md) host allowlist

If this file and [mvp.md](./mvp.md) or the English PRD disagree, **the PRD wins**.

---

## 1. Goal

`fetch`-only client for Cursor usage endpoints. Pass `cookie` + `AbortSignal`. Parse via phase 1. Independent failure: events can fail while summary still works.

**Done when:** functions accept `cookie` + `signal`; Vitest mocks `fetch` (no live network in CI).

---

## 2. Out of scope

| Item | When |
|------|------|
| Polling / EventEmitter | phase 4 |
| axios, extra HTTP libs | never |
| Non-`cursor.com` hosts | never |
| Sending cookie to the webview | never |

---

## 3. Files

```
src/usage/api.ts
test/api.test.ts
```

Keep URL strings in one place at the top of `api.ts`.

---

## 4. Endpoints

| Purpose | Method | URL | Body / query |
|---------|--------|-----|----------------|
| Current (cycle) | `GET` | `https://cursor.com/api/usage-summary` | Cookie header only |
| Last 100 + Today | `POST` | `https://cursor.com/api/dashboard/get-filtered-usage-events` | JSON `{ page, pageSize, startDate?, endDate? }` |

Headers:

```
Cookie: <session cookie>
Content-Type: application/json   // POST only
```

Do not send `Authorization: Bearer`. Do not add third-party telemetry headers.

Timeout: merge caller `signal` with a 15 s timeout (`AbortSignal.timeout(15_000)` or `AbortSignal.any`). Phase 4 owns the parent `AbortController` (one in-flight refresh).

Host allowlist: refuse to fetch if `new URL(url).hostname` is not `cursor.com` (and not `www.cursor.com` unless you explicitly allow it — default **only** `cursor.com` as in the PRD).

---

## 5. Public API

```typescript
export type FetchSummaryResult =
  | { ok: true; raw: unknown }
  | { ok: false; message: string }

export type FetchEventsResult =
  | { ok: true; queries: UsageQuery[] }
  | { ok: false; message: string }

export function fetchUsageSummary(
  cookie: string,
  signal: AbortSignal,
): Promise<FetchSummaryResult>

export function fetchRecentEvents(
  cookie: string,
  signal: AbortSignal,
  options?: { pageSize?: number },
): Promise<FetchEventsResult>
```

`pageSize` default **100**, `page` **1** for Last 100.

Today (used in phase 4, may live here):

- Prefer POST with `startDate` / `endDate` covering the local calendar day; paginate (`page++`) with a **cap of 50 pages**.
- If the filtered response is empty, fallback: one unfiltered Last-100 (or paginated) request, then `sumTodayUsedUsd` / filter by local day in parse (phase 1).
- If events fail entirely, return `ok: false` — phase 4 sets `todayUsedUsd: null`, `recentQueries: []`, and still uses summary for Current.

HTTP non-OK (401/403/5xx): `ok: false` with a **generic** English message (`Could not load usage`, `Sign in to Cursor` on 401/403). Do not include response body text (may contain account data). Do not include the cookie.

`AbortError`: propagate or map to `ok: false` with `Cancelled` — phase 4 should ignore stale aborts.

---

## 6. Work order

1. Constants for the two URLs; helper `assertCursorHost(url: string): void`.
2. `fetchUsageSummary`: GET, `response.json()` as `unknown`, no parse beyond JSON.
3. `fetchRecentEvents`: POST page 1, `pageSize=100`; map each raw event with `mapEventToQuery`; drop `null`s; sort newest first (`timestamp` descending) if the API is unordered.
4. Optional `fetchTodayEvents` used by the service, or let the service call recent + `sumTodayUsedUsd` only when the date filter is skipped.
5. Never log headers or bodies.

Parse of summary pools stays in `parse.ts` (`pickUsagePool`). `api.ts` returns raw summary JSON so the service can call parse once.

---

## 7. Error isolation (contract for phase 4)

| Failure | Current | Today | Last 100 |
|---------|---------|-------|----------|
| Summary fails | error snapshot | — | — |
| Events fail, summary OK | ready from summary | `todayUsedUsd: null` (hide Today in UI) | `recentQueries: []` |
| Both OK | ready | computed | last 100 |

This phase implements the fetch outcomes; phase 4 maps them onto `UsageSnapshot`.

---

## 8. Tests (`test/api.test.ts`)

Mock global `fetch`.

- GET summary: correct URL, `Cookie` header equals the input cookie, no `Authorization`
- POST events: JSON body has `page: 1`, `pageSize: 100`
- 401 → `ok: false`, message does not contain the cookie
- malformed JSON → `ok: false`
- `mapEventToQuery` applied (fixture page → `UsageQuery[]`)
- abort: `signal` already aborted → no hang
- host allowlist: if a helper is exported, non-cursor.com throws / returns error **before** fetch

Do not hit the real network in CI.

---

## 9. Security

- Cookie only as a function argument, never a module-level global that tests might print
- No `console.log` of `cookie` or response
- Allowlist hostname before `fetch`

---

## 10. Handoff to phase 4

`UsageService.refresh()` will: `readCursorSession` → if err, snapshot error → else `Promise.all` summary + events → `buildUsageReady` → emit `ready`. API module stays free of `setInterval` and vscode.
