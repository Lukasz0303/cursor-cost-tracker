# Cursor Cost Tracker — AI context (`.ai/context`)

This folder describes the **product vision** and **target stack**. Once code exists, this README must also describe **implementation status**. The PRD is the destination; the repo (when `src/` exists) is what works today.

## 1. Product vision

- **Title:** Cursor Cost Tracker — *See Cursor AI spend without leaving the editor.*
- **Shape:** VS Code extension compatible with **Cursor** (primary target).
- **Value:** Current and Today on the **status bar**; click opens **Last 100 Cursor queries**. v1.1: `!` on token spikes (default 1M, user-set) + Ignore.
- **Zero setup:** read the local Cursor session (`state.vscdb`); no `.env` and no API key in settings (MVP).
- **Full requirements:** [prd.md](./prd.md) (English, canonical) · [prd.pl.md](./prd.pl.md) (Polish).

## 1a. Canonical behavior (summary)

If this summary and the PRD disagree, [prd.md](./prd.md) wins.

| Topic | Rule |
|-------|------|
| Status bar | Current `used $ / limit $`, Today, Refresh; `!` if a non-ignored Last-100 query is ≥ token threshold (v1.1, default 1M) |
| Click Current/Today | Last 100 immediately (not Quick Pick) |
| Last 100 | TIME, MODEL, COST, TOKENS, INPUT/OUTPUT, KIND; newest first; spike `!` + Ignore (v1.1) |
| Unlimited | text Unlimited, hide Today |
| No session | `N/A` / Sign in, no crash |
| Token | extension host only; never `postMessage`, logs, or webview |
| Polling | 5 min, AbortController, `activate` must not block UI |
| Network | `cursor.com` usage APIs only |

**Repo stage:** context + README. **Extension code does not exist yet** — see [codebase-snapshot.md](./codebase-snapshot.md).

## 2. Target stack

TypeScript strict, esbuild, VS Code Extension API (`^1.85.0`), sql.js, `fetch`, vanilla HTML/CSS/JS in the webview, Vitest, `@vscode/vsce`.  
Details and rejected options: [tech-stack.md](./tech-stack.md).  
Layers and files: [architecture.md](./architecture.md).  
Token and CSP: [security.md](./security.md).  
Open VSX / VSIX: [publishing.md](./publishing.md).  
**MVP build order:** [../implementation-plans/mvp.md](../implementation-plans/mvp.md) · [../implementation-plans/mvp.pl.md](../implementation-plans/mvp.pl.md).

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

## 4. House rules

- **PRD** — requirements source. **Code** — behavior source of truth once `src/` exists.
- Read this folder before a large change; update the snapshot (and PRD if needed) after.
- Language: **English everywhere** (`.ai`, rules, commands, code, commits, MVP UI, `package.json`).
- Context files: **kebab-case lowercase** (`plan.md`, `codebase-snapshot.md`). Exception: `README.md` as the folder index.
- Do not add React in the webview, Quick Pick as the default click, or a native-sqlite-only path on Windows.
