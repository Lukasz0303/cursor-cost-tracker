import { CURSOR_DASHBOARD_URL } from '../constants'
import { cycleResetLabel } from '../format'
import type { UsageReady } from '../usage/types'
import { formatModelUsageTable, topModelsByCost } from './modelBreakdown'

export function buildBudgetTooltipMarkdown(
  data: UsageReady,
  now: Date = new Date(),
): string {
  const lines: string[] = []

  if (data.email) {
    lines.push(data.email)
  }
  if (data.plan) {
    lines.push(`**${data.plan}**`)
  }

  const reset = cycleResetLabel(data.billingCycleEnd, now)
  if (reset) {
    lines.push(reset)
  }

  if (data.includedLine) {
    lines.push(`**Included:** ${data.includedLine}`)
  }
  if (data.onDemandLine) {
    lines.push(`**On-demand:** ${data.onDemandLine}`)
  }

  if (data.isUnlimited) {
    lines.push('**Current:** Unlimited')
  } else if (data.spendDisplay === 'percent' && data.includedQuotas.length > 0) {
    lines.push('**Current:** included-quota percents on the status bar')
  } else {
    lines.push(
      '**Current:** cycle pool used / limit (not the sum of today\'s queries)',
    )
  }

  const modelLines = formatModelUsageTable(topModelsByCost(data.recentQueries, 5))
  if (modelLines.length > 0) {
    lines.push('')
    lines.push(...modelLines)
  }

  lines.push('')
  lines.push(`[Open Dashboard](${CURSOR_DASHBOARD_URL})`)

  return lines.join('\n')
}
