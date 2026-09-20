import { describe, expect, it } from 'vitest'
import {
  burnRateLevel,
  clampBurnRateMinQueries,
  clampBurnRateThresholds,
  clampBurnRateWindowMinutes,
  decideBurnRateAlert,
  evaluateBurnRate,
  formatBurnRateSeenKey,
} from '../src/burnRate/detect'
import { liveWindow } from '../src/burnRate/window'
import type { UsageQuery } from '../src/usage/types'

function query(partial: Partial<UsageQuery> & { timestamp: number }): UsageQuery {
  return {
    model: 'gpt-5',
    kind: null,
    costUsd: 1,
    tokens: 1000,
    inputTokens: 500,
    outputTokens: 500,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    ...partial,
  }
}

describe('clamps', () => {
  it('clamps the window to 2–60 minutes', () => {
    expect(clampBurnRateWindowMinutes(1)).toBe(2)
    expect(clampBurnRateWindowMinutes(10)).toBe(10)
    expect(clampBurnRateWindowMinutes(90)).toBe(60)
    expect(clampBurnRateWindowMinutes('nope')).toBe(10)
  })

  it('raises critical to at least the warning dollar amount', () => {
    expect(clampBurnRateThresholds(3, 1)).toEqual({
      warningUsd: 3,
      criticalUsd: 3,
    })
    expect(clampBurnRateThresholds(2, 5)).toEqual({
      warningUsd: 2,
      criticalUsd: 5,
    })
  })

  it('clamps minQueries to 1–50', () => {
    expect(clampBurnRateMinQueries(0)).toBe(1)
    expect(clampBurnRateMinQueries(2)).toBe(2)
    expect(clampBurnRateMinQueries(99)).toBe(50)
  })
})

describe('burnRateLevel', () => {
  it('is off when the feature is disabled', () => {
    expect(
      burnRateLevel({
        enabled: false,
        queryCount: 12,
        minQueries: 2,
        costUsd: 9,
        warningUsd: 2,
        criticalUsd: 5,
      }),
    ).toBe('off')
  })

  it('stays ok below minQueries so a single expensive query is not this alert', () => {
    expect(
      burnRateLevel({
        enabled: true,
        queryCount: 1,
        minQueries: 2,
        costUsd: 9,
        warningUsd: 2,
        criticalUsd: 5,
      }),
    ).toBe('ok')
  })

  it('uses critical when cost reaches the critical floor', () => {
    expect(
      burnRateLevel({
        enabled: true,
        queryCount: 3,
        minQueries: 2,
        costUsd: 5,
        warningUsd: 2,
        criticalUsd: 5,
      }),
    ).toBe('critical')
  })

  it('uses warning between the two dollar floors', () => {
    expect(
      burnRateLevel({
        enabled: true,
        queryCount: 3,
        minQueries: 2,
        costUsd: 2,
        warningUsd: 2,
        criticalUsd: 5,
      }),
    ).toBe('warning')
  })
})

describe('decideBurnRateAlert', () => {
  const now = 10 * 60_000
  const window = liveWindow(
    [
      query({ timestamp: now - 30_000, costUsd: 3 }),
      query({ timestamp: now - 90_000, costUsd: 2 }),
    ],
    10,
    now,
  )

  it('skips and clears the episode when the level is ok', () => {
    expect(
      decideBurnRateAlert({
        level: 'ok',
        window,
        multiplier: null,
        warningToast: true,
        criticalToast: true,
        lastSeenKey: 'warning:1',
        snoozeUntilMs: 0,
        nowMs: now,
      }),
    ).toEqual({ kind: 'remember', key: '' })
  })

  it('remembers without a toast on first load when the newest query is older than grace', () => {
    const staleNow = now + 6 * 60_000
    const decision = decideBurnRateAlert({
      level: 'warning',
      window,
      multiplier: null,
      warningToast: true,
      criticalToast: true,
      lastSeenKey: undefined,
      snoozeUntilMs: 0,
      nowMs: staleNow,
      graceMs: 5 * 60_000,
    })
    expect(decision.kind).toBe('remember')
    if (decision.kind !== 'remember') {
      return
    }
    expect(decision.key.startsWith('warning:')).toBe(true)
  })

  it('alerts once per episode and skips the same key', () => {
    const first = decideBurnRateAlert({
      level: 'warning',
      window,
      multiplier: 2,
      warningToast: true,
      criticalToast: true,
      lastSeenKey: undefined,
      snoozeUntilMs: 0,
      nowMs: now,
    })
    expect(first.kind).toBe('alert')
    if (first.kind !== 'alert') {
      return
    }
    expect(first.episode.costUsd).toBe(5)
    expect(first.episode.queryCount).toBe(2)
    const again = decideBurnRateAlert({
      level: 'warning',
      window,
      multiplier: 2,
      warningToast: true,
      criticalToast: true,
      lastSeenKey: first.key,
      snoozeUntilMs: 0,
      nowMs: now,
    })
    expect(again).toEqual({ kind: 'skip' })
  })

  it('escalates warning to critical with a new key', () => {
    const floor = Math.floor((now - 30_000) / 60_000)
    const next = decideBurnRateAlert({
      level: 'critical',
      window,
      multiplier: null,
      warningToast: true,
      criticalToast: true,
      lastSeenKey: formatBurnRateSeenKey('warning', floor),
      snoozeUntilMs: 0,
      nowMs: now,
    })
    expect(next.kind).toBe('alert')
    if (next.kind !== 'alert') {
      return
    }
    expect(next.key).toBe(formatBurnRateSeenKey('critical', floor))
    expect(next.episode.level).toBe('critical')
  })

  it('remembers as shown when that level toast is off', () => {
    const decision = decideBurnRateAlert({
      level: 'warning',
      window,
      multiplier: null,
      warningToast: false,
      criticalToast: true,
      lastSeenKey: undefined,
      snoozeUntilMs: 0,
      nowMs: now,
    })
    expect(decision.kind).toBe('remember')
  })

  it('skips while snoozed without rewriting the seen key', () => {
    expect(
      decideBurnRateAlert({
        level: 'warning',
        window,
        multiplier: null,
        warningToast: true,
        criticalToast: true,
        lastSeenKey: undefined,
        snoozeUntilMs: now + 1,
        nowMs: now,
      }),
    ).toEqual({ kind: 'skip' })
  })

  it('alerts after snooze even when the newest query is older than grace', () => {
    const staleNow = now + 6 * 60_000
    const decision = decideBurnRateAlert({
      level: 'warning',
      window,
      multiplier: null,
      warningToast: true,
      criticalToast: true,
      lastSeenKey: undefined,
      snoozeUntilMs: now + 30_000,
      nowMs: staleNow,
      graceMs: 5 * 60_000,
    })
    expect(decision.kind).toBe('alert')
  })
})

describe('evaluateBurnRate', () => {
  it('returns ok with a live window when under the warning floor', () => {
    const now = 1_000_000
    const result = evaluateBurnRate({
      queries: [
        query({ timestamp: now - 1_000, costUsd: 0.2 }),
        query({ timestamp: now - 2_000, costUsd: 0.2 }),
      ],
      enabled: true,
      windowMinutes: 10,
      warningUsd: 2,
      criticalUsd: 5,
      minQueries: 2,
      nowMs: now,
    })
    expect(result.level).toBe('ok')
    expect(result.window.costUsd).toBe(0.4)
    expect(result.multiplier).toBeNull()
  })
})
