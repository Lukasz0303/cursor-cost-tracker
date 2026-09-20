# Changelog

## 1.0.4 — 2026-09-20

### Added

- **Language** — Settings → Language switches the Last N panel, status bar, and toasts immediately. **10 locales**: English (default), Polski, 简体中文, 日本語, Español, Português (Brasil), Русский, 한국어, Français, Deutsch. Independent of the VS Code / Cursor display language (`cursorCost.language`).
- **Burn Rate Guard** — sum billed spend in a **live window ending now** (default **10 minutes**). Statistics always shows **Current burn rate** when enabled (`3.42 $ / 10 min`, optional `×` vs your recent pace, Today total, token mix, meter vs critical $). A **banner** appears when the window is warning or critical. Does **not** stop Cursor.
- **Non-blocking toasts** — warning at **$2** and error toast at **$5** (once per episode, escalate once, Snooze 30 min, first-load grace 5 min). After Snooze a still-high window can toast again. Critical toast can offer **Focus Composer**.
- **Today chip + Last N** — Today uses warn color when the live window is high and Show warnings is on; query rows in the window get warn styling (no 7th column).
- **Settings** — **Burn Rate Guard** fieldset after Critical alert (`cursorCost.burnRateGuard`, window minutes, warning/critical $, min requests, toast toggles). **Generated lines** fieldset after that (`cursorCost.codeLinesInsight`, default on).
- **Coding stats** — Statistics card in the same window as Last N / From date. Title includes the date range. Hero is **landed / AI = %** (your effectiveness) plus the same **if this branch landed** on `main`/`master`. **All on Cursor** is dashboard Lines Edited (`get-user-analytics`, same heatmap); **Projects (n)** splits that total by local composer mix (this repo included, zero rows hidden). Help **`?`** explains the formulas and also picks which git identities to count (Cursor email by default; optional sum). Same clone folder name is one project. A parent workspace with two or more nested git repos or submodules (`.gitmodules` / `.git` file, including two-level paths like `servers/<service>`) sums into one stack. Git counts match GitHub noreply merge authors (`Login <id+Login@users.noreply.github.com>`) and `origin/main` when it exists; dirty-tree does not double-count staged files; workspace path match does not confuse `/proj` with `/proj-old`. Charts uses the same ratios plus labeled bars for this branch and All on Cursor on one scale. Toggle: `cursorCost.codeLinesInsight`.

### Changed

- **Critical alert** — modal offers **Ignore** next to Open History so that query is dismissed explicitly.
- **Monthly cost forecast** — nine chips in a 3×3 grid. First row is Month forecast, Pace, and Runs out; then Daily pace, Daily budget, and To last (leftover ÷ remaining days); then days so far, days left, and quota / budget left.
- **Tokens / Cost over time** (Charts) — one cumulative bar per calendar day (height = running total). Hover shows that day’s amount plus the total so far.

### Fixed

- **Critical alert** — no longer re-opens when the same query’s tokens/cost are revised by the API after the first modal.

### Notes

- G5 unchanged: the only blocking modal remains the last-query critical alert (10M tokens / $5).
- Included Pro `$0` events still show token throughput on the burn card; dollar toasts need billed `costUsd`.
- `minQueries` default **2** so a single expensive query stays the last-query critical alert.
- Coding stats: AI lines come from local composer headers (not the usage API) as composer **added + removed** (not every rewrite; `totalLinesRemoved` is included). Effectiveness is **git insertions on the default branch ÷ AI** for this repo — not `AI − pending`, and not all insertions ever on main. Git lines are the selected author(s), not the whole team. Duplicate clones and submodule stacks count as one current project when you open the parent folder. All on Cursor is the dashboard Lines Edited total. Tab completions are still not in local headers.

## 1.0.3 — 2026-09-11

### Added

- **Optimize tab** — Quick / Balanced (default) / Deep prompts from usage metadata for the **last red query** (≥ Warn at), not merely the newest query. Three colored collapsible depth cards with per-card Run and expand-to-preview; Default badge; toolbar **Run Optimize** pastes the default depth into the **last Agent chat** (`composer.focusComposer`). After Start the agent writes projected savings to `.ai/optimize-savings.md`. The panel shows **Projected save per similar request** as `0 / 0.00 $` until that file exists; expand for the explanation and credited totals per project. No chat transcript is read by the extension.
- **Support tab** — Buy Me a Coffee (`https://buymeacoffee.com/lzzzielinsn`). GitHub Sponsors is omitted from the tab until the account is live.
- **Budget day basis** — pace Today / MTD / forecast by working days (Mon–Fri, default) or all calendar days (`cursorCost.budgetDayBasis`).
- **From date** — load queries from a local calendar day (e.g. start of month) through today instead of Show last (`cursorCost.historyFromDate`). Lives under Settings → Recent queries.
- **`cursorCost.optimizeDepth`** — Quick / Balanced / Deep, also on Settings.

### Changed

- **Pro status bar** — Current as mean included `% / 100%` (e.g. `32% / 100%`); Today as mean today `% / daily pace` plus today’s `$` (e.g. `3.5% / 4.5% (17.12 $)`). Today turns **red** when attributed % is at or over daily pace.
- **Queries toolbar** — **Over Warn at** pill switch filters the table to queries at or over the token warning; Show last / From date stay under Settings.
- **Charts** — Y-axis follows the data so tokens / cost / forecast fill the plot instead of jumping to 500$ or 1000M. Cumulative bars + line stay on one scale.
- **Monthly cost forecast** — hover shows used vs that day’s calculated budget (Enterprise / Team denominator stays put on refresh). Amounts are green when under budget, red when over.
- **README / marketplace** — three product goals: status bar, monthly cost forecast, and local Optimize; Optimize screenshot; Buy Me a Coffee.

## 1.0.2 — 2026-09-03

### Added

- **Monthly cost forecast** — Statistics and Charts show used spend through today, a dashed prediction to month end, and a dotted ideal pace. Team / Business / Enterprise use dollars; personal Pro uses included percent for Cursor Models and Other Models.
- **Range and run-out** — zoom the forecast to Today, 7 days, or Month. Each quota shows when it would run out, or that it lasts the month.
- **Critical alert** — a blocking dialog when the newest query hits 10M tokens or $5 (configurable; once per query; independent of the status-bar `!`).
- **Recent queries** — choose how many newest queries appear on the status bar (1–10, default 3). Auto-refresh defaults to 1 minute.

### Fixed

- **Status bar** — Current and Today open the Statistics tab; query chips still open the list. Hover is a compact card with included / on-demand meters. Refresh stays after Current/Today so window overflow cannot hide it. Export CSV is on the Last N toolbar, not the status bar.
- **Settings** — status-bar preview, content, warnings, and colors share one card with in-card titles. Critical alert is a separate fieldset.
- **Charts** — hidden tips no longer leave an empty ghost box. Ideal lines use the Good color; series stay blue/purple, not alert red.

## 1.0.1 — 2026-09-02

Clearer Statistics cards, extra Last N metrics, and Current that stays on the personal monthly cap for enterprise accounts.

### Added

- **Statistics** — median cost per query, cache hit, cost per 1M tokens, and an input / output / cache mix bar on the Last N summary.
- **Billing cycle** — elapsed progress and reset date on the cycle chip; plan name shown as a badge.

### Fixed

- **Statistics** cards use even heights, stronger number hierarchy, and a warning tint when queries exceed the token threshold. Today no longer shows a fake full bar when there is no daily budget.
- **Statistics** Status bar and Billing cycle cards no longer overlap. Cache hit now explains that the percent is prompt tokens reused from cache.
- **Current** on enterprise / team accounts uses the personal monthly dollar pool (typically used / $250), not the large org leftover cap.
- **Today** daily budget keeps at least one working day when only a weekend remains in the month.

## 1.0.0 — 2026-09-01

First public release: **Current**, **Today**, and the last 3 queries on the status bar. Click opens Last N (100–10,000) with Statistics, Charts, CSV export, and Settings.
