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
  const october7End = at(2026, 10, 14, 12, 0, 0)
  const october19End = at(2026, 10, 26, 12, 0, 0)

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
        resetsAt: october7End / 1000,
        points: [{ timestamp: at(2026, 10, 7, 18, 0, 0), usedPercent: 8 }],
      },
      {
        kind: '7d',
        windowMinutes: 10080,
        resetsAt: october19End / 1000,
        points: [{ timestamp: at(2026, 10, 19, 15, 0, 0), usedPercent: 4 }],
      },
      {
        kind: '7d',
        windowMinutes: 10080,
        resetsAt: currentEnd / 1000,
        points: [{ timestamp: asOf, usedPercent: 20 }],
      },
    ]
  }

  it('holds each Codex window and restarts on the next one', () => {
    const chart = buildCodexWindowChart({
      pace: pace(),
      series: series(),
      dayRange: { from: at(2026, 9, 1), to: at(2026, 10, 24) },
    })
    expect(chart).not.toBeNull()
    if (chart === null) {
      return
    }
    const sep20 = point(chart, '20.09')
    expect(sep20.used).toBeNull()
    expect(sep20.forecast).toBeNull()
    expect(sep20.allowance).toBeNull()
    expect(point(chart, '16.10').used).toBeNull()
    expect(point(chart, '08.10').used).toBe(8)
    expect(point(chart, '14.10').used).toBe(8)
    expect(point(chart, '20.10').used).toBe(4)
    expect(point(chart, '23.10').used).toBe(4)
    expect(point(chart, '07.10').used).toBe(8)
    expect(point(chart, '19.10').used).toBe(4)
    const today = point(chart, '24.10')
    expect(today.used).toBe(20)
    expect(today.forecast).toBe(20)
    expect(today.allowance).toBeCloseTo(9.089781746, 4)
    expect(today.allowance).toBeLessThan(20)
    expect(chart.resetDate).toBe('24.10')
    expect(chart.resetMidday).toBe(true)
    expect(point(chart, '20.09').forecast).toBeNull()
    expect(point(chart, '14.10').forecast).toBeCloseTo(8, 4)
    expect(point(chart, '08.10').forecast).toBeCloseTo((8 * 1.5) / 7, 4)
  })

  it('does not draw a forecast to 100 when pace is empty, and starts it at the sample when pace exists', () => {
    const throughReset = { from: at(2026, 9, 1), to: at(2026, 10, 31) }
    const quiet = buildCodexWindowChart({
      pace: pace(),
      series: series(),
      dayRange: throughReset,
    })
    expect(quiet).not.toBeNull()
    if (quiet === null) {
      return
    }
    expect(point(quiet, '20.09').forecast).toBeNull()
    expect(point(quiet, '24.10').forecast).toBe(20)
    expect(point(quiet, '14.10').forecast).toBeCloseTo(8, 4)
    const quietAge = (asOf - currentStart) / DAY
    const quietReset = 20 + (20 / quietAge) * ((currentEnd - asOf) / DAY)
    expect(point(quiet, '31.10').forecast).toBeCloseTo(quietReset, 4)
    expect(point(quiet, '31.10').forecast).not.toBe(100)

    const moving = buildCodexWindowChart({
      pace: pace({ dailyPace: 10, over: false }),
      series: series(),
      dayRange: throughReset,
    })
    expect(moving).not.toBeNull()
    if (moving === null) {
      return
    }
    expect(point(moving, '20.09').forecast).toBeNull()
    const earlierStart = october19End - windowMs
    expect(point(moving, '23.10').forecast).toBeCloseTo(
      (4 * (at(2026, 10, 24) - earlierStart)) / windowMs,
      4,
    )
    expect(point(moving, '07.10').forecast).toBeCloseTo((8 * 0.5) / 7, 4)
    expect(point(moving, '24.10').forecast).toBe(20)
    const resetDay = point(moving, '31.10')
    const expected = 20 + 10 * ((currentEnd - asOf) / DAY)
    expect(resetDay.forecast).toBeCloseTo(expected, 4)
    expect(resetDay.forecast).not.toBe(100)
    expect(point(moving, '25.10').forecast).toBeGreaterThan(20)
    expect(point(moving, '31.10').index).toBeGreaterThanOrEqual(0)
    expect(point(moving, '01.11').index).toBe(-1)
  })

  it('ramps a 30 day window from its open instead of spiking on the sample day', () => {
    const windowMs = 30 * DAY
    const asOf = at(2026, 10, 23, 21, 39, 52)
    const currentEnd = asOf + 8 * DAY
    const currentStart = currentEnd - windowMs
    const earlierEnd = currentStart
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
          resetsAt: earlierEnd / 1000,
          points: [{ timestamp: at(2026, 9, 20, 12, 0, 0), usedPercent: 7 }],
        },
        {
          kind: '30d',
          windowMinutes: 30 * 24 * 60,
          resetsAt: currentEnd / 1000,
          points: [{ timestamp: asOf, usedPercent: 99 }],
        },
      ],
      dayRange: { from: at(2026, 9, 1), to: at(2026, 10, 25) },
    })
    expect(chart).not.toBeNull()
    if (chart === null) {
      return
    }
    const early = point(chart, '03.10')
    const before = point(chart, '22.10')
    const sample = point(chart, '23.10')
    const after = point(chart, '24.10')
    expect(point(chart, '30.09').used).toBe(7)
    expect(early.used).not.toBeNull()
    expect(before.used).not.toBeNull()
    expect(sample.used).toBe(99)
    if (early.used == null || before.used == null) {
      return
    }
    expect(early.used).toBeGreaterThan(0)
    expect(early.used).toBeLessThan(before.used)
    expect(before.used).toBeLessThan(99)
    expect(sample.allowance).not.toBeNull()
    expect(sample.allowance).toBeLessThan(99)
    expect(sample.forecast).toBe(99)
    expect(after.used).toBeNull()
    expect(typeof after.forecast).toBe('number')
    expect(after.forecast).toBeGreaterThan(99)
    expect(chart.resetDate).toBe('01.10')
    const reset = chart.forecast[point(chart, '01.10').index]
    expect(Array.isArray(reset)).toBe(true)
    expect(chart.runOutDate).toBe('24.10')
    expect(point(chart, '31.10').forecast).toBeGreaterThan(99)
  })
})
