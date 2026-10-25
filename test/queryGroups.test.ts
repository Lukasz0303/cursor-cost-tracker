import { describe, expect, it } from 'vitest'
import { historyRowSample, toHistoryRows } from '../src/ui/historyRows'
import { toQueryGroups } from '../src/ui/queryGroups'
import type { UsageQuery } from '../src/usage/types'

const DAY = new Date(2026, 9, 3, 12, 0, 0).getTime()

function query(
  partial: Partial<UsageQuery> & Pick<UsageQuery, 'timestamp'>,
): UsageQuery {
  return {
    model: 'claude-4.5-sonnet',
    kind: 'USAGE_EVENT_KIND_USAGE_BASED',
    costUsd: 1,
    tokens: 100,
    inputTokens: 40,
    outputTokens: 30,
    cacheWriteTokens: 20,
    cacheReadTokens: 10,
    ...partial,
  }
}

describe('toQueryGroups', () => {
  it('merges two conversations that share a title and optimizes the dearest id', () => {
    const groups = toQueryGroups(
      [
        query({
          timestamp: DAY + 2000,
          conversationId: 'alpha',
          tokens: 500,
          costUsd: 0.5,
        }),
        query({
          timestamp: DAY + 1000,
          conversationId: 'beta',
          tokens: 2_000_000,
          costUsd: 3,
        }),
      ],
      { titles: { alpha: 'Fix login bug', beta: 'fix  Login Bug' } },
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]?.title).toBe('Fix login bug')
    expect(groups[0]?.ids).toEqual(['alpha', 'beta'])
    expect(groups[0]?.queryCount).toBe(2)
    expect(groups[0]?.optimizable).toBe(true)
    expect(groups[0]?.optimizeId).toBe('beta')
    expect(groups[0]?.optimizeTimestamp).toBe(DAY + 1000)
    expect(groups[0]?.spike).toBe(true)
  })

  it('keeps one conversation optimizable and sums its totals', () => {
    const groups = toQueryGroups(
      [
        query({
          timestamp: DAY + 2000,
          conversationId: 'alpha',
          costUsd: 0.25,
          tokens: 1200,
          inputTokens: 900,
          outputTokens: 300,
        }),
        query({
          timestamp: DAY,
          conversationId: 'alpha',
          costUsd: 1.5,
          tokens: 800,
          inputTokens: 500,
          outputTokens: 300,
        }),
      ],
      { titles: { alpha: 'Refactor parser' } },
    )

    expect(groups[0]?.cost).toBe('1.75 $')
    expect(groups[0]?.tokens).toBe('2,000')
    expect(groups[0]?.inputOutput).toBe('1,400 / 600')
    expect(groups[0]?.model).toBe('claude-4.5-sonnet')
    expect(groups[0]?.optimizable).toBe(true)
    expect(groups[0]?.optimizeId).toBe('alpha')
    expect(groups[0]?.optimizeTimestamp).toBe(DAY + 2000)
    expect(groups[0]?.rangeLabel).toContain('→')
  })

  it('folds untitled CLI threads into one row per local hour', () => {
    const hour12 = new Date(2026, 9, 3, 12, 10, 0).getTime()
    const hour12later = new Date(2026, 9, 3, 12, 40, 0).getTime()
    const namedAt = new Date(2026, 9, 3, 12, 50, 0).getTime()
    const hour13 = new Date(2026, 9, 3, 13, 5, 0).getTime()
    const groups = toQueryGroups(
      [
        query({ timestamp: hour13, conversationId: 'cccc1111aaaa' }),
        query({ timestamp: namedAt, conversationId: 'named-one' }),
        query({ timestamp: hour12later, conversationId: 'bbbb2222bbbb' }),
        query({ timestamp: hour12, conversationId: 'aaaa3333aaaa' }),
        query({ timestamp: hour12 - 60_000 }),
      ],
      { titles: { 'named-one': 'Real chat', aaaa3333aaaa: '#aaaa3333' } },
    )

    expect(groups.map((group) => group.title)).toEqual([
      '3.10.2026, 13:00–14:00',
      'Real chat',
      '3.10.2026, 12:00–13:00',
      'Ungrouped',
    ])
    expect(groups[0]?.cli).toBe(true)
    expect(groups[0]?.kind).toBe('CLI')
    expect(groups[0]?.ids).toEqual(['cccc1111aaaa'])
    expect(groups[1]?.cli).toBe(false)
    expect(groups[1]?.kind).not.toBe('CLI')
    expect(groups[2]?.cli).toBe(true)
    expect(groups[2]?.named).toBe(false)
    expect(groups[2]?.ids).toEqual(['bbbb2222bbbb', 'aaaa3333aaaa'])
    expect(groups[2]?.queryCount).toBe(2)
    expect(groups[3]?.cli).toBe(false)
    expect(groups[3]?.ids).toEqual([])
    expect(groups[3]?.optimizable).toBe(false)
  })

  it('keeps one CLI thread on the hour of its newest request', () => {
    const early = new Date(2026, 9, 3, 12, 10, 0).getTime()
    const late = new Date(2026, 9, 3, 13, 5, 0).getTime()
    const groups = toQueryGroups([
      query({ timestamp: late, conversationId: 'thread-a' }),
      query({ timestamp: early, conversationId: 'thread-a' }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.title).toBe('3.10.2026, 13:00–14:00')
    expect(groups[0]?.queryCount).toBe(2)
    expect(groups[0]?.ids).toEqual(['thread-a'])
    expect(groups[0]?.cli).toBe(true)
  })

  it('marks a group when any request is over Warn at and honours the toggle', () => {
    const sample = [
      query({ timestamp: DAY + 1000, conversationId: 'alpha', tokens: 2_000_000 }),
      query({ timestamp: DAY, conversationId: 'alpha' }),
    ]
    const warned = toQueryGroups(sample, { titles: { alpha: 'Big chat' } })
    expect(warned[0]?.spike).toBe(true)
    expect(warned[0]?.tokens.startsWith('! ')).toBe(true)

    const quiet = toQueryGroups(sample, {
      titles: { alpha: 'Big chat' },
      showSpikeWarning: false,
    })
    expect(quiet[0]?.spike).toBe(false)
    expect(quiet[0]?.tokens.startsWith('!')).toBe(false)
  })

  it('summarizes mixed models and kinds without a seventh column', () => {
    const groups = toQueryGroups(
      [
        query({ timestamp: DAY + 1000, conversationId: 'alpha', model: 'gpt-5' }),
        query({
          timestamp: DAY,
          conversationId: 'alpha',
          model: 'claude-4.5-sonnet',
          kind: 'USAGE_EVENT_KIND_INCLUDED_IN_PRO',
        }),
      ],
      { titles: { alpha: 'Mixed chat' } },
    )

    expect(groups[0]?.model).toBe('gpt-5 +1')
    expect(groups[0]?.kind).toBe('Usage Based +1')
  })

  it('orders groups newest first with row indexes into the rendered sample', () => {
    const queries = [
      query({ timestamp: DAY, conversationId: 'older' }),
      query({ timestamp: DAY + 5000, conversationId: 'newer' }),
      query({ timestamp: DAY + 1000, conversationId: 'older' }),
    ]
    const titles = { older: 'Older chat', newer: 'Newer chat' }
    const sample = historyRowSample(queries, 1000)
    const rows = toHistoryRows(queries, {
      spikeTokenThreshold: 1_000_000,
      showSpikeWarning: true,
      conversationTitles: titles,
    })
    const groups = toQueryGroups(sample, { titles })

    expect(groups.map((group) => group.title)).toEqual([
      'Newer chat',
      'Older chat',
    ])
    const olderRows = (groups[1]?.rowIndexes ?? []).map((index) => rows[index])
    expect(olderRows.map((row) => row?.conversationTitle)).toEqual([
      'Older chat',
      'Older chat',
    ])
    expect(groups[1]?.rowIndexes).toEqual([1, 2])
  })

  it('returns no groups for an empty sample', () => {
    expect(toQueryGroups([])).toEqual([])
  })
})
