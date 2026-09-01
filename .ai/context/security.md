# Security — Cursor Cost Tracker

## Session token

- Source: `ItemTable` in `state.vscdb`, key `cursorAuth/accessToken`.
- Cookie: `WorkosCursorSessionToken={jwt.sub}::{accessToken}`.
- **Forbidden:** `console.log` / output channel with token, cookie, JWT, or `sub`.
- **Forbidden:** `postMessage` with token or raw cookie.
- Webview: serialized events only (time, model, cost, tokens, kind).

## SQLite

- Read-only, copy the file into memory (sql.js), then `SELECT value FROM ItemTable WHERE key = ?`.
- Parameterize / escape the key — never concatenate SQL from user input.

## Webview

- `enableScripts: true`, **no** `enableCommandUris`.
- CSP: `default-src 'none'; style-src ${cspSource}; script-src 'nonce-…'`.
- No `enabledApiProposals`.

## Network

- Host allowlist: `cursor.com` (usage endpoints from the PRD).
- 15 s timeout. No third-party telemetry in MVP.

## Audit (command `9-security-token-audit`)

Before a VSIX: grep `src/` and `dist/` for `accessToken`, `WorkosCursorSessionToken`, `Bearer`. Result: zero hits in logs and the webview.
