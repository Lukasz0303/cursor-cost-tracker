import type { UsageQuery } from '../usage/types'
import { burnMultiplier, normalWindowUsd } from './pace'
import {
  liveWindow,
  type BurnRateWindow,
} from './window'

export const DEFAULT_BURN_RATE_WINDOW_MINUTES = 10
export const MIN_BURN_RATE_WINDOW_MINUTES = 2
export const MAX_BURN_RATE_WINDOW_MINUTES = 60
export const DEFAULT_BURN_RATE_WARNING_USD = 2
export const DEFAULT_BURN_RATE_CRITICAL_USD = 5
export const MIN_BURN_RATE_USD = 0.01
export const MAX_BURN_RATE_USD = 10_000
export const DEFAULT_BURN_RATE_MIN_QUERIES = 2
export const MIN_BURN_RATE_MIN_QUERIES = 1
export const MAX_BURN_RATE_MIN_QUERIES = 50
export const DEFAULT_BURN_RATE_GRACE_MS = 5 * 60_000
export const BURN_RATE_SNOOZE_MS = 30 * 60_000

export const BURN_RATE_SEEN_KEY = 'cursorCost.lastBurnRateSeenKey'
export const BURN_RATE_SNOOZE_UNTIL_KEY = 'cursorCost.burnRateSnoozeUntil'

export type BurnRateLevel = 'off' | 'ok' | 'warning' | 'critical'

export type BurnRateEpisode = {
  level: 'warning' | 'critical'
  startMs: number
  endMs: number
  oldestMs: number
  queryCount: number
  costUsd: number
  tokens: number
  multiplier: number | null
}

export type BurnRateDecision =
  | { kind: 'skip' }
  | { kind: 'remember'; key: string }
  | { kind: 'alert'; episode: BurnRateEpisode; key: string }

export type BurnRateSeen = {
  level: 'warning' | 'critical'
  episodeStartFloor: number
}

export function clampBurnRateWindowMinutes(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_BURN_RATE_WINDOW_MINUTES
  }
  return Math.min(
    MAX_BURN_RATE_WINDOW_MINUTES,
    Math.max(MIN_BURN_RATE_WINDOW_MINUTES, Math.round(parsed)),
  )
}

export function clampBurnRateUsd(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  const rounded = Math.round(parsed * 100) / 100
  return Math.min(MAX_BURN_RATE_USD, Math.max(MIN_BURN_RATE_USD, rounded))
}

export function clampBurnRateMinQueries(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_BURN_RATE_MIN_QUERIES
  }
  return Math.min(
    MAX_BURN_RATE_MIN_QUERIES,
    Math.max(MIN_BURN_RATE_MIN_QUERIES, Math.round(parsed)),
  )
}

export function clampBurnRateThresholds(
  warningValue: unknown,
  criticalValue: unknown,
): { warningUsd: number; criticalUsd: number } {
  const warningUsd = clampBurnRateUsd(
    warningValue,
    DEFAULT_BURN_RATE_WARNING_USD,
  )
  const criticalUsd = Math.max(
    warningUsd,
    clampBurnRateUsd(criticalValue, DEFAULT_BURN_RATE_CRITICAL_USD),
  )
  return { warningUsd, criticalUsd }
}

export function burnRateLevel(input: {
  enabled: boolean
  queryCount: number
  minQueries: number
  costUsd: number
  warningUsd: number
  criticalUsd: number
}): BurnRateLevel {
  if (!input.enabled) {
    return 'off'
  }
  if (input.queryCount < input.minQueries) {
    return 'ok'
  }
  const criticalUsd = Math.max(input.criticalUsd, input.warningUsd)
  if (input.costUsd >= criticalUsd) {
    return 'critical'
  }
  if (input.costUsd >= input.warningUsd) {
    return 'warning'
  }
  return 'ok'
}

export function parseBurnRateSeenKey(
  value: string | undefined,
): BurnRateSeen | undefined {
  if (value === undefined || value === '') {
    return undefined
  }
  const split = value.indexOf(':')
  if (split <= 0) {
    return undefined
  }
  const level = value.slice(0, split)
  const floor = Number(value.slice(split + 1))
  if (
    (level !== 'warning' && level !== 'critical') ||
    !Number.isFinite(floor)
  ) {
    return undefined
  }
  return { level, episodeStartFloor: floor }
}

export function formatBurnRateSeenKey(
  level: 'warning' | 'critical',
  episodeStartFloor: number,
): string {
  return `${level}:${episodeStartFloor}`
}

function episodeFloor(window: BurnRateWindow, nowMs: number): number {
  const newest = window.queries[0]
  const stamp = newest === undefined ? nowMs : newest.timestamp
  return Math.floor(stamp / 60_000)
}

function newestAgeMs(window: BurnRateWindow, nowMs: number): number {
  const newest = window.queries[0]
  if (newest === undefined) {
    return Number.POSITIVE_INFINITY
  }
  return nowMs - newest.timestamp
}

function toEpisode(
  level: 'warning' | 'critical',
  window: BurnRateWindow,
  multiplier: number | null,
): BurnRateEpisode {
  const oldest = window.queries[window.queries.length - 1]
  return {
    level,
    startMs: window.startMs,
    endMs: window.endMs,
    oldestMs: oldest === undefined ? window.startMs : oldest.timestamp,
    queryCount: window.queryCount,
    costUsd: window.costUsd,
    tokens: window.tokens,
    multiplier,
  }
}

export function decideBurnRateAlert(input: {
  level: BurnRateLevel
  window: BurnRateWindow
  multiplier: number | null
  warningToast: boolean
  criticalToast: boolean
  lastSeenKey: string | undefined
  snoozeUntilMs: number
  nowMs: number
  graceMs?: number
}): BurnRateDecision {
  if (input.level === 'off' || input.level === 'ok') {
    if (input.lastSeenKey === undefined || input.lastSeenKey === '') {
      return { kind: 'skip' }
    }
    return { kind: 'remember', key: '' }
  }

  const parsed = parseBurnRateSeenKey(input.lastSeenKey)
  const inEpisode = parsed !== undefined
  const floor = inEpisode
    ? parsed.episodeStartFloor
    : episodeFloor(input.window, input.nowMs)
  const key = formatBurnRateSeenKey(input.level, floor)
  const toastOn =
    input.level === 'critical' ? input.criticalToast : input.warningToast

  if (!toastOn) {
    return { kind: 'remember', key }
  }
  if (input.nowMs < input.snoozeUntilMs) {
    return { kind: 'skip' }
  }

  const graceMs =
    input.graceMs === undefined ? DEFAULT_BURN_RATE_GRACE_MS : input.graceMs
  const isFirstSeen = parsed === undefined
  // After Snooze clears the seen key, do not re-apply startup grace or the
  // toast stays suppressed while burn is still high.
  const snoozeExpired =
    input.snoozeUntilMs > 0 && input.nowMs >= input.snoozeUntilMs
  if (
    isFirstSeen &&
    !snoozeExpired &&
    newestAgeMs(input.window, input.nowMs) > graceMs
  ) {
    return { kind: 'remember', key }
  }

  if (parsed !== undefined && parsed.level === input.level) {
    return { kind: 'skip' }
  }

  return {
    kind: 'alert',
    episode: toEpisode(input.level, input.window, input.multiplier),
    key,
  }
}

export function evaluateBurnRate(input: {
  queries: readonly UsageQuery[]
  enabled: boolean
  windowMinutes: number
  warningUsd: number
  criticalUsd: number
  minQueries: number
  nowMs: number
}): {
  window: BurnRateWindow
  level: BurnRateLevel
  multiplier: number | null
} {
  const window = liveWindow(input.queries, input.windowMinutes, input.nowMs)
  const level = burnRateLevel({
    enabled: input.enabled,
    queryCount: window.queryCount,
    minQueries: input.minQueries,
    costUsd: window.costUsd,
    warningUsd: input.warningUsd,
    criticalUsd: input.criticalUsd,
  })
  const normalUsd = normalWindowUsd(
    input.queries,
    window.windowMs,
    window.startMs,
    input.minQueries,
  )
  return {
    window,
    level,
    multiplier: burnMultiplier(window.costUsd, normalUsd),
  }
}
