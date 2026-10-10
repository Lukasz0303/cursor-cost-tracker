# Architecture — Cursor Cost Tracker

## 1. Processes

```
Cursor / VS Code
  Extension Host (Node)          Webview (sandbox)
  extension.ts  ──postMessage──►  Last N panel
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
| `src/ui/statusBar.ts` | Budget chip + Refresh + 1–10 recent-query items (default 3) |
| `src/ui/statusBarTooltip.ts` | Hover card for Current/Today (meters, aligned model table) |
| `src/ui/historyPanel.ts` | WebviewPanel lifecycle; theme and ok/warn colors post without reloading the session |
| `src/ui/panelPublisher.ts` | Full data paint vs color-only paint |
| `src/ui/panelIoCache.ts` | Reuse session and title reads when the sample fingerprint is unchanged |
| `src/ui/historyRows.ts` | table rows + host payload; Warn-at filter, list price, optimized marks, `queryGroups` |
| `src/ui/periodStats.ts` | Period stats glossary and aggregates |
| `src/ui/chartSeries.ts` | Charts tab series (tokens/cost over time) |
| `src/ui/periodCards.ts` | Charts tab Today / This month / All time mix cards |
| `src/ui/mtdPace.ts` | Month-to-date meter (elapsed pace days × daily budget), forecast, and chart series; pace days follow `budgetDayBasis` |
| `src/ui/optimizeInsights.ts` | Usage-metadata waste signals for Optimize |
| `src/ui/optimizeSavings.ts` | Parse agent-written `.ai/optimize-savings.md` (`cct-savings` + `project`); no fixed heuristic |
| `src/ui/optimizeSavingsFile.ts` | Read / watch workspace savings file |
| `src/ui/optimizeLifetimeSavings.ts` | Credited lifetime savings in `globalState` (total + per project; mid deltas per Optimize run) |
| `src/ui/optimizePrompt.ts` | Quick / Balanced / Deep prompt templates (require tokens/USD/project report) |
| `src/ui/optimizePayload.ts` | Optimize tab payload (projection + lifetime) |
| `src/ui/conversationOptimizePrompt.ts` | Numbers-only brief for one conversation (Play); no prompt text or code |
| `src/ui/conversationSessions.ts` | Group the sample by conversation id for that brief |
| `src/ui/queryGroups.ts` | Queries-table groups: title merge, `#` + 8-char id, Ungrouped, Play target |
| `src/ui/optimizedTargets.ts` | Remember optimized conversation ids / fingerprints (`globalState`, cap 200) |
| `src/ui/openOptimizeChat.ts` | Paste Run Optimize into the open Agent chat (`composer.focusComposer`); Play opens that conversation (`composer.openComposer` with its id) and pastes there (clipboard fallback if that command is missing). Never auto-submits. User presses Start |
| `src/ui/criticalAlert.ts` | Blocking dialog when the newest query hits 10M tokens or $5 |
| `src/ui/burnRateAlert.ts` | Non-modal warning/error toasts for live-window spend (View details, Snooze, Focus Composer) |
| `src/burnRate/window.ts` | Live `[now − W, now]` query window |
| `src/burnRate/pace.ts` | Historic bucket median vs live window (`×` display only) |
| `src/burnRate/detect.ts` | Clamps, level, once-per-episode + snooze + grace |
| `src/burnRate/copy.ts` | English card / toast strings + Statistics payload |
| `src/codeLines/` | Coding stats: composer headers, git landed / this branch, dashboard Lines Edited split, effectiveness, $ per 1k lines |
| `src/i18n.ts` / `src/i18n/catalogs/` | UI catalogs (11 locales) |
| `src/locale.ts` | `cursorCost.language` clamp |
| `src/spikes/threshold.ts` | token spike vs setting |
| `src/spikes/criticalAlert.ts` | last-query critical threshold + once-per-query decision |
| `src/spikes/ignoreStore.ts` | v1.1 persisted Ignore keys |
| `src/format.ts` | dollars, percents, tokens, dates, kind |
| `src/config.ts` | `workspace.getConfiguration('cursorCost')`; light/dark default colors |
| `src/budgetDayBasis.ts` | working days vs calendar days |
| `src/forecastWindow.ts` | calendar-month vs valid monthly billing-cycle forecast window |
| `src/optimizeDepth.ts` | Optimize prompt depth (`quick` / `balanced` / `deep`) |
| `src/historyLimit.ts` | clamp Last N (100–10,000, default 1000); From date headings |
| `src/historyFromDate.ts` | parse `YYYY-MM-DD`, start of month, local day bounds |
| `src/time/` | Canonical local day keys, day bounds, `formatDateTimeWithZone` for Optimize |
| `src/historySample.ts` | One sample window: Last N or From–To (table, Statistics sample, Charts bars, Coding stats, CSV) |
| `src/version.ts` | installed version from `package.json` (webview label) |
| `media/history.html\|css\|js` | Last N + Statistics + Charts + Optimize + Support + Settings. Edit `media/src/` (entry `main.js`); esbuild writes `media/history.js` |
| `src/pricing/` | Public model price table, per-query list-price split, cache $ saved |
| `src/usage/conversationId.ts` | Usage-event conversation id |
| `src/usage/groupConversations.ts` | Group by conversation id (Optimize brief) and by normalized title (queries table); no time-gap guessing |
| `src/usage/conversationTitles.ts` | Local title for the brief |
| `src/usage/readConversationTitles.ts` | Index keys + header name; no chat body |
| `src/support/` | Write-a-message draft, FormSubmit POST, nickname, published comments |
| `src/supportLinks.ts` | Buy Me a Coffee URL; GitHub Sponsors URL + tiers (hidden in UI until the URL is set) |
| `src/leaderboard/` + `src/unlock/` | Gated tab. Hidden until unlocked. Do not document it in README, CHANGELOG, `site/`, or `package.json` |
| `site/` | Static product page (GitHub Pages → cursorcosttracker.com) |
| `.github/workflows/ci.yml` | `npm ci`, typecheck, Vitest, esbuild on pull requests and on `main` / `release/**` |
| `.github/workflows/pages.yml` | Assemble `site/` and deploy GitHub Pages |
| `esbuild.mjs` | bundle |
| `package.json` | contributes, engines, activation, `"icon": "icon.png"` |
| `icon.png` | Extension / marketplace icon (repo root) |

If you change the directory layout, update this file and `shared.mdc`.

## 3. Data flow

1. `activate` → `UsageService.start()` (fetch in the background).
2. Snapshot: `loading` | `ready` | `error`.
3. Status bar, the critical-alert controller, and the burn-rate controller subscribe to the snapshot.
4. Click Current / Today → `cursorCost.showHistory` with the Statistics tab. A recent-query chip opens the queries list. The panel receives `{ type: 'data', … }` (no token): events, the `historySample` window (Last N or From–To), `groupQueriesByConversation` and `queryGroups` (local titles only), forecast window and renewal marker, model catalog, list-price splits, optimized targets, burn rate, and coding stats. Settings also receives `statusBarPreview` and every `cursorCost.*` value. Billing-cycle availability comes from the usage-summary cycle dates.
5. Refresh (status bar, queries toolbar, or command) → `service.refresh()`. Export CSV saves that same sample. Run Optimize posts into the host, which pastes the depth prompt into the open Agent chat; Play opens that conversation and pastes the numbers-only brief there. Chart day detail and Sample / Last 7 / Month filter the series already in the webview.

## 4. MVP boundaries

Do not add: Activity Bar, React, history TreeView, localhost calls, or a manual token in settings (Secret Storage is still open). `IgnoreStore` exists; wiring table **Ignore** + bang recompute is still remaining. Today pace arrows and the model-cost simulator are not built. Optimize, Play, and group-by-conversation use usage metadata and local titles only — no transcript analysis / auto-fix.
