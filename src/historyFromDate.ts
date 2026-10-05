import {
  endOfLocalDayMs,
  isoDateFromLocal as isoDateFromLocalTime,
  startOfLocalDayMs,
} from './time/localDay'

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Calendar day `YYYY-MM-DD` in local time, or `null` when empty/invalid. */
export function parseHistoryFromDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  const match = ISO_DAY.exec(trimmed)
  if (!match || !match[1] || !match[2] || !match[3]) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return `${match[1]}-${match[2]}-${match[3]}`
}

/** Table-style label, e.g. `1.09.2026`. */
export function formatHistoryFromDateLabel(isoDate: string): string {
  const parsed = parseHistoryFromDate(isoDate)
  if (parsed === null) {
    return ''
  }
  const [year, month, day] = parsed.split('-')
  if (!year || !month || !day) {
    return ''
  }
  return `${Number(day)}.${month}.${year}`
}

export function isoDateFromLocal(now: Date): string {
  return isoDateFromLocalTime(now)
}

export function startOfMonthIso(now: Date): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`
}

/** Local calendar day `days` before `now` (0 = today). */
export function daysAgoIso(now: Date, days: number): string {
  const safeDays = Number.isFinite(days) ? Math.max(0, Math.trunc(days)) : 0
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - safeDays)
  return isoDateFromLocal(date)
}

/**
 * Best-effort local day from a billing-cycle string (ISO day or Date-parseable).
 */
export function billingCycleStartIso(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  const asDay = parseHistoryFromDate(trimmed.slice(0, 10))
  if (asDay !== null) {
    return asDay
  }
  const parsed = Date.parse(trimmed)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return isoDateFromLocal(new Date(parsed))
}

export function historyFromDateStartMs(isoDate: string): number | null {
  const parsed = parseHistoryFromDate(isoDate)
  if (parsed === null) {
    return null
  }
  return startOfLocalDayMs(parsed)
}

/** Inclusive end of a local calendar day (23:59:59.999). */
export function historyToDateEndMs(isoDate: string): number | null {
  const parsed = parseHistoryFromDate(isoDate)
  if (parsed === null) {
    return null
  }
  return endOfLocalDayMs(parsed)
}

/** Local midnight of `isoDate` through the end of `now`'s local day. */
export function historyFromDateBounds(
  isoDate: string,
  now: Date,
): { startDate: string; endDate: string } | null {
  return historyDateRangeBounds(isoDate, null, now)
}

/**
 * Local midnight of `fromIso` through end of `toIso` (or end of today when
 * `toIso` is null). Future `to` clamps to today. Invalid / inverted range → null.
 */
export function historyDateRangeBounds(
  fromIso: string,
  toIso: string | null,
  now: Date,
): { startDate: string; endDate: string; startMs: number; endMs: number } | null {
  const startMs = historyFromDateStartMs(fromIso)
  if (startMs === null) {
    return null
  }
  const todayIso = isoDateFromLocal(now)
  let toParsed = parseHistoryFromDate(toIso)
  if (toParsed === null) {
    toParsed = todayIso
  }
  if (toParsed > todayIso) {
    toParsed = todayIso
  }
  const endMs = historyToDateEndMs(toParsed)
  if (endMs === null || endMs < startMs) {
    return null
  }
  return {
    startDate: String(startMs),
    endDate: String(endMs),
    startMs,
    endMs,
  }
}
