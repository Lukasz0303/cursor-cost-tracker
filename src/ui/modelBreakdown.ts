import { formatCompactTokens, formatDollars } from '../format'
import { stripModelPrefix } from '../usage/parse'
import type { UsageQuery } from '../usage/types'

export type ModelUsageRow = {
  model: string
  costUsd: number
  tokens: number
}

function modelLabel(model: string | null): string {
  const stripped = stripModelPrefix(model)
  if (stripped === null || stripped.trim() === '') {
    return '—'
  }
  return stripped
}

export function topModelsByCost(
  queries: UsageQuery[],
  limit = 5,
): ModelUsageRow[] {
  const totals = new Map<string, { costUsd: number; tokens: number }>()
  for (const query of queries) {
    const key = modelLabel(query.model)
    const current = totals.get(key) ?? { costUsd: 0, tokens: 0 }
    totals.set(key, {
      costUsd: current.costUsd + query.costUsd,
      tokens: current.tokens + query.tokens,
    })
  }

  return [...totals.entries()]
    .map(([model, stats]) => ({ model, ...stats }))
    .sort((left, right) => right.costUsd - left.costUsd)
    .slice(0, limit)
}

export function formatModelUsageTable(rows: ModelUsageRow[]): string[] {
  if (rows.length === 0) {
    return []
  }
  const lines = [
    '**Top models**',
    '',
    '| Model | Cost | Tokens |',
    '| --- | --- | --- |',
  ]
  for (const row of rows) {
    lines.push(
      `| ${row.model} | ${formatDollars(row.costUsd)} | ${formatCompactTokens(row.tokens)} |`,
    )
  }
  return lines
}
