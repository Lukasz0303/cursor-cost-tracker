import { describe, expect, it } from 'vitest'
import {
  clampCriticalCostUsdThreshold,
  clampCriticalTokenThreshold,
  decideCriticalAlert,
  DEFAULT_CRITICAL_ALERT_GRACE_MS,
  DEFAULT_CRITICAL_COST_USD_THRESHOLD,
  DEFAULT_CRITICAL_TOKEN_THRESHOLD,
  formatCriticalAlertCopy,
  isCriticalQuery,
  newestQuery,
  queryFingerprint,
} from '../src/spikes/criticalAlert'
import type { UsageQuery } from '../src/usage/types'

const DEFAULTS = {
  tokenThreshold: DEFAULT_CRITICAL_TOKEN_THRESHOLD,
  costUsdThreshold: DEFAULT_CRITICAL_COST_USD_THRESHOLD,
}

function query(
  partial: Partial<UsageQuery> & { timestamp: number },
): UsageQuery {
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

describe('isCriticalQuery', () => {
  it('is false just below both default thresholds', () => {
    expect(
      isCriticalQuery(
        query({ timestamp: 1, tokens: 9_999_999, costUsd: 4.99 }),
        DEFAULTS,
      ),
    ).toBe(false)
  })

  it('is true at 10M tokens even when cost is under $5', () => {
    expect(
      isCriticalQuery(
        query({ timestamp: 1, tokens: 10_000_000, costUsd: 0.5 }),
        DEFAULTS,
      ),
    ).toBe(true)
  })

  it('is true at $5 even when tokens are under 10M', () => {
    expect(
      isCriticalQuery(
        query({ timestamp: 1, tokens: 100_000, costUsd: 5 }),
        DEFAULTS,
      ),
    ).toBe(true)
  })

  it('respects custom thresholds', () => {
    const thresholds = { tokenThreshold: 2_000_000, costUsdThreshold: 1.5 }
    expect(
      isCriticalQuery(query({ timestamp: 1, tokens: 1_999_999, costUsd: 1.49 }), thresholds),
    ).toBe(false)
    expect(
      isCriticalQuery(query({ timestamp: 1, tokens: 2_000_000, costUsd: 0.01 }), thresholds),
    ).toBe(true)
    expect(
      isCriticalQuery(query({ timestamp: 1, tokens: 1, costUsd: 1.5 }), thresholds),
    ).toBe(true)
  })
})

describe('newestQuery', () => {
  it('picks the latest timestamp regardless of array order', () => {
    const older = query({ timestamp: 10, tokens: 1 })
    const newer = query({ timestamp: 20, tokens: 2 })
    expect(newestQuery([older, newer])).toBe(newer)
    expect(newestQuery([newer, older])).toBe(newer)
  })

  it('returns undefined for an empty list', () => {
    expect(newestQuery([])).toBeUndefined()
  })
})

describe('decideCriticalAlert', () => {
  const expensive = query({
    timestamp: 50,
    tokens: 12_000_000,
    costUsd: 6.2,
    model: 'composer-1',
  })
  const cheap = query({ timestamp: 40, tokens: 1_000, costUsd: 0.02 })
  const nowMs = expensive.timestamp + 30_000

  it('alerts when a newer last query exceeds the threshold', () => {
    const decision = decideCriticalAlert({
      queries: [cheap, expensive],
      thresholds: DEFAULTS,
      enabled: true,
      lastSeenKey: queryFingerprint(cheap),
      nowMs,
    })
    expect(decision.kind).toBe('alert')
    if (decision.kind !== 'alert') {
      return
    }
    expect(decision.query).toBe(expensive)
    expect(decision.key).toBe(queryFingerprint(expensive))
    expect(decision.breach).toEqual({ tokens: true, cost: true })
  })

  it('does not re-alert the same last query', () => {
    const decision = decideCriticalAlert({
      queries: [expensive],
      thresholds: DEFAULTS,
      enabled: true,
      lastSeenKey: queryFingerprint(expensive),
      nowMs,
    })
    expect(decision).toEqual({ kind: 'skip' })
  })

  it('remembers a historical expensive query on first load instead of blocking', () => {
    const decision = decideCriticalAlert({
      queries: [expensive],
      thresholds: DEFAULTS,
      enabled: true,
      lastSeenKey: undefined,
      nowMs: expensive.timestamp + DEFAULT_CRITICAL_ALERT_GRACE_MS + 1,
    })
    expect(decision).toEqual({
      kind: 'remember',
      key: queryFingerprint(expensive),
    })
  })

  it('still alerts on first load when the expensive query just happened', () => {
    const decision = decideCriticalAlert({
      queries: [expensive],
      thresholds: DEFAULTS,
      enabled: true,
      lastSeenKey: undefined,
      nowMs,
    })
    expect(decision.kind).toBe('alert')
  })

  it('remembers the frontier when disabled or under threshold', () => {
    expect(
      decideCriticalAlert({
        queries: [expensive],
        thresholds: DEFAULTS,
        enabled: false,
        lastSeenKey: undefined,
        nowMs,
      }),
    ).toEqual({ kind: 'remember', key: queryFingerprint(expensive) })
    expect(
      decideCriticalAlert({
        queries: [],
        thresholds: DEFAULTS,
        enabled: true,
        lastSeenKey: undefined,
        nowMs,
      }),
    ).toEqual({ kind: 'skip' })
    expect(
      decideCriticalAlert({
        queries: [cheap],
        thresholds: DEFAULTS,
        enabled: true,
        lastSeenKey: undefined,
        nowMs,
      }),
    ).toEqual({ kind: 'remember', key: queryFingerprint(cheap) })
  })

  it('alerts a later expensive query after a previous one was already shown', () => {
    const later = query({ timestamp: 90, tokens: 11_000_000, costUsd: 1 })
    const decision = decideCriticalAlert({
      queries: [later, expensive],
      thresholds: DEFAULTS,
      enabled: true,
      lastSeenKey: queryFingerprint(expensive),
      nowMs: later.timestamp + 10 * 60_000,
    })
    expect(decision.kind).toBe('alert')
    if (decision.kind !== 'alert') {
      return
    }
    expect(decision.query).toBe(later)
  })
})

describe('clampCritical thresholds', () => {
  it('floors tokens at 1,000 and cost at $0.01', () => {
    expect(clampCriticalTokenThreshold(50)).toBe(1_000)
    expect(clampCriticalTokenThreshold(Number.NaN)).toBe(10_000_000)
    expect(clampCriticalCostUsdThreshold(0)).toBe(0.01)
    expect(clampCriticalCostUsdThreshold(5.126)).toBe(5.13)
    expect(clampCriticalCostUsdThreshold(Number.NaN)).toBe(5)
  })
})

describe('formatCriticalAlertCopy', () => {
  it('names both breaches in the modal copy', () => {
    const copy = formatCriticalAlertCopy(
      query({
        timestamp: new Date(2026, 8, 2, 20, 5, 12).getTime(),
        tokens: 12_400_000,
        costUsd: 6.2,
        model: 'composer-1',
      }),
      DEFAULTS,
      { tokens: true, cost: true },
    )
    expect(copy.message).toBe('Last Cursor query used 12.4M tokens and cost $6.20.')
    expect(copy.detail).toContain('10.0M tokens or $5.00')
    expect(copy.detail).toContain('composer-1')
    expect(copy.detail).toContain('2.09.2026, 20:05:12')
    expect(copy.detail).toContain('You will not be asked about this query again.')
  })

  it('names a token-only or cost-only breach', () => {
    const tokenOnly = formatCriticalAlertCopy(
      query({ timestamp: 1, tokens: 10_000_000, costUsd: 0.4, model: 'composer-1' }),
      DEFAULTS,
      { tokens: true, cost: false },
    )
    expect(tokenOnly.detail).toContain('Tokens exceed your critical alert of 10.0M')
    const costOnly = formatCriticalAlertCopy(
      query({ timestamp: 1, tokens: 20_000, costUsd: 5, model: 'composer-1' }),
      DEFAULTS,
      { tokens: false, cost: true },
    )
    expect(costOnly.detail).toContain('Cost exceeds your critical alert of $5.00')
  })
})
