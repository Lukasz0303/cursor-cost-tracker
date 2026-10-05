<div align="center">

<img src="./icon.png" alt="Cursor Cost Tracker" width="192">

# Cursor Cost Tracker

<p align="center">
  <a href="https://cursorcosttracker.com/"><strong>cursorcosttracker.com</strong></a>
</p>

</div>

<p align="center">
  <strong>See spend · catch spikes · forecast the month · Optimize locally · see what landed.</strong>
</p>

<p align="center">
  Always-on <strong>Current</strong>, <strong>Today</strong>, and <strong>1–10 recent queries</strong> on the
  status bar. <strong>Statistics</strong> shows live <strong>burn rate</strong>, <strong>model pricing</strong>, Pro meters, and
  <strong>Coding stats</strong> (AI vs what landed). A <strong>blocking critical alert</strong> fires when one
  query blows past your token or dollar ceiling. <strong>Monthly cost forecast</strong> and
  <strong>Optimize</strong> stay in the editor — savings in <code>.ai/optimize-savings.md</code> only.
  No extra app. No pasted token.
</p>

<p align="center">
  <a href="https://open-vsx.org/extension/lukasz0303/cursor-cost-tracker"><img src="https://img.shields.io/badge/Open%20VSX-cursor--cost--tracker-purple.svg" alt="Open VSX"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/version-1.0.6-blue.svg" alt="Version 1.0.6">
  <img src="https://img.shields.io/badge/Contributions-welcome-brightgreen.svg" alt="Contributions welcome">
  <a href="https://buymeacoffee.com/lzzzielinsn"><img src="https://img.shields.io/badge/Buy%20me%20a%20coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black" alt="Buy me a coffee"></a>
</p>

---

**Cursor Cost Tracker** is a VS Code / Cursor extension with five jobs:

1. **Status bar** — Current, Today, and the newest queries stay on the bar while you code. Green is on pace; red is over budget or a token spike (`!`).
2. **Guards** — **Burn Rate Guard** shows live `$ / window` on Statistics, a banner when that window is hot, and non-blocking toasts. A **blocking critical alert** fires when the newest query hits your token or dollar ceiling (**Open History** / **Ignore**). Neither stops Cursor.
3. **Monthly cost forecast** — used, forecast, and ideal on one chart, plus **when** Team dollars or Pro included limits run out. The chart can follow the calendar month or a valid Cursor billing cycle ([#11](https://github.com/Lukasz0303/cursor-cost-tracker/pull/11) by [@milichev](https://github.com/milichev)).
4. **Optimize** — ready prompts for the last red (**Warn at**) query, or **Play** on one red row. Projected savings stay in this project’s **`.ai/optimize-savings.md`** only — the extension never reads the chat.
5. **Coding stats** — analysis of AI-generated code vs what actually landed: **`landed / AI = %`** (your effectiveness), the same if this branch merged to `main`/`master`, and **All on Cursor** (dashboard Lines Edited) split by project.

Click **Current** or **Today** for Statistics (burn rate, model pricing, Coding stats, forecast). Click a **recent-query chip** for the Last N list. **Refresh** only syncs; **Export CSV** is on the Last N toolbar. **Run Optimize** pastes into a new Agent chat — savings appear after you press Start.

The panel has six tabs:

- **Last N** — newest queries first (`TIME`, `MODEL`, `COST`, `TOKENS`, `INPUT / OUTPUT`, `KIND`). **Show last** is 100–10,000 (default 1,000), or **From** / **To** dates. **Group by conversation** (default off) folds the list into one row per local chat title. A red TOKENS cell has **Play**. Expand a row for list-price makeup. Toolbar: **Over Warn at**, **Optimized**, **Group by conversation**, **Export CSV**, **Model pricing**.
- **Statistics** — **Current burn rate**, Current/Today meters, **Coding stats** (`landed / AI = %` · if this branch landed · All on Cursor), **Monthly cost forecast**, Last N totals, spend by model and by kind, **model pricing** table (Active / Fast filters, Last N request counts, CursorBench scores).
- **Charts** — cumulative daily **tokens** and **cost** bars, **AI vs git** with the same Coding stats formulas, the same **Monthly cost forecast**, plus **Today / This month / All time** mix cards.
- **Optimize** — Quick / Balanced / Deep prompts for the last red query; projected save card from `.ai/optimize-savings.md`.
- **Support** — Buy Me a Coffee; **Write a message** to the author (Comment / feature / bug / other).
- **Settings** — **Language** (11 locales, including Ukrainian); status bar; **Critical alert**; **Burn Rate Guard**; **Generated lines** (Coding stats); forecast window; Optimize depth; Group by conversation; Show last / From / To; Auto-refresh.

If you are already signed in to Cursor, there is nothing to configure.

| Status bar | Guards | Forecast | Optimize | Coding stats |
|------------|--------|----------|----------|--------------|
| Pro `%` or team `$ / $` · Today · 1–10 recent (`!` on a spike) | Burn `$ / 10 min` · critical modal on huge queries | Used · forecast · ideal · run-out | Last red · local savings file | Landed / AI · All on Cursor |

---

## Screenshots

Captures from **1.0.4** / **1.0.5** (including model pricing and Support in `screenshots/dark/` on the landing page).

### 1. Statistics — high burn rate

When the live window is over your warning or critical dollar floor, Statistics shows a **High burn rate** banner plus the Status bar row: **Current burn rate** (`$ / 10 min`, optional `×` vs your pace), **Current** / **Today** Pro meters, and **Coding stats**. Does not stop Cursor.

<img src="screenshots/statistics_5.png" alt="Statistics: High burn rate banner 2.78 $ in 8 minutes, Current burn rate 2.78 $ / 10 min in red, Current 69% · 52%, Today 3.1% / 4.5%, Coding stats 25,361 / 61,161 = 41%" width="100%">

### 2. Statistics — Status bar row (normal)

The same four cards when burn is under the warning floor: **Current burn rate**, **Current**, **Today**, and **Coding stats** (`landed / AI = %` · if this branch landed · All on Cursor).

<img src="screenshots/statistics_4.png" alt="Statistics Status bar: Current burn rate 0.95 $ / 10 min, Current 68% · 52%, Today 1.9% / 4.5% · 1.4% / 4.5%, Coding stats 25,361 / 57,331 = 44%" width="100%">

### 3. Coding stats

Hero is **landed / AI = %** (your effectiveness) for this repo in the Last N / From–To window, plus the same **if this branch landed** on main, and window spend per 1k lines when both sides exist. **All on Cursor** is the dashboard Lines Edited total; **Projects** splits that total by local composer mix. Help `?` explains the formulas.

<img src="screenshots/statistics_3.png" alt="Coding stats card: 25,361 / 57,331 = 44% your effectiveness, 61% if this branch landed on main, All on Cursor 90,618, Projects (2)" width="100%">

### 4. Critical alert — blocking dialog on a huge query

When the newest query hits your critical token or dollar threshold, a modal shows tokens, cost, model, and time — **Open History** or **Cancel**. Independent of the status-bar `!`.

<img src="screenshots/critiacal_alert_2.png" alt="Critical alert: last query used 21.6M tokens and $12.57, exceeds 20.0M or $7.00, grok-4.6-high, Cancel and Open History" width="100%">

### 5. Status bar — always on while you code

**Team / Business (light)** — Current as used vs dollar pool, Today vs daily budget (red when over pace), Refresh, then recent queries as `cost - tokens`.

<img src="screenshots/status_bar.png" alt="Status bar: Current 30.66 $ / 250.00 $, Today over daily budget, five recent query chips" width="100%">

**Pro (dark)** — Current as mean included % vs 100% (`32% / 100%`), Today as mean today % / daily pace with today’s `$` (`3.5% / 4.5% (17.12 $)`), and a red `!` on a query at or above your token warning.

<img src="screenshots/status_bar_dark.png" alt="Dark status bar: Pro included percents, Today spend, token-spike warning on a 1.5M query" width="100%">

### 6. Monthly cost forecast — when money / limits run out

Bars and solid lines are cumulative used on one scale; dashed lines are the forecast; dotted ideal lines spread leftover budget to month end. Range: **Today** · **7 days** · **Month**.

**Team dollars (light)** — “Lasts the month”, daily pace, and month-end forecast if the working-day pace continues.

<img src="screenshots/monthly_cost.png" alt="Monthly cost forecast in dollars: used, forecast, ideal, daily pace, and month forecast card" width="100%">

**Pro included percent (dark)** — separate Cursor Models / Other Models series, run-out dates, and ideal leftover lines to month end.

<img src="screenshots/monthly_cost_dark.png" alt="Monthly cost forecast in percent: Cursor Models and Other Models with run-out dates Out 14.09 and Out 15.09" width="100%">

**7-day zoom (Team)** — same forecast control, focused on the next working days.

<img src="screenshots/statistics_2.png" alt="Monthly cost forecast zoomed to 7 days with working days, daily pace, and month forecast cards" width="100%">

### 7. Optimize — cut repeating expensive queries (local only)

When a query lights up red (**Warn at**, default 1M tokens), **Optimize** builds a ready prompt for that **last red query** — not a whole-repo audit, and the extension never reads the chat transcript.

Typical flow:

1. A query goes red on the status bar or in Last N.
2. **Run Optimize** (toolbar, default depth) pastes into a **new Agent chat** — or open this tab, expand a colored card, preview, and **Run** that depth.
3. You press **Start**. After the agent finishes, projected savings land in **`.ai/optimize-savings.md` inside this project only**.
4. The top card shows **Projected save per similar request** (`0 / 0.00 $` until the first run; then mid tokens / USD, e.g. `~1.6M · ~0.97 $`). Expand it for the explanation and credited totals per project.

Three depths: **Quick** (why the last turn burned + next-message tips), **Balanced** (pattern, plan, a small rules snippet), **Deep** (full playbook). **Set default** pins which card the toolbar Run uses. Findings name the last red query, how many spikes are in the sample, and the top cost model as context.

<img src="screenshots/optimize.png" alt="Optimize tab: projected save ~1.6M · ~0.97 $, findings for the last red query, Quick Balanced Deep depth cards with Run" width="100%">

### 8. Last N Cursor queries

Full table inside the editor: Show last / From–To, **Group by conversation** (default off), **Play** on a red row, **Export CSV**. Spike rows show `!` on **TOKENS**.

<img src="screenshots/alert_list.png" alt="Last 1000 Cursor queries table with cost, tokens, and spike warnings" width="100%">

<img src="screenshots/list.png" alt="Last N Cursor queries table" width="100%">

### 9. More Statistics cards

**Current / Today meters** (Pro included bars + today’s dollar sum):

<img src="screenshots/statistics_dark_1.png" alt="Statistics tab: Current included percents and Today spend cards" width="100%">

**Last N summary** — totals, average / median, cache hit, cost per 1M tokens, heaviest query, token mix:

<img src="screenshots/statistics_1.png" alt="Last 1000 summary cards: total, average, median, cache hit, token mix" width="100%">

<img src="screenshots/statistics_dark_2.png" alt="Dark Last N summary with queries over token warning and token mix bar" width="100%">

**Spend breakdown** — by model and by kind:

<img src="screenshots/statistics_dark_3.png" alt="Spend breakdown by model and by kind with share bars" width="100%">

### 10. Critical alert settings

<img src="screenshots/critiacal_alert_1_dark.png" alt="Settings: Critical alert thresholds for tokens and dollars" width="100%">

### 11. Burn Rate Guard

Live window of billed spend ending now (default 10 minutes) on Statistics (see screenshot 1 for the warning banner). Non-blocking toasts at **$2** / **$5**. Today chip turns warning-color when the window is high. Does not stop Cursor.

### 12. Coding stats

For the **active workspace**, in the same window as Last N / From–To: **landed / AI = %** (your git insertions on `main`/`master` ÷ AI composer lines for this repo), the same **if this branch landed**, **$ / 1k lines** when the window has both cost and lines, and **All on Cursor** (dashboard Lines Edited, split under **Projects**). Git lines default to the Cursor account email (pick extra identities with **`?`**). The same folder name in two clone paths counts as one project. Opening a parent stack with git submodules (e.g. `servers/<service>`) sums those repos into the stack. Charts uses the same formulas. Toggle: `cursorCost.codeLinesInsight`.

### 13. Language

Settings → **Language** switches the panel, status bar, and toasts immediately (English default; ten more locales including Simplified Chinese, Japanese, Spanish, Brazilian Portuguese, Russian, Korean, French, German, Ukrainian, and Polish). Ukrainian was added in [#10](https://github.com/Lukasz0303/cursor-cost-tracker/pull/10) by [@milichev](https://github.com/milichev).

<img src="screenshots/language.png" alt="Settings Language dropdown with eleven interface languages, English selected" width="100%">

### 14. Settings — status bar preview and content

Live sample of the bar (example spend, not your totals), Show status bar, Show Today, Minimal mode, and **1–10** recent requests on the bar.

<img src="screenshots/sample_bar.png" alt="Settings status bar sample preview with Current, Today, and recent query chips" width="100%">

<img src="screenshots/reqest_on_bar.png" alt="Settings content: Show Today, Minimal mode, recent requests on the bar 1–10" width="100%">

### 15. Model pricing (1.0.5)

On **Statistics**, a sortable table of Cursor model prices from the public docs page (cached six hours): input/output, Active or Hidden, Last N request counts, CursorBench score. Active only / Hide Fast filters. Toolbar **Model pricing** opens [cursor.com/docs/models-and-pricing](https://cursor.com/docs/models-and-pricing).

### 16. Support — Write a message (1.0.5)

Comment, New feature, Bug report, or Other. Nickname and email come from the Cursor account (editable). Expect a reply or send without one. Publish consent stays visible; Comment requires it. The mail app stays closed.

### 17. Play on a red query (1.0.6)

On the queries list, a red TOKENS cell (`!` at or over Warn at) has a play button beside the number. Play pastes a numbers-only brief for that conversation into a new Agent chat and does not press Start. The extension does not read the chat.

### 18. Group by conversation (1.0.6)

Queries toolbar switch, default off, also under Settings → Recent queries. On, the list folds into one collapsible row per local chat title (request count and totals). Chats that share a title merge. An id with no title shows `#` plus the first 8 characters. Requests without a conversation id land in **Ungrouped** and do not get a Play brief. **Over Warn at**, the spike `!`, and Play still apply. Play on a merged title uses the conversation that owns the dearest request. Export CSV stays a flat request list.

---

## Why Cursor Cost Tracker?

Cursor’s built-in dashboard shows aggregated totals on the website. While you code, you do not see how much of the monthly limit is used, how much of the daily budget is left, **when money or included quota runs out**, which recent query blew a token spike, or a **local** way to shrink the next similar expensive turn.

This extension keeps those numbers next to Git and Problems, adds a **monthly forecast**, **model pricing** and **Coding stats** on Statistics, **Support → Write a message**, and an **Optimize** tab whose savings file stays in the project (`.ai/optimize-savings.md`) — no chat transcript upload, no third-party analytics.

| Capability | Cursor Dashboard | Cursor Cost Tracker |
|------------|:----------------:|:-------------------:|
| **Status bar** | | |
| Current cycle spend on the bar | — | Yes |
| Today vs remaining daily budget on the bar | — | Yes |
| 1–10 recent queries on the bar | — | Yes |
| Green on pace · red on a spike (`!`, default 1M) | — | Yes |
| **Guards** | | |
| Burn Rate Guard (live $/window, banner, non-blocking toasts) | — | Yes |
| Blocking critical alert (default 10M tokens or $5) | — | Yes |
| Neither guard stops Cursor | — | Yes |
| Ignore a spike `!` and keep it dismissed after reload | — | Planned |
| **Monthly forecast** | | |
| Used / forecast / ideal on one chart | — | Yes |
| Run-out date (Team $ or Pro included limits) | — | Yes |
| Pace by working days or all calendar days | — | Yes |
| Forecast follows a monthly billing cycle when Cursor reports one | — | Yes |
| Today / 7 days / Month range on the chart | — | Yes |
| **Optimize** | | |
| Ready prompt for the last red (Warn at) query | — | Yes |
| Play on one red query (numbers only, new Agent chat) | — | Yes |
| Quick / Balanced / Deep depths | — | Yes |
| Projected save in local `.ai/optimize-savings.md` | — | Yes |
| Never reads the chat transcript | — | Yes |
| **Coding stats** | | |
| Landed / AI = % effectiveness | — | Yes |
| Window spend per 1k landed lines and per 1k AI lines | — | Yes |
| If this branch landed on main / master | — | Yes |
| All on Cursor · split by project | — | Yes |
| AI lines vs merged on Charts | — | Yes |
| **Panel · queries · charts** | | |
| Last N queries in the editor (100–10,000 or From–To) | — | Yes |
| Group the list by local chat title (default off; CSV stays flat) | — | Yes |
| List-price makeup on a query, beside billed cost | — | Yes |
| Per-query cost, tokens, model, kind | Website | Yes |
| Statistics (totals, averages, spike count) | Website | Yes |
| Spend by model and by kind | Website | Yes |
| Charts (tokens / cost over time; click a day; Sample / Last 7 / Month) | — | Yes |
| Today / This month / All time mix cards | Website | Yes |
| Model pricing (docs + Last N counts + CursorBench) | Website | Yes |
| Export recent queries as CSV | — | Yes |
| Support → Write a message to the author | — | Yes |
| **Setup · language** | | |
| UI language (11 locales) | — | Yes |
| Zero setup (local Cursor session) | — | Yes |
| No token pasted into Settings | — | Yes |

Not in scope: payments, hosted team dashboards, other IDEs, estimating cost *before* you send a prompt, reading chat transcripts, or auto-rewriting your codebase. **Optimize** only builds metadata prompts you paste yourself; savings numbers come from the agent writing a **local** project file.

---

## Features

### Real-time status bar (primary)

Always-on **Current** (Pro: mean included % vs 100% such as `32% / 100%`; Team: used vs dollar cap), **Today** (Pro: mean today % / daily pace with today’s `$`, e.g. `3.5% / 4.5% (17.12 $)`; Team: spend vs daily budget, or `—` when there is no cap), and **1–10 newest queries** (`cost - tokens`, default 3). Click Current or Today for **Statistics** (forecast). Click a query chip for the Last N list. A query at or above your token warning (default **1,000,000**, configurable) shows `!` in red. **Unlimited** plans show the cycle total and hide Today. Refresh stays on the bar. Export CSV does not.

Colors: **Team** is **green** within the dollar pool and **red** at or over the cap (or when Today is over the daily budget). **Pro** Current/Today stay green. Recent queries go **red** on a token spike. Defaults are darker on a light theme so they stay readable.

### Monthly cost forecast (primary)

Answer two questions without opening cursor.com:

- **How much will this month cost** if the current working-day pace continues?
- **When does included quota or Team money run out**, or will the dollar pool last the month?

**Team / Business / Enterprise** — dollars: cumulative Spend bars + line on one scale, dashed forecast, dotted ideal leftover, working days so far, daily pace, and month forecast. **Pro** — included percent for Cursor Models and Other Models, run-out dates, and the same used / forecast / ideal chart. Range toggle: **Today** · **7 days** · **Month** (default Month). Same control on **Statistics** and **Charts**.

**Window:** calendar month by default. **Billing cycle** follows Cursor’s monthly cycle when the usage summary has a valid 26–35 day window (`cursorCost.forecastWindow`). A renewal inside the calendar month is marked and the series drops there. Status bar and Today stay on the calendar month. ([#11](https://github.com/Lukasz0303/cursor-cost-tracker/pull/11) by [@milichev](https://github.com/milichev))

### Optimize (primary)

Third product goal: shrink **repeating expensive turns** in this project.

- Targets the **last red query** (tokens ≥ **Warn at** in Settings), not just the newest cheap request. **Play** on a red TOKENS cell pastes a numbers-only brief for that conversation into a **new** Agent chat and does not press Start. Findings also show how many spikes are in the sample and the top cost model (context only).
- Three depths: **Quick** (short — why the last turn burned, three next-message tips) / **Balanced** (default — pattern, plan, small rules snippet) / **Deep** (full playbook). Prompts come from usage metadata only (model, tokens, cost). No chat transcript is read by the extension. **Set default** on a card; toolbar **Run Optimize** always pastes that depth.
- **Run** opens a **new Agent chat** and pastes the prompt; you press Start. Play on a red row does the same.
- After Start, the agent writes projected savings to **`.ai/optimize-savings.md`** in the workspace (including **project** name + mid tokens/USD). The panel shows those numbers as **Projected save per similar request** (`0 / 0.00 $` until the first run). Expand the card for the explanation and credited totals per project (extension `globalState`). Projection file stays **local to the project**; lifetime ledger is global across workspaces.

### Last N Cursor queries

Click a **recent-query chip** (or Command Palette **Show Usage History**) to open the queries table. Click **Current** or **Today** to open the same panel on **Statistics**. Newest first. **Show last** (100–10,000, default 1,000) sits above the table — type the full number, then **Apply**. **From** a local calendar day (Start of month, or a date like 1.09.2026) through optional **To** loads that range instead (cap 10,000). Empty To means through today. **Group by conversation** (default off) folds rows by the local chat title; shared titles merge, and requests with no id land in **Ungrouped**. Expand a row for catalog list price beside billed cost. **Play** sits on a red TOKENS cell. **Optimized** filters rows already sent to Optimize. Columns:

`TIME` · `MODEL` · `COST` · `TOKENS` · `INPUT / OUTPUT` · `KIND`

Six tabs: **Last N** · **Statistics** · **Charts** · **Optimize** · **Support** · **Settings**. **Export CSV** on the table toolbar (not on the status bar). **Open Dashboard** on Statistics. **Model pricing** on the Last N toolbar. No intermediate menu.

### Statistics

Sample totals (not the Current pool): total spend, average and median per query, cache hit, cost per 1M tokens, token mix, cache $ saved vs input list price, **Queries over token warning**. **Current burn rate** when Burn Rate Guard is on (banner when warning/critical). **Coding stats** (`landed / AI = %`, plus $ per 1k lines when the window has both). **Monthly cost forecast** (see above). Spend breakdown **by model** and **by kind** with share bars. **Model pricing** — latest Cursor prices (public docs), Active / Hidden, sample request counts, CursorBench scores; Active only / Hide Fast filters.

### Charts

- **Tokens over time** and **Cost over time** — one cumulative bar per local calendar day from the loaded sample (oldest → newest). Height is the running total up to that day. Hover shows that day’s amount plus the total so far. Click a bar for that day’s totals and an expandable query list from the same sample. **Sample / Last 7 / Month** zooms those bars without another request to Cursor.
- **AI vs git** — same formulas as Coding stats (`landed / AI = %` and if this branch landed), plus bars for this branch and All on Cursor on one scale.
- **Monthly cost forecast** — same control as Statistics: cycle meters, Today / 7 days / Month range, cumulative bars + used line on one scale, dashed forecast, and dotted leftover-budget lines.
- **Today / This month / All time** cards — API-equivalent cost, messages, cache hit, input / output / cache write / cache read, and a mix bar. Figures come from the Last N loaded queries, not the full Cursor website dashboard.

Opening the tab does not scan git until you ask.

### Token-spike warning

A `!` on that recent-query chip and on the matching **TOKENS** cell when a query is at or above your token threshold (default **1,000,000**). Settings: **Warn at** in **k**, plus Show warnings. Dismissing a spike so the bang stays gone after reload is still **Planned** (persist via `globalState`; table **Ignore** not wired yet).

### Critical last-query alert

A **blocking dialog** when the newest query reaches **10,000,000 tokens** or **$5** (either is enough). Each query is shown once. **Ignore** next to Open History dismisses that query explicitly. A last query older than five minutes is not shown on first load after a restart. Independent of the status-bar `!`. Settings tab: **Critical alert**. Turn off with `cursorCost.showCriticalAlert`.

### Burn Rate Guard

How fast you are spending, not only how much. The extension sums billed cost in a **live window ending now** (default **10 minutes**) and shows **Current burn rate** on Statistics (`3.42 $ / 10 min`, optional `×` vs your recent pace, Today total, meter vs critical $). A **banner** appears when the window is warning or critical.

A **non-blocking** warning toast at **$2** in the window (default) and a **non-blocking** error toast at **$5**. Once per burst, Snooze 30 minutes, first-load grace of five minutes. This does **not** stop Cursor; the critical toast can offer **Focus Composer** so you can hit Stop in Cursor. A single expensive query still uses the last-query critical alert (`minQueries` default 2). Included Pro events at $0 still show token throughput on the card. Today on the status bar uses the warning color when the window is high and Show warnings is on. Settings tab: **Burn Rate Guard**. Turn off with `cursorCost.burnRateGuard`.

### Coding stats

How many lines Cursor applied in this workspace vs what already landed on **`main`/`master`**, in the same window as Last N / From–To. When that window has both cost and line totals, the card also shows spend **per 1k landed lines** and **per 1k AI lines**.

- **Your effectiveness** — `landed / AI = %` (your git insertions on the default branch ÷ AI composer lines for this repo). Defaults to the Cursor account email; **`?`** on the card picks which git identities to sum.
- **If this branch landed** — `(landed + this branch) / AI`.
- **All on Cursor** — Cursor dashboard Lines Edited for the account; **Projects** splits that total by local composer mix. Clones that share a folder name are one project. A parent folder with two or more nested git checkouts or submodules (`.gitmodules`, including `servers/<service>`) is one stack.

AI totals come from local composer headers, not the usage API. Not line-level blame, and not `AI − pending`. Settings: **Generated lines**. Toggle: `cursorCost.codeLinesInsight`.

### Language

Settings → **Language** (`cursorCost.language`) switches the Last N panel, status bar, and toasts. **English** is the default. Also: Polish, Simplified Chinese, French, German, Japanese, Korean, Portuguese (Brazil), Russian, Spanish, and Ukrainian. Ukrainian is the 11th locale ([#10](https://github.com/Lukasz0303/cursor-cost-tracker/pull/10) by [@milichev](https://github.com/milichev)). Independent of the VS Code / Cursor display language.

### Support message

On the **Support** tab, **Write a message** sends Comment / New feature / Bug report / Other to the author without opening a mail app. Nickname defaults to the Cursor mailbox local-part; email is the Cursor account address (editable while a reply is expected). Publish consent stays on every topic; Comment requires it. Accepted comments may appear in a later release. Buy Me a Coffee stays on the same tab.

### Zero setup

The extension reads the local Cursor session from `state.vscdb` — the same login Cursor already uses. No API key, no cookie to copy from the browser, no `.env`.

### Auto refresh

Polling every 1 minute by default (configurable). Manual **Refresh** on the status bar after a long agent run. Startup never blocks the editor on the network.

### Local and private

The session token stays in the extension host. It is never sent to the history panel, never written to logs, and never stored in Settings. Usage requests go to Cursor’s usage APIs. Model pricing loads the public docs page. Support messages go to the author inbox (FormSubmit) without the session token. No analytics SDK.

---

## Requirements

- [Cursor](https://cursor.com) signed in on this machine
- Local session database (`state.vscdb`) — the login Cursor already uses

| OS | Session file |
|----|----------------|
| Windows | `%APPDATA%\Cursor\User\globalStorage\state.vscdb` |
| macOS | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` |
| Linux | `~/.config/Cursor/User/globalStorage/state.vscdb` |

VS Code can install the VSIX, but numbers appear only if Cursor is installed and you are logged in (the extension reads Cursor’s user data, not VS Code’s).

Remote SSH / cloud workspaces: the session file lives on the **local** UI machine. If the extension host cannot read it, the status bar shows an error instead of numbers.

---

## Install

Cursor installs third-party extensions from **[Open VSX](https://open-vsx.org/extension/lukasz0303/cursor-cost-tracker)** (then Cursor’s marketplace proxy). Prefer that listing when it is available in **Cursor → Extensions**.

Local VSIX:

1. Build: `npm run package`
2. In Cursor: **Extensions** → `…` → **Install from VSIX…**
3. Reload the window

Or from a terminal:

```bash
cursor --install-extension cursor-cost-tracker-1.0.6.vsix
```

Search **Cursor Cost Tracker** in **Cursor → Extensions**, or open the [Open VSX page](https://open-vsx.org/extension/lukasz0303/cursor-cost-tracker).

---

## Status bar

Right side of the bar.

```
… │  3.79 $ / 250.00 $  │  Today 3.79 $ / 11.19 $  │  ↻  │  0.03 $ - 64.8k  │  0.10 $ - 237.0k  │  ! 1.20 $ - 1.2M  │
```

| Item | Shows | Click |
|------|--------|-------|
| **Current** | Team: used vs dollar cap. Pro: mean included % / 100% (`Unlimited` when the plan has no cap) | Opens **Statistics** |
| **Today** | Team: spend vs daily budget. Pro: mean today % / daily pace (`3.5% / 4.5%`) plus today’s `$` in parentheses | Opens **Statistics** |
| **Today** | Spend vs daily budget (hidden on unlimited plans) | Opens **Statistics** |
| **Refresh** | Sync icon (spins while fetching) | Pulls latest usage from cursor.com — no panel |
| **Recent queries (1–10)** | `cost - compact tokens` for the newest queries | Opens the **Last N** list |

A `!` prefixes a recent query (and the table **TOKENS** cell) when that query is at or above the token threshold (default 1,000,000). Export CSV is on the Last N toolbar, not here.

---

## History panel

The **Settings** tab is a full editor for every `cursorCost.*` key. Status-bar preview, content, warnings, and colors are grouped into separate cards. **Show last** is 100–10,000 (default 1,000). **From date** and optional **To date** load that local range (empty To means through today). **Group by conversation** is off until you turn it on. **Forecast window** is calendar month or billing cycle. **Auto-refresh** is 1–60 minutes.

| TIME | MODEL | COST | TOKENS | INPUT / OUTPUT | KIND |
|------|-------|------|--------|----------------|------|
| `1.09.2026, 10:05:12` | default | 0.03 $ | 64,755 | 12,856 / 168 | Included In Business |

| Action | How |
|--------|-----|
| Open | Current / Today → Statistics; a recent-query chip or Command Palette → Last N |
| Close | Panel **X** |
| Refresh | Status-bar sync, Last N **Refresh**, or **Cursor Cost: Refresh** |
| Export CSV | Last N **Export CSV**, or **Cursor Cost: Export recent queries CSV** |
| Model pricing page | Last N toolbar **Model pricing**, or **Cursor Cost: Open model pricing** |

---

## Commands

| Command | What it does |
|---------|----------------|
| `Cursor Cost: Show Usage History` | Opens the recent-queries panel |
| `Cursor Cost: Refresh` | Fetches latest usage |
| `Cursor Cost: Open Dashboard` | Opens cursor.com/dashboard |
| `Cursor Cost: Open model pricing` | Opens the official Cursor models and pricing page |
| `Cursor Cost: Export recent queries CSV` | Save-as dialog for the recent-queries table |

---

## Configuration

| Setting | Default | Notes |
|---------|---------|--------|
| `cursorCost.pollIntervalMinutes` | `1` | Auto-refresh interval. Settings tab: **Auto-refresh** |
| `cursorCost.showStatusBar` | `true` | Hide the bar if you only want the command. Settings: status bar editor |
| `cursorCost.showToday` | `true` | Hide the Today item. Settings: status bar editor |
| `cursorCost.minimalMode` | `false` | Status bar shows only Current (+ Refresh). Settings: status bar editor |
| `cursorCost.recentQueryCount` | `3` | Number of recent request chips on the status bar (1–10) |
| `cursorCost.spikeTokenThreshold` | `1000000` | Minimum `1000`. Settings tab edits this in **k** (100 = 100k tokens) |
| `cursorCost.showSpikeWarning` | `true` | Off = no `!` and no green/red colors |
| `cursorCost.showCriticalAlert` | `true` | Blocking dialog when the newest query hits the critical token or dollar threshold |
| `cursorCost.criticalTokenThreshold` | `10000000` | Minimum `1000`. Settings tab in **k** (10000 = 10M tokens) |
| `cursorCost.criticalCostUsdThreshold` | `5` | Minimum `$0.01`. Either this or the token threshold is enough |
| `cursorCost.burnRateGuard` | `true` | Live window on Statistics; non-blocking toasts; Today tint when high |
| `cursorCost.burnRateWindowMinutes` | `10` | 2–60 minutes. Right edge is now |
| `cursorCost.burnRateWarningUsd` | `2` | Non-blocking warning toast |
| `cursorCost.burnRateCriticalUsd` | `5` | Non-blocking error toast; never below warning; does not stop Cursor |
| `cursorCost.burnRateMinQueries` | `2` | 1–50. A single query stays the last-query critical alert |
| `cursorCost.burnRateWarningToast` | `true` | Off = remember the episode without a toast |
| `cursorCost.burnRateCriticalToast` | `true` | Off = remember the episode without a toast |
| `cursorCost.codeLinesInsight` | `true` | Coding stats on Statistics and Charts (AI vs git · All on Cursor) |
| `cursorCost.groupQueriesByConversation` | `false` | Fold the queries list into one collapsible row per local chat title. Shared titles merge. No conversation id → **Ungrouped**. Export CSV stays flat |
| `cursorCost.language` | `en` | Panel, status bar, and toasts. Independent of the VS Code / Cursor display language |
| `cursorCost.historyLimit` | `1000` | Newest queries to load (100–10,000). Settings tab: **Show last**. Ignored when From date is set |
| `cursorCost.historyFromDate` | (empty) | Local `YYYY-MM-DD`; load from that day. Empty uses Show last |
| `cursorCost.historyToDate` | (empty) | Local `YYYY-MM-DD` end of that sample. Empty means through today. Requires From date |
| `cursorCost.budgetDayBasis` | `workingDays` | Pace Today / MTD / forecast by working days (Mon–Fri) or all calendar days |
| `cursorCost.forecastWindow` | `calendarMonth` | `calendarMonth` or `billingCycle` for the monthly forecast only. Billing cycle needs a valid 26–35 day usage-summary window ([#11](https://github.com/Lukasz0303/cursor-cost-tracker/pull/11) by [@milichev](https://github.com/milichev)) |
| `cursorCost.optimizeDepth` | `balanced` | Optimize prompt: Quick / Balanced / Deep |
| `cursorCost.okColor` | `#89D185` | Good-state color (darker green on light themes) |
| `cursorCost.warnColor` | `#F14C4C` | Warning color (darker red on light themes) |

---

## FAQ

**How is this different from Cursor’s usage page?**  
Cursor’s dashboard shows aggregated totals in the browser. This extension puts **Current**, **Today**, and **1–10 recent queries** on the status bar, and a **Monthly cost forecast** (used / forecast / ideal / run-out) so you can see how much you can still spend this month. Current/Today open Statistics; query chips open Last N (100–10,000) with Charts, period mix cards, and CSV export.

**Can it predict my month-end bill?**  
It forecasts from your **working-day pace so far** (Team dollars or Pro included percent), on the calendar month or on a valid billing cycle. It is a pace projection, not an invoice — Cursor’s bill can still differ.

**Do I need to paste a session token?**  
No. If Cursor is signed in on this machine, the extension reads the local session. There is no token field in Settings.

**Does it work on the Free plan?**  
Yes, as long as you are signed in to Cursor on this machine. Unlimited plans hide Today and show the cycle total as Unlimited.

**What is the token-spike `!`?**  
A `!` on that recent-query chip (and on the table **TOKENS** cell) when a single query is at or above your threshold (default 1 million tokens). It is a notice, not advice on how to cut the conversation.

**What is the critical alert?**  
A blocking dialog when the **newest** query reaches 10 million tokens or $5 (configurable). It is shown once per query. **Ignore** dismisses that query; Open History opens Last N. A last query older than five minutes is not shown on first load after a restart.

**Is my token safe?**  
The access token never leaves the extension host. It is not sent to the webview, not written to logs, and not stored in Settings. No data is sent to third-party servers.

**Can I use this in VS Code without Cursor?**  
You can install the VSIX, but usage data requires Cursor’s local session. Without it the bar shows a sign-in message instead of numbers.

**Are the numbers an invoice?**  
No. This tool uses unofficial Cursor usage APIs and a local session file. Cursor may change either without notice. Treat the overlay as a convenience, not a billing statement.

---

## Troubleshooting

| Symptom | What to do |
|---------|------------|
| `N/A` / Sign in | Sign in to Cursor on this machine, then Refresh |
| No numbers after install | Reload the window; confirm Cursor (not only VS Code) is installed |
| Today missing | Unlimited plan, or the events request failed — Current can still show |
| Empty history table | Use Cursor AI at least once, then Refresh |
| Remote SSH / cloud | Session file is on the local UI machine; the bar shows an error if the host cannot read it |
| Stale numbers after a long agent run | Click Refresh |

This project aims to follow Cursor plan and API changes quickly. Display or totals may drift when Cursor changes the usage endpoints. Reports with a masked response sample, plan type, and time of occurrence help land a fix faster — open an [Issue](https://github.com/Lukasz0303/cursor-cost-tracker/issues).

---

## Privacy

- Session token: extension host only. Never in the webview, logs, or Settings.
- Network: Cursor usage APIs; public model-pricing docs; optional Support message via FormSubmit (no session token). Git history stays on your machine.
- Storage: local Cursor session plus extension `globalState` (e.g. Optimize credits). No cloud database.
- No analytics SDK.

This is **not** an official Cursor product.

---

## Contributors

- [Vadym Milichev (@milichev)](https://github.com/milichev) — [Ukrainian](https://github.com/Lukasz0303/cursor-cost-tracker/pull/10), [billing-cycle forecast](https://github.com/Lukasz0303/cursor-cost-tracker/pull/11) (chart reset styling and the model-catalog chart race), [Ignore-store type fix](https://github.com/Lukasz0303/cursor-cost-tracker/pull/9)

## License

[MIT](LICENSE) — Copyright (c) 2026 Łukasz Zileiński.

Anyone may use, copy, modify, merge, publish, and sell the software, provided they keep the copyright notice and the MIT text. There is **no warranty**. You are not liable if it breaks, shows a wrong dollar amount, or Cursor’s API changes.

MIT is a permission, not a transfer of ownership. It does **not** grant Cursor’s trademarks. Do not imply this is official Cursor software. Unofficial API use is not “approved” by Cursor; the disclaimer in this README still applies.

---

## Publishing

Cursor installs third-party extensions from **[Open VSX](https://open-vsx.org/)**, then its own marketplace proxy (malware scan + sync, often a few hours). Microsoft Marketplace is optional and does not help Cursor users.

```bash
npm run build
npx @vscode/vsce package --no-dependencies
npx ovsx publish cursor-cost-tracker-1.0.6.vsix -p %OVSX_PAT%
```

`engines.vscode` must be **≤** the VS Code version in Cursor **Help → About**, or Cursor hides the extension in search. Keep `LICENSE`, **`icon.png`**, and **`CHANGELOG.md`** inside the VSIX (Changelog tab on Open VSX / Cursor Extensions). Marketplace listing uses `"icon": "icon.png"` (PNG, at least 128×128).

Private / team only: skip stores, ship the VSIX, **Install from VSIX**.

---

## Support

Cursor Cost Tracker is free and open source (**MIT**). If it helped you catch an expensive query before it ate the budget — or if the monthly forecast paid for itself — you can buy me a coffee. Tips keep the tracker in step with Cursor’s usage APIs and fund the next forecast / Optimize fix. No paywall, no extra features behind a tip.

In the extension **Support** tab you can also **Write a message** (Comment, New feature, Bug report, Other) without opening a mail app.

<p align="center">
  <a href="https://buymeacoffee.com/lzzzielinsn">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50">
  </a>
</p>

[buymeacoffee.com/lzzzielinsn](https://buymeacoffee.com/lzzzielinsn)

---

## Changelog

Full notes: [CHANGELOG.md](CHANGELOG.md). That file is the **Changelog** tab on Open VSX and in Cursor → Extensions.

---

## Contributing

Contributions welcome.

1. Fork
2. `git checkout -b feature/your-change`
3. Open a pull request

Product requirements: [`.ai/context/prd.md`](.ai/context/prd.md).

**Webview:** edit sources under [`media/src/`](media/src/) (entry `media/src/main.js`). Run `npm run build` to regenerate `media/history.js`. Do not hand-edit the generated bundle. Calendar days use the IDE local timezone (`src/time/`).
