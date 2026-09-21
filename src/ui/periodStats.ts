import { cycleResetLabel, formatCompactTokens, formatDateTime, formatDollars, formatKind, formatPercentPoint, formatPercentUsed, formatTokens } from '../format'
import {
  DEFAULT_BUDGET_DAY_BASIS,
  type BudgetDayBasis,
} from '../budgetDayBasis'
import { catalogFor, interpolate, EN } from '../i18n'
import { DEFAULT_LOCALE, type Locale } from '../locale'
import { isSpike } from '../spikes/threshold'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
  lastQueriesHeading,
  sampleSizeLimit,
} from '../historyLimit'
import { budgetDaysInMonth, stripModelPrefix, sumMonthUsedUsd } from '../usage/parse'
import type { UsageQuery, UsageReady, UsageSnapshot } from '../usage/types'
import { sharePercents, type PeriodShare } from './periodCards'
import { todayAttributedPercent } from './proPercentSummary'

const BREAKDOWN_LIMIT = 8

export const CURRENT_PRO_BODY = EN.stats.currentProBody
export const CURRENT_TEAM_BODY = EN.stats.currentTeamBody
export const TODAY_PRO_BODY = EN.stats.todayProBody
export const TODAY_TEAM_BODY = EN.stats.todayTeamBody
export const TODAY_TEAM_BODY_CALENDAR = EN.stats.todayTeamBodyCalendar
export const TODAY_TEAM_NO_BUDGET_BODY = EN.stats.todayTeamNoBudget
export const SAMPLE_NOTE_SUFFIX = EN.stats.sampleNoteSuffix
export const CACHE_HIT_HINT = EN.stats.cacheHitHint

export function sampleNoteForLimit(
  limit: number,
  fromDate?: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return `${lastQueriesHeading(limit, fromDate, locale)}${catalogFor(locale).stats.sampleNoteSuffix}`
}

export const SAMPLE_NOTE = sampleNoteForLimit(DEFAULT_HISTORY_LIMIT)
export const QUERIES_OVER_TOKEN_WARNING_LABEL = EN.stats.spikes

function isPercentPlan(data: UsageReady): boolean {
  return data.spendDisplay === 'percent'
}

function currentGlossaryBody(data: UsageReady, locale: Locale): string {
  const copy = catalogFor(locale).stats
  if (isPercentPlan(data)) {
    return copy.currentProBody
  }
  return copy.currentTeamBody
}

function todayGlossaryBody(
  data: UsageReady,
  basis: BudgetDayBasis,
  locale: Locale,
): string {
  const copy = catalogFor(locale).stats
  if (isPercentPlan(data)) {
    return copy.todayProBody
  }
  if (data.remainingUsd !== null && data.remainingUsd <= 0) {
    return copy.todayTeamNoBudget
  }
  return basis === 'calendarDays' ? copy.todayTeamBodyCalendar : copy.todayTeamBody
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
  historyFromDate?: string | null
  now?: Date
  budgetDayBasis?: BudgetDayBasis
  locale?: Locale
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
  locale: Locale = DEFAULT_LOCALE,
): PeriodShare[] {
  const percents = sharePercents([input, output, cacheWrite, cacheRead])
  const copy = catalogFor(locale).stats
  return [
    { key: 'input', label: copy.input, percent: percents[0] ?? 0 },
    { key: 'output', label: copy.output, percent: percents[1] ?? 0 },
    { key: 'cacheWrite', label: copy.cacheWrite, percent: percents[2] ?? 0 },
    { key: 'cacheRead', label: copy.cacheRead, percent: percents[3] ?? 0 },
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

function currentValue(data: UsageReady, locale: Locale = DEFAULT_LOCALE): string {
  if (data.isUnlimited) {
    return catalogFor(locale).stats.unlimited
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

function todayValue(
  data: UsageReady,
  monthUsedUsd: number,
  dailyPct: number | null,
): string {
  if (data.todayUsedUsd === null) {
    return '—'
  }
  if (isPercentPlan(data) && data.includedQuotas.length > 0) {
    const todayUsd = data.todayUsedUsd ?? 0
    const monthUsd = Math.max(monthUsedUsd, todayUsd)
    return data.includedQuotas
      .map((quota) => {
        const todayPct = todayAttributedPercent(
          todayUsd,
          monthUsd,
          quota.percent,
        )
        if (dailyPct === null) {
          return formatPercentPoint(todayPct)
        }
        return `${formatPercentPoint(todayPct)} / ${formatPercentPoint(dailyPct)}`
      })
      .join(' · ')
  }
  const used = formatDollars(data.todayUsedUsd)
  if (data.dailyBudgetUsd === null || data.dailyBudgetUsd <= 0) {
    return `${used} / —`
  }
  return `${used} / ${formatDollars(data.dailyBudgetUsd)}`
}

function todayTitle(data: UsageReady, locale: Locale = DEFAULT_LOCALE): string {
  const copy = catalogFor(locale).stats
  if (!isPercentPlan(data) || data.todayUsedUsd === null) {
    return copy.today
  }
  return interpolate(copy.todaySum, { amount: formatDollars(data.todayUsedUsd) })
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

function busiestDay(
  queries: UsageQuery[],
  locale: Locale = DEFAULT_LOCALE,
): PeriodMetric {
  const copy = catalogFor(locale).stats
  if (queries.length === 0) {
    return metric('busiest', copy.busiestDay, '—')
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
  return metric('busiest', copy.busiestDay, formatDollars(bestCost), {
    detail: bestDay,
    hint:
      count === 1
        ? copy.queryOne
        : interpolate(copy.queryMany, { n: formatTokens(count) }),
  })
}

function poolPercent(used: number, cap: number | null): number {
  if (cap === null || !(cap > 0)) {
    return used > 0 ? 100 : 0
  }
  return Math.round((used / cap) * 100)
}

function currentBars(
  data: UsageReady,
  locale: Locale = DEFAULT_LOCALE,
): PeriodBar[] {
  const copy = catalogFor(locale).stats
  if (data.isUnlimited) {
    return [{ label: copy.current, value: copy.unlimited, percent: 0 }]
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
      label: copy.cyclePool,
      value: currentValue(data, locale),
      percent: poolPercent(data.usedUsd, data.limitUsd),
    },
  ]
}

function todayBars(
  data: UsageReady,
  monthUsedUsd: number,
  dailyPct: number | null,
  locale: Locale = DEFAULT_LOCALE,
): PeriodBar[] {
  if (data.todayUsedUsd === null) {
    return []
  }
  if (isPercentPlan(data) && data.includedQuotas.length > 0 && dailyPct !== null) {
    const todayUsd = data.todayUsedUsd ?? 0
    const monthUsd = Math.max(monthUsedUsd, todayUsd)
    return data.includedQuotas.map((quota) => {
      const todayPct = todayAttributedPercent(
        todayUsd,
        monthUsd,
        quota.percent,
      )
      return {
        label: quota.name,
        value: `${formatPercentPoint(todayPct)} / ${formatPercentPoint(dailyPct)}`,
        percent: poolPercent(todayPct, dailyPct),
      }
    })
  }
  if (data.dailyBudgetUsd === null || data.dailyBudgetUsd <= 0) {
    return []
  }
  return [
    {
      label: catalogFor(locale).stats.today,
      value: todayValue(data, monthUsedUsd, dailyPct),
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

function emptyStats(
  historyLimit: number,
  fromDate?: string | null,
  locale: Locale = DEFAULT_LOCALE,
): PeriodStatsPayload {
  const copy = catalogFor(locale).stats
  return {
    glossary: [
      glossaryItem('current', copy.current, '—', copy.currentTeamBody, []),
      glossaryItem('today', copy.today, '—', copy.todayTeamBody, []),
    ],
    cycle: [],
    sample: [],
    byModel: [],
    byKind: [],
    sampleNote: sampleNoteForLimit(historyLimit, fromDate, locale),
    historyLimit,
    queryCount: 0,
  }
}

function cycleMetrics(
  data: UsageReady,
  sampleSum: number,
  historyLimit: number,
  now: Date,
  basis: BudgetDayBasis,
  fromDate?: string | null,
  locale: Locale = DEFAULT_LOCALE,
): PeriodMetric[] {
  const copy = catalogFor(locale).stats
  const start = isoDay(data.billingCycleStart)
  const end = isoDay(data.billingCycleEnd)
  const cycle =
    start && end ? `${start} → ${end}` : dash(end ?? start)
  const reset = cycleResetLabel(data.billingCycleEnd, now, locale)
  const elapsed = cycleElapsedPercent(
    data.billingCycleStart,
    data.billingCycleEnd,
    now,
  )

  const metrics: PeriodMetric[] = [
    metric('plan', copy.plan, formatPlan(data.plan)),
    metric('cycle', copy.billingCycleLabel, cycle, {
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
  const daysLabel =
    basis === 'calendarDays' ? copy.calendarDaysLeft : copy.workingDaysLeft
  const heading = lastQueriesHeading(historyLimit, fromDate, locale)

  metrics.push(
    metric('remaining', copy.remaining, remaining),
    metric('workingDays', daysLabel, days),
    metric('dailyBudget', copy.dailyBudget, daily),
    metric(
      'sampleVsCurrent',
      interpolate(copy.sampleVsCurrent, { heading }),
      `${formatDollars(sampleSum)} vs ${formatDollars(data.usedUsd)}`,
    ),
  )
  return metrics
}

function sampleMetrics(
  queries: UsageQuery[],
  spikeTokenThreshold: number,
  historyLimit: number,
  fromDate?: string | null,
  locale: Locale = DEFAULT_LOCALE,
): PeriodMetric[] {
  const copy = catalogFor(locale).stats
  const heading = lastQueriesHeading(historyLimit, fromDate, locale)
  if (queries.length === 0) {
    return [
      metric('avgTokens', copy.avgTokens, '0'),
      metric('total', interpolate(copy.sampleTotal, { heading }), formatDollars(0)),
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
  const queryNoun =
    queries.length === 1 ? copy.queryNounOne : copy.queryNounMany

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
      copy.avgTokens,
      formatCompactTokens(tokens / queries.length),
    ),
    metric('total', interpolate(copy.sampleTotal, { heading }), formatDollars(total), {
      hint: `${formatTokens(queries.length)} ${queryNoun}`,
    }),
    metric(
      'avgCost',
      copy.avgCost,
      formatDollars(total / queries.length),
    ),
    metric(
      'medianCost',
      copy.medianCost,
      formatDollars(median(queries.map((query) => query.costUsd))),
    ),
    metric(
      'spikes',
      copy.spikes,
      String(spikes),
      { hint: interpolate(copy.spikesHint, { n: formatCompactTokens(spikeTokenThreshold) }) },
    ),
    metric('cacheHit', copy.cacheHit, formatPercentUsed(hit), {
      hint: copy.cacheHitHint,
    }),
    metric(
      'costPerMillion',
      copy.costPerMillion,
      costPerMillion(total, tokens),
    ),
    metric('tokens', interpolate(copy.tokensIn, { heading }), formatCompactTokens(tokens), {
      hint: interpolate(copy.tokensHint, {
        input: formatTokens(input),
        output: formatTokens(output),
      }),
      shares: tokenShares(input, output, cacheWrite, cacheRead, locale),
    }),
  ]

  if (priciest) {
    metrics.push(
      metric('priciest', copy.mostExpensive, formatDollars(priciest.costUsd), {
        detail: modelLabel(priciest.model),
        hint: formatDateTime(priciest.timestamp),
      }),
    )
  }
  if (heaviest) {
    metrics.push(
      metric('heaviest', copy.heaviest, formatCompactTokens(heaviest.tokens), {
        detail: modelLabel(heaviest.model),
        hint: formatDateTime(heaviest.timestamp),
      }),
    )
  }
  metrics.push(busiestDay(queries, locale))
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
  const historyFromDate = options.historyFromDate ?? null
  const now = options.now ?? new Date()
  const basis = options.budgetDayBasis ?? DEFAULT_BUDGET_DAY_BASIS
  const locale = options.locale ?? DEFAULT_LOCALE
  const copy = catalogFor(locale).stats
  const sample = newestQueries(
    queries,
    sampleSizeLimit(historyLimit, historyFromDate),
  )
  if (snapshot.status !== 'ready') {
    const empty = emptyStats(historyLimit, historyFromDate, locale)
    if (sample.length === 0) {
      return empty
    }
    return {
      ...empty,
      sample: sampleMetrics(
        sample,
        options.spikeTokenThreshold,
        historyLimit,
        historyFromDate,
        locale,
      ),
      byModel: groupCost(sample, (query) => modelLabel(query.model)),
      byKind: groupCost(sample, (query) => formatKind(query.kind)),
      queryCount: sample.length,
    }
  }

  const data = snapshot.data
  const sampleSum = sumCost(sample)
  const monthUsedUsd = sumMonthUsedUsd(sample, now)
  const dayTotal = budgetDaysInMonth(now, basis)
  const dailyPct =
    isPercentPlan(data) && dayTotal > 0 ? 100 / dayTotal : null
  return {
    glossary: [
      glossaryItem(
        'current',
        copy.current,
        currentValue(data, locale),
        currentGlossaryBody(data, locale),
        currentBars(data, locale),
      ),
      glossaryItem(
        'today',
        todayTitle(data, locale),
        todayValue(data, monthUsedUsd, dailyPct),
        todayGlossaryBody(data, basis, locale),
        todayBars(data, monthUsedUsd, dailyPct, locale),
      ),
    ],
    cycle: cycleMetrics(
      data,
      sampleSum,
      historyLimit,
      now,
      basis,
      historyFromDate,
      locale,
    ),
    sample: sampleMetrics(
      sample,
      options.spikeTokenThreshold,
      historyLimit,
      historyFromDate,
      locale,
    ),
    byModel: groupCost(sample, (query) => modelLabel(query.model)),
    byKind: groupCost(sample, (query) => formatKind(query.kind)),
    sampleNote: sampleNoteForLimit(historyLimit, historyFromDate, locale),
    historyLimit,
    queryCount: sample.length,
  }
}

