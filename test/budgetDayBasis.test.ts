import { describe, expect, it } from 'vitest'
import {
  applyBudgetDayBasis,
  budgetDaysLeftInMonth,
  calendarDaysInMonth,
  calendarDaysLeftInMonth,
  workingDaysLeftInMonth,
} from '../src/usage/parse'
import type { UsageReady } from '../src/usage/types'

describe('calendarDaysLeftInMonth', () => {
  it('counts every remaining calendar day including today', () => {
    // September 2026 has 30 days; 5 Sep → 26 days left including today.
    expect(calendarDaysLeftInMonth(new Date(2026, 8, 5, 12, 0, 0))).toBe(26)
    expect(calendarDaysInMonth(new Date(2026, 8, 5, 12, 0, 0))).toBe(30)
  })
})

describe('budgetDaysLeftInMonth', () => {
  it('matches working days by default and calendar days when asked', () => {
    const now = new Date(2026, 8, 5, 12, 0, 0)
    expect(budgetDaysLeftInMonth(now)).toBe(workingDaysLeftInMonth(now))
    expect(budgetDaysLeftInMonth(now, 'calendarDays')).toBe(
      calendarDaysLeftInMonth(now),
    )
  })
})

describe('applyBudgetDayBasis', () => {
  it('recomputes daily budget from remaining and the chosen day basis', () => {
    const base: UsageReady = {
      email: null,
      plan: 'business',
      spendDisplay: 'usd',
      includedQuotas: [],
      usedUsd: 50,
      limitUsd: 250,
      remainingUsd: 200,
      todayUsedUsd: 1,
      dailyBudgetUsd: 10,
      workingDaysLeft: 20,
      billingCycleStart: null,
      billingCycleEnd: null,
      isUnlimited: false,
      includedLine: null,
      onDemandLine: null,
      recentQueries: [],
    }
    // 5 Sep 2026: 26 calendar days left → 200 / 26.
    const paced = applyBudgetDayBasis(
      base,
      'calendarDays',
      new Date(2026, 8, 5, 12, 0, 0),
    )
    expect(paced.workingDaysLeft).toBe(26)
    expect(paced.dailyBudgetUsd).toBeCloseTo(200 / 26, 6)
  })
})
