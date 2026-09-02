## feat: add MVP status bar usage, Last 100 history, and Statistics

### Overview

Implements the Cursor Cost Tracker VS Code/Cursor extension that previously existed only as product context. Current, Today, and the last 3 queries appear on the status bar; a click opens a Last 100 panel with Statistics and Settings tabs. Usage is read from the local Cursor session (`state.vscdb`) and unofficial `cursor.com` usage APIs, with polling that does not block `activate()`.

### What's Changed

#### New Features

- **Status bar** — Current (team dollar pool `used $ / limit $`, or Pro included-quota percents), Today vs daily budget, three newest queries as `cost - compact tokens`, and Refresh. Clicking Current / Today / a recent chip opens Last 100; Refresh only refreshes.
- **Token-spike `!`** — Prefix on a last-3 chip and on the Last 100 TOKENS cell when `tokens >= cursorCost.spikeTokenThreshold` (default 1M) and warnings are on. Ignore persist is still a follow-up.
- **History panel** — Reused `WebviewPanel` with three tabs: Last 100 Cursor queries (TIME, MODEL, COST, TOKENS, INPUT/OUTPUT, KIND), Statistics (progress meters and spend breakdowns), Settings (Warn at in **k**, Show warnings, Good/Warning colors).
- **Commands** — `cursorCost.showHistory` and `cursorCost.refresh`; settings under `cursorCost.*` (poll interval, bar visibility, spike threshold, colors).
- **Marketplace icon** — repo-root `icon.png` wired as `"icon"` in `package.json` and kept in the VSIX.

#### Core Components

**Usage**

- `src/usage/session.ts` — resolve OS path to `state.vscdb`; prefer `node:sqlite` read-only on the live file (multi-GB DBs); sql.js copy only when the file is under ~1.5 GiB. Parameterized `SELECT`; cookie stays in the host.
- `src/usage/api.ts` — `GET /api/usage-summary` and paged `POST /api/dashboard/get-filtered-usage-events`; host allowlist `cursor.com`, 15s timeout, `AbortController`.
- `src/usage/parse.ts` — cents → USD, pool order (individual onDemand → plan → team → overall), Pro `autoPercentUsed` / `apiPercentUsed` vs team dollars, daily budget from remaining ÷ working days left, Last 100 event mapping.
- `src/usage/service.ts` — `start()` emits loading then refreshes in the background; poll clamp 1–60 minutes; in-memory snapshot (`loading` | `ready` | `error`); Today can fail independently of Current.
- `src/usage/types.ts` — domain types including `spendDisplay: 'usd' | 'percent'`.

**UI**

- `src/ui/statusBar.ts` + `statusBarView.ts` — budget chip, recent-query chip, Refresh; user `okColor` / `warnColor`; grouped far-left-of-right priorities so VS Code does not split chips with Ln/Col.
- `src/ui/historyPanel.ts` + `media/history.{html,css,js}` — CSP nonce, `default-src 'none'`; host posts formatted rows + stats + settings; webview posts `ready` / `close` / settings updates (Warn at debounce + Apply).
- `src/ui/historyRows.ts` — table rows and webview payload (no token, cookie, or email).
- `src/ui/periodStats.ts` — Statistics tab glossary, cycle facts, Last 100 aggregates, spend-by-model/kind bars.

**Parse / format / config**

- `src/format.ts` — dollars, percents, compact tokens (`64.8k` / `1.2M`), dates, kind labels.
- `src/config.ts` — `cursorCost.*` with hex color validation.
- `src/spikes/threshold.ts` — `isSpike`, clamp, k ↔ tokens conversion (Settings edits in **k**).
- `src/extension.ts` — registers service, status bar, commands; `onDidChangeConfiguration` for poll interval; no `await` of network in `activate()`.

**Scaffold**

- `package.json` (v0.7.1), `esbuild.mjs` (bundle + copy sql.js wasm), `tsconfig.json`, `vitest.config.ts`, `.vscodeignore` (ships `dist/`, `media/`, `LICENSE`, `icon.png`), `.gitignore`, F5 launch/tasks.

#### Improvements

- **Errors** — missing session → Sign in / `N/A` without crashing; API timeout/cancel → error snapshot; unlimited plans hide Today.
- **Security** — access token used only to build the session cookie for `cursor.com`; never logged or posted to the webview. Parameterized SQLite. CSP with nonce.
- **Product docs** — PRD 2.3 → 2.6 (Pro percents, last-3 chips, Settings colors, `node:sqlite`). Architecture, tech-stack, security, publishing, and agent rules updated to match. Spike Ignore marked remaining; `!` / Settings marked done.
- **README** — rewritten from “not implemented yet” to a shipping product page (features, FAQ, troubleshooting, install, contributing).
- **Phase plans** — new EN+PL plans for MVP phases 0–7; `mvp.md` / index link to them.

### Testing

All tests are new (Vitest). Anonymized fixtures under `test/fixtures/` (no tokens).

- `test/parse.test.ts` — cents, pool pick, unlimited, event mapping, included quotas, `buildUsageReady`
- `test/dailyBudget.test.ts` — daily budget, working days left, today’s USD sum
- `test/format.test.ts` — dollars, percents, tokens, compact tokens, dates, kind
- `test/api.test.ts` — host allowlist, summary fetch, recent/today events
- `test/session.test.ts` — OS DB paths, JWT `sub`, sql.js read
- `test/service.test.ts` — poll clamp, snapshot/poll/cancel
- `test/statusBar.test.ts` — Current/Today/last-3 chips, tones, Pro percents
- `test/historyRows.test.ts` — table rows, webview payload, spike `!`
- `test/periodStats.test.ts` — Statistics aggregates
- `test/config.test.ts` — hex colors and config defaults
- `test/threshold.test.ts` — `isSpike`, clamp, k conversion

`npm test`: 117 passed, 1 skipped (live `state.vscdb`).

### Files Changed

Uncommitted vs `main` (`feat/mvp` has no commits ahead; `git diff HEAD --stat` after intent-to-add):

```
 .ai/context/README.md                              |   11 +-
 .ai/context/architecture.md                        |   21 +-
 .ai/context/codebase-snapshot.md                   |   67 +-
 .ai/context/plan.md                                |    1 +
 .ai/context/prd.md                                 |   27 +-
 .ai/context/prd.pl.md                              |   27 +-
 .ai/context/publishing.md                          |    4 +-
 .ai/context/security.md                            |    2 +-
 .ai/context/tech-stack.md                          |    7 +-
 .ai/implementation-plans/README.md                 |   24 +-
 .ai/implementation-plans/mvp.md                    |   41 +-
 .ai/implementation-plans/mvp.pl.md                 |   41 +-
 .ai/implementation-plans/phase-0-scaffold.md       |  205 +
 .ai/implementation-plans/phase-0-scaffold.pl.md    |  154 +
 .ai/implementation-plans/phase-1-parse-format.md   |  179 +
 .ai/implementation-plans/phase-1-parse-format.pl.md|  121 +
 .ai/implementation-plans/phase-2-session.md        |  163 +
 .ai/implementation-plans/phase-2-session.pl.md     |  131 +
 .ai/implementation-plans/phase-3-cursor-api.md     |  154 +
 .ai/implementation-plans/phase-3-cursor-api.pl.md  |  116 +
 .ai/implementation-plans/phase-4-usage-service.md  |  141 +
 .ai/implementation-plans/phase-4-usage-service.pl.md| 103 +
 .ai/implementation-plans/phase-5-status-bar.md     |  180 +
 .ai/implementation-plans/phase-5-status-bar.pl.md  |  124 +
 .ai/implementation-plans/phase-6-history-webview.md|  170 +
 .ai/implementation-plans/phase-6-history-webview.pl.md | 92 +
 .ai/implementation-plans/phase-7-wire-up.md        |  174 +
 .ai/implementation-plans/phase-7-wire-up.pl.md     |   83 +
 .ai/implementation-plans/token-spike.md            |   16 +-
 .ai/implementation-plans/token-spike.pl.md         |    2 +-
 .cursor/commands/5-package-vsix.md                 |    2 +-
 .cursor/commands/8-extension-review.md             |    2 +-
 .cursor/commands/9-security-token-audit.md         |    2 +-
 .cursor/rules/extension-webview.mdc                |    6 +-
 .cursor/rules/shared.mdc                           |   10 +-
 .gitignore                                         |   33 +
 .vscode/launch.json                                |   15 +
 .vscode/tasks.json                                 |   33 +
 .vscodeignore                                      |   30 +
 README.md                                          |  265 +-
 esbuild.mjs                                        |   56 +
 icon.png                                           |  Bin 0 -> 1190044 bytes
 media/history.css                                  |  356 ++
 media/history.html                                 |   99 +
 media/history.js                                   |  383 ++
 package-lock.json                                  | 5975 ++++++++++++++++++++
 package.json                                       |  132 +
 src/config.ts                                      |   88 +
 src/extension.ts                                   |   49 +
 src/format.ts                                      |   68 +
 src/node-sqlite.d.ts                               |   14 +
 src/spikes/threshold.ts                            |   29 +
 src/sqljs.d.ts                                     |   30 +
 src/ui/historyPanel.ts                             |  172 +
 src/ui/historyRows.ts                              |  108 +
 src/ui/periodStats.ts                              |  424 ++
 src/ui/statusBar.ts                                |  112 +
 src/ui/statusBarView.ts                            |  374 ++
 src/usage/api.ts                                   |  239 +
 src/usage/parse.ts                                 |  524 ++
 src/usage/service.ts                               |  213 +
 src/usage/session.ts                               |  294 +
 src/usage/types.ts                                 |   54 +
 test/api.test.ts                                   |  199 +
 test/config.test.ts                                |   41 +
 test/dailyBudget.test.ts                           |   75 +
 test/fixtures/usage-events.sample.json             |   43 +
 test/fixtures/usage-summary.sample.json            |   29 +
 test/format.test.ts                                |   72 +
 test/historyRows.test.ts                           |  135 +
 test/parse.test.ts                                 |  343 ++
 test/periodStats.test.ts                           |  148 +
 test/service.test.ts                               |  254 +
 test/session.test.ts                               |  222 +
 test/statusBar.test.ts                             |  382 ++
 test/threshold.test.ts                             |   39 +
 tsconfig.json                                      |   26 +
 vitest.config.ts                                   |    9 +
 78 files changed, 14627 insertions(+), 162 deletions(-)
```

### Breaking Changes

None — first implementation of the extension (`main` was docs/context only).

### Checklist

- [x] Access token never logged or posted to the webview
- [x] Webview CSP with nonce (`default-src 'none'`)
- [x] `activate` does not block on network
- [x] Click on Current / Today / a recent-query chip opens Last 100
