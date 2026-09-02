import { describe, expect, it } from 'vitest'
import {
  formatDateTime,
  formatDollars,
  formatKind,
  formatTokens,
  formatCompactTokens,
  formatPercentUsed,
  cycleResetLabel,
} from '../src/format'

describe('formatDollars', () => {
  it('uses two decimals and a space before $', () => {
    expect(formatDollars(3.79)).toBe('3.79 $')
    expect(formatDollars(250)).toBe('250.00 $')
  })

  it('treats non-finite values as 0.00 $', () => {
    expect(formatDollars(Number.NaN)).toBe('0.00 $')
  })
})

describe('formatPercentUsed', () => {
  it('rounds to a whole percent', () => {
    expect(formatPercentUsed(7.4)).toBe('7%')
    expect(formatPercentUsed(0)).toBe('0%')
    expect(formatPercentUsed(Number.NaN)).toBe('0%')
  })
})

describe('formatTokens', () => {
  it('groups thousands with en-US commas (not 64.8k)', () => {
    expect(formatTokens(64_755)).toBe('64,755')
    expect(formatTokens(0)).toBe('0')
  })
})

describe('formatCompactTokens', () => {
  it('uses k and M with one decimal like the dashboard chips', () => {
    expect(formatCompactTokens(850)).toBe('850')
    expect(formatCompactTokens(64_755)).toBe('64.8k')
    expect(formatCompactTokens(237_000)).toBe('237.0k')
    expect(formatCompactTokens(1_000_000)).toBe('1.0M')
    expect(formatCompactTokens(1_200_000)).toBe('1.2M')
  })
})

describe('formatDateTime', () => {
  it('formats local day.month.year with padded time', () => {
    // Constructed in the local timezone so the test is stable on Windows CI.
    const ms = new Date(2026, 8, 1, 10, 5, 12).getTime()
    expect(formatDateTime(ms)).toBe('1.09.2026, 10:05:12')
  })

  it('does not pad a single-digit day', () => {
    const ms = new Date(2026, 8, 9, 0, 0, 0).getTime()
    expect(formatDateTime(ms)).toBe('9.09.2026, 00:00:00')
  })
})

describe('formatKind', () => {
  it('humanizes API enums', () => {
    expect(formatKind('USAGE_EVENT_KIND_INCLUDED_IN_BUSINESS')).toBe(
      'Included In Business',
    )
    expect(formatKind('USAGE_EVENT_KIND_USAGE_BASED')).toBe('Usage Based')
  })

  it('uses an em dash for missing kind', () => {
    expect(formatKind(null)).toBe('—')
    expect(formatKind('')).toBe('—')
  })
})

describe('cycleResetLabel', () => {
  it('counts days until the billing cycle end', () => {
    const now = new Date('2026-09-20T12:00:00')
    expect(cycleResetLabel('2026-09-30T00:00:00.000Z', now)).toBe(
      'Resets in 10 days (2026-09-30)',
    )
    expect(cycleResetLabel('2026-09-20T00:00:00.000Z', now)).toBe(
      'Resets today (2026-09-20)',
    )
  })
})
