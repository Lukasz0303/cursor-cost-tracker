import type { IncludedQuota, SpendDisplay, UsagePool, UsageQuery, UsageReady } from './types'
import { formatDollars, formatPercentUsed } from '../format'
import { DEFAULT_HISTORY_LIMIT } from '../historyLimit'

const MODEL_PREFIX = /^cursor-/
const DOLLAR_STRING = /[^0-9.+-]/g

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null
    }
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

export function centsToUsd(cents: number): number {
  if (!Number.isFinite(cents)) {
    return 0
  }
  return cents / 100
}

function readEnabled(raw: Record<string, unknown>): boolean {
  return raw.enabled !== false
}

function poolUsedCents(raw: Record<string, unknown>): number | null {
  return asFiniteNumber(raw.usedCents) ?? asFiniteNumber(raw.used)
}

function poolLimitCents(raw: Record<string, unknown>): number | null {
  return asFiniteNumber(raw.limitCents) ?? asFiniteNumber(raw.limit)
}

function readMoneyPool(
  raw: unknown,
  source: UsagePool['source'],
): UsagePool | null {
  if (!isRecord(raw) || !readEnabled(raw)) {
    return null
  }

  const used = poolUsedCents(raw)
  const limit = poolLimitCents(raw)
  if (used === null && limit === null) {
    return null
  }

  const remaining =
    asFiniteNumber(raw.remainingCents) ?? asFiniteNumber(raw.remaining)

  return {
    usedCents: used ?? 0,
    limitCents: limit,
    remainingCents: remaining,
    source,
  }
}

/** Same cap as Stack Manager: org pools like $24,800 are 2.48M cents. */
export const PERSONAL_MONTHLY_POOL_MAX_CENTS = 1_000_000

/**
 * Personal monthly dollar pool only. Enterprise `teamUsage.onDemand` /
 * `pooled` often has a five-figure org cap; Stack Manager drops any pool
 * whose limit is above $10,000 (1M cents) so Current stays `used / $250`.
 */
export function isPersonalMonthlyPool(raw: unknown): boolean {
  if (!isRecord(raw) || !readEnabled(raw)) {
    return false
  }
  const used = poolUsedCents(raw)
  const limit = poolLimitCents(raw)
  if (used === null && limit === null) {
    return false
  }
  if (limit === null) {
    return true
  }
  return limit <= PERSONAL_MONTHLY_POOL_MAX_CENTS
}

/**
 * Cursor returns request-style plan counters and cents-style on-demand in the
 * same shape (`used` / `limit`). Candidate order matches Stack Manager:
 * individual onDemand → plan → team onDemand → overall. Never `teamUsage.pooled`.
 */
export function pickUsagePool(summary: unknown): UsagePool | null {
  if (!isRecord(summary)) {
    return null
  }

  const individual = isRecord(summary.individualUsage)
    ? summary.individualUsage
    : null
  const team = isRecord(summary.teamUsage) ? summary.teamUsage : null

  const candidates: Array<{ raw: unknown; source: UsagePool['source'] }> = [
    { raw: individual?.onDemand, source: 'individualOnDemand' },
    { raw: individual?.plan, source: 'plan' },
    { raw: team?.onDemand, source: 'teamOnDemand' },
    { raw: individual?.overall, source: 'overall' },
    { raw: summary.overall, source: 'overall' },
  ]

  for (const candidate of candidates) {
    if (!isPersonalMonthlyPool(candidate.raw)) {
      continue
    }
    const pool = readMoneyPool(candidate.raw, candidate.source)
    if (pool) {
      return pool
    }
  }

  return null
}

const TEAM_PLAN_NAMES = new Set(['business', 'team', 'enterprise', 'company'])
const OTHER_MODEL_KEYS = [
  'namedModels',
  'otherModels',
  'api',
  'other',
  'includedApi',
] as const

export function isTeamSpendPlan(summary: unknown, plan: string | null): boolean {
  if (isRecord(summary) && typeof summary.limitType === 'string') {
    const limitType = summary.limitType.toLowerCase()
    if (limitType === 'team' || limitType === 'organization' || limitType === 'org') {
      return true
    }
  }

  if (!plan) {
    return false
  }

  return TEAM_PLAN_NAMES.has(plan.trim().toLowerCase())
}

function roundPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.round(value))
}

function quotaFromPercent(name: string, percent: number | null): IncludedQuota | null {
  if (percent === null) {
    return null
  }
  const rounded = roundPercent(percent)
  return { name, used: percent, limit: 100, percent: rounded }
}

function parsePercentFromMessage(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null
  }
  const match = value.match(/(\d+(?:\.\d+)?)\s*%/)
  if (!match || match[1] === undefined) {
    return null
  }
  return asFiniteNumber(match[1])
}

function readIncludedQuota(raw: unknown, name: string): IncludedQuota | null {
  if (!isRecord(raw) || !readEnabled(raw)) {
    return null
  }

  const used = asFiniteNumber(raw.used) ?? asFiniteNumber(raw.usedCents)
  const limit = asFiniteNumber(raw.limit) ?? asFiniteNumber(raw.limitCents)
  const explicitPercent =
    asFiniteNumber(raw.percentUsed) ??
    asFiniteNumber(raw.usedPercent) ??
    asFiniteNumber(raw.percentage) ??
    asFiniteNumber(raw.percent)

  if (explicitPercent !== null && (used === null || limit === null || !(limit > 0))) {
    return {
      name,
      used: used ?? 0,
      limit: limit ?? 100,
      percent: roundPercent(explicitPercent),
    }
  }

  if (used === null || limit === null || !(limit > 0)) {
    return null
  }

  const percent =
    explicitPercent !== null
      ? roundPercent(explicitPercent)
      : roundPercent((used / limit) * 100)
  return { name, used, limit, percent }
}

export function readIncludedQuotas(summary: unknown): IncludedQuota[] {
  if (!isRecord(summary)) {
    return []
  }

  const individual = isRecord(summary.individualUsage)
    ? summary.individualUsage
    : null
  const plan = isRecord(individual?.plan) ? individual.plan : null

  // Dashboard "Cursor Models" / "Other Models" bars. Do not use plan.used/limit —
  // that request cap is often 100% while autoPercentUsed is still ~8%.
  const autoPercent =
    asFiniteNumber(plan?.autoPercentUsed) ??
    parsePercentFromMessage(summary.autoModelSelectedDisplayMessage)
  const apiPercent =
    asFiniteNumber(plan?.apiPercentUsed) ??
    parsePercentFromMessage(summary.namedModelSelectedDisplayMessage)

  if (autoPercent !== null || apiPercent !== null) {
    const fromDashboard: IncludedQuota[] = []
    const cursorModels = quotaFromPercent('Cursor Models', autoPercent)
    const otherModels = quotaFromPercent('Other Models', apiPercent)
    if (cursorModels) {
      fromDashboard.push(cursorModels)
    }
    if (otherModels) {
      fromDashboard.push(otherModels)
    }
    return fromDashboard
  }

  const quotas: IncludedQuota[] = []

  const planQuota = readIncludedQuota(plan ?? summary.planUsage, 'Cursor Models')
  if (planQuota) {
    quotas.push(planQuota)
  }

  if (individual) {
    for (const key of OTHER_MODEL_KEYS) {
      const quota = readIncludedQuota(individual[key], 'Other Models')
      if (quota) {
        quotas.push(quota)
        break
      }
    }
  }

  if (quotas.every((quota) => quota.name !== 'Other Models')) {
    const other =
      readIncludedQuota(summary.namedModelUsage, 'Other Models') ??
      readIncludedQuota(summary.otherModels, 'Other Models')
    if (other) {
      quotas.push(other)
    }
  }

  return quotas
}

export function spendDisplayFor(summary: unknown, plan: string | null): SpendDisplay {
  if (isTeamSpendPlan(summary, plan)) {
    return 'usd'
  }
  if (readIncludedQuotas(summary).length > 0) {
    return 'percent'
  }
  return 'usd'
}

export function isUnlimited(pool: UsagePool | null, summary?: unknown): boolean {
  if (isRecord(summary) && summary.isUnlimited === true) {
    return true
  }
  if (pool === null) {
    return false
  }
  return pool.limitCents === null
}

function parseDollarString(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  const numeric = Number(trimmed.replace(DOLLAR_STRING, ''))
  if (!Number.isFinite(numeric)) {
    return null
  }
  return numeric
}

function tokenField(
  usage: Record<string, unknown>,
  ...keys: string[]
): number {
  for (const key of keys) {
    const n = asFiniteNumber(usage[key])
    if (n !== null) {
      return n
    }
  }
  return 0
}

function readTimestamp(raw: Record<string, unknown>): number | null {
  const value = raw.timestamp ?? raw.time ?? raw.createdAt
  const numeric = asFiniteNumber(value)
  if (numeric !== null) {
    return numeric
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    if (Number.isFinite(ms)) {
      return ms
    }
  }
  return null
}

function eventCostUsd(
  raw: Record<string, unknown>,
  usage: Record<string, unknown> | null,
): number {
  const charged = asFiniteNumber(raw.chargedCents)
  if (charged !== null) {
    return centsToUsd(charged)
  }
  const totalCents = usage ? asFiniteNumber(usage.totalCents) : null
  if (totalCents !== null) {
    return centsToUsd(totalCents)
  }
  const fromString = parseDollarString(raw.usageBasedCosts)
  if (fromString !== null) {
    return fromString
  }
  return 0
}

export function mapEventToQuery(raw: unknown): UsageQuery | null {
  if (!isRecord(raw)) {
    return null
  }

  const timestamp = readTimestamp(raw)
  if (timestamp === null) {
    return null
  }

  const usage = isRecord(raw.tokenUsage) ? raw.tokenUsage : null
  const inputTokens = usage
    ? tokenField(usage, 'inputTokens', 'input_tokens')
    : 0
  const outputTokens = usage
    ? tokenField(usage, 'outputTokens', 'output_tokens')
    : 0
  const cacheRead = usage
    ? tokenField(usage, 'cacheReadTokens', 'cache_read_tokens')
    : 0
  const cacheWrite = usage
    ? tokenField(usage, 'cacheWriteTokens', 'cache_write_tokens')
    : 0

  const model =
    typeof raw.model === 'string' && raw.model !== '' ? raw.model : null
  const kind = typeof raw.kind === 'string' && raw.kind !== '' ? raw.kind : null

  return {
    timestamp,
    model,
    kind,
    costUsd: eventCostUsd(raw, usage),
    tokens: inputTokens + outputTokens + cacheRead + cacheWrite,
    inputTokens,
    outputTokens,
    cacheWriteTokens: cacheWrite,
    cacheReadTokens: cacheRead,
  }
}

export function mapEventsPayload(
  raw: unknown,
  limit: number = DEFAULT_HISTORY_LIMIT,
): UsageQuery[] {
  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (isRecord(raw) && Array.isArray(raw.usageEventsDisplay)) {
    list = raw.usageEventsDisplay
  }

  const queries: UsageQuery[] = []
  for (const item of list) {
    const query = mapEventToQuery(item)
    if (query !== null) {
      queries.push(query)
    }
  }
  queries.sort((a, b) => b.timestamp - a.timestamp)
  return queries.slice(0, limit)
}

function isWeekend(year: number, month: number, day: number): boolean {
  const weekday = new Date(year, month, day).getDay()
  return weekday === 0 || weekday === 6
}

export function workingDaysLeftInMonth(from: Date): number {
  const year = from.getFullYear()
  const month = from.getMonth()
  const lastDate = new Date(year, month + 1, 0).getDate()
  const start = from.getDate()
  let count = 0
  for (let day = start; day <= lastDate; day++) {
    if (isWeekend(year, month, day)) {
      continue
    }
    count += 1
  }
  return Math.max(1, count)
}

/** Mon–Fri from the 1st through today (local TZ). Weekends are 0. */
export function workingDaysElapsedInMonth(from: Date): number {
  const year = from.getFullYear()
  const month = from.getMonth()
  const today = from.getDate()
  let count = 0
  for (let day = 1; day <= today; day++) {
    if (isWeekend(year, month, day)) {
      continue
    }
    count += 1
  }
  return count
}

export function dailyBudgetUsd(
  remainingUsd: number | null,
  days: number,
): number | null {
  if (remainingUsd === null || !Number.isFinite(remainingUsd) || days <= 0) {
    return null
  }
  return remainingUsd / days
}

function localDayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function localMonthKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth()}`
}

export function sumTodayUsedUsd(events: UsageQuery[], now: Date): number {
  const today = localDayKey(now.getTime())
  let sum = 0
  for (const event of events) {
    if (localDayKey(event.timestamp) === today) {
      sum += event.costUsd
    }
  }
  return sum
}

export function sumMonthUsedUsd(events: UsageQuery[], now: Date): number {
  const month = localMonthKey(now.getTime())
  let sum = 0
  for (const event of events) {
    if (localMonthKey(event.timestamp) === month) {
      sum += event.costUsd
    }
  }
  return sum
}

export function stripModelPrefix(model: string | null): string | null {
  if (model === null) {
    return null
  }
  return model.replace(MODEL_PREFIX, '')
}

export function membershipPlan(summary: unknown): string | null {
  if (!isRecord(summary)) {
    return null
  }
  if (typeof summary.membershipType === 'string' && summary.membershipType !== '') {
    return summary.membershipType
  }
  if (typeof summary.plan === 'string' && summary.plan !== '') {
    return summary.plan
  }
  return null
}

function readIsoField(summary: unknown, key: string): string | null {
  if (!isRecord(summary)) {
    return null
  }
  const value = summary[key]
  if (typeof value === 'string' && value !== '') {
    return value
  }
  return null
}

export function billingCycleStart(summary: unknown): string | null {
  return readIsoField(summary, 'billingCycleStart')
}

export function billingCycleEnd(summary: unknown): string | null {
  return readIsoField(summary, 'billingCycleEnd')
}

export type BillingPoolLines = {
  includedLine: string | null
  onDemandLine: string | null
}

function formatRequestPool(used: number, limit: number | null): string {
  const usedText = String(Math.round(used))
  if (limit === null) {
    return usedText
  }
  return `${usedText} / ${Math.round(limit)}`
}

function formatDollarPool(pool: UsagePool): string {
  const used = formatDollars(centsToUsd(pool.usedCents))
  if (pool.limitCents === null) {
    return used
  }
  return `${used} / ${formatDollars(centsToUsd(pool.limitCents))}`
}

function includedLineFromQuotas(quotas: IncludedQuota[]): string | null {
  if (quotas.length === 0) {
    return null
  }
  return quotas
    .map((quota) => `${quota.name} ${formatPercentUsed(quota.percent)}`)
    .join(' · ')
}

/** Included requests / Pro percents and on-demand dollars from usage-summary. */
export function readBillingPoolLines(
  summary: unknown,
  plan: string | null,
): BillingPoolLines {
  if (!isRecord(summary)) {
    return { includedLine: null, onDemandLine: null }
  }

  const quotas = readIncludedQuotas(summary)
  if (spendDisplayFor(summary, plan) === 'percent' && quotas.length > 0) {
    const onDemand = readOnDemandLine(summary)
    return {
      includedLine: includedLineFromQuotas(quotas),
      onDemandLine: onDemand,
    }
  }

  const individual = isRecord(summary.individualUsage)
    ? summary.individualUsage
    : null
  let includedLine: string | null = null
  const planPool = individual && isRecord(individual.plan) ? individual.plan : null
  if (planPool && readEnabled(planPool)) {
    const used =
      asFiniteNumber(planPool.used) ?? asFiniteNumber(planPool.usedCents)
    const limit =
      asFiniteNumber(planPool.limit) ?? asFiniteNumber(planPool.limitCents)
    if (used !== null && asFiniteNumber(planPool.usedCents) === null) {
      includedLine = formatRequestPool(used, limit)
    }
  }

  return {
    includedLine,
    onDemandLine: readOnDemandLine(summary),
  }
}

function readOnDemandLine(summary: unknown): string | null {
  const pool = pickUsagePool(summary)
  if (!pool) {
    return null
  }
  return formatDollarPool(pool)
}

export type BuildUsageReadyInput = {
  summary: unknown
  events?: unknown
  queries?: UsageQuery[]
  now: Date
  email?: string | null
  eventsAvailable?: boolean
}

export function buildUsageReady(input: BuildUsageReadyInput): UsageReady {
  const pool = pickUsagePool(input.summary)
  const unlimited = isUnlimited(pool, input.summary)
  const usedUsd = pool ? centsToUsd(pool.usedCents) : 0
  const limitUsd =
    pool && pool.limitCents !== null ? centsToUsd(pool.limitCents) : null
  const remainingUsd =
    pool && pool.remainingCents !== null
      ? centsToUsd(pool.remainingCents)
      : limitUsd !== null
        ? limitUsd - usedUsd
        : null

  const eventsAvailable = input.eventsAvailable !== false
  const recentQueries = !eventsAvailable
    ? []
    : (input.queries ?? mapEventsPayload(input.events))
  const days = workingDaysLeftInMonth(input.now)
  const plan = membershipPlan(input.summary)
  const spendDisplay = spendDisplayFor(input.summary, plan)
  // Team / Business / Enterprise pace on dollars. Drop included-quota percents
  // even if the summary still carries Pro-style autoPercentUsed fields.
  const includedQuotas =
    spendDisplay === 'percent' ? readIncludedQuotas(input.summary) : []
  const pools = readBillingPoolLines(input.summary, plan)

  return {
    email: input.email ?? null,
    plan,
    spendDisplay,
    includedQuotas,
    usedUsd,
    limitUsd,
    remainingUsd,
    todayUsedUsd: eventsAvailable
      ? sumTodayUsedUsd(recentQueries, input.now)
      : null,
    dailyBudgetUsd: unlimited
      ? null
      : dailyBudgetUsd(remainingUsd, days),
    workingDaysLeft: unlimited ? null : days,
    billingCycleStart: billingCycleStart(input.summary),
    billingCycleEnd: billingCycleEnd(input.summary),
    isUnlimited: unlimited,
    includedLine: pools.includedLine,
    onDemandLine: pools.onDemandLine,
    recentQueries,
  }
}
