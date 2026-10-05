import {
  clampBurnRateMinQueries,
  clampBurnRateUsd,
  clampBurnRateWindowMinutes,
} from '../burnRate/detect'
import {
  clampHistoryLimit as clampHistoryLimitNumber,
  clampPollIntervalMinutes,
  clampRecentQueryCount as clampRecentQueryCountSrc,
} from '../clamps'
import {
  daysAgoIso as daysAgoIsoFrom,
  formatHistoryFromDateLabel,
  isoDateFromLocal,
  parseHistoryFromDate,
  startOfMonthIso as startOfMonthIsoFrom,
} from '../historyFromDate'

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value)
}

/** Same names the Last N webview already calls. One implementation with the host. */
export function clampHistoryLimit(value: unknown): number {
  return clampHistoryLimitNumber(asNumber(value))
}

export function clampPollInterval(value: unknown): number {
  return clampPollIntervalMinutes(asNumber(value))
}

export function clampRecentQueryCount(value: unknown): number {
  return clampRecentQueryCountSrc(value)
}

export function clampBurnWindow(value: unknown): number {
  return clampBurnRateWindowMinutes(value)
}

export function clampBurnUsd(value: unknown, fallback: unknown): number {
  const fb = typeof fallback === 'number' ? fallback : Number(fallback)
  return clampBurnRateUsd(value, fb)
}

export function clampBurnMinQueries(value: unknown): number {
  return clampBurnRateMinQueries(value)
}

export function isoFromLocal(value: unknown): string {
  const date = value instanceof Date ? value : new Date(Number.NaN)
  return isoDateFromLocal(date)
}

export function startOfMonthIso(): string {
  return startOfMonthIsoFrom(new Date())
}

/** Empty string when the day is missing or not a real calendar date. */
export function parseFromDate(value: unknown): string {
  return parseHistoryFromDate(value) ?? ''
}

export function formatFromDateLabel(iso: unknown): string {
  if (typeof iso !== 'string') {
    return ''
  }
  return formatHistoryFromDateLabel(iso)
}

export function daysAgoIso(days: unknown): string {
  return daysAgoIsoFrom(new Date(), asNumber(days))
}
