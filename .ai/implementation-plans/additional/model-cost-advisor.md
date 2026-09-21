# v1.5 implementation plan — Model Cost Advisor

**English canonical.** Polish: [model-cost-advisor.pl.md](./model-cost-advisor.pl.md)  
**Parent:** [v1.2-overview.md](./v1.2-overview.md)  
**Status:** ready to implement  
**Depends on:** 1.4.0 preferred so the Statistics card stack is stable. No import of efficiency required.  
**Next:** [project-cost-attribution.md](./project-cost-attribution.md) (1.6.0)  
**Version:** **1.5.0** (MINOR)

If this file and [prd.md](../../context/prd.md) disagree, **the PRD wins**.

Statistics already has spend **by model** ([periodStats.ts](../../../src/ui/periodStats.ts), [modelBreakdown.ts](../../../src/ui/modelBreakdown.ts)). The advisor answers: *for this token-size of turn, which model was cheaper in **your** sample?* It must **never** invent Cursor list prices.

---

## 1. Goal

Show a Statistics card (under spend-by-model) with at most a few **evidence-backed** tips: same token band, ≥ 3 requests per model, ≥ 2 models in that band, ≥ 20% cheaper average $ per request.

**Done when:**

- Pure `adviseModels` + Vitest (no `vscode`, no hardcoded $/1M tables).
- Card + optional Optimize finding; toggle in Settings.
- Empty copy when the sample cannot compare.
- `npm test` / `typecheck` green.

---

## 2. Out of scope

| Item | Why |
|------|-----|
| Official Cursor price list / web scrape | Unofficial, stale, wrong for included vs usage-based |
| Recommending a model the user never used | No evidence |
| Auto-switching models in Cursor | Not an API we should call |
| Status bar | Statistics (+ optional Optimize finding) only |
| Toast / modal | Display-only |
| Kind-only advice without token bands | Band is the “type of work” proxy (no transcript) |

---

## 3. PRD deltas

Statistics: **Model cost advisor** under by-model bars.

- Token bands: `<50k`, `50–500k`, `500k–2M`, `≥2M` (total `UsageQuery.tokens`).
- Per band, group by `stripModelPrefix(model)` (`null` → `unknown`).
- Advice only if **two** models in the band each have **≥ 3** requests.
- Compare **average `costUsd` per request** in that band (not list price). Secondary line: avg tokens and avg cost per 1M in-band (informational).
- Show a tip when the cheaper model’s avg request cost is **≥ 20% lower**.
- Cap **3** tips (highest savings first: `(expensiveAvg - cheapAvg) * cheapCount` is **not** required; sort by **percent saved** then by sample size).
- Toggle `cursorCost.modelAdvisor` (default **true**).
- Copy: `For 50–500k turns, composer-2 averaged 0.12 $ vs claude-4.6-sonnet 0.45 $ (n=8 / n=5).`
- Disclaimer: `Based on your Last N sample, not Cursor’s price list.`

---

## 4. Files

```
src/advisor/bands.ts           # token band id + label
src/advisor/advise.ts          # aggregate + tips
src/config.ts
src/ui/periodStats.ts          # optional: keep by-model as-is
src/ui/historyRows.ts          # payload.advisor
src/ui/optimizeInsights.ts     # optional first finding
src/ui/historyPanel.ts
package.json                   # 1.5.0
media/history.html|css|js
test/advisorBands.test.ts
test/adviseModels.test.ts
```

Update PRD, architecture, snapshot, webview rule.

---

## 5. Types and algorithm

```typescript
export const ADVISOR_MIN_REQUESTS = 3
export const ADVISOR_MIN_MODELS = 2
export const ADVISOR_MIN_SAVINGS_RATIO = 0.2 // 20%
export const ADVISOR_MAX_TIPS = 3

export type TokenBandId = 'micro' | 'small' | 'medium' | 'large'

export type TokenBand = {
  id: TokenBandId
  label: string // "50–500k"
  minTokens: number // inclusive
  maxTokens: number | null // exclusive; null = no upper bound
}

export const TOKEN_BANDS: readonly TokenBand[] = [
  { id: 'micro', label: '<50k', minTokens: 0, maxTokens: 50_000 },
  { id: 'small', label: '50–500k', minTokens: 50_000, maxTokens: 500_000 },
  { id: 'medium', label: '500k–2M', minTokens: 500_000, maxTokens: 2_000_000 },
  { id: 'large', label: '≥2M', minTokens: 2_000_000, maxTokens: null },
]

export type AdvisorModelStats = {
  model: string
  requests: number
  costUsd: number
  tokens: number
  avgCostUsd: number
  avgCostPer1M: number | null
}

export type AdvisorTip = {
  bandId: TokenBandId
  bandLabel: string
  cheaper: AdvisorModelStats
  expensive: AdvisorModelStats
  savingsRatio: number // (exp - cheap) / exp, 0–1
  summary: string
}

export type AdvisorPayload = {
  empty: boolean
  emptyReason: string | null
  tips: AdvisorTip[]
  note: string
}
```

### 5.1 Band assignment

`bandForTokens(tokens: number): TokenBand`  
`50_000` belongs to **small** (min inclusive, max exclusive). Negative / NaN tokens → skip the query.

### 5.2 Aggregate

For each band, Map model → { requests, costUsd, tokens }. Drop models with `requests < 3`. Drop bands with `< 2` remaining models.

### 5.3 Tips

For each remaining band:

- Sort models by `avgCostUsd` ascending.
- `cheaper = models[0]`, `expensive = models[models.length - 1]` (widest gap). If more than two, still one tip per band: cheapest vs **most expensive** (clearest Reddit story). Do not emit a tip for every pair (noise).
- `savingsRatio = (expensive.avgCostUsd - cheaper.avgCostUsd) / expensive.avgCostUsd` when expensive avg > 0.
- If `savingsRatio < 0.2` skip the band.
- If both avgs are 0 (included $0 events) skip — no dollar lesson.

Sort tips by `savingsRatio` desc, then by `cheaper.requests + expensive.requests` desc. Slice to 3.

`summary`:  
`For ${bandLabel} turns, ${cheaper.model} averaged ${formatDollars(cheaper.avgCostUsd)} vs ${expensive.model} ${formatDollars(expensive.avgCostUsd)} (n=${cheaper.requests} / n=${expensive.requests}).`

`note`: `Based on your Last N sample, not Cursor’s price list.`

Empty reasons:

- no queries → `No queries in this sample.`
- only one model overall → `Need at least two models in the same size band.`
- models exist but no band has 2× ≥3 requests → `Need at least 3 requests per model in the same size band.`
- bands compare but savings < 20% → `Models in the same size band cost about the same in this sample.`

### 5.4 Included vs usage-based

Do **not** split tips by `kind` in 1.5 (included $0 vs usage-based would make “cheaper” trivial). Using **average $ per request** already treats $0 included models as cheaper — that is honest for the user’s bill. Mention in the card hint: included requests can show as 0.00 $.

---

## 6. Settings and messages

| Key | Type | Default |
|-----|------|---------|
| `cursorCost.modelAdvisor` | boolean | `true` |

Settings: checkbox on the **Efficiency** fieldset **or** a tiny **Advisor** fieldset under Statistics-related settings. Prefer **one fieldset “Insights”** that contains Efficiency (if 1.4 present) + Model advisor checkbox — only if that does not rewrite 1.4 Settings more than a one-line add. Otherwise a standalone **Model advisor** fieldset after Efficiency.

When off: `advisor: null`, hide card and Optimize finding.

| `type` | Action |
|--------|--------|
| `setModelAdvisor` | boolean |

Payload: `modelAdvisor: boolean`, `advisor: AdvisorPayload | null`.

---

## 7. UI surfaces

### 7.1 Statistics

Card **Model cost advisor** **below** by-model bars (natural extension). List `tips[].summary`. Footer `note`. Empty: body = `emptyReason`.

No new chart.

### 7.2 Optimize

If `tips[0]` exists, append finding `{ id: 'model-advisor', label: 'Cheaper model in sample', detail: tips[0].summary }`. Do not change prompt templates.

### 7.3 Status bar / Last N / toast

No change.

---

## 8. Implementation steps

| Step | Work | Files |
|------|------|--------|
| 1 | Bump `1.5.0`. Key `modelAdvisor`. | `package.json` |
| 2 | Config boolean. | `config.ts` |
| 3 | Bands + assignment tests (boundaries 49999 / 50000 / 2M). | `src/advisor/bands.ts` |
| 4 | `adviseModels` empty + tip cases. | `src/advisor/advise.ts` + tests |
| 5 | Payload + Statistics render. | `historyRows.ts`, `media/history.*` |
| 6 | Optional Optimize finding. | `optimizeInsights.ts` or `optimizePayload.ts` |
| 7 | Settings checkbox. | `media/history.*`, `historyPanel.ts` |
| 8 | PRD, architecture, snapshot, webview rule. | `.ai/context/*` |

Do not add attribution or CSV columns. Do not add a prices.ts with invented rates.

---

## 9. Tests

Use `formatDollars` in expected summaries or assert structured `AdvisorTip` fields and separately snapshot the summary helper.

- `bandForTokens(0)` micro; `49999` micro; `50000` small; `499999` small; `500000` medium; `1999999` medium; `2000000` large.
- Two models × 3 requests in small band, avgs $0.10 vs $0.50 → one tip, ratio 0.8, cheaper name matches.
- Same but 2 requests on the cheap model → no tip (min 3).
- One model only → empty reason “two models”.
- Both avgs $0 → no tip.
- 10% savings → no tip (`< 0.2`).
- Four bands with tips → only 3 returned, highest ratio first.
- `unknown` model label when `model === null`.

No network. No price table.

---

## 10. Security

Model names from the usage API (already shown in Last N). Escape in the webview the same way as by-model labels. No emails.

---

## 11. Done criteria

- [ ] Version **1.5.0**
- [ ] Tips only from user sample; no invented prices
- [ ] Min 3 requests × 2 models × 20% savings; max 3 tips
- [ ] Statistics card under by-model; optional Optimize finding
- [ ] Empty states covered
- [ ] `npm test` + `typecheck`
- [ ] No 1.6 code
