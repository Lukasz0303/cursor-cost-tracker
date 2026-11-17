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
import { historyDateRangeBounds } from '../../historyFromDate'
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
    // The labeled cycle end (2026-11-30) is the last day on the axis. A
    // midnight timestamp is that calendar day, not the day before it.
    const lastDay = end
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
  const today = todayIndex(frames)
  let active: string | null = null
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]
    if (frame?.reset && (today < 0 || index <= today)) {
      active = frame.date
    }
  }
  if (active !== null) {
    return active
  }
  return frames.find((frame) => frame.reset)?.date ?? null
}

/** Local midnight of the latest frame. That day is the end of the period. */
function periodEndMs(frames: DayFrame[], now: Date): number | null {
  let end: number | null = null
  for (const frame of frames) {
    const at = labeledDayMs(frame.date, now)
    if (at === null) {
      continue
    }
    if (end === null || at > end) {
      end = at
    }
  }
  return end
}

function labeledDayMs(label: string, now: Date): number | null {
  const match = /^(\d{1,2})\.(\d{2})$/.exec(label)
  if (match === null) {
    return null
  }
  const day = Number(match[1])
  const month = Number(match[2]) - 1
  if (!Number.isInteger(day) || month < 0 || month > 11) {
    return null
  }
  let year = now.getFullYear()
  if (month > now.getMonth() + 1) {
    year -= 1
  } else if (month + 1 < now.getMonth()) {
    year += 1
  }
  return new Date(year, month, day).getTime()
}

function startOfMonthMs(ms: number): number {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
}

function endOfLocalDayMs(ms: number): number {
  const date = new Date(ms)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  ).getTime()
}

function endOfMonthMs(ms: number): number {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
}

function cycleDayMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function localDayNumber(date: Date): number {
  return Math.round(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  )
}

/**
 * Chart axis for a set From date. A From or To that lands inside a month is
 * pulled out to that whole month, and the current period is never cut short.
 * 12 Sep–15 Nov therefore draws 1 Sep through 30 Nov. Each whole cycle on
 * that axis starts again at zero: a calendar month on the 1st, a billing
 * cycle on its own start.
 */
export function framesForHistoryRange(
  frames: DayFrame[],
  queries: UsageQuery[],
  now: Date,
  basis: BudgetDayBasis,
  range: BillingCycleRange | null,
  fromIso: string | null | undefined,
  toIso: string | null | undefined,
  pool?: IncludedModelPool | null,
  window: ForecastWindow = 'calendarMonth',
): DayFrame[] {
  if (!fromIso) {
    return frames
  }
  const bounds = historyDateRangeBounds(fromIso, toIso ?? null, now)
  if (bounds === null) {
    return frames
  }
  const end = new Date(bounds.endMs)
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  const periodEnd = periodEndMs(frames, now)
  const cycleStart = range === null ? null : cycleDayMs(range.start)
  const cycleEnd = range === null ? null : cycleDayMs(range.end)
  const horizonMs = Math.max(periodEnd ?? 0, cycleEnd ?? 0)
  const horizon = horizonMs > 0 ? endOfLocalDayMs(horizonMs) : null
  const monthEnd = endOfMonthMs(endDay)
  // A To date inside the current period stays inside that period when the
  // period ends before the calendar month (a billing cycle ending on the 30th).
  const cappedMonthEnd =
    horizon !== null && endDay <= horizon && monthEnd > horizon ? horizon : monthEnd
  const drawEnd = Math.max(cappedMonthEnd, horizon ?? cappedMonthEnd)
  const monthStart = startOfMonthMs(bounds.startMs)
  const axisStart =
    window === 'billingCycle' &&
    cycleStart !== null &&
    monthStart > cycleStart &&
    bounds.startMs >= cycleStart
      ? cycleStart
      : monthStart
  const axisStartDay = cycleDayMs(new Date(axisStart))
  const cycleLengthDays =
    range === null ? 0 : localDayNumber(range.end) - localDayNumber(range.start)
  const opensNewCycle = (date: Date): boolean => {
    if (cycleDayMs(date) === axisStartDay) {
      return false
    }
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    if (next.getTime() > drawEnd) {
      return false
    }
    if (window === 'billingCycle' && range !== null) {
      if (cycleLengthDays <= 0) {
        return false
      }
      const delta = localDayNumber(date) - localDayNumber(range.start)
      return delta % cycleLengthDays === 0
    }
    return date.getDate() === 1
  }
  const buckets = new Map<string, DayFrame[]>()
  for (const frame of frames) {
    const list = buckets.get(frame.date) ?? []
    list.push(frame)
    buckets.set(frame.date, list)
  }
  const axis: DayFrame[] = []
  let priorPace = 0
  for (
    const date = new Date(axisStart);
    date.getTime() <= drawEnd;
    date.setDate(date.getDate() + 1)
  ) {
    const label = dayLabel(date.getDate(), date.getMonth())
    const weekday = !isWeekend(date.getFullYear(), date.getMonth(), date.getDate())
    const paceDay = basis === 'calendarDays' || weekday
    const beforeCycle = cycleStart !== null && date.getTime() < cycleStart
    const bucket = buckets.get(label)
    const existing =
      !beforeCycle && bucket !== undefined && bucket.length > 0
        ? bucket.shift()
        : undefined
    const opensCycle = opensNewCycle(date)
    if (existing !== undefined) {
      axis.push({
        ...existing,
        reset: opensCycle ? true : existing.reset,
      })
      continue
    }
    if (opensCycle) {
      priorPace = 0
    }
    if (paceDay) {
      priorPace += 1
    }
    const key = forecastLocalDayKey(date)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    let usd = 0
    for (const query of queries) {
      if (queryDayKey(query.timestamp) !== key) {
        continue
      }
      if (range !== null && query.timestamp >= range.start.getTime()) {
        continue
      }
      if (
        pool !== undefined &&
        pool !== null &&
        includedPoolForModel(query.model) !== pool
      ) {
        continue
      }
      usd += query.costUsd
    }
    axis.push({
      date: label,
      weekday,
      workingDayIndex: paceDay ? priorPace : null,
      workingCount: priorPace,
      future: date.getTime() > todayStart,
      usd,
      reset: opensCycle,
      paceCount: priorPace,
    })
  }
  return axis.length > 0 ? axis : frames
}

export function activeFrameUsed(frames: DayFrame[]): number {
  const today = todayIndex(frames)
  if (today < 0) {
    return 0
  }
  let start = 0
  for (let index = 0; index <= today; index += 1) {
    if (frames[index]?.reset) {
      start = index
    }
  }
  return frames
    .slice(start, today + 1)
    .reduce((sum, frame) => sum + frame.usd, 0)
}
