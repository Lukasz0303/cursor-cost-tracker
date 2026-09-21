# v1.2 implementation plan — Runaway Agent Detector

**English canonical.** Polish: [runaway-agent-detector.pl.md](./runaway-agent-detector.pl.md)  
**Parent:** [v1.2-overview.md](./v1.2-overview.md)  
**Status:** ready to implement  
**Depends on:** MVP complete ([mvp.md](../mvp.md)). Packaged baseline **1.0.3**.  
**Next:** [daily-spend-guard.md](./daily-spend-guard.md) (1.3.0)  
**Version:** **1.2.0** (MINOR)

If this file and [prd.md](../../context/prd.md) disagree, **the PRD wins**. Update the PRD in this same change.

Cursor usage events have **no conversation id**. Detection is a time-series heuristic on `UsageQuery[]` (timestamp, model, kind, tokens, cost). It is not proof the agent is looping — the UI must say **may be looping**.

---

## 1. Goal

Warn when recent queries look like a runaway loop: many turns in a short window, near-identical repeats, or exploding input.

**Done when:**

- Pure `detectRunaway` + `decideRunawayAlert` are covered by Vitest (no `vscode` import).
- A **non-modal** toast fires **once per episode** (Snooze 30 min); first-load historical clusters are remembered without a toast (same grace idea as critical alert).
- Status-bar query chips and Last N TOKENS show `!` / `warnColor` for queries in an active episode when `showSpikeWarning` is on.
- Statistics shows a banner; Optimize may add one metadata finding.
- Settings fieldset **Runaway detector**; `npm test` / `typecheck` green; PRD G5 still has **only one** blocking modal (critical alert).

---

## 2. Out of scope

| Item | When / why |
|------|------------|
| `{ modal: true }` | Never — G5. Critical alert stays the only blocking dialog. |
| Stopping / pausing Composer or Agent | Not an extension API. Copy: warning does not stop spend. |
| Chat transcript / composer JSON | Product rule. |
| Ignore of token spikes | v1.1 leftover ([token-spike.md](../token-spike.md)). |
| Daily user cap as burn signal | 1.3. In 1.2, burn-$ is optional and default **off**. |
| New webview tab | Never in this epic. |
| React | Never. |

---

## 3. PRD deltas (implement with the code)

Add a subsection after Critical last-query alert:

- **Runaway Agent Detector:** when `cursorCost.runawayDetector` is on, the extension scores the Last N sample in a sliding window (`runawayWindowMinutes`, default 10; `runawayMinQueries`, default 8). Signals: **velocity** (≥ min queries in the window), **repeat** (≥ 5 consecutive same model and tokens ±15%), **balloon** (input tokens grow ≥ 50% across the last 3 in the window), optional **burn** if `runawayBurnUsd` > 0 (default 0 = off). Match = **episode**. Non-modal warning once per episode fingerprint; **Snooze** 30 minutes in `globalState`. Queries older than five minutes on first load are remembered without a toast. Does not stop Cursor. Independent of the critical-alert modal. Visual `!` / red follow `showSpikeWarning`.

Stories (new, e.g. R1–R4): toast on a live loop; no toast on restart with old dense history; Snooze suppresses 30 min; Show warnings off → no `!`/colors on bar/table.

G5 unchanged: no extra blocking modal.

---

## 4. Files

```
src/runaway/detect.ts          # pure: window, signals, episode, decide
src/runaway/alert.ts           # copy for toast (pure strings)
src/ui/runawayAlert.ts         # host controller: toast, globalState, Open History
src/config.ts                  # new keys
src/ui/historyRows.ts          # HistoryRow.runaway; payload.runaway
src/ui/statusBarView.ts        # chip bang / tone for runaway queries
src/ui/statusBar.ts            # pass flags
src/ui/historyPanel.ts         # set* messages; include runaway in data
src/ui/optimizeInsights.ts     # optional finding id `runaway-loop`
src/extension.ts               # register controller
package.json                   # 1.2.0 + contributes
media/history.html|css|js      # badge, Statistics banner, Settings fieldset
test/runawayDetect.test.ts
test/runawayDecide.test.ts
```

Update: `.ai/context/prd.md`, `prd.pl.md`, `architecture.md`, `codebase-snapshot.md`, `.cursor/rules/extension-webview.mdc`, `.cursor/rules/shared.mdc` (new `src/runaway/`).

Mirror the critical-alert split: `src/spikes/criticalAlert.ts` (pure) vs `src/ui/criticalAlert.ts` (host).

---

## 5. Types and algorithm (`src/runaway/detect.ts`)

No `vscode`. Inject `nowMs` in tests.

```typescript
export const DEFAULT_RUNAWAY_WINDOW_MINUTES = 10
export const MIN_RUNAWAY_WINDOW_MINUTES = 2
export const MAX_RUNAWAY_WINDOW_MINUTES = 60
export const DEFAULT_RUNAWAY_MIN_QUERIES = 8
export const MIN_RUNAWAY_MIN_QUERIES = 3
export const MAX_RUNAWAY_MIN_QUERIES = 50
export const DEFAULT_RUNAWAY_BURN_USD = 0
export const RUNAWAY_REPEAT_COUNT = 5
export const RUNAWAY_TOKEN_SIMILARITY = 0.15
export const RUNAWAY_BALLOON_RATIO = 1.5
export const RUNAWAY_BALLOON_LOOKBACK = 3
export const DEFAULT_RUNAWAY_GRACE_MS = 5 * 60_000
export const RUNAWAY_SNOOZE_MS = 30 * 60_000

export const RUNAWAY_SEEN_KEY = 'cursorCost.lastRunawaySeenKey'
export const RUNAWAY_SNOOZE_UNTIL_KEY = 'cursorCost.runawaySnoozeUntil'

export type RunawaySignal = 'velocity' | 'repeat' | 'balloon' | 'burn'

export type RunawayEpisode = {
  firstTimestamp: number
  lastTimestamp: number
  queryCount: number
  costUsd: number
  signals: RunawaySignal[]
  fingerprints: string[]
}

export type RunawayDecision =
  | { kind: 'skip' }
  | { kind: 'remember'; key: string }
  | { kind: 'alert'; episode: RunawayEpisode; key: string }
```

Reuse `queryFingerprint` from `src/spikes/criticalAlert.ts` (do not duplicate).

### 5.1 Window

1. Sort queries **newest first**.
2. Let `anchor = queries[0].timestamp` (newest event). Do **not** use wall clock to *build* the window (tests stay deterministic). Wall clock is only for grace / snooze in `decideRunawayAlert`.
3. `windowStart = anchor - windowMinutes * 60_000`.
4. `inWindow = queries` with `timestamp >= windowStart` (still newest-first).

Empty sample → no episode.

### 5.2 Signals (any one is enough)

**Velocity:** `inWindow.length >= minQueries`.

**Repeat:** walk `inWindow` in newest-first order. A streak continues while `stripModelPrefix(model)` is equal (treat `null` as `"unknown"`) **and** `|tokens_a - tokens_b| / max(tokens_a, 1) <= 0.15`. If any streak length ≥ `RUNAWAY_REPEAT_COUNT` (5) → `repeat`. Streaks do not cross the window edge.

**Balloon:** take the last `RUNAWAY_BALLOON_LOOKBACK` (3) queries in the window **oldest-first**. Need 3 with `inputTokens > 0`. Signal if each next `inputTokens >= previous * RUNAWAY_BALLOON_RATIO` (1.5), i.e. ≥ 50% growth per step, or equivalently last ≥ first × 1.5². Pick **strict chain** (each step ≥ 1.5×) and test it. Guard `inputTokens === 0` (no balloon).

**Burn:** if `runawayBurnUsd > 0` and `sum(costUsd in window) >= runawayBurnUsd` → `burn`. Default setting `0` = skip this signal.

If `signals.length === 0` → no episode.

### 5.3 Episode

```
firstTimestamp = min(inWindow.timestamp)
lastTimestamp  = max(inWindow.timestamp)
queryCount     = inWindow.length
costUsd        = sum(inWindow.costUsd)
fingerprints   = inWindow.map(queryFingerprint)
key            = `${firstTimestamp}|${lastTimestamp}|${queryCount}`
```

`detectRunaway(queries, config): RunawayEpisode | null`

`queryInRunaway(query, episode): boolean` — fingerprint in `episode.fingerprints`.

### 5.4 Decide toast (`decideRunawayAlert`)

Inputs: `episode`, `enabled`, `lastSeenKey`, `snoozeUntilMs`, `nowMs`, `graceMs`.

| Guard | Result |
|-------|--------|
| `enabled === false` | If episode exists and key ≠ lastSeenKey → `remember`; else `skip` |
| no episode | `skip` |
| `nowMs < snoozeUntilMs` | `remember` (keep key current so a new episode after snooze can alert) |
| `key === lastSeenKey` | `skip` |
| first seen (`lastSeenKey === undefined`) and `nowMs - lastTimestamp > graceMs` | `remember` (old dense history on install / restart) |
| otherwise | `alert` |

Same shape as `decideCriticalAlert`. Do not reuse that function — different key and snooze.

### 5.5 Clamps

```
clampRunawayWindowMinutes  → 2…60, default 10, non-finite → default
clampRunawayMinQueries     → 3…50, default 8, round
clampRunawayBurnUsd        → 0 or ≥ 0.01, max 10_000; non-finite → 0
```

---

## 6. Settings and messages

### 6.1 `package.json` / `CursorCostConfig`

| Key | Type | Default | Notes |
|-----|------|---------|--------|
| `cursorCost.runawayDetector` | boolean | `true` | Master: detect + toast + banner + finding + row flag |
| `cursorCost.runawayWindowMinutes` | number | `10` | 2–60 |
| `cursorCost.runawayMinQueries` | number | `8` | 3–50 |
| `cursorCost.runawayBurnUsd` | number | `0` | `0` = off; save on Apply / Enter / blur |

Place a new Settings fieldset **Runaway detector** after **Critical alert** (warnings family). Checkbox + window + min queries + optional burn. Hint: “Metadata only — does not read the chat and does not stop the agent.”

### 6.2 Host → webview (`HistoryDataPayload`)

```typescript
runawayDetector: boolean
runawayWindowMinutes: number
runawayMinQueries: number
runawayBurnUsd: number
runaway: {
  active: boolean
  queryCount: number
  minutes: number
  costUsd: number
  signals: RunawaySignal[]
  summary: string  // English, e.g. "8 queries in 6 min · 1.20 $"
} | null
```

`HistoryRow` adds `runaway: boolean` (true when fingerprint is in the active episode). TOKENS already prefixes `! ` for spikes — if runaway and not already spiked, prefix `! ` as well when `showSpikeWarning`. If both spike and runaway, a single `!` is enough.

### 6.3 Webview → host

| `type` | Action |
|--------|--------|
| `setRunawayDetector` | boolean |
| `setRunawayWindowMinutes` | number (Apply / Enter / blur) |
| `setRunawayMinQueries` | number |
| `setRunawayBurnUsd` | number |

Persist via `workspace.getConfiguration('cursorCost').update(..., ConfigurationTarget.Global)` like other keys. Overlay patch so the UI updates before settings.json lands.

---

## 7. UI surfaces

### 7.1 Non-modal toast (`src/ui/runawayAlert.ts`)

`vscode.window.showWarningMessage(message, 'Open History', 'Snooze 30 min')` — **no** `{ modal: true }`.

Copy (`src/runaway/alert.ts`):

- Message: `Agent may be looping (8 queries in 6 min, 1.20 $).`
- Detail is not available on non-modal `showWarningMessage`; keep the first line self-contained. Optional second sentence in the message: `Warning only — Cursor will keep running.`

Actions:

- **Open History** → `cursorCost.showHistory` on the **queries** tab (same as a query chip, not Statistics).
- **Snooze 30 min** → `globalState.update(RUNAWAY_SNOOZE_UNTIL_KEY, now + RUNAWAY_SNOOZE_MS)`.
- Dismiss (X) → still `remember` the episode key so it does not spam. A *new* episode (different key) may alert.

Controller pattern: copy `CriticalAlertController` (`showing` re-entrancy guard, subscribe to `UsageService.onDidChange` + config). Store `lastSeenKey` in `RUNAWAY_SEEN_KEY`. Register from `extension.ts` on `context.subscriptions`.

`activate()` must not `await` the toast.

### 7.2 Status bar

When `showSpikeWarning` and episode active: a query chip whose fingerprint is in the episode uses `!` and `warnColor` even if tokens < Warn at. Current/Today chips do **not** turn red solely because of runaway (Today overage is 1.3). Minimal mode: no query chips → no chip `!`; toast + Statistics banner still run.

### 7.3 Last N

- `runaway` rows: `warnColor` on the row when warnings on (same as spike rows).
- Toolbar: optional pill **Looping** next to **Over Warn at**, client-filter `row.runaway`. If that is too much chrome for 1.2, skip the pill and rely on `!` + Statistics banner — **prefer the pill** (Reddit-visible, local filter, no extra column).

### 7.4 Statistics

Banner above the glossary when `runaway.active`: title **Possible agent loop**, body = `runaway.summary` + “Warning only — Cursor will keep running.” Verdict color `--cost-warn` when warnings on, otherwise default card.

### 7.5 Optimize

If episode active, prepend finding `{ id: 'runaway-loop', label: 'Possible loop', detail: summary }`. Do not change prompt templates.

### 7.6 Status-bar Settings preview

Sample chips may show a fake `!` when the runaway checkbox is on **only if** that does not fight the existing sample (example spend, not live). Prefer not to fake a loop in the preview; document “preview unchanged” unless it is trivial.

---

## 8. Implementation steps

| Step | Work | Files |
|------|------|--------|
| 1 | Bump `1.2.0`. Add four `cursorCost.runaway*` keys + markdown descriptions. | `package.json` |
| 2 | Clamps + fields on `CursorCostConfig` / defaults / `cursorCostConfigFrom`. | `src/config.ts` + existing config tests |
| 3 | `detectRunaway`, clamps, `queryInRunaway`. | `src/runaway/detect.ts` + `test/runawayDetect.test.ts` |
| 4 | `decideRunawayAlert` + toast copy. | `detect.ts`, `alert.ts` + `test/runawayDecide.test.ts` |
| 5 | `RunawayAlertController`: toast, snooze, grace, Open History. | `src/ui/runawayAlert.ts`, `src/extension.ts` |
| 6 | Row flag + payload `runaway` + Settings messages. | `historyRows.ts`, `historyPanel.ts` |
| 7 | Last N `!` / Looping filter; Statistics banner; Optimize finding. | `media/history.*`, `optimizeInsights.ts` |
| 8 | Status-bar chip bang for runaway fingerprints. | `statusBarView.ts`, `statusBar.ts` |
| 9 | Settings fieldset Runaway detector (Apply / Enter / blur on numbers). | `media/history.html\|js\|css` |
| 10 | PRD, architecture, snapshot, webview + shared rules. | `.ai/context/*`, `.cursor/rules/*` |

Do not implement Daily Guard, efficiency, advisor, or attribution in this PR.

---

## 9. Tests

Run: `npm test`. Freeze time via injected `nowMs` / query timestamps — no machine clock.

### 9.1 `runawayDetect.test.ts`

- 7 queries in 10 min, minQueries 8 → no episode.
- 8 queries in 10 min → `velocity` only.
- 8 queries spread over 11 min (window 10) → no velocity (oldest outside window).
- 5 consecutive same model, tokens 1000 / 1100 / 1050 / 1000 / 1140 (±15%) → `repeat` even if `minQueries` is 8 and only 5 exist.
- 5 consecutive, tokens 1000 vs 2000 → no repeat.
- Different models, similar tokens → no repeat.
- 3 queries input 1000 → 1600 → 2500 (each ≥ 1.5×) → `balloon`.
- input 0 on the middle query → no balloon.
- `runawayBurnUsd = 0` → never `burn` even if window sum is $10.
- `runawayBurnUsd = 2` and window sum $2.00 → `burn`.
- Empty array → `null`.
- Fingerprints on the episode match `queryFingerprint`.

### 9.2 `runawayDecide.test.ts`

- First load, episode `lastTimestamp` 10 min old → `remember`, not `alert`.
- First load, last query 30 s ago, velocity match → `alert`.
- Same key as `lastSeenKey` → `skip`.
- `enabled: false` + new key → `remember`.
- `nowMs < snoozeUntilMs` → `remember` (not `alert`).
- After snooze expires, new key → `alert`.

### 9.3 Integration (lightweight)

- Payload: `events[].runaway` true only for in-episode rows.
- Config clamps: window `1` → 2; `999` → 60; minQueries `0` → 3.

No fixture with real emails/tokens.

---

## 10. Security

- No cookies, tokens, or emails in toast, payload, or logs.
- Fingerprints are timestamp|tokens|cost|model — already used by critical alert.
- Do not dump raw API events into the Output channel.

---

## 11. Done criteria

- [ ] Version **1.2.0**
- [ ] Non-modal toast once per episode; Snooze 30 min; grace on first load
- [ ] Copy states Cursor keeps running
- [ ] `!` / colors gated by `showSpikeWarning`
- [ ] Statistics banner + optional Optimize finding
- [ ] Settings fieldset; numbers not saved while typing
- [ ] `npm test` + `npm run typecheck`
- [ ] PRD G5 still: only critical alert is blocking
- [ ] No 1.3–1.6 code in the PR
