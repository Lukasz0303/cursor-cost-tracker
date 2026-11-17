import { CONTEXT_FULL_PERCENT } from '../../contextFill/fill'
import { formatTokens } from '../../format'
import { formatDecimal, parseDecimal } from './decimal'
import type { PricingVersion } from './types'

/** OpenAI bills the long-context rate once prompt input exceeds this. */
export const LONG_CONTEXT_INPUT_TOKENS = 272_000

export type ListPrice = {
  model: string
  inputRate: string
  cachedInputRate: string
  outputRate: string
  cacheWriteRate: string | null
}

/**
 * OpenAI standard list prices, short context, USD per 1M tokens.
 * Source: https://developers.openai.com/api/docs/pricing (17 Nov 2026).
 * Cache write is the 30-minute column. Reasoning tokens are billed as output.
 * `codex-auto-review` is not a separate list row; Codex bills it as gpt-5.6-luna.
 */
export const OPENAI_STANDARD_LIST: readonly ListPrice[] = [
  { model: 'gpt-6-astra', inputRate: '10', cachedInputRate: '1', outputRate: '50', cacheWriteRate: '12.5' },
  { model: 'gpt-6.1-sol', inputRate: '2', cachedInputRate: '0.1', outputRate: '10', cacheWriteRate: '2.5' },
  { model: 'gpt-6.1-terra', inputRate: '1', cachedInputRate: '0.05', outputRate: '5', cacheWriteRate: '1.25' },
  { model: 'gpt-6-sol', inputRate: '2', cachedInputRate: '0.2', outputRate: '10', cacheWriteRate: '2.5' },
  { model: 'gpt-6-luna', inputRate: '0.1', cachedInputRate: '0.01', outputRate: '0.5', cacheWriteRate: '0.125' },
  { model: 'codex-auto-review', inputRate: '0.2', cachedInputRate: '0.02', outputRate: '1.2', cacheWriteRate: '0.25' },
  { model: 'gpt-5.6-sol', inputRate: '4', cachedInputRate: '0.4', outputRate: '20', cacheWriteRate: '5' },
  { model: 'gpt-5.6-terra', inputRate: '2', cachedInputRate: '0.2', outputRate: '12', cacheWriteRate: '2.5' },
  { model: 'gpt-5.6-luna', inputRate: '0.2', cachedInputRate: '0.02', outputRate: '1.2', cacheWriteRate: '0.25' },
  { model: 'gpt-5.5', inputRate: '5', cachedInputRate: '0.5', outputRate: '30', cacheWriteRate: null },
  { model: 'gpt-5.4', inputRate: '2.5', cachedInputRate: '0.25', outputRate: '15', cacheWriteRate: null },
]

export function listPriceVersion(price: ListPrice): PricingVersion {
  return {
    id: `openai-list:${price.model}`,
    model: price.model,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    serviceTier: 'standard',
    inputRate: price.inputRate,
    cachedInputRate: price.cachedInputRate,
    outputRate: price.outputRate,
    cacheWriteRate: price.cacheWriteRate,
    reasoningRate: null,
    source: 'openai-list',
  }
}

/** Saved rates win. List prices fill models the user has not priced. */
export function mergeListPrices(catalog: readonly PricingVersion[]): PricingVersion[] {
  const have = new Set(catalog.map((version) => version.model))
  const extra = OPENAI_STANDARD_LIST.filter((price) => !have.has(price.model)).map(
    listPriceVersion,
  )
  return extra.length === 0 ? [...catalog] : [...catalog, ...extra]
}

export type CodexContextMeter = {
  level: 'ok' | 'full' | 'unknown'
  percent: number | null
  windowLabel: string
}

/**
 * Newest-turn share of the session's `model_context_window`.
 * Unknown when the session never recorded a window.
 */
export function codexContextMeter(
  model: string | null | undefined,
  inputTokens: number | null,
  contextWindow: number | null,
): CodexContextMeter {
  if (
    inputTokens === null ||
    !Number.isFinite(inputTokens) ||
    inputTokens < 0 ||
    contextWindow === null ||
    !Number.isFinite(contextWindow) ||
    contextWindow <= 0 ||
    listPriceFor(model) === null
  ) {
    return { level: 'unknown', percent: null, windowLabel: '' }
  }
  const percent = Math.round((inputTokens / contextWindow) * 100)
  return {
    level: percent >= CONTEXT_FULL_PERCENT ? 'full' : 'ok',
    percent,
    windowLabel: formatTokens(contextWindow),
  }
}

function modelParts(model: string): string[] {
  return model.toLowerCase().split(/[^a-z0-9]+/).filter((part) => part !== '')
}

function versionNumber(parts: string[]): number | null {
  const numbers = parts.filter((part) => /^\d+$/.test(part))
  if (numbers.length === 0 || numbers[0] === undefined) {
    return null
  }
  if (numbers.length === 1) {
    return Number(numbers[0])
  }
  const fraction = numbers.slice(1).join('')
  return Number(numbers[0]) + Number(fraction) / 10 ** fraction.length
}

function scoreModelMatch(target: string, candidate: string): number {
  const targetParts = modelParts(target)
  const candidateParts = modelParts(candidate)
  const targetSet = new Set(targetParts)
  let score = 0
  for (const part of candidateParts) {
    if (targetSet.has(part)) {
      score += part.length + 2
    }
  }
  const targetTail = targetParts[targetParts.length - 1]
  const candidateTail = candidateParts[candidateParts.length - 1]
  if (
    targetTail !== undefined &&
    targetTail === candidateTail &&
    !/^\d+$/.test(targetTail)
  ) {
    score += 30
  }
  const targetVersion = versionNumber(targetParts)
  const candidateVersion = versionNumber(candidateParts)
  if (targetVersion !== null && candidateVersion !== null) {
    score += Math.max(0, 20 - Math.abs(targetVersion - candidateVersion) * 4)
  }
  let prefix = 0
  const limit = Math.min(target.length, candidate.length)
  while (prefix < limit && target[prefix] === candidate[prefix]) {
    prefix += 1
  }
  return score + prefix
}

function closestListPrice(model: string): ListPrice | null {
  let best: ListPrice | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (const price of OPENAI_STANDARD_LIST) {
    const score = scoreModelMatch(model, price.model)
    if (best === null || score > bestScore || (score === bestScore && price.model < best.model)) {
      best = price
      bestScore = score
    }
  }
  return best
}

/**
 * Exact slug, a dated snapshot such as `gpt-6-astra-2026-08-01`, or the
 * closest standard-list model. A named model always gets a rate.
 */
export function listPriceFor(model: string | null | undefined): ListPrice | null {
  if (model === null || model === undefined || model.trim() === '') {
    return null
  }
  const exact = OPENAI_STANDARD_LIST.find((price) => price.model === model)
  if (exact) {
    return exact
  }
  let prefixed: ListPrice | null = null
  for (const price of OPENAI_STANDARD_LIST) {
    if (!model.startsWith(`${price.model}-`)) {
      continue
    }
    if (prefixed === null || price.model.length > prefixed.model.length) {
      prefixed = price
    }
  }
  if (prefixed !== null) {
    return prefixed
  }
  return closestListPrice(model)
}

function scaleRate(rate: string, numerator: bigint, denominator: bigint): string {
  return formatDecimal((parseDecimal(rate) * numerator) / denominator)
}

/**
 * Standard list prices jump to the long-context column above 272K input:
 * 2× input and cache, 1.5× output, for the whole request.
 */
export function withLongContext(
  version: PricingVersion,
  inputTokens: number | null,
): PricingVersion {
  if (
    version.source !== 'openai-list' ||
    inputTokens === null ||
    inputTokens <= LONG_CONTEXT_INPUT_TOKENS
  ) {
    return version
  }
  return {
    ...version,
    inputRate: scaleRate(version.inputRate, 2n, 1n),
    cachedInputRate: scaleRate(version.cachedInputRate, 2n, 1n),
    outputRate: scaleRate(version.outputRate, 3n, 2n),
    cacheWriteRate:
      version.cacheWriteRate === null
        ? null
        : scaleRate(version.cacheWriteRate, 2n, 1n),
  }
}
