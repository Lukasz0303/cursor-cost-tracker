import { describe, expect, it } from 'vitest'
import {
  analyticsChunks,
  ANALYTICS_MAX_SPAN_MS,
  linesEditedFromDayRow,
  parseUserAnalyticsDays,
  sumDashboardEdited,
} from '../src/codeLines/analyticsParse'

describe('linesEditedFromDayRow', () => {
  it('prefers accepted add + delete', () => {
    expect(
      linesEditedFromDayRow({
        acceptedLinesAdded: 8000,
        acceptedLinesDeleted: 8550,
        totalLinesAdded: 1,
        totalLinesDeleted: 1,
      }),
    ).toBe(16_550)
  })
})

describe('parseUserAnalyticsDays', () => {
  it('sums dailyMetrics like the dashboard heatmap', () => {
    const days = parseUserAnalyticsDays({
      dailyMetrics: [
        {
          day: '2026-09-01',
          acceptedLinesAdded: 8000,
          acceptedLinesDeleted: 8550,
        },
        {
          day: '2026-09-06',
          acceptedLinesAdded: 10_000,
          acceptedLinesDeleted: 9788,
        },
      ],
    })
    expect(days).toEqual([
      { date: '2026-09-01', edited: 16_550 },
      { date: '2026-09-06', edited: 19_788 },
    ])
    expect(sumDashboardEdited(days)).toBe(36_338)
  })
})

describe('analyticsChunks', () => {
  it('keeps a 20-day window in one request', () => {
    const start = Date.UTC(2026, 8, 1)
    const end = start + 19 * 24 * 60 * 60 * 1000
    expect(analyticsChunks(start, end)).toHaveLength(1)
  })

  it('splits spans longer than 30 days', () => {
    const start = 0
    const end = ANALYTICS_MAX_SPAN_MS + 1
    expect(analyticsChunks(start, end).length).toBeGreaterThan(1)
  })
})
