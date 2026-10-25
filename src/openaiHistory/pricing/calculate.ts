import { addDecimal, multiplyRate } from './decimal'
import { costCoverageFor } from './coverage'
import { lookupPricingVersion } from './catalog'
import { listPriceFor, listPriceVersion, mergeListPrices, withLongContext } from './listPrices'
import type { PriceRequestInput, PricedRequest, PricingVersion } from './types'

/**
 * Keep the first stamped tariff when the same response id is imported again.
 */
export function keepExistingPricingVersion(
  existingPricingVersion: string | null | undefined,
  incomingPricingVersion: string | null,
): string | null {
  if (
    typeof existingPricingVersion === 'string' &&
    existingPricingVersion.trim() !== ''
  ) {
    return existingPricingVersion
  }
  return incomingPricingVersion
}

function hasRate(rate: string | null | undefined): rate is string {
  return typeof rate === 'string' && rate.trim() !== ''
}

/**
 * Cached input is part of input, so only `(input - cached)` uses the input rate.
 * Reasoning sits inside output. It is split out only when a reasoning rate exists.
 * Null cached input does not become zero — the caller leaves cost null.
 */
export function computeFormulaCost(input: {
  inputTokens: number
  cachedInputTokens: number
  cacheWriteInputTokens: number | null
  outputTokens: number
  reasoningOutputTokens: number | null
  inputRate: string
  cachedInputRate: string
  outputRate: string
  cacheWriteRate: string | null
  reasoningRate: string | null
}): string {
  const uncached = input.inputTokens - input.cachedInputTokens
  if (uncached < 0) {
    throw new Error('cached input exceeds input')
  }
  const reasoning =
    hasRate(input.reasoningRate) && input.reasoningOutputTokens !== null
      ? input.reasoningOutputTokens
      : 0
  if (reasoning > input.outputTokens) {
    throw new Error('reasoning exceeds output')
  }
  const outputBillable = input.outputTokens - reasoning
  let total = addDecimal(
    addDecimal(
      multiplyRate(uncached, input.inputRate),
      multiplyRate(input.cachedInputTokens, input.cachedInputRate),
    ),
    multiplyRate(outputBillable, input.outputRate),
  )
  const write = input.cacheWriteInputTokens
  if (write !== null && write > 0 && hasRate(input.cacheWriteRate)) {
    total = addDecimal(total, multiplyRate(write, input.cacheWriteRate))
  }
  if (reasoning > 0 && hasRate(input.reasoningRate)) {
    total = addDecimal(total, multiplyRate(reasoning, input.reasoningRate))
  }
  return total
}

function resolveVersion(input: PriceRequestInput): PricingVersion | null {
  const catalog = mergeListPrices(input.catalog)
  const saved = lookupPricingVersion(catalog, input.model, input.observedAt)
  const listed = listPriceFor(input.model)
  const version =
    saved ?? (listed === null ? null : listPriceVersion(listed))
  if (version === null) {
    return null
  }
  return withLongContext(version, input.usage.inputTokens)
}

export function priceRequest(input: PriceRequestInput): PricedRequest {
  const reported =
    input.reportedCostUsd !== null && input.reportedCostUsd.trim() !== ''
      ? input.reportedCostUsd.trim()
      : null

  const empty: PricedRequest = {
    estimatedApiCostUsd: null,
    apiEquivalentCostUsd: null,
    reportedCostUsd: reported,
    pricingVersion: null,
    costCoverage: costCoverageFor({ usage: input.usage, formulaRan: false }),
    formulaBasis: null,
  }

  const version = resolveVersion(input)
  if (version === null) {
    return empty
  }

  const {
    inputTokens: i,
    cachedInputTokens: c,
    outputTokens: o,
    cacheWriteInputTokens: w,
    reasoningOutputTokens: r,
  } = input.usage
  if (i === null || c === null || o === null) {
    return {
      ...empty,
      pricingVersion: null,
      costCoverage: costCoverageFor({ usage: input.usage, formulaRan: false }),
    }
  }

  const cacheWritePriced =
    w !== null && w > 0 && typeof version.cacheWriteRate === 'string' && version.cacheWriteRate.trim() !== ''

  let formula: string
  try {
    formula = computeFormulaCost({
      inputTokens: i,
      cachedInputTokens: c,
      cacheWriteInputTokens: w,
      outputTokens: o,
      reasoningOutputTokens: r,
      inputRate: version.inputRate,
      cachedInputRate: version.cachedInputRate,
      outputRate: version.outputRate,
      cacheWriteRate: version.cacheWriteRate,
      reasoningRate: version.reasoningRate,
    })
  } catch {
    return empty
  }

  const coverage = costCoverageFor({
    usage: input.usage,
    formulaRan: true,
    cacheWritePriced,
  })

  if (input.billingMode === 'api') {
    return {
      estimatedApiCostUsd: formula,
      apiEquivalentCostUsd: null,
      reportedCostUsd: reported,
      pricingVersion: version.id,
      costCoverage: coverage,
      formulaBasis: 'estimated-api',
    }
  }

  if (input.billingMode === 'chatgpt-plan') {
    return {
      estimatedApiCostUsd: null,
      apiEquivalentCostUsd: formula,
      // Keep a file-reported charge; do not invent reported from the tariff.
      reportedCostUsd: reported,
      pricingVersion: version.id,
      costCoverage: coverage,
      formulaBasis: 'api-equivalent',
    }
  }

  // Codex local sessions have no billing field. The number is an API estimate,
  // not an invoice. The plan line in the UI says when it is included.
  return {
    estimatedApiCostUsd: formula,
    apiEquivalentCostUsd: null,
    reportedCostUsd: reported,
    pricingVersion: version.id,
    costCoverage: coverage,
    formulaBasis: 'estimated-api',
  }
}
