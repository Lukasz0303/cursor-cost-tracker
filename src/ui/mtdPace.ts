import {
  DEFAULT_BUDGET_DAY_BASIS,
  type BudgetDayBasis,
} from '../budgetDayBasis'
import {
  billingCycleRenewalDay,
  billingCycleRenewalIsMidday,
  effectiveForecastWindow,
  isInBillingCycle,
  localDayKey as forecastLocalDayKey,
  parseBillingCycleRange,
  type BillingCycleRange,
  type ForecastWindow,
} from '../forecastWindow'
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
  includedPoolForModel,
  includedPoolForQuotaName,
  type IncludedModelPool,
} from '../includedPool/modelPool'
import {
  budgetDaysAfterToday,
  budgetDaysElapsedInMonth,
  budgetDaysInMonth,
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
  forecastWindow: ForecastWindow
  billingCycleAvailable: boolean
  resetDate: string | null
  resetMidday: boolean
}

export type MtdPaceOptions = {
  historyLimit?: number
  historyFromDate?: string | null
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

function spendByDay(
  queries: UsageQuery[],
  pool?: IncludedModelPool | null,
): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const query of queries) {
    if (pool !== undefined && pool !== null) {
      if (includedPoolForModel(query.model) !== pool) {
        continue
      }
    }
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

/**
 * Cycle dollar cap. `dailyBudgetUsd` is remaining ÷ days left (it moves every
 * day and jumps when the admin raises the limit), so it must not be multiplied
 * back into a month total.
 */
function monthCapUsd(snapshot: UsageSnapshot): number | null {
  if (snapshot.status !== 'ready' || snapshot.data.isUnlimited) {
    return null
  }
  const { limitUsd, usedUsd, remainingUsd } = snapshot.data
  if (limitUsd !== null && limitUsd > 0) {
    return limitUsd
  }
  if (remainingUsd !== null && Number.isFinite(remainingUsd)) {
    const cap = usedUsd + remainingUsd
    return cap > 0 ? cap : null
  }
  return null
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
  pool?: IncludedModelPool | null,
): DayFrame[] {
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  const last = lastDateOfMonth(now)
  const byDay = spendByDay(queries, pool)
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
      reset: false,
      paceCount: workingCount,
    })
  }
  return frames
}

function toForecastFrames(
  queries: UsageQuery[],
  now: Date,
  basis: BudgetDayBasis,
  window: ForecastWindow,
  range: BillingCycleRange | null,
  pool?: IncludedModelPool | null,
): DayFrame[] {
  if (window === 'billingCycle' && range !== null) {
    const frames: DayFrame[] = []
    const start = new Date(
      range.start.getFullYear(),
      range.start.getMonth(),
      range.start.getDate(),
    )
    const end = new Date(
      range.end.getFullYear(),
      range.end.getMonth(),
      range.end.getDate(),
    )
    const lastDay =
      range.end.getHours() !== 0 ||
      range.end.getMinutes() !== 0 ||
      range.end.getSeconds() !== 0 ||
      range.end.getMilliseconds() !== 0
        ? end
        : new Date(end.getTime() - 24 * 60 * 60 * 1000)
    let paceCount = 0
    for (
      const date = start;
      date.getTime() <= lastDay.getTime();
      date.setDate(date.getDate() + 1)
    ) {
      const weekday = !isWeekend(date.getFullYear(), date.getMonth(), date.getDate())
      const paceDay = basis === 'calendarDays' || weekday
      if (paceDay) {
        paceCount += 1
      }
      const future = date > now
      const dayQueries = queries.filter(
        (query) =>
          queryDayKey(query.timestamp) === forecastLocalDayKey(date) &&
          isInBillingCycle(query.timestamp, range) &&
          (pool === undefined ||
            pool === null ||
            includedPoolForModel(query.model) === pool),
      )
      frames.push({
        date: dayLabel(date.getDate(), date.getMonth()),
        weekday,
        workingDayIndex: paceDay ? paceCount : null,
        workingCount: paceCount,
        future,
        usd: future
          ? 0
          : dayQueries.reduce((sum, query) => sum + query.costUsd, 0),
        reset: false,
        paceCount,
      })
    }
    return frames
  }

  const frames = toMonthFrames(queries, now, basis, pool)
  if (range === null) {
    return frames
  }
  const resetDateLabel = dayLabel(range.end.getDate(), range.end.getMonth());
  const resetIndex = frames.findIndex(
    (frame) => frame.date === resetDateLabel,
  )
  if (resetIndex <= 0 || resetIndex >= frames.length - 1) {
    return frames
  }
  const first = frames[0]
  if (first === undefined) {
    return frames
  }
  const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const residue = queries
    .filter(
      (query) =>
        query.timestamp < firstMonth &&
        isInBillingCycle(query.timestamp, range) &&
        (pool === undefined ||
          pool === null ||
          includedPoolForModel(query.model) === pool),
    )
    .reduce((sum, query) => sum + query.costUsd, 0)
  first.usd += residue
  let branchCount = 0
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]
    if (frame === undefined) {
      continue
    }
    if (index >= resetIndex) {
      if (index === resetIndex) {
        branchCount = 0
      }
      if (frame.workingDayIndex !== null) {
        branchCount += 1
      }
    } else {
      branchCount = frame.workingCount
    }
    frame.reset = index === resetIndex
    frame.paceCount = branchCount
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
      dailyAllowance === null ? null : frame.paceCount * dailyAllowance,
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

function elapsedFrameDays(frames: DayFrame[]): number {
  const today = todayIndex(frames)
  return today < 0 ? 0 : frames[today]?.paceCount ?? 0
}

function chartFromFrames(
  frames: DayFrame[],
  budget: number | null,
): MtdChartPoint[] {
  let used = 0
  return frames.map((frame) => {
    if (frame.reset) {
      used = 0
    }
    used += frame.future ? 0 : frame.usd
    return {
      date: frame.date,
      weekday: frame.weekday,
      workingDayIndex: frame.workingDayIndex,
      dayUsedUsd: frame.future ? 0 : frame.usd,
      usedUsd: used,
      allowanceUsd:
        budget === null ? null : frame.paceCount * budget,
    }
  })
}

function resetDateForFrames(frames: DayFrame[]): string | null {
  return frames.find((frame) => frame.reset)?.date ?? null
}

function activeFrameUsed(frames: DayFrame[]): number {
  const today = todayIndex(frames)
  if (today < 0) {
    return 0
  }
  const reset = frames.findIndex((frame) => frame.reset)
  const start = reset >= 0 && today >= reset ? reset : 0
  return frames
    .slice(start, today + 1)
    .reduce((sum, frame) => sum + frame.usd, 0)
}

/**
 * Spreads a cycle total (dollars or included percent) over the month. Days are
 * weighted by that series' dollar spend (Pro: per included pool via model id).
 * The usage API reports quota percent per cycle only — never per day.
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
  const resetIndex = frames.findIndex((frame) => frame.reset)
  const today = todayIndex(frames)
  const activeBranchStartsAtReset = resetIndex >= 0 && today >= resetIndex
  const activeStart = activeBranchStartsAtReset ? resetIndex : 0
  const activeEnd =
    resetIndex >= 0 && !activeBranchStartsAtReset ? resetIndex : frames.length
  const activeSpent =
    resetIndex >= 0
      ? frames
          .slice(activeStart, activeEnd)
          .reduce((sum, frame) => sum + frame.usd, 0)
      : spent
  // Cursor's quota percent belongs to the branch containing today. A future
  // reset has no spend yet, so scaling against its branch would expose raw USD
  // as percent instead of distributing the current cycle percentage.
  const scale = activeSpent > 0.000001 ? total / activeSpent : null
  const paceElapsed =
    resetIndex >= 0 && today >= 0 ? (frames[today]?.paceCount ?? elapsed) : elapsed
  const perWorkingDay = paceElapsed > 0 ? total / paceElapsed : null
  const remaining = Math.max(0, weekdayTotal - elapsed)
  const left = ceiling === null ? null : Math.max(0, ceiling - total)
  const activePaceTotal =
    resetIndex < 0
      ? weekdayTotal
      : activeBranchStartsAtReset
        ? (frames[frames.length - 1]?.paceCount ?? paceElapsed)
        : (frames[resetIndex - 1]?.paceCount ?? paceElapsed)
  const activeRemaining = Math.max(0, activePaceTotal - paceElapsed)
  const paceEnd =
    perWorkingDay === null || activePaceTotal <= 0
      ? null
      : perWorkingDay * activePaceTotal
  // Pace that finishes under the cap is drawn up to the limit. A pace that
  // already crosses the cap stays put so the run-out day is still visible.
  const finishAtCeiling =
    ceiling !== null &&
    left !== null &&
    left > 0.005 &&
    paceEnd !== null &&
    paceEnd < ceiling - 0.005
  const day: (number | null)[] = []
  const used: (number | null)[] = []
  const forecast: (number | null)[] = []
  const ideal: (number | null)[] = []
  let running = 0
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    if (frame === undefined) {
      continue
    }
    if (frame.future) {
      day.push(null)
      used.push(null)
    } else {
      if (frame.reset) {
        running = 0
      }
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
    const pace =
      perWorkingDay === null ? null : frame.paceCount * perWorkingDay
    const inActiveBranch =
      resetIndex < 0 ||
      (activeBranchStartsAtReset ? i >= resetIndex : i < resetIndex)
    if (
      !finishAtCeiling ||
      pace === null ||
      today < 0 ||
      i < today ||
      !inActiveBranch
    ) {
      forecast.push(pace)
    } else if (activeRemaining <= 0) {
      forecast.push(ceiling)
    } else {
      forecast.push(
        total +
          ((left ?? 0) * (frame.paceCount - paceElapsed)) / activeRemaining,
      )
    }
    // Ideal from today: burn the leftover ceiling evenly over remaining
    // pace days so you land on the limit at month end. Past days stay
    // null so each quota keeps its own visible slope. On the last pace
    // day there is no later point, so the previous day anchors current
    // spend and today itself sits on the ceiling.
    const landOnCeiling = left !== null && left > 0.005 && remaining <= 0
    if (ceiling === null || left === null || today < 0) {
      ideal.push(null)
    } else if (landOnCeiling && today > 0 && i === today - 1) {
      ideal.push(total)
    } else if (i < today) {
      ideal.push(null)
    } else if (landOnCeiling) {
      ideal.push(ceiling)
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
    const over = args.overPace
    metrics.push({
      id: 'mtdPace',
      label: copy.pace,
      value: over
        ? copy.over
        : args.used < args.allowance - 0.005
          ? copy.under
          : copy.onPace,
      hint: paceHint(args.used, args.allowance, args.unit, locale),
      tone: over ? 'over' : 'ok',
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
  const billingCycleStart =
    snapshot.status === 'ready' ? snapshot.data.billingCycleStart : null
  const billingCycleEnd =
    snapshot.status === 'ready' ? snapshot.data.billingCycleEnd : null
  const range = parseBillingCycleRange(billingCycleStart, billingCycleEnd)
  const forecastWindow = effectiveForecastWindow(
    options?.forecastWindow,
    billingCycleStart,
    billingCycleEnd,
  )
  const billingCycleAvailable = range !== null &&
    effectiveForecastWindow('billingCycle', billingCycleStart, billingCycleEnd) ===
      'billingCycle'
  const copy = catalogFor(locale).mtd
  const sample = newestQueries(
    queries,
    sampleSizeLimit(historyLimit, historyFromDate),
  )
  const frames = toForecastFrames(
    sample,
    now,
    basis,
    forecastWindow,
    range,
  )
  const resetDate = resetDateForFrames(frames)
  const elapsed =
    forecastWindow === 'calendarMonth'
      ? budgetDaysElapsedInMonth(now, basis)
      : elapsedFrameDays(frames)
  const weekdayTotal =
    forecastWindow === 'calendarMonth'
      ? budgetDaysInMonth(now, basis)
      : frames[frames.length - 1]?.paceCount ?? 0
  const remaining =
    forecastWindow === 'calendarMonth'
      ? budgetDaysAfterToday(now, basis)
      : Math.max(0, weekdayTotal - elapsed)
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
        toForecastFrames(
          sample,
          now,
          basis,
          forecastWindow,
          range,
          includedPoolForQuotaName(quota.name),
        ),
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
      chart: chartFromFrames(frames, null),
      forecast: toMtdDays(frames, daily),
      series,
      forecastWindow,
      billingCycleAvailable,
      resetDate,
      resetMidday:
        resetDate !== null &&
        billingCycleRenewalIsMidday(billingCycleEnd),
    }
  }

  const used = activeFrameUsed(frames)
  const budget = dailyBudget(snapshot)
  const monthCap = weekdayTotal <= 0 ? null : monthCapUsd(snapshot)
  const paceBudget = monthCap === null ? null : monthCap / weekdayTotal
  const allowance =
    paceBudget === null || elapsed <= 0 ? null : elapsed * paceBudget
  const overPace = allowance !== null && used > allowance + 0.005
  const avg = elapsed > 0 ? used / elapsed : null
  const forecastEom =
    avg === null || weekdayTotal <= 0 ? null : avg * weekdayTotal
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
  const todayBudget = budget ?? paceBudget
  const answer =
    paceBudget === null || elapsed <= 0
      ? {
          verdict: 'ok' as const,
          body: mtdBody(
            elapsed,
            paceBudget,
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
    todayBudget === null || paceBudget === null || elapsed <= 0
      ? []
      : series.map((line) => {
          const todayUsed = today < 0 ? 0 : (line.day[today] ?? 0)
          const todayText = interpolate(copy.todayChunk, {
            today: formatDollars(todayUsed),
            budget: formatDollars(todayBudget),
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
    chart: chartFromFrames(frames, paceBudget),
    forecast: toMtdDays(frames, paceBudget),
    series,
    forecastWindow,
    billingCycleAvailable,
    resetDate,
    resetMidday:
      resetDate !== null &&
      billingCycleRenewalIsMidday(billingCycleEnd),
  }
}
