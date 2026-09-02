import {
  cycleResetLabel,
  formatCompactTokens,
  formatDateTime,
  formatDollars,
  formatKind,
  formatPercentUsed,
  formatTokens,
} from '../format'
import { isSpike } from '../spikes/threshold'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
  lastQueriesHeading,
} from '../historyLimit'
import { stripModelPrefix } from '../usage/parse'
import type { UsageQuery, UsageReady, UsageSnapshot } from '../usage/types'
import { sharePercents, type PeriodShare } from './periodCards'

const BREAKDOWN_LIMIT = 8

export const CURRENT_PRO_BODY =
  'Included Cursor Models and Other Models this cycle — same bars as the dashboard.'
export const CURRENT_TEAM_BODY =
  'Dollar pool used / cap this billing cycle.'
export const TODAY_PRO_BODY =
  'Sum of today’s queries. Not the included-percent bars.'
export const TODAY_TEAM_BODY =
  'Today’s queries vs remaining cycle ÷ weekdays left.'
export const TODAY_TEAM_NO_BUDGET_BODY =
  'No daily budget — the monthly dollar pool is empty.'
export const SAMPLE_NOTE_SUFFIX = ' is recent queries, not Current.'
export const CACHE_HIT_HINT =
  'Share of prompt tokens reused from cache instead of billed as new input. Cached tokens cost less.'

export function sampleNoteForLimit(limit: number): string {
  return `${lastQueriesHeading(limit)}${SAMPLE_NOTE_SUFFIX}`
}

export const SAMPLE_NOTE = sampleNoteForLimit(DEFAULT_HISTORY_LIMIT)
export const QUERIES_OVER_TOKEN_WARNING_LABEL = 'Queries over token warning'

function isPercentPlan(data: UsageReady): boolean {
  return data.spendDisplay === 'percent'
}

function currentGlossaryBody(data: UsageReady): string {
  if (isPercentPlan(data)) {
    return CURRENT_PRO_BODY
  }
  return CURRENT_TEAM_BODY
}

function todayGlossaryBody(data: UsageReady): string {
  if (isPercentPlan(data)) {
    return TODAY_PRO_BODY
  }
  if (data.remainingUsd !== null && data.remainingUsd <= 0) {
    return TODAY_TEAM_NO_BUDGET_BODY
  }
  return TODAY_TEAM_BODY
}

export type PeriodBar = {
  label: string
  value: string
  percent: number
}

export type PeriodGlossaryItem = {
  id: 'current' | 'today'
  title: string
  value: string
  body: string
  bars: PeriodBar[]
}

export type PeriodMetric = {
  id: string
  label: string
  value: string
  hint?: string
  detail?: string
  percent?: number
  shares?: PeriodShare[]
}

export type PeriodBreakdownRow = {
  label: string
  value: string
  share: string
  percent: number
}

export type PeriodStatsPayload = {
  glossary: PeriodGlossaryItem[]
  cycle: PeriodMetric[]
  sample: PeriodMetric[]
  byModel: PeriodBreakdownRow[]
  byKind: PeriodBreakdownRow[]
  sampleNote: string
  historyLimit: number
  queryCount: number
}

export type PeriodStatsOptions = {
  spikeTokenThreshold: number
  historyLimit?: number
  now?: Date
}

function dash(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === '') {
    return '—'
  }
  return value
}

function formatPlan(plan: string | null): string {
  const raw = dash(plan)
  if (raw === '—') {
    return raw
  }
  return raw
    .split(/[_\s-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function metric(
  id: string,
  label: string,
  value: string,
  extra?: Omit<PeriodMetric, 'id' | 'label' | 'value'>,
): PeriodMetric {
  return { id, label, value, ...extra }
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
  }
  return sorted[mid] ?? 0
}

function cacheHitPercent(input: number, cacheRead: number): number {
  const prompt = input + cacheRead
  if (!(prompt > 0)) {
    return 0
  }
  return Math.round((cacheRead / prompt) * 100)
}

function tokenShares(
  input: number,
  output: number,
  cacheWrite: number,
  cacheRead: number,
): PeriodShare[] {
  const percents = sharePercents([input, output, cacheWrite, cacheRead])
  return [
    { key: 'input', label: 'Input', percent: percents[0] ?? 0 },
    { key: 'output', label: 'Output', percent: percents[1] ?? 0 },
    { key: 'cacheWrite', label: 'Cache write', percent: percents[2] ?? 0 },
    { key: 'cacheRead', label: 'Cache read', percent: percents[3] ?? 0 },
  ]
}

function costPerMillion(costUsd: number, tokens: number): string {
  if (!(tokens > 0) || !Number.isFinite(costUsd)) {
    return '—'
  }
  return formatDollars((costUsd / tokens) * 1_000_000)
}

function cycleElapsedPercent(
  startIso: string | null,
  endIso: string | null,
  now: Date,
): number | undefined {
  if (startIso === null || startIso === '' || endIso === null || endIso === '') {
    return undefined
  }
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return undefined
  }
  const raw = ((now.getTime() - start) / (end - start)) * 100
  return Math.max(0, Math.min(100, Math.round(raw)))
}

function isoDay(iso: string | null): string | null {
  if (iso === null || iso === '') {
    return null
  }
  const day = iso.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return day
  }
  return iso
}

function currentValue(data: UsageReady): string {
  if (data.isUnlimited) {
    return 'Unlimited'
  }
  if (data.spendDisplay === 'percent' && data.includedQuotas.length > 0) {
    return data.includedQuotas
      .map((quota) => formatPercentUsed(quota.percent))
      .join(' · ')
  }
  if (data.limitUsd === null) {
    return `${formatDollars(data.usedUsd)} / —`
  }
  return `${formatDollars(data.usedUsd)} / ${formatDollars(data.limitUsd)}`
}

function todayValue(data: UsageReady): string {
  if (data.todayUsedUsd === null) {
    return '—'
  }
  const used = formatDollars(data.todayUsedUsd)
  if (data.dailyBudgetUsd === null || data.dailyBudgetUsd <= 0) {
    return `${used} / —`
  }
  return `${used} / ${formatDollars(data.dailyBudgetUsd)}`
}

function newestQueries(queries: UsageQuery[], limit: number): UsageQuery[] {
  return [...queries]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, limit)
}

function sumCost(queries: UsageQuery[]): number {
  let sum = 0
  for (const query of queries) {
    sum += query.costUsd
  }
  return sum
}

function modelLabel(model: string | null): string {
  const stripped = stripModelPrefix(model)
  if (stripped === null || stripped.trim() === '') {
    return '—'
  }
  return stripped
}

function groupCost(
  queries: UsageQuery[],
  keyOf: (query: UsageQuery) => string,
): PeriodBreakdownRow[] {
  const totals = new Map<string, number>()
  let all = 0
  for (const query of queries) {
    const key = keyOf(query)
    const next = (totals.get(key) ?? 0) + query.costUsd
    totals.set(key, next)
    all += query.costUsd
  }

  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, BREAKDOWN_LIMIT)
    .map(([label, value]) => {
      const percent = all > 0 ? Math.round((value / all) * 100) : 0
      return {
        label,
        value: formatDollars(value),
        share: `${percent}%`,
        percent,
      }
    })
}

function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function busiestDay(queries: UsageQuery[]): PeriodMetric {
  if (queries.length === 0) {
    return metric('busiest', 'Busiest day', '—')
  }
  const byDay = new Map<string, number>()
  const byDayCount = new Map<string, number>()
  for (const query of queries) {
    const key = dayKey(query.timestamp)
    byDay.set(key, (byDay.get(key) ?? 0) + query.costUsd)
    byDayCount.set(key, (byDayCount.get(key) ?? 0) + 1)
  }
  let bestDay = ''
  let bestCost = -1
  for (const [day, cost] of byDay) {
    if (cost > bestCost) {
      bestDay = day
      bestCost = cost
    }
  }
  const count = byDayCount.get(bestDay) ?? 0
  return metric('busiest', 'Busiest day', formatDollars(bestCost), {
    detail: bestDay,
    hint: count === 1 ? '1 query' : `${formatTokens(count)} queries`,
  })
}

function poolPercent(used: number, cap: number | null): number {
  if (cap === null || !(cap > 0)) {
    return used > 0 ? 100 : 0
  }
  return Math.round((used / cap) * 100)
}

function currentBars(data: UsageReady): PeriodBar[] {
  if (data.isUnlimited) {
    return [{ label: 'Current', value: 'Unlimited', percent: 0 }]
  }
  if (isPercentPlan(data) && data.includedQuotas.length > 0) {
    return data.includedQuotas.map((quota) => ({
      label: quota.name,
      value: formatPercentUsed(quota.percent),
      percent: quota.percent,
    }))
  }
  return [
    {
      label: 'Cycle pool',
      value: currentValue(data),
      percent: poolPercent(data.usedUsd, data.limitUsd),
    },
  ]
}

function todayBars(data: UsageReady): PeriodBar[] {
  if (data.todayUsedUsd === null) {
    return []
  }
  if (data.dailyBudgetUsd === null || data.dailyBudgetUsd <= 0) {
    return []
  }
  return [
    {
      label: 'Today',
      value: todayValue(data),
      percent: poolPercent(data.todayUsedUsd, data.dailyBudgetUsd),
    },
  ]
}

function glossaryItem(
  id: PeriodGlossaryItem['id'],
  title: string,
  value: string,
  body: string,
  bars: PeriodBar[],
): PeriodGlossaryItem {
  return { id, title, value, body, bars }
}

function emptyStats(historyLimit: number): PeriodStatsPayload {
  return {
    glossary: [
      glossaryItem('current', 'Current', '—', CURRENT_TEAM_BODY, []),
      glossaryItem('today', 'Today', '—', TODAY_TEAM_BODY, []),
    ],
    cycle: [],
    sample: [],
    byModel: [],
    byKind: [],
    sampleNote: sampleNoteForLimit(historyLimit),
    historyLimit,
    queryCount: 0,
  }
}

function cycleMetrics(
  data: UsageReady,
  sampleSum: number,
  historyLimit: number,
  now: Date,
): PeriodMetric[] {
  const start = isoDay(data.billingCycleStart)
  const end = isoDay(data.billingCycleEnd)
  const cycle =
    start && end ? `${start} → ${end}` : dash(end ?? start)
  const reset = cycleResetLabel(data.billingCycleEnd, now)
  const elapsed = cycleElapsedPercent(
    data.billingCycleStart,
    data.billingCycleEnd,
    now,
  )

  const metrics: PeriodMetric[] = [
    metric('plan', 'Plan', formatPlan(data.plan)),
    metric('cycle', 'Billing cycle', cycle, {
      hint: reset ?? undefined,
      percent: elapsed,
    }),
  ]

  if (isPercentPlan(data)) {
    return metrics
  }

  const remaining =
    data.isUnlimited || data.remainingUsd === null
      ? '—'
      : formatDollars(data.remainingUsd)
  const daily =
    data.dailyBudgetUsd === null || data.dailyBudgetUsd <= 0
      ? '—'
      : formatDollars(data.dailyBudgetUsd)
  const days =
    data.workingDaysLeft === null ? '—' : String(data.workingDaysLeft)

  metrics.push(
    metric('remaining', 'Remaining', remaining),
    metric('workingDays', 'Working days left', days),
    metric('dailyBudget', 'Daily budget', daily),
    metric(
      'sampleVsCurrent',
      `${lastQueriesHeading(historyLimit)} vs Current`,
      `${formatDollars(sampleSum)} vs ${formatDollars(data.usedUsd)}`,
    ),
  )
  return metrics
}

function sampleMetrics(
  queries: UsageQuery[],
  spikeTokenThreshold: number,
  historyLimit: number,
): PeriodMetric[] {
  const heading = lastQueriesHeading(historyLimit)
  if (queries.length === 0) {
    return [
      metric('avgTokens', 'Average per query tokens', '0'),
      metric('total', `${heading} total`, formatDollars(0)),
    ]
  }

  const total = sumCost(queries)
  const tokens = queries.reduce((sum, query) => sum + query.tokens, 0)
  const input = queries.reduce((sum, query) => sum + query.inputTokens, 0)
  const output = queries.reduce((sum, query) => sum + query.outputTokens, 0)
  const cacheWrite = queries.reduce(
    (sum, query) => sum + (query.cacheWriteTokens ?? 0),
    0,
  )
  const cacheRead = queries.reduce(
    (sum, query) => sum + (query.cacheReadTokens ?? 0),
    0,
  )
  const spikes = queries.filter((query) =>
    isSpike(query.tokens, spikeTokenThreshold),
  ).length
  const hit = cacheHitPercent(input, cacheRead)
  const queryNoun = queries.length === 1 ? 'query' : 'queries'

  let priciest = queries[0]
  let heaviest = queries[0]
  for (const query of queries) {
    if (priciest && query.costUsd > priciest.costUsd) {
      priciest = query
    }
    if (heaviest && query.tokens > heaviest.tokens) {
      heaviest = query
    }
  }

  const metrics: PeriodMetric[] = [
    metric(
      'avgTokens',
      'Average per query tokens',
      formatCompactTokens(tokens / queries.length),
    ),
    metric('total', `${heading} total`, formatDollars(total), {
      hint: `${formatTokens(queries.length)} ${queryNoun}`,
    }),
    metric(
      'avgCost',
      'Average per query',
      formatDollars(total / queries.length),
    ),
    metric(
      'medianCost',
      'Median per query',
      formatDollars(median(queries.map((query) => query.costUsd))),
    ),
    metric(
      'spikes',
      QUERIES_OVER_TOKEN_WARNING_LABEL,
      String(spikes),
      { hint: `tokens ≥ ${formatCompactTokens(spikeTokenThreshold)}` },
    ),
    metric('cacheHit', 'Cache hit', formatPercentUsed(hit), {
      hint: CACHE_HIT_HINT,
    }),
    metric(
      'costPerMillion',
      'Cost per 1M tokens',
      costPerMillion(total, tokens),
    ),
    metric('tokens', `Tokens in ${heading}`, formatCompactTokens(tokens), {
      hint: `${formatTokens(input)} in · ${formatTokens(output)} out`,
      shares: tokenShares(input, output, cacheWrite, cacheRead),
    }),
  ]

  if (priciest) {
    metrics.push(
      metric('priciest', 'Most expensive query', formatDollars(priciest.costUsd), {
        detail: modelLabel(priciest.model),
        hint: formatDateTime(priciest.timestamp),
      }),
    )
  }
  if (heaviest) {
    metrics.push(
      metric('heaviest', 'Heaviest query', formatCompactTokens(heaviest.tokens), {
        detail: modelLabel(heaviest.model),
        hint: formatDateTime(heaviest.timestamp),
      }),
    )
  }
  metrics.push(busiestDay(queries))
  return metrics
}

export function toPeriodStats(
  snapshot: UsageSnapshot,
  queries: UsageQuery[],
  options: PeriodStatsOptions,
): PeriodStatsPayload {
  const historyLimit = clampHistoryLimit(
    options.historyLimit ?? DEFAULT_HISTORY_LIMIT,
  )
  const now = options.now ?? new Date()
  const sample = newestQueries(queries, historyLimit)
  if (snapshot.status !== 'ready') {
    const empty = emptyStats(historyLimit)
    if (sample.length === 0) {
      return empty
    }
    return {
      ...empty,
      sample: sampleMetrics(sample, options.spikeTokenThreshold, historyLimit),
      byModel: groupCost(sample, (query) => modelLabel(query.model)),
      byKind: groupCost(sample, (query) => formatKind(query.kind)),
      queryCount: sample.length,
    }
  }

  const data = snapshot.data
  const sampleSum = sumCost(sample)
  return {
    glossary: [
      glossaryItem(
        'current',
        'Current',
        currentValue(data),
        currentGlossaryBody(data),
        currentBars(data),
      ),
      glossaryItem(
        'today',
        'Today',
        todayValue(data),
        todayGlossaryBody(data),
        todayBars(data),
      ),
    ],
    cycle: cycleMetrics(data, sampleSum, historyLimit, now),
    sample: sampleMetrics(sample, options.spikeTokenThreshold, historyLimit),
    byModel: groupCost(sample, (query) => modelLabel(query.model)),
    byKind: groupCost(sample, (query) => formatKind(query.kind)),
    sampleNote: sampleNoteForLimit(historyLimit),
    historyLimit,
    queryCount: sample.length,
  }
}
