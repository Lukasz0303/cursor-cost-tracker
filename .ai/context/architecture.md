# Architecture — Cursor Cost Tracker

## 1. Processes

```
Cursor / VS Code
  Extension Host (Node)          Webview (sandbox)
  extension.ts  ──postMessage──►  Last 100 table
  usage/service.ts ◄────────────  ready / close
       │
       ├─ usage/session.ts  →  copy of state.vscdb → sql.js → accessToken
       └─ usage/api.ts      →  HTTPS cursor.com
```

The token **never** goes to the webview.

## 2. Target files

| File | Responsibility |
|------|----------------|
| `src/extension.ts` | `activate` / `deactivate`, commands, subscriptions |
| `src/usage/session.ts` | OS paths, SQLite key read |
| `src/usage/api.ts` | fetch summary + events, timeout |
| `src/usage/parse.ts` | cents, pools, tokens, daily budget |
| `src/usage/service.ts` | polling, cache, EventEmitter, AbortController |
| `src/ui/statusBar.ts` | three StatusBarItems, colors, tooltip |
| `src/ui/historyPanel.ts` | WebviewPanel lifecycle |
| `src/spikes/threshold.ts` | v1.1 token spike vs setting |
| `src/spikes/ignoreStore.ts` | v1.1 persisted Ignore keys |
| `src/format.ts` | dollars, tokens, dates, kind |
| `src/config.ts` | `workspace.getConfiguration('cursorCost')` |
| `media/history.html\|css\|js` | Last 100 table |
| `esbuild.mjs` | bundle |
| `package.json` | contributes, engines, activation |

If you change the directory layout, update this file and `shared.mdc`.

## 3. Data flow

1. `activate` → `UsageService.start()` (fetch in the background).
2. Snapshot: `loading` | `ready` | `error`.
3. Status bar subscribes to the snapshot.
4. Click Current/Today → `cursorCost.showHistory` → panel receives `{ type: 'data', events }` (no token).
5. Refresh → `service.refresh()`; if the panel is open it receives a new `data` message.

## 4. MVP boundaries

Do not add in MVP: Activity Bar, React, history TreeView, localhost calls, or a manual token in settings (v2 / Secret Storage). Token-spike `!` / Ignore is **v1.1**. No Advise / auto-fix.
