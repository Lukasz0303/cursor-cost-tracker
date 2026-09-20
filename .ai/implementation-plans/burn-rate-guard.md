# v1.2 implementation plan — Burn Rate Guard

**English canonical.** Polish: [burn-rate-guard.pl.md](./burn-rate-guard.pl.md)  
**Status:** implemented in **1.0.4**  
**Depends on:** MVP complete ([mvp.md](./mvp.md)). Packaged baseline **1.0.3**.  
**Version:** **1.0.4** (PATCH)  
**Backlog (do not implement in this PR):** [additional/README.md](./additional/README.md)

If this file and [prd.md](../context/prd.md) disagree, **the PRD wins**. Update the PRD in this same change.

---

## 1. Goal

Answer **how fast am I spending?**, not only **how much have I spent?**

Cursor can fire many ordinary-looking requests in a few minutes. Per-query **critical alert** (newest query ≥ 10M tokens or $5) and per-query **Warn at** `!` miss that case: each row looks fine, the **sum in a short window** does not.

**Burn Rate Guard** sums `costUsd` (and, for display, tokens + request count) in a user-set time window (default **10 minutes**). It:

1. Always shows **current burn** on Statistics (`$3.42 / 10 min`, optional `×` vs the user’s own normal pace, Today total).
2. Toasts **warning** when window spend ≥ `$2` (default) and **critical** when ≥ `$5` (default) — **non-modal**, once per episode.
3. Tints the **Today** status-bar chip when warnings are on and the live window is at warning/critical.

It does **not** read the chat, does **not** detect token-similarity loops (that is the deferred [runaway-agent-detector.md](./additional/runaway-agent-detector.md)), and does **not** stop Composer. Critical copy may offer **Focus Composer** so the user can stop the run in Cursor’s own UI.

**Done when:**

- Pure window / pace / level / `decideBurnRateAlert` covered by Vitest (no `vscode` import).
- Statistics **Current burn rate** card always (when the feature is on), even under the warning threshold.
- Non-modal warning + critical toasts, once per episode, snooze 30 min, first-load grace (same idea as [src/spikes/criticalAlert.ts](../src/spikes/criticalAlert.ts)).
- Today chip + tooltip reflect burn when `showSpikeWarning` is on.
- Settings fieldset matches the product mock (enable, window, warning $, critical $, two notification checkboxes).
- `npm test` / `typecheck` green. PRD **G5** still has **only one** blocking modal (last-query critical alert).

---

## 2. Why this is not the deferred Runaway plan

| | **Burn Rate Guard (this PR)** | **Runaway Agent Detector (backlog)** |
|--|------------------------------|--------------------------------------|
| Question | How fast is **cost** rising? | Do queries **look like a loop**? |
| Trigger | Sum `$` in `W` minutes vs user `$` thresholds | Velocity + repeat ±15% tokens + balloon input |
| Single expensive query | Ignored if `minQueries` ≥ 2 (default) — that is Query / critical alert | May still fire on repeat shape |
| Pro included `$0` rows | Dollar toasts may never fire; card still shows token throughput | Still sees query shapes |

Do **not** port repeat/balloon into this PR. One MINOR, one question.

---

## 3. Out of scope

| Item | Why |
|------|-----|
| `{ modal: true }` | G5 — last-query critical alert stays the only blocking dialog |
| **Stop Agent** button that actually cancels Composer | No supported extension API. Copy must not pretend. Optional **Focus Composer** (`composer.focusComposer`) so the user hits Stop in Cursor. |
| Chat transcript / composer JSON | Product rule |
| Daily user cap ($5/day) | Deferred [daily-spend-guard.md](./additional/daily-spend-guard.md) |
| Token-similarity loop detector | Deferred runaway plan |
| Token **thresholds** as toast triggers | 1.2 toasts are **dollar** only (product mock). Token counts are **display**. See §5.6 for Pro `$0`. |
| Extra status-bar chip | Bar is already Current + Today + Refresh + 1–10 queries |
| 7th webview tab / React | Never |
| Ignore of token spikes | v1.1 leftover ([token-spike.md](./token-spike.md)) |
| Changing MTD forecast math | Forecast stays long-term; burn is short-term |

---

## 4. PRD deltas (ship with the code)

After **Critical last-query alert**, add **Burn Rate Guard**:

- Setting `cursorCost.burnRateGuard` (default **true**). Window `burnRateWindowMinutes` (default 10, 2–60). Warning `burnRateWarningUsd` (default **2.00**). Critical `burnRateCriticalUsd` (default **5.00**, always ≥ warning). Min requests in the window `burnRateMinQueries` (default **2**, 1–50) so a **single** expensive query stays the existing per-query critical alert.
- **Live window:** queries with `timestamp` in `[now − W, now]` (local ms). Not “last W minutes of the newest event forever.” After spending stops, the rate **falls** as rows age out.
- **Current burn** card on Statistics (always when enabled): window `$` / `W min`, request count, tokens, optional `×` vs median historical windows in this Last N sample, Today `$`.
- **Warning** (non-modal): window `$` ≥ warning and `queryCount ≥ minQueries`. **Critical** (non-modal `showErrorMessage`, still **not** `{ modal: true }`): window `$` ≥ critical.
- Independent of `showCriticalAlert`. Visual red on Today / table rows in the window follows `showSpikeWarning`. Toasts follow `burnRateWarningToast` / `burnRateCriticalToast`.
- Once per episode + Snooze 30 min in `globalState`. First load: if the newest query in the live window is older than five minutes, remember without a toast.
- Does not stop Cursor. Critical actions: **View details** (Statistics), **Dismiss**, optional **Focus Composer**.
- G5 unchanged.

Stories (e.g. B1–B6):

- B1: 12 requests, `$4.82` in 6 min, warning `$2` → warning toast + Statistics card.
- B2: same window later reaches `$5.10` → **one** extra critical toast (escalate once).
- B3: restart with that burst already 10 min old → no toast (grace).
- B4: one `$6` query, `minQueries = 2` → **no** burn toast (per-query critical alert may still modal).
- B5: Snooze → no toast for 30 min even if still over.
- B6: Show warnings off → Today stays default color; toasts still honor their own checkboxes.

---

## 5. Algorithm (pure, `src/burnRate/`)

No `vscode`. Inject `nowMs`. Reuse `queryFingerprint` from `src/spikes/criticalAlert.ts`.

### 5.1 Live window (`window.ts`)

```typescript
export type BurnRateWindow = {
  windowMs: number
  startMs: number
  endMs: number
  queries: UsageQuery[] // newest first
  queryCount: number
  costUsd: number
  tokens: number
}

export function liveWindow(
  queries: readonly UsageQuery[],
  windowMinutes: number,
  nowMs: number,
): BurnRateWindow
```

- `endMs = nowMs`, `startMs = nowMs - windowMinutes * 60_000`.
- Include `timestamp >= startMs && timestamp <= nowMs`. Drop future timestamps (clock skew) by clamping each `timestamp` to `min(timestamp, nowMs)` **or** excluding `timestamp > nowMs` — **exclude future**, test it.
- Sort included queries newest first.
- `costUsd = sum(costUsd)`, `tokens = sum(tokens)`.

Empty / no queries in range → `queryCount = 0`, sums `0`.

**Why `now`, not newest event:** if the last query was 45 minutes ago, “current burn” must be `$0 / 10 min`, not that old burst.

### 5.2 Level (`detect.ts`)

```typescript
export type BurnRateLevel = 'off' | 'ok' | 'warning' | 'critical'

export function burnRateLevel(input: {
  enabled: boolean
  queryCount: number
  minQueries: number
  costUsd: number
  warningUsd: number
  criticalUsd: number
}): BurnRateLevel
```

```
if !enabled → off
if queryCount < minQueries → ok     // not enough traffic to call it a burn
if costUsd >= criticalUsd → critical
if costUsd >= warningUsd → warning
else → ok
```

`criticalUsd` is clamped ≥ `warningUsd` in config so the branches cannot invert.

### 5.3 Normal pace (`pace.ts`)

Used only for the `×` line. **Never** a toast trigger.

1. Consider Last N sample queries with `timestamp < startMs` (strictly before the live window).
2. Build **non-overlapping** buckets of length `windowMs` ending at `startMs`, `startMs - windowMs`, … while the bucket still contains ≥ `minQueries` **or** stop after 24 buckets (cap work).
3. Each bucket: `sum(costUsd)` of queries in `[bucketStart, bucketEnd)`.
4. Keep buckets with `queryCount ≥ minQueries`.
5. If fewer than **3** such buckets → `normalUsd = null` (hide `×`).
6. Else `normalUsd = median(bucket costs)`.
7. `multiplier = costUsd / normalUsd` when `normalUsd >= 0.01`; else `null` (avoid `400×` on a `$0.001` median).

Median of an even list: average of the two middle values, then round to cents for display only; keep full float for `multiplier`.

### 5.4 Episode + toast decision (`detect.ts`)

An **episode** starts when level becomes `warning` or `critical` and ends when level returns to `ok`/`off` **or** snooze/dismiss.

```typescript
export const BURN_RATE_SEEN_KEY = 'cursorCost.lastBurnRateSeenKey'
export const BURN_RATE_SNOOZE_UNTIL_KEY = 'cursorCost.burnRateSnoozeUntil'
export const DEFAULT_BURN_RATE_GRACE_MS = 5 * 60_000
export const BURN_RATE_SNOOZE_MS = 30 * 60_000

export type BurnRateEpisode = {
  level: 'warning' | 'critical'
  startMs: number
  endMs: number
  queryCount: number
  costUsd: number
  tokens: number
  multiplier: number | null
}

export type BurnRateDecision =
  | { kind: 'skip' }
  | { kind: 'remember'; key: string }
  | { kind: 'alert'; episode: BurnRateEpisode; key: string }
```

**Key** (must change on escalate): `` `${level}|${roundCents(costUsd)}|${queryCount}|${startMs}` `` is too noisy (cost ticks every poll). Use:

```
key = `${level}|${floor(startMs / 60_000)}`
```

Level in the key → warning→critical is a **new** key → second toast. Same level in the same minute-bucket → `skip`. When the window slides, `startMs` moves; floor-to-minute keeps one toast per minute-of-window-start **plus** level. Simpler and more stable:

**Preferred key:** `` `${level}` `` plus a stored `episodeId` that we **do not** rotate until level drops to `ok`. Persist `{ level, episodeId }` in `lastSeenKey` as `"warning:ep1"` / `"critical:ep1"`. Escalate replaces with `"critical:ep1"` → alert. Drop to `ok` clears episode so a later burst is new.

`decideBurnRateAlert` inputs: `level`, `window`, `multiplier`, `enabledToasts` (`warning` / `critical` flags), `lastSeenKey`, `snoozeUntilMs`, `nowMs`, `graceMs`.

| Guard | Result |
|-------|--------|
| level `off` or `ok` | `remember` empty / clear episode id |
| toast for this level disabled | `remember` as if shown (no surprise when re-enabled mid-episode — same as Daily Guard backlog) |
| `nowMs < snoozeUntilMs` | `remember` |
| first seen (`lastSeenKey` empty) and `(nowMs - newestInWindow.timestamp) > graceMs` | `remember` |
| lastSeen already this level for this episode | `skip` |
| lastSeen was `warning` and now `critical` | `alert` critical |
| lastSeen empty / other episode and now warning or critical | `alert` |

Persist `lastSeenKey` as `warning:<episodeStartFloor>` / `critical:<episodeStartFloor>` where `episodeStartFloor = floor(newestInWindow.timestamp / 60_000)` at **first** crossing, frozen until `ok`.

### 5.5 Clamps

| Function | Range | Default |
|----------|--------|---------|
| `clampBurnRateWindowMinutes` | 2–60, round | 10 |
| `clampBurnRateUsd` | ≥ 0.01, ≤ 10_000, cents | warning 2, critical 5 |
| `clampBurnRateMinQueries` | 1–50, round | 2 |
| critical vs warning | `critical = max(critical, warning)` | |

`0` is **not** valid for warning/critical (feature off is the boolean). Non-finite → defaults.

### 5.6 Pro / included `$0`

Many Pro events parse to `$0`. Then `costUsd` in the window stays `0` → level `ok` forever.

- Still show **tokens / W min** and request count on the card.
- Settings hint: “Warnings use dollars from Cursor’s usage events. Included Pro requests that bill as 0.00 $ do not raise the dollar burn — the card still shows token throughput.”
- Do **not** invent a token toast in 1.2 (keeps the mock’s `$` controls). Token-rate alerts can be a later PATCH if Pro users ask.

Team / usage-based `$` events behave as the mock.

---

## 6. Settings and messages

### 6.1 `package.json` / `CursorCostConfig`

| Key | Type | Default | Notes |
|-----|------|---------|--------|
| `cursorCost.burnRateGuard` | boolean | `true` | Master: card + detection |
| `cursorCost.burnRateWindowMinutes` | number | `10` | 2–60 |
| `cursorCost.burnRateWarningUsd` | number | `2` | Apply / Enter / blur |
| `cursorCost.burnRateCriticalUsd` | number | `5` | ≥ warning after clamp |
| `cursorCost.burnRateMinQueries` | number | `2` | Hidden from the marketing mock; still a setting (advanced). Put it in the same fieldset under a hint “Minimum requests in the window (default 2) so a single spike stays the query alert.” |
| `cursorCost.burnRateWarningToast` | boolean | `true` | “Show warning notification” |
| `cursorCost.burnRateCriticalToast` | boolean | `true` | “Show critical notification” |

Fieldset **Burn Rate Guard** after **Critical alert** (same warning family). Layout:

```
☑ Enable
Time window: [ 10 ] min
Warning:     [ 2.00 ] $
Critical:    [ 5.00 ] $
Minimum requests in window: [ 2 ]
☑ Show warning notification
☑ Show critical notification
Hint: Does not stop the agent. Dollar burn uses usage-event costs.
```

Numbers: Apply / Enter / blur (not while typing). Stepper ±0.50 $ like critical cost.

### 6.2 Host → webview

```typescript
burnRateGuard: boolean
burnRateWindowMinutes: number
burnRateWarningUsd: number
burnRateCriticalUsd: number
burnRateMinQueries: number
burnRateWarningToast: boolean
burnRateCriticalToast: boolean
burnRate: {
  level: BurnRateLevel
  costUsd: number
  tokens: number
  queryCount: number
  windowMinutes: number
  multiplier: number | null
  todayUsd: number | null
  summary: string          // English, e.g. "3.42 $ / 10 min"
  paceLabel: string | null // "2.8× your normal rate"
} | null  // null when setting off
```

`HistoryRow` adds `inBurnWindow: boolean` (query timestamp inside the live window). When `showSpikeWarning` and level is warning/critical, those rows use `warnColor` (in addition to existing spike `!`). Do **not** prefix TOKENS with a second mark; spike `!` stays token-based.

### 6.3 Webview → host

| `type` | Action |
|--------|--------|
| `setBurnRateGuard` | boolean |
| `setBurnRateWindowMinutes` | number |
| `setBurnRateWarningUsd` | number |
| `setBurnRateCriticalUsd` | number |
| `setBurnRateMinQueries` | number |
| `setBurnRateWarningToast` | boolean |
| `setBurnRateCriticalToast` | boolean |

`ConfigurationTarget.Global` + overlay, same as other Settings keys.

---

## 7. UI surfaces

### 7.1 Toasts (`src/ui/burnRateAlert.ts`)

**Warning** — `showWarningMessage` **without** `modal`:

```
High burn rate: 4.82 $ in the last 6 minutes (12 requests, 18.4M tokens).
Warning only — Cursor will keep running.
```

Buttons: **View details**, **Dismiss**.

**Critical** — `showErrorMessage` **without** `modal`:

```
Possible runaway cost: 8.41 $ in 9 minutes (24 requests, 31.2M tokens).
This does not stop Cursor. Check the active Agent run before continuing.
```

Buttons: **View details**, **Focus Composer** (if `composer.focusComposer` exists in `getCommands`; else omit), **Dismiss**.

No **Stop Agent**. If we cannot focus Composer, View details is enough.

- **View details** → `cursorCost.showHistory` on **Statistics** (same as Current/Today).
- **Dismiss** → `remember` current episode key.
- **Focus Composer** → `composer.focusComposer` then `composer.openComposer` fallback (same allowlist idea as [openOptimizeChat.ts](../src/ui/openOptimizeChat.ts)). Do not paste. Do not create a new chat.

Snooze: include **Snooze 30 min** on both toasts (fourth button is acceptable). Store `now + BURN_RATE_SNOOZE_MS`.

Controller: copy `CriticalAlertController` (`showing` guard, `UsageService.onDidChange`, config watch). `activate()` must not `await` the toast. Register on `context.subscriptions`.

Use `formatDollars`, `formatCompactTokens` from [format.ts](../src/format.ts). Window duration in the copy: `max(1, round((now - oldestInWindow) / 60_000))` minutes so “6 minutes” is honest when the burst is shorter than `W`.

### 7.2 Status bar

When `burnRateGuard` and level is `warning` | `critical` and `showSpikeWarning`: **Today** chip uses `warnColor` (even if plan daily budget is fine). Current chip unchanged.

Tooltip (existing hover card): one extra row **Burn** `3.42 $ / 10 min` and `2.8×` when multiplier exists. Link still Open Dashboard / Refresh.

Minimal mode: Today may be hidden — then only toast + Statistics. Do not add a chip.

Preview in Settings: if Enable is on, the sample Today may use warn styling **or** stay the existing example (prefer **unchanged sample** unless trivial).

### 7.3 Statistics

**Always** (feature on), a card **Current burn rate** near Current/Today glossary (short-term vs long-term MTD):

- Title: `Current burn rate`
- Value: `3.42 $ / 10 min` (`summary`)
- Subline: `↑ 2.8× your normal rate` or omit
- Body: `12 requests · 18.4M tokens` + `Today: 12.84 $` when `todayUsd` is not null
- Meter: `costUsd / criticalUsd` fill (cap 100%). Color `--cost-ok` / `--cost-warn` from level when `showSpikeWarning`, else default
- When `ok`: still show the card (the product point). Empty sample: `0.00 $ / 10 min`, `0 requests`

When level is warning/critical: a **banner** above the glossary (title `High burn rate` / `Possible runaway cost`, body = toast first line + “Does not stop Cursor.”).

Do not add a Charts series in 1.2.

### 7.4 Last N

Rows with `inBurnWindow` and level warning/critical: same row warn styling as spikes. No new column. Optional toolbar pill **This window** is **out of 1.2** (keep chrome down).

### 7.5 Optimize / Charts / Support

No change.

---

## 8. Files

```
src/burnRate/window.ts
src/burnRate/pace.ts
src/burnRate/detect.ts      # level + decideBurnRateAlert + clamps
src/burnRate/copy.ts        # English toast / card strings
src/ui/burnRateAlert.ts     # host controller
src/config.ts
src/ui/historyRows.ts       # payload + HistoryRow.inBurnWindow
src/ui/historyPanel.ts      # set* 
src/ui/periodStats.ts       # optional: or attach burnRate only on payload
src/ui/statusBarView.ts     # Today tone
src/ui/statusBar.ts
src/ui/statusBarTooltip.ts  # Burn row
src/extension.ts            # register controller
package.json                # 1.0.4 + contributes
media/history.html|css|js   # card, banner, Settings fieldset
test/burnRateWindow.test.ts
test/burnRatePace.test.ts
test/burnRateDetect.test.ts
test/burnRateCopy.test.ts
```

Update: `.ai/context/prd.md`, `prd.pl.md`, `architecture.md`, `codebase-snapshot.md`, `.cursor/rules/extension-webview.mdc`, `.cursor/rules/shared.mdc` (`src/burnRate/`).

Poll interval stays user-set (default 1 min). Activity refresh ([activityRefresh.ts](../src/usage/activityRefresh.ts)) already refetches on focus/edit — that is how burn stays closer to live than one minute. Do not add a faster dedicated poll.

---

## 9. Implementation steps

| Step | Work | Files |
|------|------|--------|
| 1 | Bump **1.0.4**. Add `cursorCost.burnRate*` keys + markdown descriptions. | `package.json` |
| 2 | Clamps + `CursorCostConfig`. | `src/burnRate/detect.ts` (or `src/burnRate/clamp.ts`), `config.ts` + config tests |
| 3 | `liveWindow` + future-timestamp / empty cases. | `window.ts` + `test/burnRateWindow.test.ts` |
| 4 | `normalUsd` / `multiplier`. | `pace.ts` + tests |
| 5 | `burnRateLevel` + `decideBurnRateAlert` (grace, snooze, escalate, minQueries). | `detect.ts` + tests |
| 6 | English copy helpers. | `copy.ts` + tests |
| 7 | `BurnRateAlertController` (non-modal, View details, Focus Composer, Snooze). | `src/ui/burnRateAlert.ts`, `extension.ts` |
| 8 | Payload `burnRate` + `inBurnWindow`; Statistics card + banner. | `historyRows.ts`, `media/history.*` |
| 9 | Today chip tone + tooltip line. | `statusBarView.ts`, `statusBarTooltip.ts` |
| 10 | Settings fieldset; Apply / Enter / blur; preview overlay. | `media/history.*`, `historyPanel.ts` |
| 11 | PRD, architecture, snapshot, webview + shared rules. | `.ai/context/*`, `.cursor/rules/*` |

Do not implement additional/ backlog features in this PR.

---

## 10. Tests

Inject `nowMs` and query timestamps. No `Date.now()`.

### 10.1 Window

- `now = 100`, `W = 10 min`, queries at `now`, `now-5min`, `now-11min` → only first two; costs sum.
- Query at `now+1000` (future) → excluded.
- After 11 minutes with no new queries, previously included rows drop out → `$0`.
- Empty list → zeros.

### 10.2 Level

- `$1.99`, 5 queries, warning `$2` → `ok`.
- `$2.00`, 5 queries → `warning`.
- `$5.00`, 5 queries → `critical`.
- `$10`, **1** query, `minQueries = 2` → `ok`.
- `enabled: false` → `off`.
- Config critical `$3` warning `$5` → after clamp critical `$5`.

### 10.3 Pace

- `< 3` qualifying buckets → `null` multiplier.
- Three buckets `$0.30`, `$0.30`, `$0.40`, live `$1.20` → multiplier `4` (median `$0.30`).
- Median `$0` → multiplier `null`.

### 10.4 Decide

- First load, newest in window 10 min old, level warning → `remember`.
- Live newest 30 s ago, `$3` / 5 queries → `alert` warning.
- Same episode, still warning → `skip`.
- Escalate to critical → `alert` critical once.
- Snooze until future → `remember`.
- Warning toast disabled, level warning → `remember` not `alert`.
- Drop to `ok` then a new burst → `alert` again.

### 10.5 Copy / payload

- Duration uses oldest-in-window vs `now`, not always 10.
- `inBurnWindow` true only for live-window rows.
- No email/token in strings.

---

## 11. Security

- Toast, tooltip, and payload use only `$`, token counts, request counts, model-less aggregates. No cookie, access token, email, or transcript.
- Focus Composer executes an **existing** Cursor command id; do not pass user text.
- Do not log raw usage events.

---

## 12. Layering (how it sits next to today)

```
                 COST PROTECTION
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
     QUERY ALERT   BURN RATE    MONTHLY FORECAST
      per query    short-term      long-term
      Warn at !    this 1.0.4     existing MTD
      critical $5                 existing charts
```

- **Query alert:** one request too big.
- **Burn Rate Guard:** many requests, dangerous **pace**.
- **Monthly forecast:** this pace could empty the month (already shipped; no formula change).

---

## 13. Done criteria

- [ ] Version **1.0.4**
- [ ] Live window vs `now`; rate falls when idle
- [ ] Card always visible when enabled; `×` only with enough history
- [ ] Non-modal warning + critical; escalate once; snooze; grace
- [ ] No Stop Agent; optional Focus Composer; disclaimer copy
- [ ] `minQueries` default 2 so one spike ≠ burn toast
- [ ] Today chip warn when level high and Show warnings on
- [ ] Settings fieldset; numbers not saved while typing
- [ ] Pro `$0` limitation documented in PRD + Settings hint
- [ ] `npm test` + `npm run typecheck`
- [ ] G5: only last-query critical alert is blocking
- [ ] No additional/ backlog code in the PR
