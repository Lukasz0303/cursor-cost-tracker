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
| `src/ui/statusBar.ts` | Budget chip + 3 recent-query items + Refresh |
| `src/ui/historyPanel.ts` | WebviewPanel lifecycle |
| `src/ui/historyRows.ts` | table rows + host payload |
| `src/ui/periodStats.ts` | Period stats glossary and aggregates |
| `src/ui/chartSeries.ts` | Charts tab series (tokens/cost over time) |
| `src/spikes/threshold.ts` | token spike vs setting |
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
3. Status bar subscribes to the snapshot.
4. Click Current / Today / a recent chip → `cursorCost.showHistory` → panel receives `{ type: 'data', events, stats }` (no token).
5. Refresh → `service.refresh()`; if the panel is open it receives a new `data` message.

## 4. MVP boundaries

Do not add in MVP: Activity Bar, React, history TreeView, localhost calls, or a manual token in settings (v2 / Secret Storage). Ignore of spikes is a follow-up. No Advise / auto-fix.
