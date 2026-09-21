# Cursor Cost Tracker — Product Requirements

**Product:** VS Code / Cursor extension  
**Repo:** `cursor-cost-tracker` (standalone, MIT)  
**Document version:** 2.17  
**Date:** 2026-09-14  
**Status:** Product decision (MVP)  
**Canonical location:** this file (`.ai/context/prd.md`)  
**Polish translation:** [prd.pl.md](./prd.pl.md)

---

## 1. What it is

**Cursor Cost Tracker** is a lightweight extension for **Cursor** (primary target) and **VS Code** (when Cursor is installed beside it). It shows AI usage **inside the editor** so you do not need cursor.com.

Two UI surfaces:

| Surface | Pattern | In the IDE |
|---------|---------|------------|
| Always-on summary | Current, Today | **status bar** (bottom) |
| Details | “Last 100 Cursor queries” + Close | **webview panel** (editor tab) |

Clicking **Current** or **Today** opens the history panel on **Statistics**. A recent-query chip opens the **queries list**. No intermediate menu and no browser.

---

## 2. Problem

Cursor bills chat, agent, and inline edits in USD and tokens. Official usage lives on the account site or a limited dashboard — not on the IDE status bar while you work.

1. You cannot see current and daily spend while coding.
2. A large agent query (hundreds of thousands or **millions** of tokens) surprises you after the fact.
3. History (time, model, cost, tokens, input/output, kind) requires leaving the IDE.
4. There is no in-editor warning when a single query blows a token spike, and no way to dismiss or inspect that row.

**Non-goals:** Cursor payments, other IDEs, team dashboards, estimating cost *before* a prompt is sent, auto-fixing or rewriting the user’s code, reading chat/agent transcript bodies, or workspace LLM scans. **Allowed (Optimize tab):** ready prompts built only from usage metadata (model, tokens, cost) that the user opens in Cursor Chat.

---

## 3. Vision

> Like a battery indicator, but for the Cursor budget: always at the bottom, one click to full history.

After install (signed-in Cursor), the bar shows Current and Today. Click Current or Today opens Statistics; a recent-query chip opens the Last N table.

---

## 4. Users

| Persona | Priority | Need |
|---------|----------|------|
| Cursor developer (Pro / Business / Team) | P0 | Current, Today, Last 100 |
| Agent power user | P0 | Quick view of expensive queries |
| VS Code without Cursor | P2 | “Sign in to Cursor”; manual token later |

**MVP platforms:** Windows (P0), macOS and Linux (P0 `state.vscdb` paths).  
**MVP IDE:** Cursor. VS Code only if it finds Cursor’s local session database.

---

## 5. UI decision (binding)

### 5.1 Status bar

Right side (`StatusBarAlignment.Right`).

```
… │  $(credit-card) 3.79 $ / 250.00 $  │  $(calendar) 3.79 $ / 11.19 $  │  ↻  │  0.03 $ - 64.8k  │  0.10 $ - 237.0k  │  ! 1.20 $ - 1.2M  │
```

**Team / company:** Current is the dollar pool (`used $ / limit $`). **Personal Pro / Pro+:** Current is the **average** of included-quota percents vs 100% (`32% / 100%` when Cursor Models and Other Models are 33% and 31%). Today is the **average** of today’s attributed % vs even daily pace, with today’s dollar sum in parentheses (`3.5% / 4.5% (17.12 $)`).

Order is **Current**, **Today**, **Refresh**, then the newest queries. `cursorCost.recentQueryCount` controls how many query chips are shown (**1–10**, default **3**). Current+Today share one chip (priorities far from Ln/Col ~100). Refresh sits after that chip so it stays visible when query chips overflow. Each recent query is its **own** item so only a spike is red — VS Code cannot color part of one item. Each query is `cost - compact tokens`. Prefix `!` when that query has `tokens >= cursorCost.spikeTokenThreshold` (default **1_000_000**) and `cursorCost.showSpikeWarning` is on. Click Current / Today opens Last N on the **Statistics** tab. A recent-query chip opens the **queries list**. Refresh fetches from cursor.com on demand. Export CSV is on the Last N toolbar, not the status bar.

| Item | Text | Tooltip | Click |
|------|------|---------|-------|
| Current | Team: `$(credit-card) 3.79 $ / 250.00 $`. Pro: `$(credit-card) 32% / 100%` (mean of included quotas) | Hover card: plan, included/on-demand meters, reset, top models, Open Dashboard / Refresh | **open Statistics** |
| Today | Team: `$(calendar) 3.79 $ / 11.19 $`. Pro: `$(calendar) 3.5% / 4.5% (17.12 $)` (mean today % / daily pace, today $) | same hover as Current (one chip) | **open Statistics** |
| Refresh | `$(sync)` / `$(sync~spin)` | Refresh usage from cursor.com | refresh only, no panel |
| Last 1–10 queries (default 3) | `0.03 $ - 64.8k` or `! 1.20 $ - 1.2M` | model · time · tokens · kind | **open queries list** |

Colors: when warnings are on, good state uses `cursorCost.okColor` (default green `#89D185` on dark themes, `#18794E` on light). **Team:** at/over monthly or daily dollar cap uses `cursorCost.warnColor` (default red `#F14C4C` on dark, `#C50F1F` on light). Custom hex is used as-is. **Pro / Pro+:** Current (included percents) and Today (query sum, often no daily cap) stay the good color — they are not a dollar-pool overage — **unless Burn Rate Guard** is on and the live window is at warning/critical, in which case **Today** uses warnColor. A `!` spike on a recent query uses warnColor. Loading/error — default. When `cursorCost.showSpikeWarning` is off, there is no `!` and no status color. Warn at, colors, and the warning toggle live on the **Settings** tab.

Empty recent slots are hidden. Ignore of spikes (persist in `globalState`) remains v1.1 follow-up.

### 5.2 Click → history panel

Primary path: **not** Quick Pick. Open the panel immediately. Current / Today land on **Statistics**. A recent-query chip lands on the **queries list**.

**Container:** `WebviewPanel`, reused ID, title **Last 100 Cursor queries**.

| TIME | MODEL | COST | TOKENS | INPUT / OUTPUT | KIND |
|------|-------|------|--------|----------------|------|
| `1.09.2026, 10:05:12` | default | 0.03 $ | 64,755 | 12,856 / 168 | Included In Business |

Newest first, monospace body, CSS `--vscode-*`. Command Palette: `Cursor Cost: Show Usage History`.

Toolbar: **Last N Cursor queries** (default 1000) | **Statistics** | **Charts** | **Optimize** | **Support** | **Settings**. Queries toolbar: **Over Warn at** (toggle — only queries at/over the token warning), **Refresh** (fetch from cursor.com), and **Export CSV**. Show last / From date stay under Settings. Statistics is the glossary for Current/Today, a **Month to date** meter (this month’s spend vs working days so far × daily budget, or vs a working-day pace forecast when there is no daily cap) with a used/forecast chart — on Pro one line pair per included quota on a 0–100% axis, plus a today-vs-daily-budget meter per quota — plus cycle / Last N aggregates. Charts: tokens and cost over time as cumulative bars + line on one scale, the same **Monthly cost forecast** control as Statistics (meters, range, used/forecast/ideal), then Today / This month / All time mix cards from that Last N sample. **Optimize:** three colored collapsible depth cards (Quick / Balanced / Deep) with per-card Run + expand-to-preview; Default badge follows `cursorCost.optimizeDepth` (Balanced by default). Toolbar **Run Optimize** pastes the default-depth prompt into the last Composer chat. Findings focus the last expensive / red query. Projected save shows `0 / 0.00 $` until the agent writes `.ai/optimize-savings.md` (`cct-savings` with `project`, mid tokens/USD, `run`); every prompt requires a closing tokens/USD/project report. One collapsed card is the **projected cost saved on a similar request**; expand for the explanation plus credited per-project totals from `globalState`. Not a whole-workspace audit. No chat transcript is read by the extension. **Support:** Buy Me a Coffee (URL in `src/supportLinks.ts`). GitHub Sponsors tiers stay in code but are hidden until the sponsor URL is set. Settings holds Warn at, Show last, **From date**, Show warnings, Optimize depth, and Good/Warning colors. Last N figures are the events API sample — not the Current pool.

**Token spike (v1.1, required after MVP):** extra column or leading `!` when `tokens >=` the user threshold. Row actions:

| Action | Effect |
|--------|--------|
| **Ignore** | Persist fingerprint in `globalState`. Bang hidden on that row and dropped from the status-bar spike set. |

No **auto-repair**, workspace LLM scan, or chat-transcript analysis. Spike Ignore (persist in `globalState`) remains v1.1 follow-up. Un-ignore (optional): small “Show ignored” control in the table.

**Critical last-query alert:** when the **newest** query is at or above `cursorCost.criticalTokenThreshold` (default **10,000,000** tokens) **or** `cursorCost.criticalCostUsdThreshold` (default **$5**), the extension host shows a blocking error dialog. Independent of the status-bar `!` (`showSpikeWarning`). Each newest-query fingerprint is processed once (`globalState` `cursorCost.lastCriticalSeenKey`). A historical last query older than five minutes is remembered on first load — no modal — so a restart does not block work. A query that just completed still alerts. **Open History** opens Last N. Toggle: `showCriticalAlert`.

**Burn Rate Guard (1.0.4):** sum billed `costUsd` in a live window ending **now** (default **10 minutes**). Statistics always shows **Current burn rate** when enabled (`3.42 $ / 10 min`, optional `×` vs the user’s own recent pace, Today total). Window spend ≥ **$2** (default) shows a **non-modal** warning toast; ≥ **$5** a **non-modal** error toast. Once per episode, escalate warning→critical once, Snooze 30 min, first-load grace 5 min. Does **not** stop Cursor. Optional **Focus Composer** on the critical toast. `minQueries` default **2** so a single expensive query stays the last-query critical alert. Included Pro events at $0 still show token throughput on the card; dollar toasts may never fire. Today chip uses warnColor when the window is warning/critical and Show warnings is on. Last N rows in the window get warn styling (no 7th column). Toggle: `cursorCost.burnRateGuard`.

**Generated Lines Insight / Coding stats (1.0.4):** for the **active workspace**, Statistics shows a **Coding stats** card in the same window as Last N / From date: **landed / AI = %** (your git insertions on `main`/`master` ÷ AI composer lines for this repo), the same **if this branch landed** (`(landed + this branch) / AI`), and **All on Cursor** (dashboard Lines Edited, split under **Projects** by local composer mix). Charts uses the same formulas. Not `AI − pending`; not line-level blame. Toggle: `cursorCost.codeLinesInsight` (default **true**).

### 5.3 Out of MVP

Quick Pick as default click, Activity Bar, blocking modal on the history click path, 6-column TreeView, React/Vue in the webview, a separate Electron app, auto-repair / workspace scan / reading chat transcript bodies (structured composer header line totals and checkpoint hunk counts for Generated Lines are allowed; message `text` is not).

---

## 6. MVP goals

| ID | Goal | Criterion |
|----|------|-----------|
| G1 | Costs in the IDE | status bar within 10 s of startup (signed-in user) |
| G2 | One click to history | Statistics (Current/Today) or Last N table (query chip) &lt; 2 s (cache) |
| G3 | Consistent numbers | Current/Today match Cursor usage (± $0.01) |
| G4 | Zero configuration | VSIX, no `.env` |
| G5 | Does not block work | no modals on the normal path; API error = N/A. Blocking dialog only for a last-query critical alert (default 10M tokens or $5). Burn Rate Guard uses non-modal toasts only |

---

## 7. User stories (MVP)

| ID | As a… | I want… | so that… |
|----|-------|---------|----------|
| A1 | developer | to see Current on the bar | I know cycle spend |
| A2 | developer | to see Today on the bar | I can pace the daily budget |
| A3 | developer | to click Current or Today | I see Statistics (monthly forecast) |
| A4 | developer | a warning color | I notice overspend |
| A5 | developer | Refresh | I sync after a long agent run |
| A6 | developer | a clear error without a token | I know I must sign in |
| A7 | developer | a tooltip with plan and cycle date | I get context without the table |

v1.1: token-spike bang (§5.1–5.2), Ignore, configurable threshold; 80%/90% spend alerts; Copy stats.  
**1.0.4:** **Burn Rate Guard** (live window $/time, banner, non-modal toasts, Statistics card, Today tint), **Coding stats** (landed / AI · All on Cursor), and **10 UI languages**.

### 7b. User stories (v1.1 — token spike)

| ID | As a… | I want… | so that… |
|----|-------|---------|----------|
| B1 | developer | a `!` on the status bar when a query exceeds my token limit | I notice a spike without opening the table |
| B2 | developer | the same `!` on that row in Last 100 | I see which query exploded |
| B3 | developer | to set the limit (default 1,000,000 tokens) | 1M is not hardcoded for everyone |
| B4 | developer | **Ignore** on that row | the bang goes away if I accept the cost |
| B5 | developer | ignored spikes to stay dismissed after reload | I am not nagged again |
| B6 | developer | a blocking alert when the last query hits 10M tokens or $5 | I cannot miss an extreme request |

---

## 8. Data

**Session:** `cursorAuth/accessToken` from SQLite `state.vscdb` → cookie `WorkosCursorSessionToken={sub}::{token}`.

| OS | Path |
|----|------|
| Windows | `%APPDATA%\Cursor\User\globalStorage\state.vscdb` |
| macOS | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` |
| Linux | `~/.config/Cursor/User/globalStorage/state.vscdb` |

**Current:** `GET https://cursor.com/api/usage-summary`. Team / company: dollar pool (individual onDemand → plan → team onDemand → overall). Drop any pool whose limit is above **1,000,000 cents** ($10,000) — that is the org `pooled` / leftover on-demand cap (e.g. $24,800), not the personal $250 seat. Same filter as Stack Manager `isPersonalMonthlyPool`. Never read `teamUsage.pooled`. Personal Pro: dashboard bars `autoPercentUsed` (Cursor Models) and `apiPercentUsed` (Other Models) — not `plan.used/limit`. Unlimited → hide Today.

**Today:** `POST …/dashboard/get-filtered-usage-events` — `dailyBudget = remaining / days left` where days follow `cursorCost.budgetDayBasis` (`workingDays` = Mon–Fri left, default; `calendarDays` = every remaining calendar day); `todayUsed` = sum of today’s cents (local timezone).

**Month to date / Monthly cost forecast:** same events sample. **Unit follows the plan:** Team / Business / Enterprise use **dollars** (`unit: 'usd'`); personal Pro / Pro+ use **included percent** (`unit: 'percent'`). Team: this calendar month’s spend / (pace days so far × daily budget), one Spend series with run-out / today vs daily budget meters. Personal Pro: included quotas vs even pace (100% ÷ pace days this month). Pace days follow `budgetDayBasis`: Mon–Fri by default, or all calendar days. The same forecast chart appears on Statistics and Charts (calendar days 1st → month end: cumulative bars + used on one scale, dashed forecast, dotted leftover ideal). No daily dollar budget on Team: spend / pace-day dollar forecast. No pace day yet → spend / — without a meter.

On Pro the block is titled **Monthly cost forecast**. Each quota meter shows cycle used vs 100% plus a run-out date (or “lasts the month”), and the 0–100% chart marks where each forecast hits the ceiling. Quota percent is only reported per cycle, so a day’s share is weighted by that day’s dollar spend.

**Last N:** same events API, `pageSize=100`, extra pages until `cursorCost.historyLimit` (default **1000**, min 100, max 10_000). When `cursorCost.historyFromDate` is a local calendar day (`YYYY-MM-DD`, e.g. `2026-09-01` for the start of September), fetch from that day’s 00:00 through today instead of Last N (still capped at 10,000).

**Spike fingerprint (v1.1):** stable id from the API if present, else `${timestamp}|${tokens}|${costUsd}|${model}`. Ignored ids in `context.globalState` key `cursorCost.ignoredSpikes`.

**Refresh:** `activate` must not block the UI; poll every 1 minute (1–60); manual Refresh; `AbortController`.

**Security:** token only in the extension host; webview gets events only; never log the token; no telemetry in MVP.

---

## 9. Technology

VS Code Extension API. TypeScript + esbuild + StatusBarItem + vanilla webview + `fetch` + sql.js + Vitest + vsce.

Details: [tech-stack.md](./tech-stack.md).

Target layout:

```
src/extension.ts
src/usage/{session,api,parse,service}.ts
src/ui/{statusBar,historyPanel}.ts
src/spikes/{threshold,ignoreStore}.ts   # v1.1
src/format.ts
media/history.{html,css,js}
```

---

## 10. Commands and settings

| Command ID | Title | Phase |
|------------|--------|-------|
| `cursorCost.showHistory` | Show Usage History (Last 100) | MVP |
| `cursorCost.refresh` | Refresh | MVP |

| Key | Default | Notes |
|-----|---------|--------|
| `cursorCost.pollIntervalMinutes` | 1 | 1–60; Settings **Auto-refresh** |
| `cursorCost.showStatusBar` | true | Settings status-bar editor |
| `cursorCost.showToday` | true | Settings status-bar editor |
| `cursorCost.minimalMode` | false | Current + Refresh only; Settings status-bar editor |
| `cursorCost.spikeTokenThreshold` | 1000000 | min 1000; Settings tab edits in **k** (100 = 100k tokens); `!` on that query |
| `cursorCost.showSpikeWarning` | true | off = no `!` and no green/red |
| `cursorCost.showCriticalAlert` | true | blocking dialog when the newest query hits the critical token or dollar threshold |
| `cursorCost.criticalTokenThreshold` | 10000000 | min 1000; Settings tab in **k** (10000 = 10M); either threshold is enough |
| `cursorCost.criticalCostUsdThreshold` | 5 | min 0.01 USD; either threshold is enough |
| `cursorCost.burnRateGuard` | true | live window on Statistics; non-modal toasts; Today tint when high |
| `cursorCost.burnRateWindowMinutes` | 10 | 2–60; right edge is now |
| `cursorCost.burnRateWarningUsd` | 2 | min 0.01; non-modal warning toast |
| `cursorCost.burnRateCriticalUsd` | 5 | never below warning; non-modal error toast; does not stop Cursor |
| `cursorCost.burnRateMinQueries` | 2 | 1–50; a single query stays the last-query critical alert |
| `cursorCost.burnRateWarningToast` | true | off = remember episode without a toast |
| `cursorCost.burnRateCriticalToast` | true | off = remember episode without a toast |
| `cursorCost.codeLinesInsight` | true | Coding stats on Statistics and Charts (landed / AI · All on Cursor) |
| `cursorCost.language` | `en` | Panel, status bar, toasts; independent of VS Code / Cursor display language |
| `cursorCost.historyLimit` | 1000 | min 100, max 10_000; Settings **Show last**; ignored when From date is set |
| `cursorCost.historyFromDate` | (empty) | local `YYYY-MM-DD`; Settings **From date** (Start of month / Today); empty = Last N |
| `cursorCost.budgetDayBasis` | `workingDays` | `workingDays` (Mon–Fri, default) or `calendarDays` (every day in the month); Settings **Pace by** — Today daily budget, MTD meters, forecast |
| `cursorCost.optimizeDepth` | `balanced` | Optimize prompt: Quick / Balanced / Deep |
| `cursorCost.okColor` | `#89D185` | good-state color (darker `#18794E` on light themes) |
| `cursorCost.warnColor` | `#F14C4C` | warning color (darker `#C50F1F` on light themes) |

Activation: `onStartupFinished`.

---

## 11. Phases

| Phase | Scope |
|-------|--------|
| **MVP** | session + API, status bar, Last 100 webview, polling, errors |
| **v1.1** | spike `!` (default 1M tokens, user setting), Ignore + persist, 80/90% spend alerts, Copy stats |
| **1.0.4** | Burn Rate Guard + Coding stats (AI vs git) + 10 UI languages |
| **v1.2** | (open — sidebar / Quick Pick backlog) |
| **v2** | Secret Storage, CSV, Open VSX |

---

## 12. Risks

Unofficial API / `state.vscdb` → isolate in `src/usage/`, show N/A. Session: `node:sqlite` read-only when available (multi-GB DBs); sql.js copy only for small files. Remote SSH: `extensionKind: ui`. Rate limit: poll ≥ 1 minute.

---

## 13. MVP acceptance

- [ ] VSIX in Cursor (Windows): Current within 10 s for a signed-in account
- [ ] Today hidden when events fail; Current still shown
- [ ] Click Current/Today → Statistics tab; a recent-query chip → Last N columns from §5.2
- [ ] Close / X dismisses; another click reuses the panel
- [ ] Refresh updates the bar and the table
- [ ] Missing token → message, no crash
- [ ] Token never in the webview or logs
- [ ] Restart Cursor: activate without errors

### 13b. v1.1 acceptance (after MVP)

- [ ] Query with `tokens >=` setting shows `!` on the row and on the status bar
- [ ] Default threshold is 1,000,000; changing the setting updates without reinstall
- [ ] **Ignore** hides that row’s bang and the bar bang if no other spikes remain
- [ ] Ignore survives window reload
- [ ] Queries below the threshold never show `!`

### 13c. Critical last-query alert

- [ ] Newest query at ≥ 10M tokens or ≥ $5 shows a blocking dialog (defaults)
- [ ] The same query is not shown again after dismiss / reload
- [ ] A later newest query over the threshold alerts again
- [ ] First load of a last query older than five minutes does not block
- [ ] Off via `showCriticalAlert`; independent of `showSpikeWarning`

### 13d. Burn Rate Guard (1.0.4)

- [ ] Statistics **Current burn rate** card when enabled, even under the warning floor
- [ ] Window ≥ $2 warning / ≥ $5 critical: non-modal toasts, once per episode, Snooze 30 min
- [ ] First load with newest-in-window older than five minutes does not toast
- [ ] Today chip warnColor when the window is high and Show warnings is on
- [ ] A single expensive query (minQueries default 2) does not fire this toast
- [ ] No second blocking modal; G5 still has only the last-query critical dialog

---

## 14. Open

Marketplace UI in English. No last-query shortcut on the bar in MVP. Ship a local VSIX first.

---

## 15. Summary

Cursor/VS Code extension. Bar: Current + Today + sync + **spike `!`**. Click Current/Today: Statistics; query chip: Last N. Spike rows can be **Ignored** (follow-up). Optimize tab: metadata prompts only (no transcript). No auto-fix. Stack: TypeScript, esbuild, sql.js, Vitest. Usage logic in `src/usage/`.
