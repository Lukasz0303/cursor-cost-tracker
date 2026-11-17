import { describe, expect, it } from 'vitest'
import {
  buildCodexWindowChart,
  type CodexWindowChart,
} from '../media/src/charts/codexForecast.js'

const DAY = 24 * 60 * 60 * 1000

function at(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  return new Date(year, month - 1, day, hour, minute, second).getTime()
}

function point(chart: CodexWindowChart, date: string) {
  const index = chart.points.findIndex((row) => row.date === date)
  return {
    index,
    used: index < 0 ? null : chart.used[index],
    forecast: index < 0 ? null : chart.forecast[index],
    allowance: index < 0 ? null : chart.points[index]?.allowanceUsd ?? null,
  }
}

describe('buildCodexWindowChart', () => {
  const windowMs = 7 * DAY
  const currentStart = at(2026, 10, 24, 8, 43, 45)
  const currentEnd = currentStart + windowMs
  const asOf = at(2026, 10, 24, 21, 37, 4)

  function pace(extra: Record<string, unknown> = {}) {
    return {
      kind: '7d',
      unit: 'day',
      used: 20,
      dailyPace: null,
      over: false,
      asOfMs: asOf,
      windowStartMs: currentStart,
      resetsAtMs: currentEnd,
      ...extra,
    }
  }

  function series() {
    return [
      {
        kind: '7d',
        windowMinutes: 10080,
        resetsAt: at(2026, 10, 14, 12, 0, 0) / 1000,
        points: [{ timestamp: at(2026, 10, 7, 18, 0, 0), usedPercent: 8 }],
      },
      {
        kind: '7d',
        windowMinutes: 10080,
        resetsAt: currentEnd / 1000,
        points: [{ timestamp: asOf, usedPercent: 20 }],
      },
    ]
  }

  it('starts at Settings From and still draws through the reset', () => {
    const chart = buildCodexWindowChart({
      pace: pace(),
      series: series(),
      dayRange: { from: at(2026, 9, 1), to: at(2026, 10, 24) },
    })
    expect(chart).not.toBeNull()
    if (chart === null) {
      return
    }
    expect(point(chart, '01.09').index).toBe(0)
    expect(point(chart, '20.09').used).toBeNull()
    expect(point(chart, '20.09').allowance).toBeNull()
    expect(point(chart, '07.10').used).toBe(8)
    expect(point(chart, '07.10').forecast).toBeNull()
    expect(point(chart, '01.11').index).toBe(-1)
    const today = point(chart, '24.10')
    expect(today.used).toBe(20)
    expect(today.forecast).toBe(20)
    expect(today.allowance).toBeCloseTo(9.089781746, 4)
    expect(today.allowance).toBeLessThan(20)
    expect(point(chart, '25.10').index).toBeGreaterThanOrEqual(0)
    expect(chart.resetDate).toBe('31.10')
    expect(chart.resetMidday).toBe(true)
    expect(point(chart, '31.10').index).toBeGreaterThanOrEqual(0)
  })

  it('lifts a pace that stays under the cap up to the reset, and keeps a crossing pace', () => {
    const quiet = buildCodexWindowChart({
      pace: pace(),
      series: series(),
    })
    expect(quiet).not.toBeNull()
    if (quiet === null) {
      return
    }
    expect(point(quiet, '24.10').forecast).toBe(20)
    expect(point(quiet, '31.10').forecast).toBeGreaterThan(100)
    expect(quiet.forecastEnd).toBeCloseTo(140, 4)
    expect(quiet.runOutDate).not.toBeNull()
    expect(quiet.runOutDate).not.toBe('31.10')

    const moving = buildCodexWindowChart({
      pace: pace({ dailyPace: 10, over: false }),
      series: series(),
    })
    expect(moving).not.toBeNull()
    if (moving === null) {
      return
    }
    expect(point(moving, '24.10').forecast).toBe(20)
    expect(point(moving, '25.10').forecast).toBeGreaterThan(20)
    expect(point(moving, '31.10').forecast).toBeGreaterThan(100)

    const fast = buildCodexWindowChart({
      pace: pace({ dailyPace: 40, over: true, used: 50 }),
      series: series(),
    })
    expect(fast).not.toBeNull()
    if (fast === null) {
      return
    }
    expect(point(fast, '24.10').used).toBe(50)
    expect(point(fast, '25.10').forecast).toBeGreaterThan(50)
    expect(fast.runOutDate).not.toBeNull()
    expect(fast.runOutDate).not.toBe('31.10')
  })

  it('ramps a 30 day window from its open and does not call a young 14% reading a run-out', () => {
    const windowMs = 30 * DAY
    const asOf = at(2026, 10, 23, 21, 39, 52)
    const currentEnd = asOf + 8 * DAY
    const currentStart = currentEnd - windowMs
    const ageDays = (asOf - currentStart) / DAY
    const chart = buildCodexWindowChart({
      pace: {
        kind: '30d',
        unit: 'day',
        used: 99,
        dailyPace: 99 / ageDays,
        over: true,
        asOfMs: asOf,
        windowStartMs: currentStart,
        resetsAtMs: currentEnd,
      },
      series: [
        {
          kind: '30d',
          windowMinutes: 30 * 24 * 60,
          resetsAt: currentStart / 1000,
          points: [{ timestamp: at(2026, 9, 20, 12, 0, 0), usedPercent: 7 }],
        },
        {
          kind: '30d',
          windowMinutes: 30 * 24 * 60,
          resetsAt: currentEnd / 1000,
          points: [{ timestamp: asOf, usedPercent: 99 }],
        },
      ],
    })
    expect(chart).not.toBeNull()
    if (chart === null) {
      return
    }
    expect(point(chart, '30.09').index).toBe(-1)
    const early = point(chart, '03.10')
    const before = point(chart, '22.10')
    const sample = point(chart, '23.10')
    const after = point(chart, '24.10')
    expect(early.used).toBeNull()
    expect(before.used).toBeNull()
    expect(sample.used).toBe(99)
    expect(sample.allowance).not.toBeNull()
    expect(sample.allowance).toBeLessThan(99)
    expect(sample.forecast).toBe(99)
    expect(after.used).toBeNull()
    expect(typeof after.forecast).toBe('number')
    expect(after.forecast).toBeGreaterThan(99)
    expect(chart.forecastEnd).toBeGreaterThan(99)
    expect(chart.forecastEnd).toBeLessThan(200)

    const youngAsOf = at(2026, 11, 17, 17, 16, 48)
    const youngStart = youngAsOf - 4 * 60 * 60 * 1000
    const young = buildCodexWindowChart({
      pace: {
        kind: '30d',
        unit: 'day',
        used: 14,
        dailyPace: null,
        over: false,
        asOfMs: youngAsOf,
        windowStartMs: youngStart,
        resetsAtMs: youngStart + windowMs,
      },
      series: [],
    })
    expect(young).not.toBeNull()
    if (young === null) {
      return
    }
    expect(point(young, '01.09').index).toBe(-1)
    expect(point(young, '17.11').used).toBe(14)
    expect(point(young, '17.11').allowance).not.toBeNull()
    expect(point(young, '18.11').forecast).toBeGreaterThan(14)
    expect(point(young, '18.11').forecast).toBeLessThan(100)
    expect(young.forecastEnd).toBeCloseTo(420, 4)
    expect(young.runOutDate).not.toBeNull()
    expect(young.runOutDate).not.toBe('18.11')
    const last = young.points[young.points.length - 1]
    expect(last).toBeDefined()
    if (last === undefined) {
      return
    }
    expect(point(young, last.date).forecast).toBeGreaterThan(100)
  })
})
