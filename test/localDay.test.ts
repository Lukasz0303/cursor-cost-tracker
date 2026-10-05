import { describe, expect, it } from 'vitest'
import {
  endOfLocalDayMs,
  isoDateFromLocal,
  localDayBoundsMs,
  localDayKey,
  localDayKeyFromParts,
  localMonthKey,
  sameLocalDay,
  startOfLocalDayMs,
} from '../src/time/localDay'
import { formatDateTimeWithZone, localZoneLabel } from '../src/time/zoneLabel'

describe('localDay', () => {
  it('uses padded 1-based month in day and month keys', () => {
    const ms = new Date(2026, 8, 5, 15, 30, 0).getTime()
    expect(localDayKey(ms)).toBe('2026-09-05')
    expect(localMonthKey(ms)).toBe('2026-09')
    expect(localDayKeyFromParts(2026, 8, 5)).toBe('2026-09-05')
    expect(isoDateFromLocal(new Date(ms))).toBe('2026-09-05')
  })

  it('bounds a local day from midnight through 23:59:59.999', () => {
    const now = new Date(2026, 8, 5, 15, 30, 0)
    const bounds = localDayBoundsMs(now)
    expect(bounds.startMs).toBe(new Date(2026, 8, 5, 0, 0, 0, 0).getTime())
    expect(bounds.endMs).toBe(new Date(2026, 8, 5, 23, 59, 59, 999).getTime())
    expect(bounds.startDate).toBe(String(bounds.startMs))
    expect(bounds.endDate).toBe(String(bounds.endMs))

    expect(startOfLocalDayMs('2026-09-05')).toBe(bounds.startMs)
    expect(endOfLocalDayMs('2026-09-05')).toBe(bounds.endMs)
  })

  it('treats instants on the same local calendar day as equal', () => {
    const morning = new Date(2026, 8, 5, 0, 0, 0).getTime()
    const night = new Date(2026, 8, 5, 23, 59, 59).getTime()
    const next = new Date(2026, 8, 6, 0, 0, 0).getTime()
    expect(sameLocalDay(morning, night)).toBe(true)
    expect(sameLocalDay(morning, next)).toBe(false)
  })

  it('formats local datetime with a zone suffix', () => {
    const ms = new Date(2026, 8, 5, 10, 5, 12).getTime()
    const label = formatDateTimeWithZone(ms)
    expect(label.startsWith('5.09.2026, 10:05:12 ')).toBe(true)
    expect(localZoneLabel(ms).length).toBeGreaterThan(0)
    expect(label.endsWith(localZoneLabel(ms))).toBe(true)
  })
})
