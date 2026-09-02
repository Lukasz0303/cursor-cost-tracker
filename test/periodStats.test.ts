import { describe, expect, it } from 'vitest'
import { DEFAULT_SPIKE_TOKEN_THRESHOLD } from '../src/spikes/threshold'
import {
  CACHE_HIT_HINT,
  CURRENT_PRO_BODY,
  CURRENT_TEAM_BODY,
  QUERIES_OVER_TOKEN_WARNING_LABEL,
  SAMPLE_NOTE,
  TODAY_PRO_BODY,
  TODAY_TEAM_NO_BUDGET_BODY,
  TODAY_TEAM_BODY,
  toPeriodStats,
} from '../src/ui/periodStats'
import type { UsageQuery, UsageReady, UsageSnapshot } from '../src/usage/types'

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

function ready(overrides: Partial<UsageReady> = {}): UsageSnapshot {
  return {
    status: 'ready',
    data: {
      email: 'secret@example.com',
      plan: 'business',
      spendDisplay: 'usd',
      includedQuotas: [],
      usedUsd: 20,
      limitUsd: 20,
      remainingUsd: 0,
      todayUsedUsd: 29.05,
      dailyBudgetUsd: 0,
      workingDaysLeft: 22,
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

describe('toPeriodStats', () => {
  it('explains Current and Today with live values from the cycle pool', () => {
    const stats = toPeriodStats(ready(), [], {
      spikeTokenThreshold: DEFAULT_SPIKE_TOKEN_THRESHOLD,
    })
    expect(stats.glossary).toHaveLength(2)
    expect(stats.glossary[0]?.title).toBe('Current')
    expect(stats.glossary[0]?.value).toBe('20.00 $ / 20.00 $')
    expect(stats.glossary[0]?.body).toBe(CURRENT_TEAM_BODY)
    expect(stats.glossary[0]?.bars).toEqual([
      { label: 'Cycle pool', value: '20.00 $ / 20.00 $', percent: 100 },
    ])
    expect(stats.glossary[1]?.title).toBe('Today')
    expect(stats.glossary[1]?.value).toBe('29.05 $ / —')
    expect(stats.glossary[1]?.body).toBe(TODAY_TEAM_NO_BUDGET_BODY)
    expect(stats.glossary[1]?.bars).toEqual([])
    expect(stats.sampleNote).toBe(SAMPLE_NOTE)
    expect(stats.queryCount).toBe(0)
    expect(stats.cycle.find((row) => row.id === 'plan')?.value).toBe('Business')
  })

  it('does not put email into the stats payload', () => {
    const stats = toPeriodStats(ready(), [], {
      spikeTokenThreshold: DEFAULT_SPIKE_TOKEN_THRESHOLD,
    })
    expect(JSON.stringify(stats).includes('secret@example.com')).toBe(false)
    expect(JSON.stringify(stats).includes('cookie')).toBe(false)
  })

  it('shows Pro Current as included percents', () => {
    const stats = toPeriodStats(
      ready({
        plan: 'pro',
        spendDisplay: 'percent',
        includedQuotas: [
          { name: 'Cursor Models', used: 1400, limit: 20000, percent: 7 },
          { name: 'Other Models', used: 0, limit: 100, percent: 0 },
        ],
      }),
      [],
      { spikeTokenThreshold: DEFAULT_SPIKE_TOKEN_THRESHOLD },
    )
    expect(stats.glossary[0]?.value).toBe('7% · 0%')
    expect(stats.glossary[0]?.body).toBe(CURRENT_PRO_BODY)
    expect(stats.glossary[0]?.bars).toEqual([
      { label: 'Cursor Models', value: '7%', percent: 7 },
      { label: 'Other Models', value: '0%', percent: 0 },
    ])
    expect(stats.glossary[1]?.body).toBe(TODAY_PRO_BODY)
    expect(stats.glossary[1]?.bars).toEqual([])
    expect(stats.cycle.find((row) => row.id === 'plan')?.value).toBe('Pro')
    expect(stats.cycle.some((row) => row.label === 'Cursor Models')).toBe(false)
    expect(stats.cycle.some((row) => row.label === 'Remaining')).toBe(false)
    expect(stats.cycle.some((row) => row.label === 'Last 1000 vs Current')).toBe(
      false,
    )
  })

  it('compares Last N list prices with the Current pool', () => {
    const day = new Date(2026, 8, 1, 10, 0, 0).getTime()
    const stats = toPeriodStats(
      ready(),
      [
        query({ timestamp: day, costUsd: 20, model: 'cursor-grok' }),
        query({
          timestamp: day + 1,
          costUsd: 9.05,
          model: 'claude-4',
          kind: 'USAGE_EVENT_KIND_USAGE_BASED',
        }),
      ],
      { spikeTokenThreshold: DEFAULT_SPIKE_TOKEN_THRESHOLD },
    )
    const vs = stats.cycle.find((row) => row.label === 'Last 1000 vs Current')
    expect(vs?.value).toBe('29.05 $ vs 20.00 $')
    expect(stats.sample.find((row) => row.label === 'Last 1000 total')?.value).toBe(
      '29.05 $',
    )
    expect(
      stats.sample.find((row) => row.label === 'Average per query tokens')?.value,
    ).toBe('64.8k')
    expect(stats.sample.find((row) => row.label === 'Queries in Last 1000')).toBe(
      undefined,
    )
    expect(stats.byModel[0]?.label).toBe('grok')
    expect(stats.byModel[0]?.percent).toBe(69)
    expect(stats.byKind.some((row) => row.label === 'Usage Based')).toBe(true)
    expect(stats.sample.find((row) => row.label === 'Most expensive query')).toEqual({
      id: 'priciest',
      label: 'Most expensive query',
      value: '20.00 $',
      detail: 'grok',
      hint: '1.09.2026, 10:00:00',
    })
    expect(stats.sample.find((row) => row.id === 'medianCost')?.value).toBe(
      '14.53 $',
    )
    expect(stats.sample.find((row) => row.id === 'cacheHit')?.value).toBe('0%')
    expect(stats.sample.find((row) => row.id === 'tokens')?.shares?.length).toBe(
      4,
    )
    expect(stats.queryCount).toBe(2)
  })

  it('counts spikes against the warn threshold', () => {
    const stats = toPeriodStats(ready(), [
      query({ timestamp: 2, tokens: 1_000_000 }),
      query({ timestamp: 1, tokens: 10 }),
    ], { spikeTokenThreshold: 1_000_000 })
    expect(stats.sample.find((row) => row.label === QUERIES_OVER_TOKEN_WARNING_LABEL)).toEqual({
      id: 'spikes',
      label: QUERIES_OVER_TOKEN_WARNING_LABEL,
      value: '1',
      hint: 'tokens ≥ 1.0M',
    })
  })

  it('still explains Current and Today while usage is loading', () => {
    const stats = toPeriodStats({ status: 'loading' }, [], {
      spikeTokenThreshold: DEFAULT_SPIKE_TOKEN_THRESHOLD,
    })
    expect(stats.glossary[0]?.value).toBe('—')
    expect(stats.glossary[0]?.bars).toEqual([])
    expect(stats.glossary[0]?.body).toBe(CURRENT_TEAM_BODY)
    expect(stats.glossary[1]?.body).toBe(TODAY_TEAM_BODY)
    expect(stats.historyLimit).toBe(1000)
  })

  it('caps statistics at the configured history limit', () => {
    const stats = toPeriodStats(
      ready(),
      Array.from({ length: 150 }, (_, i) => query({ timestamp: i + 1, tokens: 10 })),
      { spikeTokenThreshold: DEFAULT_SPIKE_TOKEN_THRESHOLD, historyLimit: 100 },
    )
    expect(stats.historyLimit).toBe(100)
    expect(stats.sample.find((row) => row.label === 'Last 100 total')).toBeDefined()
    expect(stats.sampleNote).toBe('Last 100 is recent queries, not Current.')
    expect(stats.queryCount).toBe(100)
  })

  it('shows a Today meter only when a daily budget exists', () => {
    const stats = toPeriodStats(
      ready({ dailyBudgetUsd: 10, remainingUsd: 5, todayUsedUsd: 4 }),
      [],
      { spikeTokenThreshold: DEFAULT_SPIKE_TOKEN_THRESHOLD },
    )
    expect(stats.glossary[1]?.bars).toEqual([
      { label: 'Today', value: '4.00 $ / 10.00 $', percent: 40 },
    ])
  })

  it('adds cache hit, cycle elapsed, and a token mix from the sample', () => {
    const now = new Date('2026-09-02T12:00:00.000Z')
    const stats = toPeriodStats(
      ready(),
      [
        query({
          timestamp: now.getTime(),
          inputTokens: 20,
          outputTokens: 10,
          cacheWriteTokens: 0,
          cacheReadTokens: 80,
          tokens: 110,
          costUsd: 1,
        }),
      ],
      { spikeTokenThreshold: DEFAULT_SPIKE_TOKEN_THRESHOLD, now },
    )
    expect(stats.sample.find((row) => row.id === 'cacheHit')).toEqual({
      id: 'cacheHit',
      label: 'Cache hit',
      value: '80%',
      hint: CACHE_HIT_HINT,
    })
    expect(stats.sample.find((row) => row.id === 'costPerMillion')?.value).toBe(
      '9,090.91 $',
    )
    const tokens = stats.sample.find((row) => row.id === 'tokens')
    expect(tokens?.value).toBe('110')
    expect(tokens?.shares?.map((share) => share.percent)).toEqual([18, 9, 0, 73])
    const cycle = stats.cycle.find((row) => row.id === 'cycle')
    expect(cycle?.hint).toMatch(/^Resets /)
    expect(cycle?.percent).toBe(5)
  })
})
