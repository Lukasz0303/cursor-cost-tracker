import {
  formatCompactTokens,
  formatDateTime,
  formatDollarSign,
  formatTokens,
} from '../format'
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

export function decideCriticalAlert(input: {
  queries: readonly UsageQuery[]
  thresholds: CriticalAlertThresholds
  enabled: boolean
  lastSeenKey: string | undefined
  nowMs?: number
  graceMs?: number
}): CriticalAlertDecision {
  const query = newestQuery(input.queries)
  if (query === undefined) {
    return { kind: 'skip' }
  }
  const key = queryFingerprint(query)
  if (key === input.lastSeenKey) {
    return { kind: 'skip' }
  }
  if (!input.enabled) {
    return { kind: 'remember', key }
  }
  const breach = criticalBreach(query, input.thresholds)
  if (!breach.tokens && !breach.cost) {
    return { kind: 'remember', key }
  }
  const nowMs = input.nowMs ?? Date.now()
  const graceMs =
    input.graceMs === undefined
      ? DEFAULT_CRITICAL_ALERT_GRACE_MS
      : input.graceMs
  const isFirstSeen = input.lastSeenKey === undefined
  const ageMs = nowMs - query.timestamp
  if (isFirstSeen && ageMs > graceMs) {
    return { kind: 'remember', key }
  }
  return { kind: 'alert', query, key, breach }
}

function modelLabel(model: string | null): string {
  const stripped = stripModelPrefix(model)
  if (stripped === null || stripped.trim() === '') {
    return 'unknown model'
  }
  return stripped
}

export function formatCriticalAlertCopy(
  query: UsageQuery,
  thresholds: CriticalAlertThresholds,
  breach: CriticalBreach,
): CriticalAlertCopy {
  const compact = formatCompactTokens(query.tokens)
  const exact = formatTokens(query.tokens)
  const cost = formatDollarSign(query.costUsd)
  const tokenLimit = formatCompactTokens(thresholds.tokenThreshold)
  const costLimit = formatDollarSign(thresholds.costUsdThreshold)

  let reason = `This exceeds your critical alert of ${tokenLimit} tokens or ${costLimit}.`
  if (breach.tokens && !breach.cost) {
    reason = `Tokens exceed your critical alert of ${tokenLimit}.`
  } else if (breach.cost && !breach.tokens) {
    reason = `Cost exceeds your critical alert of ${costLimit}.`
  }

  return {
    message: `Last Cursor query used ${compact} tokens and cost ${cost}.`,
    detail: [
      reason,
      `${exact} tokens · ${cost}`,
      `${modelLabel(query.model)} · ${formatDateTime(query.timestamp)}`,
      'You will not be asked about this query again.',
    ].join('\n'),
  }
}
