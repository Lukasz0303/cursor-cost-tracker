import {
  formatCompactTokens,
  formatDateTime,
  formatDollarSign,
  formatTokens,
} from '../format'
import { catalogFor, interpolate } from '../i18n'
import { DEFAULT_LOCALE, type Locale } from '../locale'
import { stripModelPrefix } from '../usage/parse'
import type { UsageQuery } from '../usage/types'

export const DEFAULT_CRITICAL_TOKEN_THRESHOLD = 10_000_000
export const MIN_CRITICAL_TOKEN_THRESHOLD = 1_000
export const DEFAULT_CRITICAL_COST_USD_THRESHOLD = 5
export const MIN_CRITICAL_COST_USD_THRESHOLD = 0.01
/** First-seen historical queries older than this do not open a modal. */
export const DEFAULT_CRITICAL_ALERT_GRACE_MS = 5 * 60_000

export const CRITICAL_ALERT_SEEN_KEY = 'cursorCost.lastCriticalSeenKey'
export const CRITICAL_ALERT_STATE_KEY = 'cursorCost.lastCriticalAlertKey'
/** Timestamp of the last query that already showed (or was Ignored on) the critical modal. */
export const CRITICAL_ALERT_ALERTED_TS_KEY = 'cursorCost.lastCriticalAlertedTimestamp'

export type CriticalAlertThresholds = {
  tokenThreshold: number
  costUsdThreshold: number
}

export type CriticalBreach = {
  tokens: boolean
  cost: boolean
}

export type CriticalAlertCopy = {
  message: string
  detail: string
}

export type CriticalAlertDecision =
  | { kind: 'skip' }
  | { kind: 'remember'; key: string }
  | {
      kind: 'alert'
      query: UsageQuery
      key: string
      breach: CriticalBreach
    }

export function clampCriticalTokenThreshold(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_CRITICAL_TOKEN_THRESHOLD
  }
  return Math.max(MIN_CRITICAL_TOKEN_THRESHOLD, Math.round(value))
}

export function clampCriticalCostUsdThreshold(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_CRITICAL_COST_USD_THRESHOLD
  }
  const rounded = Math.round(value * 100) / 100
  return Math.max(MIN_CRITICAL_COST_USD_THRESHOLD, rounded)
}

export function queryFingerprint(query: UsageQuery): string {
  return `${query.timestamp}|${query.tokens}|${query.costUsd}|${query.model ?? ''}`
}

export function newestQuery(
  queries: readonly UsageQuery[],
): UsageQuery | undefined {
  let newest: UsageQuery | undefined
  for (const query of queries) {
    if (newest === undefined || query.timestamp > newest.timestamp) {
      newest = query
    }
  }
  return newest
}

export function criticalBreach(
  query: UsageQuery,
  thresholds: CriticalAlertThresholds,
): CriticalBreach {
  const tokens =
    Number.isFinite(query.tokens) &&
    Number.isFinite(thresholds.tokenThreshold) &&
    query.tokens >= thresholds.tokenThreshold
  const cost =
    Number.isFinite(query.costUsd) &&
    Number.isFinite(thresholds.costUsdThreshold) &&
    query.costUsd >= thresholds.costUsdThreshold
  return { tokens, cost }
}

export function isCriticalQuery(
  query: UsageQuery,
  thresholds: CriticalAlertThresholds,
): boolean {
  const breach = criticalBreach(query, thresholds)
  return breach.tokens || breach.cost
}

/** Newest query that breaches critical thresholds (not necessarily the absolute newest). */
export function newestCriticalQuery(
  queries: readonly UsageQuery[],
  thresholds: CriticalAlertThresholds,
): UsageQuery | undefined {
  let newest: UsageQuery | undefined
  for (const query of queries) {
    if (!isCriticalQuery(query, thresholds)) {
      continue
    }
    if (newest === undefined || query.timestamp > newest.timestamp) {
      newest = query
    }
  }
  return newest
}

/** Extreme enough that late API delivery should still block (skip first-load grace). */
export function isExtremeCriticalBreach(
  query: UsageQuery,
  thresholds: CriticalAlertThresholds,
): boolean {
  const tokenFloor = thresholds.tokenThreshold * 2
  const costFloor = thresholds.costUsdThreshold * 2
  return (
    (Number.isFinite(query.tokens) && query.tokens >= tokenFloor) ||
    (Number.isFinite(query.costUsd) && query.costUsd >= costFloor)
  )
}

export function decideCriticalAlert(input: {
  queries: readonly UsageQuery[]
  thresholds: CriticalAlertThresholds
  enabled: boolean
  lastSeenKey: string | undefined
  /** When set, do not re-alert the same query if API later revises tokens/cost. */
  lastAlertedTimestamp?: number
  nowMs?: number
  graceMs?: number
}): CriticalAlertDecision {
  const newest = newestQuery(input.queries)
  if (newest === undefined) {
    return { kind: 'skip' }
  }
  const newestKey = queryFingerprint(newest)
  const critical = newestCriticalQuery(input.queries, input.thresholds)

  if (critical === undefined) {
    if (newestKey === input.lastSeenKey) {
      return { kind: 'skip' }
    }
    return { kind: 'remember', key: newestKey }
  }

  const criticalKey = queryFingerprint(critical)
  const alreadyAlerted =
    input.lastAlertedTimestamp !== undefined &&
    critical.timestamp === input.lastAlertedTimestamp
  if (alreadyAlerted || criticalKey === input.lastSeenKey) {
    if (newestKey === input.lastSeenKey) {
      return { kind: 'skip' }
    }
    return { kind: 'remember', key: newestKey }
  }

  if (!input.enabled) {
    return { kind: 'remember', key: criticalKey }
  }

  const breach = criticalBreach(critical, input.thresholds)
  const nowMs = input.nowMs ?? Date.now()
  const graceMs =
    input.graceMs === undefined
      ? DEFAULT_CRITICAL_ALERT_GRACE_MS
      : input.graceMs
  const isFirstSeen = input.lastSeenKey === undefined
  const ageMs = nowMs - critical.timestamp
  if (
    isFirstSeen &&
    ageMs > graceMs &&
    !isExtremeCriticalBreach(critical, input.thresholds)
  ) {
    return { kind: 'remember', key: criticalKey }
  }
  return { kind: 'alert', query: critical, key: criticalKey, breach }
}

function modelLabel(model: string | null, locale: Locale): string {
  const stripped = stripModelPrefix(model)
  if (stripped === null || stripped.trim() === '') {
    return catalogFor(locale).alerts.unknownModel
  }
  return stripped
}

export function formatCriticalAlertCopy(
  query: UsageQuery,
  thresholds: CriticalAlertThresholds,
  breach: CriticalBreach,
  locale: Locale = DEFAULT_LOCALE,
): CriticalAlertCopy {
  const compact = formatCompactTokens(query.tokens)
  const exact = formatTokens(query.tokens)
  const cost = formatDollarSign(query.costUsd)
  const tokenLimit = formatCompactTokens(thresholds.tokenThreshold)
  const costLimit = formatDollarSign(thresholds.costUsdThreshold)
  const copy = catalogFor(locale).alerts

  let reason = interpolate(copy.exceedsBoth, { tokenLimit, costLimit })
  if (breach.tokens && !breach.cost) {
    reason = interpolate(copy.exceedsTokens, { tokenLimit })
  } else if (breach.cost && !breach.tokens) {
    reason = interpolate(copy.exceedsCost, { costLimit })
  }

  return {
    message: interpolate(copy.lastQuery, { tokens: compact, cost }),
    detail: [
      reason,
      interpolate(copy.detailLine, { tokens: exact, cost }),
      interpolate(copy.modelTime, {
        model: modelLabel(query.model, locale),
        time: formatDateTime(query.timestamp),
      }),
      copy.notAskedAgain,
    ].join('\n'),
  }
}
