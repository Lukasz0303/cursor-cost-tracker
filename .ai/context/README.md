# Cursor Cost Tracker — AI context (`.ai/context`)

This folder describes the **product vision** and **target stack**. Once code exists, this README must also describe **implementation status**. The PRD is the destination; the repo (when `src/` exists) is what works today.

## 1. Product vision

- **Title:** Cursor Cost Tracker — *See Cursor AI spend without leaving the editor.*
- **Shape:** VS Code extension compatible with **Cursor** (primary target).
- **Value:** Current, Today, and 1–10 recent queries (default 3) on the **status bar**; click opens **Last N Cursor queries** (default 1000). `!` on a query ≥ token threshold (default 1M). Blocking dialog if the newest query hits 10M tokens or $5. Ignore of spikes is a follow-up.
- **Zero setup:** read the local Cursor session (`state.vscdb`); no `.env` and no API key in settings (MVP).
- **Full requirements:** [prd.md](./prd.md) (English, canonical) · [prd.pl.md](./prd.pl.md) (Polish).

## 1a. Canonical behavior (summary)

If this summary and the PRD disagree, [prd.md](./prd.md) wins.

| Topic | Rule |
|-------|------|
| Status bar | Team: Current `used $ / limit $`. Pro: included-quota percents. Today, Refresh (on demand), 1–10 recent queries (`cost - tokens`, default 3); `!` on a query ≥ token threshold (default 1M) |
| Critical alert | Blocking dialog when the newest query hits 10M tokens or $5 (configurable; once per query) |
| Click Current/Today | Statistics tab immediately (not Quick Pick). A recent-query chip opens the queries list |
| History | Four tabs: Last N (default 1000), Statistics (incl. MTD pace / forecast chart), Charts (tokens/cost + the same Monthly cost forecast control + period mix cards), Settings (all `cursorCost.*` keys; status bar editor with sample preview) |
| Unlimited | text Unlimited, hide Today |
| No session | `N/A` / Sign in, no crash |
| Token | extension host only; never `postMessage`, logs, or webview |
| Polling | 1 min, AbortController, `activate` must not block UI |
| Network | `cursor.com` usage APIs only |

**Repo stage:** Phase 7 / MVP wired (`activate` + status bar + Last 100). Local VSIX `1.0.2`. See [codebase-snapshot.md](./codebase-snapshot.md).

## 2. Target stack

TypeScript strict, esbuild, VS Code Extension API (`^1.85.0`), sql.js, `fetch`, vanilla HTML/CSS/JS in the webview, Vitest, `@vscode/vsce`.  
Details and rejected options: [tech-stack.md](./tech-stack.md).  
Layers and files: [architecture.md](./architecture.md).  
Token and CSP: [security.md](./security.md).  
Open VSX / VSIX: [publishing.md](./publishing.md).  
**MVP build order:** [../implementation-plans/mvp.md](../implementation-plans/mvp.md) · [../implementation-plans/mvp.pl.md](../implementation-plans/mvp.pl.md). Per-phase steps: [../implementation-plans/README.md](../implementation-plans/README.md).

## 3. Where context lives

| File | Role |
|------|------|
| [README.md](./README.md) | this index + canonical summary |
| [prd.md](./prd.md) | product requirements (source of truth, English) |
| [prd.pl.md](./prd.pl.md) | same PRD in Polish (translation; English wins on conflict) |
| [tech-stack.md](./tech-stack.md) | technology decisions |
| [architecture.md](./architecture.md) | UI → files mapping |
| [security.md](./security.md) | token, webview, SQLite |
| [publishing.md](./publishing.md) | VSIX and Open VSX |
| [codebase-snapshot.md](./codebase-snapshot.md) | what the code does today |
| [plan.md](./plan.md) | how to keep this folder current |
| [../implementation-plans/mvp.md](../implementation-plans/mvp.md) | MVP implementation plan (English) |
| [../implementation-plans/mvp.pl.md](../implementation-plans/mvp.pl.md) | same plan in Polish |
| [../implementation-plans/README.md](../implementation-plans/README.md) | detailed plans per MVP phase 0–7 |

## 4. House rules

- **PRD** — requirements source. **Code** — behavior source of truth once `src/` exists.
- Read this folder before a large change; update the snapshot (and PRD if needed) after.
- Language: **English everywhere** (`.ai`, rules, commands, code, commits, MVP UI, `package.json`).
- Context files: **kebab-case lowercase** (`plan.md`, `codebase-snapshot.md`). Exception: `README.md` as the folder index.
- Do not add React in the webview, Quick Pick as the default click, or a native-sqlite-only path on Windows.
