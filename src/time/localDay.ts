function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/** Calendar day `YYYY-MM-DD` in local time. */
export function isoDateFromLocal(now: Date): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** Local calendar day key from epoch ms (`YYYY-MM-DD`, month 1-based, padded). */
export function localDayKey(ms: number): string {
  const d = new Date(ms)
  return isoDateFromLocal(d)
}

/** Local calendar month key (`YYYY-MM`, month 1-based, padded). */
export function localMonthKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

/**
 * Local day key from calendar parts. `monthIndex` is 0-based (Date.getMonth()).
 */
export function localDayKeyFromParts(
  year: number,
  monthIndex: number,
  day: number,
): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

function parseIsoDay(iso: string): { year: number; month: number; day: number } | null {
  const match = ISO_DAY.exec(iso.trim())
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
  return { year, month, day }
}

/** Local midnight for an ISO day or a Date (that day's local midnight). */
export function startOfLocalDayMs(isoOrDate: string | Date): number | null {
  if (isoOrDate instanceof Date) {
    if (!Number.isFinite(isoOrDate.getTime())) {
      return null
    }
    return new Date(
      isoOrDate.getFullYear(),
      isoOrDate.getMonth(),
      isoOrDate.getDate(),
    ).getTime()
  }
  const parsed = parseIsoDay(isoOrDate)
  if (parsed === null) {
    return null
  }
  return new Date(parsed.year, parsed.month - 1, parsed.day).getTime()
}

/** Inclusive end of a local calendar day (23:59:59.999). */
export function endOfLocalDayMs(isoOrDate: string | Date): number | null {
  const start = startOfLocalDayMs(isoOrDate)
  if (start === null) {
    return null
  }
  return start + 24 * 60 * 60 * 1000 - 1
}

export function sameLocalDay(aMs: number, bMs: number): boolean {
  return localDayKey(aMs) === localDayKey(bMs)
}

export type LocalDayBounds = {
  startMs: number
  endMs: number
  /** Epoch ms as decimal string (usage API `startDate` / `endDate`). */
  startDate: string
  endDate: string
}

/** Local midnight → inclusive end of `now`'s local calendar day. */
export function localDayBoundsMs(now: Date): LocalDayBounds {
  const startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const endMs = startMs + 24 * 60 * 60 * 1000 - 1
  return {
    startMs,
    endMs,
    startDate: String(startMs),
    endDate: String(endMs),
  }
}
