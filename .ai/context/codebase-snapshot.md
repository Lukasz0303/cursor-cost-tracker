# Codebase snapshot

**Date:** 2026-09-20  
**State:** Version **1.0.4**. **Burn Rate Guard** sums billed `costUsd` in a live window ending now (default 10 minutes): Statistics **Current burn rate** card, warning **banner**, non-modal warning/error toasts ($2 / $5), Today chip tint, Last N `inBurnWindow` styling. Does not stop Cursor; G5 still has only one blocking modal (last-query critical alert, with **Ignore**). **Coding stats** in the Last N / From date window: **landed / AI = %** (git insertions on `main`/`master` ÷ AI composer lines for this repo), the same if this branch landed, **All on Cursor** (dashboard Lines Edited split under **Projects**). Charts uses the same formulas plus cumulative daily token/cost bars. **10 UI languages** via `cursorCost.language`. Enterprise / team Current uses the personal monthly dollar pool (typically `$13.46 / $250.00`), not the org leftover cap (`$0 / $24,800`). `pickUsagePool` matches Stack Manager: drop any pool with limit > 1,000,000 cents; never `teamUsage.pooled`. **Monthly cost forecast** is plan-dependent: Team / Business / Enterprise → dollars (`unit: 'usd'`, one Spend series); personal Pro → included percent (`unit: 'percent'`, Cursor Models / Other Models). Team builds drop Pro-style `includedQuotas` even if the summary still has `autoPercentUsed`. Forecast chips are a 3×3 grid. Statistics tab cards use equal-height grids, cycle progress, Last N extras (median, cache hit, cost per 1M, token mix). Charts tab has the same **Monthly cost forecast** control as Statistics plus Today / This month / All time mix cards under the graphs. **Optimize** tab builds Quick / Balanced (default) / Deep prompts aimed at the **last expensive / red query** and pastes into the last Composer chat. Projected token/$ save appears only after the agent writes `.ai/optimize-savings.md`. **Support** tab: Buy Me a Coffee is live; GitHub Sponsors stays hidden until `GITHUB_SPONSORS_URL` is set. Webview chrome uses ghost/pill controls. Default good/warn colors switch to darker green/red on light themes. History size is configurable (`cursorCost.historyLimit`, default 1000) or from a local calendar day (`cursorCost.historyFromDate`). Status bar auto-refresh defaults to 1 minute. Recent query chips 1–10 (`cursorCost.recentQueryCount`, default 3). **Budget day basis** (`cursorCost.budgetDayBasis`, default `workingDays`). **Optimize depth** (`cursorCost.optimizeDepth`, default `balanced`). Settings groups Language, status-bar preview, Critical alert, Burn Rate Guard, Generated lines, Monthly budget, Optimize, Recent queries, Refresh. A blocking dialog fires when a **new** last query hits **10M tokens or $5**. A historical last query older than five minutes is remembered on first load without a modal.

## What is in the repo

VS Code / Cursor extension: status bar Current / Today / Refresh / 1–10 recent queries (default 3). Current/Today open Statistics; a query chip opens Last N. Refresh spins while fetching from cursor.com. Export CSV is on the Last N toolbar, not the status bar. Session from `state.vscdb`; unofficial `cursor.com` usage APIs. Current on Pro is the mean included % vs 100% (`32% / 100%`); Today is mean today % vs daily pace plus today’s `$` (`3.5% / 4.5% (17.12 $)`).

## Scripts

| Script | Command |
|--------|---------|
| `build` | `node esbuild.mjs` |
| `watch` | `node esbuild.mjs --watch` |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run` |
| `package` | `npm run build && vsce package --no-dependencies` |

`npm test`: 322 passed, 1 skipped (live `state.vscdb`). Version **1.0.4**. Settings cards use in-card `h3` titles (not floated fieldset legends) so headers and controls stay inside the frame. Status-bar options (preview, content, warnings, colors) share one Settings fieldset with section titles; Language / Critical alert / Burn Rate Guard / Generated lines / Optimize / Recent queries / Refresh stay separate. Native `select` lists use dropdown tokens + `color-scheme` so dark-theme options stay readable. Status bar Refresh is an unnamed `$(sync)` item immediately after Current/Today (not after the last-3 chips, so Cursor's right-edge overflow cannot swallow it); it spins while fetching. Last N toolbar has **Over Warn at** (pill switch spike filter), Refresh, and Export CSV; Show last / From date are Settings-only. Settings tab edits every `cursorCost.*` key and previews the bar with sample chips. Support tab shows Buy Me a Coffee; GitHub Sponsors stays hidden until `GITHUB_SPONSORS_URL` is set. **Burn Rate Guard** sums billed spend in a live 10-minute window: Statistics card, banner when high, non-modal $2/$5 toasts, Today chip tint. **Coding stats** uses landed / AI (not `AI − pending`) plus dashboard Lines Edited as All on Cursor.

## Tree

```
src/extension.ts              # activate: service.start, status bar, commands
src/config.ts
src/budgetDayBasis.ts
src/optimizeDepth.ts
src/historyLimit.ts
src/historyFromDate.ts
src/version.ts
src/format.ts
src/sqljs.d.ts
src/node-sqlite.d.ts
src/usage/types.ts
src/usage/parse.ts
src/usage/session.ts
src/usage/api.ts
src/usage/service.ts
src/ui/statusBarView.ts
src/ui/statusBar.ts
src/ui/statusBarTooltip.ts
src/ui/historyRows.ts
src/ui/historyPanel.ts
src/ui/periodStats.ts
src/ui/chartSeries.ts
src/ui/periodCards.ts
src/ui/mtdPace.ts
src/ui/optimizeInsights.ts
src/ui/optimizeSavings.ts
src/ui/optimizeSavingsFile.ts
src/ui/optimizePrompt.ts
src/ui/optimizePayload.ts
src/ui/openOptimizeChat.ts
src/ui/criticalAlert.ts
src/ui/burnRateAlert.ts
src/burnRate/window.ts
src/burnRate/pace.ts
src/burnRate/detect.ts
src/burnRate/copy.ts
src/codeLines/*.ts            # Coding stats (AI vs git, dashboard split)
src/i18n.ts
src/locale.ts
src/i18n/catalogs/            # en pl zh-cn ja es pt-br ru ko fr de
src/supportLinks.ts
src/spikes/threshold.ts
src/spikes/criticalAlert.ts
src/spikes/ignoreStore.ts
media/history.html
media/history.css
media/history.js
test/*.test.ts
test/fixtures/
dist/extension.js             # gitignored
dist/sql-wasm.wasm            # gitignored
*.vsix                        # gitignored
```

## Security audit (pre-package)

| Location | Risk | Status |
|----------|------|--------|
| `src/usage/session.ts` | `WorkosCursorSessionToken` + ItemTable key `cursorAuth/accessToken` to **build** the cookie | OK (allowed) |
| `media/*` | cookie / token / Bearer | OK (none) |
| `src/` | `console.log` / OutputChannel dumps | OK (none) |
| Webview `postMessage` | `{ type: 'data', events }` formatted rows only | OK |
| SQLite | `node:sqlite` read-only or small sql.js copy; `SELECT … WHERE key = ?` | OK |
| CSP | `default-src 'none'` + nonce | OK |

Verdict: **safe to package VSIX**.

## Next

Ignore of token spikes (`globalState`) is still a follow-up. Optimize is metadata prompts only — no transcript analysis / auto-fix.
