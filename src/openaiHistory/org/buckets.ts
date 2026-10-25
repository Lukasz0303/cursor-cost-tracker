import type { Database } from 'sql.js'

/** Organization aggregates. These rows are not requests and never carry a per-call cost. */
export type OrgBucketRow = {
  startAt: number
  endAt: number
  dimensionsHash: string
  model: string | null
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  requests: number
  costUsd: string | null
}

export type OrgModelUsage = {
  model: string
  requests: number
  inputTokens: number
  outputTokens: number
}

export type OrgUsageSummary = {
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  requests: number
  costUsd: number | null
  byModel: OrgModelUsage[]
}

const SCOPE = 'org'

export function parseUsageBody(body: unknown): {
  rows: OrgBucketRow[]
  nextPage: string | null
} {
  return parsePage(body, 'usage')
}

export function parseCostsBody(body: unknown): {
  rows: OrgBucketRow[]
  nextPage: string | null
} {
  return parsePage(body, 'cost')
}

function parsePage(
  body: unknown,
  kind: 'usage' | 'cost',
): { rows: OrgBucketRow[]; nextPage: string | null } {
  const page = record(body)
  if (!page) {
    return { rows: [], nextPage: null }
  }
  const buckets = Array.isArray(page.data) ? page.data : []
  const rows: OrgBucketRow[] = []
  for (const bucket of buckets) {
    const parent = record(bucket)
    if (!parent) {
      continue
    }
    const startAt = finite(parent.start_time)
    const endAt = finite(parent.end_time)
    if (startAt === null || endAt === null) {
      continue
    }
    const results = Array.isArray(parent.results) ? parent.results : []
    for (const item of results) {
      const row = record(item)
      if (!row) {
        continue
      }
      if (kind === 'usage') {
        rows.push(usageRow(startAt, endAt, row))
        continue
      }
      const cost = costRow(startAt, endAt, row)
      if (cost) {
        rows.push(cost)
      }
    }
  }
  const next = page.next_page
  return { rows, nextPage: typeof next === 'string' && next.length > 0 ? next : null }
}

function usageRow(startAt: number, endAt: number, row: Record<string, unknown>): OrgBucketRow {
  const model = text(row.model)
  return {
    startAt,
    endAt,
    dimensionsHash: `usage\n${model ?? ''}`,
    model,
    inputTokens: whole(row.input_tokens),
    outputTokens: whole(row.output_tokens),
    cachedTokens: whole(row.input_cached_tokens),
    requests: whole(row.num_model_requests),
    costUsd: null,
  }
}

function costRow(
  startAt: number,
  endAt: number,
  row: Record<string, unknown>,
): OrgBucketRow | null {
  const amount = record(row.amount)
  const raw = amount ? amount.value : row.amount
  const value = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(value)) {
    return null
  }
  const project = text(row.project_id) ?? ''
  return {
    startAt,
    endAt,
    dimensionsHash: `cost\n${project}`,
    model: null,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    requests: 0,
    costUsd: value.toFixed(6),
  }
}

/** Drop the previous organization window, then store the fresh one. A failed fetch must not call this. */
export function replaceOrgBuckets(db: Database, rows: readonly OrgBucketRow[], fetchedAt: string): void {
  const merged = new Map<string, OrgBucketRow>()
  for (const row of rows) {
    const key = `${row.startAt}|${row.endAt}|${row.dimensionsHash}`
    const prev = merged.get(key)
    if (!prev) {
      merged.set(key, { ...row })
      continue
    }
    prev.inputTokens += row.inputTokens
    prev.outputTokens += row.outputTokens
    prev.cachedTokens += row.cachedTokens
    prev.requests += row.requests
    if (row.costUsd !== null) {
      const sum = Number(prev.costUsd ?? 0) + Number(row.costUsd)
      prev.costUsd = Number.isFinite(sum) ? sum.toFixed(6) : prev.costUsd
    }
  }
  db.run('BEGIN')
  try {
    db.run(`DELETE FROM billing_buckets WHERE scope_id = ?`, [SCOPE])
    for (const row of merged.values()) {
      const id = `${SCOPE}|${row.startAt}|${row.endAt}|${row.dimensionsHash}`
      db.run(
        `INSERT INTO billing_buckets (
          id, scope_id, start_at, end_at, dimensions_hash, model,
          input_tokens, output_tokens, cached_tokens, requests, cost_usd, fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          SCOPE,
          row.startAt,
          row.endAt,
          row.dimensionsHash,
          row.model,
          row.inputTokens,
          row.outputTokens,
          row.cachedTokens,
          row.requests,
          row.costUsd,
          fetchedAt,
        ],
      )
    }
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
}

export function summarizeOrgRows(rows: readonly OrgBucketRow[]): OrgUsageSummary | null {
  if (rows.length === 0) {
    return null
  }
  let inputTokens = 0
  let outputTokens = 0
  let cachedTokens = 0
  let requests = 0
  let costUsd = 0
  let sawCost = false
  const byModel = new Map<string, OrgModelUsage>()
  for (const row of rows) {
    inputTokens += row.inputTokens
    outputTokens += row.outputTokens
    cachedTokens += row.cachedTokens
    requests += row.requests
    if (row.costUsd !== null) {
      const value = Number(row.costUsd)
      if (Number.isFinite(value)) {
        costUsd += value
        sawCost = true
      }
    }
    if (!row.model) {
      continue
    }
    const prev = byModel.get(row.model) ?? {
      model: row.model,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
    }
    prev.requests += row.requests
    prev.inputTokens += row.inputTokens
    prev.outputTokens += row.outputTokens
    byModel.set(row.model, prev)
  }
  const models = [...byModel.values()].sort(
    (a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens),
  )
  return {
    inputTokens,
    outputTokens,
    cachedTokens,
    requests,
    costUsd: sawCost ? costUsd : null,
    byModel: models,
  }
}

export function readOrgUsageSummary(db: Database): OrgUsageSummary | null {
  const totals = one(db, `SELECT
      COALESCE(SUM(input_tokens), 0) AS input_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens,
      COALESCE(SUM(cached_tokens), 0) AS cached_tokens,
      COALESCE(SUM(requests), 0) AS requests,
      COUNT(*) AS n
    FROM billing_buckets WHERE scope_id = ?`, [SCOPE])
  if (!totals || whole(totals.n) === 0) {
    return null
  }
  const cost = one(db, `SELECT SUM(CAST(cost_usd AS REAL)) AS cost
    FROM billing_buckets WHERE scope_id = ? AND cost_usd IS NOT NULL`, [SCOPE])
  const rawCost = cost ? cost.cost : null
  const costValue = rawCost === null || rawCost === undefined ? Number.NaN : Number(rawCost)
  const byModel: OrgModelUsage[] = []
  const stmt = db.prepare(`SELECT model,
      SUM(input_tokens) AS input_tokens,
      SUM(output_tokens) AS output_tokens,
      SUM(requests) AS requests
    FROM billing_buckets
    WHERE scope_id = ? AND model IS NOT NULL AND model != ''
    GROUP BY model
    ORDER BY SUM(input_tokens) + SUM(output_tokens) DESC`)
  try {
    stmt.bind([SCOPE])
    while (stmt.step()) {
      const row = stmt.getAsObject()
      const model = text(row.model)
      if (!model) {
        continue
      }
      byModel.push({
        model,
        requests: whole(row.requests),
        inputTokens: whole(row.input_tokens),
        outputTokens: whole(row.output_tokens),
      })
    }
  } finally {
    stmt.free()
  }
  return {
    inputTokens: whole(totals.input_tokens),
    outputTokens: whole(totals.output_tokens),
    cachedTokens: whole(totals.cached_tokens),
    requests: whole(totals.requests),
    costUsd: Number.isFinite(costValue) ? costValue : null,
    byModel,
  }
}

function one(db: Database, sql: string, params: string[]): Record<string, unknown> | null {
  const stmt = db.prepare(sql)
  try {
    stmt.bind(params)
    if (!stmt.step()) {
      return null
    }
    return stmt.getAsObject()
  } finally {
    stmt.free()
  }
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function finite(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.NaN
  return Number.isFinite(n) ? n : null
}

function whole(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) {
    return 0
  }
  return Math.round(n)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
