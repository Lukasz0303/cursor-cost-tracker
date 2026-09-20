import { describe, expect, it } from 'vitest'
import {
  burstMinutes,
  formatBurnRateToastCopy,
  formatBurnSummary,
  formatMixLabel,
  formatPaceLabel,
  toBurnRatePayload,
} from '../src/burnRate/copy'
import { liveWindow } from '../src/burnRate/window'
import type { UsageQuery } from '../src/usage/types'

function query(partial: Partial<UsageQuery> & { timestamp: number }): UsageQuery {
  return {
    model: 'gpt-5',
    kind: null,
    costUsd: 1.2,
    tokens: 1_200_000,
    inputTokens: 600_000,
    outputTokens: 600_000,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    ...partial,
  }
}

describe('copy helpers', () => {
  it('formats the card summary and mix line', () => {
    expect(formatBurnSummary(3.42, 10)).toBe('3.42 $ / 10 min')
    expect(formatMixLabel(12, 18_400_000)).toBe('12 requests · 18.4M tokens')
    expect(formatPaceLabel(2.84)).toBe('2.8× your normal rate')
    expect(formatPaceLabel(null)).toBeNull()
  })

  it('rounds burst duration from the oldest query in the window', () => {
    const now = 600_000
    const window = liveWindow(
      [
        query({ timestamp: now - 30_000 }),
        query({ timestamp: now - 6 * 60_000 }),
      ],
      10,
      now,
    )
    expect(burstMinutes(window, now, 10)).toBe(6)
  })
})

describe('formatBurnRateToastCopy', () => {
  it('warns that Cursor keeps running', () => {
    const copy = formatBurnRateToastCopy(
      {
        level: 'warning',
        startMs: 0,
        endMs: 600_000,
        oldestMs: 600_000 - 6 * 60_000,
        queryCount: 12,
        costUsd: 4.82,
        tokens: 18_400_000,
        multiplier: null,
      },
      600_000,
      10,
    )
    expect(copy.message).toContain('High burn rate: 4.82 $ in the last 6 minutes')
    expect(copy.message).toContain('12 requests')
    expect(copy.message).toContain('18.4M tokens')
    expect(copy.message).toContain('Warning only — Cursor will keep running.')
  })

  it('says critical does not stop Cursor', () => {
    const copy = formatBurnRateToastCopy(
      {
        level: 'critical',
        startMs: 0,
        endMs: 600_000,
        oldestMs: 60_000,
        queryCount: 24,
        costUsd: 8.41,
        tokens: 31_200_000,
        multiplier: null,
      },
      600_000,
      10,
    )
    expect(copy.message).toContain('Possible runaway cost:')
    expect(copy.message).toContain('This does not stop Cursor.')
  })
})

describe('toBurnRatePayload', () => {
  it('returns null when the guard is off', () => {
    expect(
      toBurnRatePayload({
        queries: [query({ timestamp: 1 })],
        enabled: false,
        windowMinutes: 10,
        warningUsd: 2,
        criticalUsd: 5,
        minQueries: 2,
        nowMs: 1,
        todayUsd: 1,
      }),
    ).toBeNull()
  })

  it('always builds the statistics card while the guard is on', () => {
    const now = 120_000
    const payload = toBurnRatePayload({
      queries: [
        query({ timestamp: now - 1_000, costUsd: 0.4, tokens: 400 }),
        query({ timestamp: now - 2_000, costUsd: 0.4, tokens: 400 }),
      ],
      enabled: true,
      windowMinutes: 10,
      warningUsd: 2,
      criticalUsd: 5,
      minQueries: 2,
      nowMs: now,
      todayUsd: 12.84,
    })
    expect(payload).not.toBeNull()
    expect(payload?.level).toBe('ok')
    expect(payload?.summary).toBe('0.80 $ / 10 min')
    expect(payload?.todayLabel).toBe('Today: 12.84 $')
    expect(payload?.bannerTitle).toBeNull()
    expect(payload?.percent).toBe(16)
  })
})
