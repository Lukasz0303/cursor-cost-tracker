import type { Database, SqlValue } from 'sql.js'
import { formatDate, formatDateTime } from '../format'
import { localDayKey, startOfLocalDayMs } from '../time'
import {
  buildCodexAggregateFilter,
  CODEX_RESET_TOLERANCE_SECONDS,
  type CodexAggregateFilter,
  type CodexLimitKind,
} from './historyStats'
import type { RequestStore } from './store/types'

/**
 * One point per local calendar day that has attributed rows.
 * Empty calendar days stay absent here; the chart lays them out.
 */
export type CodexChartPoint = {
  timestamp: number
  time: string
  tokens: number
  costUsd: number
  queryCount: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  pricedCount: number
}

/** Successive `token_count.rate_limits` samples. Not a share of one rollout. */
export type CodexLimitPoint = {
  timestamp: number
  label: string
  usedPercent: number
  /** Unix seconds. A new value starts a new segment in the chart. */
  resetsAt: number | null
}

export type CodexLimitSeries = {
  kind: CodexLimitKind
  windowMinutes: number | null
  /** Unix seconds. A later reset, beyond the 60s tolerance, is a new series. */
  resetsAt: number | null
  points: CodexLimitPoint[]
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

function asNumber(value: SqlValue | undefined): number | null {
  return typeof value === 'number' ? value : null
}

function asString(value: SqlValue | undefined): string | null {
  return typeof value === 'string' ? value : null
}

export function runCodexCharts(
  store: RequestStore,
  filter: CodexAggregateFilter,
): CodexChartPoint[] {
  const db = getDb(store)
  const bound = buildCodexAggregateFilter(filter)
  const rows = queryAll(
    db,
    `SELECT
       r.observed_at AS observed_at,
       r.total_tokens AS total_tokens,
       r.input_tokens AS input_tokens,
       r.cached_input_tokens AS cached_input_tokens,
       r.output_tokens AS output_tokens,
       r.reasoning_output_tokens AS reasoning_output_tokens,
       r.estimated_api_cost_usd AS estimated_api_cost_usd
     FROM requests r
     WHERE ${bound.sql}
     ORDER BY r.observed_at ASC`,
    bound.params,
  )

  const byDay = new Map<
    string,
    {
      timestamp: number
      tokens: number
      costUsd: number
      queryCount: number
      inputTokens: number
      cachedInputTokens: number
      outputTokens: number
      reasoningTokens: number
      pricedCount: number
    }
  >()

  for (const row of rows) {
    const observedAt = asString(row.observed_at)
    if (observedAt === null) {
      continue
    }
    const ms = Date.parse(observedAt)
    if (!Number.isFinite(ms)) {
      continue
    }
    const key = localDayKey(ms)
    const start = startOfLocalDayMs(key)
    const dayStart = start ?? ms
    const tokens = Math.max(0, asNumber(row.total_tokens) ?? 0)
    const inputTokens = Math.max(0, asNumber(row.input_tokens) ?? 0)
    const cachedInputTokens = Math.max(0, asNumber(row.cached_input_tokens) ?? 0)
    const outputTokens = Math.max(0, asNumber(row.output_tokens) ?? 0)
    const reasoningTokens = Math.max(0, asNumber(row.reasoning_output_tokens) ?? 0)
    const costRaw = asString(row.estimated_api_cost_usd)
    const priced = costRaw !== null && costRaw !== '' && Number.isFinite(Number(costRaw))
    const costUsd = priced ? Math.max(0, Number(costRaw)) : 0
    const existing = byDay.get(key)
    if (existing === undefined) {
      byDay.set(key, {
        timestamp: dayStart,
        tokens,
        costUsd,
        queryCount: 1,
        inputTokens,
        cachedInputTokens,
        outputTokens,
        reasoningTokens,
        pricedCount: priced ? 1 : 0,
      })
      continue
    }
    existing.tokens += tokens
    existing.costUsd += costUsd
    existing.queryCount += 1
    existing.inputTokens += inputTokens
    existing.cachedInputTokens += cachedInputTokens
    existing.outputTokens += outputTokens
    existing.reasoningTokens += reasoningTokens
    if (priced) {
      existing.pricedCount += 1
    }
  }

  const keys = [...byDay.keys()].sort()
  const points: CodexChartPoint[] = []
  for (const key of keys) {
    const day = byDay.get(key)
    if (day === undefined) {
      continue
    }
    points.push({
      timestamp: day.timestamp,
      time: formatDate(day.timestamp),
      tokens: day.tokens,
      costUsd: day.costUsd,
      queryCount: day.queryCount,
      inputTokens: day.inputTokens,
      cachedInputTokens: day.cachedInputTokens,
      outputTokens: day.outputTokens,
      reasoningTokens: day.reasoningTokens,
      pricedCount: day.pricedCount,
    })
  }
  return points
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

function pushLimitPoint(
  series: Map<string, CodexLimitSeries>,
  minutes: number | null,
  used: number | null,
  resetsAt: number | null,
  observedAt: string,
): void {
  if (used === null || !Number.isFinite(used)) {
    return
  }
  const ms = Date.parse(observedAt)
  if (!Number.isFinite(ms)) {
    return
  }
  let bucket: CodexLimitSeries | undefined
  for (const existing of series.values()) {
    if (existing.windowMinutes !== minutes) {
      continue
    }
    if (resetsAt === null || existing.resetsAt === null) {
      if (resetsAt === existing.resetsAt) {
        bucket = existing
        break
      }
      continue
    }
    if (Math.abs(existing.resetsAt - resetsAt) <= CODEX_RESET_TOLERANCE_SECONDS) {
      bucket = existing
      break
    }
  }
  if (bucket === undefined) {
    bucket = {
      kind: limitKind(minutes),
      windowMinutes: minutes,
      resetsAt,
      points: [],
    }
    series.set(`${minutes ?? 'x'}:${resetsAt ?? 'x'}:${series.size}`, bucket)
  }
  bucket.points.push({
    timestamp: ms,
    label: formatDateTime(ms),
    usedPercent: used,
    resetsAt,
  })
}

/** Account limit samples over time, split by window. The line stops at the last sample. */
export function runCodexLimitSeries(store: RequestStore): CodexLimitSeries[] {
  const db = getDb(store)
  const rows = queryAll(
    db,
    `SELECT
       observed_at,
       primary_used_percent, primary_window_minutes, primary_resets_at,
       secondary_used_percent, secondary_window_minutes, secondary_resets_at
     FROM rate_limit_samples
     ORDER BY observed_at ASC, byte_offset ASC`,
  )
  const primary = new Map<string, CodexLimitSeries>()
  const secondary = new Map<string, CodexLimitSeries>()
  for (const row of rows) {
    const observedAt = asString(row.observed_at) ?? ''
    pushLimitPoint(
      primary,
      asNumber(row.primary_window_minutes),
      asNumber(row.primary_used_percent),
      asNumber(row.primary_resets_at),
      observedAt,
    )
    pushLimitPoint(
      secondary,
      asNumber(row.secondary_window_minutes),
      asNumber(row.secondary_used_percent),
      asNumber(row.secondary_resets_at),
      observedAt,
    )
  }
  const series = [...primary.values(), ...secondary.values()].filter(
    (item) => item.points.length > 0,
  )
  series.sort((a, b) => (b.windowMinutes ?? 0) - (a.windowMinutes ?? 0))
  return series
}
