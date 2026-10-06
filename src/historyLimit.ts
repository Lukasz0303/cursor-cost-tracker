import {
  clampHistoryLimit,
  MAX_HISTORY_LIMIT,
} from './clamps'
import {
  formatHistoryFromDateLabel,
  isoDateFromLocal,
  parseHistoryFromDate,
} from './historyFromDate'
import { catalogFor, interpolate } from './i18n'
import { DEFAULT_LOCALE, type Locale } from './locale'

export {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
  MIN_HISTORY_LIMIT,
} from './clamps'

/** Last N, or the 10,000 cap when a From date is set. */
export function sampleSizeLimit(
  historyLimit: number,
  fromDate?: string | null,
): number {
  if (parseHistoryFromDate(fromDate) !== null) {
    return MAX_HISTORY_LIMIT
  }
  return clampHistoryLimit(historyLimit)
}

export function lastQueriesHeading(
  limit: number,
  fromDate?: string | null,
  locale: Locale = DEFAULT_LOCALE,
  toDate?: string | null,
): string {
  const iso = parseHistoryFromDate(fromDate)
  const copy = catalogFor(locale)
  if (iso === null) {
    return interpolate(copy.queries.lastHeading, {
      n: clampHistoryLimit(limit),
    })
  }
  const toIso = parseHistoryFromDate(toDate)
  const today = isoDateFromLocal(new Date())
  if (toIso !== null && toIso !== today) {
    return interpolate(copy.queries.rangeHeading, {
      from: formatHistoryFromDateLabel(iso),
      to: formatHistoryFromDateLabel(toIso),
    })
  }
  return interpolate(copy.queries.fromHeading, {
    date: formatHistoryFromDateLabel(iso),
  })
}

export function lastQueriesTitle(
  limit: number,
  fromDate?: string | null,
  locale: Locale = DEFAULT_LOCALE,
  toDate?: string | null,
): string {
  const iso = parseHistoryFromDate(fromDate)
  const copy = catalogFor(locale)
  if (iso === null) {
    return interpolate(copy.queries.lastTitle, {
      n: clampHistoryLimit(limit),
    })
  }
  const toIso = parseHistoryFromDate(toDate)
  const today = isoDateFromLocal(new Date())
  if (toIso !== null && toIso !== today) {
    return interpolate(copy.queries.rangeTitle, {
      from: formatHistoryFromDateLabel(iso),
      to: formatHistoryFromDateLabel(toIso),
    })
  }
  return interpolate(copy.queries.fromTitle, {
    date: formatHistoryFromDateLabel(iso),
  })
}
