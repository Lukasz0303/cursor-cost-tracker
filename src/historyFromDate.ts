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
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export function startOfMonthIso(now: Date): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`
}

export function historyFromDateStartMs(isoDate: string): number | null {
  const parsed = parseHistoryFromDate(isoDate)
  if (parsed === null) {
    return null
  }
  const [yearText, monthText, dayText] = parsed.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }
  return new Date(year, month - 1, day).getTime()
}

/** Local midnight of `isoDate` through the end of `now`'s local day. */
export function historyFromDateBounds(
  isoDate: string,
  now: Date,
): { startDate: string; endDate: string } | null {
  const startMs = historyFromDateStartMs(isoDate)
  if (startMs === null) {
    return null
  }
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endMs = end.getTime() + 24 * 60 * 60 * 1000 - 1
  return {
    startDate: String(startMs),
    endDate: String(endMs),
  }
}
