import { describe, expect, it } from 'vitest'
import { DEFAULT_CURSOR_COST_CONFIG, type CursorCostConfig } from '../src/config'
import { toBudgetStatusItem, toStatusBarView, STATUS_CHIP_SEPARATOR, statusBarChipParts, statusBarTextSegments, toStatusBarPreviewChips } from '../src/ui/statusBarView'
import type { UsageReady, UsageSnapshot } from '../src/usage/types'

function ready(overrides: Partial<UsageReady> = {}): UsageSnapshot {
  return {
    status: 'ready',
    data: {
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
      includedLine: null,
      onDemandLine: null,
      recentQueries: [],
      ...overrides,
    },
  }
}

const shown: CursorCostConfig = { ...DEFAULT_CURSOR_COST_CONFIG }

describe('toStatusBarView', () => {
  it('shows a spinner on loading and hides Today', () => {
    const view = toStatusBarView({ status: 'loading' }, shown)
    expect(view.current.text).toContain('$(loading~spin)')
    expect(view.current.visible).toBe(true)
    expect(view.today.visible).toBe(false)
    expect(view.refresh.visible).toBe(true)
    expect(view.refresh.text).toBe('$(sync~spin)\u00A0')
    expect(view.recent.every((item) => item.visible === false)).toBe(true)
  })

  it('shows N/A on error and hides Today', () => {
    const view = toStatusBarView(
      { status: 'error', message: 'Sign in to Cursor' },
      shown,
    )
    expect(view.current.text).toContain('N/A')
    expect(view.current.text).toContain('$(warning)')
    expect(view.current.tooltip).toBe('Sign in to Cursor')
    expect(view.today.visible).toBe(false)
    expect(view.current.tone).toBe('default')
    expect(view.recent.every((item) => item.visible === false)).toBe(true)
  })

  it('shows Unlimited and hides Today', () => {
    const view = toStatusBarView(ready({ isUnlimited: true, limitUsd: null }), shown)
    expect(view.current.text).toContain('Unlimited')
    expect(view.today.visible).toBe(false)
    expect(view.current.tone).toBe('green')
  })

  it('hides Today when todayUsedUsd is null', () => {
    const view = toStatusBarView(ready({ todayUsedUsd: null }), shown)
    expect(view.current.text).toContain('3.79 $')
    expect(view.current.text).toContain('250.00 $')
    expect(view.today.visible).toBe(false)
  })

  it('hides Today when showToday is false', () => {
    const view = toStatusBarView(ready(), { ...shown, showToday: false })
    expect(view.current.visible).toBe(true)
    expect(view.today.visible).toBe(false)
  })

  it('hides all items when showStatusBar is false', () => {
    const view = toStatusBarView(ready(), { ...shown, showStatusBar: false })
    expect(view.current.visible).toBe(false)
    expect(view.today.visible).toBe(false)
    expect(view.refresh.visible).toBe(false)
    expect(view.recent.every((item) => item.visible === false)).toBe(true)
  })

  it('uses green when Current is under the limit', () => {
    const view = toStatusBarView(ready({ usedUsd: 91, limitUsd: 100 }), shown)
    expect(view.current.tone).toBe('green')
  })

  it('uses red when Current is at or over the limit', () => {
    const view = toStatusBarView(ready({ usedUsd: 100, limitUsd: 100 }), shown)
    expect(view.current.tone).toBe('red')
    const over = toStatusBarView(ready({ usedUsd: 101, limitUsd: 100 }), shown)
    expect(over.current.tone).toBe('red')
  })

  it('uses green when Today is under the daily budget', () => {
    const view = toStatusBarView(
      ready({ todayUsedUsd: 8, dailyBudgetUsd: 10 }),
      shown,
    )
    expect(view.today.visible).toBe(true)
    expect(view.today.tone).toBe('green')
  })

  it('uses red when Today is over the daily budget', () => {
    const view = toStatusBarView(
      ready({ todayUsedUsd: 11, dailyBudgetUsd: 10 }),
      shown,
    )
    expect(view.today.tone).toBe('red')
  })

  it('renders Current tooltip with email, plan, and cycle end', () => {
    const view = toStatusBarView(ready(), shown)
    expect(view.current.tooltip).toBe(
      'dev@example.com · pro · cycle ends 2026-09-30 · Cycle pool used / limit (not the sum of today\'s queries)',
    )
    expect(view.current.command).toEqual({
      command: 'cursorCost.showHistory',
      title: 'Show Cursor Cost statistics',
      arguments: ['stats'],
    })
    expect(view.refresh.command).toBe('cursorCost.refresh')
    expect(view.refresh.tooltip).toBe('Refresh usage from cursor.com')
    expect(view.refresh.text).toBe('$(sync)\u00A0')
    expect(view.refresh.tone).toBe('green')
    expect(view.refresh.visible).toBe(true)
  })

  it('spins Refresh while a fetch is in flight', () => {
    const view = toStatusBarView(ready(), shown, true)
    expect(view.refresh.text).toBe('$(sync~spin)\u00A0')
    expect(view.refresh.tooltip).toContain('Refreshing')
    expect(view.current.text).toContain('3.79 $')
  })

  it('renders a dash when limit is missing on a metered plan', () => {
    const view = toStatusBarView(
      ready({ limitUsd: null, isUnlimited: false }),
      shown,
    )
    expect(view.current.text).toContain('/ —')
    expect(view.current.tone).toBe('green')
  })

  it('shows a dash for Today when the daily budget is $0', () => {
    const view = toStatusBarView(
      ready({
        usedUsd: 20,
        limitUsd: 20,
        remainingUsd: 0,
        todayUsedUsd: 29.05,
        dailyBudgetUsd: 0,
      }),
      shown,
    )
    expect(view.today.text).toContain('29.05 $')
    expect(view.today.text).toContain('/ —')
    expect(view.today.text.includes('0.00 $')).toBe(false)
    expect(view.today.tone).toBe('green')
    expect(view.current.tone).toBe('red')
    expect(view.today.tooltip).toContain('Cycle remaining is $0')
  })

  it('shows the configured three newest queries after Today', () => {
    const view = toStatusBarView(
      ready({
        recentQueries: [
          {
            timestamp: 1,
            model: 'old',
            kind: null,
            costUsd: 9,
            tokens: 10,
            inputTokens: 1,
            outputTokens: 1,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
          {
            timestamp: 4,
            model: 'cursor-default',
            kind: null,
            costUsd: 0.03,
            tokens: 64_755,
            inputTokens: 1,
            outputTokens: 1,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
          {
            timestamp: 3,
            model: 'fast',
            kind: null,
            costUsd: 0.1,
            tokens: 237_000,
            inputTokens: 1,
            outputTokens: 1,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
          {
            timestamp: 2,
            model: 'mid',
            kind: null,
            costUsd: 0.05,
            tokens: 52_100,
            inputTokens: 1,
            outputTokens: 1,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
        ],
      }),
      shown,
    )
    expect(view.recent).toHaveLength(10)
    expect(view.recent[0]?.visible).toBe(true)
    expect(view.recent[0]?.text).toBe('0.03 $ - 64.8k')
    expect(view.recent[1]?.text).toBe('0.10 $ - 237.0k')
    expect(view.recent[2]?.text).toBe('0.05 $ - 52.1k')
    expect(view.recent.slice(3).every((item) => item.visible === false)).toBe(true)
    expect(view.recent.every((item) => item.command === 'cursorCost.showHistory')).toBe(
      true,
    )
    expect(view.refresh.visible).toBe(true)
    expect(view.refresh.command).toBe('cursorCost.refresh')
    expect(view.refresh.text).toContain('$(sync)')
    expect(toBudgetStatusItem(view, ready({ recentQueries: [] }), shown).command).toEqual({
      command: 'cursorCost.showHistory',
      title: 'Show Cursor Cost statistics',
      arguments: ['stats'],
    })
  })

  it('shows between one and ten recent queries from configuration', () => {
    const recentQueries = Array.from({ length: 10 }, (_, index) => ({
      timestamp: 10 - index,
      model: `model-${index}`,
      kind: null,
      costUsd: index / 100,
      tokens: (index + 1) * 1_000,
      inputTokens: 1,
      outputTokens: 1,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    }))

    const one = toStatusBarView(
      ready({ recentQueries }),
      { ...shown, recentQueryCount: 1 },
    )
    expect(one.recent.filter((item) => item.visible)).toHaveLength(1)

    const ten = toStatusBarView(
      ready({ recentQueries }),
      { ...shown, recentQueryCount: 10 },
    )
    expect(ten.recent.filter((item) => item.visible)).toHaveLength(10)
  })

  it('prefixes ! and uses red when a recent query is at least 1M tokens', () => {
    const view = toStatusBarView(
      ready({
        recentQueries: [
          {
            timestamp: 10,
            model: 'default',
            kind: null,
            costUsd: 1.2,
            tokens: 1_000_000,
            inputTokens: 1,
            outputTokens: 1,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
          {
            timestamp: 9,
            model: 'default',
            kind: null,
            costUsd: 0.03,
            tokens: 64_755,
            inputTokens: 1,
            outputTokens: 1,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
        ],
      }),
      shown,
    )
    expect(view.recent[0]?.text).toBe('! 1.20 $ - 1.0M')
    expect(view.recent[0]?.tone).toBe('red')
    expect(view.recent[1]?.text).toBe('0.03 $ - 64.8k')
    expect(view.recent[1]?.tone).toBe('green')
    expect(view.recent[2]?.visible).toBe(false)
  })

  it('omits ! when showSpikeWarning is false', () => {
    const view = toStatusBarView(
      ready({
        recentQueries: [
          {
            timestamp: 1,
            model: 'default',
            kind: null,
            costUsd: 1.2,
            tokens: 2_000_000,
            inputTokens: 1,
            outputTokens: 1,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
        ],
      }),
      { ...shown, showSpikeWarning: false },
    )
    expect(view.recent[0]?.text).toBe('1.20 $ - 2.0M')
    expect(view.recent[0]?.tone).toBe('default')
    expect(view.current.tone).toBe('default')
    expect(view.refresh.tone).toBe('default')
  })

  it('drops Current/Today colors when warnings are off', () => {
    const view = toStatusBarView(
      ready({ usedUsd: 100, limitUsd: 100 }),
      { ...shown, showSpikeWarning: false },
    )
    expect(view.current.tone).toBe('default')
    expect(view.today.tone).toBe('default')
    expect(view.refresh.tone).toBe('default')
  })
})

describe('status bar chips', () => {
  it('keeps Current/Today color independent of recent-query spikes', () => {
    const snapshot = ready({
      recentQueries: [
        {
          timestamp: 3,
          model: 'a',
          kind: null,
          costUsd: 0.03,
          tokens: 64_755,
          inputTokens: 1,
          outputTokens: 1,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
        },
        {
          timestamp: 2,
          model: 'b',
          kind: null,
          costUsd: 0.1,
          tokens: 237_000,
          inputTokens: 1,
          outputTokens: 1,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
        },
        {
          timestamp: 1,
          model: 'c',
          kind: null,
          costUsd: 1.2,
          tokens: 1_000_000,
          inputTokens: 1,
          outputTokens: 1,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
        },
      ],
    })
    const view = toStatusBarView(snapshot, shown)
    const budget = toBudgetStatusItem(view, snapshot, shown)
    expect(budget.text).toBe(
      ['$(credit-card) 3.79 $ / 250.00 $', '$(calendar) 3.79 $ / 11.19 $'].join(
        STATUS_CHIP_SEPARATOR,
      ),
    )
    expect(budget.tone).toBe('green')
    expect(view.recent[0]?.text).toBe('0.03 $ - 64.8k')
    expect(view.recent[0]?.tone).toBe('green')
    expect(view.recent[1]?.text).toBe('0.10 $ - 237.0k')
    expect(view.recent[1]?.tone).toBe('green')
    expect(view.recent[2]?.text).toBe('! 1.20 $ - 1.0M')
    expect(view.recent[2]?.tone).toBe('red')
  })

  it('turns recent queries green when they are under the warn threshold', () => {
    const snapshot = ready({
        usedUsd: 20,
        limitUsd: 20,
        remainingUsd: 0,
        todayUsedUsd: 29.05,
        dailyBudgetUsd: 0,
        recentQueries: [
          {
            timestamp: 1,
            model: 'a',
            kind: null,
            costUsd: 1.24,
            tokens: 2_300_000,
            inputTokens: 1,
            outputTokens: 1,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
          },
        ],
      })
    const view = toStatusBarView(
      snapshot,
      { ...shown, spikeTokenThreshold: 10_000_000 },
    )
    expect(toBudgetStatusItem(view, snapshot, shown).tone).toBe('red')
    expect(view.recent[0]?.text).toBe('1.24 $ - 2.3M')
    expect(view.recent[0]?.tone).toBe('green')
  })

  it('shows included-quota percents for personal Pro and keeps Today in dollars', () => {
    const view = toStatusBarView(
      ready({
        spendDisplay: 'percent',
        includedQuotas: [
          { name: 'Cursor Models', used: 1400, limit: 20000, percent: 7 },
          { name: 'Other Models', used: 0, limit: 100, percent: 0 },
        ],
        usedUsd: 20,
        limitUsd: 20,
      }),
      shown,
    )
    expect(view.current.text).toBe('$(credit-card) 7% · 0%')
    expect(view.current.tone).toBe('green')
    expect(view.current.tooltip).toContain('Cursor Models 7% used')
    expect(view.current.tooltip).toContain('Other Models 0% used')
    expect(view.today.visible).toBe(true)
    expect(view.today.text).toContain('3.79 $')
  })

  it('keeps Pro Current and Today green — percents and today spend are not a dollar-pool cap', () => {
    const snapshot = ready({
        spendDisplay: 'percent',
        includedQuotas: [
          { name: 'Cursor Models', used: 9, limit: 100, percent: 9 },
          { name: 'Other Models', used: 0, limit: 100, percent: 0 },
        ],
        usedUsd: 20,
        limitUsd: 20,
        remainingUsd: 0,
        todayUsedUsd: 4.86,
        dailyBudgetUsd: 0,
      })
    const view = toStatusBarView(snapshot, shown)
    expect(view.current.text).toBe('$(credit-card) 9% · 0%')
    expect(view.current.tone).toBe('green')
    expect(view.today.text).toContain('/ —')
    expect(view.today.tone).toBe('green')
    expect(toBudgetStatusItem(view, snapshot, shown).tone).toBe('green')
  })

  it('keeps Pro Current green even when an included quota is at 100%', () => {
    const view = toStatusBarView(
      ready({
        spendDisplay: 'percent',
        includedQuotas: [
          { name: 'Cursor Models', used: 20000, limit: 20000, percent: 100 },
        ],
        usedUsd: 20,
        limitUsd: 20,
      }),
      shown,
    )
    expect(view.current.text).toBe('$(credit-card) 100%')
    expect(view.current.tone).toBe('green')
  })

  it('hides Today and recent queries in minimalMode', () => {
    const view = toStatusBarView(ready(), { ...shown, minimalMode: true })
    expect(view.current.visible).toBe(true)
    expect(view.today.visible).toBe(false)
    expect(view.refresh.visible).toBe(true)
    expect(view.recent.every((item) => item.visible === false)).toBe(true)
    const budget = toBudgetStatusItem(view, ready(), { ...shown, minimalMode: true })
    expect(budget.text).toContain('3.79 $')
    expect(budget.text.includes('Today')).toBe(false)
  })

  it('builds a markdown budget tooltip with reset and billing pools', () => {
    const snapshot = ready({
      includedLine: '512 / 500',
      onDemandLine: '3.79 $ / 250.00 $',
      recentQueries: [
        {
          timestamp: 1,
          model: 'gpt-5',
          kind: null,
          costUsd: 1.5,
          tokens: 1000,
            outputTokens: 500,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
        },
      ],
    })
    const view = toStatusBarView(snapshot, shown)
    const budget = toBudgetStatusItem(
      view,
      snapshot,
      shown,
      new Date('2026-09-20T12:00:00'),
    )
    expect(budget.tooltipMarkdown).toBe(true)
    expect(budget.tooltip).toContain('$(credit-card) **Cursor Cost**')
    expect(budget.tooltip).toContain('Resets in 10 days (2026-09-30)')
    expect(budget.tooltip).toContain('<strong>Included</strong>')
    expect(budget.tooltip).toContain('512 / 500')
    expect(budget.tooltip).toContain('<strong>On-demand</strong>')
    expect(budget.tooltip).toContain('3.79 $ / 250.00 $')
    expect(budget.tooltip).toContain('align="right"')
    expect(budget.tooltip).toContain('gpt-5')
    expect(budget.tooltip).toContain('[Open Dashboard](https://cursor.com/dashboard)')
    expect(budget.tooltip).toContain('command:cursorCost.refresh')
  })
})

describe('statusBarChipParts', () => {
  it('strips a leading codicon and ~spin', () => {
    expect(statusBarChipParts('$(credit-card) 12.40 $ / 250.00 $')).toEqual({
      icon: 'credit-card',
      spin: false,
      body: '12.40 $ / 250.00 $',
    })
    expect(statusBarChipParts('$(sync~spin)')).toEqual({
      icon: 'sync',
      spin: true,
      body: '',
    })
    expect(statusBarChipParts('$(sync)\u00A0')).toEqual({
      icon: 'sync',
      spin: false,
      body: '',
    })
    expect(statusBarChipParts('! 1.50 $ - 1.2M')).toEqual({
      icon: null,
      spin: false,
      body: '! 1.50 $ - 1.2M',
    })
  })

  it('splits joined Current/Today into segments', () => {
    const text = `$(credit-card) 12.40 $ / 250.00 $${STATUS_CHIP_SEPARATOR}$(calendar) 3.79 $ / 11.19 $`
    expect(statusBarTextSegments(text)).toEqual([
      { icon: 'credit-card', spin: false, body: '12.40 $ / 250.00 $' },
      { icon: 'calendar', spin: false, body: '3.79 $ / 11.19 $' },
    ])
  })
})

describe('toStatusBarPreviewChips', () => {
  it('shows sample Current, Today, a spike query, and Refresh', () => {
    const chips = toStatusBarPreviewChips(shown)
    const byId = Object.fromEntries(chips.map((chip) => [chip.id, chip]))
    expect(byId.budget?.visible).toBe(true)
    expect(byId.budget?.segments.some((seg) => seg.icon === 'credit-card')).toBe(
      true,
    )
    expect(byId.budget?.segments.some((seg) => seg.icon === 'calendar')).toBe(
      true,
    )
    expect(byId.refresh?.visible).toBe(true)
    expect(byId.refresh?.segments.some((seg) => seg.icon === 'sync')).toBe(true)
    expect(byId.refresh?.tone).toBe('green')
    expect(byId.download).toBeUndefined()
    const recents = chips.filter((chip) => chip.id.startsWith('recent-') && chip.visible)
    expect(recents).toHaveLength(3)
    expect(recents.some((chip) => chip.tone === 'red')).toBe(true)
    expect(
      recents.some((chip) =>
        chip.segments.some((seg) => seg.body.startsWith('! ')),
      ),
    ).toBe(true)
  })

  it('fills all sample recent slots and respects recentQueryCount visibility', () => {
    const chips = toStatusBarPreviewChips({ ...shown, recentQueryCount: 6 })
    const recent = chips.filter((chip) => chip.id.startsWith('recent-'))
    expect(recent).toHaveLength(10)
    expect(recent.filter((chip) => chip.visible)).toHaveLength(6)
    expect(
      recent.every((chip) =>
        chip.segments.some((seg) => typeof seg.body === 'string' && seg.body !== ''),
      ),
    ).toBe(true)
  })

  it('hides Today in the sample when showToday is off', () => {
    const chips = toStatusBarPreviewChips({ ...shown, showToday: false })
    const budget = chips.find((chip) => chip.id === 'budget')
    expect(budget?.segments.some((seg) => seg.icon === 'calendar')).toBe(false)
  })

  it('hides recent queries in the sample when minimalMode is on', () => {
    const chips = toStatusBarPreviewChips({ ...shown, minimalMode: true })
    expect(chips.filter((chip) => chip.id.startsWith('recent-') && chip.visible)).toEqual(
      [],
    )
    const budget = chips.find((chip) => chip.id === 'budget')
    expect(budget?.segments.some((seg) => seg.icon === 'calendar')).toBe(false)
  })

  it('hides every sample chip when showStatusBar is false', () => {
    const chips = toStatusBarPreviewChips({ ...shown, showStatusBar: false })
    expect(chips.every((chip) => chip.visible === false)).toBe(true)
  })

  it('drops ! and warning colors when showSpikeWarning is off', () => {
    const chips = toStatusBarPreviewChips({ ...shown, showSpikeWarning: false })
    expect(chips.every((chip) => chip.tone === 'default' || !chip.visible)).toBe(
      true,
    )
    expect(
      chips.some((chip) =>
        chip.segments.some((seg) => seg.body.startsWith('! ')),
      ),
    ).toBe(false)
  })
})
