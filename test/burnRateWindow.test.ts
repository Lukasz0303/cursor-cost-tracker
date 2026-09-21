import { describe, expect, it } from 'vitest'
import { liveWindow, queryInLiveWindow } from '../src/burnRate/window'
import type { UsageQuery } from '../src/usage/types'

function query(partial: Partial<UsageQuery> & { timestamp: number }): UsageQuery {
  return {
    model: 'gpt-5',
    kind: null,
    costUsd: 0.5,
    tokens: 1000,
    inputTokens: 500,
    outputTokens: 500,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    ...partial,
  }
}

describe('liveWindow', () => {
  const now = 3_000_000

  it('keeps queries inside [now - W, now] newest first', () => {
    const window = liveWindow(
      [
        query({ timestamp: now - 60_000, costUsd: 1, tokens: 100 }),
        query({ timestamp: now - 120_000, costUsd: 2, tokens: 200 }),
        query({ timestamp: now - 11 * 60_000, costUsd: 9, tokens: 900 }),
        query({ timestamp: now + 1, costUsd: 4, tokens: 40 }),
      ],
      10,
      now,
    )
    expect(window.startMs).toBe(now - 10 * 60_000)
    expect(window.endMs).toBe(now)
    expect(window.queryCount).toBe(2)
    expect(window.costUsd).toBe(3)
    expect(window.tokens).toBe(300)
    expect(window.queries[0]?.timestamp).toBe(now - 60_000)
    expect(window.queries[1]?.timestamp).toBe(now - 120_000)
  })

  it('excludes timestamps after now so idle time ages rows out', () => {
    const window = liveWindow(
      [query({ timestamp: now + 5_000, costUsd: 8 })],
      10,
      now,
    )
    expect(window.queryCount).toBe(0)
    expect(window.costUsd).toBe(0)
  })

  it('includes a query exactly on the start edge', () => {
    const start = now - 10 * 60_000
    const window = liveWindow([query({ timestamp: start, costUsd: 0.2 })], 10, now)
    expect(window.queryCount).toBe(1)
    expect(queryInLiveWindow(start, window)).toBe(true)
  })
})
