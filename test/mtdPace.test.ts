import { describe, expect, it } from 'vitest'
import {
  MTD_FORECAST_BODY,
  MTD_NO_BUDGET_BODY,
  MTD_NO_DAYS_BODY,
  toMonthFrames,
  toMtdChart,
  toMtdDays,
  toMtdPace,
  toMtdSeries,
  workingDaysInMonth,
} from '../src/ui/mtdPace'
import type { UsageQuery, UsageReady, UsageSnapshot } from '../src/usage/types'

function query(partial: Partial<UsageQuery> & { timestamp: number }): UsageQuery {
  return {
    model: 'cursor-default',
    kind: 'USAGE_EVENT_KIND_INCLUDED_IN_BUSINESS',
    costUsd: 0,
    tokens: 10,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    ...partial,
  }
}

/** Local calendar days the billing-cycle chart includes. End is exclusive. */
function localBillingCycleAxis(startIso: string, endIso: string): string[] {
  const startInstant = new Date(startIso)
  const endInstant = new Date(endIso)
  const start = new Date(
    startInstant.getFullYear(),
    startInstant.getMonth(),
    startInstant.getDate(),
  )
  const endMidnight = new Date(
    endInstant.getFullYear(),
    endInstant.getMonth(),
    endInstant.getDate(),
  )
  const endIsLocalMidnight =
    endInstant.getHours() === 0 &&
    endInstant.getMinutes() === 0 &&
    endInstant.getSeconds() === 0 &&
    endInstant.getMilliseconds() === 0
  const last = endIsLocalMidnight
    ? new Date(endMidnight.getTime() - 24 * 60 * 60 * 1000)
    : endMidnight
  const labels: string[] = []
  for (
    const date = new Date(start.getTime());
    date.getTime() <= last.getTime();
    date.setDate(date.getDate() + 1)
  ) {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    labels.push(`${date.getDate()}.${month}`)
  }
  return labels
}

function ready(overrides: Partial<UsageReady> = {}): UsageSnapshot {
  return {
    status: 'ready',
    data: {
      email: 'secret@example.com',
      plan: 'business',
      spendDisplay: 'usd',
      includedQuotas: [],
      usedUsd: 100,
      limitUsd: 220,
      remainingUsd: 180,
      todayUsedUsd: 4,
      dailyBudgetUsd: 10,
      workingDaysLeft: 18,
      billingCycleStart: '2026-09-01T00:00:00.000Z',
      billingCycleEnd: '2026-09-30T00:00:00.000Z',
      isUnlimited: false,
      includedLine: null,
      onDemandLine: null,
      recentQueries: [],
      ...overrides,
    },
  }
}

describe('toMtdPace', () => {
  it('meters month spend against elapsed working days × daily budget', () => {
    const now = new Date(2026, 8, 7, 18, 0, 0)
    const stats = toMtdPace(
      ready(),
      [
        query({ timestamp: new Date(2026, 8, 1, 9, 0, 0).getTime(), costUsd: 12 }),
        query({ timestamp: new Date(2026, 8, 3, 9, 0, 0).getTime(), costUsd: 20 }),
        query({ timestamp: new Date(2026, 8, 7, 9, 0, 0).getTime(), costUsd: 10 }),
        query({ timestamp: new Date(2026, 7, 31, 9, 0, 0).getTime(), costUsd: 99 }),
      ],
      { now },
    )
    // 7 Sep 2026 is Monday = 5th weekday. Allowance = 5 × 10.
    expect(stats.title).toBe('Monthly cost forecast')
    expect(stats.unit).toBe('usd')
    expect(stats.max).toBeNull()
    expect(stats.value).toBe('')
    expect(stats.verdict).toBe('ok')
    expect(stats.overPace).toBe(false)
    expect(stats.bars).toEqual([
      {
        label: 'Spend',
        value: 'Lasts the month · 42.00 $ used · today 10.00 $ / 10.00 $',
        percent: 84,
      },
    ])
    expect(stats.metrics.map((row) => row.id)).toEqual([
      'mtdForecast',
      'mtdPace',
      'mtdRunOut',
      'mtdAvg',
      'mtdDaily',
      'mtdToLast',
      'mtdDays',
      'mtdDaysLeft',
      'mtdLeft',
    ])
    expect(stats.metrics.find((row) => row.id === 'mtdDays')?.value).toBe('5')
    expect(stats.metrics.find((row) => row.id === 'mtdDaysLeft')?.value).toBe(
      '17',
    )
    expect(stats.metrics.find((row) => row.id === 'mtdDaily')?.value).toBe(
      '10.00 $',
    )
    expect(stats.metrics.find((row) => row.id === 'mtdPace')?.value).toBe('Under')
    expect(stats.metrics.find((row) => row.id === 'mtdPace')?.tone).toBe('ok')
    expect(stats.metrics.find((row) => row.id === 'mtdRunOut')?.value).toBe(
      'Lasts the month',
    )
    expect(stats.metrics.find((row) => row.id === 'mtdToLast')?.value).toBe(
      '10.47 $',
    )
    expect(stats.metrics.find((row) => row.id === 'mtdLeft')?.value).toBe(
      '178.00 $',
    )
    expect(stats.body).toContain('Bars are cumulative dollars')
    expect(stats.metrics.find((row) => row.id === 'mtdAvg')?.value).toBe(
      '8.40 $',
    )
    expect(stats.metrics.find((row) => row.id === 'mtdForecast')?.value).toBe(
      '184.80 $',
    )
    expect(stats.forecast).toHaveLength(30)
    expect(JSON.stringify(stats).includes('secret@example.com')).toBe(false)
  })

  it('caps the month at the cycle limit after the admin raises it mid-month', () => {
    // Limit 250 → 350 late in Sep; remaining ÷ 3 days left = 32.84 $/day.
    const now = new Date(2026, 8, 28, 18, 0, 0)
    const queries = Array.from({ length: 20 }, (_, index) =>
      query({
        timestamp: new Date(2026, 8, index + 1, 9, 0, 0).getTime(),
        costUsd: 12.5,
      }),
    )
    const stats = toMtdPace(
      ready({
        usedUsd: 250,
        limitUsd: 350,
        remainingUsd: 100,
        dailyBudgetUsd: 100 / 3,
      }),
      queries,
      { now },
    )
    const ideal = stats.series[0]?.ideal ?? []
    expect(ideal[29]).toBeCloseTo(350)
    expect(stats.forecast[29]?.allowanceUsd).toBeCloseTo(350)
    // 28 Sep 2026 = 20th weekday → 20 × 350 / 22.
    expect(stats.chart[27]?.allowanceUsd).toBeCloseTo((20 * 350) / 22)
    expect(stats.metrics.find((row) => row.id === 'mtdLeft')?.value).toBe(
      '100.00 $',
    )
    expect(stats.metrics.find((row) => row.id === 'mtdDaily')?.value).toBe(
      '33.33 $',
    )
  })

  it('keeps Business / Enterprise on dollar axes even when Pro-style quotas leak in', () => {
    const now = new Date(2026, 8, 7, 18, 0, 0)
    const stats = toMtdPace(
      ready({
        plan: 'enterprise',
        spendDisplay: 'usd',
        includedQuotas: [
          { name: 'Cursor Models', used: 25, limit: 100, percent: 25 },
          { name: 'Other Models', used: 31, limit: 100, percent: 31 },
        ],
      }),
      [
        query({ timestamp: new Date(2026, 8, 1, 9, 0, 0).getTime(), costUsd: 12 }),
        query({ timestamp: new Date(2026, 8, 7, 9, 0, 0).getTime(), costUsd: 10 }),
      ],
      { now },
    )
    expect(stats.unit).toBe('usd')
    expect(stats.max).toBeNull()
    expect(stats.series.map((line) => line.label)).toEqual(['Spend'])
    expect(stats.bars[0]?.label).toBe('Spend')
    expect(stats.bars[0]?.value).toContain('$')
    expect(stats.bars[0]?.value).not.toContain('%')
    expect(stats.body).not.toContain('included')
  })

  it('flags over-pace when month spend exceeds the MTD allowance', () => {
    const now = new Date(2026, 8, 2, 18, 0, 0)
    const stats = toMtdPace(
      ready({ dailyBudgetUsd: 10 }),
      [
        query({ timestamp: new Date(2026, 8, 1, 9, 0, 0).getTime(), costUsd: 15 }),
        query({ timestamp: new Date(2026, 8, 2, 9, 0, 0).getTime(), costUsd: 12 }),
      ],
      { now },
    )
    // 2 working days × 10 = 20; used 27.
    expect(stats.value).toBe('')
    expect(stats.verdict).toBe('over')
    expect(stats.overPace).toBe(true)
    expect(stats.bars[0]?.percent).toBe(135)
    expect(stats.metrics.find((row) => row.id === 'mtdPace')?.value).toBe('Over')
    expect(stats.metrics.find((row) => row.id === 'mtdPace')?.tone).toBe('over')
  })

  it('paces Pro included percent against 100% ÷ working days this month', () => {
    const now = new Date(2026, 8, 3, 18, 0, 0)
    const stats = toMtdPace(
      ready({
        plan: 'pro',
        spendDisplay: 'percent',
        dailyBudgetUsd: 0,
        includedQuotas: [
          { name: 'Cursor Models', used: 21, limit: 100, percent: 21 },
          { name: 'Other Models', used: 0, limit: 100, percent: 0 },
        ],
      }),
      [query({ timestamp: now.getTime(), costUsd: 10 })],
      { now },
    )
    // 3 weekdays so far. Even pace = 3 × (100 / 22) ≈ 13.6%. Used 21% → runs out early.
    expect(stats.unit).toBe('percent')
    expect(stats.title).toBe('Monthly cost forecast')
    expect(stats.value).toBe('')
    expect(stats.verdict).toBe('over')
    expect(stats.overPace).toBe(true)
    expect(stats.max).toBe(100)
    expect(stats.bars[0]?.label).toBe('Cursor Models')
    expect(stats.bars[0]?.value).toContain('Runs out')
    expect(stats.bars[0]?.value).toContain('21% used')
    expect(stats.bars[1]?.label).toBe('Other Models')
    expect(stats.bars[1]?.value).toContain('Lasts the month')
    expect(stats.metrics.map((row) => row.id)).toEqual([
      'mtdForecast',
      'mtdPace',
      'mtdRunOut',
      'mtdAvg',
      'mtdDaily',
      'mtdToLast',
      'mtdDays',
      'mtdDaysLeft',
      'mtdLeft',
    ])
    expect(stats.metrics.find((row) => row.id === 'mtdLeft')?.value).toBe('79%')
    expect(stats.metrics.find((row) => row.id === 'mtdDaily')?.value).toBe('4.5%')
    expect(stats.metrics.find((row) => row.id === 'mtdAvg')?.value).toBe('7%')
    expect(stats.metrics.find((row) => row.id === 'mtdForecast')?.value).toBe(
      '154%',
    )
    expect(stats.metrics.find((row) => row.id === 'mtdPace')?.value).toBe('Over')
    expect(stats.metrics.find((row) => row.id === 'mtdPace')?.tone).toBe('over')
    expect(stats.metrics.find((row) => row.id === 'mtdRunOut')?.value).toContain(
      'Cursor Models',
    )
    expect(stats.metrics.find((row) => row.id === 'mtdToLast')?.value).toBe(
      '4.2%',
    )
    expect(stats.metrics.find((row) => row.id === 'mtdDaysLeft')?.value).toBe(
      '19',
    )
    expect(stats.metrics.find((row) => row.id === 'mtdDaysLeft')?.label).toBe(
      'Working days left',
    )
    expect(stats.body).toContain('working-day pace')
    expect(stats.series.map((line) => line.label)).toEqual([
      'Cursor Models',
      'Other Models',
    ])
    expect(stats.series[0]?.used[2]).toBe(21)
    expect(stats.series[0]?.forecast[29]).toBeCloseTo((21 / 3) * 22)
    expect(stats.series[0]?.runOutDate).not.toBeNull()
    expect(stats.series[1]?.used[2]).toBe(0)
    expect(stats.series[1]?.forecast[2]).toBe(0)
    expect(stats.series[1]?.forecast[29]).toBeCloseTo(100)
    expect(stats.series[1]?.runOutDate).toBeNull()
    // Ideal from today: leftover 79% / 19 remaining weekdays.
    expect(stats.series[0]?.ideal[2]).toBe(21)
    expect(stats.series[0]?.ideal[1]).toBeNull()
    expect(stats.series[0]?.ideal[29]).toBeCloseTo(100)
    expect(stats.series[1]?.ideal[2]).toBe(0)
    expect(stats.series[1]?.ideal[29]).toBeCloseTo(100)
    expect(stats.forecast[2]?.allowanceUsd).toBeCloseTo((3 * 100) / 22)
    expect(stats.forecast[29]?.allowanceUsd).toBeCloseTo(100)
  })

  it('uses a working-day forecast as the second figure when there is no daily budget', () => {
    const now = new Date(2026, 8, 2, 12, 0, 0)
    const stats = toMtdPace(
      ready({ dailyBudgetUsd: 0, limitUsd: null, remainingUsd: null }),
      [query({ timestamp: now.getTime(), costUsd: 4 })],
      { now },
    )
    // 2 working days so far × 22 weekdays in Sep 2026 → 4 × 22 / 2 = 44.
    expect(stats.value).toBe('')
    expect(stats.verdict).toBe('ok')
    expect(stats.bars).toEqual([])
    expect(stats.overPace).toBe(false)
    expect(stats.body).toBe(MTD_FORECAST_BODY)
    expect(stats.metrics.find((row) => row.id === 'mtdForecast')?.value).toBe(
      '44.00 $',
    )
  })

  it('hides the meter and forecast when spend exists but no weekday has started', () => {
    const now = new Date(2025, 1, 1, 12, 0, 0)
    const stats = toMtdPace(
      ready(),
      [query({ timestamp: now.getTime(), costUsd: 3 })],
      { now },
    )
    expect(stats.metrics.find((row) => row.id === 'mtdDays')?.value).toBe('0')
    expect(stats.value).toBe('')
    expect(stats.body).toBe(MTD_NO_DAYS_BODY)
    expect(stats.bars).toEqual([])
  })

  it('keeps a dash when there is no budget and no weekday yet', () => {
    const now = new Date(2025, 1, 1, 12, 0, 0)
    const stats = toMtdPace(
      ready({ dailyBudgetUsd: 0, limitUsd: null, remainingUsd: null }),
      [query({ timestamp: now.getTime(), costUsd: 3 })],
      { now },
    )
    expect(stats.value).toBe('')
    expect(stats.body).toBe(MTD_NO_BUDGET_BODY)
    expect(stats.metrics.find((row) => row.id === 'mtdForecast')).toBeUndefined()
  })
})

describe('toMtdChart', () => {
  it('builds one point per calendar day with a rising weekday allowance', () => {
    const now = new Date(2026, 8, 5, 18, 0, 0)
    const series = toMtdChart(
      [
        query({ timestamp: new Date(2026, 8, 1, 9, 0, 0).getTime(), costUsd: 8 }),
        query({ timestamp: new Date(2026, 8, 5, 11, 0, 0).getTime(), costUsd: 2 }),
      ],
      10,
      now,
    )
    expect(series).toHaveLength(5)
    expect(series[0]).toEqual({
      date: '1.09',
      weekday: true,
      workingDayIndex: 1,
      dayUsedUsd: 8,
      usedUsd: 8,
      allowanceUsd: 10,
    })
    expect(series[3]?.weekday).toBe(true)
    expect(series[3]?.workingDayIndex).toBe(4)
    expect(series[3]?.allowanceUsd).toBe(40)
    expect(series[4]).toEqual({
      date: '5.09',
      weekday: false,
      workingDayIndex: null,
      dayUsedUsd: 2,
      usedUsd: 10,
      allowanceUsd: 40,
    })
  })

  it('omits allowance when there is no daily budget', () => {
    const series = toMtdChart([], null, new Date(2026, 8, 2, 12, 0, 0))
    expect(series).toHaveLength(2)
    expect(series.every((point) => point.allowanceUsd === null)).toBe(true)
  })
})

describe('workingDaysInMonth', () => {
  it('counts Mon–Fri in the calendar month', () => {
    expect(workingDaysInMonth(new Date(2026, 8, 3, 12, 0, 0))).toBe(22)
  })
})

describe('calendar day budget basis', () => {
  it('paces month spend across all calendar days', () => {
    const now = new Date(2026, 8, 5, 12, 0, 0)
    const stats = toMtdPace(
      ready({ dailyBudgetUsd: 10, limitUsd: 300, remainingUsd: 200 }),
      [query({ timestamp: now.getTime(), costUsd: 20 })],
      { now, budgetDayBasis: 'calendarDays' },
    )
    // 5 calendar days so far × ($300 ÷ 30 days).
    expect(stats.metrics.find((row) => row.id === 'mtdDays')?.label).toBe(
      'Days so far',
    )
    expect(stats.metrics.find((row) => row.id === 'mtdDays')?.value).toBe('5')
    expect(stats.metrics.find((row) => row.id === 'mtdDaysLeft')?.label).toBe(
      'Calendar days left',
    )
    expect(stats.metrics.find((row) => row.id === 'mtdDaysLeft')?.value).toBe(
      '25',
    )
    expect(stats.forecast).toHaveLength(30)
    expect(stats.forecast[4]?.workingDayIndex).toBe(5)
    expect(stats.forecast[4]?.allowanceUsd).toBe(50)
    expect(stats.forecast[29]?.workingDayIndex).toBe(30)
  })
})

describe('toMtdSeries', () => {
  it('plots actual spend through today and a working-day pace to month end', () => {
    const now = new Date(2026, 8, 3, 18, 0, 0)
    const frames = toMonthFrames(
      [
        query({ timestamp: new Date(2026, 8, 1, 9, 0, 0).getTime(), costUsd: 10 }),
        query({ timestamp: new Date(2026, 8, 3, 11, 0, 0).getTime(), costUsd: 20 }),
      ],
      now,
    )
    const days = toMtdDays(frames, null)
    const line = toMtdSeries('spend', 'Spend', 30, frames, 3)
    expect(days).toHaveLength(30)
    expect(days[0]).toEqual({
      date: '1.09',
      weekday: true,
      workingDayIndex: 1,
      allowanceUsd: null,
    })
    expect(line.day[0]).toBe(10)
    expect(line.used[0]).toBe(10)
    expect(line.forecast[0]).toBe(10)
    expect(days[2]?.workingDayIndex).toBe(3)
    expect(line.day[2]).toBe(20)
    expect(line.used[2]).toBe(30)
    expect(line.forecast[2]).toBe(30)
    expect(line.day[3]).toBeNull()
    expect(line.used[3]).toBeNull()
    expect(line.forecast[3]).toBe(40)
    expect(days[4]?.weekday).toBe(false)
    expect(line.forecast[4]).toBe(40)
    expect(days[29]?.date).toBe('30.09')
    expect(line.forecast[29]).toBe(220)
    expect(line.used[29]).toBeNull()
  })

  it('omits forecast before the first weekday', () => {
    const frames = toMonthFrames([], new Date(2025, 1, 1, 12, 0, 0))
    const line = toMtdSeries('spend', 'Spend', 0, frames, 0)
    expect(frames).toHaveLength(28)
    expect(line.forecast.every((value) => value === null)).toBe(true)
  })

  it('spreads a cycle percent over each day by its pool dollar share', () => {
    const now = new Date(2026, 8, 3, 18, 0, 0)
    const frames = toMonthFrames(
      [
        query({
          timestamp: new Date(2026, 8, 1, 9, 0, 0).getTime(),
          costUsd: 3,
          model: 'cursor-default',
        }),
        query({
          timestamp: new Date(2026, 8, 3, 11, 0, 0).getTime(),
          costUsd: 1,
          model: 'cursor-default',
        }),
        query({
          timestamp: new Date(2026, 8, 2, 10, 0, 0).getTime(),
          costUsd: 50,
          model: 'claude-opus-5-high',
        }),
      ],
      now,
      undefined,
      'cursor',
    )
    const line = toMtdSeries('cursor-models', 'Cursor Models', 20, frames, 3)
    expect(line.day[0]).toBeCloseTo(15)
    expect(line.day[2]).toBeCloseTo(5)
    expect(line.used[2]).toBeCloseTo(20)
  })

  it('plots Pro quotas from separate pool spend, not one shared timeline', () => {
    const now = new Date(2026, 8, 3, 18, 0, 0)
    const queries = [
      query({
        timestamp: new Date(2026, 8, 1, 9, 0, 0).getTime(),
        costUsd: 10,
        model: 'cursor-default',
      }),
      query({
        timestamp: new Date(2026, 8, 3, 11, 0, 0).getTime(),
        costUsd: 30,
        model: 'claude-opus-5-high',
      }),
    ]
    const stats = toMtdPace(
      ready({
        plan: 'pro',
        spendDisplay: 'percent',
        dailyBudgetUsd: 0,
        includedQuotas: [
          { name: 'Cursor Models', used: 40, limit: 100, percent: 40 },
          { name: 'Other Models', used: 60, limit: 100, percent: 60 },
        ],
      }),
      queries,
      { now },
    )
    expect(stats.series[0]?.used[2]).toBeCloseTo(40)
    expect(stats.series[1]?.used[2]).toBeCloseTo(60)
    expect(stats.series[0]?.day[0]).toBeCloseTo(40)
    expect(stats.series[0]?.day[2]).toBeCloseTo(0)
    expect(stats.series[1]?.day[0]).toBeCloseTo(0)
    expect(stats.series[1]?.day[2]).toBeCloseTo(60)
  })

  it('spreads leftover ceiling from today as the ideal budget line', () => {
    const now = new Date(2026, 8, 3, 18, 0, 0)
    const frames = toMonthFrames(
      [query({ timestamp: now.getTime(), costUsd: 10 })],
      now,
    )
    const line = toMtdSeries(
      'cursor-models',
      'Cursor Models',
      21,
      frames,
      3,
      100,
      22,
    )
    expect(line.ideal[0]).toBeNull()
    expect(line.ideal[2]).toBe(21)
    expect(line.ideal[29]).toBeCloseTo(100)
  })

  it('lifts an under-ceiling forecast onto the limit at month end', () => {
    const now = new Date(2026, 8, 30, 18, 0, 0)
    const frames = toMonthFrames([], now)
    const line = toMtdSeries(
      'cursor-models',
      'Cursor Models',
      94,
      frames,
      22,
      100,
      22,
    )
    const prior = frames[28]
    expect(prior?.workingCount).toBeGreaterThan(0)
    expect(line.forecast[28]).toBeCloseTo((prior?.workingCount ?? 0) * (94 / 22))
    expect(line.forecast[29]).toBeCloseTo(100)
    expect(line.runOutDate).toBeNull()
  })

  it('lands the ideal line on the ceiling when today is the last day', () => {
    const now = new Date(2026, 8, 30, 18, 0, 0)
    const frames = toMonthFrames([], now)
    const line = toMtdSeries('spend', 'Spend', 306.62, frames, 22, 350, 22)
    expect(line.ideal[27]).toBeNull()
    expect(line.ideal[28]).toBeCloseTo(306.62)
    expect(line.ideal[29]).toBeCloseTo(350)
  })
})

describe('billing-cycle forecast windows', () => {
  it('uses a continuous billing-cycle axis', () => {
    const billingCycleStart = '2026-09-01T00:00:00.000Z'
    const billingCycleEnd = '2026-10-01T00:00:00.000Z'
    const axis = localBillingCycleAxis(billingCycleStart, billingCycleEnd)
    const stats = toMtdPace(
      ready({ billingCycleStart, billingCycleEnd }),
      [],
      {
        now: new Date(2026, 8, 15, 12, 0, 0),
        forecastWindow: 'billingCycle',
      },
    )
    expect(stats.forecastWindow).toBe('billingCycle')
    expect(stats.billingCycleAvailable).toBe(true)
    expect(stats.chart.map((point) => point.date)).toEqual(axis)
    expect(stats.resetDate).toBeNull()
  })

  it('drops calendar series at a mid-month renewal and marks midday resets', () => {
    const stats = toMtdPace(
      ready({
        billingCycleStart: '2026-09-26T13:51:29.000Z',
        billingCycleEnd: '2026-10-26T13:51:29.000Z',
      }),
      [
        query({
          timestamp: new Date(2026, 8, 28, 10, 0, 0).getTime(),
          costUsd: 9,
        }),
        query({
          timestamp: new Date(2026, 9, 5, 10, 0, 0).getTime(),
          costUsd: 4,
        }),
        query({
          timestamp: new Date(2026, 9, 28, 10, 0, 0).getTime(),
          costUsd: 2,
        }),
      ],
      { now: new Date(2026, 9, 30, 12, 0, 0) },
    )
    expect(stats.forecastWindow).toBe('calendarMonth')
    expect(stats.resetDate).toBe('26.10')
    expect(stats.resetMidday).toBe(true)
    expect(stats.chart[0]?.usedUsd).toBe(9)
    expect(stats.chart[25]?.usedUsd).toBe(0)
    const resetIndex = stats.chart.findIndex(
      (point) => point.date === stats.resetDate,
    )
    expect(resetIndex).toBeGreaterThan(0)
    expect(stats.series[0]?.used[0]).toBe(9)
    expect(stats.series[0]?.used[resetIndex]).toBe(0)
    const forecastBeforeReset = stats.series[0]?.forecast[resetIndex - 1]
    const forecastAtReset = stats.series[0]?.forecast[resetIndex]
    const resetLow = Array.isArray(forecastAtReset) ? forecastAtReset[1] : forecastAtReset
    expect(forecastBeforeReset).toBeGreaterThan(resetLow ?? 0)
  })

  it('keeps Pro day percentages scaled to the active pre-reset cycle', () => {
    const stats = toMtdPace(
      ready({
        plan: 'pro',
        spendDisplay: 'percent',
        dailyBudgetUsd: 0,
        billingCycleStart: '2026-09-26T13:51:29.000Z',
        billingCycleEnd: '2026-10-26T13:51:29.000Z',
        includedQuotas: [
          { name: 'Cursor Models', used: 24, limit: 100, percent: 24 },
        ],
      }),
      [
        query({
          timestamp: new Date(2026, 8, 28, 10, 0, 0).getTime(),
          costUsd: 75,
          model: 'cursor-default',
        }),
        query({
          timestamp: new Date(2026, 9, 3, 10, 0, 0).getTime(),
          costUsd: 25,
          model: 'cursor-default',
        }),
      ],
      { now: new Date(2026, 9, 3, 12, 0, 0) },
    )

    expect(stats.resetDate).toBe('26.10')
    expect(stats.series[0]?.day[2]).toBeCloseTo(6)
    expect(stats.series[0]?.used[2]).toBeCloseTo(24)
    expect(stats.bars[0]?.value).toContain('today 6%')
  })

  it('restarts an under-cap Pro forecast at a future calendar reset', () => {
    const stats = toMtdPace(
      ready({
        plan: 'pro',
        spendDisplay: 'percent',
        dailyBudgetUsd: 0,
        billingCycleStart: '2026-09-26T13:51:29.000Z',
        billingCycleEnd: '2026-10-26T13:51:29.000Z',
        includedQuotas: [
          { name: 'Cursor Models', used: 6, limit: 100, percent: 6 },
        ],
      }),
      [
        query({
          timestamp: new Date(2026, 8, 28, 10, 0, 0).getTime(),
          costUsd: 75,
          model: 'cursor-default',
        }),
        query({
          timestamp: new Date(2026, 9, 3, 10, 0, 0).getTime(),
          costUsd: 25,
          model: 'cursor-default',
        }),
      ],
      { now: new Date(2026, 9, 3, 12, 0, 0) },
    )
    const resetIndex = stats.forecast.findIndex(
      (point) => point.date === stats.resetDate,
    )

    expect(resetIndex).toBeGreaterThan(0)
    expect(stats.series[0]?.forecast[resetIndex - 1]).toBeCloseTo(100)
    expect(stats.series[0]?.forecast[resetIndex]).toEqual([100, 0])
    // Next pace day climbs one step from 0 (not two steps / prior day-1 pace).
    expect(stats.series[0]?.forecast[resetIndex + 1]).toBeCloseTo(3)
  })
})
