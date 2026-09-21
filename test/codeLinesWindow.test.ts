import { describe, expect, it } from 'vitest'
import {
  CODE_LINES_FALLBACK_DAYS,
  codeLinesWindowFromSample,
} from '../src/codeLines/window'

describe('codeLinesWindowFromSample', () => {
  const nowMs = Date.UTC(2026, 8, 19, 20, 0, 0)

  it('uses From date midnight through now', () => {
    const window = codeLinesWindowFromSample({
      queries: [{ timestamp: nowMs - 3_600_000 }],
      limit: 1000,
      fromDate: '2026-09-01',
      nowMs,
    })
    expect(window.untilMs).toBe(nowMs)
    const start = new Date(window.sinceMs)
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(8)
    expect(start.getDate()).toBe(1)
    expect(start.getHours()).toBe(0)
  })

  it('uses oldest of last N queries when From date is empty', () => {
    const oldest = nowMs - 10 * 24 * 60 * 60 * 1000
    const window = codeLinesWindowFromSample({
      queries: [
        { timestamp: nowMs - 1_000 },
        { timestamp: oldest },
        { timestamp: nowMs - 5_000 },
      ],
      limit: 3,
      fromDate: '',
      nowMs,
    })
    expect(window.sinceMs).toBe(oldest)
    expect(window.untilMs).toBe(nowMs)
  })

  it('falls back to 90 days when the sample is empty', () => {
    const window = codeLinesWindowFromSample({
      queries: [],
      limit: 1000,
      nowMs,
    })
    expect(window.sinceMs).toBe(
      nowMs - CODE_LINES_FALLBACK_DAYS * 24 * 60 * 60 * 1000,
    )
  })
})
