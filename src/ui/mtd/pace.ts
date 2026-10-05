import {
  DEFAULT_BUDGET_DAY_BASIS,
  type BudgetDayBasis,
} from '../../budgetDayBasis'
import {
  billingCycleRenewalIsMidday,
  effectiveForecastWindow,
  parseBillingCycleRange,
} from '../../forecastWindow'
import { formatDollars, formatPercentPoint } from '../../format'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
  lastQueriesHeading,
  sampleSizeLimit,
} from '../../historyLimit'
import { catalogFor, interpolate } from '../../i18n'
import { DEFAULT_LOCALE, type Locale } from '../../locale'
import {
  includedPoolForQuotaName,
} from '../../includedPool/modelPool'
import {
  budgetDaysAfterToday,
  budgetDaysElapsedInMonth,
  budgetDaysInMonth,
} from '../../budgetDays'
import type { IncludedQuota, UsageQuery, UsageSnapshot } from '../../usage/types'
import type { PeriodBar, PeriodMetric } from '../periodStats'
import {
  MTD_PERCENT_MAX,
  type DayFrame,
  type MtdPaceOptions,
  type MtdPacePayload,
  type MtdSeries,
  type MtdUnit,
  type MtdVerdict,
} from './types'
import {
  activeFrameUsed,
  chartFromFrames,
  elapsedFrameDays,
  resetDateForFrames,
  toForecastFrames,
  toMtdDays,
  todayIndex,
} from './frames'
import { lastPaceDate, toMtdSeries } from './series'

function newestQueries(queries: UsageQuery[], limit: number): UsageQuery[] {
  return [...queries]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, limit)
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
  toDate?: string | null,
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
    sample: lastQueriesHeading(historyLimit, fromDate, locale, toDate),
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
  const historyToDate = options?.historyToDate ?? null
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
            historyToDate,
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

