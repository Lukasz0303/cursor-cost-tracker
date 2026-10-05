import type { IncludedQuota, UsagePool, UsageQuery, UsageReady } from './types'
import { budgetDaysLeftInMonth } from '../budgetDays'
import {
  DEFAULT_BUDGET_DAY_BASIS,
  type BudgetDayBasis,
} from '../budgetDayBasis'
import { formatDollars, formatPercentUsed } from '../format'
import { localDayKey, localMonthKey } from '../time/localDay'
import {
  asFiniteNumber,
  centsToUsd,
  isRecord,
  readEnabled,
} from './parseShared'
import {
  isUnlimited,
  pickUsagePool,
  readIncludedQuotas,
  spendDisplayFor,
} from './pools'
import { mapEventsPayload } from './events'

export function applyBudgetDayBasis(
  data: UsageReady,
  basis: BudgetDayBasis,
  now: Date = new Date(),
): UsageReady {
  if (data.isUnlimited) {
    return {
      ...data,
      dailyBudgetUsd: null,
      workingDaysLeft: null,
    }
  }
  const days = budgetDaysLeftInMonth(now, basis)
  return {
    ...data,
    workingDaysLeft: days,
    dailyBudgetUsd: dailyBudgetUsd(data.remainingUsd, days),
  }
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
  budgetDayBasis?: BudgetDayBasis
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
  const days = budgetDaysLeftInMonth(
    input.now,
    input.budgetDayBasis ?? DEFAULT_BUDGET_DAY_BASIS,
  )
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
