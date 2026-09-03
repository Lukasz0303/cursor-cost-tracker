# Changelog

User-facing notes for Cursor Cost Tracker. Open VSX and Cursor Extensions show this file on the **Changelog** tab.

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
