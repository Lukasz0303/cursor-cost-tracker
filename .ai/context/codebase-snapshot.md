# Codebase snapshot

**Date:** 2026-10-05  
**Version in the tree:** **1.0.6** (`package.json`).  
**This cut:** everything in **1.0.0–1.0.6**, including Group by conversation, chart day detail, and Run Optimize into a new Agent chat. `CHANGELOG.md` has no Unreleased heading. GitHub Actions runs typecheck, Vitest, and esbuild.

`npm test` on this date: **78 files, 867 passed, 1 skipped** (live `state.vscdb`), after the two chart-mode catalog keys landed in every locale. CI is `.github/workflows/ci.yml` (Node 20, `npm ci`). The landing page stays on `.github/workflows/pages.yml`.

## Shipped history

| Version | Date | What landed |
|---------|------|-------------|
| **1.0.0** | 2026-09-01 | Current, Today, last 3 queries, Last N (100–10,000), Statistics, Charts, CSV, Settings |
| **1.0.1** | 2026-09-02 | Statistics extras (median, cache hit, cost per 1M, token mix). Enterprise Current uses the personal monthly dollar pool, not the org leftover cap |
| **1.0.2** | 2026-09-03 | Monthly cost forecast (dollars on team plans, included % on Pro). Critical alert (10M tokens or $5). Recent queries 1–10. Auto-refresh default 1 minute |
| **1.0.3** | 2026-09-11 | Optimize (Quick / Balanced / Deep). Support Buy Me a Coffee. Budget day basis. From date. Pro status bar as included % |
| **1.0.4** | 2026-09-20 | Burn Rate Guard. Coding stats (landed / AI, All on Cursor). UI languages (10 at release). Critical alert **Ignore** on the modal |
| **1.0.5** | 2026-09-30 | Model pricing table. Support → Write a message (FormSubmit). Landing page under `site/`. Pace and forecast colors. Six public tabs |
| **1.0.6** | 2026-10-05 | Site on [cursorcosttracker.com](https://cursorcosttracker.com/). Ukrainian (11th locale). Billing-cycle forecast. Play and Run Optimize into a new Agent chat. List price, cache $ saved, $ / 1k lines, To date, one sample resolver, Optimized filter, Group by conversation (default off), chart day detail and Sample / Last 7 / Month zoom |

Changelog sections live in root `CHANGELOG.md`. Billing-cycle forecast, Ukrainian, and the Ignore-store fix are in **1.0.6**, credited to [@milichev](https://github.com/milichev).

## What the code does today

VS Code / Cursor extension. Status bar: Current, Today, Refresh, 1–10 recent queries (default 3). Current/Today open **Statistics**. A query chip opens the queries list. Refresh spins while fetching `cursor.com`. Export CSV is on the queries toolbar.

**Current / Today.** Team: `used $ / limit $`. Pro: mean included % vs 100% (`32% / 100%`); Today is mean today % / daily pace plus today’s `$` (`3.5% / 4.5% (17.12 $)`). Unlimited hides Today. No session → `N/A`, no crash. Enterprise Current drops any pool over 1,000,000 cents and never reads `teamUsage.pooled`.

**Sample window.** `src/historySample.ts` is the only resolver for the queries table, Statistics sample, Charts daily bars, Coding stats, CSV, and Optimize spike counts. Last N (default 1000, range 100–10,000) **or** From–To (`cursorCost.historyFromDate` / `historyToDate`, cap 10,000). Empty To means through today. It does **not** drive Current, Today, Burn Rate Guard, the critical alert, or the monthly forecast series.

**Local calendar days.** `src/time/` owns padded `YYYY-MM-DD` day keys, day bounds, and `formatDateTimeWithZone` for Optimize. UI days are IDE-local; CI runs day tests under several `TZ` values.

**Webview sources.** Edit `media/src/` (entry `main.js` → esbuild → `media/history.js`). Charts modules under `media/src/charts/`; Settings under `media/src/tabs/settings.js`.

**Queries table.** Columns TIME, MODEL, COST, TOKENS, INPUT / OUTPUT, KIND. Newest first. Toolbar: **Over Warn at**, **Optimized**, **Group by conversation** (default off), Refresh, Export CSV. A red TOKENS cell (Warn at, default 1M) has **Play**: numbers-only brief for that conversation (or that one query when there is no id) pasted into a **new** Agent chat. The extension does not press Start, does not read prompt text or code, and does not write `.cursor/rules/`. Expand a row for catalog list price (input / output / cache write / cache read) beside billed cost. After Play or Run Optimize, matching rows are remembered in `globalState` `cursorCost.optimizedTargets` (cap 200) and the **Optimized** filter shows them.

**Group by conversation.** `cursorCost.groupQueriesByConversation` (default **false**) is the toolbar switch and the same checkbox under Settings → Recent queries. On: one collapsed row per local chat title, with request count and totals; expand for the same six columns. Chats that share a title (trim, collapsed whitespace, case-insensitive) merge into one row. An id with no local title is labelled `#` plus the first 8 characters. Requests with no conversation id land in **Ungrouped** and do not get a Play brief. Play on a merged-title row targets the conversation id that owns the dearest request. **Over Warn at** and the spike `!` still apply. Export CSV stays flat request rows. Titles come from the local index (`src/usage/conversationTitles.ts`); the extension does not invent groups from time gaps. Payload: `queryGroups` from `src/ui/queryGroups.ts`. Grouping is the queries table only.

**Statistics.** Cycle facts, Last N extras (total, average, median, cache hit, cost per 1M, token mix, cache $ saved vs input list price), spend-by-model/kind. **Current burn rate** when Burn Rate Guard is on. **Coding stats** when `codeLinesInsight` is on: landed / AI = %, the same if this branch landed, All on Cursor, and window `$` per 1k landed lines and per 1k AI lines when both sides exist. **Model pricing** from `https://cursor.com/docs/models-and-pricing.md` (six-hour cache, no session cookie): Active / Hidden, request counts, CursorBench. **Monthly cost forecast** on Statistics and Charts: Team dollars or Pro included %; `budgetDayBasis` is working days (default) or calendar days; `forecastWindow` is calendar month (default) or a valid 26–35 day billing cycle. Calendar-month mode marks an in-month renewal and drops the series there. Status bar and Today stay calendar-month.

**Charts.** Cumulative or daily token and cost bars. Click a bar for that day’s totals and an expandable query list from the loaded sample. **Sample / Last 7 / Month** filters that series in the webview. The same forecast control, AI vs merged when coding stats are on, then Today / This month / All time mix cards.

**Optimize.** Quick / Balanced (default) / Deep. Toolbar Run Optimize and a card’s Run paste into a **new** Agent chat (`composer.newAgentChat`). They do not paste into the last chat. Projected save stays `0 / 0.00 $` until `.ai/optimize-savings.md` exists. Lifetime credits are mid deltas in `globalState`. Briefs use the same local clock as the queries TIME column, plus a short zone label (`src/time/`).

**Support.** Buy Me a Coffee is live. GitHub Sponsors stays hidden until `GITHUB_SPONSORS_URL` is set. Write a message posts to the author through FormSubmit (`src/support/authorMessage.ts`). The session token is not in that POST.

**Settings.** Language (11 locales: en, pl, zh-cn, fr, de, ja, ko, pt-br, ru, es, uk), status-bar preview, Critical alert, Burn Rate Guard, Generated lines, Monthly budget, forecast window, Optimize depth, Recent queries (Group by conversation, Show last, From, To), Refresh. Good/warn colors follow the theme unless the user sets a hex.

**Guards.** One blocking modal: newest query at 10M tokens or $5, once per query, with **Ignore** on the dialog. A last query older than five minutes is remembered on first load without a modal. Burn Rate Guard is non-modal toasts only ($2 / $5, window default 10 minutes, min 2 queries) plus a Statistics card, banner, and Today tint. Spike `!` on the bar and in the table is live. `IgnoreStore` persists fingerprints; the table **Ignore** control and bang recompute after dismiss are still not wired.

## Scripts

| Script | Command |
|--------|---------|
| `build` | `node esbuild.mjs` (extension and `media/src/` → `media/history.js`) |
| `watch` | `node esbuild.mjs --watch` |
| `prepare` | `node scripts/install-hooks.mjs` |
| `typecheck` | `tsc --noEmit` plus test and scripts projects |
| `lint` | `eslint src` |
| `test` | `vitest run` |
| `sync-i18n` | `tsx scripts/sync-i18n.ts` |
| `package` | `npm run build && vsce package --no-dependencies` |

Settings cards use in-card `h3` titles. Status-bar options share one fieldset. Native `select` lists use dropdown tokens. Refresh is an unnamed `$(sync)` item immediately after Current/Today.

## Tree

```
src/extension.ts
src/config.ts
src/constants.ts
src/settingsStore.ts
src/budgetDayBasis.ts
src/forecastWindow.ts          # calendar month vs billing cycle
src/optimizeDepth.ts
src/historyLimit.ts
src/historyFromDate.ts
src/time/
src/historySample.ts           # Last N or From–To; one window for table/stats/charts
src/version.ts
src/format.ts
src/locale.ts                  # 11 locales
src/i18n.ts
src/i18n/catalogs/             # en pl zh-cn fr de ja ko pt-br ru es uk
src/usage/                     # session, api, parse, service, conversation id/titles/groups
src/pricing/                   # docs price table, list-price split, cache $ saved
src/includedPool/modelPool.ts
src/ui/                        # status bar, panel, rows, forecast, optimize, alerts, export
src/ui/conversationOptimizePrompt.ts
src/ui/conversationSessions.ts
src/ui/queryGroups.ts          # title-merged rows for the queries table
src/ui/optimizedTargets.ts
src/burnRate/
src/codeLines/                 # landed / AI, dashboard, $ per 1k lines
src/spikes/                    # threshold, critical alert, ignoreStore
src/support/                   # author message, nickname, comments
src/supportLinks.ts
src/leaderboard/               # gated tab; keep out of user-facing docs
src/unlock/                    # unlock code for that tab
media/history.html|css|js (js generated from media/src/)
media/src/
site/                          # cursorcosttracker.com (Pages)
.github/workflows/ci.yml
.github/workflows/pages.yml
test/*.test.ts
dist/                          # gitignored
*.vsix                         # gitignored
```

`src/leaderboard/` and `src/unlock/` ship a seventh panel tab that stays hidden until `support.leaderboardUnlocked`. Do not mention that tab in README, CHANGELOG, `site/`, `package.json` description/keywords, or `contributes.commands`.

## Security audit (pre-package)

| Location | Risk | Status |
|----------|------|--------|
| `src/usage/session.ts` | `WorkosCursorSessionToken` + ItemTable key `cursorAuth/accessToken` to **build** the cookie | OK (allowed) |
| `media/*` | cookie / token / Bearer | OK (none) |
| `src/` | `console.log` / OutputChannel dumps of the token | OK (none) |
| Webview `postMessage` | formatted rows, numbers-only briefs, model catalog; no cookies | OK |
| Model prices | public docs markdown, no session cookie | OK |
| Support POST | FormSubmit gets nickname, email, body — not the session token | OK |
| Composer titles / line counts | local headers and index keys; message `text` is not read | OK |
| SQLite | `node:sqlite` read-only or small sql.js copy; `SELECT … WHERE key = ?` | OK |
| CSP | `default-src 'none'` + nonce | OK |

Verdict: **safe to package VSIX**.

## Still not in the product

- Last N table **Ignore** and status-bar bang recompute (`IgnoreStore` only).
- Today pace arrows.
- Model-cost simulator (“this red query on model X”).
- 80% / 90% spend alerts and Copy stats (old v1.1 leftovers).
- Secret Storage / manual token.
- GitHub Sponsors URL (hidden until set).
