import type { Database, SqlValue } from 'sql.js'
import { listPriceFor } from './pricing/listPrices'
import { formatDateTime } from '../format'
import { startOfLocalDayMs } from '../time'
import type { RequestStatus } from './domain'
import type { RequestStore } from './store/types'

export type CodexAggregateFilter = {
  from: string | null
  to: string | null
  accountScopeKey: string | null
  model: string | null
  status: RequestStatus | null
}

export type CodexStatsView = {
  tokenMix: {
    input: number
    cachedInput: number
    output: number
    reasoning: number
  }
  counts: {
    modelRequests: number
    turns: number
    conversations: number
  }
  pricedShare: {
    priced: number
    denom: number
  }
  estimatedApiCostUsd: number | null
  apiEquivalentCostUsd: number | null
  /** Null means omit the reported-cost card. */
  reportedCostUsd: number | null
  /** Paired non-null C/I rows only. Null when no paired rows. */
  cacheHit: number | null
  /** Request id for Optimize (newest spike, else newest row). */
  analyzeRequestId: string | null
  hints: string[]
  limits: CodexLimitsView | null
  missingModels: string[]
  includedInPlan: boolean
  conversations: CodexConversationSummary[]
  /** Distinct request statuses in the filter. One value means the status menu is empty. */
  statusValues: string[]
  /** Same card shapes as the Cursor statistics controls, filled from the API estimate. */
  mirror: CodexMirror
}

export type CodexMirrorShare = {
  key: 'input' | 'output' | 'cacheWrite' | 'cacheRead'
  percent: number
}

export type CodexMirrorPace = {
  unit: 'day' | 'hour'
  /** Fractional days or hours from the window start until now. */
  elapsed: number
  /** Fractional days or hours from now until reset. */
  left: number
  used: number
  remaining: number
  /**
   * Used percent divided by the age of the window at the sample. Null when
   * that age is under one day (30 minutes for a shorter window) or the sample
   * is not fresh. Silence after the sample does not dilute this rate.
   */
  dailyPace: number | null
  dailyBudget: number
  toLast: number
  /** Used plus pace times the time left. Null without a pace. Not capped at 100. */
  forecast: number | null
  over: boolean
  kind: CodexLimitKind
  resetsLabel: string
  /** First instant the pace reaches 100, only when that instant is before reset. */
  runsOutLabel: string | null
  stale: boolean
  fresh: boolean
  /** (now − window start) / window length, in percent. */
  windowElapsedPercent: number
  asOfMs: number
  windowStartMs: number
  resetsAtMs: number
  asOfLabel: string
}

export type CodexMirror = {
  requests: number
  totalUsd: number | null
  todayUsd: number
  avgUsd: number | null
  medianUsd: number | null
  spikes: number
  spikeThreshold: number
  cacheHit: number | null
  costPerMillion: number | null
  avgTokens: number | null
  totalTokens: number
  inputTokens: number
  cachedTokens: number
  outputTokens: number
  shares: CodexMirrorShare[]
  priciest: { usd: number; model: string; when: string } | null
  heaviest: { tokens: number; model: string; when: string } | null
  busiest: { day: string; usd: number; requests: number } | null
  byModel: { label: string; usd: number; requests: number }[]
  byKind: { label: string; usd: number }[]
  rates: {
    model: string
    inputRate: string
    cachedRate: string
    outputRate: string
    requests: number
    usd: number
  }[]
  pace: CodexMirrorPace | null
  plan: string | null
  includedInPlan: boolean
}

export type CodexLimitKind = '5h' | '7d' | '30d' | 'custom'

export type CodexLimitWindowView = {
  kind: CodexLimitKind
  windowMinutes: number | null
  usedPercent: number | null
  remainingPercent: number | null
  resetsAt: number | null
  resetsLabel: string
  observedLabel: string
  observedAtMs: number | null
  /** Reset is still ahead and the sample is new enough to draw as current. */
  fresh: boolean
  stale: boolean
}

export type CodexLimitsView = {
  planType: string | null
  limitId: string | null
  observedAt: string
  observedLabel: string
  primary: CodexLimitWindowView | null
  secondary: CodexLimitWindowView | null
  creditsHas: boolean | null
  creditsUnlimited: boolean | null
  creditsBalance: string | null
  reachedType: string | null
  includedInPlan: boolean
}

export type CodexConversationSummary = {
  title: string
  model: string
  observedLabel: string
  requestCount: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  estimateUsd: number | null
  missingModel: string | null
}

type BoundFilter = {
  sql: string
  params: SqlValue[]
}

function getDb(store: RequestStore): Database {
  const db = (store as unknown as { db: Database }).db
  if (db === undefined) {
    throw new Error('RequestStore database is not available')
  }
  return db
}

function queryAll(
  db: Database,
  sql: string,
  params: SqlValue[] = [],
): Record<string, SqlValue>[] {
  const stmt = db.prepare(sql)
  const rows: Record<string, SqlValue>[] = []
  try {
    stmt.bind(params)
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
  } finally {
    stmt.free()
  }
  return rows
}

function queryOne(
  db: Database,
  sql: string,
  params: SqlValue[] = [],
): Record<string, SqlValue> | null {
  return queryAll(db, sql, params)[0] ?? null
}

function asNumber(value: SqlValue | undefined): number | null {
  return typeof value === 'number' ? value : null
}

function asString(value: SqlValue | undefined): string | null {
  return typeof value === 'string' ? value : null
}

/** Same spend-attributed filter as `codex.query`, without paging. */
export function buildCodexAggregateFilter(
  filter: CodexAggregateFilter,
): BoundFilter {
  const clauses: string[] = [
    `EXISTS (
      SELECT 1 FROM request_observations o
      WHERE o.request_id = r.id AND o.attributes_spend = 1
    )`,
  ]
  const params: SqlValue[] = []

  if (filter.from !== null) {
    const start = startOfLocalDayMs(filter.from)
    if (start !== null) {
      clauses.push('r.observed_at >= ?')
      params.push(new Date(start).toISOString())
    }
  }
  if (filter.to !== null) {
    const end = startOfLocalDayMs(filter.to)
    if (end !== null) {
      clauses.push('r.observed_at < ?')
      params.push(new Date(end).toISOString())
    }
  }
  if (filter.accountScopeKey !== null) {
    clauses.push('r.account_scope_key = ?')
    params.push(filter.accountScopeKey)
  }
  if (filter.model !== null) {
    if (filter.model === 'Unknown') {
      clauses.push("(r.model IS NULL OR r.model = '')")
    } else {
      clauses.push('r.model = ?')
      params.push(filter.model)
    }
  }
  if (filter.status !== null) {
    clauses.push('r.status = ?')
    params.push(filter.status)
  }

  return { sql: clauses.join(' AND '), params }
}

const CACHE_LOW_THRESHOLD = 0.2
const MANY_REQUESTS_PER_TURN = 4

function moneySum(
  db: Database,
  bound: BoundFilter,
  column: 'estimated_api_cost_usd' | 'reported_cost_usd',
): { sum: number | null; priced: number; denom: number } {
  const row = queryOne(
    db,
    `SELECT
       COUNT(*) AS denom,
       SUM(CASE WHEN r.${column} IS NOT NULL AND r.${column} != '' THEN 1 ELSE 0 END) AS priced,
       SUM(CASE WHEN r.${column} IS NOT NULL AND r.${column} != '' THEN CAST(r.${column} AS REAL) ELSE 0 END) AS cost_sum
     FROM requests r
     WHERE ${bound.sql}`,
    bound.params,
  )
  const priced = asNumber(row?.priced) ?? 0
  const denom = asNumber(row?.denom) ?? 0
  const costSum = asNumber(row?.cost_sum)
  return {
    sum: priced > 0 ? costSum : null,
    priced,
    denom,
  }
}

function limitKind(minutes: number | null): CodexLimitKind {
  if (minutes === 300) {
    return '5h'
  }
  if (minutes === 10080) {
    return '7d'
  }
  if (minutes === 43200) {
    return '30d'
  }
  return 'custom'
}

function bitToBool(value: SqlValue | undefined): boolean | null {
  if (value === 1) {
    return true
  }
  if (value === 0) {
    return false
  }
  return null
}

function labelAt(isoOrNull: string): string {
  const ms = Date.parse(isoOrNull)
  return Number.isFinite(ms) ? formatDateTime(ms) : isoOrNull
}

function windowFrom(
  used: number | null,
  minutes: number | null,
  resetsAt: number | null,
  observedAt: string,
  nowMs: number,
): CodexLimitWindowView | null {
  if (used === null && minutes === null && resetsAt === null) {
    return null
  }
  const observedMs = Date.parse(observedAt)
  const observedOk = Number.isFinite(observedMs)
  const shortWindow = minutes !== null && minutes < 24 * 60
  const sameDay =
    observedOk &&
    localDayKey(new Date(observedMs).toISOString()) ===
      localDayKey(new Date(nowMs).toISOString())
  const sampleAgeMs = observedOk ? nowMs - observedMs : Number.POSITIVE_INFINITY
  const resetAhead = resetsAt !== null && resetsAt * 1000 > nowMs
  const fresh =
    observedOk &&
    resetAhead &&
    sampleAgeMs >= -60_000 &&
    (shortWindow ? sampleAgeMs <= 30 * 60 * 1000 : sameDay)
  return {
    kind: limitKind(minutes),
    windowMinutes: minutes,
    usedPercent: used,
    remainingPercent: used === null ? null : Math.max(0, 100 - used),
    resetsAt,
    resetsLabel: resetsAt === null ? '' : formatDateTime(resetsAt * 1000),
    observedLabel: labelAt(observedAt),
    observedAtMs: observedOk ? observedMs : null,
    fresh,
    stale: resetsAt !== null && resetsAt * 1000 < nowMs,
  }
}

function windowsFromLimitRow(
  row: Record<string, SqlValue>,
  nowMs: number,
): {
  primary: CodexLimitWindowView | null
  secondary: CodexLimitWindowView | null
} {
  const observedAt = asString(row.observed_at) ?? ''
  return {
    primary: windowFrom(
      asNumber(row.primary_used_percent),
      asNumber(row.primary_window_minutes),
      asNumber(row.primary_resets_at),
      observedAt,
      nowMs,
    ),
    secondary: windowFrom(
      asNumber(row.secondary_used_percent),
      asNumber(row.secondary_window_minutes),
      asNumber(row.secondary_resets_at),
      observedAt,
      nowMs,
    ),
  }
}

function readLatestLimits(db: Database, nowMs: number): CodexLimitsView | null {
  const row = queryOne(
    db,
    `SELECT * FROM rate_limit_samples
     ORDER BY observed_at DESC, byte_offset DESC
     LIMIT 1`,
  )
  if (row === null) {
    return null
  }
  const observedAt = asString(row.observed_at) ?? ''
  const observedLabel = labelAt(observedAt)
  const planType = asString(row.plan_type)
  const planKey = planType?.trim().toLowerCase() ?? ''
  let { primary, secondary } = windowsFromLimitRow(row, nowMs)
  // A limit-reached snapshot often repeats the plan with primary/secondary null.
  // That row is newest, so it used to wipe the last real percent and hide the chart.
  if (primary === null && secondary === null) {
    const filled = queryOne(
      db,
      `SELECT * FROM rate_limit_samples
       WHERE primary_used_percent IS NOT NULL
          OR secondary_used_percent IS NOT NULL
       ORDER BY observed_at DESC, byte_offset DESC
       LIMIT 1`,
    )
    if (filled !== null) {
      const older = windowsFromLimitRow(filled, nowMs)
      primary = older.primary
      secondary = older.secondary
    }
  }
  if (primary === null && secondary === null && planType === null) {
    return null
  }
  return {
    planType,
    limitId: asString(row.limit_id),
    observedAt,
    observedLabel,
    primary,
    secondary,
    creditsHas: bitToBool(row.credits_has_credits),
    creditsUnlimited: bitToBool(row.credits_unlimited),
    creditsBalance: asString(row.credits_balance),
    reachedType: asString(row.rate_limit_reached_type),
    includedInPlan: planKey !== '' && planKey !== 'api',
  }
}

function readMissingModels(db: Database, bound: BoundFilter): string[] {
  return queryAll(
    db,
    `SELECT DISTINCT r.model AS model
     FROM requests r
     WHERE ${bound.sql}
       AND r.model IS NOT NULL
       AND r.model != ''
       AND NOT EXISTS (
         SELECT 1 FROM pricing_versions p WHERE p.model = r.model
       )
     ORDER BY r.model`,
    bound.params,
  )
    .map((row) => asString(row.model) ?? '')
    .filter((model) => model !== '' && listPriceFor(model) === null)
}

function readConversations(
  db: Database,
  bound: BoundFilter,
): CodexConversationSummary[] {
  return queryAll(
    db,
    `SELECT
       c.title AS title,
       MAX(r.observed_at) AS last_at,
       COUNT(r.id) AS request_count,
       COUNT(DISTINCT CASE WHEN r.model IS NOT NULL AND r.model != '' THEN r.model END) AS model_count,
       MIN(CASE WHEN r.model IS NOT NULL AND r.model != '' THEN r.model END) AS single_model,
       COALESCE(SUM(r.input_tokens), 0) AS input_tokens,
       COALESCE(SUM(r.cached_input_tokens), 0) AS cached_input_tokens,
       COALESCE(SUM(r.output_tokens), 0) AS output_tokens,
       COALESCE(SUM(r.reasoning_output_tokens), 0) AS reasoning_output_tokens,
       SUM(CASE WHEN r.estimated_api_cost_usd IS NOT NULL AND r.estimated_api_cost_usd != '' THEN 1 ELSE 0 END) AS priced,
       SUM(CASE WHEN r.estimated_api_cost_usd IS NOT NULL AND r.estimated_api_cost_usd != '' THEN CAST(r.estimated_api_cost_usd AS REAL) ELSE 0 END) AS cost_sum
     FROM conversations c
     INNER JOIN requests r
       ON r.provider = c.provider
      AND r.account_scope_key = c.account_scope_key
      AND r.conversation_id = c.conversation_id
     WHERE ${bound.sql}
     GROUP BY c.provider, c.account_scope_key, c.conversation_id, c.title
     ORDER BY input_tokens DESC
     LIMIT 20`,
    bound.params,
  ).map((row) => {
    const modelCount = asNumber(row.model_count) ?? 0
    const single = asString(row.single_model)
    const model =
      modelCount <= 1 ? (single && single.trim() !== '' ? single : 'Unknown') : `Mixed (${modelCount})`
    const priced = asNumber(row.priced) ?? 0
    const costSum = asNumber(row.cost_sum)
    const lastAt = asString(row.last_at) ?? ''
    return {
      title: asString(row.title) ?? '',
      model,
      observedLabel: labelAt(lastAt),
      requestCount: asNumber(row.request_count) ?? 0,
      inputTokens: asNumber(row.input_tokens) ?? 0,
      cachedInputTokens: asNumber(row.cached_input_tokens) ?? 0,
      outputTokens: asNumber(row.output_tokens) ?? 0,
      reasoningTokens: asNumber(row.reasoning_output_tokens) ?? 0,
      estimateUsd: priced > 0 ? costSum : null,
      missingModel: priced === 0 && single !== null && modelCount <= 1 ? single : null,
    }
  })
}

function hypothesis(line: string): string {
  return `Hypothesis: ${line}`
}

/**
 * Local Optimize hypotheses for one attributed request (or empty when missing).
 */
export function collectCodexOptimizeHints(
  store: RequestStore,
  requestId: string,
): string[] {
  const db = getDb(store)
  const row = queryOne(db, `SELECT * FROM requests WHERE id = ?`, [requestId])
  if (row === null) {
    return []
  }
  const hints: string[] = []
  const conversationId = asString(row.conversation_id)
  const accountScope = asString(row.account_scope_key) ?? ''
  const observedAt = asString(row.observed_at) ?? ''
  const inputTokens = asNumber(row.input_tokens)
  const cachedInput = asNumber(row.cached_input_tokens)
  const turnId = asString(row.turn_id)

  if (conversationId !== null && conversationId !== '' && observedAt !== '') {
    const prev = queryOne(
      db,
      `SELECT r.input_tokens AS input_tokens
       FROM requests r
       WHERE EXISTS (
         SELECT 1 FROM request_observations o
         WHERE o.request_id = r.id AND o.attributes_spend = 1
       )
         AND r.account_scope_key = ?
         AND r.conversation_id = ?
         AND r.observed_at < ?
         AND r.id != ?
       ORDER BY r.observed_at DESC, r.id DESC
       LIMIT 1`,
      [accountScope, conversationId, observedAt, requestId],
    )
    const prevInput = asNumber(prev?.input_tokens)
    if (
      inputTokens !== null &&
      prevInput !== null &&
      inputTokens > prevInput
    ) {
      hints.push(
        hypothesis(
          `Input grew versus the previous attributed request in this thread (${prevInput} → ${inputTokens}).`,
        ),
      )
    }
  }

  if (cachedInput === null || inputTokens === null || inputTokens <= 0) {
    hints.push(hypothesis('Cache share is unknown for this request.'))
  } else {
    const share = cachedInput / inputTokens
    if (share < CACHE_LOW_THRESHOLD) {
      hints.push(
        hypothesis(
          `Cache share is low (${(share * 100).toFixed(0)}% cached input).`,
        ),
      )
    }
  }

  if (turnId !== null && turnId !== '') {
    const turnCount = queryOne(
      db,
      `SELECT COUNT(*) AS c
       FROM requests r
       WHERE EXISTS (
         SELECT 1 FROM request_observations o
         WHERE o.request_id = r.id AND o.attributes_spend = 1
       )
         AND r.account_scope_key = ?
         AND r.turn_id = ?`,
      [accountScope, turnId],
    )
    const count = asNumber(turnCount?.c) ?? 0
    if (count > MANY_REQUESTS_PER_TURN) {
      hints.push(
        hypothesis(
          `Many model requests in one turn (${count} attributed requests share this turn id).`,
        ),
      )
    }
  }

  return hints
}

export function runCodexStats(
  store: RequestStore,
  filter: CodexAggregateFilter,
  options?: { spikeTokenThreshold?: number; nowMs?: number },
): CodexStatsView {
  const db = getDb(store)
  const bound = buildCodexAggregateFilter(filter)

  const mix = queryOne(
    db,
    `SELECT
       COALESCE(SUM(r.input_tokens), 0) AS input_tokens,
       COALESCE(SUM(r.cached_input_tokens), 0) AS cached_input_tokens,
       COALESCE(SUM(r.output_tokens), 0) AS output_tokens,
       COALESCE(SUM(r.reasoning_output_tokens), 0) AS reasoning_output_tokens
     FROM requests r
     WHERE ${bound.sql}`,
    bound.params,
  )

  const counts = queryOne(
    db,
    `SELECT
       COUNT(*) AS model_requests,
       COUNT(DISTINCT CASE WHEN r.turn_id IS NOT NULL AND r.turn_id != '' THEN r.turn_id END) AS turns,
       COUNT(DISTINCT CASE WHEN r.conversation_id IS NOT NULL AND r.conversation_id != '' THEN r.account_scope_key || char(0) || r.conversation_id END) AS conversations
     FROM requests r
     WHERE ${bound.sql}`,
    bound.params,
  )

  const estimated = moneySum(db, bound, 'estimated_api_cost_usd')
  const reported = moneySum(db, bound, 'reported_cost_usd')

  const cache = queryOne(
    db,
    `SELECT
       SUM(r.cached_input_tokens) AS cached_sum,
       SUM(r.input_tokens) AS input_sum
     FROM requests r
     WHERE ${bound.sql}
       AND r.input_tokens IS NOT NULL
       AND r.cached_input_tokens IS NOT NULL`,
    bound.params,
  )
  const cachedSum = asNumber(cache?.cached_sum)
  const inputSum = asNumber(cache?.input_sum)
  const cacheHit =
    cachedSum !== null && inputSum !== null && inputSum > 0
      ? cachedSum / inputSum
      : null

  const threshold = options?.spikeTokenThreshold ?? 1_000_000
  const spike = queryOne(
    db,
    `SELECT r.id AS id
     FROM requests r
     WHERE ${bound.sql}
       AND r.total_tokens IS NOT NULL
       AND r.total_tokens >= ?
     ORDER BY r.observed_at DESC, r.id DESC
     LIMIT 1`,
    [...bound.params, threshold],
  )
  const newest = queryOne(
    db,
    `SELECT r.id AS id
     FROM requests r
     WHERE ${bound.sql}
     ORDER BY r.observed_at DESC, r.id DESC
     LIMIT 1`,
    bound.params,
  )
  const analyzeRequestId =
    asString(spike?.id) ?? asString(newest?.id) ?? null
  const hints =
    analyzeRequestId !== null
      ? collectCodexOptimizeHints(store, analyzeRequestId)
      : []
  const limits = readLatestLimits(db, options?.nowMs ?? Date.now())
  const missingModels = readMissingModels(db, bound)

  return {
    tokenMix: {
      input: asNumber(mix?.input_tokens) ?? 0,
      cachedInput: asNumber(mix?.cached_input_tokens) ?? 0,
      output: asNumber(mix?.output_tokens) ?? 0,
      reasoning: asNumber(mix?.reasoning_output_tokens) ?? 0,
    },
    counts: {
      modelRequests: asNumber(counts?.model_requests) ?? 0,
      turns: asNumber(counts?.turns) ?? 0,
      conversations: asNumber(counts?.conversations) ?? 0,
    },
    pricedShare: {
      priced: estimated.priced,
      denom: estimated.denom,
    },
    estimatedApiCostUsd: estimated.sum,
    // Until phase 4 writes a separate equivalent, mirror estimated for layout.
    apiEquivalentCostUsd: estimated.sum,
    reportedCostUsd: reported.priced > 0 ? reported.sum : null,
    cacheHit,
    analyzeRequestId,
    hints,
    limits,
    missingModels,
    includedInPlan: limits?.includedInPlan === true,
    conversations: readConversations(db, bound),
    statusValues: readStatusValues(db, bound),
    mirror: readCodexMirror(db, bound, limits, {
      spikeTokenThreshold: options?.spikeTokenThreshold ?? 1_000_000,
      nowMs: options?.nowMs ?? Date.now(),
    }),
  }
}

function readStatusValues(db: Database, bound: BoundFilter): string[] {
  const values = queryAll(
    db,
    `SELECT DISTINCT COALESCE(r.status, '') AS status
     FROM requests r
     WHERE ${bound.sql}`,
    bound.params,
  )
    .map((row) => asString(row.status) ?? '')
    .filter((status) => status !== '')
  values.sort()
  return values
}

function asMoney(value: SqlValue | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function localDayKey(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) {
    return ''
  }
  const start = startOfLocalDayMs(new Date(ms))
  if (start === null) {
    return ''
  }
  const day = new Date(start)
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${day.getFullYear()}-${month}-${date}`
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
  }
  return sorted[mid] ?? null
}

type RateLimitPaceSample = {
  observedAt: number
  usedPercent: number
}

/** A reset that moves by more than this closes the previous limit series. */
export const CODEX_RESET_TOLERANCE_SECONDS = 60
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

function readPaceSamples(
  db: Database,
  windowView: CodexLimitWindowView,
): RateLimitPaceSample[] {
  if (windowView.windowMinutes === null || windowView.resetsAt === null) {
    return []
  }
  const rows = queryAll(
    db,
    `SELECT
       observed_at,
       primary_used_percent, primary_window_minutes, primary_resets_at,
       secondary_used_percent, secondary_window_minutes, secondary_resets_at
     FROM rate_limit_samples
     ORDER BY observed_at ASC, byte_offset ASC`,
  )
  const byTimestamp = new Map<number, RateLimitPaceSample>()
  const add = (
    sample: Record<string, SqlValue>,
    minutes: number | null,
    usedPercent: number | null,
    resetsAt: number | null,
  ): void => {
    if (
      minutes !== windowView.windowMinutes ||
      usedPercent === null ||
      resetsAt === null ||
      Math.abs(resetsAt - windowView.resetsAt!) > CODEX_RESET_TOLERANCE_SECONDS
    ) {
      return
    }
    const observedAt = asString(sample.observed_at)
    const timestamp = observedAt === null ? Number.NaN : Date.parse(observedAt)
    if (!Number.isFinite(timestamp)) {
      return
    }
    byTimestamp.set(timestamp, { observedAt: timestamp, usedPercent })
  }

  for (const sample of rows) {
    add(
      sample,
      asNumber(sample.primary_window_minutes),
      asNumber(sample.primary_used_percent),
      asNumber(sample.primary_resets_at),
    )
    add(
      sample,
      asNumber(sample.secondary_window_minutes),
      asNumber(sample.secondary_used_percent),
      asNumber(sample.secondary_resets_at),
    )
  }
  return [...byTimestamp.values()].sort((left, right) => left.observedAt - right.observedAt)
}

function paceFromWindow(
  db: Database,
  windowView: CodexLimitWindowView | null,
  nowMs: number,
): CodexMirrorPace | null {
  if (
    windowView === null ||
    windowView.windowMinutes === null ||
    windowView.resetsAt === null ||
    windowView.usedPercent === null
  ) {
    return null
  }
  const samples = readPaceSamples(db, windowView)
  const last = samples[samples.length - 1]
  const asOfMs = last?.observedAt ?? windowView.observedAtMs
  if (asOfMs === null || !Number.isFinite(asOfMs)) {
    return null
  }
  const windowMs = windowView.windowMinutes * 60 * 1000
  const endMs = windowView.resetsAt * 1000
  const startMs = endMs - windowMs
  if (!(windowMs > 0) || nowMs >= endMs) {
    return null
  }
  const unitMs = windowMs >= DAY_MS ? DAY_MS : HOUR_MS
  const sampleAgeMs = asOfMs - startMs
  const sampleAgeUnits = Math.max(0, sampleAgeMs) / unitMs
  const elapsedMs = Math.max(0, nowMs - startMs)
  const leftMs = Math.max(0, endMs - nowMs)
  const used = last?.usedPercent ?? windowView.usedPercent
  const remaining = Math.max(0, 100 - used)
  // Pace is the reading divided by the age at the sample, not by now.
  // A quiet stretch after the sample is not a gentler burn.
  const minAgeMs = unitMs === DAY_MS ? DAY_MS : 30 * 60 * 1000
  const hasPace = windowView.fresh && sampleAgeMs >= minAgeMs && sampleAgeUnits > 0
  const paceRate = hasPace ? used / sampleAgeUnits : null
  const spanUnits = windowMs / unitMs
  const dailyBudget = spanUnits > 0 ? 100 / spanUnits : 0
  const left = leftMs / unitMs
  const toLast = left > 0 ? remaining / left : remaining
  const sampleLeftUnits = Math.max(0, endMs - asOfMs) / unitMs
  const forecast = paceRate === null ? null : used + paceRate * sampleLeftUnits
  let runsOutLabel: string | null = null
  if (paceRate !== null && paceRate > 0 && used < 100) {
    const hitMs = asOfMs + ((100 - used) / paceRate) * unitMs
    if (hitMs < endMs) {
      runsOutLabel = formatDateTime(hitMs)
    }
  }
  const windowElapsedPercent =
    windowMs > 0 ? Math.max(0, Math.min(100, (elapsedMs / windowMs) * 100)) : 0
  return {
    unit: unitMs === DAY_MS ? 'day' : 'hour',
    elapsed: elapsedMs / unitMs,
    left,
    used,
    remaining,
    dailyPace: paceRate,
    dailyBudget,
    toLast,
    forecast,
    over: paceRate !== null && paceRate > dailyBudget + 0.05,
    kind: windowView.kind,
    resetsLabel: windowView.resetsLabel,
    runsOutLabel,
    stale: windowView.stale,
    fresh: windowView.fresh,
    windowElapsedPercent,
    asOfMs,
    windowStartMs: startMs,
    resetsAtMs: endMs,
    asOfLabel: formatDateTime(asOfMs),
  }
}

function pickPaceWindow(limits: CodexLimitsView | null): CodexLimitWindowView | null {
  if (limits === null) {
    return null
  }
  const windows = [limits.secondary, limits.primary].filter(
    (windowView): windowView is CodexLimitWindowView => windowView !== null,
  )
  return (
    windows.find((windowView) => !windowView.stale && windowView.kind === '7d') ??
    windows.find((windowView) => !windowView.stale) ??
    windows.find((windowView) => windowView.kind === '7d') ??
    windows[0] ??
    null
  )
}

function readCodexMirror(
  db: Database,
  bound: BoundFilter,
  limits: CodexLimitsView | null,
  options: { spikeTokenThreshold: number; nowMs: number },
): CodexMirror {
  const rows = queryAll(
    db,
    `SELECT r.observed_at AS observed_at, r.model AS model, r.billing_mode AS billing_mode,
            r.estimated_api_cost_usd AS cost, r.input_tokens AS input_tokens,
            r.cached_input_tokens AS cached_input_tokens, r.output_tokens AS output_tokens,
            r.total_tokens AS total_tokens
     FROM requests r
     WHERE ${bound.sql}`,
    bound.params,
  )
  const todayKey = localDayKey(new Date(options.nowMs).toISOString())
  let totalUsd = 0
  let priced = 0
  let todayUsd = 0
  let totalTokens = 0
  let inputTokens = 0
  let cachedTokens = 0
  let outputTokens = 0
  let tokenRows = 0
  const costs: number[] = []
  let priciest: CodexMirror['priciest'] = null
  let heaviest: CodexMirror['heaviest'] = null
  const byDay = new Map<string, { usd: number; requests: number }>()
  const byModel = new Map<string, { usd: number; requests: number }>()
  const byKind = new Map<string, number>()
  let spikes = 0

  for (const row of rows) {
    const cost = asMoney(row.cost)
    const model = asString(row.model) || 'Unknown'
    const observed = asString(row.observed_at) ?? ''
    const input = asNumber(row.input_tokens) ?? 0
    const cached = asNumber(row.cached_input_tokens) ?? 0
    const output = asNumber(row.output_tokens) ?? 0
    const total = asNumber(row.total_tokens) ?? input + output
    const day = localDayKey(observed)
    inputTokens += input
    cachedTokens += cached
    outputTokens += output
    if (total > 0) {
      totalTokens += total
      tokenRows += 1
    }
    if (total >= options.spikeTokenThreshold) {
      spikes += 1
    }
    const modelRow = byModel.get(model) ?? { usd: 0, requests: 0 }
    modelRow.requests += 1
    if (cost !== null) {
      priced += 1
      totalUsd += cost
      costs.push(cost)
      modelRow.usd += cost
      if (day === todayKey) {
        todayUsd += cost
      }
      const dayRow = byDay.get(day) ?? { usd: 0, requests: 0 }
      dayRow.usd += cost
      dayRow.requests += 1
      byDay.set(day, dayRow)
      const kind = asString(row.billing_mode) || 'unknown'
      byKind.set(kind, (byKind.get(kind) ?? 0) + cost)
      if (priciest === null || cost > priciest.usd) {
        priciest = {
          usd: cost,
          model,
          when: Number.isFinite(Date.parse(observed)) ? formatDateTime(Date.parse(observed)) : observed,
        }
      }
    }
    byModel.set(model, modelRow)
    if (heaviest === null || total > heaviest.tokens) {
      heaviest = {
        tokens: total,
        model,
        when: Number.isFinite(Date.parse(observed)) ? formatDateTime(Date.parse(observed)) : observed,
      }
    }
  }

  let busiest: CodexMirror['busiest'] = null
  for (const [day, row] of byDay) {
    if (busiest === null || row.usd > busiest.usd) {
      busiest = { day, usd: row.usd, requests: row.requests }
    }
  }

  const tokenBase = Math.max(1, inputTokens + outputTokens)
  const uncached = Math.max(0, inputTokens - cachedTokens)
  const shares: CodexMirrorShare[] = []
  const shareCandidates: CodexMirrorShare[] = [
    { key: 'cacheRead', percent: Math.round((cachedTokens / tokenBase) * 100) },
    { key: 'input', percent: Math.round((uncached / tokenBase) * 100) },
    { key: 'output', percent: Math.round((outputTokens / tokenBase) * 100) },
  ]
  for (const share of shareCandidates) {
    if (share.percent > 0) {
      shares.push(share)
    }
  }

  const modelRows = [...byModel.entries()]
    .sort((left, right) => right[1].usd - left[1].usd || right[1].requests - left[1].requests)
    .slice(0, 8)
    .map(([label, row]) => ({ label, usd: row.usd, requests: row.requests }))

  const rates = modelRows.flatMap((row) => {
    const price = listPriceFor(row.label)
    if (price === null) {
      return []
    }
    return [
      {
        model: row.label,
        inputRate: price.inputRate,
        cachedRate: price.cachedInputRate,
        outputRate: price.outputRate,
        requests: row.requests,
        usd: row.usd,
      },
    ]
  })

  return {
    requests: rows.length,
    totalUsd: priced > 0 ? totalUsd : null,
    todayUsd,
    avgUsd: priced > 0 ? totalUsd / priced : null,
    medianUsd: medianOf(costs),
    spikes,
    spikeThreshold: options.spikeTokenThreshold,
    cacheHit:
      inputTokens > 0 ? cachedTokens / inputTokens : null,
    costPerMillion:
      priced > 0 && totalTokens > 0 ? totalUsd / (totalTokens / 1_000_000) : null,
    avgTokens: tokenRows > 0 ? totalTokens / tokenRows : null,
    totalTokens,
    inputTokens,
    cachedTokens,
    outputTokens,
    shares,
    priciest,
    heaviest: rows.length > 0 ? heaviest : null,
    busiest,
    byModel: modelRows,
    byKind: [...byKind.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([label, usd]) => ({ label, usd })),
    rates,
    pace: paceFromWindow(db, pickPaceWindow(limits), options.nowMs),
    plan: limits?.planType ?? null,
    includedInPlan: limits?.includedInPlan === true,
  }
}
