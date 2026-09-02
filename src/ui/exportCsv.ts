import { formatDateTime, formatKind } from '../format'
import { clampHistoryLimit, DEFAULT_HISTORY_LIMIT } from '../historyLimit'
import { stripModelPrefix } from '../usage/parse'
import type { UsageQuery } from '../usage/types'

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function modelLabel(model: string | null): string {
  const stripped = stripModelPrefix(model)
  if (stripped === null || stripped.trim() === '') {
    return ''
  }
  return stripped
}

export function buildQueriesCsv(
  queries: UsageQuery[],
  limit: number = DEFAULT_HISTORY_LIMIT,
): string {
  const header = [
    'TIME',
    'MODEL',
    'COST_USD',
    'TOKENS',
    'INPUT_TOKENS',
    'OUTPUT_TOKENS',
    'KIND',
  ]
  const sorted = [...queries].sort((left, right) => right.timestamp - left.timestamp)
  const cap = clampHistoryLimit(limit)
  const rows = sorted.slice(0, cap).map((query) =>
    [
      formatDateTime(query.timestamp),
      modelLabel(query.model),
      String(query.costUsd),
      String(query.tokens),
      String(query.inputTokens),
      String(query.outputTokens),
      formatKind(query.kind),
    ]
      .map(csvCell)
      .join(','),
  )
  return [header.join(','), ...rows].join('\n')
}
