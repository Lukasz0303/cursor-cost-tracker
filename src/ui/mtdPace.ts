import { formatDollars, formatPercentPoint } from '../format'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
  lastQueriesHeading,
} from '../historyLimit'
import { sumMonthUsedUsd, workingDaysElapsedInMonth } from '../usage/parse'
import type { IncludedQuota, UsageQuery, UsageSnapshot } from '../usage/types'
import type { PeriodBar, PeriodMetric } from './periodStats'

export const MTD_TITLE = 'Monthly cost forecast'
export const MTD_NO_BUDGET_BODY =
  'This calendar month from Last N. No daily dollar budget to pace against.'
export const MTD_NO_DAYS_BODY =
  'No working day so far this month — weekend before the first weekday.'
export const MTD_FORECAST_BODY =
  'This calendar month from Last N. Forecast keeps the current working-day pace through month end.'
export const MTD_SPEND_SERIES_LABEL = 'Spend'
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
  now?: Date
}

export type DayFrame = {
  date: string
  weekday: boolean
  workingDayIndex: number | null
  /** Weekdays from the 1st through this day. Repeats on weekends. */
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

function remainingDaysHint(remaining: number): string {
  if (remaining === 0) {
    return 'No working days left this month'
  }
  if (remaining === 1) {
    return '1 working day left this month'
  }
  return `${remaining} working days left this month`
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
  const year = now.getFullYear()
  const month = now.getMonth()
  const last = lastDateOfMonth(now)
  let count = 0
  for (let day = 1; day <= last; day++) {
    if (isWeekend(year, month, day)) {
      continue
    }
    count += 1
  }
  return count
}

function workingDaysAfterToday(now: Date): number {
  const year = now.getFullYear()
  const month = now.getMonth()
  const last = lastDateOfMonth(now)
  let count = 0
  for (let day = now.getDate() + 1; day <= last; day++) {
    if (isWeekend(year, month, day)) {
      continue
    }
    count += 1
  }
  return count
}

function mtdBody(
  elapsed: number,
  budget: number | null,
  historyLimit: number,
  forecastEom: number | null,
): string {
  if (budget === null) {
    if (forecastEom !== null) {
      return MTD_FORECAST_BODY
    }
    return MTD_NO_BUDGET_BODY
  }
  if (elapsed <= 0) {
    return MTD_NO_DAYS_BODY
  }
  const days = elapsed === 1 ? '1 working day' : `${elapsed} working days`
  return `This month vs ${days} × daily budget (${lastQueriesHeading(historyLimit)} sample).`
}

function paceHint(used: number, allowance: number, unit: MtdUnit): string {
  const delta = used - allowance
  const abs = Math.abs(delta)
  const formatted = unit === 'percent' ? formatPercentPoint(abs) : formatDollars(abs)
  if (delta > 0.005) {
    return `${formatted} over the MTD budget`
  }
  if (delta < -0.005) {
    return `${formatted} under the MTD budget`
  }
  return 'On pace with the MTD budget'
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
    if (weekday) {
      elapsed += 1
    }
    const dayUsed = byDay.get(localDayKey(year, month, day)) ?? 0
    used += dayUsed
    points.push({
      date: dayLabel(day, month),
      weekday,
      workingDayIndex: weekday ? elapsed : null,
      dayUsedUsd: dayUsed,
      usedUsd: used,
      allowanceUsd: budget === null ? null : elapsed * budget,
    })
  }
  return points
}

export function toMonthFrames(queries: UsageQuery[], now: Date): DayFrame[] {
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  const last = lastDateOfMonth(now)
  const byDay = spendByDay(queries)
  const frames: DayFrame[] = []
  let workingCount = 0
  for (let day = 1; day <= last; day++) {
    const weekday = !isWeekend(year, month, day)
    if (weekday) {
      workingCount += 1
    }
    const future = day > today
    frames.push({
      date: dayLabel(day, month),
      weekday,
      workingDayIndex: weekday ? workingCount : null,
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
          : perWorkingDay !== null && frame.weekday
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
    // working days so you land on the limit at month end. Past days stay
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
  const lastWorking = lastWorkingDate(frames)
  const rawRunOut =
    ceiling === null ? null : firstRunOutDate(forecast, frames, ceiling)
  // Hitting the ceiling on the last working day still "lasts the month".
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
    runOutLabel: runOutLabelFor(total, ceiling, runOutDate),
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
): string {
  if (ceiling !== null && used >= ceiling - 0.005) {
    return 'Already at the limit'
  }
  if (runOutDate !== null) {
    return `Runs out ~${runOutDate}`
  }
  if (ceiling === null) {
    return 'No hard ceiling'
  }
  return 'Lasts the month'
}

function lastWorkingDate(frames: DayFrame[]): string | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i]
    if (frame?.weekday) {
      return frame.date
    }
  }
  return frames[frames.length - 1]?.date ?? null
}

function percentVerdict(
  series: MtdSeries[],
  overPace: boolean,
  frames: DayFrame[],
): { verdict: MtdVerdict; body: string } {
  const lastWorking = lastWorkingDate(frames)
  const early = series.filter(
    (line) =>
      line.runOutDate !== null &&
      lastWorking !== null &&
      line.runOutDate !== lastWorking,
  )
  if (series.some((line) => line.runOutLabel === 'Already at the limit')) {
    return {
      verdict: 'over',
      body: percentBody(series, early, true),
    }
  }
  if (early.length > 0) {
    return {
      verdict: 'over',
      body: percentBody(series, early, false),
    }
  }
  if (overPace) {
    return {
      verdict: 'tight',
      body: percentBody(series, early, false),
    }
  }
  return {
    verdict: 'ok',
    body: percentBody(series, early, false),
  }
}

function percentBody(
  series: MtdSeries[],
  early: MtdSeries[],
  spent: boolean,
): string {
  if (spent) {
    return 'At least one included quota is already at 100%. On-demand usage may apply after that.'
  }
  if (early.length > 0) {
    const bits = early.map((line) => `${line.label} ${line.runOutLabel.toLowerCase()}`)
    return `At this working-day pace: ${bits.join('; ')}. Dotted ideal lines show leftover budget spread evenly to month end.`
  }
  const bits = series.map((line) => `${line.label}: ${line.runOutLabel.toLowerCase()}`)
  return `${bits.join('. ')}. Bars show cycle used vs 100%. Dotted ideal lines show leftover budget to month end.`
}

function usdVerdict(
  overPace: boolean,
  forecastEom: number | null,
  monthCap: number | null,
  series: MtdSeries[],
  frames: DayFrame[],
): { verdict: MtdVerdict; body: string } {
  const lastWorking = lastWorkingDate(frames)
  const early = series.filter(
    (line) =>
      line.runOutDate !== null &&
      lastWorking !== null &&
      line.runOutDate !== lastWorking,
  )
  if (series.some((line) => line.runOutLabel === 'Already at the limit')) {
    return {
      verdict: 'over',
      body: usdBody(series, early, true),
    }
  }
  if (
    monthCap !== null &&
    forecastEom !== null &&
    forecastEom > monthCap + 0.005
  ) {
    return {
      verdict: 'over',
      body: usdBody(series, early, false),
    }
  }
  if (early.length > 0) {
    return {
      verdict: 'over',
      body: usdBody(series, early, false),
    }
  }
  if (overPace) {
    return {
      verdict: 'tight',
      body: usdBody(series, early, false),
    }
  }
  return {
    verdict: 'ok',
    body: usdBody(series, early, false),
  }
}

function usdBody(
  series: MtdSeries[],
  early: MtdSeries[],
  spent: boolean,
): string {
  if (spent) {
    return 'Month spend is already at the working-day budget ceiling for this month.'
  }
  if (early.length > 0) {
    const bits = early.map((line) => `${line.label} ${line.runOutLabel.toLowerCase()}`)
    return `At this working-day pace: ${bits.join('; ')}. Bars are dollars. Dotted ideal lines show leftover budget spread evenly to month end.`
  }
  const bits = series.map((line) => `${line.label}: ${line.runOutLabel.toLowerCase()}`)
  return `${bits.join('. ')}. Bars are dollars. Dotted ideal lines show leftover budget to month end.`
}

function appendPaceMetrics(
  metrics: PeriodMetric[],
  args: {
    remaining: number
    avg: number | null
    forecastEom: number | null
    daily: number | null
    allowance: number | null
    used: number
    overPace: boolean
    unit: MtdUnit
    remainingPct?: number | null
    quotaLabel?: string
  },
): void {
  if (args.remainingPct !== null && args.remainingPct !== undefined) {
    metrics.push({
      id: 'mtdLeft',
      label: 'Quota left',
      value: formatPercentPoint(args.remainingPct),
      hint: `${args.quotaLabel ?? 'Included usage'} remaining this cycle`,
    })
  }
  if (args.avg !== null) {
    metrics.push({
      id: 'mtdAvg',
      label: 'Daily pace',
      value:
        args.unit === 'percent'
          ? formatPercentPoint(args.avg)
          : formatDollars(args.avg),
      hint: remainingDaysHint(args.remaining),
    })
  }
  if (args.forecastEom !== null) {
    metrics.push({
      id: 'mtdForecast',
      label: 'Month forecast',
      value:
        args.unit === 'percent'
          ? formatPercentPoint(args.forecastEom)
          : formatDollars(args.forecastEom),
      hint: 'If this working-day pace continues',
    })
  }
  if (args.daily !== null) {
    metrics.push({
      id: 'mtdDaily',
      label: 'Daily budget',
      value:
        args.unit === 'percent'
          ? formatPercentPoint(args.daily)
          : formatDollars(args.daily),
      hint:
        args.unit === 'percent'
          ? '100% ÷ working days this month'
          : undefined,
    })
  }
  if (args.allowance !== null) {
    metrics.push({
      id: 'mtdPace',
      label: 'Pace',
      value: args.overPace
        ? 'Over'
        : args.used < args.allowance - 0.005
          ? 'Under'
          : 'On pace',
      hint: paceHint(args.used, args.allowance, args.unit),
    })
  }
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
  const now = options?.now ?? new Date()
  const sample = newestQueries(queries, historyLimit)
  const elapsed = workingDaysElapsedInMonth(now)
  const weekdayTotal = workingDaysInMonth(now)
  const remaining = workingDaysAfterToday(now)
  const frames = toMonthFrames(sample, now)
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
      ),
    )
    const today = todayIndex(frames)
    const answer =
      elapsed <= 0
        ? {
            verdict: 'ok' as const,
            body: MTD_NO_DAYS_BODY,
          }
        : percentVerdict(series, overPace, frames)
    const bars: PeriodBar[] = series.map((line, index) => {
      const cycleUsed = Math.max(0, quotas[index]?.percent ?? 0)
      const todayUsed = today < 0 ? 0 : (line.day[today] ?? 0)
      const todayText =
        daily === null
          ? ''
          : ` · today ${formatPercentPoint(todayUsed)} / ${formatPercentPoint(daily)}`
      return {
        label: line.label,
        value: `${line.runOutLabel} · ${formatPercentPoint(cycleUsed)} used${todayText}`,
        percent: Math.min(100, Math.round(cycleUsed)),
      }
    })
    const metrics: PeriodMetric[] = [
      {
        id: 'mtdDays',
        label: 'Working days so far',
        value: String(elapsed),
      },
    ]
    appendPaceMetrics(metrics, {
      remaining,
      avg,
      forecastEom,
      daily,
      allowance,
      used,
      overPace,
      unit: 'percent',
      remainingPct: Math.max(0, MTD_PERCENT_MAX - used),
      quotaLabel: primary.name,
    })
    const runOutMetric = series
      .filter((line) => line.runOutDate !== null)
      .map((line) => `${line.label} ~${line.runOutDate}`)
      .join(' · ')
    if (runOutMetric !== '') {
      metrics.push({
        id: 'mtdRunOut',
        label: 'Runs out',
        value: runOutMetric,
        hint: 'If this working-day pace continues',
      })
    }
    return {
      title: MTD_TITLE,
      value: '',
      body: answer.body,
      bars,
      metrics,
      overPace: answer.verdict !== 'ok',
      verdict: answer.verdict,
      unit: 'percent',
      max: MTD_PERCENT_MAX,
      chart: toMtdChart(sample, null, now),
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
      MTD_SPEND_SERIES_LABEL,
      used,
      frames,
      elapsed,
      monthCap,
      weekdayTotal,
    ),
  ]
  const answer =
    budget === null || elapsed <= 0
      ? {
          verdict: 'ok' as const,
          body: mtdBody(elapsed, budget, historyLimit, forecastEom),
        }
      : usdVerdict(overPace, forecastEom, monthCap, series, frames)
  const today = todayIndex(frames)
  const bars: PeriodBar[] =
    budget === null || elapsed <= 0
      ? []
      : series.map((line) => {
          const todayUsed = today < 0 ? 0 : (line.day[today] ?? 0)
          const todayText = ` · today ${formatDollars(todayUsed)} / ${formatDollars(budget)}`
          return {
            label: line.label,
            value: `${line.runOutLabel} · ${formatDollars(used)} used${todayText}`,
            percent: poolPercent(used, allowance),
          }
        })

  const metrics: PeriodMetric[] = [
    {
      id: 'mtdDays',
      label: 'Working days so far',
      value: String(elapsed),
    },
  ]
  appendPaceMetrics(metrics, {
    remaining,
    avg,
    forecastEom,
    daily: budget,
    allowance,
    used,
    overPace,
    unit: 'usd',
  })
  const runOutMetric = series
    .filter((line) => line.runOutDate !== null)
    .map((line) => `${line.label} ~${line.runOutDate}`)
    .join(' · ')
  if (runOutMetric !== '') {
    metrics.push({
      id: 'mtdRunOut',
      label: 'Runs out',
      value: runOutMetric,
      hint: 'If this working-day pace continues',
    })
  }

  return {
    title: MTD_TITLE,
    value: '',
    body: answer.body,
    bars,
    metrics,
    overPace: answer.verdict !== 'ok',
    verdict: answer.verdict,
    unit: 'usd',
    max: null,
    chart: toMtdChart(sample, budget, now),
    forecast: toMtdDays(frames, budget),
    series,
  }
}
