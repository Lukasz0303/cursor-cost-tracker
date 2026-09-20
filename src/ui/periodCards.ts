import { formatDollarSign, formatPercentUsed, formatTokens } from '../format'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
} from '../historyLimit'
import { catalogFor, interpolate } from '../i18n'
import { DEFAULT_LOCALE, type Locale } from '../locale'
import type { UsageQuery } from '../usage/types'

export const PERIOD_COST_HINT = catalogFor('en').periods.costHint

export type PeriodShareKey = 'input' | 'output' | 'cacheWrite' | 'cacheRead'

export type PeriodShare = {
  key: PeriodShareKey
  label: string
  percent: number
}

export type PeriodTokenRow = {
  label: string
  value: string
  total?: boolean
}

export type PeriodCard = {
  id: 'today' | 'month' | 'all'
  title: string
  cost: string
  costHint: string
  summary: string
  rows: PeriodTokenRow[]
  shares: PeriodShare[]
}

export type PeriodCardsOptions = {
  historyLimit?: number
  now?: Date
  locale?: Locale
}

function shareMeta(locale: Locale): Array<{ key: PeriodShareKey; label: string }> {
  const copy = catalogFor(locale).stats
  return [
    { key: 'input', label: copy.input },
    { key: 'output', label: copy.output },
    { key: 'cacheWrite', label: copy.cacheWrite },
    { key: 'cacheRead', label: copy.cacheRead },
  ]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function localDayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function localMonthKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function newestQueries(queries: UsageQuery[], limit: number): UsageQuery[] {
  return [...queries]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, limit)
}

function cacheHitPercent(input: number, cacheRead: number): number {
  const prompt = input + cacheRead
  if (!(prompt > 0)) {
    return 0
  }
  return Math.round((cacheRead / prompt) * 100)
}

/** Whole percents that sum to 100 (largest remainder). */
export function sharePercents(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0)
  if (!(total > 0)) {
    return values.map(() => 0)
  }
  const raw = values.map((value) => (Math.max(0, value) / total) * 100)
  const floors = raw.map((value) => Math.floor(value))
  let leftover = 100 - floors.reduce((sum, value) => sum + value, 0)
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((left, right) => right.frac - left.frac)
  const out = [...floors]
  for (const item of order) {
    if (leftover <= 0) {
      break
    }
    out[item.index] = (out[item.index] ?? 0) + 1
    leftover -= 1
  }
  return out
}

function messageLine(count: number, hitPercent: number, locale: Locale): string {
  const copy = catalogFor(locale).periods
  const hit = formatPercentUsed(hitPercent)
  if (count === 1) {
    return interpolate(copy.messageOne, { hit })
  }
  return interpolate(copy.messageMany, { n: count, hit })
}

function toCard(
  id: PeriodCard['id'],
  title: string,
  queries: UsageQuery[],
  locale: Locale,
): PeriodCard {
  const copy = catalogFor(locale)
  let cost = 0
  let input = 0
  let output = 0
  let cacheWrite = 0
  let cacheRead = 0
  for (const query of queries) {
    cost += query.costUsd
    input += query.inputTokens
    output += query.outputTokens
    cacheWrite += query.cacheWriteTokens ?? 0
    cacheRead += query.cacheReadTokens ?? 0
  }
  const total = input + output + cacheWrite + cacheRead
  const percents = sharePercents([input, output, cacheWrite, cacheRead])
  const shares: PeriodShare[] = shareMeta(locale).map((meta, index) => ({
    key: meta.key,
    label: meta.label,
    percent: percents[index] ?? 0,
  }))

  return {
    id,
    title,
    cost: formatDollarSign(cost),
    costHint: copy.periods.costHint,
    summary: messageLine(queries.length, cacheHitPercent(input, cacheRead), locale),
    rows: [
      { label: copy.stats.input, value: formatTokens(input) },
      { label: copy.stats.output, value: formatTokens(output) },
      { label: copy.stats.cacheWrite, value: formatTokens(cacheWrite) },
      { label: copy.stats.cacheRead, value: formatTokens(cacheRead) },
      { label: copy.periods.totalTokens, value: formatTokens(total), total: true },
    ],
    shares,
  }
}

export function toPeriodCards(
  queries: UsageQuery[],
  options?: PeriodCardsOptions,
): PeriodCard[] {
  const historyLimit = clampHistoryLimit(
    options?.historyLimit ?? DEFAULT_HISTORY_LIMIT,
  )
  const now = options?.now ?? new Date()
  const locale = options?.locale ?? DEFAULT_LOCALE
  const copy = catalogFor(locale).periods
  const sample = newestQueries(queries, historyLimit)
  const todayKey = localDayKey(now.getTime())
  const monthKey = localMonthKey(now.getTime())
  const today = sample.filter((query) => localDayKey(query.timestamp) === todayKey)
  const month = sample.filter(
    (query) => localMonthKey(query.timestamp) === monthKey,
  )
  return [
    toCard('today', copy.today, today, locale),
    toCard('month', copy.thisMonth, month, locale),
    toCard('all', copy.allTime, sample, locale),
  ]
}
