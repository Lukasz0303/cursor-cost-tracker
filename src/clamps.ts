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

export const MIN_RECENT_QUERY_COUNT = 1
export const MAX_RECENT_QUERY_COUNT = 10
export const DEFAULT_RECENT_QUERY_COUNT = 3

export function clampRecentQueryCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_RECENT_QUERY_COUNT
  }
  return Math.min(
    MAX_RECENT_QUERY_COUNT,
    Math.max(MIN_RECENT_QUERY_COUNT, Math.round(parsed)),
  )
}

const DEFAULT_POLL_MINUTES = 1

export function clampPollIntervalMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_POLL_MINUTES
  }
  return Math.min(60, Math.max(1, Math.round(value)))
}
