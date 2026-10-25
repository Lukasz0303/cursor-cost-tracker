import type { Database, SqlValue } from 'sql.js'
import { startOfLocalDayMs } from '../time'
import type { BillingMode, ModelEvidence, RequestStatus } from './domain'
import type { CodexCsvSourceRow } from './exportCsv'
import {
  foldUntitledHourGroups,
  hourBucketMembers,
  mapGroupRow,
  type GroupAggregate,
} from './historyGroups'
import {
  mapRequestDetails,
  type CodexDetailFields,
  type CodexDetailSource,
} from './historyDetails'
import {
  mapRequestRow,
  moneyForBasis,
  type CodexCostBasis,
  type CodexRow,
  type RequestRowSource,
} from './historyRows'
import type { RequestStore } from './store/types'

export type CodexQuery = {
  correlationId: string
  filterRevision: number
  from: string | null
  to: string | null
  accountScopeKey: string | null
  model: string | null
  status: RequestStatus | null
  groupBy: 'conversation' | 'none'
  sort: 'time-desc' | 'cost-desc' | 'tokens-desc' | 'input-desc'
  costBasis: CodexCostBasis
  cursor: string | null
  limit: number
}

export type CodexTotals = {
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number | null
}

export type CodexCoverage = {
  priced: number
  pricedDenom: number
  missingUsage: number
  missingAccount: number
  partial: boolean
}

export type CodexPage = {
  correlationId: string
  filterRevision: number
  rows: CodexRow[]
  nextCursor: string | null
  totals: CodexTotals
  coverage: CodexCoverage
  lastSyncAt: string | null
}

export type CodexQueryOptions = {
  spikeTokenThreshold: number
  showSpikeWarning?: boolean
}

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

function isUnsafeString(value: string): boolean {
  if (value.includes('..') || value.includes('/') || value.includes('\\')) {
    return true
  }
  if (value.includes('--') || value.includes('/*') || value.includes('*/')) {
    return true
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) {
    return true
  }
  if (value.includes('sk-') || value.includes('Bearer ')) {
    return true
  }
  if (JWT_SHAPE.test(value)) {
    return true
  }
  return false
}

function asOptionalString(value: unknown): string | null | { error: string } {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    return { error: 'invalid string field' }
  }
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  if (isUnsafeString(trimmed)) {
    return { error: 'unsafe filter value' }
  }
  return trimmed
}

function asStatus(value: unknown): RequestStatus | null | { error: string } {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled' ||
    value === 'incomplete' ||
    value === 'unknown'
  ) {
    return value
  }
  return { error: 'invalid status' }
}

export function parseCodexQuery(input: unknown): CodexQuery | { error: string } {
  if (typeof input !== 'object' || input === null) {
    return { error: 'invalid query' }
  }
  const raw = input as Record<string, unknown>
  const correlationId =
    typeof raw.correlationId === 'string' ? raw.correlationId.trim() : ''
  if (correlationId === '' || isUnsafeString(correlationId)) {
    return { error: 'invalid correlationId' }
  }
  const filterRevision =
    typeof raw.filterRevision === 'number'
      ? raw.filterRevision
      : Number(raw.filterRevision)
  if (!Number.isFinite(filterRevision)) {
    return { error: 'invalid filterRevision' }
  }
  const limit =
    typeof raw.limit === 'number' ? raw.limit : Number(raw.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return { error: 'limit must be 1–100' }
  }

  const from = asOptionalString(raw.from)
  if (typeof from === 'object' && from !== null && 'error' in from) {
    return from
  }
  const to = asOptionalString(raw.to)
  if (typeof to === 'object' && to !== null && 'error' in to) {
    return to
  }
  const accountScopeKey = asOptionalString(raw.accountScopeKey)
  if (
    typeof accountScopeKey === 'object' &&
    accountScopeKey !== null &&
    'error' in accountScopeKey
  ) {
    return accountScopeKey
  }
  const model = asOptionalString(raw.model)
  if (typeof model === 'object' && model !== null && 'error' in model) {
    return model
  }
  const status = asStatus(raw.status)
  if (typeof status === 'object' && status !== null && 'error' in status) {
    return status
  }
  const cursor = asOptionalString(raw.cursor)
  if (typeof cursor === 'object' && cursor !== null && 'error' in cursor) {
    return cursor
  }

  const groupBy = raw.groupBy === 'none' ? 'none' : 'conversation'
  const sort =
    raw.sort === 'cost-desc' || raw.sort === 'tokens-desc' || raw.sort === 'input-desc'
      ? raw.sort
      : 'time-desc'
  const costBasis: CodexCostBasis =
    raw.costBasis === 'reported' || raw.costBasis === 'api-equivalent'
      ? raw.costBasis
      : 'estimated-api'

  if (from !== null && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return { error: 'invalid from date' }
  }
  if (to !== null && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { error: 'invalid to date' }
  }

  return {
    correlationId,
    filterRevision,
    from,
    to,
    accountScopeKey,
    model,
    status,
    groupBy,
    sort,
    costBasis,
    cursor,
    limit,
  }
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
  const rows = queryAll(db, sql, params)
  return rows[0] ?? null
}

function asString(value: SqlValue | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: SqlValue | undefined): number | null {
  return typeof value === 'number' ? value : null
}

function costColumnSql(basis: CodexCostBasis): string {
  return basis === 'reported' ? 'r.reported_cost_usd' : 'r.estimated_api_cost_usd'
}

type BoundFilter = {
  sql: string
  params: SqlValue[]
  fromIso: string | null
  toIso: string | null
}

function buildRequestFilters(query: CodexQuery): BoundFilter {
  const clauses: string[] = [
    `EXISTS (
      SELECT 1 FROM request_observations o
      WHERE o.request_id = r.id AND o.attributes_spend = 1
    )`,
  ]
  const params: SqlValue[] = []

  let fromIso: string | null = null
  let toIso: string | null = null
  if (query.from !== null) {
    const start = startOfLocalDayMs(query.from)
    if (start !== null) {
      fromIso = new Date(start).toISOString()
      clauses.push('r.observed_at >= ?')
      params.push(fromIso)
    }
  }
  if (query.to !== null) {
    const end = startOfLocalDayMs(query.to)
    if (end !== null) {
      toIso = new Date(end).toISOString()
      clauses.push('r.observed_at < ?')
      params.push(toIso)
    }
  }
  if (query.accountScopeKey !== null) {
    clauses.push('r.account_scope_key = ?')
    params.push(query.accountScopeKey)
  }
  if (query.model !== null) {
    if (query.model === 'Unknown') {
      clauses.push("(r.model IS NULL OR r.model = '')")
    } else {
      clauses.push('r.model = ?')
      params.push(query.model)
    }
  }
  if (query.status !== null) {
    clauses.push('r.status = ?')
    params.push(query.status)
  }

  return { sql: clauses.join(' AND '), params, fromIso, toIso }
}

type CursorPayload = {
  sort: CodexQuery['sort']
  v: string | number | null
  id: string
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeCursor(
  raw: string | null,
  sort: CodexQuery['sort'],
): CursorPayload | null {
  if (raw === null || raw === '') {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as CursorPayload).sort !== sort ||
      typeof (parsed as CursorPayload).id !== 'string'
    ) {
      return null
    }
    return parsed as CursorPayload
  } catch {
    return null
  }
}

function orderClause(sort: CodexQuery['sort'], costCol: string): string {
  if (sort === 'cost-desc') {
    return `(${costCol} IS NULL OR ${costCol} = '') ASC, CAST(${costCol} AS REAL) DESC, r.id DESC`
  }
  if (sort === 'tokens-desc') {
    return `(r.total_tokens IS NULL) ASC, r.total_tokens DESC, r.id DESC`
  }
  if (sort === 'input-desc') {
    return `(r.input_tokens IS NULL) ASC, r.input_tokens DESC, r.id DESC`
  }
  return 'r.observed_at DESC, r.id DESC'
}

function keysetClause(
  sort: CodexQuery['sort'],
  costCol: string,
  cursor: CursorPayload,
): { sql: string; params: SqlValue[] } {
  if (sort === 'time-desc') {
    return {
      sql: '(r.observed_at < ? OR (r.observed_at = ? AND r.id < ?))',
      params: [String(cursor.v), String(cursor.v), cursor.id],
    }
  }
  if (sort === 'tokens-desc' || sort === 'input-desc') {
    const column = sort === 'input-desc' ? 'r.input_tokens' : 'r.total_tokens'
    const v = cursor.v === null ? null : Number(cursor.v)
    if (v === null) {
      return {
        sql: `(${column} IS NULL AND r.id < ?)`,
        params: [cursor.id],
      }
    }
    return {
      sql: `(${column} < ? OR (${column} = ? AND r.id < ?) OR ${column} IS NULL)`,
      params: [v, v, cursor.id],
    }
  }
  // cost-desc: nulls last, so after non-nulls
  if (cursor.v === null || cursor.v === '') {
    return {
      sql: `((${costCol} IS NULL OR ${costCol} = '') AND r.id < ?)`,
      params: [cursor.id],
    }
  }
  const v = Number(cursor.v)
  return {
    sql: `(
      CAST(${costCol} AS REAL) < ?
      OR (CAST(${costCol} AS REAL) = ? AND r.id < ?)
      OR (${costCol} IS NULL OR ${costCol} = '')
    )`,
    params: [v, v, cursor.id],
  }
}

function mapSqlRequest(row: Record<string, SqlValue>): RequestRowSource {
  return {
    id: asString(row.id) ?? '',
    observedAt: asString(row.observed_at) ?? '',
    model: asString(row.model),
    modelEvidence: (asString(row.model_evidence) ?? 'unknown') as ModelEvidence,
    billingMode: (asString(row.billing_mode) ?? 'unknown') as BillingMode,
    status: (asString(row.status) ?? 'unknown') as RequestStatus,
    inputTokens: asNumber(row.input_tokens),
    cachedInputTokens: asNumber(row.cached_input_tokens),
    outputTokens: asNumber(row.output_tokens),
    reasoningOutputTokens: asNumber(row.reasoning_output_tokens),
    totalTokens: asNumber(row.total_tokens),
    modelContextWindow: asNumber(row.model_context_window),
    estimatedApiCostUsd: asString(row.estimated_api_cost_usd),
    reportedCostUsd: asString(row.reported_cost_usd),
    conversationId: asString(row.conversation_id),
    accountScopeKey: asString(row.account_scope_key) ?? '',
    accountConfidence: (asString(row.account_confidence) ?? 'unknown') as RequestRowSource['accountConfidence'],
  }
}

function computeTotals(
  db: Database,
  filter: BoundFilter,
  costCol: string,
): { totals: CodexTotals; coverage: CodexCoverage } {
  const row = queryOne(
    db,
    `SELECT
       COUNT(*) AS requests,
       COALESCE(SUM(r.input_tokens), 0) AS input_tokens,
       COALESCE(SUM(r.output_tokens), 0) AS output_tokens,
       COALESCE(SUM(r.total_tokens), 0) AS total_tokens,
       SUM(CASE WHEN ${costCol} IS NOT NULL AND ${costCol} != '' THEN CAST(${costCol} AS REAL) ELSE 0 END) AS cost_sum,
       SUM(CASE WHEN ${costCol} IS NOT NULL AND ${costCol} != '' THEN 1 ELSE 0 END) AS priced,
       SUM(CASE WHEN r.input_tokens IS NULL AND r.output_tokens IS NULL THEN 1 ELSE 0 END) AS missing_usage,
       SUM(CASE WHEN r.account_scope_key LIKE 'unknown-source:%' THEN 1 ELSE 0 END) AS missing_account
     FROM requests r
     WHERE ${filter.sql}`,
    filter.params,
  )
  const requests = asNumber(row?.requests) ?? 0
  const priced = asNumber(row?.priced) ?? 0
  const missingUsage = asNumber(row?.missing_usage) ?? 0
  const costSum = asNumber(row?.cost_sum)
  return {
    totals: {
      requests,
      inputTokens: asNumber(row?.input_tokens) ?? 0,
      outputTokens: asNumber(row?.output_tokens) ?? 0,
      totalTokens: asNumber(row?.total_tokens) ?? 0,
      costUsd: priced > 0 ? costSum : null,
    },
    coverage: {
      priced,
      pricedDenom: requests,
      missingUsage,
      missingAccount: asNumber(row?.missing_account) ?? 0,
      partial: priced < requests || missingUsage > 0,
    },
  }
}

function lastSyncAt(db: Database): string | null {
  const row = queryOne(
    db,
    `SELECT MAX(last_scan_at) AS last_scan_at FROM source_instances`,
  )
  return asString(row?.last_scan_at)
}

function runFlatPage(
  db: Database,
  query: CodexQuery,
  filter: BoundFilter,
  options: CodexQueryOptions,
): { rows: CodexRow[]; nextCursor: string | null } {
  const costCol = costColumnSql(query.costBasis)
  const cursor = decodeCursor(query.cursor, query.sort)
  const params = [...filter.params]
  let where = filter.sql
  if (cursor !== null) {
    const ks = keysetClause(query.sort, costCol, cursor)
    where = `${where} AND ${ks.sql}`
    params.push(...ks.params)
  }
  const sql = `
    SELECT r.*, c.title AS conversation_title
    FROM requests r
    LEFT JOIN conversations c
      ON c.provider = r.provider
     AND c.account_scope_key = r.account_scope_key
     AND c.conversation_id = r.conversation_id
    WHERE ${where}
    ORDER BY ${orderClause(query.sort, costCol)}
    LIMIT ?`
  params.push(query.limit + 1)
  const fetched = queryAll(db, sql, params)
  const hasMore = fetched.length > query.limit
  const page = hasMore ? fetched.slice(0, query.limit) : fetched
  const showSpike = options.showSpikeWarning !== false
  const rows = page.map((row) =>
    mapRequestRow({
      ...mapSqlRequest(row),
      conversationTitle: asString(row.conversation_title),
    }, {
      costBasis: query.costBasis,
      spikeTokenThreshold: options.spikeTokenThreshold,
      showSpike,
    }),
  )
  let nextCursor: string | null = null
  if (hasMore) {
    const last = page[page.length - 1]!
    const source = mapSqlRequest(last)
    const money = moneyForBasis(source, query.costBasis)
    const v =
      query.sort === 'time-desc'
        ? source.observedAt
        : query.sort === 'tokens-desc'
          ? source.totalTokens
          : query.sort === 'input-desc'
            ? source.inputTokens
            : money
    nextCursor = encodeCursor({ sort: query.sort, v, id: source.id })
  }
  return { rows, nextCursor }
}

function runGroupedPage(
  db: Database,
  query: CodexQuery,
  filter: BoundFilter,
  options: CodexQueryOptions,
): { rows: CodexRow[]; nextCursor: string | null } {
  const costCol = costColumnSql(query.costBasis)
  // Aggregate all matching groups in SQL, then keyset-page in memory by sort tuple.
  const sql = `
    SELECT
      c.provider AS provider,
      c.account_scope_key AS account_scope_key,
      c.conversation_id AS conversation_id,
      c.title AS title,
      c.turn_count AS turn_count,
      COUNT(r.id) AS request_count,
      MIN(r.observed_at) AS first_observed_at,
      MAX(r.observed_at) AS last_observed_at,
      COUNT(DISTINCT CASE WHEN r.model IS NOT NULL AND r.model != '' THEN r.model END) AS model_count,
      MIN(CASE WHEN r.model IS NOT NULL AND r.model != '' THEN r.model END) AS single_model,
      COUNT(DISTINCT r.billing_mode) AS billing_mode_count,
      MIN(r.billing_mode) AS single_billing_mode,
      SUM(r.input_tokens) AS input_tokens,
      SUM(r.cached_input_tokens) AS cached_input_tokens,
      SUM(r.output_tokens) AS output_tokens,
      SUM(r.reasoning_output_tokens) AS reasoning_output_tokens,
      SUM(r.total_tokens) AS total_tokens,
      MAX(r.total_tokens) AS max_request_tokens,
      SUM(CASE WHEN ${costCol} IS NOT NULL AND ${costCol} != '' THEN 1 ELSE 0 END) AS priced,
      COUNT(r.id) AS priced_denom,
      SUM(CASE WHEN r.input_tokens IS NULL AND r.output_tokens IS NULL THEN 1 ELSE 0 END) AS missing_usage,
      SUM(CASE WHEN ${costCol} IS NOT NULL AND ${costCol} != '' THEN CAST(${costCol} AS REAL) ELSE 0 END) AS cost_sum,
      SUM(CASE WHEN ${costCol} IS NOT NULL AND ${costCol} != '' THEN 1 ELSE 0 END) AS priced_n,
      (
        SELECT rr.input_tokens
        FROM requests rr
        WHERE rr.provider = c.provider
          AND rr.account_scope_key = c.account_scope_key
          AND rr.conversation_id = c.conversation_id
          AND rr.input_tokens IS NOT NULL
        ORDER BY rr.observed_at DESC, rr.id DESC
        LIMIT 1
      ) AS context_input_tokens,
      (
        SELECT rr.model
        FROM requests rr
        WHERE rr.provider = c.provider
          AND rr.account_scope_key = c.account_scope_key
          AND rr.conversation_id = c.conversation_id
          AND rr.model IS NOT NULL
          AND rr.model != ''
        ORDER BY rr.observed_at DESC, rr.id DESC
        LIMIT 1
      ) AS context_model,
      (
        SELECT rr.model_context_window
        FROM requests rr
        WHERE rr.provider = c.provider
          AND rr.account_scope_key = c.account_scope_key
          AND rr.conversation_id = c.conversation_id
          AND rr.input_tokens IS NOT NULL
        ORDER BY rr.observed_at DESC, rr.id DESC
        LIMIT 1
      ) AS context_window_tokens
    FROM conversations c
    INNER JOIN requests r
      ON r.provider = c.provider
     AND r.account_scope_key = c.account_scope_key
     AND r.conversation_id = c.conversation_id
    WHERE ${filter.sql}
    GROUP BY c.provider, c.account_scope_key, c.conversation_id, c.title, c.turn_count
  `
  const aggregates = queryAll(db, sql, filter.params).map((row): GroupAggregate & { sortKey: string | number | null; sortId: string } => {
    const priced = asNumber(row.priced) ?? 0
    const pricedDenom = asNumber(row.priced_denom) ?? 0
    const costSumRaw = asNumber(row.cost_sum)
    const costSum =
      priced > 0 && costSumRaw !== null ? costSumRaw.toFixed(6) : null
    const accountScopeKey = asString(row.account_scope_key) ?? ''
    const conversationId = asString(row.conversation_id) ?? ''
    const provider = asString(row.provider) ?? 'openai'
    const lastAt = asString(row.last_observed_at) ?? ''
    const totalTokens = asNumber(row.total_tokens)
    const group: GroupAggregate = {
      provider,
      accountScopeKey,
      conversationId,
      title: asString(row.title) ?? '',
      turnCount: asNumber(row.turn_count),
      requestCount: asNumber(row.request_count) ?? 0,
      firstObservedAt: asString(row.first_observed_at) ?? '',
      lastObservedAt: lastAt,
      modelCount: asNumber(row.model_count) ?? 0,
      singleModel: asString(row.single_model),
      billingModeCount: asNumber(row.billing_mode_count) ?? 0,
      singleBillingMode: (asString(row.single_billing_mode) ??
        'unknown') as BillingMode,
      inputTokens: asNumber(row.input_tokens),
      cachedInputTokens: asNumber(row.cached_input_tokens),
      outputTokens: asNumber(row.output_tokens),
      reasoningOutputTokens: asNumber(row.reasoning_output_tokens),
      totalTokens,
      priced,
      pricedDenom,
      missingUsage: asNumber(row.missing_usage) ?? 0,
      costSum,
      contextInputTokens: asNumber(row.context_input_tokens),
      contextModel: asString(row.context_model),
      contextWindowTokens: asNumber(row.context_window_tokens),
      maxRequestTokens: asNumber(row.max_request_tokens),
    }
    const sortId = `${provider}\0${accountScopeKey}\0${conversationId}`
    const sortKey =
      query.sort === 'time-desc'
        ? lastAt
        : query.sort === 'tokens-desc'
          ? totalTokens
          : query.sort === 'input-desc'
            ? asNumber(row.input_tokens)
            : costSum
    return { ...group, sortKey, sortId }
  })
  const folded = foldUntitledHourGroups(aggregates).map((group) => ({
    ...group,
    sortId: `${group.provider}\0${group.accountScopeKey}\0${group.conversationId}`,
    sortKey:
      query.sort === 'time-desc'
        ? group.lastObservedAt
        : query.sort === 'tokens-desc'
          ? group.totalTokens
          : query.sort === 'input-desc'
            ? group.inputTokens
            : group.costSum,
  }))

  folded.sort((a, b) => {
    const av = a.sortKey
    const bv = b.sortKey
    if (query.sort === 'time-desc') {
      const cmp = String(bv ?? '').localeCompare(String(av ?? ''))
      return cmp !== 0 ? cmp : b.sortId.localeCompare(a.sortId)
    }
    if (query.sort === 'tokens-desc' || query.sort === 'input-desc') {
      const an = av === null ? Number.NEGATIVE_INFINITY : Number(av)
      const bn = bv === null ? Number.NEGATIVE_INFINITY : Number(bv)
      if (bn !== an) {
        return bn - an
      }
      return b.sortId.localeCompare(a.sortId)
    }
    // cost-desc, nulls last
    const aNull = av === null
    const bNull = bv === null
    if (aNull !== bNull) {
      return aNull ? 1 : -1
    }
    if (!aNull && !bNull) {
      const diff = Number(bv) - Number(av)
      if (diff !== 0) {
        return diff
      }
    }
    return b.sortId.localeCompare(a.sortId)
  })

  const cursor = decodeCursor(query.cursor, query.sort)
  let start = 0
  if (cursor !== null) {
    const idx = folded.findIndex((g) => g.sortId === cursor.id)
    start = idx >= 0 ? idx + 1 : folded.length
  }
  const page = folded.slice(start, start + query.limit)
  const hasMore = start + query.limit < folded.length
  const showSpike = options.showSpikeWarning !== false
  const rows = page.map((g) =>
    mapGroupRow(g, {
      costBasis: query.costBasis,
      spikeTokenThreshold: options.spikeTokenThreshold,
      showSpike,
    }),
  )
  let nextCursor: string | null = null
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1]!
    nextCursor = encodeCursor({
      sort: query.sort,
      v: last.sortKey,
      id: last.sortId,
    })
  }
  return { rows, nextCursor }
}

export function runCodexQuery(
  store: RequestStore,
  query: CodexQuery,
  options: CodexQueryOptions,
): CodexPage {
  const db = getDb(store)
  const filter = buildRequestFilters(query)
  const costCol = costColumnSql(query.costBasis)
  const { totals, coverage } = computeTotals(db, filter, costCol)
  const page =
    query.groupBy === 'conversation'
      ? runGroupedPage(db, query, filter, options)
      : runFlatPage(db, query, filter, options)
  return {
    correlationId: query.correlationId,
    filterRevision: query.filterRevision,
    rows: page.rows,
    nextCursor: page.nextCursor,
    totals,
    coverage,
    lastSyncAt: lastSyncAt(db),
  }
}

export function listCodexChildren(
  store: RequestStore,
  input: {
    conversationId: string
    accountScopeKey: string
    costBasis: CodexCostBasis
    spikeTokenThreshold: number
    showSpikeWarning?: boolean
  },
): CodexRow[] {
  const db = getDb(store)
  const members = hourBucketMembers(input.conversationId)
  const rows =
    members === null
      ? queryAll(
          db,
          `SELECT r.*, c.title AS conversation_title
           FROM requests r
           LEFT JOIN conversations c
             ON c.provider = r.provider
            AND c.account_scope_key = r.account_scope_key
            AND c.conversation_id = r.conversation_id
           WHERE r.account_scope_key = ?
             AND r.conversation_id = ?
             AND EXISTS (
               SELECT 1 FROM request_observations o
               WHERE o.request_id = r.id AND o.attributes_spend = 1
             )
           ORDER BY r.observed_at DESC, r.id DESC`,
          [input.accountScopeKey, input.conversationId],
        )
      : members.length === 0
        ? []
        : queryAll(
            db,
            `SELECT r.*, c.title AS conversation_title
             FROM requests r
             LEFT JOIN conversations c
               ON c.provider = r.provider
              AND c.account_scope_key = r.account_scope_key
              AND c.conversation_id = r.conversation_id
             WHERE r.account_scope_key = ?
               AND r.conversation_id IN (${members.map(() => '?').join(', ')})
               AND EXISTS (
                 SELECT 1 FROM request_observations o
                 WHERE o.request_id = r.id AND o.attributes_spend = 1
               )
             ORDER BY r.observed_at DESC, r.id DESC`,
            [input.accountScopeKey, ...members],
          )
  const showSpike = input.showSpikeWarning !== false
  return rows.map((row) =>
    mapRequestRow({
      ...mapSqlRequest(row),
      conversationTitle: asString(row.conversation_title),
    }, {
      costBasis: input.costBasis,
      spikeTokenThreshold: input.spikeTokenThreshold,
      showSpike,
    }),
  )
}

export function loadCodexDetails(
  store: RequestStore,
  requestId: string,
  costBasis: CodexCostBasis,
): CodexDetailFields | null {
  if (isUnsafeString(requestId)) {
    return null
  }
  const row = queryOne(getDb(store), `SELECT * FROM requests WHERE id = ?`, [
    requestId,
  ])
  if (row === null) {
    return null
  }
  const source: CodexDetailSource = {
    source: asString(row.source) ?? 'codex-local',
    deviceId: asString(row.device_id) ?? '',
    accountScopeKey: asString(row.account_scope_key) ?? '',
    accountConfidence: (asString(row.account_confidence) ??
      'unknown') as CodexDetailSource['accountConfidence'],
    conversationId: asString(row.conversation_id),
    sessionId: asString(row.session_id),
    turnId: asString(row.turn_id),
    responseId: asString(row.response_id),
    usageQuality: (asString(row.usage_quality) ??
      'missing') as CodexDetailSource['usageQuality'],
    inputTokens: asNumber(row.input_tokens),
    cachedInputTokens: asNumber(row.cached_input_tokens),
    outputTokens: asNumber(row.output_tokens),
    reasoningOutputTokens: asNumber(row.reasoning_output_tokens),
    totalTokens: asNumber(row.total_tokens),
    estimatedApiCostUsd: asString(row.estimated_api_cost_usd),
    reportedCostUsd: asString(row.reported_cost_usd),
    billingMode: (asString(row.billing_mode) ?? 'unknown') as BillingMode,
    modelEvidence: (asString(row.model_evidence) ?? 'unknown') as ModelEvidence,
    pricingVersion: asString(row.pricing_version),
    costCoverage: (asString(row.cost_coverage) ??
      'unknown') as CodexDetailSource['costCoverage'],
    status: (asString(row.status) ?? 'unknown') as RequestStatus,
    errorCode: asString(row.error_code),
    observedAt: asString(row.observed_at) ?? '',
    startedAt: asString(row.started_at),
    completedAt: asString(row.completed_at),
  }
  return mapRequestDetails(source, costBasis)
}

export function collectCodexCsvRows(
  store: RequestStore,
  query: Omit<CodexQuery, 'groupBy' | 'cursor' | 'limit'> & {
    limit?: number
  },
): CodexCsvSourceRow[] {
  const flatQuery: CodexQuery = {
    ...query,
    groupBy: 'none',
    cursor: null,
    limit: 100,
  }
  const db = getDb(store)
  const filter = buildRequestFilters(flatQuery)
  const rows = queryAll(
    db,
    `SELECT r.*, c.title AS conversation_title
     FROM requests r
     LEFT JOIN conversations c
       ON c.provider = r.provider
      AND c.account_scope_key = r.account_scope_key
      AND c.conversation_id = r.conversation_id
     WHERE ${filter.sql}
     ORDER BY r.observed_at DESC, r.id DESC`,
    filter.params,
  )
  return rows.map((row) => ({
    source: asString(row.source) ?? '',
    deviceId: asString(row.device_id) ?? '',
    accountScopeKey: asString(row.account_scope_key) ?? '',
    accountConfidence: asString(row.account_confidence) ?? '',
    conversationId: asString(row.conversation_id),
    conversationTitle: asString(row.conversation_title),
    turnId: asString(row.turn_id),
    responseId: asString(row.response_id),
    observedAt: asString(row.observed_at) ?? '',
    model: asString(row.model),
    modelEvidence: asString(row.model_evidence) ?? '',
    status: asString(row.status) ?? '',
    inputTokens: asNumber(row.input_tokens),
    cachedInputTokens: asNumber(row.cached_input_tokens),
    outputTokens: asNumber(row.output_tokens),
    reasoningOutputTokens: asNumber(row.reasoning_output_tokens),
    totalTokens: asNumber(row.total_tokens),
    estimatedApiCostUsd: asString(row.estimated_api_cost_usd),
    reportedCostUsd: asString(row.reported_cost_usd),
    billingMode: asString(row.billing_mode) ?? '',
    pricingVersion: asString(row.pricing_version),
    usageQuality: asString(row.usage_quality) ?? '',
    costCoverage: asString(row.cost_coverage) ?? '',
  }))
}
