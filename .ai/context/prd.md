# Cursor Cost Tracker — Product Requirements

**Product:** VS Code / Cursor extension  
**Repo:** `cursor-cost-tracker` (standalone, MIT)  
**Document version:** 2.3  
**Date:** 2026-09-01  
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

Clicking the status bar **immediately** opens the last 100 queries. No intermediate menu and no browser.

---

## 2. Problem

Cursor bills chat, agent, and inline edits in USD and tokens. Official usage lives on the account site or a limited dashboard — not on the IDE status bar while you work.

1. You cannot see current and daily spend while coding.
2. A large agent query (hundreds of thousands or **millions** of tokens) surprises you after the fact.
3. History (time, model, cost, tokens, input/output, kind) requires leaving the IDE.
4. There is no in-editor warning when a single query blows a token spike, and no way to dismiss or inspect that row.

**Non-goals:** Cursor payments, other IDEs, team dashboards, estimating cost *before* a prompt is sent, auto-fixing or rewriting the user’s code, analyzing a specific chat/prompt, or advising how to cut that conversation’s tokens.

---

## 3. Vision

> Like a battery indicator, but for the Cursor budget: always at the bottom, one click to full history.

After install (signed-in Cursor), the bar shows Current and Today. Click opens the “Last 100 Cursor queries” table.

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
… │  $(warning) 3.79 $ / 250.00 $  │  Today 3.79 $ / 11.19 $  │  ↻  │
```

`$(warning)` / `!` on the status bar when **at least one non-ignored** query in Last 100 has `tokens >= cursorCost.spikeTokenThreshold` (default **1_000_000**). Tooltip lists how many spikes. Click still opens Last 100 (spike rows highlighted). After every spike is **Ignore**d (or none remain in Last 100), the bang disappears.

| Item | Text | Tooltip | Click |
|------|------|---------|-------|
| Current | `$(credit-card) 3.79 $ / 250.00 $` or `$(warning) 3.79 $ / 250.00 $` | email · plan · cycle end · spike count | **open Last 100** |
| Today | `$(calendar) 3.79 $ / 11.19 $` | how daily budget is derived | **open Last 100** |
| Refresh | `$(sync)` | Refresh | refresh only, no panel |

Colors: within limit — default / `charts.green`; ≥ 80% of day or ≥ 90% of month — yellow; over — red; loading — spinner; error — `N/A` + tooltip.

The bar does **not** show per-query chips. Optional in the Current tooltip (v1.1): last 3 queries.

### 5.2 Click → Last 100

Primary path: **not** Quick Pick. Open the table immediately.

**Container:** `WebviewPanel`, reused ID, title **Last 100 Cursor queries**.

| TIME | MODEL | COST | TOKENS | INPUT / OUTPUT | KIND |
|------|-------|------|--------|----------------|------|
| `1.09.2026, 10:05:12` | default | 0.03 $ | 64,755 | 12,856 / 168 | Included In Business |

Newest first, monospace body, CSS `--vscode-*`. Command Palette: `Cursor Cost: Show Usage History`.

**Token spike (v1.1, required after MVP):** extra column or leading `!` when `tokens >=` the user threshold. Row actions:

| Action | Effect |
|--------|--------|
| **Ignore** | Persist fingerprint in `globalState`. Bang hidden on that row and dropped from the status-bar spike set. |

No **Advise**, auto-repair, or “what to cut in this conversation.” Ignored keys survive reload. Un-ignore (optional): small “Show ignored” control in the table.

### 5.3 Out of MVP

Quick Pick as default click, Activity Bar, blocking modal, 6-column TreeView, React/Vue in the webview, a separate Electron app, Advise / workspace scan / LLM auto-fix.

---

## 6. MVP goals

| ID | Goal | Criterion |
|----|------|-----------|
| G1 | Costs in the IDE | status bar within 10 s of startup (signed-in user) |
| G2 | One click to history | Last 100 table &lt; 2 s (cache) |
| G3 | Consistent numbers | Current/Today match Cursor usage (± $0.01) |
| G4 | Zero configuration | VSIX, no `.env` |
| G5 | Does not block work | no modals; API error = N/A |

---

## 7. User stories (MVP)

| ID | As a… | I want… | so that… |
|----|-------|---------|----------|
| A1 | developer | to see Current on the bar | I know cycle spend |
| A2 | developer | to see Today on the bar | I can pace the daily budget |
| A3 | developer | to click the bar | I see Last 100 |
| A4 | developer | a warning color | I notice overspend |
| A5 | developer | Refresh | I sync after a long agent run |
| A6 | developer | a clear error without a token | I know I must sign in |
| A7 | developer | a tooltip with plan and cycle date | I get context without the table |

v1.1: token-spike bang (§5.1–5.2), Ignore, configurable threshold; 80%/90% spend alerts; Copy stats.  
v1.2: sidebar; optional Quick Pick.

### 7b. User stories (v1.1 — token spike)

| ID | As a… | I want… | so that… |
|----|-------|---------|----------|
| B1 | developer | a `!` on the status bar when a query exceeds my token limit | I notice a spike without opening the table |
| B2 | developer | the same `!` on that row in Last 100 | I see which query exploded |
| B3 | developer | to set the limit (default 1,000,000 tokens) | 1M is not hardcoded for everyone |
| B4 | developer | **Ignore** on that row | the bang goes away if I accept the cost |
| B5 | developer | ignored spikes to stay dismissed after reload | I am not nagged again |

---

## 8. Data

**Session:** `cursorAuth/accessToken` from SQLite `state.vscdb` → cookie `WorkosCursorSessionToken={sub}::{token}`.

| OS | Path |
|----|------|
| Windows | `%APPDATA%\Cursor\User\globalStorage\state.vscdb` |
| macOS | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` |
| Linux | `~/.config/Cursor/User/globalStorage/state.vscdb` |

**Current:** `GET https://cursor.com/api/usage-summary` — pool individual onDemand → plan → team → overall. Unlimited → hide Today.

**Today:** `POST …/dashboard/get-filtered-usage-events` — `dailyBudget = remaining / working days left`; `todayUsed` = sum of today’s cents (local timezone).

**Last 100:** same events API, `pageSize=100`.

**Spike fingerprint (v1.1):** stable id from the API if present, else `${timestamp}|${tokens}|${costUsd}|${model}`. Ignored ids in `context.globalState` key `cursorCost.ignoredSpikes`.

**Refresh:** `activate` must not block the UI; poll every 5 minutes (1–60); manual Refresh; `AbortController`.

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
| `cursorCost.pollIntervalMinutes` | 5 | MVP |
| `cursorCost.showStatusBar` | true | MVP |
| `cursorCost.showToday` | true | MVP |
| `cursorCost.spikeTokenThreshold` | 1000000 | v1.1; min 100000 |
| `cursorCost.showSpikeWarning` | true | v1.1 |

Activation: `onStartupFinished`.

---

## 11. Phases

| Phase | Scope |
|-------|--------|
| **MVP** | session + API, status bar, Last 100 webview, polling, errors |
| **v1.1** | spike `!` (default 1M tokens, user setting), Ignore + persist, 80/90% spend alerts, Copy stats |
| **v1.2** | sidebar, optional Quick Pick |
| **v2** | Secret Storage, CSV, Open VSX |

---

## 12. Risks

Unofficial API / `state.vscdb` → isolate in `src/usage/`, show N/A. Windows: copy the SQLite file into memory (sql.js). Remote SSH: `extensionKind: ui`. Rate limit: poll ≥ 5 minutes.

---

## 13. MVP acceptance

- [ ] VSIX in Cursor (Windows): Current within 10 s for a signed-in account
- [ ] Today hidden when events fail; Current still shown
- [ ] Click Current/Today → Last 100 panel with columns from §5.2
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

---

## 14. Open

Marketplace UI in English. No last-query shortcut on the bar in MVP. Ship a local VSIX first.

---

## 15. Summary

Cursor/VS Code extension. Bar: Current + Today + sync + **spike `!`**. Click: Last 100; spike rows can be **Ignored**. No Advise / auto-fix. Stack: TypeScript, esbuild, sql.js, Vitest. Usage logic in `src/usage/`.
