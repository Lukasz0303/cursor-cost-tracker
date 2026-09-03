import { describe, expect, it } from 'vitest'
import {
  HISTORY_ROW_KEYS,
  historyDataPayload,
  payloadForSnapshot,
  toHistoryRows,
  visibleHistoryRows,
} from '../src/ui/historyRows'
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

describe('toHistoryRows', () => {
  it('formats rows newest first and caps at the history limit', () => {
    const newer = new Date(2026, 8, 1, 10, 5, 12).getTime()
    const older = newer - 60_000
    const rows = toHistoryRows([
      query({ timestamp: older, model: 'old-model' }),
      query({ timestamp: newer, model: 'cursor-default' }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]?.time).toBe('1.09.2026, 10:05:12')
    expect(rows[0]?.model).toBe('default')
    expect(rows[0]?.cost).toBe('0.03 $')
    expect(rows[0]?.tokens).toBe('64,755')
    expect(rows[0]?.inputOutput).toBe('12,856 / 168')
    expect(rows[0]?.kind).toBe('Included In Business')
    expect(rows[1]?.model).toBe('old-model')

    const many = Array.from({ length: 120 }, (_, i) =>
      query({ timestamp: newer + i, tokens: i }),
    )
    expect(toHistoryRows(many, { historyLimit: 100 })).toHaveLength(100)
    expect(toHistoryRows(many, { historyLimit: 100 })[0]?.tokens).toBe('119')
    expect(toHistoryRows(many)).toHaveLength(120)
  })

  it('prefixes ! on TOKENS when the query is a spike', () => {
    const rows = toHistoryRows(
      [query({ timestamp: 1, tokens: 1_000_000 })],
      { spikeTokenThreshold: 1_000_000, showSpikeWarning: true },
    )
    expect(rows[0]?.tokens).toBe('! 1,000,000')
    expect(rows[0]?.spike).toBe(true)
  })

  it('marks non-spike rows without a bang', () => {
    const rows = toHistoryRows(
      [query({ timestamp: 1, tokens: 64_755 })],
      { spikeTokenThreshold: 1_000_000, showSpikeWarning: true },
    )
    expect(rows[0]?.spike).toBe(false)
  })

  it('uses an em dash for missing model', () => {
    const rows = toHistoryRows([
      query({ timestamp: 1, model: null }),
    ])
    expect(rows[0]?.model).toBe('—')
  })
})

describe('visibleHistoryRows', () => {
  it('keeps every row when the over-limit filter is off', () => {
    const rows = toHistoryRows(
      [
        query({ timestamp: 2, tokens: 1_000_000 }),
        query({ timestamp: 1, tokens: 10 }),
      ],
      { spikeTokenThreshold: 1_000_000, showSpikeWarning: true },
    )
    expect(visibleHistoryRows(rows, false)).toHaveLength(2)
  })

  it('keeps only spike rows when the over-limit filter is on', () => {
    const rows = toHistoryRows(
      [
        query({ timestamp: 2, tokens: 1_000_000 }),
        query({ timestamp: 1, tokens: 10 }),
      ],
      { spikeTokenThreshold: 1_000_000, showSpikeWarning: true },
    )
    const visible = visibleHistoryRows(rows, true)
    expect(visible).toHaveLength(1)
    expect(visible[0]?.tokens).toBe('! 1,000,000')
  })

  it('finds no spike rows when warnings are off', () => {
    const rows = toHistoryRows(
      [query({ timestamp: 1, tokens: 1_000_000 })],
      { spikeTokenThreshold: 1_000_000, showSpikeWarning: false },
    )
    expect(rows[0]?.spike).toBe(false)
    expect(visibleHistoryRows(rows, true)).toEqual([])
  })
})

describe('historyDataPayload', () => {
  it('only serializes table fields — never cookie or token names', () => {
    const payload = historyDataPayload(
      [query({ timestamp: new Date(2026, 8, 1, 10, 5, 12).getTime() })],
      undefined,
      { spikeTokenThreshold: 1_000_000, showSpikeWarning: true, extensionVersion: '0.7.4' },
    )
    const json = JSON.stringify(payload)
    expect(json.includes('cookie')).toBe(false)
    expect(json.includes('accessToken')).toBe(false)
    expect(json.includes('WorkosCursorSessionToken')).toBe(false)
    expect(json.includes('Authorization')).toBe(false)
    expect(Object.keys(payload).sort()).toEqual([
      'charts',
      'criticalCostUsdThreshold',
      'criticalTokenThreshold',
      'events',
      'extensionVersion',
      'historyLimit',
      'minimalMode',
      'mtd',
      'okColor',
      'periods',
      'pollIntervalMinutes',
      'recentQueryCount',
      'refreshing',
      'showCriticalAlert',
      'showSpikeWarning',
      'showStatusBar',
      'showToday',
      'spikeTokenThreshold',
      'stats',
      'statusBarPreview',
      'type',
      'warnColor',
    ])
    expect(payload.refreshing).toBe(false)
    expect(payload.pollIntervalMinutes).toBe(1)
    expect(payload.showCriticalAlert).toBe(true)
    expect(payload.criticalTokenThreshold).toBe(10_000_000)
    expect(payload.criticalCostUsdThreshold).toBe(5)
    expect(payload.showStatusBar).toBe(true)
    expect(payload.showToday).toBe(true)
    expect(payload.minimalMode).toBe(false)
    expect(payload.recentQueryCount).toBe(3)
    expect(payload.statusBarPreview.length).toBeGreaterThan(0)
    expect(payload.statusBarPreview.some((chip) => chip.id === 'budget' && chip.visible)).toBe(
      true,
    )
    expect(JSON.stringify(payload.statusBarPreview).includes('email')).toBe(false)
    expect(
      historyDataPayload([], undefined, { refreshing: true }).refreshing,
    ).toBe(true)
    expect(payload.historyLimit).toBe(1000)
    expect(payload.charts).toHaveLength(1)
    expect(payload.periods).toHaveLength(3)
    expect(payload.periods[2]?.id).toBe('all')
    expect(payload.mtd.title).toBe('Monthly cost forecast')
    expect(payload.mtd.verdict).toBeTruthy()
    expect(Array.isArray(payload.mtd.chart)).toBe(true)
    expect(Array.isArray(payload.mtd.forecast)).toBe(true)
    expect(payload.charts[0]?.tokens).toBe(64_755)
    expect(payload.charts[0]?.costUsd).toBe(0.03)
    expect(payload.extensionVersion).toBe('0.7.4')
    expect(payload.spikeTokenThreshold).toBe(1_000_000)
    const row = payload.events[0]
    expect(row).toBeDefined()
    if (!row) {
      return
    }
    expect(Object.keys(row).sort()).toEqual([...HISTORY_ROW_KEYS].sort())
  })
})

describe('payloadForSnapshot', () => {
  it('keeps cached rows on error instead of clearing the table', () => {
    const cached = [query({ timestamp: 2 })]
    const payload = payloadForSnapshot(
      { status: 'error', message: 'Sign in to Cursor' },
      cached,
    )
    expect(payload.events).toHaveLength(1)
    expect(payload.message).toBeUndefined()
  })

  it('surfaces a generic error only when the table is empty', () => {
    const payload = payloadForSnapshot(
      { status: 'error', message: 'Sign in to Cursor' },
      [],
    )
    expect(payload.events).toEqual([])
    expect(payload.message).toBe('Sign in to Cursor')
  })

  it('includes period stats and never serializes email', () => {
    const payload = payloadForSnapshot(
      {
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
        },
      },
      [query({ timestamp: 1, costUsd: 1 })],
    )
    expect(payload.stats.glossary[0]?.title).toBe('Current')
    expect(payload.stats.glossary[1]?.title).toBe('Today')
    const json = JSON.stringify(payload)
    expect(json.includes('secret@example.com')).toBe(false)
    expect(json.includes('cookie')).toBe(false)
  })
})
