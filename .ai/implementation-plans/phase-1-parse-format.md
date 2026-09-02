# Phase 1 — Domain types, parse, format

**Parent:** [mvp.md](./mvp.md)  
**Status:** ready to implement  
**Depends on:** [phase-0-scaffold.md](./phase-0-scaffold.md) (`npm test` works)  
**Next:** [phase-2-session.md](./phase-2-session.md)  
**Polish:** [phase-1-parse-format.pl.md](./phase-1-parse-format.pl.md)  
**PRD:** §8 (data), G3 (numbers ± $0.01)  
**Stories:** A2 (daily budget math)

If this file and [mvp.md](./mvp.md) or the English PRD disagree, **the PRD wins**.

---

## 1. Goal

Pure functions that turn unofficial Cursor JSON into `UsageReady` / `UsageQuery` and format dollars, tokens, dates, and kind for the UI. No `vscode` import, no `fetch`, no SQLite.

**Done when:** `npm test` is green for parse + format + daily budget.

---

## 2. Out of scope

| Item | When |
|------|------|
| Reading `state.vscdb` | phase 2 |
| HTTP | phase 3 |
| Status bar / webview | phases 5–6 |
| Token-spike `!` / Ignore | v1.1 |

---

## 3. Files

```
src/usage/types.ts
src/usage/parse.ts
src/format.ts
test/format.test.ts
test/parse.test.ts
test/dailyBudget.test.ts
test/fixtures/usage-summary.sample.json
test/fixtures/usage-events.sample.json
```

Fixtures must be **anonymized**: no access tokens, cookies, emails that look real, or JWT strings. Invent cents and models only.

---

## 4. Types (`src/usage/types.ts`)

Copy from [mvp.md](./mvp.md) §5. Discriminated union for snapshots:

```typescript
export type UsageQuery = {
  timestamp: number
  model: string | null
  kind: string | null
  costUsd: number
  tokens: number
  inputTokens: number
  outputTokens: number
}

export type UsageReady = {
  email: string | null
  plan: string | null
  usedUsd: number
  limitUsd: number | null
  remainingUsd: number | null
  todayUsedUsd: number | null
  dailyBudgetUsd: number | null
  workingDaysLeft: number | null
  billingCycleEnd: string | null
  isUnlimited: boolean
  recentQueries: UsageQuery[]
}

export type UsageSnapshot =
  | { status: 'loading' }
  | { status: 'ready'; data: UsageReady }
  | { status: 'error'; message: string }
```

Keep API-wire types in `parse.ts` (or `src/usage/apiTypes.ts` if the JSON is large) as `unknown`-first interfaces. Do not put cookie/token fields on `UsageQuery` or `UsageReady`.

---

## 5. Parse (`src/usage/parse.ts`)

Guard clauses, early returns, happy path last. Explicit return types on exports. No `any`.

| Function | Behavior | Edge cases |
|----------|----------|------------|
| `centsToUsd(cents: number): number` | `cents / 100` | `NaN`, `Infinity` → `0` (or skip the event; pick one and test it) |
| `pickUsagePool(summary: unknown)` | individual `onDemand` → `plan` → team `onDemand` → `overall` | missing pools; skip non-personal if a flag exists |
| `isUnlimited(pool): boolean` | true when the selected pool has no cap / unlimited | hide Today in UI later |
| `mapEventToQuery(raw: unknown): UsageQuery \| null` | cost from `chargedCents` **or** `tokenUsage.totalCents` **or** `usageBasedCosts`; tokens = input + output + cache read/write if present | unparseable → `null` (drop row) |
| `workingDaysLeftInMonth(from: Date): number` | Mon–Fri remaining **including today**, local TZ | month-end Friday → `1`; Saturday/Sunday → remaining weekdays after weekend |
| `dailyBudgetUsd(remainingUsd: number \| null, days: number): number \| null` | `remaining / days` | `null` if `days ≤ 0` or `remainingUsd == null` |
| `sumTodayUsedUsd(events: UsageQuery[], now: Date): number` | sum `costUsd` where local calendar day === today | empty list → `0`; timezone: **local**, not UTC date |
| `stripModelPrefix(model: string \| null): string \| null` | drop a leading `cursor-` | `null` stays `null`; do not strip mid-string |

Also export a composer used by phase 4, e.g. `buildUsageReady({ summary, events, now, email? }): UsageReady`, so the service does not re-implement pool + budget + today math.

Treat JSON as unofficial: never throw into the extension host from parse. Return `null` / empty / safe zeros.

### 5.1 Cost field precedence for one event

1. `chargedCents` if a finite number  
2. else `tokenUsage.totalCents`  
3. else sum/known field on `usageBasedCosts` if present  
4. else `0` (still show the row if tokens exist) or `null` to drop — document the choice in a test

### 5.2 Token total

`tokens = input + output + cacheRead + cacheWrite` when those keys exist; otherwise `input + output`. Table columns INPUT / OUTPUT stay the raw input/output (not cache).

---

## 6. Format (`src/format.ts`)

English UI strings only.

| Function | Example | Rules |
|----------|---------|--------|
| `formatDollars(n: number): string` | `3.79 $` | always 2 decimal places; space before `$` |
| `formatTokens(n: number): string` | `64,755` | full number with grouping separators; **not** `64.8k` in MVP |
| `formatDateTime(ms: number): string` | `1.09.2026, 10:05:12` | local timezone; day.month.year |
| `formatKind(kind: string \| null): string` | `Included In Business` | humanize API enums (`INCLUDED_IN_BUSINESS` → title case with spaces); empty → `—` or `Unknown` (pick one, test it) |

`stripModelPrefix` may live in parse (domain) while the table calls it before display; do not duplicate.

---

## 7. Tests

Run: `npm test` (command `4-run-tests`).

### 7.1 `parse.test.ts`

- cents: `379` → `3.79`; NaN → guarded
- pool order: onDemand individual wins over plan
- missing limit / unlimited pool
- mixed cent fields on events
- empty events → empty queries
- `mapEventToQuery` drops garbage objects

### 7.2 `dailyBudget.test.ts`

- remaining `100`, 10 weekdays → `10`
- `days <= 0` → `null`
- `workingDaysLeftInMonth` on a Friday that is the last day of the month → `1`
- weekend: does not count Sat/Sun as working days

Freeze `Date` via an injected `from` / `now` argument — do not depend on the machine clock.

### 7.3 `format.test.ts`

- `formatDollars(3.79)` → `3.79 $`
- `formatTokens(64755)` → grouped thousands
- `formatDateTime` with a fixed timestamp + known locale/TZ assumption documented in the test (Windows local TZ)

### 7.4 Fixtures

`test/fixtures/*.json`: realistic keys from usage-summary and get-filtered-usage-events, with fake numbers. If you capture a live response while developing, **strip** tokens, cookies, emails, `sub`, and do not commit raw dumps.

---

## 8. Security

No secrets in fixtures or test names. Parse must not stringify full API bodies into errors that phase 4 might log.

---

## 9. Handoff to phase 2

Phase 2 only reads a cookie from SQLite. It will import nothing from parse except possibly shared result-style types. Keep parse free of `fs` and `vscode`.
