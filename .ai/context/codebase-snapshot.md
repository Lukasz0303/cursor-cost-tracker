# Codebase snapshot

**Date:** 2026-09-02  
**State:** Enterprise / team Current uses the personal monthly dollar pool (typically `$13.46 / $250.00`), not the org leftover cap (`$0 / $24,800`). `pickUsagePool` matches Stack Manager: drop any pool with limit > 1,000,000 cents; never `teamUsage.pooled`. Statistics tab cards use equal-height grids, cycle progress, and Last N extras (median, cache hit, cost per 1M, token mix). Charts tab has Today / This month / All time mix cards under the graphs. Default good/warn colors switch to darker green/red on light themes. History size is configurable (`cursorCost.historyLimit`, default 1000).

## What is in the repo

VS Code / Cursor extension: status bar Current / Today / last 3 queries / Refresh; click opens Last 100. Session from `state.vscdb`; unofficial `cursor.com` usage APIs. Current on Pro is `7%` (or `7% · 0%` when Other Models is present), not the on-demand `$ / $` cap.

## Scripts

| Script | Command |
|--------|---------|
| `build` | `node esbuild.mjs` |
| `watch` | `node esbuild.mjs --watch` |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run` |
| `package` | `npm run build && vsce package --no-dependencies` |

`npm test`: 154 passed, 1 skipped (live `state.vscdb`). Version **1.0.1**.

## Tree

```
src/extension.ts              # activate: service.start, status bar, commands
src/config.ts
src/historyLimit.ts
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
src/ui/historyRows.ts
src/ui/historyPanel.ts
src/ui/periodStats.ts
src/ui/chartSeries.ts
src/ui/periodCards.ts
src/spikes/threshold.ts
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

Ignore of token spikes (`globalState`) is still a follow-up. No Advise / auto-fix.
