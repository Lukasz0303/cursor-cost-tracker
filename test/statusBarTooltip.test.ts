import { describe, expect, it } from 'vitest'
import { buildBudgetTooltipMarkdown, usageBar } from '../src/ui/statusBarTooltip'
import { formatModelUsageTable, topModelsByCost } from '../src/ui/modelBreakdown'
import type { UsageQuery, UsageReady } from '../src/usage/types'

function query(overrides: Partial<UsageQuery> = {}): UsageQuery {
  return {
    timestamp: 1,
    model: 'gpt-5',
    kind: null,
    costUsd: 1.5,
    tokens: 1000,
    inputTokens: 500,
    outputTokens: 500,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    ...overrides,
  }
}

function data(overrides: Partial<UsageReady> = {}): UsageReady {
  return {
    email: 'dev@example.com',
    plan: 'pro',
    spendDisplay: 'usd',
    includedQuotas: [],
    usedUsd: 3.79,
    limitUsd: 250,
    remainingUsd: 246.21,
    todayUsedUsd: 3.79,
    dailyBudgetUsd: 11.19,
    workingDaysLeft: 22,
    billingCycleStart: '2026-09-01T00:00:00.000Z',
    billingCycleEnd: '2026-09-30T00:00:00.000Z',
    isUnlimited: false,
    includedLine: '512 / 500',
    onDemandLine: '3.79 $ / 250.00 $',
    recentQueries: [query()],
    ...overrides,
  }
}

describe('usageBar', () => {
  it('fills a full bar at or over 100%', () => {
    expect(usageBar(1)).toBe('██████████')
    expect(usageBar(1.2)).toBe('██████████')
  })

  it('keeps a sliver visible for tiny non-zero usage', () => {
    expect(usageBar(0.015)).toBe('█░░░░░░░░░')
  })

  it('renders an empty bar at zero', () => {
    expect(usageBar(0)).toBe('░░░░░░░░░░')
  })
})

describe('buildBudgetTooltipMarkdown', () => {
  it('lays out meters, a right-aligned model table, and actions', () => {
    const tooltip = buildBudgetTooltipMarkdown(
      data(),
      new Date('2026-09-20T12:00:00'),
    )
    expect(tooltip.startsWith('$(credit-card) **Cursor Cost**')).toBe(true)
    expect(tooltip).toContain('<p>dev@example.com · <strong>pro</strong></p>')
    expect(tooltip).toContain('<strong>Included</strong><br>512 / 500<br><code>██████████</code>')
    expect(tooltip).toContain('<strong>On-demand</strong>')
    expect(tooltip).toContain('<code>█░░░░░░░░░</code>')
    expect(tooltip).toContain('*Resets in 10 days (2026-09-30)*')
    expect(tooltip).toContain('**Usage by model**')
    expect(tooltip).toContain('<th align="right">Spend</th>')
    expect(tooltip).toContain('<td>gpt-5</td><td align="right">1</td>')
    expect(tooltip).toContain('[Refresh](command:cursorCost.refresh)')
  })

  it('uses one meter per included quota on Pro', () => {
    const tooltip = buildBudgetTooltipMarkdown(
      data({
        spendDisplay: 'percent',
        includedLine: 'Cursor Models 14% · Other Models 0%',
        includedQuotas: [
          { name: 'Cursor Models', used: 14, limit: 100, percent: 14 },
          { name: 'Other Models', used: 0, limit: 100, percent: 0 },
        ],
        recentQueries: [],
      }),
    )
    expect(tooltip).toContain('<strong>Cursor Models</strong><br>14%<br><code>█░░░░░░░░░</code>')
    expect(tooltip).toContain('<strong>Other Models</strong><br>0%<br><code>░░░░░░░░░░</code>')
    expect(tooltip).not.toContain('<strong>Included</strong>')
    expect(tooltip).not.toContain('**Usage by model**')
  })

  it('escapes HTML in email, plan, and model names', () => {
    const tooltip = buildBudgetTooltipMarkdown(
      data({
        email: 'a<b>@x.com',
        plan: 'pro>plus',
        recentQueries: [query({ model: '<script>gpt' })],
      }),
    )
    expect(tooltip).toContain('a&lt;b&gt;@x.com')
    expect(tooltip).toContain('<strong>pro&gt;plus</strong>')
    expect(tooltip).toContain('<td>&lt;script&gt;gpt</td>')
    expect(tooltip).not.toContain('<script>')
  })
})

describe('topModelsByCost', () => {
  it('counts requests and sorts by spend', () => {
    const rows = topModelsByCost([
      query({ model: 'gpt-5', costUsd: 1, tokens: 100 }),
      query({ model: 'gpt-5', costUsd: 1, tokens: 50 }),
      query({ model: 'composer', costUsd: 5, tokens: 20 }),
    ])
    expect(rows[0]).toMatchObject({
      model: 'composer',
      requests: 1,
      costUsd: 5,
    })
    expect(rows[1]).toMatchObject({
      model: 'gpt-5',
      requests: 2,
      tokens: 150,
    })
  })
})

describe('formatModelUsageTable', () => {
  it('right-aligns numeric columns', () => {
    const html = formatModelUsageTable([
      { model: 'gpt-5', costUsd: 1.5, tokens: 1000, requests: 2 },
    ]).join('\n')
    expect(html).toContain('<th align="right">Requests</th>')
    expect(html).toContain('<td align="right">2</td>')
    expect(html).toContain('<td align="right">1.0k</td>')
    expect(html).toContain('<td align="right">1.50 $</td>')
  })
})
