import { describe, expect, it } from 'vitest'
import {
  formatHistoryFromDateLabel,
  historyFromDateBounds,
  historyFromDateStartMs,
  isoDateFromLocal,
  parseHistoryFromDate,
  startOfMonthIso,
} from '../src/historyFromDate'

describe('parseHistoryFromDate', () => {
  it('accepts a local calendar day and rejects junk', () => {
    expect(parseHistoryFromDate('2026-09-01')).toBe('2026-09-01')
    expect(parseHistoryFromDate(' 2026-09-07 ')).toBe('2026-09-07')
    expect(parseHistoryFromDate('')).toBeNull()
    expect(parseHistoryFromDate('01.09.2026')).toBeNull()
    expect(parseHistoryFromDate('2026-02-31')).toBeNull()
    expect(parseHistoryFromDate(20260901)).toBeNull()
  })
})

describe('formatHistoryFromDateLabel', () => {
  it('matches the table day style', () => {
    expect(formatHistoryFromDateLabel('2026-09-01')).toBe('1.09.2026')
    expect(formatHistoryFromDateLabel('2026-12-31')).toBe('31.12.2026')
    expect(formatHistoryFromDateLabel('nope')).toBe('')
  })
})

describe('month and today helpers', () => {
  it('builds start of month and today in local time', () => {
    const now = new Date(2026, 8, 7, 15, 30, 0)
    expect(startOfMonthIso(now)).toBe('2026-09-01')
    expect(isoDateFromLocal(now)).toBe('2026-09-07')
  })
})

describe('historyFromDateBounds', () => {
  it('spans local midnight of the from-day through the end of today', () => {
    const now = new Date(2026, 8, 7, 12, 0, 0)
    const start = new Date(2026, 8, 1).getTime()
    const end = new Date(2026, 8, 7).getTime() + 24 * 60 * 60 * 1000 - 1
    expect(historyFromDateStartMs('2026-09-01')).toBe(start)
    expect(historyFromDateBounds('2026-09-01', now)).toEqual({
      startDate: String(start),
      endDate: String(end),
    })
    expect(historyFromDateBounds('nope', now)).toBeNull()
  })
})
