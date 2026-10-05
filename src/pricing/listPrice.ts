import type { UsageQuery } from '../usage/types'

export type ListPriceSplit = {
  inputUsd: number | null
  outputUsd: number | null
  cacheWriteUsd: number | null
  cacheReadUsd: number | null
  /** Sum of the components that parsed. Null when none parsed. */
  totalUsd: number | null
  pricedTokenShare: number | null
}

export type ListPriceRates = {
  input: number | null
  output: number | null
  cacheWrite: number | null
  cacheRead: number | null
}

function componentUsd(tokens: number, ratePerMillion: number | null): number | null {
  if (ratePerMillion === null) {
    return null
  }
  return (tokens / 1_000_000) * ratePerMillion
}

export function queryListPrice(
  query: Pick<
    UsageQuery,
    'inputTokens' | 'outputTokens' | 'cacheWriteTokens' | 'cacheReadTokens'
  >,
  rates: ListPriceRates,
): ListPriceSplit {
  const inputUsd = componentUsd(query.inputTokens, rates.input)
  const outputUsd = componentUsd(query.outputTokens, rates.output)
  const cacheWriteUsd = componentUsd(query.cacheWriteTokens, rates.cacheWrite)
  const cacheReadUsd = componentUsd(query.cacheReadTokens, rates.cacheRead)

  const parts = [inputUsd, outputUsd, cacheWriteUsd, cacheReadUsd]
  const priced = parts.filter((value): value is number => value !== null)
  const totalUsd = priced.length === 0 ? null : priced.reduce((sum, value) => sum + value, 0)

  const totalTokens =
    query.inputTokens +
    query.outputTokens +
    query.cacheWriteTokens +
    query.cacheReadTokens

  let pricedTokens = 0
  if (inputUsd !== null) {
    pricedTokens += query.inputTokens
  }
  if (outputUsd !== null) {
    pricedTokens += query.outputTokens
  }
  if (cacheWriteUsd !== null) {
    pricedTokens += query.cacheWriteTokens
  }
  if (cacheReadUsd !== null) {
    pricedTokens += query.cacheReadTokens
  }

  const pricedTokenShare =
    totalTokens <= 0 || priced.length === 0 ? null : pricedTokens / totalTokens

  return {
    inputUsd,
    outputUsd,
    cacheWriteUsd,
    cacheReadUsd,
    totalUsd,
    pricedTokenShare,
  }
}

/**
 * Sample total: cache-read tokens × (input rate − cache-read rate).
 * Null when no row had both rates (and a non-inverted spread).
 * Zero is a real result when rates exist but cache-read tokens are 0.
 */
export function cacheDollarsSaved(
  rows: readonly {
    cacheReadTokens: number
    inputPerMillion: number | null
    cacheReadPerMillion: number | null
  }[],
): number | null {
  let sum = 0
  let matched = false
  for (const row of rows) {
    const { inputPerMillion, cacheReadPerMillion, cacheReadTokens } = row
    if (inputPerMillion === null || cacheReadPerMillion === null) {
      continue
    }
    if (cacheReadPerMillion > inputPerMillion) {
      continue
    }
    matched = true
    sum += (cacheReadTokens / 1_000_000) * (inputPerMillion - cacheReadPerMillion)
  }
  return matched ? sum : null
}
