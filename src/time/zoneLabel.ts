import { formatDateTime } from './format'

/** Short zone label for the runtime local timezone (e.g. `CEST`, `GMT+2`). */
export function localZoneLabel(ms: number = Date.now()): string {
  const date = new Date(ms)
  if (!Number.isFinite(date.getTime())) {
    return 'local'
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZoneName: 'short',
    }).formatToParts(date)
    const zone = parts.find((part) => part.type === 'timeZoneName')?.value?.trim()
    if (zone && zone.length > 0) {
      return zone
    }
  } catch {
    // Intl missing short names — fall through to offset.
  }
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const hours = String(Math.trunc(abs / 60)).padStart(2, '0')
  const mins = String(abs % 60).padStart(2, '0')
  return mins === '00' ? `UTC${sign}${Number(hours)}` : `UTC${sign}${hours}:${mins}`
}

/**
 * Local wall-clock like the Last N TIME column, plus a short zone suffix
 * (e.g. `1.09.2026, 10:05:12 CEST`).
 */
export function formatDateTimeWithZone(ms: number): string {
  const stamp = formatDateTime(ms)
  if (stamp === '—') {
    return stamp
  }
  return `${stamp} ${localZoneLabel(ms)}`
}
