# Codebase snapshot

**Date:** 2026-09-10  
**State:** Enterprise / team Current uses the personal monthly dollar pool (typically `$13.46 / $250.00`), not the org leftover cap (`$0 / $24,800`). `pickUsagePool` matches Stack Manager: drop any pool with limit > 1,000,000 cents; never `teamUsage.pooled`. **Monthly cost forecast** is plan-dependent: Team / Business / Enterprise → dollars (`unit: 'usd'`, one Spend series); personal Pro → included percent (`unit: 'percent'`, Cursor Models / Other Models). Team builds drop Pro-style `includedQuotas` even if the summary still has `autoPercentUsed`. Statistics tab cards use equal-height grids, cycle progress, Last N extras (median, cache hit, cost per 1M, token mix), and a **Month to date** meter with run-out dates plus used / forecast / ideal lines. Charts (tokens, cost, and forecast) use **one Y scale** with cumulative bars matching the used line — no dual axis. Charts tab has the same **Monthly cost forecast** control as Statistics plus Today / This month / All time mix cards under the graphs. **Optimize** tab builds Quick / Balanced (default) / Deep prompts aimed at the **last expensive / red query** (not a whole-workspace audit) and pastes into the open/last Composer chat (`composer.openComposer` / `focusComposer`; fallback `newAgentChat`; user presses Start). Projected token/$ save is **not** a fixed extension heuristic — it appears only after the agent writes `.ai/optimize-savings.md` (`cct-savings` fence with `project`, `tokens_mid`, `usd_mid`, `run`); every depth prompt requires a closing tokens/USD/project report. Credited lifetime savings (mid deltas per new Optimize run) live in `globalState`. Optimize shows one collapsed **Projected save per similar request** card (expand for the explanation and per-project credits). The panel watches the savings file. **Support** tab: Buy Me a Coffee is live; GitHub Sponsors tiers ($2 / $5 / $10) stay in HTML but stay `hidden` until `GITHUB_SPONSORS_URL` is set in `src/supportLinks.ts` (`openSupportLink` → `env.openExternal`). Webview chrome uses ghost/pill controls and dashboard cards: softer `--card-border` / sheen than buttons, Current/Today as Cursor-style hero meters, in-card Settings section titles, rounded chart bars. Status bar hover is a compact card: included/on-demand meters, right-aligned model table, dashboard/refresh links. Chart hovers use label/value rows. Default good/warn colors switch to darker green/red on light themes. History size is configurable (`cursorCost.historyLimit`, default 1000) or from a local calendar day (`cursorCost.historyFromDate`). Status bar auto-refresh defaults to 1 minute (`cursorCost.pollIntervalMinutes`); the status-bar sync icon also refreshes on demand. The number of recent status-bar query chips is configurable from 1–10 (`cursorCost.recentQueryCount`, default 3). **Budget day basis** (`cursorCost.budgetDayBasis`, default `workingDays`) chooses Mon–Fri vs all calendar days for Today daily budget, MTD meters, and forecast charts. **Optimize depth** (`cursorCost.optimizeDepth`, default `balanced`). Settings groups the status-bar preview, content, warnings, and colors into separate cards plus Monthly budget / Optimize / Critical alert / Recent queries / Refresh. A blocking dialog fires when a **new** last query hits **10M tokens or $5**. A historical last query older than five minutes is remembered on first load without a modal.

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

`npm test`: 267 passed, 1 skipped (live `state.vscdb`). Version **1.0.3**. Settings cards use in-card `h3` titles (not floated fieldset legends) so headers and controls stay inside the frame. Status-bar options (preview, content, warnings, colors) share one Settings fieldset with section titles; Critical alert / Optimize / Recent queries / Refresh stay separate. Native `select` lists use dropdown tokens + `color-scheme` so dark-theme options stay readable. Status bar Refresh is an unnamed `$(sync)` item immediately after Current/Today (not after the last-3 chips, so Cursor's right-edge overflow cannot swallow it); it spins while fetching. Last N toolbar has **Over Warn at** (pill switch spike filter), Refresh, and Export CSV; Show last / From date are Settings-only. Settings tab edits every `cursorCost.*` key and previews the bar with sample chips. Support tab shows Buy Me a Coffee; GitHub Sponsors stays hidden until `GITHUB_SPONSORS_URL` is set.

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
src/supportLinks.ts
src/spikes/threshold.ts
src/spikes/criticalAlert.ts
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
