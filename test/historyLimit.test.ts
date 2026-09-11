import { describe, expect, it } from 'vitest'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
  lastQueriesHeading,
  lastQueriesTitle,
  MAX_HISTORY_LIMIT,
  MIN_HISTORY_LIMIT,
  sampleSizeLimit,
} from '../src/historyLimit'

describe('clampHistoryLimit', () => {
  it('defaults, clamps to 100–10,000, and rounds', () => {
    expect(clampHistoryLimit(Number.NaN)).toBe(DEFAULT_HISTORY_LIMIT)
    expect(clampHistoryLimit(50)).toBe(MIN_HISTORY_LIMIT)
    expect(clampHistoryLimit(20_000)).toBe(MAX_HISTORY_LIMIT)
    expect(clampHistoryLimit(250.4)).toBe(250)
    expect(clampHistoryLimit(1000)).toBe(1000)
  })
})

describe('lastQueriesTitle', () => {
  it('names the panel after the clamped limit', () => {
    expect(lastQueriesTitle(1000)).toBe('Last 1000 Cursor queries')
    expect(lastQueriesTitle(10)).toBe('Last 100 Cursor queries')
  })

  it('names the panel after a from date', () => {
    expect(lastQueriesHeading(1000, '2026-09-01')).toBe('From 1.09.2026')
    expect(lastQueriesTitle(1000, '2026-09-01')).toBe(
      'From 1.09.2026 Cursor queries',
    )
  })
})

describe('sampleSizeLimit', () => {
  it('uses Last N unless a from date is set', () => {
    expect(sampleSizeLimit(250)).toBe(250)
    expect(sampleSizeLimit(250, '2026-09-01')).toBe(MAX_HISTORY_LIMIT)
    expect(sampleSizeLimit(250, '')).toBe(250)
  })
})
