# v1.3 implementation plan — Daily Spend Guard

**English canonical.** Polish: [daily-spend-guard.pl.md](./daily-spend-guard.pl.md)  
**Parent:** [v1.2-overview.md](./v1.2-overview.md)  
**Status:** ready to implement  
**Depends on:** 1.2.0 shipped ([runaway-agent-detector.md](./runaway-agent-detector.md)) *or* 1.0.3+ if 1.2 is skipped — this feature does **not** import runaway modules. Prefer shipping after 1.2 so MINOR numbers stay sequential.  
**Next:** [cost-efficiency-score.md](./cost-efficiency-score.md) (1.4.0)  
**Version:** **1.3.0** (MINOR)

If this file and [prd.md](../../context/prd.md) disagree, **the PRD wins**. Update the PRD in this same change.

Cursor already computes a **plan pace** daily budget: `dailyBudgetUsd = remainingUsd / workingDaysLeft` (or calendar days). That is **not** a user cap. Users want a hard personal limit ($5 / $10 / $20) that still **cannot stop the agent**.

---

## 1. Goal

Let the user set a **daily dollar cap**. When today’s event sum (`todayUsedUsd`) crosses 80% and 100% of that cap, show a **non-modal** toast once per local day per threshold, turn the Today chip red at/over 80%, and show a Statistics meter separate from plan pace.

**Done when:**

- `dailySpendLimitUsd === 0` (default) → behavior identical to 1.2 / 1.0.3 (Today still uses plan `dailyBudgetUsd`).
- Cap > 0 → Today chip `used $ / cap $`; Pro still works (cap is dollars from events, even if Current is %).
- Toasts: 80% once, 100% once, per local `YYYY-MM-DD`; never `{ modal: true }`.
- Copy: **Warning only — Cursor will keep running.**
- Settings presets Off / $5 / $10 / $20 / custom; `npm test` / `typecheck` green.

---

## 2. Out of scope

| Item | When / why |
|------|------------|
| Blocking modal | G5 — critical alert only |
| Stopping the agent or blocking new chats | Not possible |
| Replacing MTD / monthly forecast math | Forecast stays on plan `dailyBudgetUsd` / included % |
| Runaway burn-vs-remaining-cap | Optional later PATCH; not required in 1.3 |
| Included-% daily cap for Pro | Cap is **dollars** (`todayUsedUsd`), not quota % |
| Auto-enable a $10 cap on upgrade | Zero-setup: default stays `0` |

---

## 3. PRD deltas (implement with the code)

Clarify two daily numbers:

| Number | Source | Role |
|--------|--------|------|
| Plan daily budget | `dailyBudgetUsd` from remaining ÷ pace days | Today chip **when user cap is off**; MTD / forecast unchanged |
| User daily cap | `cursorCost.dailySpendLimitUsd` | Today chip **when > 0**; Guard toasts + Statistics “Daily cap” meter |

New subsection **Daily spend guard:**

- Setting `dailySpendLimitUsd` (default **0** = off; min $0.01 when on; max $10,000).
- Presets in Settings: Off, 5, 10, 20, or custom.
- Uses local-calendar `todayUsedUsd` (already local TZ in parse).
- At ≥ 80% of cap: verdict `tight`, non-modal toast once that local day.
- At ≥ 100%: verdict `over`, second toast once that day.
- Independent of `showCriticalAlert`. Visual red on Today follows `showSpikeWarning` (when warnings off: no green/red on the bar; toasts still honor `dailySpendGuardToast` — see §6).
- Does not stop Cursor.

G5 unchanged.

Stories (e.g. D1–D5): off = old Today; $10 cap shows `3.79 $ / 10.00 $`; toast at $8; toast at $10 same day without repeating; next local day can toast again; Pro % Current unchanged.

---

## 4. Files

```
src/dailySpendLimit.ts         # clamps, verdict, local date key, decide toast
src/ui/dailySpendAlert.ts      # host controller (non-modal)
src/config.ts
src/ui/statusBarView.ts        # Today label + tone when cap on
src/ui/statusBar.ts
src/ui/statusBarTooltip.ts     # optional line: user cap vs plan pace
src/ui/periodStats.ts          # Daily cap meter vs plan Today
src/ui/mtdPace.ts              # do NOT change forecast basis
src/ui/historyRows.ts          # payload fields
src/ui/historyPanel.ts
src/extension.ts
package.json                   # 1.3.0
media/history.html|css|js      # Settings fieldset, Statistics meter
test/dailySpendLimit.test.ts
test/dailySpendDecide.test.ts
```

Update PRD, architecture, snapshot, webview rule.

---

## 5. Types and algorithm (`src/dailySpendLimit.ts`)

No `vscode`. Inject `now` / `todayUsedUsd`.

```typescript
export const DAILY_SPEND_LIMIT_OFF = 0
export const DEFAULT_DAILY_SPEND_LIMIT_USD = 0
export const MIN_DAILY_SPEND_LIMIT_USD = 0.01
export const MAX_DAILY_SPEND_LIMIT_USD = 10_000
export const DAILY_SPEND_TIGHT_RATIO = 0.8
export const DAILY_SPEND_PRESETS_USD = [5, 10, 20] as const

export const DAILY_SPEND_TOAST_STATE_KEY = 'cursorCost.dailySpendToast'

export type DailySpendVerdict = 'off' | 'ok' | 'tight' | 'over'

export type DailySpendState = {
  limitUsd: number
  usedUsd: number
  remainingUsd: number | null
  ratio: number | null
  verdict: DailySpendVerdict
  localDate: string // YYYY-MM-DD
}

export type DailySpendToastState = {
  date: string
  tight: boolean
  over: boolean
}

export type DailySpendDecision =
  | { kind: 'skip' }
  | { kind: 'remember'; state: DailySpendToastState }
  | { kind: 'alert'; level: 'tight' | 'over'; state: DailySpendToastState }
```

### 5.1 Clamp

- Non-finite / negative → `0`.
- `0` stays off (do not coerce to 0.01).
- `0 < x < 0.01` → `0.01`.
- Round to cents: `Math.round(x * 100) / 100`.
- Cap at `10_000`.

### 5.2 Verdict

`used` = `todayUsedUsd` (treat `null` as no events day → `ok` if cap on and used 0, or `off` if snapshot has `todayUsedUsd === null` because today fetch failed — **do not toast** on unknown today).

```
if limit <= 0 → off
if todayUsedUsd === null → skip toasts; verdict off-for-chip (keep plan Today)
if used / limit >= 1 → over
if used / limit >= 0.8 → tight
else → ok
```

`remainingUsd = max(0, limit - used)` when cap on.

### 5.3 Local date key

`localDateKey(now: Date): string` → `YYYY-MM-DD` in **local** TZ (same rule as `sumTodayUsedUsd`). Do not use UTC date.

### 5.4 Decide toast

Inputs: `verdict`, `localDate`, previous `DailySpendToastState | undefined`, `toastsEnabled`.

| Guard | Result |
|-------|--------|
| verdict `off` or `ok` | `remember` with `{ date: localDate, tight: false, over: false }` if date rolled (reset flags) or `skip` if already that empty state |
| `toastsEnabled === false` | `remember` flags as if shown (so turning toasts back on mid-day does not dump a stale 100% toast) **or** `remember` without setting flags — pick **set flags** (no delayed surprise) and test it |
| previous.date ≠ localDate | treat previous as empty |
| `tight` and `!previous.tight` | `alert` level `tight`, persist `tight: true` |
| `over` and `!previous.over` | `alert` level `over`, persist `over: true` (tight may already be true) |
| already flagged for this level | `skip` |

Going from $0 → $10 in one poll: verdict `over`. Fire **one** toast at `over` (not tight then over). If used is ≥ 100%, skip the tight toast. If used is 80–99.99%, only tight.

### 5.5 Today chip label

When cap on and `todayUsedUsd !== null`:

```
$(calendar) {formatDollars(used)} / {formatDollars(limit)}
```

Same formatter as plan Today (`3.79 $ / 10.00 $`). Unlimited plan + user cap: still show the cap (user asked for a personal limit). Plan `isUnlimited` currently hides Today — **keep hide Today when unlimited AND cap is off**. When unlimited **and** cap > 0, **show Today** against the user cap (document in PRD: personal cap overrides hide-Today). If that is too surprising, alternative: keep hide Today on unlimited and only show the Statistics meter — **prefer show Today when cap > 0** so the Guard is visible.

Tone: `ok` → `okColor`; `tight` or `over` → `warnColor` when `showSpikeWarning`. When warnings off: default tone, no red.

Plan pace `dailyBudgetUsd` remains on Statistics glossary / MTD, not on the chip when cap is on.

---

## 6. Settings and messages

| Key | Type | Default | Notes |
|-----|------|---------|--------|
| `cursorCost.dailySpendLimitUsd` | number | `0` | 0 = off |
| `cursorCost.dailySpendGuardToast` | boolean | `true` | Independent of critical-alert toggle. When false: no toasts; chip colors still follow `showSpikeWarning`. |

Settings fieldset **Daily spend guard** after **Monthly budget** (both budget-related).

Controls:

- Select: Off / $5 / $10 / $20 / Custom
- Number input shown for Custom (and current value if it is not a preset)
- Checkbox: Show daily cap warnings (maps to `dailySpendGuardToast`)
- Hint: “A personal daily dollar limit. It does not stop Cursor. Plan pace (remaining ÷ working days) stays on Statistics.”

Apply / Enter / blur on the custom number (partial `2` while typing `20` must not save as 2 — same lesson as Show last).

### 6.1 Payload

```typescript
dailySpendLimitUsd: number
dailySpendGuardToast: boolean
dailySpend: {
  verdict: DailySpendVerdict
  usedUsd: number
  limitUsd: number
  remainingUsd: number | null
  percent: number
  body: string
} | null  // null when off
```

`statusBarPreview` sample: when Settings cap is a preset > 0, preview Today as `3.79 $ / 10.00 $` (example used, configured cap) so the sample matches the editor.

### 6.2 Webview → host

| `type` | Action |
|--------|--------|
| `setDailySpendLimitUsd` | number (0 or ≥ 0.01) |
| `setDailySpendGuardToast` | boolean |

---

## 7. UI surfaces

### 7.1 Toast (`src/ui/dailySpendAlert.ts`)

`showWarningMessage` **without** modal.

- Tight: `Today’s spend is 8.00 $ of your 10.00 $ daily cap.` + `Warning only — Cursor will keep running.`
- Over: `Today’s spend is 10.50 $ — over your 10.00 $ daily cap.` + same disclaimer.

Actions: **Open Statistics** (`cursorCost.showHistory` with Statistics tab — same as Current/Today click). No Snooze (date flags already once-per-day).

Controller: subscribe to snapshot + config; persist `DAILY_SPEND_TOAST_STATE_KEY`; `showing` guard; register in `extension.ts`. Do not `await` in `activate()`.

### 7.2 Status bar

Today chip label + tone as §5.5. Tooltip: add one row **Daily cap** `used / limit` when cap on, keep plan meters as they are.

### 7.3 Statistics

New glossary-style card or meter **Daily cap** when `dailySpend !== null`:

- Title: `Daily cap`
- Value: `8.00 $ / 10.00 $`
- Body: `Personal limit for this local day. Does not stop Cursor. Plan pace stays below.`
- Bar percent: `used/limit` capped at 100 for the fill; show `over` with `--cost-warn`.
- Keep existing Today glossary (plan pace / Pro %). Do not replace it.

### 7.4 Last N / Charts / Optimize

No required change. Do not add a finding.

---

## 8. Implementation steps

| Step | Work | Files |
|------|------|--------|
| 1 | Bump `1.3.0`. Keys `dailySpendLimitUsd`, `dailySpendGuardToast`. | `package.json` |
| 2 | Clamps + config fields. | `src/dailySpendLimit.ts`, `config.ts` |
| 3 | `verdict` + `localDateKey` + `decideDailySpendToast`. | `dailySpendLimit.ts` + tests |
| 4 | Today chip label/tone + preview + tooltip line. | `statusBarView.ts`, `statusBar.ts`, `statusBarTooltip.ts` |
| 5 | `DailySpendAlertController`. | `src/ui/dailySpendAlert.ts`, `extension.ts` |
| 6 | Payload + Statistics meter. | `historyRows.ts`, `periodStats.ts` |
| 7 | Settings fieldset (presets + custom + toast checkbox). | `media/history.*`, `historyPanel.ts` |
| 8 | Unlimited + cap > 0 still shows Today (tests + PRD). | `statusBarView.ts`, parse/UI tests |
| 9 | PRD, architecture, snapshot, webview rule. | `.ai/context/*`, `.cursor/rules/*` |

Do not add efficiency / advisor / attribution in this PR. Do not change `mtdPace` forecast to use the user cap (monthly forecast stays plan-based).

---

## 9. Tests

Inject `now` and `todayUsedUsd`. Local TZ: construct `Date` with local Y-M-D.

### 9.1 Clamp / verdict

- `0` → off; `-1` → off; `0.001` → 0.01; `10.456` → 10.46; `20000` → 10000.
- used 7.99 / limit 10 → `ok`; 8.00 → `tight`; 10.00 → `over`; 10.01 → `over`.
- `todayUsedUsd === null` → no toast path (decision `skip` or remember without alert).

### 9.2 Decide

- New day, used 8/10 → one `tight` alert; second poll same day → `skip`.
- Same day, used jumps 7 → 11 → one `over` alert (no tight).
- tight already flagged, then over → `over` alert once.
- Date rolls `2026-09-11` → `2026-09-12`, used 9/10 → `tight` again.
- `toastsEnabled: false` at over → no `alert`; turning on later same day → still no `alert` (flags set).

### 9.3 Chip

- Cap off: Team Today still `used / dailyBudgetUsd`.
- Cap 10: `3.79 $ / 10.00 $` regardless of plan daily 11.19.
- Warnings off: tone default even if over.

---

## 10. Security

Toast and payload use only dollar amounts already on `UsageReady`. No email, token, or cookie.

---

## 11. Done criteria

- [ ] Version **1.3.0**
- [ ] Default cap off; presets 5/10/20/custom
- [ ] Today chip uses user cap when set; plan pace remains on Statistics / MTD
- [ ] Non-modal toasts once per day at 80% and 100% (100% only if jump skips 80%)
- [ ] Disclaimer copy
- [ ] Pro dollar cap works; unlimited + cap shows Today
- [ ] `npm test` + `typecheck`
- [ ] No extra blocking modal; no agent kill-switch
- [ ] No 1.4–1.6 code
