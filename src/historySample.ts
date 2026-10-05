import {
  formatHistoryFromDateLabel,
  historyDateRangeBounds,
  isoDateFromLocal,
  parseHistoryFromDate,
} from './historyFromDate'
import {
  clampHistoryLimit,
  MAX_HISTORY_LIMIT,
} from './historyLimit'
import { catalogFor, interpolate } from './i18n'
import { DEFAULT_LOCALE, type Locale } from './locale'

/**
 * Single sample window for Last N table, Statistics sample, Charts bars,
 * Coding stats, CSV, Sessions, and Optimize spike counts.
 *
 * Not used by: Current pool, Today chip, Burn Rate Guard minutes,
 * Critical alert, or Monthly cost forecast series.
 */
export type HistorySample =
  | {
      mode: 'lastN'
      limit: number
      fromDate: null
      toDate: null
      startMs: null
      endMs: null
      fetchLimit: number
      startDate: undefined
      endDate: undefined
      heading: string
      title: string
    }
  | {
      mode: 'calendar'
      limit: typeof MAX_HISTORY_LIMIT
      fromDate: string
      /** Null means open range through end of today (API endDate still set). */
      toDate: string | null
      startMs: number
      endMs: number
      fetchLimit: number
      startDate: string
      endDate: string
      heading: string
      title: string
    }

export function sampleSizeLimitFrom(sample: HistorySample): number {
  return sample.fetchLimit
}

function isOpenThroughToday(toDate: string | null, now: Date): boolean {
  if (toDate === null) {
    return true
  }
  return toDate === isoDateFromLocal(now)
}

function calendarCopy(
  fromDate: string,
  toDate: string | null,
  now: Date,
  locale: Locale,
): { heading: string; title: string } {
  const copy = catalogFor(locale)
  const fromLabel = formatHistoryFromDateLabel(fromDate)
  if (toDate !== null && !isOpenThroughToday(toDate, now)) {
    const toLabel = formatHistoryFromDateLabel(toDate)
    return {
      heading: interpolate(copy.queries.rangeHeading, {
        from: fromLabel,
        to: toLabel,
      }),
      title: interpolate(copy.queries.rangeTitle, {
        from: fromLabel,
        to: toLabel,
      }),
    }
  }
  return {
    heading: interpolate(copy.queries.fromHeading, { date: fromLabel }),
    title: interpolate(copy.queries.fromTitle, { date: fromLabel }),
  }
}

export function resolveHistorySample(input: {
  historyLimit: number
  historyFromDate: string | null
  historyToDate?: string | null
  now?: Date
  locale?: Locale
}): HistorySample {
  const now = input.now ?? new Date()
  const locale = input.locale ?? DEFAULT_LOCALE
  const limit = clampHistoryLimit(input.historyLimit)
  const fromDate = parseHistoryFromDate(input.historyFromDate)
  const copy = catalogFor(locale)

  if (fromDate === null) {
    return {
      mode: 'lastN',
      limit,
      fromDate: null,
      toDate: null,
      startMs: null,
      endMs: null,
      fetchLimit: limit,
      startDate: undefined,
      endDate: undefined,
      heading: interpolate(copy.queries.lastHeading, { n: limit }),
      title: interpolate(copy.queries.lastTitle, { n: limit }),
    }
  }

  let toDate = parseHistoryFromDate(input.historyToDate ?? null)
  const todayIso = isoDateFromLocal(now)
  if (toDate !== null && toDate > todayIso) {
    toDate = todayIso
  }

  let bounds = historyDateRangeBounds(fromDate, toDate, now)
  if (bounds === null) {
    // Inverted or broken To → open range through today.
    toDate = null
    bounds = historyDateRangeBounds(fromDate, null, now)
  }
  if (bounds === null) {
    return {
      mode: 'lastN',
      limit,
      fromDate: null,
      toDate: null,
      startMs: null,
      endMs: null,
      fetchLimit: limit,
      startDate: undefined,
      endDate: undefined,
      heading: interpolate(copy.queries.lastHeading, { n: limit }),
      title: interpolate(copy.queries.lastTitle, { n: limit }),
    }
  }

  const labels = calendarCopy(fromDate, toDate, now, locale)
  return {
    mode: 'calendar',
    limit: MAX_HISTORY_LIMIT,
    fromDate,
    toDate,
    startMs: bounds.startMs,
    endMs: bounds.endMs,
    fetchLimit: MAX_HISTORY_LIMIT,
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    heading: labels.heading,
    title: labels.title,
  }
}

/** End of live coding-stats window: now when To is today/open, else end of To. */
export function codeLinesUntilMs(sample: HistorySample, nowMs: number): number {
  if (sample.mode === 'lastN' || sample.endMs === null) {
    return nowMs
  }
  const todayEnd = historyDateRangeBounds(
    isoDateFromLocal(new Date(nowMs)),
    null,
    new Date(nowMs),
  )?.endMs
  if (todayEnd !== undefined && sample.endMs >= todayEnd) {
    return nowMs
  }
  return sample.endMs
}
