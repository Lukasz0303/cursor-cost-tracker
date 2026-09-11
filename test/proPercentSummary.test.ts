import { describe, expect, it } from 'vitest'
import {
  averageCyclePercent,
  averageTodayPercent,
  dailyPacePercent,
  proCurrentStatusText,
  proTodayStatusText,
  todayAttributedPercent,
} from '../src/ui/proPercentSummary'

describe('proPercentSummary', () => {
  it('averages cycle quotas for Current', () => {
    expect(
      averageCyclePercent([
        { name: 'Cursor Models', used: 1, limit: 100, percent: 33 },
        { name: 'Other Models', used: 1, limit: 100, percent: 31 },
      ]),
    ).toBe(32)
    expect(
      proCurrentStatusText([
        { name: 'Cursor Models', used: 1, limit: 100, percent: 33 },
        { name: 'Other Models', used: 1, limit: 100, percent: 31 },
      ]),
    ).toBe('32% / 100%')
  })

  it('averages attributed Today % against daily pace', () => {
    const quotas = [
      { name: 'Cursor Models', used: 1, limit: 100, percent: 33 },
      { name: 'Other Models', used: 1, limit: 100, percent: 31 },
    ]
    // Choose month so today/month * 32% = 3.5% → month = 32/3.5 * 17.12
    const todayUsd = 17.12
    const monthUsd = (32 / 3.5) * todayUsd
    expect(averageTodayPercent(quotas, todayUsd, monthUsd)).toBeCloseTo(3.5, 5)
    expect(todayAttributedPercent(todayUsd, monthUsd, 33)).toBeCloseTo(3.61, 2)
    expect(todayAttributedPercent(todayUsd, monthUsd, 31)).toBeCloseTo(3.39, 2)
    const now = new Date(2026, 8, 1, 12, 0, 0)
    expect(dailyPacePercent(now, 'workingDays')).toBeCloseTo(100 / 22, 5)
    expect(
      proTodayStatusText(quotas, todayUsd, monthUsd, 100 / 22),
    ).toBe('3.5% / 4.5% (17.12 $)')
  })
})
