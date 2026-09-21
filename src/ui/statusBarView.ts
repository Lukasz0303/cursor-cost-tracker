import { formatCompactTokens, formatDateTime, formatDollars, formatKind, formatPercentUsed, formatTokens } from '../format'
import {
  MAX_RECENT_QUERY_COUNT,
  type CursorCostConfig,
} from '../config'
import { catalogFor, interpolate } from '../i18n'
import { DEFAULT_LOCALE } from '../locale'
import { isSpike } from '../spikes/threshold'
import {
  applyBudgetDayBasis,
  stripModelPrefix,
  sumMonthUsedUsd,
} from '../usage/parse'
import type { UsageQuery, UsageReady, UsageSnapshot } from '../usage/types'
import { buildBudgetTooltipMarkdown } from './statusBarTooltip'
import { evaluateBurnRate } from '../burnRate/detect'
import { formatPaceLabel, formatBurnSummary } from '../burnRate/copy'
import {
  averageTodayPercent,
  dailyPacePercent,
  proCurrentStatusText,
  proTodayStatusText,
} from './proPercentSummary'

export const SHOW_HISTORY_COMMAND = 'cursorCost.showHistory'
export const REFRESH_COMMAND = 'cursorCost.refresh'
export const RECENT_STATUS_SLOTS = MAX_RECENT_QUERY_COUNT

export type HistoryTab =
  | 'queries'
  | 'stats'
  | 'charts'
  | 'optimize'
  | 'support'
  | 'settings'

export type StatusBarCommand =
  | string
  | {
      command: string
      title: string
      arguments?: unknown[]
    }

export type SpendTone = 'default' | 'green' | 'red'

export type StatusBarItemView = {
  visible: boolean
  text: string
  tooltip: string
  tooltipMarkdown?: boolean
  tone: SpendTone
  command: StatusBarCommand
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

function cycleEndLabel(iso: string | null, locale = DEFAULT_LOCALE): string | null {
  if (iso === null || iso === '') {
    return null
  }
  const day = iso.slice(0, 10)
  const copy = catalogFor(locale).statusBar
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return interpolate(copy.cycleEnds, { day })
  }
  return interpolate(copy.cycleEnds, { day: iso })
}

function joinTooltip(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' · ')
}

function includedQuotaTooltip(data: UsageReady, locale = DEFAULT_LOCALE): string {
  const copy = catalogFor(locale).statusBar
  if (data.includedQuotas.length === 0) {
    return copy.includedUsage
  }
  return data.includedQuotas
    .map((quota) =>
      interpolate(copy.quotaUsed, {
        name: quota.name,
        percent: formatPercentUsed(quota.percent),
      }),
    )
    .join(' · ')
}

function currentTooltip(data: UsageReady, locale = DEFAULT_LOCALE): string {
  const copy = catalogFor(locale).statusBar
  if (data.spendDisplay === 'percent') {
    const text = joinTooltip([
      data.email,
      data.plan,
      cycleEndLabel(data.billingCycleEnd, locale),
      includedQuotaTooltip(data, locale),
    ])
    return text === '' ? includedQuotaTooltip(data, locale) : text
  }

  const text = joinTooltip([
    data.email,
    data.plan,
    cycleEndLabel(data.billingCycleEnd, locale),
    copy.cyclePoolNote,
  ])
  return text === '' ? copy.cyclePoolNote : text
}

function todayTooltip(data: UsageReady, config: CursorCostConfig): string {
  const copy = catalogFor(config.language).statusBar
  if (data.remainingUsd !== null && data.remainingUsd <= 0) {
    return copy.todayNoBudget
  }
  const days = data.workingDaysLeft
  if (days === null) {
    return copy.todayVsCycle
  }
  const unit =
    config.budgetDayBasis === 'calendarDays' ? copy.calendarDays : copy.weekdays
  return interpolate(copy.todayVsDays, { unit, days })
}

function currentText(data: UsageReady, locale = DEFAULT_LOCALE): string {
  if (data.isUnlimited) {
    return `$(credit-card) ${catalogFor(locale).statusBar.unlimited}`
  }
  if (data.spendDisplay === 'percent' && data.includedQuotas.length > 0) {
    const averaged = proCurrentStatusText(data.includedQuotas)
    if (averaged !== null) {
      return `$(credit-card) ${averaged}`
    }
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

function todayText(
  data: UsageReady,
  now: Date,
  budgetDayBasis: CursorCostConfig['budgetDayBasis'],
): string {
  if (isPercentPlan(data) && data.includedQuotas.length > 0) {
    const todayUsd = data.todayUsedUsd ?? 0
    const monthUsd = Math.max(sumMonthUsedUsd(data.recentQueries, now), todayUsd)
    const averaged = proTodayStatusText(
      data.includedQuotas,
      todayUsd,
      monthUsd,
      dailyPacePercent(now, budgetDayBasis),
    )
    if (averaged !== null) {
      return `$(calendar) ${averaged}`
    }
  }
  const used = formatDollars(data.todayUsedUsd ?? 0)
  if (data.dailyBudgetUsd === null || data.dailyBudgetUsd <= 0) {
    return `$(calendar) ${used} / —`
  }
  return `$(calendar) ${used} / ${formatDollars(data.dailyBudgetUsd)}`
}

function todayTone(
  data: UsageReady,
  now: Date,
  config: CursorCostConfig,
): SpendTone {
  const burn = evaluateBurnRate({
    queries: data.recentQueries,
    enabled: config.burnRateGuard,
    windowMinutes: config.burnRateWindowMinutes,
    warningUsd: config.burnRateWarningUsd,
    criticalUsd: config.burnRateCriticalUsd,
    minQueries: config.burnRateMinQueries,
    nowMs: now.getTime(),
  })
  if (burn.level === 'warning' || burn.level === 'critical') {
    return 'red'
  }
  if (isPercentPlan(data) && data.includedQuotas.length > 0) {
    const todayUsd = data.todayUsedUsd ?? 0
    const monthUsd = Math.max(sumMonthUsedUsd(data.recentQueries, now), todayUsd)
    const avg = averageTodayPercent(data.includedQuotas, todayUsd, monthUsd)
    const pace = dailyPacePercent(now, config.budgetDayBasis)
    if (avg === null || pace === null) {
      return 'green'
    }
    return spendTone(avg, pace)
  }
  if (isPercentPlan(data)) {
    return 'green'
  }
  if (data.dailyBudgetUsd === null || data.dailyBudgetUsd <= 0) {
    return 'green'
  }
  return spendTone(data.todayUsedUsd ?? 0, data.dailyBudgetUsd)
}

function modelLabel(model: string | null, locale = DEFAULT_LOCALE): string {
  const stripped = stripModelPrefix(model)
  if (stripped === null || stripped.trim() === '') {
    return catalogFor(locale).statusBar.queryFallback
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

function showHistoryCommand(
  tab: HistoryTab,
  title: string,
): StatusBarCommand {
  if (tab === 'queries') {
    return SHOW_HISTORY_COMMAND
  }
  return {
    command: SHOW_HISTORY_COMMAND,
    title,
    arguments: [tab],
  }
}

function recentQueryView(
  query: UsageQuery,
  config: CursorCostConfig,
): StatusBarItemView {
  const bang =
    config.showSpikeWarning && isSpike(query.tokens, config.spikeTokenThreshold)
  const model = modelLabel(query.model, config.language)
  const copy = catalogFor(config.language)
  return {
    visible: true,
    text: recentQueryText(query, bang),
    tooltip: joinTooltip([
      model,
      formatDateTime(query.timestamp),
      interpolate(copy.statusBar.tokens, { n: formatTokens(query.tokens) }),
      formatKind(query.kind),
    ]),
    tone: bang ? 'red' : 'green',
    command: showHistoryCommand('queries', copy.statusBar.showQueries),
    accessibility: bang
      ? interpolate(copy.statusBar.queryOver, { model })
      : interpolate(copy.statusBar.recentQuery, { model }),
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
    .slice(0, config.recentQueryCount)
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

function refreshItem(
  config: CursorCostConfig,
  spinning: boolean,
): StatusBarItemView {
  const copy = catalogFor(config.language).statusBar
  return {
    visible: config.showStatusBar,
    // Trailing NBSP: icon-only status bar items can collapse to 0 width.
    text: spinning ? '$(sync~spin)\u00A0' : '$(sync)\u00A0',
    tooltip: spinning ? copy.refreshingTooltip : copy.refreshTooltip,
    tone: 'green',
    command: REFRESH_COMMAND,
    accessibility: spinning ? copy.refreshingAria : copy.refreshAria,
  }
}

export function toStatusBarView(
  snapshot: UsageSnapshot,
  config: CursorCostConfig,
  refreshing = false,
  now: Date = new Date(),
): StatusBarView {
  const spinning = refreshing || snapshot.status === 'loading'
  const refresh = refreshItem(config, spinning)
  const copy = catalogFor(config.language).statusBar

  if (!config.showStatusBar) {
    return {
      current: hiddenItem(copy.currentAria),
      today: hiddenItem(copy.todayAria),
      recent: hiddenRecent(),
      refresh,
    }
  }

  if (snapshot.status === 'loading') {
    return {
      current: {
        visible: true,
        text: '$(loading~spin) …',
        tooltip: copy.loading,
        tone: 'default',
        command: showHistoryCommand('stats', copy.showStats),
        accessibility: copy.currentAria,
      },
      today: hiddenItem(copy.todayAria),
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
        command: showHistoryCommand('stats', copy.showStats),
        accessibility: copy.currentAria,
      },
      today: hiddenItem(copy.todayAria),
      recent: hiddenRecent(),
      refresh,
    }
  }

  const data = applyBudgetDayBasis(snapshot.data, config.budgetDayBasis, now)
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
        text: currentText(data, config.language),
        tooltip: currentTooltip(data, config.language),
        tone: currentTone(data),
        command: showHistoryCommand('stats', copy.showStats),
        accessibility: copy.currentAria,
      },
      today: {
        visible: todayVisible,
        text: todayText(data, now, config.budgetDayBasis),
        tooltip: todayTooltip(data, config),
        tone: todayTone(data, now, config),
        command: showHistoryCommand('stats', copy.showStats),
        accessibility: copy.todayAria,
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
    refresh: { ...view.refresh, tone: 'default' },
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
  locale = DEFAULT_LOCALE,
): StatusBarItemView {
  const statsTitle = catalogFor(locale).statusBar.showStats
  const visible = parts.filter((item) => item.visible && item.text !== '')
  if (visible.length === 0) {
    return {
      visible: false,
      text: '',
      tooltip: '',
      tone: 'default',
      command: showHistoryCommand('stats', statsTitle),
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
    command: showHistoryCommand('stats', statsTitle),
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
  const item = joinStatusParts(parts, 'Cursor cost current and today', config.language)
  if (snapshot.status !== 'ready') {
    return item
  }
  const data = applyBudgetDayBasis(snapshot.data, config.budgetDayBasis, now)
  return {
    ...item,
    tooltip: buildBudgetTooltipMarkdown(
      data,
      now,
      burnTooltipLine(data, config, now),
      config.language,
    ),
    tooltipMarkdown: true,
  }
}

function burnTooltipLine(
  data: UsageReady,
  config: CursorCostConfig,
  now: Date,
): string | null {
  if (!config.burnRateGuard) {
    return null
  }
  const burn = evaluateBurnRate({
    queries: data.recentQueries,
    enabled: config.burnRateGuard,
    windowMinutes: config.burnRateWindowMinutes,
    warningUsd: config.burnRateWarningUsd,
    criticalUsd: config.burnRateCriticalUsd,
    minQueries: config.burnRateMinQueries,
    nowMs: now.getTime(),
  })
  const summary = formatBurnSummary(
    burn.window.costUsd,
    config.burnRateWindowMinutes,
    config.language,
  )
  const pace = formatPaceLabel(burn.multiplier, config.language)
  if (pace === null) {
    return summary
  }
  return `${summary} · ${pace}`
}

const CODICONS_RE = /^\$\(([^)]+)\)\s*(.*)$/

export type StatusBarPreviewSegment = {
  icon: string | null
  spin: boolean
  body: string
}

export type StatusBarPreviewChip = {
  id: string
  segments: StatusBarPreviewSegment[]
  tone: SpendTone
  visible: boolean
}

function previewQuery(
  timestamp: number,
  model: string,
  costUsd: number,
  tokens: number,
): UsageQuery {
  return {
    timestamp,
    model,
    kind: 'USAGE_EVENT_KIND_INCLUDED_IN_BUSINESS',
    costUsd,
    tokens,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
  }
}

/** Canned snapshot so Settings can preview the bar without live totals. */
export const STATUS_BAR_PREVIEW_SNAPSHOT: UsageSnapshot = {
  status: 'ready',
  data: {
    email: null,
    plan: 'pro',
    spendDisplay: 'usd',
    includedQuotas: [],
    usedUsd: 12.4,
    limitUsd: 250,
    remainingUsd: 246.18,
    todayUsedUsd: 3.79,
    dailyBudgetUsd: 11.19,
    workingDaysLeft: 22,
    billingCycleStart: '2026-09-01T00:00:00.000Z',
    billingCycleEnd: '2026-09-30T00:00:00.000Z',
    isUnlimited: false,
    includedLine: null,
    onDemandLine: null,
    recentQueries: [
      previewQuery(10, 'cursor-small', 0.04, 8_200),
      previewQuery(9, 'gpt-5', 1.5, 1_200_000),
      previewQuery(8, 'cursor-default', 0.12, 64_800),
      previewQuery(7, 'claude', 0.08, 112_400),
      previewQuery(6, 'gemini', 0.24, 389_100),
      previewQuery(5, 'cursor-fast', 0.02, 5_900),
      previewQuery(4, 'gpt-5-mini', 0.18, 221_700),
      previewQuery(3, 'claude-haiku', 0.06, 73_200),
      previewQuery(2, 'cursor-small', 0.03, 41_600),
      previewQuery(1, 'cursor-default', 0.11, 156_300),
    ],
  },
}

export function statusBarChipParts(text: string): StatusBarPreviewSegment {
  const match = CODICONS_RE.exec(text)
  if (!match) {
    return { icon: null, spin: false, body: text }
  }
  const raw = match[1] ?? ''
  const spin = raw.endsWith('~spin')
  const icon = spin ? raw.slice(0, -5) : raw
  return {
    icon: icon === '' ? null : icon,
    spin,
    body: match[2] ?? '',
  }
}

export function statusBarTextSegments(text: string): StatusBarPreviewSegment[] {
  return text
    .split(STATUS_CHIP_SEPARATOR)
    .filter((part) => part !== '')
    .map(statusBarChipParts)
}

function previewChipFromView(
  id: string,
  item: StatusBarItemView,
): StatusBarPreviewChip {
  return {
    id,
    segments: statusBarTextSegments(item.text),
    tone: item.tone,
    visible: item.visible && item.text !== '',
  }
}

export function toStatusBarPreviewChips(
  config: CursorCostConfig,
  now: Date = new Date(2026, 8, 1, 12, 0, 0),
): StatusBarPreviewChip[] {
  const snapshot = STATUS_BAR_PREVIEW_SNAPSHOT
  const view = toStatusBarView(snapshot, config, false, now)
  const budget = toBudgetStatusItem(view, snapshot, config, now)
  // Fill every sample slot with text so Settings can retarget the count
  // locally (and after a host round-trip) without empty placeholders.
  const filled = toStatusBarView(
    snapshot,
    {
      ...config,
      showStatusBar: true,
      minimalMode: false,
      recentQueryCount: MAX_RECENT_QUERY_COUNT,
    },
    false,
    now,
  )
  const recentLimit =
    !config.showStatusBar || config.minimalMode ? 0 : config.recentQueryCount
  return [
    previewChipFromView('budget', budget),
    previewChipFromView('refresh', view.refresh),
    ...filled.recent.map((item, index) => {
      const chip = previewChipFromView(`recent-${index}`, item)
      return {
        ...chip,
        visible: index < recentLimit,
        tone: config.showSpikeWarning ? chip.tone : 'default',
      }
    }),
  ]
}
