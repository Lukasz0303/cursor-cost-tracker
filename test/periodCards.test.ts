import { describe, expect, it } from 'vitest'
import { sharePercents, toPeriodCards } from '../src/ui/periodCards'
import type { UsageQuery } from '../src/usage/types'

function query(partial: Partial<UsageQuery> & { timestamp: number }): UsageQuery {
  return {
    model: 'cursor-default',
    kind: 'USAGE_EVENT_KIND_INCLUDED_IN_BUSINESS',
    costUsd: 1,
    tokens: 100,
    inputTokens: 10,
    outputTokens: 20,
    cacheWriteTokens: 30,
    cacheReadTokens: 40,
    ...partial,
  }
}

describe('sharePercents', () => {
  it('returns zeros when the mix is empty', () => {
    expect(sharePercents([0, 0, 0, 0])).toEqual([0, 0, 0, 0])
  })

  it('rounds to whole percents that sum to 100', () => {
    const percents = sharePercents([1, 1, 1])
    expect(percents.reduce((sum, value) => sum + value, 0)).toBe(100)
    expect(percents).toEqual([34, 33, 33])
  })
})

describe('toPeriodCards', () => {
  const now = new Date(2026, 8, 2, 12, 0, 0)

  it('splits Last N into today, this month, and all time', () => {
    const todayTs = now.getTime()
    const earlierThisMonth = new Date(2026, 8, 1, 8, 0, 0).getTime()
    const lastMonth = new Date(2026, 7, 20, 8, 0, 0).getTime()
    const cards = toPeriodCards(
      [
        query({
          timestamp: todayTs,
          costUsd: 6.29,
          inputTokens: 10,
          outputTokens: 20,
          cacheWriteTokens: 30,
          cacheReadTokens: 40,
        }),
        query({
          timestamp: earlierThisMonth,
          costUsd: 2,
          inputTokens: 0,
          outputTokens: 0,
          cacheWriteTokens: 0,
          cacheReadTokens: 100,
        }),
        query({
          timestamp: lastMonth,
          costUsd: 3,
          inputTokens: 50,
          outputTokens: 0,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
        }),
      ],
      { now },
    )

    expect(cards.map((card) => card.title)).toEqual([
      'Today',
      'This month',
      'All time',
    ])
    expect(cards[0]?.cost).toBe('$6.29')
    expect(cards[0]?.costHint).toBe('≈ API equivalent')
    expect(cards[0]?.summary).toBe('1 message · 80% cache hit')
    expect(cards[0]?.rows[4]).toEqual({
      label: 'Total tokens',
      value: '100',
      total: true,
    })
    expect(cards[1]?.cost).toBe('$8.29')
    expect(cards[1]?.summary).toBe('2 messages · 93% cache hit')
    expect(cards[2]?.cost).toBe('$11.29')
    expect(cards[2]?.summary).toBe('3 messages · 70% cache hit')
  })

  it('still renders empty cards when there are no queries', () => {
    const cards = toPeriodCards([], { now })
    expect(cards).toHaveLength(3)
    expect(cards[0]?.cost).toBe('$0.00')
    expect(cards[0]?.summary).toBe('0 messages · 0% cache hit')
    expect(cards[0]?.shares.every((share) => share.percent === 0)).toBe(true)
  })
})
