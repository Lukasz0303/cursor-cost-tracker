# Phase 6 — Last 100 webview

**Parent:** [mvp.md](./mvp.md)  
**Status:** ready to implement  
**Depends on:** [phase-4-usage-service.md](./phase-4-usage-service.md) (cached queries), [phase-1-parse-format.md](./phase-1-parse-format.md) (formatters — prefer format **in the host** or in `media/history.js` with the same rules; host-side format is easier to test)  
**Next:** [phase-7-wire-up.md](./phase-7-wire-up.md)  
**Polish:** [phase-6-history-webview.pl.md](./phase-6-history-webview.pl.md)  
**PRD:** §5.2, A3, G2  
**Webview rules:** `.cursor/rules/extension-webview.mdc`

If this file and [mvp.md](./mvp.md) or the English PRD disagree, **the PRD wins**.

---

## 1. Goal

One reused `WebviewPanel` titled **Last 100 Cursor queries**. Table: TIME, MODEL, COST, TOKENS, INPUT / OUTPUT, KIND. Newest first. CSP nonce. Payload is events only — never token, cookie, or email.

**Done when:** opening twice focuses the same panel; `postMessage` payload has no token fields; command `9-security-token-audit` would pass for the webview path.

---

## 2. Out of scope

| Item | When |
|------|------|
| Spike `!` column, Ignore button | v1.1 |
| React / Vue | never |
| `enableCommandUris` | never |
| Quick Pick fallback | not default; do not add |
| Email in the table | not in MVP columns |

---

## 3. Files

```
src/ui/historyPanel.ts
media/history.html
media/history.css
media/history.js
```

`localResourceRoots`: `[vscode.Uri.joinPath(context.extensionUri, 'media')]`.

`.vscodeignore` already keeps `media/**` from phase 0.

---

## 4. Host (`historyPanel.ts`)

```typescript
export class HistoryPanel {
  static show(context: vscode.ExtensionContext, service: UsageService): void
}
```

### 4.1 Panel lifecycle

- `viewType`: `cursorCost.history`
- `title`: `Last 100 Cursor queries`
- `ViewColumn.Active`
- Options: `enableScripts: true`, `retainContextWhenHidden: true`, `enableCommandUris: false`, `localResourceRoots: [media]`
- If a panel already exists: `reveal(ViewColumn.Active)` and send latest data. Do **not** create a second panel.
- On `onDidDispose`: clear the static reference.

### 4.2 HTML

- Load `history.html` as text, inject:
  - CSP with a random **nonce**
  - `webview.asWebviewUri` for `history.css` and `history.js`
- CSP: `default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-{nonce}';`
- No inline event handlers without nonce. Prefer `history.js` with the nonce on the script tag.

### 4.3 Messages

**Webview → host**

| `type` | Action |
|--------|--------|
| `ready` | Host sends cached events |
| `close` | `panel.dispose()` |

**Host → webview**

| `type` | Payload |
|--------|---------|
| `data` | `{ events: UsageQuery[] }` only |

Do **not** send: cookie, token, email, plan, raw summary, `sub`.

Subscribe to `UsageService.onDidChange`: on `ready`, post `{ type: 'data', events: data.recentQueries }`. On error/loading, post `{ type: 'data', events: [] }` or keep last table — prefer last cache if present (G2), else empty table + optional status text in the HTML header (“Sign in to Cursor”) **without** putting the error in a way that includes secrets (the message is already generic).

Sort newest first in the host before send (`timestamp` descending). Cap 100.

### 4.4 Close button

A **Close** control in the HTML posts `{ type: 'close' }`. The editor tab X also disposes via `onDidDispose`.

---

## 5. Markup and style

### 5.1 `history.html`

- Header: title **Last 100 Cursor queries** + Close
- `<table>` thead: `TIME` · `MODEL` · `COST` · `TOKENS` · `INPUT / OUTPUT` · `KIND`
- `<tbody id="rows">` filled by `history.js`
- Empty state: one row or a paragraph `No queries yet` when `events` is empty

### 5.2 `history.css`

Use **only** `--vscode-*` variables, e.g.:

- `--vscode-foreground`
- `--vscode-editor-background`
- `--vscode-font-family`
- `--vscode-panel-border` (row separators)
- `--vscode-button-background` / `--vscode-button-foreground` for Close

Body/table: **monospace** for numeric columns (`--vscode-editor-font-family` is fine). No hardcoded marketplace hex palettes.

### 5.3 `history.js`

- `acquireVsCodeApi()`
- On load: `postMessage({ type: 'ready' })`
- On `message` with `type === 'data'`: render rows
- Close button: `postMessage({ type: 'close' })`
- Escape HTML when filling cells (no `innerHTML` with raw model names) — use `textContent` / `createElement`

Display mapping (if formatting in the webview, duplicate the phase 1 rules; **prefer sending already-formatted strings** from the host as a view DTO):

```typescript
type HistoryRow = {
  time: string
  model: string
  cost: string
  tokens: string
  inputOutput: string
  kind: string
}
```

Host maps `UsageQuery` → `HistoryRow` with `formatDateTime`, `stripModelPrefix`, `formatDollars`, `formatTokens`, `formatKind`. Webview only renders strings. This keeps token math out of the webview and matches G3.

`INPUT / OUTPUT` cell: `{formatTokens(input)} / {formatTokens(output)}`.

---

## 6. Tests

Unit-test the host mapper `toHistoryRows(queries): HistoryRow[]` (newest first, 100 cap, formatting). Optional: assert a sample payload JSON has keys only from `HistoryRow` / `UsageQuery` and not `cookie`.

Do not add Selenium. Manual check is phase 7.

---

## 7. Security (blocking)

- [ ] CSP `default-src 'none'`
- [ ] nonce on script
- [ ] `enableCommandUris: false`
- [ ] postMessage payload has no `accessToken`, `WorkosCursorSessionToken`, `cookie`, `Authorization`
- [ ] webview JS never receives the session module

---

## 8. Handoff to phase 7

`HistoryPanel.show(context, service)` is the body of `cursorCost.showHistory`. `activate` registers the command and passes the same `UsageService` instance used by the status bar.
