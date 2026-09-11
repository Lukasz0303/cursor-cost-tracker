# Facebook — Cursor Cost Tracker (EN)

Copy-paste launch post. Facebook **does not render Markdown** — use the fenced blocks as the caption. Attach screenshots as an **album** in the order below. The first image is the cover.

**Links (end of post):**

- Open VSX: https://open-vsx.org/extension/lukasz0303/cursor-cost-tracker
- GitHub: https://github.com/Lukasz0303/cursor-cost-tracker
- Buy Me a Coffee: https://buymeacoffee.com/lzzzielinsn

---

## Album order

| # | File | Pillar | Optional photo caption |
|---|------|--------|------------------------|
| 1 | `screenshots/status_bar.png` | 1 | Current, Today, and recent queries — always on the IDE status bar |
| 2 | `screenshots/status_bar_dark.png` | 1 | Pro: included %, Today vs pace, red `!` on a token spike |
| 3 | `screenshots/monthly_cost.png` | 2 | Monthly forecast: used, pace, ideal leftover |
| 4 | `screenshots/monthly_cost_dark.png` | 2 | Pro: Cursor Models / Other Models and run-out dates |
| 5 | `screenshots/critiacal_alert_2.png` | 2 | Hard alarm: newest query ≥ 10M tokens or $5 |
| 6 | `screenshots/optimize.png` | 3 | Optimize: ~1.6M · ~0.97 $ on a similar request, Findings, Quick / Balanced / Deep |
| 7 | `screenshots/alert_list.png` | extra | Last N: time, model, cost, tokens, kind — inside the editor |
| 8 | `screenshots/statistics_1.png` | extra | Statistics: total, average, median, cache hit, token mix |

Preview in this file (same order as the album):

### Pillar 1 — no numbers in the IDE

![Status bar Team](../screenshots/status_bar.png)

![Status bar Pro, dark](../screenshots/status_bar_dark.png)

### Pillar 2 — forecast and hard alarm

![Monthly cost forecast Team](../screenshots/monthly_cost.png)

![Monthly cost forecast Pro](../screenshots/monthly_cost_dark.png)

![Critical alert](../screenshots/critiacal_alert_2.png)

### Pillar 3 — Optimize in the project

A red query (≥ Warn at) → **Run Optimize** pastes into the last Agent chat (or expand Quick / Balanced / Deep and Run). After Start, savings land in `.ai/optimize-savings.md`. Top card: **Projected save per similar request** (here ~1.6M · ~0.97 $). Findings: last red query, spike count in the sample, top cost model.

![Optimize](../screenshots/optimize.png)

### Everyday panel

![Last N spikes](../screenshots/alert_list.png)

![Statistics summary](../screenshots/statistics_1.png)

Shorter album: **1, 3, 5, 6**.

---

## Short caption (groups)

```
You code in Cursor. Tokens fly. You see the bill on the website — too late to stop the agent.

Cursor Cost Tracker is a free Cursor (and VS Code) extension. Three things the website dashboard does not give you while you work:

1. Cost on the status bar. Current, Today, and recent queries (cost + tokens). A red bang when one query crosses your threshold — 1M tokens by default.

2. Monthly forecast + a hard alarm. Chart: used, pace, ideal leftover, run-out date. If the newest query hits 10M tokens or $5, a blocking dialog.

3. Optimize. After a red query (e.g. 2M tokens) the extension builds a Quick / Balanced / Deep prompt, pastes it into the last Agent chat, and lets you check what in the project is burning tokens. The top card shows the projected save on a similar request (e.g. ~1.6M tokens · ~0.97 $). .ai/optimize-savings.md stays local — no transcript upload.

Zero setup: signed in to Cursor, the bar appears. MIT.

Open VSX: https://open-vsx.org/extension/lukasz0303/cursor-cost-tracker
GitHub: https://github.com/Lukasz0303/cursor-cost-tracker

The extension is free. If it saved you tokens, you can buy me a coffee:
https://buymeacoffee.com/lzzzielinsn

#Cursor #VSCode #AI #OpenSource
```

---

## Full post (page / profile)

First line is the feed hook — do not lead with the product name.

```
You code in Cursor. The agent does its thing. Tokens fly.

You find out what it cost when you open the website dashboard. Too late to stop the run. Too late to see which query ate a million tokens. Too late to know whether the limit lasts the month.

Cursor Cost Tracker is a free extension for Cursor (and VS Code when Cursor is on the same machine). It is not an invoice. It is what the IDE was missing: numbers next to Git and Problems, a forecast, a hard alarm, and a way to make the next similar run cheaper.

Three pillars.

—— 1. The cost blind spot ——

Cursor bills chat, agent, and inline edits in dollars and tokens. Official usage lives on the account site. In the editor, while you work, you see nothing.

On the status bar: Current, Today, and 1–10 recent queries (default 3), as cost + tokens.

Team / Business: Current is the dollar pool (e.g. 30.66 $ / 250.00 $). Today vs the daily budget — red when you are over pace.
Pro: Current is mean included vs 100% (e.g. 32% / 100%). Today is today’s % vs even daily pace, with today’s $ in parentheses.

Click Current or Today → Statistics. Click a query chip → Last N table. Refresh on the bar only syncs.

A red ! on a query at or above your threshold (default 1,000,000 tokens). Green / red from Settings. You can turn colors off.

Zero setup: the extension reads the local Cursor session (state.vscdb). No API key, no cookie paste, no .env. The session token never leaves the extension host — not the panel, not logs, not Settings.

—— 2. Forecast + hard alarm ——

Statistics and Charts share the same Monthly cost forecast.

Bars and a solid line: cumulative used. Dashed line: forecast if the working-day pace holds. Dotted line: ideal leftover to month end. Range: Today / 7 days / Month.

Team: dollars. Pro: included percent for Cursor Models and Other Models, with a run-out date or “lasts the month”.

Pace by working days (Mon–Fri, default) or all calendar days.

When the newest query hits 10,000,000 tokens or $5 (Settings) — a blocking dialog. Independent of the status-bar bang. Once per query. A restart does not replay a historical alert from several minutes ago, so Monday morning is not blocked.

That is a hard brake. The website dashboard does not have one.

—— 3. Automatic check of what to fix ——

An expensive spike is a signal, not a sentence. The Optimize tab does not scan the whole repo behind your back and does not read the chat transcript.

It takes the last red query (≥ Warn at) — e.g. grok-4.6-high, 2M tokens. Findings also show how many spikes are in the Last N sample and which model burns the most (context only).

Three depths: Quick (why the last turn burned + three next-message tips), Balanced (pattern, plan, a small rules snippet), Deep (full playbook). Set default pins which card the toolbar Run Optimize pastes.

Run pastes the prompt into the last active Agent chat. You press Start. The agent inspects the project — rules, oversized context, extra loops — and writes a projected save to .ai/optimize-savings.md in this workspace.

The top card is Projected save per similar request. Until the first run: 0 / 0.00 $. Then mid tokens and USD from the agent (e.g. ~1.6M · ~0.97 $). Expand for the explanation and per-project totals.

Nothing leaves the machine beyond what you already send to Cursor when you press Start.

—— Everyday extras ——

Last N — 100 to 10,000 queries (default 1,000), or from a chosen date (e.g. the 1st). Columns: TIME, MODEL, COST, TOKENS, INPUT / OUTPUT, KIND. Over Warn at filter. Export CSV.

Statistics — Current / Today, cycle meters, Last N: total, average, median, cache hit, cost per 1M tokens, input/output/cache mix, spend by model and by kind.

Charts — tokens and cost over time (cumulative bars + line, one scale) plus the same monthly forecast and Today / This month / All time cards.

Settings — everything in the panel: bar preview, Show Today, Minimal mode, 1–10 chips, Warn at, Critical alert, budget pace, Optimize depth, Show last / From date, auto-refresh 1–60 min, colors.

Auto-refresh every minute (configurable). Startup never blocks the editor on the network.

MIT. Unofficial Cursor usage APIs — an overlay, not a bill. Windows, macOS, Linux.

Search “Cursor Cost Tracker” in Cursor → Extensions (Open VSX), or install from VSIX.

https://open-vsx.org/extension/lukasz0303/cursor-cost-tracker
https://github.com/Lukasz0303/cursor-cost-tracker

If it caught an expensive run before it ate the budget, you can buy me a coffee. No paywall. No features behind a tip. MIT stays MIT.

https://buymeacoffee.com/lzzzielinsn

#Cursor #VSCode #AI #OpenSource
```

---

## Comment replies

**Where do I install it?**
```
Cursor → Extensions → search “Cursor Cost Tracker” (Open VSX). Or Install from VSIX. The Microsoft Marketplace is optional — Cursor pulls third-party extensions from Open VSX.
```

**Is this official Cursor?**
```
No. MIT, unofficial usage APIs. Numbers are an overlay, not an invoice. The session token stays in the extension host.
```

**Pro and Team?**
```
Yes. Pro: included percent (Cursor Models / Other Models). Team / Business: dollar pool and daily budget. Unlimited hides Today.
```

**Does it upload the chat transcript?**
```
No. Optimize builds a prompt from usage metadata (model, tokens, cost). You paste and press Start. Projected savings are written locally to .ai/optimize-savings.md.
```

**Price?**
```
The extension is free (MIT). If it helps your day-to-day, you can buy me a coffee — no paywall:
https://buymeacoffee.com/lzzzielinsn
```
