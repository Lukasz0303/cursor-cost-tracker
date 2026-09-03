import { CURSOR_DASHBOARD_URL } from '../constants'
import { cycleResetLabel, formatPercentUsed } from '../format'
import type { UsageReady } from '../usage/types'
import { formatModelUsageTable, topModelsByCost } from './modelBreakdown'

const BAR_WIDTH = 10
const REFRESH_COMMAND_URI = 'command:cursorCost.refresh'

type Meter = {
  label: string
  value: string
  ratio: number
}

export function usageBar(ratio: number, width = BAR_WIDTH): string {
  const safeWidth = Math.max(1, Math.round(width))
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return '░'.repeat(safeWidth)
  }
  const filled = Math.min(
    safeWidth,
    Math.max(1, Math.round(ratio * safeWidth)),
  )
  return `${'█'.repeat(filled)}${'░'.repeat(safeWidth - filled)}`
}

export function buildBudgetTooltipMarkdown(
  data: UsageReady,
  now: Date = new Date(),
): string {
  const lines: string[] = ['$(credit-card) **Cursor Cost**', '']

  const identity = identityLine(data)
  if (identity) {
    lines.push(identity)
    lines.push('')
  }

  const meters = metersFrom(data)
  if (meters.length > 0) {
    lines.push(metersTable(meters))
    lines.push('')
  }

  const reset = cycleResetLabel(data.billingCycleEnd, now)
  if (reset) {
    lines.push(`*${reset}*`)
    lines.push('')
  }

  const modelLines = formatModelUsageTable(topModelsByCost(data.recentQueries, 5))
  if (modelLines.length > 0) {
    lines.push(...modelLines)
    lines.push('')
  }

  lines.push(
    `[Open Dashboard](${CURSOR_DASHBOARD_URL}) | [Refresh](${REFRESH_COMMAND_URI})`,
  )

  return lines.join('\n').trim()
}

function identityLine(data: UsageReady): string | null {
  const parts: string[] = []
  if (data.email) {
    parts.push(escapeHtml(data.email))
  }
  if (data.plan) {
    parts.push(`<strong>${escapeHtml(data.plan)}</strong>`)
  }
  if (parts.length === 0) {
    return null
  }
  return `<p>${parts.join(' · ')}</p>`
}

function metersFrom(data: UsageReady): Meter[] {
  const meters: Meter[] = []

  if (data.spendDisplay === 'percent' && data.includedQuotas.length > 0) {
    for (const quota of data.includedQuotas) {
      meters.push({
        label: quota.name,
        value: formatPercentUsed(quota.percent),
        ratio: quota.percent / 100,
      })
    }
  } else if (data.includedLine) {
    meters.push({
      label: 'Included',
      value: data.includedLine,
      ratio: ratioFromPoolLine(data.includedLine) ?? 0,
    })
  } else if (data.isUnlimited) {
    meters.push({
      label: 'Current',
      value: 'Unlimited',
      ratio: 0,
    })
  }

  if (data.onDemandLine) {
    meters.push({
      label: 'On-demand',
      value: data.onDemandLine,
      ratio: ratioFromPoolLine(data.onDemandLine) ?? 0,
    })
  }

  return meters
}

function metersTable(meters: Meter[]): string {
  const rows: string[] = []
  for (let i = 0; i < meters.length; i += 2) {
    const left = meters[i]
    const right = meters[i + 1]
    if (left === undefined) {
      continue
    }
    rows.push(
      `<tr>${meterCell(left)}${right ? meterCell(right) : '<td></td>'}</tr>`,
    )
  }
  return `<table cellpadding="6" cellspacing="0">${rows.join('')}</table>`
}

function meterCell(meter: Meter): string {
  return (
    `<td valign="top">` +
    `<strong>${escapeHtml(meter.label)}</strong><br>` +
    `${escapeHtml(meter.value)}<br>` +
    `<code>${usageBar(meter.ratio)}</code>` +
    `</td>`
  )
}

function ratioFromPoolLine(line: string): number | null {
  const match = line.match(/([\d,.]+)\s*\$?\s*\/\s*\$?\s*([\d,.]+)/)
  if (!match || match[1] === undefined || match[2] === undefined) {
    return null
  }
  const used = Number(match[1].replace(/,/g, ''))
  const limit = Number(match[2].replace(/,/g, ''))
  if (!Number.isFinite(used) || !Number.isFinite(limit)) {
    return null
  }
  if (limit <= 0) {
    return used > 0 ? 1 : 0
  }
  return used / limit
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
