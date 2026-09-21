import { describe, expect, it } from 'vitest'
import {
  burnMultiplier,
  medianUsd,
  MIN_PACE_BUCKETS,
  normalWindowUsd,
} from '../src/burnRate/pace'
import type { UsageQuery } from '../src/usage/types'

function query(partial: Partial<UsageQuery> & { timestamp: number }): UsageQuery {
  return {
    model: 'gpt-5',
    kind: null,
    costUsd: 0.1,
    tokens: 100,
    inputTokens: 50,
    outputTokens: 50,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    ...partial,
  }
}

describe('medianUsd', () => {
  it('returns the middle value for an odd list', () => {
    expect(medianUsd([0.4, 0.3, 0.3])).toBe(0.3)
  })

  it('averages the two middle values for an even list', () => {
    expect(medianUsd([0.2, 0.4])).toBe(0.3)
  })

  it('returns null for an empty list', () => {
    expect(medianUsd([])).toBeNull()
  })
})

describe('normalWindowUsd', () => {
  const windowMs = 10 * 60_000
  const liveStart = 2_400_000

  it('needs at least three qualifying historic buckets', () => {
    const queries: UsageQuery[] = []
    for (let i = 0; i < MIN_PACE_BUCKETS - 1; i += 1) {
      const end = liveStart - i * windowMs
      queries.push(query({ timestamp: end - 1_000, costUsd: 0.3 }))
      queries.push(query({ timestamp: end - 2_000, costUsd: 0.3 }))
    }
    expect(normalWindowUsd(queries, windowMs, liveStart, 2)).toBeNull()
  })

  it('uses the median of non-overlapping buckets before the live window', () => {
    const queries: UsageQuery[] = []
    const costs = [0.3, 0.3, 0.4]
    for (let i = 0; i < costs.length; i += 1) {
      const end = liveStart - i * windowMs
      const cost = costs[i] ?? 0
      queries.push(query({ timestamp: end - 1_000, costUsd: cost / 2 }))
      queries.push(query({ timestamp: end - 2_000, costUsd: cost / 2 }))
    }
    queries.push(query({ timestamp: liveStart + 1_000, costUsd: 9 }))
    expect(normalWindowUsd(queries, windowMs, liveStart, 2)).toBe(0.3)
  })
})

describe('burnMultiplier', () => {
  it('divides live cost by the normal bucket', () => {
    expect(burnMultiplier(1.2, 0.3)).toBe(4)
  })

  it('returns null when the normal pace is under a cent', () => {
    expect(burnMultiplier(1.2, 0.009)).toBeNull()
    expect(burnMultiplier(1.2, null)).toBeNull()
  })
})
