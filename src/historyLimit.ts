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

export function lastQueriesHeading(limit: number): string {
  return `Last ${clampHistoryLimit(limit)}`
}

export function lastQueriesTitle(limit: number): string {
  return `${lastQueriesHeading(limit)} Cursor queries`
}
