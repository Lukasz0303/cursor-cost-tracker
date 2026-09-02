import { describe, expect, it } from 'vitest'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
  lastQueriesTitle,
  MAX_HISTORY_LIMIT,
  MIN_HISTORY_LIMIT,
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
})
