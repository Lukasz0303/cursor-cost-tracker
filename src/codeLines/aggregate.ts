import { localDayKey } from './gitMerged'
import { lineVolumeRates } from './effectiveness'
import type {
  CodeLinesSnapshot,
  CodeLinesSource,
  ComposerLineTotals,
  DayLineBucket,
  GitNumstatDay,
} from './types'
import { codeLinesDisclaimer } from './copy'
import { catalogFor } from '../i18n'
import { DEFAULT_LOCALE, type Locale } from '../locale'

export function ratioLandedToAi(
  landed: number,
  ai: number | null,
): number | null {
  if (ai === null || !Number.isFinite(ai) || ai <= 0) {
    return null
  }
  if (!Number.isFinite(landed) || landed < 0) {
    return null
  }
  return landed / ai
}

function dayFromComposer(row: ComposerLineTotals): string | null {
  const ms = row.lastUpdatedAt ?? row.createdAt
  if (ms === null || !Number.isFinite(ms) || ms <= 0) {
    return null
  }
  return localDayKey(ms)
}

export function composersInWindow(
  composers: readonly ComposerLineTotals[],
  sinceMs?: number,
  untilMs?: number,
): ComposerLineTotals[] {
  if (sinceMs === undefined && untilMs === undefined) {
    return [...composers]
  }
  const start = sinceMs ?? Number.NEGATIVE_INFINITY
  const end = untilMs ?? Number.POSITIVE_INFINITY
  return composers.filter((row) => {
    const ms = row.lastUpdatedAt ?? row.createdAt
    if (ms === null || !Number.isFinite(ms) || ms <= 0) {
      return false
    }
    return ms >= start && ms <= end
  })
}

export function bucketAiByDay(
  composers: readonly ComposerLineTotals[],
): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const row of composers) {
    const date = dayFromComposer(row)
    if (date === null) {
      continue
    }
    byDay.set(date, (byDay.get(date) ?? 0) + row.linesAdded)
  }
  return byDay
}

/** Added + removed per conversation day — closest local stand-in for dashboard Lines Edited. */
export function bucketEditedByDay(
  composers: readonly ComposerLineTotals[],
): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const row of composers) {
    const date = dayFromComposer(row)
    if (date === null) {
      continue
    }
    const edited = row.linesAdded + row.linesRemoved
    byDay.set(date, (byDay.get(date) ?? 0) + edited)
  }
  return byDay
}

export function bucketMergedByDay(
  days: readonly GitNumstatDay[],
): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const day of days) {
    byDay.set(day.date, (byDay.get(day.date) ?? 0) + day.insertions)
  }
  return byDay
}

function sortedUnionDates(
  ...maps: readonly Map<string, number>[]
): string[] {
  const set = new Set<string>()
  for (const map of maps) {
    for (const key of map.keys()) {
      set.add(key)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function buildDaySeries(
  aiByDay: Map<string, number>,
  landedByDay: Map<string, number>,
  addedByDay?: Map<string, number>,
): DayLineBucket[] {
  const dates = sortedUnionDates(aiByDay, landedByDay, addedByDay ?? new Map())
  return dates.map((date) => {
    const ai = aiByDay.get(date) ?? 0
    const landed = landedByDay.get(date) ?? 0
    const added = addedByDay?.get(date) ?? ai
    const rate = ratioLandedToAi(landed, ai > 0 ? ai : null)
    return {
      date,
      added,
      ai,
      onMaster: landed,
      merged: landed,
      ratio: rate,
      effectiveness: rate,
    }
  })
}

export function rangeLabelFromSeries(
  series: readonly DayLineBucket[],
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (series.length === 0) {
    return catalogFor(locale).codeLines.noData
  }
  const first = series[0]?.date
  const last = series[series.length - 1]?.date
  if (first === undefined || last === undefined) {
    return catalogFor(locale).codeLines.noData
  }
  if (first === last) {
    return first
  }
  return `${first} → ${last}`
}

export function rangeLabelFromWindow(
  sinceMs: number,
  untilMs: number,
): string {
  const first = localDayKey(sinceMs)
  const last = localDayKey(untilMs)
  if (first === last) {
    return first
  }
  return `${first} → ${last}`
}

export function toCodeLinesSnapshot(input: {
  source: CodeLinesSource
  composers: readonly ComposerLineTotals[]
  mergedDays: readonly GitNumstatDay[]
  pendingInsertions: number
  locale?: Locale
  sinceMs?: number
  untilMs?: number
}): CodeLinesSnapshot {
  const aiKnown =
    input.source === 'headers' ||
    input.source === 'checkpoints' ||
    input.source === 'edits'
  const windowed = composersInWindow(
    input.composers,
    input.sinceMs,
    input.untilMs,
  )
  const addedByDay = aiKnown
    ? bucketAiByDay(windowed)
    : new Map<string, number>()
  const editedByDay = aiKnown
    ? bucketEditedByDay(windowed)
    : new Map<string, number>()
  const landedByDay = bucketMergedByDay(input.mergedDays)

  let addedTotal = 0
  let editedTotal = 0
  let removedTotal = 0
  for (const value of addedByDay.values()) {
    addedTotal += value
  }
  for (const value of editedByDay.values()) {
    editedTotal += value
  }
  if (aiKnown) {
    for (const row of windowed) {
      removedTotal += row.linesRemoved
    }
  }
  let landedTotal = 0
  for (const day of input.mergedDays) {
    landedTotal += day.insertions
  }

  const rates = lineVolumeRates(
    aiKnown ? editedTotal : null,
    landedTotal,
    input.pendingInsertions,
  )
  const series = buildDaySeries(editedByDay, landedByDay, addedByDay)
  const rangeLabel =
    input.sinceMs !== undefined && input.untilMs !== undefined
      ? rangeLabelFromWindow(input.sinceMs, input.untilMs)
      : rangeLabelFromSeries(series, input.locale)

  return {
    source: input.source,
    disclaimer: codeLinesDisclaimer(input.source, input.locale),
    summary: {
      added: addedTotal,
      ai: rates.ai,
      removed: removedTotal,
      onMaster: rates.landed,
      pending: rates.pending,
      allEdited: rates.ai,
      dashboard: false,
      currentLabel: '',
      effectiveness: rates.mergeRate,
      accountedRate: rates.accountedRate,
      mergedAll: landedTotal,
      merged: rates.landed,
      ratio: rates.mergeRate,
      rangeLabel,
    },
    series,
    repos: [],
  }
}
