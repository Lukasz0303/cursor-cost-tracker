export type UsageQuery = {
  timestamp: number
  model: string | null
  kind: string | null
  costUsd: number
  tokens: number
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  /** Present only when the usage event carried a conversation id. */
  conversationId?: string
}

export type SpendDisplay = 'usd' | 'percent'

export type IncludedQuota = {
  name: string
  used: number
  limit: number
  percent: number
}

/** Pro included pool, or the Team / Business / Enterprise dollar pool. */
export type QuotaBoard = {
  autoPercent: number | null
  apiPercent: number | null
  totalPercent: number | null
  used: number | null
  limit: number | null
  remaining: number | null
  onDemandEnabled: boolean | null
  onDemandCapUsd: number | null
  onDemandUsedUsd: number | null
  /** Dollar cycle pool. Omitted when `used` / `limit` are Pro request units. */
  amount?: 'usd'
}

export type UsageReady = {
  email: string | null
  plan: string | null
  /** Team / company: dollar pool. Personal Pro: included-quota percents. */
  spendDisplay: SpendDisplay
  includedQuotas: IncludedQuota[]
  /** Present on Pro percent plans. Omitted by older snapshots. */
  quotaBoard?: QuotaBoard | null
  usedUsd: number
  limitUsd: number | null
  remainingUsd: number | null
  todayUsedUsd: number | null
  dailyBudgetUsd: number | null
  workingDaysLeft: number | null
  billingCycleStart: string | null
  billingCycleEnd: string | null
  isUnlimited: boolean
  /** Included plan line for tooltips, e.g. `512 / 500` or Pro percents. */
  includedLine: string | null
  /** On-demand spend line for tooltips, e.g. `3.79 $ / 250.00 $`. */
  onDemandLine: string | null
  recentQueries: UsageQuery[]
}

export type UsageSnapshot =
  | { status: 'loading' }
  | { status: 'ready'; data: UsageReady }
  | { status: 'error'; message: string }

export type UsagePoolSource =
  | 'individualOnDemand'
  | 'plan'
  | 'teamOnDemand'
  | 'overall'

export type UsagePool = {
  usedCents: number
  limitCents: number | null
  remainingCents: number | null
  source: UsagePoolSource
}
