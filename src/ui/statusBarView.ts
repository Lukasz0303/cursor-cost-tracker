import { formatCompactTokens, formatDateTime, formatDollars, formatKind, formatPercentUsed, formatTokens } from '../format'
import type { CursorCostConfig } from '../config'
import { isSpike } from '../spikes/threshold'
import { stripModelPrefix } from '../usage/parse'
import type { UsageQuery, UsageReady, UsageSnapshot } from '../usage/types'
import { buildBudgetTooltipMarkdown } from './statusBarTooltip'

export const SHOW_HISTORY_COMMAND = 'cursorCost.showHistory'
export const REFRESH_COMMAND = 'cursorCost.refresh'
export const RECENT_STATUS_SLOTS = 3

export type SpendTone = 'default' | 'green' | 'red'

export type StatusBarItemView = {
  visible: boolean
  text: string
  tooltip: string
  tooltipMarkdown?: boolean
  tone: SpendTone
  command: string
  accessibility: string
}

export type StatusBarView = {
  current: StatusBarItemView
  today: StatusBarItemView
  recent: StatusBarItemView[]
  refresh: StatusBarItemView
}

function spendTone(used: number, cap: number | null): SpendTone {
  if (!Number.isFinite(used)) {
    return 'default'
  }
  if (cap === null) {
    return 'green'
  }
  if (!(cap > 0)) {
    return used > 0 ? 'red' : 'green'
  }
  if (used >= cap) {
    return 'red'
  }
  return 'green'
}

function cycleEndLabel(iso: string | null): string | null {
  if (iso === null || iso === '') {
    return null
  }
  const day = iso.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return `cycle ends ${day}`
  }
  return `cycle ends ${iso}`
}

function joinTooltip(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' · ')
}

function includedQuotaTooltip(data: UsageReady): string {
  if (data.includedQuotas.length === 0) {
    return 'Included usage'
  }
  return data.includedQuotas
    .map((quota) => `${quota.name} ${formatPercentUsed(quota.percent)} used`)
    .join(' · ')
}

function currentTooltip(data: UsageReady): string {
  if (data.spendDisplay === 'percent') {
    const text = joinTooltip([
      data.email,
      data.plan,
      cycleEndLabel(data.billingCycleEnd),
      includedQuotaTooltip(data),
    ])
    return text === '' ? includedQuotaTooltip(data) : text
  }

  const text = joinTooltip([
    data.email,
    data.plan,
    cycleEndLabel(data.billingCycleEnd),
    'Cycle pool used / limit (not the sum of today\'s queries)',
  ])
  return text === ''
    ? 'Cycle pool used / limit (not the sum of today\'s queries)'
    : text
}

function todayTooltip(data: UsageReady): string {
  if (data.remainingUsd !== null && data.remainingUsd <= 0) {
    return "Today = sum of today's queries. Cycle remaining is $0, so there is no daily budget. Today can exceed Current (events vs plan pool)."
  }
  const days = data.workingDaysLeft
  if (days === null) {
    return "Today = sum of today's queries vs remaining cycle allowance."
  }
  return `Today = sum of today's queries vs remaining cycle ÷ working days left (${days} days).`
}

function currentText(data: UsageReady): string {
  if (data.isUnlimited) {
    return '$(credit-card) Unlimited'
  }
  if (data.spendDisplay === 'percent' && data.includedQuotas.length > 0) {
    const percents = data.includedQuotas
      .map((quota) => formatPercentUsed(quota.percent))
      .join(' · ')
    return `$(credit-card) ${percents}`
  }
  const used = formatDollars(data.usedUsd)
  if (data.limitUsd === null) {
    return `$(credit-card) ${used} / —`
  }
  return `$(credit-card) ${used} / ${formatDollars(data.limitUsd)}`
}

function isPercentPlan(data: UsageReady): boolean {
  return data.spendDisplay === 'percent'
}

function currentTone(data: UsageReady): SpendTone {
  if (data.isUnlimited || isPercentPlan(data)) {
    return 'green'
  }
  return spendTone(data.usedUsd, data.limitUsd)
}

function todayText(data: UsageReady): string {
  const used = formatDollars(data.todayUsedUsd ?? 0)
  if (data.dailyBudgetUsd === null || data.dailyBudgetUsd <= 0) {
    return `$(calendar) ${used} / —`
  }
  return `$(calendar) ${used} / ${formatDollars(data.dailyBudgetUsd)}`
}

function todayTone(data: UsageReady): SpendTone {
  if (isPercentPlan(data)) {
    return 'green'
  }
  if (data.dailyBudgetUsd === null || data.dailyBudgetUsd <= 0) {
    return 'green'
  }
  return spendTone(data.todayUsedUsd ?? 0, data.dailyBudgetUsd)
}

function modelLabel(model: string | null): string {
  const stripped = stripModelPrefix(model)
  if (stripped === null || stripped.trim() === '') {
    return 'query'
  }
  return stripped
}

function recentQueryText(query: UsageQuery, bang: boolean): string {
  const body = `${formatDollars(query.costUsd)} - ${formatCompactTokens(query.tokens)}`
  if (!bang) {
    return body
  }
  return `! ${body}`
}

function recentQueryView(
  query: UsageQuery,
  config: CursorCostConfig,
): StatusBarItemView {
  const bang =
    config.showSpikeWarning && isSpike(query.tokens, config.spikeTokenThreshold)
  const model = modelLabel(query.model)
  return {
    visible: true,
    text: recentQueryText(query, bang),
    tooltip: joinTooltip([
      model,
      formatDateTime(query.timestamp),
      `${formatTokens(query.tokens)} tokens`,
      formatKind(query.kind),
    ]),
    tone: bang ? 'red' : 'green',
    command: SHOW_HISTORY_COMMAND,
    accessibility: bang
      ? `Query over token warning ${model}`
      : `Recent query ${model}`,
  }
}

function hiddenItem(accessibility: string): StatusBarItemView {
  return {
    visible: false,
    text: '',
    tooltip: '',
    tone: 'default',
    command: SHOW_HISTORY_COMMAND,
    accessibility,
  }
}

function hiddenRecent(): StatusBarItemView[] {
  return Array.from({ length: RECENT_STATUS_SLOTS }, () =>
    hiddenItem('Cursor cost recent query'),
  )
}

function recentViews(
  queries: UsageQuery[],
  config: CursorCostConfig,
): StatusBarItemView[] {
  const newest = [...queries]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, RECENT_STATUS_SLOTS)
  const slots = hiddenRecent()
  for (let i = 0; i < newest.length; i++) {
    const query = newest[i]
    if (query === undefined) {
      continue
    }
    slots[i] = recentQueryView(query, config)
  }
  return slots
}

export function toStatusBarView(
  snapshot: UsageSnapshot,
  config: CursorCostConfig,
): StatusBarView {
  const refresh: StatusBarItemView = {
    visible: config.showStatusBar,
    text: '$(sync)',
    tooltip: 'Refresh',
    tone: 'default',
    command: REFRESH_COMMAND,
    accessibility: 'Refresh Cursor cost',
  }

  if (!config.showStatusBar) {
    return {
      current: hiddenItem('Cursor cost current'),
      today: hiddenItem('Cursor cost today'),
      recent: hiddenRecent(),
      refresh: { ...refresh, visible: false },
    }
  }

  if (snapshot.status === 'loading') {
    return {
      current: {
        visible: true,
        text: '$(loading~spin) …',
        tooltip: 'Loading usage…',
        tone: 'default',
        command: SHOW_HISTORY_COMMAND,
        accessibility: 'Cursor cost current',
      },
      today: hiddenItem('Cursor cost today'),
      recent: hiddenRecent(),
      refresh,
    }
  }

  if (snapshot.status === 'error') {
    return {
      current: {
        visible: true,
        text: '$(warning) N/A',
        tooltip: snapshot.message,
        tone: 'default',
        command: SHOW_HISTORY_COMMAND,
        accessibility: 'Cursor cost current',
      },
      today: hiddenItem('Cursor cost today'),
      recent: hiddenRecent(),
      refresh,
    }
  }

  const data = snapshot.data
  const minimal = config.minimalMode
  const todayVisible =
    !minimal &&
    config.showToday &&
    !data.isUnlimited &&
    data.todayUsedUsd !== null

  return applyWarningDisplay(
    {
      current: {
        visible: true,
        text: currentText(data),
        tooltip: currentTooltip(data),
        tone: currentTone(data),
        command: SHOW_HISTORY_COMMAND,
        accessibility: 'Cursor cost current',
      },
      today: {
        visible: todayVisible,
        text: todayText(data),
        tooltip: todayTooltip(data),
        tone: todayTone(data),
        command: SHOW_HISTORY_COMMAND,
        accessibility: 'Cursor cost today',
      },
      recent: minimal ? hiddenRecent() : recentViews(data.recentQueries, config),
      refresh,
    },
    config,
  )
}

function applyWarningDisplay(
  view: StatusBarView,
  config: CursorCostConfig,
): StatusBarView {
  if (config.showSpikeWarning) {
    return view
  }
  return {
    current: { ...view.current, tone: 'default' },
    today: { ...view.today, tone: 'default' },
    recent: view.recent.map((item) => ({ ...item, tone: 'default' })),
    refresh: view.refresh,
  }
}

const TONE_RANK: Record<SpendTone, number> = {
  default: 0,
  green: 1,
  red: 2,
}

export const STATUS_CHIP_SEPARATOR = '   '

function worstTone(tones: SpendTone[]): SpendTone {
  let worst: SpendTone = 'default'
  for (const tone of tones) {
    if (TONE_RANK[tone] > TONE_RANK[worst]) {
      worst = tone
    }
  }
  return worst
}

function joinStatusParts(
  parts: StatusBarItemView[],
  accessibility: string,
): StatusBarItemView {
  const visible = parts.filter((item) => item.visible && item.text !== '')
  if (visible.length === 0) {
    return {
      visible: false,
      text: '',
      tooltip: '',
      tone: 'default',
      command: SHOW_HISTORY_COMMAND,
      accessibility,
    }
  }

  return {
    visible: true,
    text: visible.map((item) => item.text).join(STATUS_CHIP_SEPARATOR),
    tooltip: visible
      .map((item) => item.tooltip)
      .filter((tip) => tip !== '')
      .join('\n'),
    tone: worstTone(visible.map((item) => item.tone)),
    command: SHOW_HISTORY_COMMAND,
    accessibility,
  }
}

export function toBudgetStatusItem(
  view: StatusBarView,
  snapshot: UsageSnapshot,
  config: CursorCostConfig,
  now: Date = new Date(),
): StatusBarItemView {
  const parts = config.minimalMode ? [view.current] : [view.current, view.today]
  const item = joinStatusParts(parts, 'Cursor cost current and today')
  if (snapshot.status !== 'ready') {
    return item
  }
  return {
    ...item,
    tooltip: buildBudgetTooltipMarkdown(snapshot.data, now),
    tooltipMarkdown: true,
  }
}
