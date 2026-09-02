import { formatDollarSign, formatPercentUsed, formatTokens } from '../format'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
} from '../historyLimit'
import type { UsageQuery } from '../usage/types'

export const PERIOD_COST_HINT = '≈ API equivalent'

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
}

const SHARE_META: Array<{ key: PeriodShareKey; label: string }> = [
  { key: 'input', label: 'Input' },
  { key: 'output', label: 'Output' },
  { key: 'cacheWrite', label: 'Cache write' },
  { key: 'cacheRead', label: 'Cache read' },
]

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

function messageLine(count: number, hitPercent: number): string {
  const noun = count === 1 ? 'message' : 'messages'
  return `${count} ${noun} · ${formatPercentUsed(hitPercent)} cache hit`
}

function toCard(
  id: PeriodCard['id'],
  title: string,
  queries: UsageQuery[],
): PeriodCard {
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
  const shares: PeriodShare[] = SHARE_META.map((meta, index) => ({
    key: meta.key,
    label: meta.label,
    percent: percents[index] ?? 0,
  }))

  return {
    id,
    title,
    cost: formatDollarSign(cost),
    costHint: PERIOD_COST_HINT,
    summary: messageLine(queries.length, cacheHitPercent(input, cacheRead)),
    rows: [
      { label: 'Input', value: formatTokens(input) },
      { label: 'Output', value: formatTokens(output) },
      { label: 'Cache write', value: formatTokens(cacheWrite) },
      { label: 'Cache read', value: formatTokens(cacheRead) },
      { label: 'Total tokens', value: formatTokens(total), total: true },
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
  const sample = newestQueries(queries, historyLimit)
  const todayKey = localDayKey(now.getTime())
  const monthKey = localMonthKey(now.getTime())
  const today = sample.filter((query) => localDayKey(query.timestamp) === todayKey)
  const month = sample.filter(
    (query) => localMonthKey(query.timestamp) === monthKey,
  )
  return [
    toCard('today', 'Today', today),
    toCard('month', 'This month', month),
    toCard('all', 'All time', sample),
  ]
}
