import {
  DEFAULT_BUDGET_DAY_BASIS,
  type BudgetDayBasis,
} from '../budgetDayBasis'
import { formatDollars, formatPercentPoint } from '../format'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
  lastQueriesHeading,
  sampleSizeLimit,
} from '../historyLimit'
import { catalogFor, interpolate, EN } from '../i18n'
import { DEFAULT_LOCALE, type Locale } from '../locale'
import {
  budgetDaysAfterToday,
  budgetDaysElapsedInMonth,
  budgetDaysInMonth,
  sumMonthUsedUsd,
} from '../usage/parse'
import type { IncludedQuota, UsageQuery, UsageSnapshot } from '../usage/types'
import type { PeriodBar, PeriodMetric } from './periodStats'

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
  /** Working-day pace projected across the whole month. */
  forecast: (number | null)[]
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
}

export type MtdPaceOptions = {
  historyLimit?: number
  historyFromDate?: string | null
  now?: Date
  budgetDayBasis?: BudgetDayBasis
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
}

function newestQueries(queries: UsageQuery[], limit: number): UsageQuery[] {
  return [...queries]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, limit)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function localDayKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`
}

function queryDayKey(ms: number): string {
  const d = new Date(ms)
  return localDayKey(d.getFullYear(), d.getMonth(), d.getDate())
}

function dayLabel(day: number, month: number): string {
  return `${day}.${pad2(month + 1)}`
}

function spendByDay(queries: UsageQuery[]): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const query of queries) {
    const key = queryDayKey(query.timestamp)
    byDay.set(key, (byDay.get(key) ?? 0) + query.costUsd)
  }
  return byDay
}

function dailyBudget(snapshot: UsageSnapshot): number | null {
  if (snapshot.status !== 'ready') {
    return null
  }
  const value = snapshot.data.dailyBudgetUsd
  if (value === null || !(value > 0)) {
    return null
  }
  return value
}

function remainingDaysHint(
  remaining: number,
  basis: BudgetDayBasis,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const copy = catalogFor(locale).mtd
  if (basis === 'calendarDays') {
    if (remaining === 0) {
      return copy.noDaysLeft
    }
    if (remaining === 1) {
      return copy.oneDayLeft
    }
    return interpolate(copy.daysLeft, { n: remaining })
  }
  if (remaining === 0) {
    return copy.noWorkingDaysLeft
  }
  if (remaining === 1) {
    return copy.oneWorkingDayLeft
  }
  return interpolate(copy.workingDaysLeft, { n: remaining })
}

function paceLabel(basis: BudgetDayBasis, locale: Locale = DEFAULT_LOCALE): string {
  const copy = catalogFor(locale).mtd
  return basis === 'calendarDays' ? copy.dailyPaceWord : copy.workingPaceWord
}

function noDaysBody(basis: BudgetDayBasis, locale: Locale = DEFAULT_LOCALE): string {
  const copy = catalogFor(locale).mtd
  return basis === 'calendarDays' ? copy.noDaysCalendar : copy.noDays
}

function forecastBody(basis: BudgetDayBasis, locale: Locale = DEFAULT_LOCALE): string {
  const copy = catalogFor(locale).mtd
  return basis === 'calendarDays' ? copy.forecastCalendar : copy.forecastWorking
}

function daysSoFarLabel(basis: BudgetDayBasis, locale: Locale = DEFAULT_LOCALE): string {
  const copy = catalogFor(locale).mtd
  return basis === 'calendarDays' ? copy.daysSoFar : copy.workingDaysSoFar
}

function daysLeftCardLabel(
  basis: BudgetDayBasis,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const copy = catalogFor(locale).stats
  return basis === 'calendarDays' ? copy.calendarDaysLeft : copy.workingDaysLeft
}

/** Cursor Models first, then Other Models — dashboard order. */
function includedQuotas(snapshot: UsageSnapshot): IncludedQuota[] {
  if (snapshot.status !== 'ready') {
    return []
  }
  if (snapshot.data.spendDisplay !== 'percent') {
    return []
  }
  const quotas = snapshot.data.includedQuotas
  const primary = quotas.filter((quota) => quota.name === 'Cursor Models')
  const rest = quotas.filter((quota) => quota.name !== 'Cursor Models')
  return [...primary, ...rest]
}

function lastDateOfMonth(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

export function workingDaysInMonth(now: Date): number {
  return budgetDaysInMonth(now, 'workingDays')
}

function mtdBody(
  elapsed: number,
  budget: number | null,
  historyLimit: number,
  forecastEom: number | null,
  basis: BudgetDayBasis,
  fromDate?: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const copy = catalogFor(locale).mtd
  if (budget === null) {
    if (forecastEom !== null) {
      return forecastBody(basis, locale)
    }
    return copy.noBudget
  }
  if (elapsed <= 0) {
    return noDaysBody(basis, locale)
  }
  const days =
    basis === 'calendarDays'
      ? elapsed === 1
        ? copy.oneDayUnit
        : interpolate(copy.nDaysUnit, { n: elapsed })
      : elapsed === 1
        ? copy.oneWorkingDayUnit
        : interpolate(copy.nWorkingDaysUnit, { n: elapsed })
  return interpolate(copy.vsDailyBudget, {
    days,
    sample: lastQueriesHeading(historyLimit, fromDate, locale),
  })
}

function paceHint(
  used: number,
  allowance: number,
  unit: MtdUnit,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const copy = catalogFor(locale).mtd
  const delta = used - allowance
  const abs = Math.abs(delta)
  const amount = unit === 'percent' ? formatPercentPoint(abs) : formatDollars(abs)
  if (delta > 0.005) {
    return interpolate(copy.overMtd, { amount })
  }
  if (delta < -0.005) {
    return interpolate(copy.underMtd, { amount })
  }
  return copy.onPaceMtd
}

function poolPercent(used: number, cap: number | null): number {
  if (cap === null || !(cap > 0)) {
    return used > 0 ? 100 : 0
  }
  return Math.round((used / cap) * 100)
}

function isWeekend(year: number, month: number, day: number): boolean {
  const weekday = new Date(year, month, day).getDay()
  return weekday === 0 || weekday === 6
}

export function toMtdChart(
  queries: UsageQuery[],
  budget: number | null,
  now: Date,
  basis: BudgetDayBasis = DEFAULT_BUDGET_DAY_BASIS,
): MtdChartPoint[] {
  const year = now.getFullYear()
  const month = now.getMonth()
  const last = now.getDate()
  const byDay = spendByDay(queries)
  const points: MtdChartPoint[] = []
  let used = 0
  let elapsed = 0
  for (let day = 1; day <= last; day++) {
    const weekday = !isWeekend(year, month, day)
    const paceDay = basis === 'calendarDays' || weekday
    if (paceDay) {
      elapsed += 1
    }
    const dayUsed = byDay.get(localDayKey(year, month, day)) ?? 0
    used += dayUsed
    points.push({
      date: dayLabel(day, month),
      weekday,
      workingDayIndex: paceDay ? elapsed : null,
      dayUsedUsd: dayUsed,
      usedUsd: used,
      allowanceUsd: budget === null ? null : elapsed * budget,
    })
  }
  return points
}

export function toMonthFrames(
  queries: UsageQuery[],
  now: Date,
  basis: BudgetDayBasis = DEFAULT_BUDGET_DAY_BASIS,
): DayFrame[] {
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  const last = lastDateOfMonth(now)
  const byDay = spendByDay(queries)
  const frames: DayFrame[] = []
  let workingCount = 0
  for (let day = 1; day <= last; day++) {
    const weekday = !isWeekend(year, month, day)
    const paceDay = basis === 'calendarDays' || weekday
    if (paceDay) {
      workingCount += 1
    }
    const future = day > today
    frames.push({
      date: dayLabel(day, month),
      weekday,
      workingDayIndex: paceDay ? workingCount : null,
      workingCount,
      future,
      usd: future ? 0 : (byDay.get(localDayKey(year, month, day)) ?? 0),
    })
  }
  return frames
}

export function toMtdDays(
  frames: DayFrame[],
  dailyAllowance: number | null,
): MtdForecastPoint[] {
  return frames.map((frame) => ({
    date: frame.date,
    weekday: frame.weekday,
    workingDayIndex: frame.workingDayIndex,
    allowanceUsd:
      dailyAllowance === null ? null : frame.workingCount * dailyAllowance,
  }))
}

function todayIndex(frames: DayFrame[]): number {
  let index = -1
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    if (frame !== undefined && !frame.future) {
      index = i
    }
  }
  return index
}

/**
 * Spreads a cycle total (dollars or included percent) over the month. Days are
 * weighted by their dollar spend, because the usage API reports quota percent
 * per cycle only — never per day.
 */
export function toMtdSeries(
  id: string,
  label: string,
  total: number,
  frames: DayFrame[],
  elapsed: number,
  ceiling: number | null = null,
  weekdayTotal = 0,
  locale: Locale = DEFAULT_LOCALE,
): MtdSeries {
  let spent = 0
  for (const frame of frames) {
    spent += frame.usd
  }
  const scale = spent > 0.000001 ? total / spent : null
  const perWorkingDay = elapsed > 0 ? total / elapsed : null
  const remaining = Math.max(0, weekdayTotal - elapsed)
  const left = ceiling === null ? null : Math.max(0, ceiling - total)
  const day: (number | null)[] = []
  const used: (number | null)[] = []
  const forecast: (number | null)[] = []
  const ideal: (number | null)[] = []
  let running = 0
  const today = todayIndex(frames)
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    if (frame === undefined) {
      continue
    }
    if (frame.future) {
      day.push(null)
      used.push(null)
    } else {
      const value =
        scale !== null
          ? frame.usd * scale
          : perWorkingDay !== null && frame.workingDayIndex !== null
            ? perWorkingDay
            : frame.usd
      running += value
      day.push(value)
      used.push(running)
    }
    forecast.push(
      perWorkingDay === null ? null : frame.workingCount * perWorkingDay,
    )
    // Ideal from today: burn the leftover ceiling evenly over remaining
    // pace days so you land on the limit at month end. Past days stay
    // null so each quota keeps its own visible slope.
    if (ceiling === null || left === null || today < 0 || i < today) {
      ideal.push(null)
    } else if (i === today) {
      ideal.push(total)
    } else if (remaining <= 0) {
      ideal.push(Math.min(ceiling, total))
    } else {
      ideal.push(total + (left * (frame.workingCount - elapsed)) / remaining)
    }
  }
  const lastWorking = lastPaceDate(frames)
  const rawRunOut =
    ceiling === null ? null : firstRunOutDate(forecast, frames, ceiling)
  // Hitting the ceiling on the last pace day still "lasts the month".
  const runOutDate =
    rawRunOut !== null && rawRunOut === lastWorking ? null : rawRunOut
  return {
    id,
    label,
    day,
    used,
    forecast,
    ideal,
    runOutDate,
    runOutLabel: runOutLabelFor(total, ceiling, runOutDate, locale),
  }
}

function firstRunOutDate(
  forecast: (number | null)[],
  frames: DayFrame[],
  ceiling: number,
): string | null {
  for (let i = 0; i < forecast.length; i++) {
    const value = forecast[i]
    if (value === null || value === undefined || value < ceiling - 0.005) {
      continue
    }
    return frames[i]?.date ?? null
  }
  return null
}

function runOutLabelFor(
  used: number,
  ceiling: number | null,
  runOutDate: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const copy = catalogFor(locale).mtd
  if (ceiling !== null && used >= ceiling - 0.005) {
    return copy.alreadyAtLimit
  }
  if (runOutDate !== null) {
    return interpolate(copy.runsOut, { date: runOutDate })
  }
  if (ceiling === null) {
    return copy.noCeiling
  }
  return copy.lastsMonth
}

function lastPaceDate(frames: DayFrame[]): string | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i]
    if (frame?.workingDayIndex !== null && frame !== undefined) {
      return frame.date
    }
  }
  return frames[frames.length - 1]?.date ?? null
}

function percentVerdict(
  series: MtdSeries[],
  overPace: boolean,
  frames: DayFrame[],
  basis: BudgetDayBasis,
  locale: Locale = DEFAULT_LOCALE,
): { verdict: MtdVerdict; body: string } {
  const lastWorking = lastPaceDate(frames)
  const early = series.filter(
    (line) =>
      line.runOutDate !== null &&
      lastWorking !== null &&
      line.runOutDate !== lastWorking,
  )
  const atLimit = catalogFor(locale).mtd.alreadyAtLimit
  if (series.some((line) => line.runOutLabel === atLimit)) {
    return {
      verdict: 'over',
      body: percentBody(series, early, true, basis, locale),
    }
  }
  if (early.length > 0) {
    return {
      verdict: 'over',
      body: percentBody(series, early, false, basis, locale),
    }
  }
  if (overPace) {
    return {
      verdict: 'tight',
      body: percentBody(series, early, false, basis, locale),
    }
  }
  return {
    verdict: 'ok',
    body: percentBody(series, early, false, basis, locale),
  }
}

function percentBody(
  series: MtdSeries[],
  early: MtdSeries[],
  spent: boolean,
  basis: BudgetDayBasis,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const copy = catalogFor(locale).mtd
  if (spent) {
    return copy.percentSpent
  }
  if (early.length > 0) {
    const bits = early.map((line) => `${line.label} ${line.runOutLabel.toLowerCase()}`)
    return interpolate(copy.percentEarly, {
      pace: paceLabel(basis, locale),
      bits: bits.join('; '),
    })
  }
  const bits = series.map((line) => `${line.label}: ${line.runOutLabel.toLowerCase()}`)
  return interpolate(copy.percentOk, { bits: bits.join('. ') })
}

function usdVerdict(
  overPace: boolean,
  forecastEom: number | null,
  monthCap: number | null,
  series: MtdSeries[],
  frames: DayFrame[],
  basis: BudgetDayBasis,
  locale: Locale = DEFAULT_LOCALE,
): { verdict: MtdVerdict; body: string } {
  const lastWorking = lastPaceDate(frames)
  const early = series.filter(
    (line) =>
      line.runOutDate !== null &&
      lastWorking !== null &&
      line.runOutDate !== lastWorking,
  )
  const atLimit = catalogFor(locale).mtd.alreadyAtLimit
  if (series.some((line) => line.runOutLabel === atLimit)) {
    return {
      verdict: 'over',
      body: usdBody(series, early, true, basis, locale),
    }
  }
  if (
    monthCap !== null &&
    forecastEom !== null &&
    forecastEom > monthCap + 0.005
  ) {
    return {
      verdict: 'over',
      body: usdBody(series, early, false, basis, locale),
    }
  }
  if (early.length > 0) {
    return {
      verdict: 'over',
      body: usdBody(series, early, false, basis, locale),
    }
  }
  if (overPace) {
    return {
      verdict: 'tight',
      body: usdBody(series, early, false, basis, locale),
    }
  }
  return {
    verdict: 'ok',
    body: usdBody(series, early, false, basis, locale),
  }
}

function usdBody(
  series: MtdSeries[],
  early: MtdSeries[],
  spent: boolean,
  basis: BudgetDayBasis,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const copy = catalogFor(locale).mtd
  if (spent) {
    return basis === 'calendarDays' ? copy.usdSpentCalendar : copy.usdSpentWorking
  }
  if (early.length > 0) {
    const bits = early.map((line) => `${line.label} ${line.runOutLabel.toLowerCase()}`)
    return interpolate(copy.usdEarly, {
      pace: paceLabel(basis, locale),
      bits: bits.join('; '),
    })
  }
  const bits = series.map((line) => `${line.label}: ${line.runOutLabel.toLowerCase()}`)
  return interpolate(copy.usdOk, { bits: bits.join('. ') })
}

function toRunOutMetric(
  series: MtdSeries[],
  basis: BudgetDayBasis,
  locale: Locale,
): PeriodMetric {
  const copy = catalogFor(locale).mtd
  const hint =
    basis === 'calendarDays' ? copy.ifDailyPace : copy.ifWorkingPace
  const early = series.filter((line) => line.runOutDate !== null)
  if (early.length > 0) {
    return {
      id: 'mtdRunOut',
      label: copy.runsOutLabel,
      value: early
        .map((line) => `${line.label} ~${line.runOutDate}`)
        .join(' · '),
      hint,
    }
  }
  const noCeiling = series.every((line) => line.runOutLabel === copy.noCeiling)
  return {
    id: 'mtdRunOut',
    label: copy.runsOutLabel,
    value: noCeiling ? copy.noCeiling : copy.lastsMonth,
    hint,
  }
}

function buildPaceMetrics(args: {
  elapsed: number
  remaining: number
  avg: number | null
  forecastEom: number | null
  daily: number | null
  allowance: number | null
  used: number
  leftover: number | null
  overPace: boolean
  unit: MtdUnit
  basis: BudgetDayBasis
  remainingPct?: number | null
  quotaLabel?: string
  locale?: Locale
  series: MtdSeries[]
}): PeriodMetric[] {
  const locale = args.locale ?? DEFAULT_LOCALE
  const copy = catalogFor(locale).mtd
  const metrics: PeriodMetric[] = []
  if (args.forecastEom !== null) {
    metrics.push({
      id: 'mtdForecast',
      label: copy.monthForecast,
      value:
        args.unit === 'percent'
          ? formatPercentPoint(args.forecastEom)
          : formatDollars(args.forecastEom),
      hint:
        args.basis === 'calendarDays' ? copy.ifDailyPace : copy.ifWorkingPace,
    })
  }
  if (args.allowance !== null) {
    metrics.push({
      id: 'mtdPace',
      label: copy.pace,
      value: args.overPace
        ? copy.over
        : args.used < args.allowance - 0.005
          ? copy.under
          : copy.onPace,
      hint: paceHint(args.used, args.allowance, args.unit, locale),
    })
  }
  metrics.push(toRunOutMetric(args.series, args.basis, locale))
  if (args.avg !== null) {
    metrics.push({
      id: 'mtdAvg',
      label: copy.dailyPace,
      value:
        args.unit === 'percent'
          ? formatPercentPoint(args.avg)
          : formatDollars(args.avg),
      hint: remainingDaysHint(args.remaining, args.basis, locale),
    })
  }
  if (args.daily !== null) {
    metrics.push({
      id: 'mtdDaily',
      label: copy.dailyBudget,
      value:
        args.unit === 'percent'
          ? formatPercentPoint(args.daily)
          : formatDollars(args.daily),
      hint:
        args.unit === 'percent'
          ? args.basis === 'calendarDays'
            ? copy.percentHintCalendar
            : copy.percentHintWorking
          : undefined,
    })
  }
  if (args.leftover !== null) {
    const perDay =
      args.remaining > 0 ? args.leftover / args.remaining : args.leftover
    metrics.push({
      id: 'mtdToLast',
      label: copy.toLast,
      value:
        args.unit === 'percent'
          ? formatPercentPoint(perDay)
          : formatDollars(perDay),
      hint:
        args.remaining <= 0
          ? remainingDaysHint(args.remaining, args.basis, locale)
          : args.basis === 'calendarDays'
            ? copy.toLastHintCalendar
            : copy.toLastHintWorking,
    })
  }
  metrics.push({
    id: 'mtdDays',
    label: daysSoFarLabel(args.basis, locale),
    value: String(args.elapsed),
  })
  metrics.push({
    id: 'mtdDaysLeft',
    label: daysLeftCardLabel(args.basis, locale),
    value: String(args.remaining),
  })
  if (args.remainingPct !== null && args.remainingPct !== undefined) {
    metrics.push({
      id: 'mtdLeft',
      label: copy.quotaLeft,
      value: formatPercentPoint(args.remainingPct),
      hint: interpolate(copy.quotaLeftHint, {
        label: args.quotaLabel ?? copy.includedUsage,
      }),
    })
    return metrics
  }
  if (args.leftover !== null && args.unit === 'usd') {
    metrics.push({
      id: 'mtdLeft',
      label: copy.budgetLeft,
      value: formatDollars(args.leftover),
    })
  }
  return metrics
}

function quotaSeriesId(name: string, index: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug === '' ? `quota${index}` : slug
}

export function toMtdPace(
  snapshot: UsageSnapshot,
  queries: UsageQuery[],
  options?: MtdPaceOptions,
): MtdPacePayload {
  const historyLimit = clampHistoryLimit(
    options?.historyLimit ?? DEFAULT_HISTORY_LIMIT,
  )
  const historyFromDate = options?.historyFromDate ?? null
  const now = options?.now ?? new Date()
  const basis = options?.budgetDayBasis ?? DEFAULT_BUDGET_DAY_BASIS
  const locale = options?.locale ?? DEFAULT_LOCALE
  const copy = catalogFor(locale).mtd
  const sample = newestQueries(
    queries,
    sampleSizeLimit(historyLimit, historyFromDate),
  )
  const elapsed = budgetDaysElapsedInMonth(now, basis)
  const weekdayTotal = budgetDaysInMonth(now, basis)
  const remaining = budgetDaysAfterToday(now, basis)
  const frames = toMonthFrames(sample, now, basis)
  const quotas = includedQuotas(snapshot)
  const primary = quotas[0]

  if (primary !== undefined) {
    const daily = weekdayTotal > 0 ? MTD_PERCENT_MAX / weekdayTotal : null
    const allowance = daily === null || elapsed <= 0 ? null : elapsed * daily
    const used = Math.max(0, primary.percent)
    const avg = elapsed > 0 ? used / elapsed : null
    const forecastEom =
      avg === null || weekdayTotal <= 0 ? null : avg * weekdayTotal
    const overPace =
      allowance !== null &&
      quotas.some((quota) => Math.max(0, quota.percent) > allowance + 0.005)
    const series = quotas.map((quota, index) =>
      toMtdSeries(
        quotaSeriesId(quota.name, index),
        quota.name,
        Math.max(0, quota.percent),
        frames,
        elapsed,
        MTD_PERCENT_MAX,
        weekdayTotal,
        locale,
      ),
    )
    const today = todayIndex(frames)
    const answer =
      elapsed <= 0
        ? {
            verdict: 'ok' as const,
            body: noDaysBody(basis, locale),
          }
        : percentVerdict(series, overPace, frames, basis, locale)
    const bars: PeriodBar[] = series.map((line, index) => {
      const cycleUsed = Math.max(0, quotas[index]?.percent ?? 0)
      const todayUsed = today < 0 ? 0 : (line.day[today] ?? 0)
      const todayText =
        daily === null
          ? ''
          : interpolate(copy.todayChunk, {
              today: formatPercentPoint(todayUsed),
              budget: formatPercentPoint(daily),
            })
      return {
        label: line.label,
        value: interpolate(copy.usedAmount, {
          runOut: line.runOutLabel,
          used: formatPercentPoint(cycleUsed),
          today: todayText,
        }),
        percent: Math.min(100, Math.round(cycleUsed)),
      }
    })
    const remainingPct = Math.max(0, MTD_PERCENT_MAX - used)
    const metrics = buildPaceMetrics({
      elapsed,
      remaining,
      avg,
      forecastEom,
      daily,
      allowance,
      used,
      leftover: remainingPct,
      overPace,
      unit: 'percent',
      basis,
      remainingPct,
      quotaLabel: primary.name,
      locale,
      series,
    })
    return {
      title: copy.title,
      value: '',
      body: answer.body,
      bars,
      metrics,
      overPace: answer.verdict !== 'ok',
      verdict: answer.verdict,
      unit: 'percent',
      max: MTD_PERCENT_MAX,
      chart: toMtdChart(sample, null, now, basis),
      forecast: toMtdDays(frames, daily),
      series,
    }
  }

  const used = sumMonthUsedUsd(sample, now)
  const budget = dailyBudget(snapshot)
  const allowance = budget === null || elapsed <= 0 ? null : elapsed * budget
  const overPace = allowance !== null && used > allowance + 0.005
  const avg = elapsed > 0 ? used / elapsed : null
  const forecastEom =
    avg === null || weekdayTotal <= 0 ? null : avg * weekdayTotal
  const monthCap =
    budget === null || weekdayTotal <= 0 ? null : budget * weekdayTotal
  const series = [
    toMtdSeries(
      'spend',
      copy.spend,
      used,
      frames,
      elapsed,
      monthCap,
      weekdayTotal,
      locale,
    ),
  ]
  const answer =
    budget === null || elapsed <= 0
      ? {
          verdict: 'ok' as const,
          body: mtdBody(
            elapsed,
            budget,
            historyLimit,
            forecastEom,
            basis,
            historyFromDate,
            locale,
          ),
        }
      : usdVerdict(overPace, forecastEom, monthCap, series, frames, basis, locale)
  const today = todayIndex(frames)
  const bars: PeriodBar[] =
    budget === null || elapsed <= 0
      ? []
      : series.map((line) => {
          const todayUsed = today < 0 ? 0 : (line.day[today] ?? 0)
          const todayText = interpolate(copy.todayChunk, {
            today: formatDollars(todayUsed),
            budget: formatDollars(budget),
          })
          return {
            label: line.label,
            value: interpolate(copy.usedAmount, {
              runOut: line.runOutLabel,
              used: formatDollars(used),
              today: todayText,
            }),
            percent: poolPercent(used, allowance),
          }
        })

  const leftover =
    monthCap === null ? null : Math.max(0, monthCap - used)
  const metrics = buildPaceMetrics({
    elapsed,
    remaining,
    avg,
    forecastEom,
    daily: budget,
    allowance,
    used,
    leftover,
    overPace,
    unit: 'usd',
    basis,
    locale,
    series,
  })

  return {
    title: copy.title,
    value: '',
    body: answer.body,
    bars,
    metrics,
    overPace: answer.verdict !== 'ok',
    verdict: answer.verdict,
    unit: 'usd',
    max: null,
    chart: toMtdChart(sample, budget, now, basis),
    forecast: toMtdDays(frames, budget),
    series,
  }
}
