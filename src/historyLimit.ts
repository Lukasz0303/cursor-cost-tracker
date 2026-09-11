import {
  formatHistoryFromDateLabel,
  parseHistoryFromDate,
} from './historyFromDate'

export const MIN_HISTORY_LIMIT = 100
export const MAX_HISTORY_LIMIT = 10_000
export const DEFAULT_HISTORY_LIMIT = 1_000

export function clampHistoryLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_HISTORY_LIMIT
  }
  return Math.min(
    MAX_HISTORY_LIMIT,
    Math.max(MIN_HISTORY_LIMIT, Math.round(value)),
  )
}

/** Last N, or the 10,000 cap when a From date is set. */
export function sampleSizeLimit(
  historyLimit: number,
  fromDate?: string | null,
): number {
  if (parseHistoryFromDate(fromDate) !== null) {
    return MAX_HISTORY_LIMIT
  }
  return clampHistoryLimit(historyLimit)
}

export function lastQueriesHeading(
  limit: number,
  fromDate?: string | null,
): string {
  const iso = parseHistoryFromDate(fromDate)
  if (iso !== null) {
    return `From ${formatHistoryFromDateLabel(iso)}`
  }
  return `Last ${clampHistoryLimit(limit)}`
}

export function lastQueriesTitle(
  limit: number,
  fromDate?: string | null,
): string {
  return `${lastQueriesHeading(limit, fromDate)} Cursor queries`
}
