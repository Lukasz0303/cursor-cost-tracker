import { describe, expect, it } from 'vitest'
import { toChartSeries } from '../src/ui/chartSeries'
import type { UsageQuery } from '../src/usage/types'

function query(partial: Partial<UsageQuery> & { timestamp: number }): UsageQuery {
  return {
    model: 'cursor-default',
    kind: 'USAGE_EVENT_KIND_INCLUDED_IN_BUSINESS',
    costUsd: 0.03,
    tokens: 64_755,
    inputTokens: 12_856,
    outputTokens: 168,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    ...partial,
  }
}

describe('toChartSeries', () => {
  it('aggregates one bar per local calendar day, oldest first', () => {
    const day1Morning = new Date(2026, 8, 1, 8, 0, 0).getTime()
    const day1Evening = new Date(2026, 8, 1, 20, 0, 0).getTime()
    const day2 = new Date(2026, 8, 2, 10, 0, 0).getTime()
    const series = toChartSeries(
      [
        query({ timestamp: day2, tokens: 30, costUsd: 3 }),
        query({ timestamp: day1Evening, tokens: 20, costUsd: 2 }),
        query({ timestamp: day1Morning, tokens: 10, costUsd: 1 }),
      ],
      1000,
    )
    expect(series).toHaveLength(2)
    expect(series[0]?.time).toBe('1.09.2026')
    expect(series[0]?.tokens).toBe(30)
    expect(series[0]?.costUsd).toBe(3)
    expect(series[0]?.queryCount).toBe(2)
    expect(series[1]?.time).toBe('2.09.2026')
    expect(series[1]?.tokens).toBe(30)
    expect(series[1]?.costUsd).toBe(3)
    expect(series[1]?.queryCount).toBe(1)
  })

  it('keeps the newest N queries before grouping by day', () => {
    const capped = toChartSeries(
      Array.from({ length: 250 }, (_, i) =>
        query({
          timestamp: new Date(2026, 0, 1 + Math.floor(i / 2), 12, 0, 0).getTime(),
          tokens: 1,
          costUsd: 0.01,
        }),
      ),
      100,
    )
    // Newest 100 queries → 50 days × 2 queries
    expect(capped).toHaveLength(50)
    expect(capped[0]?.queryCount).toBe(2)
    expect(capped[49]?.queryCount).toBe(2)
    expect(capped.reduce((sum, point) => sum + point.tokens, 0)).toBe(100)
  })
})
