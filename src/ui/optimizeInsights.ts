import { clampHistoryLimit, DEFAULT_HISTORY_LIMIT } from '../historyLimit'
import { catalogFor, interpolate } from '../i18n'
import { DEFAULT_LOCALE, type Locale } from '../locale'
import { stripModelPrefix } from '../usage/parse'
import type { UsageQuery } from '../usage/types'
import {
  DEFAULT_SPIKE_TOKEN_THRESHOLD,
  isSpike,
} from '../spikes/threshold'

const LOW_CACHE_HIT = 30
const HIGH_INPUT_RATIO = 8

export type OptimizeFinding = {
  id: string
  label: string
  detail: string
}

export type OptimizeModelCost = {
  model: string
  costUsd: number
  tokens: number
  queries: number
}

export type OptimizeFocusQuery = {
  model: string
  tokens: number
  costUsd: number
  kind: string
  cacheHitPercent: number | null
}

export type OptimizeInsights = {
  sampleSize: number
  /**
   * Last query at/over Warn at (`spikeTokenThreshold`) — the red `!` focus.
   * Null when no sample query exceeds the setting.
   */
  focus: OptimizeFocusQuery | null
  /** @deprecated Alias of `focus` for older call sites. */
  newest: OptimizeFocusQuery | null
  totalTokens: number
  totalCostUsd: number
  cacheHitPercent: number | null
  spikeCount: number
  spikeSharePercent: number
  topModelsByCost: OptimizeModelCost[]
  avgCostPer1MTokens: number | null
  highInputShare: boolean
  addressableTokens: number
  wasteyQueryCount: number
  findings: OptimizeFinding[]
}

function cacheHitPercent(input: number, cacheRead: number): number | null {
  const prompt = input + cacheRead
  if (prompt <= 0) {
    return null
  }
  return Math.round((cacheRead / prompt) * 100)
}

function queryCacheHit(query: UsageQuery): number | null {
  return cacheHitPercent(query.inputTokens, query.cacheReadTokens)
}

function modelLabel(model: string | null, locale: Locale = DEFAULT_LOCALE): string {
  const stripped = stripModelPrefix(model)
  if (stripped === null || stripped === '') {
    return catalogFor(locale).findings.unknown
  }
  return stripped
}

function kindLabel(kind: string | null): string {
  if (kind === null || kind === '') {
    return '—'
  }
  return kind
}

function isWastey(
  query: UsageQuery,
  spikeTokenThreshold: number,
  cheapModelCeiling: number | null,
): boolean {
  if (isSpike(query.tokens, spikeTokenThreshold)) {
    return true
  }
  const hit = queryCacheHit(query)
  if (hit !== null && hit < LOW_CACHE_HIT) {
    return true
  }
  if (
    cheapModelCeiling !== null &&
    query.costUsd > 0 &&
    query.costUsd > cheapModelCeiling
  ) {
    return true
  }
  return false
}

function cheapModelCeiling(models: OptimizeModelCost[]): number | null {
  if (models.length < 2) {
    return null
  }
  const avgCosts = models
    .map((row) => row.costUsd / Math.max(row.queries, 1))
    .sort((a, b) => a - b)
  const tertileIndex = Math.max(0, Math.floor(avgCosts.length / 3) - 1)
  const ceiling = avgCosts[tertileIndex]
  return ceiling === undefined ? null : ceiling
}

function toFocusQuery(
  query: UsageQuery,
  locale: Locale = DEFAULT_LOCALE,
): OptimizeFocusQuery {
  return {
    model: modelLabel(query.model, locale),
    tokens: query.tokens,
    costUsd: query.costUsd,
    kind: kindLabel(query.kind),
    cacheHitPercent: queryCacheHit(query),
  }
}

/** Newest-first list: first spike at/over Warn at is the Optimize target. */
export function lastRedQuery(
  queries: readonly UsageQuery[],
  spikeTokenThreshold: number,
): UsageQuery | undefined {
  for (const query of queries) {
    if (isSpike(query.tokens, spikeTokenThreshold)) {
      return query
    }
  }
  return undefined
}

export type OptimizeInsightsOptions = {
  historyLimit?: number
  spikeTokenThreshold?: number
  locale?: Locale
}

export function toOptimizeInsights(
  queries: UsageQuery[],
  options?: OptimizeInsightsOptions,
): OptimizeInsights {
  const limit = clampHistoryLimit(
    options?.historyLimit ?? DEFAULT_HISTORY_LIMIT,
  )
  const spikeTokenThreshold =
    options?.spikeTokenThreshold ?? DEFAULT_SPIKE_TOKEN_THRESHOLD
  const locale = options?.locale ?? DEFAULT_LOCALE
  const copy = catalogFor(locale).findings
  const sorted = [...queries]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)

  if (sorted.length === 0) {
    return {
      sampleSize: 0,
      focus: null,
      newest: null,
      totalTokens: 0,
      totalCostUsd: 0,
      cacheHitPercent: null,
      spikeCount: 0,
      spikeSharePercent: 0,
      topModelsByCost: [],
      avgCostPer1MTokens: null,
      highInputShare: false,
      addressableTokens: 0,
      wasteyQueryCount: 0,
      findings: [],
    }
  }

  let totalTokens = 0
  let totalCostUsd = 0
  let input = 0
  let output = 0
  let cacheRead = 0
  let spikeCount = 0
  const byModel = new Map<string, OptimizeModelCost>()

  for (const query of sorted) {
    totalTokens += query.tokens
    totalCostUsd += query.costUsd
    input += query.inputTokens
    output += query.outputTokens
    cacheRead += query.cacheReadTokens
    if (isSpike(query.tokens, spikeTokenThreshold)) {
      spikeCount += 1
    }
    const model = modelLabel(query.model, locale)
    const existing = byModel.get(model)
    if (existing) {
      existing.costUsd += query.costUsd
      existing.tokens += query.tokens
      existing.queries += 1
    } else {
      byModel.set(model, {
        model,
        costUsd: query.costUsd,
        tokens: query.tokens,
        queries: 1,
      })
    }
  }

  const topModelsByCost = [...byModel.values()]
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 3)
  const ceiling = cheapModelCeiling([...byModel.values()])

  let addressableTokens = 0
  let wasteyQueryCount = 0
  for (const query of sorted) {
    if (!isWastey(query, spikeTokenThreshold, ceiling)) {
      continue
    }
    wasteyQueryCount += 1
    addressableTokens += query.tokens
  }

  const redQuery = lastRedQuery(sorted, spikeTokenThreshold)
  const focus = redQuery ? toFocusQuery(redQuery, locale) : null
  const sampleHit = cacheHitPercent(input, cacheRead)
  const highInputShare =
    output > 0 ? input / output >= HIGH_INPUT_RATIO : input > 0 && output === 0
  const spikeSharePercent = Math.round((spikeCount / sorted.length) * 100)
  const avgCostPer1MTokens =
    totalTokens > 0 ? (totalCostUsd / totalTokens) * 1_000_000 : null

  const findings: OptimizeFinding[] = []
  if (focus && redQuery) {
    findings.push({
      id: 'newest-spike',
      label: copy.lastRed,
      detail: interpolate(copy.lastRedDetail, {
        model: focus.model,
        tokens: focus.tokens.toLocaleString('en-US'),
        threshold: spikeTokenThreshold.toLocaleString('en-US'),
      }),
    })
    const focusHit = focus.cacheHitPercent
    if (focusHit !== null && focusHit < LOW_CACHE_HIT) {
      findings.push({
        id: 'newest-low-cache',
        label: copy.lastRedLowCache,
        detail: interpolate(copy.lastRedLowCacheDetail, {
          hit: focusHit,
          limit: LOW_CACHE_HIT,
        }),
      })
    }
  } else {
    findings.push({
      id: 'no-red-query',
      label: copy.noRed,
      detail: interpolate(copy.noRedDetail, {
        n: sorted.length,
        threshold: spikeTokenThreshold.toLocaleString('en-US'),
      }),
    })
  }
  if (spikeCount > 1) {
    findings.push({
      id: 'spikes',
      label: copy.moreSpikes,
      detail: interpolate(copy.moreSpikesDetail, {
        count: spikeCount,
        n: sorted.length,
        threshold: spikeTokenThreshold.toLocaleString('en-US'),
      }),
    })
  }
  const top = topModelsByCost[0]
  const focusModel = focus?.model ?? null
  if (top && top.model !== focusModel) {
    findings.push({
      id: 'top-model',
      label: copy.otherTop,
      detail: interpolate(copy.otherTopDetail, {
        model: top.model,
        cost: top.costUsd.toFixed(2),
        queries: top.queries,
      }),
    })
  }

  return {
    sampleSize: sorted.length,
    focus,
    newest: focus,
    totalTokens,
    totalCostUsd,
    cacheHitPercent: sampleHit,
    spikeCount,
    spikeSharePercent,
    topModelsByCost,
    avgCostPer1MTokens,
    highInputShare,
    addressableTokens,
    wasteyQueryCount,
    findings,
  }
}
