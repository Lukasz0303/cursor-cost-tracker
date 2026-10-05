# Security — Cursor Cost Tracker

## Session token

- Source: `ItemTable` in `state.vscdb`, key `cursorAuth/accessToken`.
- Cookie: `WorkosCursorSessionToken={jwt.sub}::{accessToken}`.
- **Forbidden:** `console.log` / output channel with token, cookie, JWT, or `sub`.
- **Forbidden:** `postMessage` with token or raw cookie.
- Webview: serialized rows (time, model, cost, tokens, kind, list price, numbers-only briefs, group labels). Chart day lists are that same loaded sample. No prompt text and no code.
- Composer titles and AI line totals come from local index keys and composer headers. Message `text` is not read. A grouped row label is that title, `#` plus eight id characters, or the Ungrouped bucket.

## SQLite

- Read-only. Prefer `node:sqlite` on the live file (no full copy). sql.js copy only when the file is small enough to load. Then `SELECT value FROM ItemTable WHERE key = ?`.
- Parameterize / escape the key — never concatenate SQL from user input.

## Webview

- `enableScripts: true`. Command URIs allowlisted to `cursorCost.exportCsv`, `cursorCost.openDashboard`, and `cursorCost.openPricing` (save dialog and external URL need a real click). The same list includes the gated CSV export; that command stays off the public tabs.
- CSP: `default-src 'none'; style-src ${cspSource}; script-src 'nonce-…'`.
- No `enabledApiProposals`.

## Network

- Usage and analytics: `cursor.com` only, with the session cookie, 15 s timeout.
- Model prices: public Cursor docs markdown. No cookie.
- Support → Write a message: `POST` to FormSubmit with nickname, topic, body, consent, and the account email. The session token is not in that body. The mail app stays closed.
- No product telemetry.

## Audit (command `9-security-token-audit`)

Before a VSIX: grep `src/` and `dist/` for `accessToken`, `WorkosCursorSessionToken`, `Bearer`. Result: zero hits in logs and the webview.
