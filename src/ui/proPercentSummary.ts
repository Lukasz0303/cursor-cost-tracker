import type { BudgetDayBasis } from '../budgetDayBasis'
import { formatDollars, formatPercentPoint } from '../format'
import { budgetDaysInMonth } from '../usage/parse'
import type { IncludedQuota } from '../usage/types'

/** Spread today’s dollars across the cycle included % (API has no per-day percent). */
export function todayAttributedPercent(
  todayUsd: number,
  monthUsd: number,
  cyclePercent: number,
): number {
  if (!(todayUsd > 0)) {
    return 0
  }
  if (monthUsd > 0.000001) {
    return (todayUsd / monthUsd) * Math.max(0, cyclePercent)
  }
  return Math.max(0, cyclePercent)
}

export function averageNumber(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  let sum = 0
  for (const value of values) {
    sum += value
  }
  return sum / values.length
}

/** Mean of included-quota cycle percents (Cursor Models · Other Models). */
export function averageCyclePercent(quotas: IncludedQuota[]): number | null {
  return averageNumber(quotas.map((quota) => quota.percent))
}

/** Mean of today’s attributed % across included quotas. */
export function averageTodayPercent(
  quotas: IncludedQuota[],
  todayUsd: number,
  monthUsd: number,
): number | null {
  if (quotas.length === 0) {
    return null
  }
  return averageNumber(
    quotas.map((quota) =>
      todayAttributedPercent(todayUsd, monthUsd, quota.percent),
    ),
  )
}

/** Even monthly pace: 100% ÷ pace days this month. */
export function dailyPacePercent(
  now: Date,
  basis: BudgetDayBasis,
): number | null {
  const days = budgetDaysInMonth(now, basis)
  if (!(days > 0)) {
    return null
  }
  return 100 / days
}

/** Status-bar Current for Pro: averaged cycle % vs 100%. */
export function proCurrentStatusText(quotas: IncludedQuota[]): string | null {
  const avg = averageCyclePercent(quotas)
  if (avg === null) {
    return null
  }
  return `${formatPercentPoint(avg)} / 100%`
}

/** Status-bar Today for Pro: averaged today % / daily pace (today $). */
export function proTodayStatusText(
  quotas: IncludedQuota[],
  todayUsd: number,
  monthUsd: number,
  dailyPct: number | null,
): string | null {
  const avg = averageTodayPercent(quotas, todayUsd, monthUsd)
  if (avg === null) {
    return null
  }
  const sum = formatDollars(todayUsd)
  if (dailyPct === null) {
    return `${formatPercentPoint(avg)} (${sum})`
  }
  return `${formatPercentPoint(avg)} / ${formatPercentPoint(dailyPct)} (${sum})`
}
