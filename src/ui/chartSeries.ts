import { formatDateTime } from '../format'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
} from '../historyLimit'
import { stripModelPrefix } from '../usage/parse'
import type { UsageQuery } from '../usage/types'

export type ChartPoint = {
  timestamp: number
  time: string
  model: string
  tokens: number
  costUsd: number
}

export function toChartSeries(
  queries: UsageQuery[],
  limit: number = DEFAULT_HISTORY_LIMIT,
): ChartPoint[] {
  const cap = clampHistoryLimit(limit)
  const sorted = [...queries].sort((left, right) => left.timestamp - right.timestamp)
  return sorted.slice(Math.max(0, sorted.length - cap)).map((query) => {
    const stripped = stripModelPrefix(query.model)
    const model =
      stripped === null || stripped.trim() === '' ? '—' : stripped
    return {
      timestamp: query.timestamp,
      time: formatDateTime(query.timestamp),
      model,
      tokens: Number.isFinite(query.tokens) ? Math.max(0, query.tokens) : 0,
      costUsd: Number.isFinite(query.costUsd) ? Math.max(0, query.costUsd) : 0,
    }
  })
}
