import type { CostCoverage, TokenUsage } from '../domain'

function hasAnyTokens(usage: TokenUsage): boolean {
  return (
    usage.inputTokens !== null ||
    usage.cachedInputTokens !== null ||
    usage.cacheWriteInputTokens !== null ||
    usage.outputTokens !== null ||
    usage.reasoningOutputTokens !== null ||
    usage.totalTokens !== null
  )
}

/**
 * `complete` only when the formula ran and cache-write is null or zero.
 * `tokens-only` when usage exists and price is null.
 * `partial` when some of I/C/O is null.
 * `unknown` when usage is missing.
 */
export function costCoverageFor(input: {
  usage: TokenUsage
  formulaRan: boolean
  /** True when a non-zero cache-write count was multiplied by a cache-write rate. */
  cacheWritePriced?: boolean
}): CostCoverage {
  const { usage, formulaRan } = input
  if (!hasAnyTokens(usage)) {
    return 'unknown'
  }
  const i = usage.inputTokens
  const c = usage.cachedInputTokens
  const o = usage.outputTokens
  if (i === null || c === null || o === null) {
    return 'partial'
  }
  if (!formulaRan) {
    return 'tokens-only'
  }
  const write = usage.cacheWriteInputTokens
  if (write !== null && write !== 0 && input.cacheWritePriced !== true) {
    return 'partial'
  }
  return 'complete'
}
