# Cursor Cost Tracker — AI context (`.ai/context`)

This folder describes the **product vision** and **target stack**. Once code exists, this README must also describe **implementation status**. The PRD is the destination; the repo (when `src/` exists) is what works today.

## 1. Product vision

- **Title:** Cursor Cost Tracker — *See spend · forecast run-out · Optimize expensive queries locally.*
- **Shape:** VS Code extension compatible with **Cursor** (primary target).
- **Value (three goals):** (1) **Status bar** — Current, Today, 1–10 recent queries; (2) **Monthly cost forecast** — when Team money / Pro included limits run out (calendar month or a valid billing cycle); (3) **Optimize** — last red query, or Play on one red row, plus local `.ai/optimize-savings.md` only. `!` on a query ≥ token threshold (default 1M). Blocking dialog if the newest query hits 10M tokens or $5. Spike **Ignore** persist store is in `src/spikes/ignoreStore.ts`; the table button is still remaining.
- **Zero setup:** read the local Cursor session (`state.vscdb`); no `.env` and no API key in settings (MVP).
- **Full requirements:** [prd.md](./prd.md) (English, canonical) · [prd.pl.md](./prd.pl.md) (Polish).

## 1a. Canonical behavior (summary)

If this summary and the PRD disagree, [prd.md](./prd.md) wins.

| Topic | Rule |
|-------|------|
| Status bar | Team: Current `used $ / limit $`. Pro: mean included % vs 100% (`32% / 100%`); Today mean today % / daily pace (`3.5% / 4.5% (17.12 $)`). Refresh (on demand), 1–10 recent queries (`cost - tokens`, default 3); `!` on a query ≥ token threshold (default 1M) |
| Critical alert | Blocking dialog when the newest query hits 10M tokens or $5 (configurable; once per query) |
| Click Current/Today | Statistics tab immediately (not Quick Pick). A recent-query chip opens the queries list |
| History | Six public tabs: Last N (default 1000; Show last / From / To in Settings; toolbar **Over Warn at**, **Optimized**, and **Group by conversation** default off; Play on a red TOKENS cell opens that conversation; expand a row for list-price makeup), Statistics (burn rate, Coding stats with $ / 1k lines, model pricing, cache $ saved, monthly forecast), Charts (tokens/cost, click a day, Sample / Last 7 / Month, the same forecast, period mix), Optimize (Run pastes into the open Agent chat and Play opens that conversation; projected save from `.ai/optimize-savings.md`), Support (Buy Me a Coffee; Write a message via FormSubmit; GitHub Sponsors hidden until the URL is set), Settings (every `cursorCost.*` key) |
| Unlimited | text Unlimited, hide Today |
| No session | `N/A` / Sign in, no crash |
| Token | extension host only; never `postMessage`, logs, or webview |
| Polling | 1 min, AbortController, `activate` must not block UI |
| Network | `cursor.com` usage APIs only |

**Repo stage:** Phase 7 / MVP wired, then **1.0.0–1.0.7**. Current tree is **1.0.7** (`CHANGELOG.md` opens on 1.0.7; `package.json` still says 1.0.6 until the release bump): Burn Rate Guard, Coding stats, 11 UI languages, model pricing, billing-cycle forecast, Play on a red query (opens that conversation), list price, To date, Group by conversation (default off), chart day detail and zoom. Run Optimize pastes into the open Agent chat. History of each version: [codebase-snapshot.md](./codebase-snapshot.md).

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
| [../implementation-plans/burn-rate-guard.md](../implementation-plans/burn-rate-guard.md) | Burn Rate Guard (1.0.4) |
| [../implementation-plans/generated-lines-insight.md](../implementation-plans/generated-lines-insight.md) | Generated Lines Insight (1.0.4) |
| [../implementation-plans/additional/README.md](../implementation-plans/additional/README.md) | deferred feature plans (backlog) |
| [../implementation-plans/market-2026-09/README.md](../implementation-plans/market-2026-09/README.md) | market review 30 Sep 2026 and follow-up slices (several are already in the 1.0.6 tree) |
| [../../.cursor/commands/11-sync-product-docs.md](../../.cursor/commands/11-sync-product-docs.md) | one command to refresh context, README, CHANGELOG, and the site version together |

## 4. House rules

- **PRD** — requirements source. **Code** — behavior source of truth once `src/` exists.
- Read this folder before a large change; update the snapshot (and PRD if needed) after.
- Language: **English everywhere** (`.ai`, rules, commands, code, commits, MVP UI, `package.json`).
- Context files: **kebab-case lowercase** (`plan.md`, `codebase-snapshot.md`). Exception: `README.md` as the folder index.
- Do not add React in the webview, Quick Pick as the default click, or a native-sqlite-only path on Windows.
