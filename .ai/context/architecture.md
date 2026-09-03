# Architecture — Cursor Cost Tracker

## 1. Processes

```
Cursor / VS Code
  Extension Host (Node)          Webview (sandbox)
  extension.ts  ──postMessage──►  Last 100 table
  usage/service.ts ◄────────────  ready / close
       │
       ├─ usage/session.ts  →  state.vscdb (node:sqlite read-only, sql.js copy if small) → accessToken
       └─ usage/api.ts      →  HTTPS cursor.com
```

The token **never** goes to the webview.

## 2. Target files

| File | Responsibility |
|------|----------------|
| `src/extension.ts` | `activate` / `deactivate`, commands, subscriptions |
| `src/usage/session.ts` | OS paths, SQLite key read |
| `src/usage/api.ts` | fetch summary + events, timeout |
| `src/usage/parse.ts` | cents, pools, Pro percents vs team dollars, tokens, daily budget |
| `src/usage/service.ts` | polling, cache, EventEmitter, AbortController |
| `src/ui/statusBar.ts` | Budget chip + Refresh + 3 recent-query items |
| `src/ui/statusBarTooltip.ts` | Hover card for Current/Today (meters, aligned model table) |
| `src/ui/historyPanel.ts` | WebviewPanel lifecycle |
| `src/ui/historyRows.ts` | table rows + host payload; Last N over-limit filter |
| `src/ui/periodStats.ts` | Period stats glossary and aggregates |
| `src/ui/chartSeries.ts` | Charts tab series (tokens/cost over time) |
| `src/ui/periodCards.ts` | Charts tab Today / This month / All time mix cards |
| `src/ui/mtdPace.ts` | Month-to-date meter (elapsed weekdays × daily budget), working-day forecast, and chart series |
| `src/ui/criticalAlert.ts` | Blocking dialog when the newest query hits 10M tokens or $5 |
| `src/spikes/threshold.ts` | token spike vs setting |
| `src/spikes/criticalAlert.ts` | last-query critical threshold + once-per-query decision |
| `src/spikes/ignoreStore.ts` | v1.1 persisted Ignore keys |
| `src/format.ts` | dollars, percents, tokens, dates, kind |
| `src/config.ts` | `workspace.getConfiguration('cursorCost')`; light/dark default colors |
| `src/historyLimit.ts` | clamp Last N (100–10,000, default 1000) |
| `src/version.ts` | installed version from `package.json` (webview label) |
| `media/history.html\|css\|js` | Last N + Statistics + Charts + Settings |
| `esbuild.mjs` | bundle |
| `package.json` | contributes, engines, activation, `"icon": "icon.png"` |
| `icon.png` | Extension / marketplace icon (repo root) |

If you change the directory layout, update this file and `shared.mdc`.

## 3. Data flow

1. `activate` → `UsageService.start()` (fetch in the background).
2. Snapshot: `loading` | `ready` | `error`.
3. Status bar and the critical-alert controller subscribe to the snapshot.
4. Click Current / Today → `cursorCost.showHistory` with the Statistics tab. A recent-query chip opens the queries list. The panel receives `{ type: 'data', events, stats }` (no token). Settings also receives `statusBarPreview` (sample chips) and every `cursorCost.*` value.
5. Refresh (status bar, Last N toolbar, or command) → `service.refresh()`; if the panel is open it receives a new `data` message. Export CSV on the Last N toolbar saves the Last N sample.

## 4. MVP boundaries

Do not add in MVP: Activity Bar, React, history TreeView, localhost calls, or a manual token in settings (v2 / Secret Storage). Ignore of spikes is a follow-up. No Advise / auto-fix.
