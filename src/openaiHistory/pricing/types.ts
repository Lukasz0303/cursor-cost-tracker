import type { BillingMode, CostCoverage, TokenUsage } from '../domain'

export type PricingSource = 'fixture' | 'manual' | 'empty' | 'openai-list'

export type PricingVersion = {
  id: string
  model: string
  effectiveFrom: string
  serviceTier: string | null
  inputRate: string
  cachedInputRate: string
  outputRate: string
  /** Dollars per 1M cache-write tokens. Null means the term is omitted. */
  cacheWriteRate: string | null
  /** Dollars per 1M reasoning tokens. Null means reasoning stays inside output. */
  reasoningRate: string | null
  source: PricingSource
}

export type PricedRequest = {
  estimatedApiCostUsd: string | null
  apiEquivalentCostUsd: string | null
  reportedCostUsd: string | null
  pricingVersion: string | null
  costCoverage: CostCoverage
  /** Which stored basis carries the formula result, if any. */
  formulaBasis: 'estimated-api' | 'api-equivalent' | null
}

export type PriceRequestInput = {
  model: string | null
  billingMode: BillingMode
  usage: TokenUsage
  reportedCostUsd: string | null
  catalog: readonly PricingVersion[]
  observedAt: string
}

export type { BillingMode, CostCoverage, TokenUsage }
