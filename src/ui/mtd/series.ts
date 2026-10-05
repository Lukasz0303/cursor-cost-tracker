import { catalogFor, interpolate } from '../../i18n'
import { DEFAULT_LOCALE, type Locale } from '../../locale'
import type { DayFrame, MtdSeries } from './types'
import { todayIndex } from './frames'

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
  const forecast: (number | null | [number, number])[] = []
  const ideal: (number | null)[] = []
  const resetPaceCount =
    resetIndex >= 0 ? (frames[resetIndex]?.paceCount ?? 0) : 0
  let running = 0
  let prevPace: number | null = null
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
    // Future renew branch: anchor at 0 on the reset day so the line climbs
    // 0, 1×rate, 2×rate… After a forced [prev, 0] drop, using raw paceCount
    // would start the next day at 2×rate and look like a knee above 0.
    const paceFromZero =
      !activeBranchStartsAtReset && resetIndex >= 0 && i >= resetIndex
    const pace =
      perWorkingDay === null
        ? null
        : paceFromZero
          ? Math.max(0, frame.paceCount - resetPaceCount) * perWorkingDay
          : frame.paceCount * perWorkingDay
    const inActiveBranch =
      resetIndex < 0 ||
      (activeBranchStartsAtReset ? i >= resetIndex : i < resetIndex)
    let forecastValue: number | null | [number, number]
    if (
      !finishAtCeiling ||
      pace === null ||
      today < 0 ||
      i < today ||
      !inActiveBranch
    ) {
      forecastValue = pace
    } else if (activeRemaining <= 0) {
      forecastValue = ceiling
    } else {
      forecastValue =
        total +
        ((left ?? 0) * (frame.paceCount - paceElapsed)) / activeRemaining
    }
    // At reset: vertical drop from the prior cumulative to 0 (new cycle).
    if (frame.reset && prevPace !== null) {
      forecast.push([prevPace, 0])
      prevPace = 0
    } else {
      forecast.push(forecastValue)
      if (typeof forecastValue === 'number') {
        prevPace = forecastValue
      }
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

export function firstRunOutDate(
  forecast: (number | null | [number, number])[],
  frames: DayFrame[],
  ceiling: number,
): string | null {
  for (let i = 0; i < forecast.length; i++) {
    const value = forecast[i]
    if (value === null || value === undefined) {
      continue
    }
    const numValue = Array.isArray(value) ? value[1] : value
    if (numValue < ceiling - 0.005) {
      continue
    }
    return frames[i]?.date ?? null
  }
  return null
}

export function runOutLabelFor(
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

export function lastPaceDate(frames: DayFrame[]): string | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i]
    if (frame?.workingDayIndex !== null && frame !== undefined) {
      return frame.date
    }
  }
  return frames[frames.length - 1]?.date ?? null
}
