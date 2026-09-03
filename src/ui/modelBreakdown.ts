import { formatCompactTokens, formatDollars } from '../format'
import { stripModelPrefix } from '../usage/parse'
import type { UsageQuery } from '../usage/types'

export type ModelUsageRow = {
  model: string
  costUsd: number
  tokens: number
  requests: number
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
  const totals = new Map<
    string,
    { costUsd: number; tokens: number; requests: number }
  >()
  for (const query of queries) {
    const key = modelLabel(query.model)
    const current = totals.get(key) ?? { costUsd: 0, tokens: 0, requests: 0 }
    totals.set(key, {
      costUsd: current.costUsd + query.costUsd,
      tokens: current.tokens + query.tokens,
      requests: current.requests + 1,
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

  const body = rows
    .map(
      (row) =>
        `<tr>` +
        `<td>${escapeHtml(row.model)}</td>` +
        `<td align="right">${row.requests}</td>` +
        `<td align="right">${formatCompactTokens(row.tokens)}</td>` +
        `<td align="right">${formatDollars(row.costUsd)}</td>` +
        `</tr>`,
    )
    .join('')

  return [
    '**Usage by model**',
    '',
    `<table cellpadding="4" cellspacing="0">` +
      `<thead><tr>` +
      `<th align="left">Model</th>` +
      `<th align="right">Requests</th>` +
      `<th align="right">Tokens</th>` +
      `<th align="right">Spend</th>` +
      `</tr></thead>` +
      `<tbody>${body}</tbody>` +
      `</table>`,
  ]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
