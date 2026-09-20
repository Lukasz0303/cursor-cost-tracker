# v1.4 implementation plan — Cost Efficiency Score

**English canonical.** Polish: [cost-efficiency-score.pl.md](./cost-efficiency-score.pl.md)  
**Parent:** [v1.2-overview.md](./v1.2-overview.md)  
**Status:** ready to implement  
**Depends on:** 1.3.0 preferred (sequential MINOR). No import of daily-guard or runaway required.  
**Next:** [model-cost-advisor.md](./model-cost-advisor.md) (1.5.0)  
**Version:** **1.4.0** (MINOR)

If this file and [prd.md](../../context/prd.md) disagree, **the PRD wins**.

The usage API has **no task boundary**. Efficiency is **relative to this user’s Last N sample**, not a claim that a task was solved. Do not compete with Optimize’s `.ai/optimize-savings.md` projection.

---

## 1. Goal

On Statistics, show a **0–100 Cost efficiency score** for the **latest session** (queries clustered by idle gap) compared with the user’s own median sessions in the same Last N / From-date sample.

**Done when:**

- Pure `clusterSessions` + `scoreEfficiency` have Vitest coverage (no `vscode`).
- Statistics card: score, one-sentence verdict, four component bars; empty state when the sample is too small.
- **Not** on the status bar (too dense).
- Settings: toggle + idle minutes; `npm test` / `typecheck` green.
- Copy never says “task complete” or “you wasted $X” as a fixed heuristic.

---

## 2. Out of scope

| Item | Why |
|------|-----|
| Status-bar chip for the score | Overcrowded; Statistics only |
| Chat / “was the task solved?” | No transcript |
| Absolute industry benchmark | Score is **relative** to this user |
| Replacing Optimize savings | Lifetime / mid projection stay as they are |
| Toasts / modal | Display-only |
| Changing Last N table columns | No |

---

## 3. PRD deltas

Statistics tab: after cycle facts / before or beside Last N sample metrics, a **Cost efficiency** card.

- Sessions = consecutive queries with gap ≤ `cursorCost.efficiencyIdleMinutes` (default **15**, 5–120).
- Score 0–100 for the **newest** session vs the distribution of sessions in the sample.
- Components (equal weight): cache hit, cost per 1M tokens, spike share, session $ vs median $ of similar-size sessions (token total ±50%).
- Empty: fewer than **5** queries or fewer than **2** sessions → `Need more queries in this sample to score efficiency.`
- Toggle `cursorCost.efficiencyScore` (default **true**).
- Independent of Optimize. Not a run-out forecast.

---

## 4. Files

```
src/efficiency/sessions.ts     # cluster by idle gap
src/efficiency/score.ts        # components + 0–100
src/config.ts
src/ui/periodStats.ts          # card on stats payload
src/ui/historyRows.ts          # payload.efficiency
src/ui/historyPanel.ts
package.json                   # 1.4.0
media/history.html|css|js      # Statistics card + Settings fieldset
test/efficiencySessions.test.ts
test/efficiencyScore.test.ts
```

No new host toast controller. No `extension.ts` change unless config watch already rebuilds the panel (it does via `onDidChangeConfiguration` — verify; hook payload in `historyDataPayload` only).

Update PRD, architecture, snapshot, webview rule.

---

## 5. Types and algorithm

```typescript
export const DEFAULT_EFFICIENCY_IDLE_MINUTES = 15
export const MIN_EFFICIENCY_IDLE_MINUTES = 5
export const MAX_EFFICIENCY_IDLE_MINUTES = 120
export const MIN_EFFICIENCY_QUERIES = 5
export const MIN_EFFICIENCY_SESSIONS = 2
export const SIMILAR_SIZE_RATIO = 0.5 // ±50% tokens

export type QuerySession = {
  queries: UsageQuery[] // oldest → newest inside the session
  firstTimestamp: number
  lastTimestamp: number
  costUsd: number
  tokens: number
  cacheHitPercent: number | null
  spikeSharePercent: number
  costPer1M: number | null
}

export type EfficiencyComponent = {
  id: 'cacheHit' | 'costPer1M' | 'spikeShare' | 'sessionCost'
  label: string
  value: string
  score: number // 0–100 contribution before weight; store 0–100 per component
  hint: string
}

export type EfficiencyPayload = {
  empty: boolean
  emptyReason: string | null
  score: number | null          // 0–100 integer
  verdict: 'ok' | 'tight' | 'over' | null
  summary: string
  sessionQueryCount: number
  sessionCount: number
  idleMinutes: number
  components: EfficiencyComponent[]
}
```

### 5.1 Cluster (`clusterSessions`)

1. Sort queries **oldest first**.
2. Start a session with the first query.
3. If `next.timestamp - last.timestamp <= idleMinutes * 60_000`, append; else start a new session.
4. Ignore non-finite timestamps (should not appear after parse).
5. Return sessions oldest-first; **latest session = last element**.

Single query → one session of length 1.

Cache hit per session: `sum(cacheRead) / sum(input + cacheRead)` as percent, or `null` if denominator 0.

Spike share: `count(isSpike(tokens, spikeTokenThreshold)) / queryCount * 100`.

`costPer1M`: `tokens > 0 ? costUsd / tokens * 1e6 : null`.

### 5.2 Score (`scoreEfficiency`)

If `queries.length < 5` or `sessions.length < 2` → `{ empty: true, ... }`.

**Latest session** is the one with the greatest `lastTimestamp`.

For each component, compute a 0–100 **rank vs other sessions** (higher = better efficiency):

| Component | Raw | Better | Score |
|-----------|-----|--------|--------|
| cacheHit | session cache % | higher | percentile vs sessions that have non-null cache (if none, component score 50 / omit from average — **prefer 50**) |
| costPer1M | USD per 1M tokens | lower | inverse percentile vs sessions with non-null costPer1M |
| spikeShare | % of spike queries | lower | inverse percentile |
| sessionCost | session `costUsd` | lower | inverse percentile vs **similar-size** sessions only (`tokens` within ±50% of latest). If `< 2` peers including self → component 50 |

Percentile: among `n` values, rank `r` from worst=0 to best=n-1, score = `round(100 * r / max(n-1, 1))`. Ties: average rank.

**Overall:** mean of four component scores, rounded 0–100.

**Verdict (display only):** `>= 70` `ok`; `>= 40` `tight`; else `over`. Colors follow `showSpikeWarning` (when off, card uses default text, still shows the number).

**Summary examples (English):**

- ok: `Latest session scores 82 vs your other sessions in this sample.`
- tight: `Latest session scores 51 — near your usual cost mix.`
- over: `Latest session scores 28 — more expensive / less cache than your usual sessions.`

Always append that this is relative to Last N, not a task grade.

### 5.3 Clamps

`clampEfficiencyIdleMinutes`: 5–120, default 15, round.

---

## 6. Settings and messages

| Key | Type | Default |
|-----|------|---------|
| `cursorCost.efficiencyScore` | boolean | `true` |
| `cursorCost.efficiencyIdleMinutes` | number | `15` |

Settings fieldset **Efficiency** after Optimize (analytic, not a warning). Checkbox + idle minutes (Apply / Enter / blur). Hint: “Groups queries into sessions when the gap is larger than this. The score compares your latest session with your other sessions — it does not read the chat.”

When the toggle is off: `efficiency` payload still may be `null`; hide the Statistics card.

### 6.1 Payload

`efficiency: EfficiencyPayload | null` (`null` when setting off).

No new webview → host types except:

| `type` | Action |
|--------|--------|
| `setEfficiencyScore` | boolean |
| `setEfficiencyIdleMinutes` | number |

---

## 7. UI surfaces

### 7.1 Statistics card

- Title: **Cost efficiency**
- Hero: integer score or `—` if empty
- Verdict word: Efficient / Typical / Costly (`ok` / `tight` / `over`)
- Body: `summary`
- Four compact meters (component label + value + bar)
- Empty: muted body only, no fake 0

Use existing glossary / sample card CSS (`--vscode-*`, ghost cards). Do not add a Charts series.

### 7.2 Status bar / Last N / toast

No change.

### 7.3 Optimize

Do **not** add a finding (Optimize stays last-red-query). Optional later PATCH.

---

## 8. Implementation steps

| Step | Work | Files |
|------|------|--------|
| 1 | Bump `1.4.0`. Keys `efficiencyScore`, `efficiencyIdleMinutes`. | `package.json` |
| 2 | Config clamps. | `config.ts` |
| 3 | `clusterSessions` + session aggregates. | `src/efficiency/sessions.ts` + tests |
| 4 | `scoreEfficiency` percentiles + empty states. | `src/efficiency/score.ts` + tests |
| 5 | `stats` / top-level `efficiency` on payload. | `historyRows.ts`, `periodStats.ts` (or build in `score.ts` and attach in `historyDataPayload`) |
| 6 | Statistics card render. | `media/history.js` + `history.css` + `history.html` placeholder |
| 7 | Settings fieldset. | `media/history.*`, `historyPanel.ts` |
| 8 | PRD, architecture, snapshot, webview rule. | `.ai/context/*` |

Do not add advisor or attribution in this PR. Leave Statistics card **slot** so 1.5 can sit under spend-by-model without a layout fight (efficiency near Last N sample metrics).

---

## 9. Tests

Inject timestamps. Do not use `Date.now()`.

### 9.1 Sessions

- Two queries 14 min apart, idle 15 → **one** session.
- Two queries 16 min apart → **two** sessions.
- Three queries 0, 10 min, 40 min → sessions of 2 + 1.
- Empty → `[]`.
- Order inside session oldest → newest even if input was newest-first.

### 9.2 Score

- 4 queries → empty (`MIN_EFFICIENCY_QUERIES`).
- 5 queries, 1 session (all close) → empty (`MIN_EFFICIENCY_SESSIONS`).
- Two sessions: latest has cache 90% vs earlier 10%, lower costPer1M, 0 spikes, similar tokens → score **high** (≥ 70) with deterministic fixtures.
- Inverse fixture → score **low** (≤ 40).
- Similar-size: a 100-token session is not a peer of a 10M-token session for `sessionCost`.
- Idle clamp: `4` → 5; `200` → 120.

---

## 10. Security

Score uses only tokens/cost/cache already on `UsageQuery`. No paths, emails, or prompts.

---

## 11. Done criteria

- [ ] Version **1.4.0**
- [ ] Relative 0–100 score + four components + empty state
- [ ] Statistics only; no toast, no status-bar chip, no modal
- [ ] Copy: relative to sample, not “task solved”
- [ ] Settings toggle + idle minutes
- [ ] `npm test` + `typecheck`
- [ ] No 1.5–1.6 code
