const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseLocalDayStart(iso: string): number | null {
  const match = DAY.exec(iso.trim())
  if (match === null) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date.getTime()
}

/** Exclusive end: local midnight of the day after `iso`. */
export function parseLocalDayEndExclusive(iso: string): number | null {
  const start = parseLocalDayStart(iso)
  if (start === null) {
    return null
  }
  const date = new Date(start)
  date.setDate(date.getDate() + 1)
  return date.getTime()
}

export function isValidLeaderboardRange(from: string, to: string): boolean {
  const start = parseLocalDayStart(from)
  const end = parseLocalDayStart(to)
  return start !== null && end !== null && start <= end
}

export function localDayKey(ms: number): string {
  const date = new Date(ms)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function eachLocalDay(from: string, to: string): string[] {
  const start = parseLocalDayStart(from)
  const end = parseLocalDayStart(to)
  if (start === null || end === null || start > end) {
    return []
  }
  const dates: string[] = []
  const cursor = new Date(start)
  while (cursor.getTime() <= end) {
    dates.push(localDayKey(cursor.getTime()))
    cursor.setDate(cursor.getDate() + 1)
    if (dates.length > 800) {
      break
    }
  }
  return dates
}
