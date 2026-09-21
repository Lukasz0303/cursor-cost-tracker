import { localDayKey } from './gitMerged'

export const ANALYTICS_MAX_SPAN_MS = 30 * 24 * 60 * 60 * 1000

export type DashboardDayEdited = {
  date: string
  edited: number
}

function asNonNegInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value))
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed))
    }
  }
  return 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Accepted AI add+delete — same idea as dashboard “Lines Edited” / All. */
export function linesEditedFromDayRow(row: unknown): number {
  if (!isRecord(row)) {
    return 0
  }
  const accepted =
    asNonNegInt(row.acceptedLinesAdded) +
    asNonNegInt(row.acceptedLinesDeleted) +
    asNonNegInt(row.accepted_lines_added) +
    asNonNegInt(row.accepted_lines_deleted)
  if (accepted > 0) {
    return accepted
  }
  const named =
    asNonNegInt(row.linesEdited) ||
    asNonNegInt(row.lineEdits) ||
    asNonNegInt(row.total_lines_accepted) ||
    asNonNegInt(row.totalLinesAccepted)
  if (named > 0) {
    return named
  }
  const greenRed =
    asNonNegInt(row.total_green_lines_accepted) +
    asNonNegInt(row.total_red_lines_accepted)
  if (greenRed > 0) {
    return greenRed
  }
  return (
    asNonNegInt(row.totalLinesAdded) + asNonNegInt(row.totalLinesDeleted)
  )
}

export function dayKeyFromAnalyticsRow(row: unknown): string | null {
  if (!isRecord(row)) {
    return null
  }
  for (const key of ['day', 'event_date', 'eventDate', 'date'] as const) {
    const value = row[key]
    if (typeof value === 'string') {
      const iso = value.trim()
      if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
        return iso.slice(0, 10)
      }
      if (/^\d+$/.test(iso)) {
        const n = Number(iso)
        if (Number.isFinite(n) && n > 0) {
          const ms = n < 1e12 ? n * 1000 : n
          return localDayKey(ms)
        }
      }
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      const ms = value < 1e12 ? value * 1000 : value
      return localDayKey(ms)
    }
  }
  return null
}

const NESTED_KEYS = [
  'dailyMetrics',
  'data',
  'metrics',
  'days',
  'usage',
] as const

function collectDayRows(
  node: unknown,
  out: Record<string, unknown>[],
  depth: number,
): void {
  if (depth > 8 || node === null || node === undefined) {
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectDayRows(item, out, depth + 1)
    }
    return
  }
  if (!isRecord(node)) {
    return
  }
  let nested = 0
  for (const key of NESTED_KEYS) {
    const value = node[key]
    if (Array.isArray(value) || isRecord(value)) {
      const before = out.length
      collectDayRows(value, out, depth + 1)
      nested += out.length - before
    }
  }
  if (nested > 0) {
    return
  }
  if (linesEditedFromDayRow(node) > 0) {
    out.push(node)
  }
}

export function parseUserAnalyticsDays(raw: unknown): DashboardDayEdited[] {
  const rows: Record<string, unknown>[] = []
  collectDayRows(raw, rows, 0)
  const byDate = new Map<string, number>()
  let undated = 0
  for (const row of rows) {
    const edited = linesEditedFromDayRow(row)
    if (edited <= 0) {
      continue
    }
    const date = dayKeyFromAnalyticsRow(row)
    if (date === null) {
      undated += edited
      continue
    }
    byDate.set(date, (byDate.get(date) ?? 0) + edited)
  }
  const days = [...byDate.entries()]
    .map(([date, edited]) => ({ date, edited }))
    .sort((left, right) => left.date.localeCompare(right.date))
  if (days.length === 0 && undated > 0) {
    return [{ date: '', edited: undated }]
  }
  return days
}

export function sumDashboardEdited(
  days: readonly DashboardDayEdited[],
): number {
  let total = 0
  for (const day of days) {
    total += day.edited
  }
  return total
}

export function analyticsChunks(
  sinceMs: number,
  untilMs: number,
): { startMs: number; endMs: number }[] {
  if (!Number.isFinite(sinceMs) || !Number.isFinite(untilMs) || untilMs < sinceMs) {
    return []
  }
  const chunks: { startMs: number; endMs: number }[] = []
  let start = sinceMs
  while (start <= untilMs) {
    const end = Math.min(untilMs, start + ANALYTICS_MAX_SPAN_MS)
    chunks.push({ startMs: start, endMs: end })
    start = end + 1
  }
  return chunks
}
