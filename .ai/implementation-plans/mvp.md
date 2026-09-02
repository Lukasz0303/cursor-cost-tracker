# MVP implementation plan — Cursor Cost Tracker

**Status:** ready to implement  
**Date:** 2026-09-01  
**Scope:** PRD phases **MVP only** (status bar + Last 100 + polling). Not v1.1 / v1.2 / v2.  
**Sources of truth:** [prd.md](../context/prd.md) · [tech-stack.md](../context/tech-stack.md) · [architecture.md](../context/architecture.md) · [security.md](../context/security.md)  
**Polish translation:** [mvp.pl.md](./mvp.pl.md)  
If this plan and the English PRD disagree, **the PRD wins**.

---

## 1. Goal

Ship a VSIX that, on a signed-in Cursor machine:

1. Shows **Current** and **Today** on the status bar within 10 s of startup (non-blocking `activate`).
2. Opens **Last 100 Cursor queries** on click (no Quick Pick).
3. Refreshes on command / sync icon and on a 5-minute poll.
4. Never leaks the session token to logs or the webview.

Maps to PRD stories **A1–A7**, goals **G1–G5**, acceptance **§13**.

---

## 2. Out of scope (do not implement)

| Item | Why |
|------|-----|
| Quick Pick as default click | PRD §5.3 |
| Activity Bar / sidebar | v1.1 / v1.2 |
| 80%/90% notifications | v1.1 |
| Copy stats, CSV, Secret Storage | v1.1 / v2 |
| React/Vue, axios, webpack, native sqlite-only | tech-stack |
| Open VSX publish | v2; local VSIX is enough |
| Manual token in settings | v2 |

---

## 3. Suggested work order

Do phases in order. Later phases depend on earlier types and `UsageService`.

| Phase | Name | Delivers | Stories | Detailed plan |
|-------|------|----------|---------|---------------|
| **0** | Scaffold | `package.json`, esbuild, tsconfig, Vitest, empty `activate` | — | [phase-0-scaffold.md](./phase-0-scaffold.md) |
| **1** | Domain types + parse + format | Pure functions + unit tests | G3 (numbers) | [phase-1-parse-format.md](./phase-1-parse-format.md) |
| **2** | Session | `state.vscdb` copy + sql.js + JWT `sub` | A6 | [phase-2-session.md](./phase-2-session.md) |
| **3** | Cursor API | summary + events, timeout, AbortController | A1 A2 A5 | [phase-3-cursor-api.md](./phase-3-cursor-api.md) |
| **4** | UsageService | snapshot, poll, cache | G1 G5 | [phase-4-usage-service.md](./phase-4-usage-service.md) |
| **5** | Status bar | Current, Today, Refresh, colors, tooltips | A1 A2 A4 A5 A7 | [phase-5-status-bar.md](./phase-5-status-bar.md) |
| **6** | History webview | Last 100 table, CSP, reuse panel | A3 G2 | [phase-6-history-webview.md](./phase-6-history-webview.md) |
| **7** | Wire-up + VSIX | commands, settings, security grep | G4 §13 | [phase-7-wire-up.md](./phase-7-wire-up.md) |

Index of all phase files (EN + PL): [README.md](./README.md).

Estimated size: **3–5 days** (PRD §11), assuming one developer.

---

## 4. Target tree (create as you go)

```
package.json
tsconfig.json
esbuild.mjs
.eslintrc.cjs          # optional in phase 0
.vscodeignore
src/
  extension.ts
  config.ts
  format.ts
  usage/
    types.ts
    session.ts
    api.ts
    parse.ts
    service.ts
  ui/
    statusBar.ts
    historyPanel.ts
media/
  history.html
  history.css
  history.js
test/
  format.test.ts
  parse.test.ts
  dailyBudget.test.ts
  fixtures/            # anonymized JSON, no tokens
```

Update [architecture.md](../context/architecture.md) if this layout changes.

---

## 5. Shared types (`src/usage/types.ts`)

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

Webview payload: `{ type: 'data', events: UsageQuery[] }` only — **no** email required in MVP table; **never** token/cookie.

---

## 6. Phase 0 — Scaffold

**Detailed plan:** [phase-0-scaffold.md](./phase-0-scaffold.md)

**Files:** `package.json`, `tsconfig.json`, `esbuild.mjs`, `.vscodeignore`, `src/extension.ts`

**`package.json` (must include):**

- `name`: `cursor-cost-tracker` (or `cursor-cost`); `displayName`: Cursor Cost Tracker
- `icon`: `icon.png` (repo-root product icon)
- `publisher`: placeholder matching future Open VSX namespace
- `engines.vscode`: `^1.85.0`
- `activationEvents`: `["onStartupFinished"]`
- `main`: `./dist/extension.js`
- `extensionKind`: `["ui"]`
- `contributes.commands`: `cursorCost.showHistory`, `cursorCost.refresh`
- `contributes.configuration`: `cursorCost.pollIntervalMinutes` (1–60, default 5), `showStatusBar`, `showToday`
- scripts: `build` (esbuild), `watch`, `test` (vitest), `package` (vsce)
- `devDependencies`: `typescript`, `esbuild`, `@types/vscode` ^1.85, `@vscode/vsce`, `vitest`
- `dependencies`: `sql.js` (and ship wasm via esbuild loader / copy to `dist`)

**esbuild:** entry `src/extension.ts`, `bundle: true`, `format: 'cjs'`, `platform: 'node'`, `external: ['vscode']`, `outfile: dist/extension.js`. Copy or load `sql.js` wasm so runtime can `initSqlJs({ locateFile })`.

**tsconfig:** ES2022, `strict`, `noUncheckedIndexedAccess`, `module`/`moduleResolution` Node16.

**`.vscodeignore`:** exclude `src/**`, tests, `.ai/**`, `.cursor/**`; **keep** `dist/`, `media/`, `LICENSE`, `package.json`, `icon.png`, wasm.

**`activate`:** empty subscriptions; `deactivate` no-op. Must return in milliseconds (no `await` of network).

**Done when:** `npm run build` produces `dist/extension.js`; F5 / install empty VSIX does not crash.

---

## 7. Phase 1 — Parse and format (no VS Code)

**Detailed plan:** [phase-1-parse-format.md](./phase-1-parse-format.md)

**Files:** `src/usage/parse.ts`, `src/format.ts`, `test/*.test.ts`, `test/fixtures/`

### 7.1 Parse (PRD §8)

| Function | Behavior |
|----------|----------|
| `centsToUsd(cents)` | divide by 100; guard NaN |
| `pickUsagePool(summary)` | individual `onDemand` → `plan` → team `onDemand` → `overall`; skip pools with limit > 1,000,000 cents (`isPersonalMonthlyPool`); never `teamUsage.pooled` |
| `isUnlimited(pool)` | hide Today in UI when true |
| `mapEventToQuery(raw)` | cost from `chargedCents` / `tokenUsage.totalCents` / `usageBasedCosts`; tokens = input + output + cache read/write if present |
| `workingDaysLeftInMonth(from: Date)` | Mon–Fri remaining including today (local TZ) |
| `dailyBudgetUsd(remaining, days)` | `remaining / days`; null if days ≤ 0 or remaining null |
| `sumTodayUsedUsd(events, now)` | sum cost of events whose local calendar day is today |
| `stripModelPrefix(model)` | drop leading `cursor-` for display |

Use **anonymized** fixture JSON (strip tokens). Cover: missing limit, unlimited, empty events, month-end Friday, mixed cent fields.

### 7.2 Format

| Function | Example |
|----------|---------|
| `formatDollars(n)` | `3.79 $` (2 decimals) |
| `formatTokens(n)` | `64,755` in table; optional `64.8k` only if needed later (PRD table uses full with commas) |
| `formatDateTime(ms)` | `1.09.2026, 10:05:12` (local) |
| `formatKind(kind)` | humanize API kind (`Included In Business`) |

**Done when:** `npm test` green for parse + format.

---

## 8. Phase 2 — Session

**Detailed plan:** [phase-2-session.md](./phase-2-session.md)

**File:** `src/usage/session.ts`

1. Resolve DB path by `process.platform` (PRD §8 table).
2. If file missing → `{ ok: false, error: 'Sign in to Cursor' }` (user-facing English).
3. `fs.copyFile` / read into `Buffer` (never open exclusive write). Init sql.js on the copy.
4. `SELECT value FROM ItemTable WHERE key = ?` for `cursorAuth/accessToken`.
5. Decode JWT payload (base64url, **no** extra JWT library) → `sub`.
6. Cookie: `WorkosCursorSessionToken=${sub}::${accessToken}`.
7. Return `{ ok: true, cookie, email? }` if email is in the same DB (optional key); otherwise email null.

**Never log** cookie, token, `sub`.

**Done when:** unit-test path helpers with mocked `fs`; optional skip live DB in CI.

---

## 9. Phase 3 — HTTP API

**Detailed plan:** [phase-3-cursor-api.md](./phase-3-cursor-api.md)

**File:** `src/usage/api.ts`

| Call | Method | Notes |
|------|--------|-------|
| Usage summary | `GET https://cursor.com/api/usage-summary` | `Cookie` header |
| Events | `POST https://cursor.com/api/dashboard/get-filtered-usage-events` | JSON `{ page, pageSize, startDate?, endDate? }` |

- `pageSize=100` for Last 100 (page 1).
- Today: paginate with date filter (cap e.g. 50 pages); if empty, fallback without filter then filter client-side by today.
- `AbortSignal.timeout(15_000)` or merged AbortController from service.
- Allowlist host `cursor.com` only.
- Independent errors: summary fail → snapshot error; events fail → `todayUsedUsd: null` and `recentQueries: []` but Current still works if summary ok.

**Done when:** functions accept `cookie` + `signal`; tests with mocked `fetch`.

---

## 10. Phase 4 — UsageService

**Detailed plan:** [phase-4-usage-service.md](./phase-4-usage-service.md)

**File:** `src/usage/service.ts`

- `start()`: emit `loading`, then `refresh()` without blocking activate.
- `refresh()`: abort previous controller; session → Promise.all summary + recent events; compute today/budget; emit `ready` or `error`.
- Poll: `setInterval` from `config.pollIntervalMinutes` (clamp 1–60). Clear on `dispose`.
- `onDidChange` EventEmitter for UI.
- Cache last `ready` in memory so history panel can open in &lt; 2 s (G2). Optionally write a **sanitized** snapshot to `globalState` (no cookie).

**Done when:** fake session/api in tests: loading → ready; abort; poll interval from config.

---

## 11. Phase 5 — Status bar

**Detailed plan:** [phase-5-status-bar.md](./phase-5-status-bar.md)

**File:** `src/ui/statusBar.ts`  
**PRD:** §5.1, A1 A2 A4 A5 A7

Three items, `StatusBarAlignment.Right`, priority ~100 / 99 / 98:

| Item | Command | Visible when |
|------|---------|----------------|
| Current | `cursorCost.showHistory` | `showStatusBar` |
| Today | `cursorCost.showHistory` | `showStatusBar` && `showToday` && not unlimited && `todayUsedUsd !== null` |
| Refresh | `cursorCost.refresh` | `showStatusBar` |

**Render:**

- `loading`: `$(loading~spin) …`
- `error`: `$(warning) N/A` + tooltip = `message`
- `unlimited`: Current `$(credit-card) Unlimited`; hide Today
- `ready`: `$(credit-card) {used} / {limit}`; Today `$(calendar) {today} / {budget}`
- Color: `charts.red` if over 100%; yellow if ≥ 90% month (Current) or ≥ 80% day (Today); else green/default
- Tooltip Current: `email · plan · cycle ends {date}` (A7)
- Tooltip Today: remaining / working days explanation (short English)
- `accessibilityInformation` on each item

Respect `showStatusBar` / `showToday` via `config.ts` + `onDidChangeConfiguration`.

**Done when:** mock snapshots update item text/color; hide Today on unlimited and on null today.

---

## 12. Phase 6 — Last 100 webview

**Detailed plan:** [phase-6-history-webview.md](./phase-6-history-webview.md)

**Files:** `src/ui/historyPanel.ts`, `media/history.html|css|js`  
**PRD:** §5.2, A3, G2

- `createWebviewPanel('cursorCost.history', 'Last 100 Cursor queries', ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [media] })`
- Reuse existing panel (`reveal`) if already open
- CSP nonce; `enableCommandUris: false`
- HTML: header + Close button (`postMessage { type: 'close' }`) + table columns TIME, MODEL, COST, TOKENS, INPUT / OUTPUT, KIND
- CSS: `--vscode-foreground`, `--vscode-editor-background`, `--vscode-font-family`; table monospace; row separators
- On `ready` from webview: send cached `events` (newest first)
- Subscribe to `UsageService`; on refresh, `postMessage { type: 'data', events }`
- Close disposes panel ref

**Done when:** opening twice focuses one panel; payload has no token fields (code review / command `9-security-token-audit`).

---

## 13. Phase 7 — Wire-up, package, verify

**Detailed plan:** [phase-7-wire-up.md](./phase-7-wire-up.md)

**File:** `src/extension.ts`, `src/config.ts`

```
activate:
  config wrapper
  UsageService.start()
  StatusBarController.register
  HistoryPanel.register
  commands: showHistory, refresh
  onDidChangeConfiguration → reconfigure poll / visibility
  subscriptions.push(service, statusBar, panel)
```

Then:

1. `npm test`
2. Command `9-security-token-audit` (grep token strings in `src/` + `dist/`)
3. `npm run build` + `vsce package --no-dependencies`
4. Command `6-install-in-cursor`
5. Manual checklist = PRD §13 (Windows P0)
6. Update [codebase-snapshot.md](../context/codebase-snapshot.md)

**Done when:** all §13 boxes can be checked on a signed-in Cursor.

---

## 14. Story → phase map

| Story | Phase |
|-------|-------|
| A1 Current | 3–5 |
| A2 Today | 1, 3–5 |
| A3 click Last 100 | 6–7 |
| A4 warning color | 5 |
| A5 Refresh | 4–5, 7 |
| A6 no token message | 2, 5 |
| A7 tooltip plan/cycle | 3, 5 |

---

## 15. Risks during implementation

| Risk | Mitigation in this plan |
|------|-------------------------|
| Locked `state.vscdb` on Windows | copy file (phase 2) |
| sql.js wasm missing in VSIX | copy in esbuild / vsce (phase 0) |
| Unofficial JSON shape | isolate parse; fixtures; degrade to error snapshot |
| `engines.vscode` too new for Cursor | keep `^1.85.0` until Help → About says otherwise |
| Rate limit | min poll 5 min; one in-flight refresh |

---

## 16. Later (not this plan)

- **v1.1:** spike `!` (default 1M tokens), Ignore — [token-spike.md](./token-spike.md); also 80/90% spend alerts, Copy stats  
- **v1.2:** sidebar, optional Quick Pick  
- **v2:** Secret Storage, CSV, Open VSX (`publishing.md`)

Implement those only after MVP §13 is done.
