/** Re-exports the MTD forecast split under `src/ui/mtd/`. */
export {
  MTD_TITLE,
  MTD_NO_BUDGET_BODY,
  MTD_NO_DAYS_BODY,
  MTD_NO_DAYS_BODY_CALENDAR,
  MTD_FORECAST_BODY_WORKING,
  MTD_FORECAST_BODY_CALENDAR,
  MTD_FORECAST_BODY,
  MTD_SPEND_SERIES_LABEL,
  MTD_PERCENT_MAX,
} from './mtd/types'
export type {
  MtdUnit,
  MtdVerdict,
  MtdChartPoint,
  MtdForecastPoint,
  MtdSeries,
  MtdPacePayload,
  MtdPaceOptions,
  DayFrame,
} from './mtd/types'
export {
  toMtdChart,
  toMonthFrames,
  toMtdDays,
  toForecastFrames,
} from './mtd/frames'
export { toMtdSeries } from './mtd/series'
export { toMtdPace, workingDaysInMonth } from './mtd/pace'
