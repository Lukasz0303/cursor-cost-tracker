# Phase 5 — Status bar

**Parent:** [mvp.md](./mvp.md)  
**Status:** ready to implement  
**Depends on:** [phase-4-usage-service.md](./phase-4-usage-service.md), [phase-1-parse-format.md](./phase-1-parse-format.md) (`formatDollars`)  
**Next:** [phase-6-history-webview.md](./phase-6-history-webview.md)  
**Polish:** [phase-5-status-bar.pl.md](./phase-5-status-bar.pl.md)  
**PRD:** §5.1, A1 A2 A4 A5 A7

If this file and [mvp.md](./mvp.md) or the English PRD disagree, **the PRD wins**.

---

## 1. Goal

Three right-aligned status bar items: **Current**, **Today**, **Refresh**. Click Current/Today opens Last 100 (`cursorCost.showHistory`). Refresh only syncs (`cursorCost.refresh`). Colors and tooltips per PRD. Respect `showStatusBar` / `showToday`.

**Done when:** pure render tests (or mocked items) cover loading, error, unlimited, over-limit, warn, hide Today.

---

## 2. Out of scope

| Item | When |
|------|------|
| Webview panel | phase 6 |
| Spike `!` / `$(warning)` for 1M tokens | v1.1 — **do not** reuse warning icon for spikes yet; `$(warning)` is only for error `N/A` in MVP |
| 80%/90% **notifications** | v1.1 (colors on the bar **are** MVP) |
| Command handler implementation | phase 7 (items still set `command` IDs now) |
| Quick Pick | never as default click |

---

## 3. Files

```
src/config.ts
src/ui/statusBar.ts
src/ui/statusBarView.ts    # optional: pure snapshot → view model
test/statusBar.test.ts
```

Extract a **pure** `toStatusBarView(snapshot, config)` so Vitest does not need real `StatusBarItem`. `statusBar.ts` only applies the view model to vscode items.

---

## 4. Config (`src/config.ts`)

Read `vscode.workspace.getConfiguration('cursorCost')`.

```typescript
export type CursorCostConfig = {
  pollIntervalMinutes: number
  showStatusBar: boolean
  showToday: boolean
}

export function readCursorCostConfig(): CursorCostConfig
```

Clamp `pollIntervalMinutes` to 1–60. Phase 7 watches `onDidChangeConfiguration` and refreshes visibility + poll.

Do not add spike keys.

---

## 5. Items

`StatusBarAlignment.Right`, priorities **100** (Current), **99** (Today), **98** (Refresh).

| Item | `command` | Visible when |
|------|-----------|----------------|
| Current | `cursorCost.showHistory` | `showStatusBar` |
| Today | `cursorCost.showHistory` | `showStatusBar` && `showToday` && `!isUnlimited` && `todayUsedUsd !== null` |
| Refresh | `cursorCost.refresh` | `showStatusBar` |

If `showStatusBar` is false, hide all three (`item.hide()`).

Set `accessibilityInformation` on each item (name + role sufficient for screen readers: “Cursor cost current”, “Cursor cost today”, “Refresh Cursor cost”).

---

## 6. Render rules

Use `formatDollars` from phase 1.

### 6.1 Loading

- Current text: `$(loading~spin) …`
- Today: hide or same spinner — prefer hide Today until ready
- Tooltip: `Loading usage…`

### 6.2 Error

- Current: `$(warning) N/A`
- Today: hide
- Tooltip Current = `snapshot.message` (e.g. `Sign in to Cursor`)
- Color: default or warning; do not pretend spend is green

### 6.3 Ready — unlimited

- Current: `$(credit-card) Unlimited`
- Today: **hide**
- Tooltip Current: `email · plan · cycle ends {date}` — omit null parts; join with ` · `

### 6.4 Ready — metered

- Current: `$(credit-card) {used} / {limit}` e.g. `$(credit-card) 3.79 $ / 250.00 $`
- Today: `$(calendar) {today} / {budget}` e.g. `$(calendar) 3.79 $ / 11.19 $`
- If `limitUsd` is null but not unlimited, show used only or `N/A` for limit — prefer used + ` / —` and cover in a test

### 6.5 Colors (A4)

Theme keys: `charts.red`, yellow (`charts.yellow` if available, else `statusBarItem.warningBackground` — prefer `ThemeColor` from `charts.*`), else `charts.green` / default.

| Surface | Yellow | Red |
|---------|--------|-----|
| Current | used ≥ **90%** of limit | used **> 100%** of limit (or ≥ 100% if you treat exact cap as over — pick **> 100%** as in mvp.md) |
| Today | today ≥ **80%** of daily budget | today **> 100%** of daily budget |

If limit/budget is null, skip ratio colors (default).

Loading: no spend color. Unlimited: default (not red).

### 6.6 Tooltips (English)

**Current (A7):** `email · plan · cycle ends {date}`  
Example: `ada@example.com · Pro · cycle ends 2026-09-30`

**Today:** one short line, e.g. `Today vs remaining cycle ÷ working days left ({n} days).` Do not dump formulas in dollars beyond the visible numbers.

**Refresh:** `Refresh`

---

## 7. Controller

```typescript
export class StatusBarController implements vscode.Disposable {
  static register(context: vscode.ExtensionContext, service: UsageService): StatusBarController
  dispose(): void
}
```

Subscribe to `service.onDidChange` and `workspace.onDidChangeConfiguration` (affects `cursorCost`). Apply view model → `text`, `tooltip`, `color` / `backgroundColor` as chosen, `show()` / `hide()`.

Register items on `context.subscriptions` in phase 7; this phase can still construct them in `register`.

---

## 8. Tests (`test/statusBar.test.ts`)

Drive `toStatusBarView` (pure):

| Snapshot / config | Current text contains | Today visible |
|-------------------|------------------------|---------------|
| loading | spinner | no |
| error `Sign in to Cursor` | `N/A` | no |
| unlimited | `Unlimited` | no |
| today null | used/limit | no |
| showToday false | used/limit | no |
| showStatusBar false | all hidden | no |
| used 91% of 100 | yellow | — |
| used 101 / 100 | red | — |
| today 80% of budget | — | yellow |
| today over budget | — | red |

Do not import real vscode StatusBarItem in unit tests if the view model is pure.

---

## 9. Security

Tooltip may include **email** (PRD A7). Still never cookie/token/`sub`. Do not put `cookie` on the view model.

---

## 10. Handoff to phase 6

Click already points at `cursorCost.showHistory`. Phase 6 implements the panel; phase 7 binds the command to `HistoryPanel.show()`. Status bar does not create a webview.
