import { describe, expect, it } from 'vitest'
import {
  codeLinesUntilMs,
  resolveHistorySample,
} from '../src/historySample'
import { MAX_HISTORY_LIMIT } from '../src/historyLimit'

describe('resolveHistorySample', () => {
  const now = new Date(2026, 8, 15, 14, 0, 0)

  it('resolves Last N', () => {
    const sample = resolveHistorySample({
      historyLimit: 500,
      historyFromDate: null,
      historyToDate: null,
      now,
    })
    expect(sample.mode).toBe('lastN')
    if (sample.mode !== 'lastN') {
      return
    }
    expect(sample.limit).toBe(500)
    expect(sample.fetchLimit).toBe(500)
    expect(sample.startMs).toBeNull()
    expect(sample.heading).toBe('Last 500')
  })

  it('resolves open From through today', () => {
    const sample = resolveHistorySample({
      historyLimit: 250,
      historyFromDate: '2026-09-01',
      historyToDate: null,
      now,
    })
    expect(sample.mode).toBe('calendar')
    if (sample.mode !== 'calendar') {
      return
    }
    expect(sample.fetchLimit).toBe(MAX_HISTORY_LIMIT)
    expect(sample.fromDate).toBe('2026-09-01')
    expect(sample.toDate).toBeNull()
    expect(sample.startMs).toBe(new Date(2026, 8, 1).getTime())
    expect(sample.endMs).toBe(
      new Date(2026, 8, 15).getTime() + 24 * 60 * 60 * 1000 - 1,
    )
    expect(sample.heading).toBe('From 1.09.2026')
  })

  it('resolves a closed From–To range', () => {
    const sample = resolveHistorySample({
      historyLimit: 1000,
      historyFromDate: '2026-09-01',
      historyToDate: '2026-09-10',
      now,
    })
    expect(sample.mode).toBe('calendar')
    if (sample.mode !== 'calendar') {
      return
    }
    expect(sample.toDate).toBe('2026-09-10')
    expect(sample.endMs).toBe(
      new Date(2026, 8, 10).getTime() + 24 * 60 * 60 * 1000 - 1,
    )
    expect(sample.heading).toBe('From 1.09.2026–10.09.2026')
    expect(sample.title).toBe('From 1.09.2026–10.09.2026 Cursor queries')
  })

  it('ignores orphan To without From', () => {
    const sample = resolveHistorySample({
      historyLimit: 1000,
      historyFromDate: null,
      historyToDate: '2026-09-10',
      now,
    })
    expect(sample.mode).toBe('lastN')
  })

  it('falls back when To is before From', () => {
    const sample = resolveHistorySample({
      historyLimit: 1000,
      historyFromDate: '2026-09-10',
      historyToDate: '2026-09-01',
      now,
    })
    expect(sample.mode).toBe('calendar')
    if (sample.mode !== 'calendar') {
      return
    }
    expect(sample.toDate).toBeNull()
    expect(sample.endMs).toBe(
      new Date(2026, 8, 15).getTime() + 24 * 60 * 60 * 1000 - 1,
    )
  })
})

describe('codeLinesUntilMs', () => {
  it('uses now when the calendar range ends today', () => {
    const now = new Date(2026, 8, 15, 14, 0, 0)
    const sample = resolveHistorySample({
      historyLimit: 1000,
      historyFromDate: '2026-09-01',
      historyToDate: null,
      now,
    })
    expect(codeLinesUntilMs(sample, now.getTime())).toBe(now.getTime())
  })

  it('uses end of To when To is a past day', () => {
    const now = new Date(2026, 8, 15, 14, 0, 0)
    const sample = resolveHistorySample({
      historyLimit: 1000,
      historyFromDate: '2026-09-01',
      historyToDate: '2026-09-10',
      now,
    })
    expect(codeLinesUntilMs(sample, now.getTime())).toBe(
      new Date(2026, 8, 10).getTime() + 24 * 60 * 60 * 1000 - 1,
    )
  })
})
