import { describe, expect, it } from 'vitest'
import {
  dailyBudgetUsd,
  sumMonthUsedUsd,
  sumTodayUsedUsd,
  workingDaysElapsedInMonth,
  workingDaysLeftInMonth,
} from '../src/usage/parse'
import type { UsageQuery } from '../src/usage/types'

function query(partial: Partial<UsageQuery> & { timestamp: number }): UsageQuery {
  return {
    model: null,
    kind: null,
    costUsd: 0,
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    ...partial,
  }
}

describe('dailyBudgetUsd', () => {
  it('divides remaining by working days', () => {
    expect(dailyBudgetUsd(100, 10)).toBe(10)
  })

  it('returns null when days are not positive or remaining is null', () => {
    expect(dailyBudgetUsd(100, 0)).toBeNull()
    expect(dailyBudgetUsd(100, -1)).toBeNull()
    expect(dailyBudgetUsd(null, 10)).toBeNull()
  })
})

describe('workingDaysLeftInMonth', () => {
  it('counts Friday as 1 when it is the last day of the month', () => {
    // 31 Jan 2025 is a Friday and the last calendar day of January.
    expect(workingDaysLeftInMonth(new Date(2025, 0, 31, 9, 0, 0))).toBe(1)
  })

  it('does not count Saturday or Sunday as working days', () => {
    // 1 Feb 2025 is a Saturday; remaining weekdays in February are Mon–Fri only.
    expect(workingDaysLeftInMonth(new Date(2025, 1, 1, 12, 0, 0))).toBe(20)
  })

  it('keeps at least one working day when only weekend remains', () => {
    // 30 Aug 2025 is a Saturday; 31 Aug 2025 is Sunday — Stack Manager uses max(1, count).
    expect(workingDaysLeftInMonth(new Date(2025, 7, 30, 9, 0, 0))).toBe(1)
  })

  it('includes today when today is a weekday', () => {
    // 1 Sep 2026 is a Tuesday.
    const from = new Date(2026, 8, 1, 8, 0, 0)
    const days = workingDaysLeftInMonth(from)
    expect(days).toBeGreaterThanOrEqual(1)
    expect(workingDaysLeftInMonth(new Date(2026, 8, 2, 8, 0, 0))).toBe(days - 1)
  })
})

describe('workingDaysElapsedInMonth', () => {
  it('counts weekdays from the 1st through today, including today', () => {
    // 1 Sep 2026 is Tuesday; 2 Sep 2026 is Wednesday → 2 working days so far.
    expect(workingDaysElapsedInMonth(new Date(2026, 8, 2, 8, 0, 0))).toBe(2)
    expect(workingDaysElapsedInMonth(new Date(2026, 8, 1, 8, 0, 0))).toBe(1)
  })

  it('does not count Saturday or Sunday toward elapsed working days', () => {
    // 5 Sep 2026 is Saturday; weekdays so far are Tue–Fri.
    expect(workingDaysElapsedInMonth(new Date(2026, 8, 5, 12, 0, 0))).toBe(4)
  })

  it('returns 0 when the month has not had a weekday yet', () => {
    // 1 Feb 2025 is Saturday.
    expect(workingDaysElapsedInMonth(new Date(2025, 1, 1, 12, 0, 0))).toBe(0)
  })
})

describe('sumTodayUsedUsd', () => {
  it('sums only events on the local calendar day', () => {
    const now = new Date(2026, 8, 1, 18, 0, 0)
    const todayMorning = new Date(2026, 8, 1, 9, 0, 0).getTime()
    const yesterday = new Date(2026, 7, 31, 23, 0, 0).getTime()
    const tomorrow = new Date(2026, 8, 2, 0, 30, 0).getTime()

    const total = sumTodayUsedUsd(
      [
        query({ timestamp: todayMorning, costUsd: 1.5 }),
        query({ timestamp: todayMorning + 1_000, costUsd: 2.25 }),
        query({ timestamp: yesterday, costUsd: 9 }),
        query({ timestamp: tomorrow, costUsd: 8 }),
      ],
      now,
    )
    expect(total).toBe(3.75)
  })

  it('returns 0 for an empty list', () => {
    expect(sumTodayUsedUsd([], new Date(2026, 8, 1))).toBe(0)
  })
})

describe('sumMonthUsedUsd', () => {
  it('sums only events in the local calendar month', () => {
    const now = new Date(2026, 8, 5, 18, 0, 0)
    const thisMonth = new Date(2026, 8, 1, 9, 0, 0).getTime()
    const laterThisMonth = new Date(2026, 8, 4, 11, 0, 0).getTime()
    const lastMonth = new Date(2026, 7, 31, 23, 0, 0).getTime()
    const nextMonth = new Date(2026, 9, 1, 0, 30, 0).getTime()

    const total = sumMonthUsedUsd(
      [
        query({ timestamp: thisMonth, costUsd: 1.5 }),
        query({ timestamp: laterThisMonth, costUsd: 2.25 }),
        query({ timestamp: lastMonth, costUsd: 9 }),
        query({ timestamp: nextMonth, costUsd: 8 }),
      ],
      now,
    )
    expect(total).toBe(3.75)
  })

  it('returns 0 for an empty list', () => {
    expect(sumMonthUsedUsd([], new Date(2026, 8, 1))).toBe(0)
  })
})
