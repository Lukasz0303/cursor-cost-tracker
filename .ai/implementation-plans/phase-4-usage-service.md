# Phase 4 — UsageService

**Parent:** [mvp.md](./mvp.md)  
**Status:** ready to implement  
**Depends on:** [phase-1-parse-format.md](./phase-1-parse-format.md), [phase-2-session.md](./phase-2-session.md), [phase-3-cursor-api.md](./phase-3-cursor-api.md)  
**Next:** [phase-5-status-bar.md](./phase-5-status-bar.md)  
**Polish:** [phase-4-usage-service.pl.md](./phase-4-usage-service.pl.md)  
**PRD:** G1 (bar within 10 s), G5 (non-blocking), A5 (refresh), §8 poll 5 min

If this file and [mvp.md](./mvp.md) or the English PRD disagree, **the PRD wins**.

---

## 1. Goal

Orchestrate session + API + parse into a `UsageSnapshot`. Emit `loading` then refresh **without blocking** `activate()`. Poll on a clamped interval. One in-flight request (`AbortController`). Cache last `ready` so the history panel can open in &lt; 2 s (G2).

**Done when:** tests with fake session/api cover loading → ready, abort, and poll interval from config.

---

## 2. Out of scope

| Item | When |
|------|------|
| StatusBarItem / WebviewPanel | phases 5–6 |
| `activate()` wiring | phase 7 |
| Persist Ignore keys | v1.1 |
| Cookie in `globalState` | never |

---

## 3. Files

```
src/usage/service.ts
test/service.test.ts
```

Optional later: `src/config.ts` exists in phase 5; until then inject `pollIntervalMinutes` as a number (default 5).

---

## 4. Public API

```typescript
export type UsageDependencies = {
  readSession: () => Promise<SessionResult>
  fetchSummary: (cookie: string, signal: AbortSignal) => Promise<FetchSummaryResult>
  fetchEvents: (cookie: string, signal: AbortSignal) => Promise<FetchEventsResult>
  now?: () => Date
}

export class UsageService implements vscode.Disposable {
  constructor(deps: UsageDependencies, options?: { pollIntervalMinutes?: number })
  start(): void
  refresh(): Promise<void>
  dispose(): void
  readonly onDidChange: vscode.Event<UsageSnapshot>
  getSnapshot(): UsageSnapshot
  getCachedQueries(): UsageQuery[]
}
```

Prefer injecting deps so Vitest never needs a real DB or network. If you want to avoid importing `vscode` in unit tests, use a tiny `EventEmitter` interface (`{ event, fire, dispose }`) and adapt to `vscode.EventEmitter` in phase 7 — or mock `vscode` in vitest. Choose one; tests must run in Node.

`pollIntervalMinutes`: clamp **1–60**. Default **5**. Do not poll faster than 1 minute (rate limit).

---

## 5. Behavior

### 5.1 `start()`

1. Emit `{ status: 'loading' }` if there is no cached ready yet.
2. Call `refresh()` **without awaiting it in `activate`** (phase 7: `void service.start()` / `void service.refresh()`).
3. Start `setInterval` for poll. Store the timer handle for `dispose`.

`start()` itself must not `await` network.

### 5.2 `refresh()`

1. Abort the previous controller if a refresh is in flight.
2. Create a new `AbortController`.
3. `readSession()`:
   - `ok: false` → emit `{ status: 'error', message }` (A6). Stop.
4. `Promise.all` summary + events (same cookie, same signal).
5. If summary `ok: false` → emit error snapshot (Current cannot render).
6. If summary OK:
   - Parse pool → used/limit/unlimited/plan/cycle end (`buildUsageReady` / parse helpers).
   - If events `ok: false` → `todayUsedUsd: null`, `recentQueries: []`, still `status: 'ready'`.
   - If events OK → map queries, `sumTodayUsedUsd`, `dailyBudgetUsd(remaining, workingDaysLeftInMonth(now))`.
7. Emit `{ status: 'ready', data }`.
8. Keep last ready in memory (`getCachedQueries()` returns `data.recentQueries`).

Ignore `AbortError` from a superseded refresh (do not emit error for the user).

### 5.3 Cache

- In-memory last `ready` is required (G2).
- Optional: write a **sanitized** snapshot to `globalState` (used/limit/today/queries only). **Never** cookie, token, `sub`. If you skip globalState in MVP, document that cold start always hits the network (still OK if &lt; 10 s, G1).

### 5.4 `dispose()`

`clearInterval`, abort in-flight, dispose emitter. Phase 7 pushes the service onto `context.subscriptions`.

### 5.5 Reconfigure poll

Phase 7 will call something like `setPollIntervalMinutes(n)` on config change. Add a method now or a `reconfigure({ pollIntervalMinutes })` that restarts the timer. Clamp 1–60.

---

## 6. Tests (`test/service.test.ts`)

Fake `readSession` / `fetchSummary` / `fetchEvents`.

| Case | Expect |
|------|--------|
| start | first event is `loading`, then `ready` |
| session error | `error` with the session message; no fetch calls |
| summary fail | `error`; events may still have been called (Promise.all) — acceptable |
| events fail, summary OK | `ready`, `todayUsedUsd === null`, `recentQueries.length === 0` |
| second `refresh` | first fetch aborted (signal `aborted === true`) |
| `dispose` | no further emissions after dispose; timer cleared |
| poll clamp | `0` → 1; `99` → 60 |

Use fake timers (`vi.useFakeTimers`) for poll. Do not print cookies in assertions; compare `ok` flags only.

---

## 7. Security

- Service may hold `cookie` only in a local variable inside `refresh`, not on `this`.
- `getSnapshot()` / cache / globalState: no cookie field.
- Do not log snapshot with email if you later add verbose logging — email is allowed in the status-bar tooltip (A7) but not required in logs.

---

## 8. Handoff to phase 5

Status bar subscribes to `onDidChange` and reads `getSnapshot()`. It must not call session or API itself. Commands `refresh` will call `service.refresh()` in phase 7.
