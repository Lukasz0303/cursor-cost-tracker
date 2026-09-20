import { formatDate } from '../format'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
} from '../historyLimit'
import type { UsageQuery } from '../usage/types'

export type ChartPoint = {
  timestamp: number
  time: string
  tokens: number
  costUsd: number
  queryCount: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function localDayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Oldest → newest calendar days from the Last N sample (local timezone). */
export function toChartSeries(
  queries: UsageQuery[],
  limit: number = DEFAULT_HISTORY_LIMIT,
): ChartPoint[] {
  const cap = clampHistoryLimit(limit)
  const sorted = [...queries].sort((left, right) => left.timestamp - right.timestamp)
  const capped = sorted.slice(Math.max(0, sorted.length - cap))
  const byDay = new Map<string, ChartPoint>()

  for (const query of capped) {
    const key = localDayKey(query.timestamp)
    const tokens = Number.isFinite(query.tokens) ? Math.max(0, query.tokens) : 0
    const costUsd = Number.isFinite(query.costUsd) ? Math.max(0, query.costUsd) : 0
    const existing = byDay.get(key)
    if (!existing) {
      byDay.set(key, {
        timestamp: query.timestamp,
        time: formatDate(query.timestamp),
        tokens,
        costUsd,
        queryCount: 1,
      })
      continue
    }
    existing.tokens += tokens
    existing.costUsd += costUsd
    existing.queryCount += 1
  }

  return [...byDay.values()]
}
