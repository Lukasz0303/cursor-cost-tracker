# Phase 4 — Tariff

**Parent:** [openai-codex.md](./openai-codex.md) §5 and decisions 20–22
**Status:** ready to implement
**Depends on:** [phase-3a-query.md](./phase-3a-query.md) for row labels. Stats from phase 3d will pick up stored strings without a rewrite.
**Next:** [phase-5-recorder.md](./phase-5-recorder.md) (later minor, not this release)
**Polish:** [phase-4-pricing.pl.md](./phase-4-pricing.pl.md)
**Release:** 1.1.0. Do not bump `package.json` in this turn. Shipping with an empty catalog and cost `—` is acceptable when tokens are right.

If this file and the parent plan disagree, **the parent plan wins**. If either disagrees with the PRD, **the PRD wins**.

One Agent message. Touch only the paths in §3.

---

## 1. Goal

Price a request from an explicit tariff version. Missing rate stays `—`. A ChatGPT-plan row priced from an API tariff is labeled API-equivalent. Estimated API, reported organization cost, and API-equivalent never share one total.

**Done when:**

- Fixture rates 2 / 0.5 / 8 per million, I=100000, C=80000, O=10000, R=2000 → decimal **0.16** (acceptance 6).
- Unknown model or a missing rate leaves the cost null and `cost_coverage` is not `complete`.
- `billingMode = chatgpt-plan` keeps `reportedCostUsd` null unless the row already has a reported charge. The API-tariff figure is stored as the API-equivalent basis, not as estimated API and not as reported.
- The request row keeps `pricingVersion`.
- `npm test` is green for `test/openaiHistoryPricing.test.ts`.

---

## 2. Out of scope

| Item | When |
|------|------|
| A default map from a Codex model name onto the Cursor price catalog | never |
| Organization Costs API | phase 6 |
| Rewriting historical rows when a tariff changes | a deliberate reprice is a later version. This phase stamps the version it used. |
| Live network fetch of the price list | the catalog in this phase is a checked-in table and may be empty |

---

## 3. Files

```
src/openaiHistory/pricing/decimal.ts
src/openaiHistory/pricing/types.ts
src/openaiHistory/pricing/catalog.ts
src/openaiHistory/pricing/calculate.ts
src/openaiHistory/pricing/coverage.ts
src/openaiHistory/store/migrations.ts
test/openaiHistoryPricing.test.ts
```

`migrations.ts` only appends migration **2**: table `pricing_versions`. Do not edit migration 1.

---

## 4. Decimal (`decimal.ts`)

Money is a fixed-scale integer (scale **6** decimal places) held as a decimal string. No binary float on the stored value.

```typescript
export function multiplyRate(tokens: number, ratePerMillion: string): string
export function addDecimal(a: string, b: string): string
export function formatCostCell(value: string | null): string
```

`formatCostCell` is the only place that rounds to two places. Non-zero values that round to `0.00` return the cell text `< $0.01`. Null returns `—`.

Formula, applied only when I, C, and O are numbers and all three rates exist:

```text
((I - C) × inputRate + C × cachedInputRate + O × outputRate) / 1_000_000
```

R is not an extra term. Null C does not become zero: the cost is null. Non-zero `cache_write_input_tokens` does not enter the formula; coverage stays short of `complete`.

---

## 5. Catalog and calculate

```typescript
export type PricingVersion = {
  id: string
  model: string
  effectiveFrom: string
  serviceTier: string | null
  inputRate: string
  cachedInputRate: string
  outputRate: string
  source: 'fixture' | 'manual' | 'empty'
}

export function priceRequest(input: {
  model: string | null
  billingMode: BillingMode
  usage: TokenUsage
  reportedCostUsd: string | null
  catalog: readonly PricingVersion[]
  observedAt: string
}): PricedRequest
```

Lookup is exact model string plus the version whose `effectiveFrom` is the latest one still ≤ `observedAt`. No fuzzy match onto a Cursor model. An empty catalog returns null prices.

| `billingMode` | Stored result |
|---------------|----------------|
| `api` | `estimatedApiCostUsd` set, basis estimated-api, `reportedCostUsd` unchanged |
| `chatgpt-plan` | `reportedCostUsd` stays null unless `input.reportedCostUsd` is non-null. The formula result is returned on an `apiEquivalentCostUsd` field. The row label in phase 3a is `API-equiv. $…`. |
| `unknown` | Formula result is not shown as a charge. Cost cell stays `—` unless a reported amount exists. |

`coverage.ts`: `complete` only when the formula ran and cache-write is null or zero. `tokens-only` when usage exists and price is null. `partial` when some of I/C/O is null. `unknown` when usage is missing.

The importer calls `priceRequest` when it inserts a request. A second import of the same response id does not replace `pricingVersion` already stored.

---

## 6. Migration 2

`pricing_versions(id TEXT PRIMARY KEY, model TEXT NOT NULL, effective_from TEXT NOT NULL, service_tier TEXT, input_rate TEXT NOT NULL, cached_input_rate TEXT NOT NULL, output_rate TEXT NOT NULL, source TEXT NOT NULL)`.

Seed nothing in production. Tests insert the 2 / 0.5 / 8 fixture version.

---

## 7. Tests

- 0.16 fixture, string compare on the scale-6 decimal (`0.160000` or the module’s canonical form — lock one in the test).
- Null C → null cost.
- Missing model → null cost, coverage `tokens-only`.
- `chatgpt-plan` with a matching tariff → API-equivalent set, `reportedCostUsd` null, label helper returns a string that starts with `API-equiv.`.
- `chatgpt-plan` with a file-reported charge → that charge stays on `reportedCostUsd` and is not added to the equivalent.
- Cache-write non-zero → coverage is not `complete`.
- Empty catalog → null cost.
- Re-applying the same response id keeps the first `pricingVersion`.

---

## 8. Handoff

1.1.0 can ship after this phase once the release turn updates the PRD, architecture, security, README, changelog, and the codebase snapshot, then packages in its own message. Phases 5–7 stay unstarted.
