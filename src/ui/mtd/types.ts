import { EN } from '../../i18n'
import type { BudgetDayBasis } from '../../budgetDayBasis'
import type { ForecastWindow } from '../../forecastWindow'
import type { Locale } from '../../locale'
import type { PeriodBar, PeriodMetric } from '../periodStats'

export const MTD_TITLE = EN.mtd.title
export const MTD_NO_BUDGET_BODY = EN.mtd.noBudget
export const MTD_NO_DAYS_BODY = EN.mtd.noDays
export const MTD_NO_DAYS_BODY_CALENDAR = EN.mtd.noDaysCalendar
export const MTD_FORECAST_BODY_WORKING = EN.mtd.forecastWorking
export const MTD_FORECAST_BODY_CALENDAR = EN.mtd.forecastCalendar
/** @deprecated Prefer MTD_FORECAST_BODY_WORKING; kept for existing imports. */
export const MTD_FORECAST_BODY = MTD_FORECAST_BODY_WORKING
export const MTD_SPEND_SERIES_LABEL = EN.mtd.spend
/** Included quota tops out at 100%; on-demand spend has no ceiling. */
export const MTD_PERCENT_MAX = 100

export type MtdUnit = 'usd' | 'percent'
/** Hero answer: lasts, over even-pace but still finishes, or runs out early. */
export type MtdVerdict = 'ok' | 'tight' | 'over'

export type MtdChartPoint = {
  date: string
  weekday: boolean
  workingDayIndex: number | null
  dayUsedUsd: number
  usedUsd: number
  allowanceUsd: number | null
}

export type MtdForecastPoint = {
  date: string
  weekday: boolean
  workingDayIndex: number | null
  allowanceUsd: number | null
}

export type MtdSeries = {
  id: string
  label: string
  /** That day only. `null` after today. */
  day: (number | null)[]
  /** Cumulative through that day. `null` after today. */
  used: (number | null)[]
  /** Working-day pace projected across the whole month. At reset, `[prevCumulative, 0]`. */
  forecast: (number | null | [number, number])[]
  /**
   * From today: leftover ceiling spread evenly over remaining working days
   * (lands on the limit at month end). `null` before today.
   */
  ideal: (number | null)[]
  /** First calendar day the forecast hits the ceiling, or `null` if it lasts. */
  runOutDate: string | null
  /** Short status for meters / tooltips, e.g. `Runs out ~22.09`. */
  runOutLabel: string
}

export type MtdPacePayload = {
  title: string
  /** Kept for layout compatibility; UI no longer shows a hero verdict. */
  value: string
  body: string
  bars: PeriodBar[]
  metrics: PeriodMetric[]
  overPace: boolean
  verdict: MtdVerdict
  unit: MtdUnit
  /** Fixed axis ceiling (100 for included percent), or `null` to scale to data. */
  max: number | null
  chart: MtdChartPoint[]
  forecast: MtdForecastPoint[]
  series: MtdSeries[]
  forecastWindow: ForecastWindow
  billingCycleAvailable: boolean
  resetDate: string | null
  resetMidday: boolean
}

export type MtdPaceOptions = {
  historyLimit?: number
  historyFromDate?: string | null
  historyToDate?: string | null
  now?: Date
  budgetDayBasis?: BudgetDayBasis
  forecastWindow?: ForecastWindow
  locale?: Locale
}

export type DayFrame = {
  date: string
  weekday: boolean
  workingDayIndex: number | null
  /** Pace days from the 1st through this day. Plateaus on non-pace days. */
  workingCount: number
  future: boolean
  usd: number
  reset: boolean
  paceCount: number
}
