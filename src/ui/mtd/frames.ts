import {
  DEFAULT_BUDGET_DAY_BASIS,
  type BudgetDayBasis,
} from '../../budgetDayBasis'
import {
  isInBillingCycle,
  localDayKey as forecastLocalDayKey,
  type BillingCycleRange,
  type ForecastWindow,
} from '../../forecastWindow'
import {
  localDayKey as dayKeyFromMs,
  localDayKeyFromParts,
} from '../../time/localDay'
import {
  includedPoolForModel,
  type IncludedModelPool,
} from '../../includedPool/modelPool'
import type { UsageQuery } from '../../usage/types'
import type { DayFrame, MtdChartPoint, MtdForecastPoint } from './types'

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function localDayKey(year: number, monthIndex: number, day: number): string {
  return localDayKeyFromParts(year, monthIndex, day)
}

function queryDayKey(ms: number): string {
  return dayKeyFromMs(ms)
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

function lastDateOfMonth(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
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

export function toForecastFrames(
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

export function todayIndex(frames: DayFrame[]): number {
  let index = -1
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    if (frame !== undefined && !frame.future) {
      index = i
    }
  }
  return index
}

export function elapsedFrameDays(frames: DayFrame[]): number {
  const today = todayIndex(frames)
  return today < 0 ? 0 : frames[today]?.paceCount ?? 0
}

export function chartFromFrames(
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

export function resetDateForFrames(frames: DayFrame[]): string | null {
  return frames.find((frame) => frame.reset)?.date ?? null
}

export function activeFrameUsed(frames: DayFrame[]): number {
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
