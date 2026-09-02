<div align="center">

<img src="./icon.png" alt="Cursor Cost Tracker" width="192">

# Cursor Cost Tracker

</div>

<p align="center">
  <strong>See Cursor AI spend without leaving the editor.</strong>
</p>

<p align="center">
  Current, Today, and the last 3 queries on the status bar.
  One click opens Last 1000 queries (100–10,000), Statistics, Charts, and Settings.
  No extra app. No pasted token. No data sent anywhere except Cursor’s own usage APIs.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/version-0.7.5-blue.svg" alt="Version 0.7.5">
  <img src="https://img.shields.io/badge/Contributions-welcome-brightgreen.svg" alt="Contributions welcome">
</p>

---

**Cursor Cost Tracker** is a VS Code / Cursor extension that puts your billing-cycle cost, today’s budget, and the last 3 queries on the status bar. Click a number to open **Last N Cursor queries** (default **1,000**, range 100–10,000) with tabs for the table, **Statistics**, **Charts**, and **Settings**.

If you are already signed in to Cursor, there is nothing to configure.

| Status bar | History |
|------------|----------|
| `3.79 $ / 250.00 $` (team) or `7%` (Pro) · `Today` · last 3 queries (`0.03 $ - 64.8k`) | Last N · Statistics · Charts · Settings |

---

## Why Cursor Cost Tracker?

Cursor’s built-in dashboard shows aggregated totals on the website. While you code, you do not see how much of the monthly limit is used, how much of the daily budget is left, or which recent query was expensive.

This extension keeps those numbers next to Git and Problems — the same place you already look.

| Capability | Cursor Dashboard | Cursor Cost Tracker |
|------------|:----------------:|:-------------------:|
| Current cycle spend on the status bar | — | Yes |
| Today vs remaining daily budget | — | Yes |
| Last N queries inside the editor (default 1,000) | — | Yes |
| Per-query cost, tokens, model, kind | Website only | Yes |
| Statistics, charts, and period mix cards | Website | Yes |
| Last 3 queries on the status bar | — | Yes |
| Token-spike warning (`!`, default 1M) | — | Yes |
| Export recent queries as CSV | — | Yes |
| Ignore a spike and keep it dismissed | — | Planned |
| Zero setup (local Cursor session) | — | Yes |
| No token pasted into Settings | — | Yes |

Not in scope: payments, team dashboards, other IDEs, estimating cost *before* you send a prompt, or rewriting your code to “save tokens.”

---

## Features

### Real-time status bar

Always-on **Current** (used vs plan limit), **Today** (spend vs a daily budget derived from remaining cycle allowance and working days left), and the **3 newest queries** (`cost - tokens`). A query at or above **1,000,000** tokens (configurable) shows `!`. **Unlimited** plans show the cycle total and hide Today.

Colors: **Team** is **green** within the dollar pool and **red** at or over the cap. **Pro** Current/Today stay green (included percents and today’s sum are not a pool overage). Recent queries go **red** on a token spike (`!`). Defaults are darker on a light theme so they stay readable.

### Last N Cursor queries

Click Current, Today, or a recent query to open a native editor panel. Newest first. Default is **1,000** queries (Settings **Show last**, 100–10,000). Four tabs:

- **Last N** — `TIME` · `MODEL` · `COST` · `TOKENS` · `INPUT / OUTPUT` · `KIND`
- **Statistics** — Current/Today glossary, cycle facts, spend by model and kind
- **Charts** — tokens and cost per query over time, plus Today / This month / All time mix cards (from the loaded sample)
- **Settings** — Warn at, Show last, Show warnings, Good/Warning colors

No intermediate menu. Close the tab (or **X**) and click the bar again to reuse the same panel. **Export CSV** and **Open Dashboard** are on the panel.

### Token-spike warning

A `!` on that recent-query chip and on the matching **TOKENS** cell when a query is at or above your token threshold (default **1,000,000**).

### Zero setup

The extension reads the local Cursor session from `state.vscdb` — the same login Cursor already uses. No API key, no cookie to copy from the browser, no `.env`.

### Auto refresh

Polling every 5 minutes by default (configurable). Manual **Refresh** on the status bar after a long agent run. Startup never blocks the editor on the network.

### Local and private

The session token stays in the extension host. It is never sent to the history panel, never written to logs, and never stored in Settings. Requests go only to Cursor’s usage APIs. No analytics and no third-party telemetry.

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

Cursor does **not** install third-party extensions from the Microsoft Visual Studio Marketplace. Until this project is on [Open VSX](https://open-vsx.org/), install a local VSIX:

1. Build: `npm run package`
2. In Cursor: **Extensions** → `…` → **Install from VSIX…**
3. Reload the window

Or from a terminal:

```bash
cursor --install-extension cursor-cost-tracker-0.7.5.vsix
```

After publish, search **Cursor Cost Tracker** in **Cursor → Extensions**.

---

## Status bar

Right side of the bar.

```
… │  3.79 $ / 250.00 $  │  Today 3.79 $ / 11.19 $  │  0.03 $ - 64.8k  │  0.10 $ - 237.0k  │  ! 1.20 $ - 1.2M  │  ↻  │
```

| Item | Shows | Click |
|------|--------|-------|
| **Current** | Used vs plan/limit for the billing cycle (`Unlimited` when the plan has no cap) | Opens Last N |
| **Today** | Spend vs daily budget | Opens Last N |
| **Last 3 queries** | `cost - compact tokens` for the newest queries | Opens Last N |
| **Refresh** | Sync icon | Refreshes only — no panel |

A `!` prefixes a recent query (and the table **TOKENS** cell) when that query is at or above the token threshold (default 1,000,000).

---

## History panel

Open from the status bar, or **Command Palette → Cursor Cost: Show Usage History**. The **Settings** tab has **Warn at** in **k** (1 = 1,000 tokens; spinner steps 100k) and **Show last** (100–10,000, default 1,000).

| TIME | MODEL | COST | TOKENS | INPUT / OUTPUT | KIND |
|------|-------|------|--------|----------------|------|
| `1.09.2026, 10:05:12` | default | 0.03 $ | 64,755 | 12,856 / 168 | Included In Business |

| Action | How |
|--------|-----|
| Open | Click Current / Today / a recent query, or Command Palette |
| Close | Panel **X** |
| Refresh | Status-bar sync, or **Cursor Cost: Refresh** |

---

## Commands

| Command | What it does |
|---------|----------------|
| `Cursor Cost: Show Usage History` | Opens the recent-queries panel |
| `Cursor Cost: Refresh` | Fetches latest usage |
| `Cursor Cost: Open Dashboard` | Opens cursor.com/dashboard |
| `Cursor Cost: Export recent queries CSV` | Save-as dialog for the recent-queries table |

---

## Configuration

| Setting | Default | Notes |
|---------|---------|--------|
| `cursorCost.pollIntervalMinutes` | `5` | Auto-refresh interval |
| `cursorCost.showStatusBar` | `true` | Hide the bar if you only want the command |
| `cursorCost.showToday` | `true` | Hide the Today item |
| `cursorCost.minimalMode` | `false` | Status bar shows only Current (+ Refresh) |
| `cursorCost.spikeTokenThreshold` | `1000000` | Minimum `1000`. Settings tab edits this in **k** (100 = 100k tokens) |
| `cursorCost.showSpikeWarning` | `true` | Off = no `!` and no green/red colors |
| `cursorCost.historyLimit` | `1000` | Newest queries to load (100–10,000). Settings tab: **Show last** |
| `cursorCost.okColor` | `#89D185` | Good-state color (darker green on light themes) |
| `cursorCost.warnColor` | `#F14C4C` | Warning color (darker red on light themes) |

---

## FAQ

**How is this different from Cursor’s usage page?**  
Cursor’s dashboard shows aggregated totals in the browser. This extension shows Current, Today, and the last 3 queries on the status bar, plus Last N queries in the editor (1,000 by default) with Statistics and Charts.

**Do I need to paste a session token?**  
No. If Cursor is signed in on this machine, the extension reads the local session. There is no token field in Settings.

**Does it work on the Free plan?**  
Yes, as long as you are signed in to Cursor on this machine. Unlimited plans hide Today and show the cycle total as Unlimited.

**What is the token-spike `!`?**  
A `!` on that recent-query chip (and on the table **TOKENS** cell) when a single query is at or above your threshold (default 1 million tokens). It is a notice, not advice on how to cut the conversation.

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
- Network: `cursor.com` usage APIs only.
- Storage: local Cursor session only. No cloud database.
- No analytics, no third-party telemetry.

This is **not** an official Cursor product.

---

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
npx ovsx publish cursor-cost-tracker-0.7.5.vsix -p %OVSX_PAT%
```

`engines.vscode` must be **≤** the VS Code version in Cursor **Help → About**, or Cursor hides the extension in search. Keep `LICENSE` and **`icon.png`** inside the VSIX. Marketplace listing uses `"icon": "icon.png"` (PNG, at least 128×128).

Private / team only: skip stores, ship the VSIX, **Install from VSIX**.

---

## Contributing

Contributions welcome.

1. Fork
2. `git checkout -b feature/your-change`
3. Open a pull request

Product requirements: [`.ai/context/prd.md`](.ai/context/prd.md).
