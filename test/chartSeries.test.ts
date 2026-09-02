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
  it('orders oldest first and keeps numeric tokens and cost', () => {
    const newer = new Date(2026, 8, 1, 10, 5, 12).getTime()
    const older = newer - 60_000
    const series = toChartSeries(
      [
        query({ timestamp: newer, tokens: 10, costUsd: 2, model: 'cursor-grok' }),
        query({ timestamp: older, tokens: 5, costUsd: 1, model: 'old' }),
      ],
      1000,
    )
    expect(series).toHaveLength(2)
    expect(series[0]?.timestamp).toBe(older)
    expect(series[0]?.tokens).toBe(5)
    expect(series[0]?.costUsd).toBe(1)
    expect(series[1]?.model).toBe('grok')
    expect(series[1]?.time).toBe('1.09.2026, 10:05:12')
  })

  it('keeps the newest N when over the history limit', () => {
    const series = toChartSeries(
      Array.from({ length: 12 }, (_, i) =>
        query({ timestamp: i + 1, tokens: i, costUsd: i }),
      ),
      100,
    )
    expect(series).toHaveLength(12)
    expect(series[0]?.timestamp).toBe(1)
    expect(series[11]?.timestamp).toBe(12)

    const capped = toChartSeries(
      Array.from({ length: 250 }, (_, i) =>
        query({ timestamp: i + 1, tokens: 1, costUsd: 0.01 }),
      ),
      100,
    )
    expect(capped).toHaveLength(100)
    expect(capped[0]?.timestamp).toBe(151)
    expect(capped[99]?.timestamp).toBe(250)
  })
})
