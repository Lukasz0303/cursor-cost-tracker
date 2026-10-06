import type { IncludedQuota, SpendDisplay, UsagePool } from './types'
import {
  asFiniteNumber,
  isRecord,
  readEnabled,
  readMoneyPool,
  poolLimitCents,
  poolUsedCents,
} from './parseShared'

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
