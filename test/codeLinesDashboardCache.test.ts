import { afterEach, describe, expect, it } from 'vitest'
import {
  resetDashboardDayCache,
  retainDashboardDays,
  takeDashboardDays,
} from '../src/codeLines/dashboardCache'
import type { DashboardDayEdited } from '../src/codeLines/analyticsParse'

const full: DashboardDayEdited[] = [{ date: '2026-09-01', edited: 68_096 }]
const short: DashboardDayEdited[] = [{ date: '2026-09-20', edited: 23_474 }]

afterEach(() => {
  resetDashboardDayCache()
})

describe('retainDashboardDays', () => {
  it('keeps a full window when a later body is about a third of it', () => {
    expect(retainDashboardDays(full, short)).toEqual(full)
  })

  it('keeps the stored window when the next fetch fails', () => {
    expect(retainDashboardDays(full, null)).toEqual(full)
    expect(retainDashboardDays(full, [])).toEqual(full)
  })

  it('accepts a larger recount of the same window', () => {
    expect(retainDashboardDays(short, full)).toEqual(full)
  })

  it('returns nothing when both sides are empty', () => {
    expect(retainDashboardDays(null, null)).toEqual([])
  })
})

describe('takeDashboardDays', () => {
  const sinceMs = Date.UTC(2026, 8, 1)
  const untilMs = Date.UTC(2026, 9, 2, 23, 59, 59)

  it('reuses the full total for the same calendar window after a short body', () => {
    expect(takeDashboardDays(sinceMs, untilMs, full)).toEqual(full)
    expect(takeDashboardDays(sinceMs + 60_000, untilMs - 1000, short)).toEqual(
      full,
    )
    expect(takeDashboardDays(sinceMs, untilMs, null)).toEqual(full)
  })

  it('does not reuse a total from a different day range', () => {
    takeDashboardDays(sinceMs, untilMs, full)
    const other = takeDashboardDays(
      Date.UTC(2026, 7, 1),
      Date.UTC(2026, 7, 31),
      short,
    )
    expect(other).toEqual(short)
  })
})
