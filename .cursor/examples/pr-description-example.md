# Example PR Description Format

## feat: add status bar usage and Last 100 history panel

### Overview

Adds Current and Today on the Cursor status bar and opens a Last 100 queries table from a single click. Usage is loaded from the local Cursor session and cursor.com usage APIs.

### What's Changed

#### New Features

- **Status bar** — Current cycle spend vs limit and Today vs daily budget
- **History panel** — Last 100 queries (time, model, cost, tokens, input/output, kind)
- **Refresh** — command and status bar action

#### Core Components

**Usage**

- `session.ts` — read `state.vscdb` via sql.js
- `api.ts` / `parse.ts` — summary + events
- `service.ts` — polling and in-memory cache

**UI**

- `statusBar.ts` — three items, theme colors
- `historyPanel.ts` + `media/history.*` — webview table

### Testing

- Vitest for dollar/token formatting and pool/daily-budget parse

### Files Changed

_(fill from `git diff origin/main...HEAD --stat`)_

### Breaking Changes

None

### Checklist

- [ ] Access token never logged or posted to the webview
- [ ] Webview CSP with nonce
- [ ] `activate` does not block on network
- [ ] Click on Current/Today opens Last 100
