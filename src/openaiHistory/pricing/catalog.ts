import type { PricingVersion } from './types'

/** Production ships with no seeded rates. */
export const EMPTY_CATALOG: readonly PricingVersion[] = []

/** Acceptance fixture: 2 / 0.5 / 8 per million → 0.16 on I=100000, C=80000, O=10000. */
export const FIXTURE_PRICING_VERSION_ID = 'fixture-gpt-0.16'

export function fixturePricingVersion(
  overrides: Partial<PricingVersion> = {},
): PricingVersion {
  return {
    id: FIXTURE_PRICING_VERSION_ID,
    model: 'gpt-fixture',
    effectiveFrom: '2020-01-01T00:00:00.000Z',
    serviceTier: null,
    inputRate: '2',
    cachedInputRate: '0.5',
    outputRate: '8',
    cacheWriteRate: null,
    reasoningRate: null,
    source: 'fixture',
    ...overrides,
  }
}

/**
 * Exact model string + latest `effectiveFrom` still ≤ `observedAt`.
 * No fuzzy match onto Cursor model names.
 */
export function lookupPricingVersion(
  catalog: readonly PricingVersion[],
  model: string | null,
  observedAt: string,
): PricingVersion | null {
  if (model === null || model.trim() === '') {
    return null
  }
  const observedMs = Date.parse(observedAt)
  if (!Number.isFinite(observedMs)) {
    return null
  }
  let best: PricingVersion | null = null
  let bestMs = Number.NEGATIVE_INFINITY
  for (const version of catalog) {
    if (version.model !== model) {
      continue
    }
    const fromMs = Date.parse(version.effectiveFrom)
    if (!Number.isFinite(fromMs) || fromMs > observedMs) {
      continue
    }
    if (fromMs >= bestMs) {
      best = version
      bestMs = fromMs
    }
  }
  return best
}
