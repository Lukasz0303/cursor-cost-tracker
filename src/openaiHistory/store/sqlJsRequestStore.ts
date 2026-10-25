import { rename as fsRename, readFile as fsReadFile, unlink as fsUnlink, writeFile as fsWriteFile } from 'node:fs/promises'
import type { Database, SqlJsStatic, SqlValue } from 'sql.js'
import type { CostCoverage, ParserContext, RequestStatus } from '../domain'
import { isGeneratedThreadTitle } from '../ids'
import { migrateSchema } from './migrations'
import type {
  Checkpoint,
  ImportBatch,
  ImportBatchConversation,
  ImportBatchRequest,
  RequestStore,
  StoreFileIo,
} from './types'

const FORBIDDEN_BATCH_KEYS = new Set(['prompt', 'text', 'arguments'])

const TERMINAL_STATUSES = new Set<RequestStatus>([
  'completed',
  'failed',
  'cancelled',
  'incomplete',
])

function defaultFileIo(): StoreFileIo {
  return {
    async writeFile(path, data) {
      await fsWriteFile(path, data)
    },
    async rename(from, to) {
      await fsRename(from, to)
    },
    async unlink(path) {
      await fsUnlink(path)
    },
    async readFile(path) {
      try {
        const buf = await fsReadFile(path)
        return new Uint8Array(buf)
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code: unknown }).code === 'ENOENT'
        ) {
          return null
        }
        throw error
      }
    },
  }
}

function assertNoForbiddenFields(value: unknown, path: string): void {
  if (value === null || value === undefined) {
    return
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      assertNoForbiddenFields(value[i], `${path}[${i}]`)
    }
    return
  }
  if (typeof value !== 'object') {
    return
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_BATCH_KEYS.has(key)) {
      throw new Error(`ImportBatch must not include field "${key}"`)
    }
    if (child instanceof Uint8Array) {
      continue
    }
    assertNoForbiddenFields(child, `${path}.${key}`)
  }
}

function hasAnyTokens(request: ImportBatchRequest): boolean {
  return (
    request.inputTokens !== null ||
    request.cachedInputTokens !== null ||
    request.cacheWriteInputTokens !== null ||
    request.outputTokens !== null ||
    request.reasoningOutputTokens !== null ||
    request.totalTokens !== null
  )
}

function costCoverageFor(request: ImportBatchRequest): CostCoverage {
  return hasAnyTokens(request) ? 'tokens-only' : 'unknown'
}

function mergeStatus(
  existing: RequestStatus,
  incoming: RequestStatus,
): RequestStatus {
  if (TERMINAL_STATUSES.has(existing) && incoming === 'unknown') {
    return existing
  }
  if (existing === 'unknown' && TERMINAL_STATUSES.has(incoming)) {
    return incoming
  }
  if (TERMINAL_STATUSES.has(existing) && TERMINAL_STATUSES.has(incoming)) {
    return incoming
  }
  return incoming === 'unknown' ? existing : incoming
}

function pickNonNull<T>(incoming: T, existing: T): T {
  return incoming !== null && incoming !== undefined ? incoming : existing
}

function queryOne(
  db: Database,
  sql: string,
  params: SqlValue[] = [],
): Record<string, SqlValue> | null {
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

function asString(value: SqlValue | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: SqlValue | undefined): number | null {
  return typeof value === 'number' ? value : null
}

function parseParserContext(raw: string): ParserContext {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('invalid parser_context')
  }
  return parsed as ParserContext
}

function upsertInstance(db: Database, batch: ImportBatch): void {
  const { instance } = batch
  const unrecognized = Math.max(0, batch.unrecognizedDelta)
  const ignored = Math.max(0, batch.ignoredDelta ?? 0)
  const existing = queryOne(
    db,
    `SELECT unrecognized_lines, ignored_lines, parser_version
     FROM source_instances WHERE id = ?`,
    [instance.id],
  )
  if (existing === null) {
    db.run(
      `INSERT INTO source_instances(
        id, provider, root_realpath, device_id, last_scan_at, parser_version,
        unrecognized_lines, ignored_lines
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        instance.id,
        instance.provider,
        instance.rootRealpath,
        instance.deviceId,
        instance.lastScanAt,
        instance.parserVersion,
        unrecognized,
        ignored,
      ],
    )
    return
  }
  const versionChanged = asString(existing.parser_version) !== instance.parserVersion
  const prevUnrecognized = versionChanged
    ? 0
    : (asNumber(existing.unrecognized_lines) ?? 0)
  const prevIgnored = versionChanged ? 0 : (asNumber(existing.ignored_lines) ?? 0)
  db.run(
    `UPDATE source_instances SET
      provider = ?,
      root_realpath = ?,
      device_id = ?,
      last_scan_at = ?,
      parser_version = ?,
      unrecognized_lines = ?,
      ignored_lines = ?
    WHERE id = ?`,
    [
      instance.provider,
      instance.rootRealpath,
      instance.deviceId,
      instance.lastScanAt,
      instance.parserVersion,
      prevUnrecognized + unrecognized,
      prevIgnored + ignored,
      instance.id,
    ],
  )
}

function upsertFile(db: Database, batch: ImportBatch): void {
  const { file } = batch
  const byId = queryOne(db, 'SELECT id FROM source_files WHERE id = ?', [file.id])
  if (byId !== null) {
    db.run(
      `UPDATE source_files SET
        source_instance_id = ?,
        absolute_path = ?,
        generation = ?,
        size_bytes = ?,
        mtime_ms = ?,
        prefix_fingerprint = ?
      WHERE id = ?`,
      [
        file.sourceInstanceId,
        file.absolutePath,
        file.generation,
        file.sizeBytes,
        file.mtimeMs,
        file.prefixFingerprint,
        file.id,
      ],
    )
    return
  }
  const byPath = queryOne(
    db,
    `SELECT id FROM source_files
     WHERE source_instance_id = ? AND absolute_path = ?`,
    [file.sourceInstanceId, file.absolutePath],
  )
  if (byPath !== null) {
    db.run(
      `UPDATE source_files SET
        generation = ?,
        size_bytes = ?,
        mtime_ms = ?,
        prefix_fingerprint = ?
      WHERE id = ?`,
      [
        file.generation,
        file.sizeBytes,
        file.mtimeMs,
        file.prefixFingerprint,
        asString(byPath.id),
      ],
    )
    return
  }
  db.run(
    `INSERT INTO source_files(
      id, source_instance_id, absolute_path, generation, size_bytes, mtime_ms, prefix_fingerprint
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      file.id,
      file.sourceInstanceId,
      file.absolutePath,
      file.generation,
      file.sizeBytes,
      file.mtimeMs,
      file.prefixFingerprint,
    ],
  )
}

function upsertCheckpoint(db: Database, checkpoint: Checkpoint): void {
  db.run(
    `INSERT INTO import_checkpoints(
      source_file_id, generation, byte_offset, partial_bytes, parser_context
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(source_file_id) DO UPDATE SET
      generation = excluded.generation,
      byte_offset = excluded.byte_offset,
      partial_bytes = excluded.partial_bytes,
      parser_context = excluded.parser_context`,
    [
      checkpoint.sourceFileId,
      checkpoint.generation,
      checkpoint.byteOffset,
      checkpoint.partialBytes,
      JSON.stringify(checkpoint.parserContext),
    ],
  )
}

function upsertConversation(db: Database, row: ImportBatchConversation): void {
  if (row.accountScopeKey === '') {
    throw new Error('account_scope_key must not be null or empty')
  }
  const existing = queryOne(
    db,
    `SELECT id, parent_conversation_id, title, turn_count, first_observed_at, last_observed_at
     FROM conversations
     WHERE provider = ? AND account_scope_key = ? AND conversation_id = ?`,
    [row.provider, row.accountScopeKey, row.conversationId],
  )
  if (existing === null) {
    db.run(
      `INSERT INTO conversations(
        id, provider, account_scope_key, conversation_id, parent_conversation_id,
        title, turn_count, first_observed_at, last_observed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.provider,
        row.accountScopeKey,
        row.conversationId,
        row.parentConversationId,
        row.title,
        row.turnCount,
        row.firstObservedAt,
        row.lastObservedAt,
      ],
    )
    return
  }
  const firstObserved =
    asString(existing.first_observed_at) !== null &&
    asString(existing.first_observed_at)! < row.firstObservedAt
      ? asString(existing.first_observed_at)!
      : row.firstObservedAt
  const lastObserved =
    asString(existing.last_observed_at) !== null &&
    asString(existing.last_observed_at)! > row.lastObservedAt
      ? asString(existing.last_observed_at)!
      : row.lastObservedAt
  const turnCount =
    row.turnCount === null
      ? asNumber(existing.turn_count)
      : Math.max(asNumber(existing.turn_count) ?? 0, row.turnCount)
  const existingTitle = asString(existing.title) ?? ''
  const keepIndexedTitle =
    isGeneratedThreadTitle(row.title, row.conversationId) &&
    existingTitle !== '' &&
    !isGeneratedThreadTitle(existingTitle, row.conversationId)
  const title = keepIndexedTitle ? existingTitle : row.title || existingTitle
  db.run(
    `UPDATE conversations SET
      parent_conversation_id = COALESCE(?, parent_conversation_id),
      title = ?,
      turn_count = ?,
      first_observed_at = ?,
      last_observed_at = ?
    WHERE id = ?`,
    [
      row.parentConversationId,
      title,
      turnCount,
      firstObserved,
      lastObserved,
      asString(existing.id),
    ],
  )
}

function findExistingRequest(
  db: Database,
  request: ImportBatchRequest,
): Record<string, SqlValue> | null {
  if (request.responseId !== null && request.responseId !== '') {
    return queryOne(
      db,
      `SELECT * FROM requests
       WHERE provider = ? AND account_scope_key = ? AND response_id = ?`,
      [request.provider, request.accountScopeKey, request.responseId],
    )
  }
  if (request.provisionalKey !== null && request.provisionalKey !== '') {
    return queryOne(db, `SELECT * FROM requests WHERE provisional_key = ?`, [
      request.provisionalKey,
    ])
  }
  return null
}

function insertRequest(db: Database, request: ImportBatchRequest): void {
  const coverage = costCoverageFor(request)
  db.run(
    `INSERT INTO requests(
      id, provider, source, account_scope_key, account_confidence,
      conversation_id, session_id, turn_id, response_id, provisional_key,
      observed_at, started_at, completed_at, model, model_evidence,
      billing_mode, status, error_code,
      input_tokens, cached_input_tokens, cache_write_input_tokens,
      output_tokens, reasoning_output_tokens, total_tokens, model_context_window,
      usage_quality, usage_anomaly, estimated_api_cost_usd, reported_cost_usd,
      pricing_version, cost_coverage, device_id, source_instance_id
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )`,
    [
      request.id,
      request.provider,
      request.source,
      request.accountScopeKey,
      request.accountConfidence,
      request.conversationId,
      request.sessionId,
      request.turnId,
      request.responseId,
      request.provisionalKey,
      request.observedAt,
      request.startedAt,
      request.completedAt,
      request.model,
      request.modelEvidence,
      request.billingMode,
      request.status,
      request.errorCode,
      request.inputTokens,
      request.cachedInputTokens,
      request.cacheWriteInputTokens,
      request.outputTokens,
      request.reasoningOutputTokens,
      request.totalTokens,
      request.modelContextWindow ?? null,
      request.usageQuality,
      request.usageAnomaly ? 1 : 0,
      null,
      null,
      request.pricingVersion,
      coverage,
      request.deviceId,
      request.sourceInstanceId,
    ],
  )
}

function updateRequest(
  db: Database,
  existing: Record<string, SqlValue>,
  request: ImportBatchRequest,
): void {
  const existingStatus = (asString(existing.status) ?? 'unknown') as RequestStatus
  const status = mergeStatus(existingStatus, request.status)
  const inputTokens = pickNonNull(request.inputTokens, asNumber(existing.input_tokens))
  const cachedInputTokens = pickNonNull(
    request.cachedInputTokens,
    asNumber(existing.cached_input_tokens),
  )
  const cacheWriteInputTokens = pickNonNull(
    request.cacheWriteInputTokens,
    asNumber(existing.cache_write_input_tokens),
  )
  const outputTokens = pickNonNull(request.outputTokens, asNumber(existing.output_tokens))
  const reasoningOutputTokens = pickNonNull(
    request.reasoningOutputTokens,
    asNumber(existing.reasoning_output_tokens),
  )
  const totalTokens = pickNonNull(request.totalTokens, asNumber(existing.total_tokens))
  const mergedForCoverage: ImportBatchRequest = {
    ...request,
    inputTokens,
    cachedInputTokens,
    cacheWriteInputTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens,
  }
  const coverage = costCoverageFor(mergedForCoverage)
  const existingCoverage = asString(existing.cost_coverage)
  const nextCoverage =
    coverage === 'tokens-only' || existingCoverage === 'tokens-only'
      ? 'tokens-only'
      : coverage

  db.run(
    `UPDATE requests SET
      conversation_id = COALESCE(?, conversation_id),
      session_id = COALESCE(?, session_id),
      turn_id = COALESCE(?, turn_id),
      response_id = COALESCE(?, response_id),
      provisional_key = COALESCE(?, provisional_key),
      started_at = COALESCE(?, started_at),
      completed_at = COALESCE(?, completed_at),
      model = COALESCE(?, model),
      model_evidence = CASE WHEN ? IS NOT NULL THEN ? ELSE model_evidence END,
      billing_mode = CASE WHEN ? IS NOT NULL AND ? != 'unknown' THEN ? ELSE billing_mode END,
      status = ?,
      error_code = COALESCE(?, error_code),
      input_tokens = ?,
      cached_input_tokens = ?,
      cache_write_input_tokens = ?,
      output_tokens = ?,
      reasoning_output_tokens = ?,
      total_tokens = ?,
      model_context_window = COALESCE(?, model_context_window),
      usage_quality = CASE WHEN ? IS NOT NULL THEN ? ELSE usage_quality END,
      usage_anomaly = CASE WHEN ? = 1 THEN 1 ELSE usage_anomaly END,
      cost_coverage = ?,
      device_id = COALESCE(?, device_id),
      source_instance_id = COALESCE(?, source_instance_id)
    WHERE id = ?`,
    [
      request.conversationId,
      request.sessionId,
      request.turnId,
      request.responseId,
      request.provisionalKey,
      request.startedAt,
      request.completedAt,
      request.model,
      request.model,
      request.modelEvidence,
      request.billingMode,
      request.billingMode,
      request.billingMode,
      status,
      request.errorCode,
      inputTokens,
      cachedInputTokens,
      cacheWriteInputTokens,
      outputTokens,
      reasoningOutputTokens,
      totalTokens,
      request.modelContextWindow ?? null,
      request.usageQuality,
      request.usageQuality,
      request.usageAnomaly ? 1 : 0,
      nextCoverage,
      request.deviceId,
      request.sourceInstanceId,
      asString(existing.id),
    ],
  )
}

function upsertRequest(db: Database, request: ImportBatchRequest): void {
  if (request.accountScopeKey === null || request.accountScopeKey === '') {
    throw new Error('account_scope_key must not be null or empty')
  }
  const existing = findExistingRequest(db, request)
  if (existing === null) {
    insertRequest(db, request)
    return
  }
  updateRequest(db, existing, request)
}

function insertObservation(
  db: Database,
  observation: ImportBatch['observations'][number],
): void {
  db.run(
    `INSERT INTO request_observations(
      id, request_id, source_file_id, generation, byte_offset, observed_at, attributes_spend
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_file_id, generation, byte_offset) DO NOTHING`,
    [
      observation.id,
      observation.requestId,
      observation.sourceFileId,
      observation.generation,
      observation.byteOffset,
      observation.observedAt,
      observation.attributesSpend,
    ],
  )
}

function insertSnapshot(
  db: Database,
  snapshot: ImportBatch['snapshots'][number],
): void {
  db.run(
    `INSERT INTO usage_snapshots(
      id, source_file_id, generation, byte_offset, conversation_id, observed_at,
      input_tokens, cached_input_tokens, cache_write_input_tokens,
      output_tokens, reasoning_output_tokens, total_tokens, gap
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_file_id, generation, byte_offset) DO NOTHING`,
    [
      snapshot.id,
      snapshot.sourceFileId,
      snapshot.generation,
      snapshot.byteOffset,
      snapshot.conversationId,
      snapshot.observedAt,
      snapshot.inputTokens,
      snapshot.cachedInputTokens,
      snapshot.cacheWriteInputTokens,
      snapshot.outputTokens,
      snapshot.reasoningOutputTokens,
      snapshot.totalTokens,
      snapshot.gap,
    ],
  )
}

function insertRateLimit(
  db: Database,
  sample: NonNullable<ImportBatch['rateLimits']>[number],
): void {
  db.run(
    `INSERT INTO rate_limit_samples(
      id, source_file_id, generation, byte_offset, observed_at,
      plan_type, limit_id,
      primary_used_percent, primary_window_minutes, primary_resets_at,
      secondary_used_percent, secondary_window_minutes, secondary_resets_at,
      credits_has_credits, credits_unlimited, credits_balance,
      rate_limit_reached_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_file_id, generation, byte_offset) DO UPDATE SET
      observed_at = excluded.observed_at,
      plan_type = excluded.plan_type,
      limit_id = excluded.limit_id,
      primary_used_percent = excluded.primary_used_percent,
      primary_window_minutes = excluded.primary_window_minutes,
      primary_resets_at = excluded.primary_resets_at,
      secondary_used_percent = excluded.secondary_used_percent,
      secondary_window_minutes = excluded.secondary_window_minutes,
      secondary_resets_at = excluded.secondary_resets_at,
      credits_has_credits = excluded.credits_has_credits,
      credits_unlimited = excluded.credits_unlimited,
      credits_balance = excluded.credits_balance,
      rate_limit_reached_type = excluded.rate_limit_reached_type`,
    [
      sample.id,
      sample.sourceFileId,
      sample.generation,
      sample.byteOffset,
      sample.observedAt,
      sample.planType,
      sample.limitId,
      sample.primaryUsedPercent,
      sample.primaryWindowMinutes,
      sample.primaryResetsAt,
      sample.secondaryUsedPercent,
      sample.secondaryWindowMinutes,
      sample.secondaryResetsAt,
      sample.creditsHasCredits,
      sample.creditsUnlimited,
      sample.creditsBalance,
      sample.rateLimitReachedType,
    ],
  )
}

function applyBatchInTransaction(db: Database, batch: ImportBatch): void {
  assertNoForbiddenFields(batch, 'batch')
  db.run('BEGIN')
  try {
    upsertInstance(db, batch)
    upsertFile(db, batch)
    for (const conversation of batch.conversations) {
      upsertConversation(db, conversation)
    }
    const requestIdByBatchId = new Map<string, string>()
    for (const request of batch.requests) {
      upsertRequest(db, request)
      const stored = findExistingRequest(db, request)
      requestIdByBatchId.set(
        request.id,
        stored !== null ? (asString(stored.id) ?? request.id) : request.id,
      )
    }
    for (const observation of batch.observations) {
      const requestId =
        requestIdByBatchId.get(observation.requestId) ?? observation.requestId
      insertObservation(db, { ...observation, requestId })
    }
    for (const snapshot of batch.snapshots) {
      insertSnapshot(db, snapshot)
    }
    for (const sample of batch.rateLimits ?? []) {
      insertRateLimit(db, sample)
    }
    const learned = batch.checkpoint.parserContext.billingMode
    if (learned === 'api' || learned === 'chatgpt-plan') {
      db.run(
        `UPDATE requests
         SET billing_mode = ?
         WHERE billing_mode = 'unknown'
           AND id IN (
             SELECT request_id FROM request_observations WHERE source_file_id = ?
           )`,
        [learned, batch.file.id],
      )
    }
    upsertCheckpoint(db, batch.checkpoint)
    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

class SqlJsRequestStore implements RequestStore {
  private db: Database
  private leaseRole: 'writer' | 'reader' = 'writer'
  private closed = false

  constructor(
    private readonly sql: SqlJsStatic,
    bytes: Uint8Array | null,
    private readonly fileIo: StoreFileIo,
  ) {
    this.db = bytes === null ? new sql.Database() : new sql.Database(bytes)
    migrateSchema(this.db)
  }

  setLeaseRole(role: 'writer' | 'reader'): void {
    this.leaseRole = role
  }

  assertWriter(): void {
    if (this.leaseRole !== 'writer') {
      throw new Error('Import lease is held by another writer')
    }
  }

  async applyBatch(batch: ImportBatch): Promise<void> {
    this.assertOpen()
    this.assertWriter()
    applyBatchInTransaction(this.db, batch)
  }

  async readCheckpoint(fileId: string): Promise<Checkpoint | null> {
    this.assertOpen()
    const row = queryOne(
      this.db,
      `SELECT source_file_id, generation, byte_offset, partial_bytes, parser_context
       FROM import_checkpoints WHERE source_file_id = ?`,
      [fileId],
    )
    if (row === null) {
      return null
    }
    const partial = row.partial_bytes
    return {
      sourceFileId: asString(row.source_file_id) ?? fileId,
      generation: asNumber(row.generation) ?? 0,
      byteOffset: asNumber(row.byte_offset) ?? 0,
      partialBytes:
        partial instanceof Uint8Array
          ? partial
          : partial === null || partial === undefined
            ? null
            : new Uint8Array(partial as unknown as ArrayLike<number>),
      parserContext: parseParserContext(asString(row.parser_context) ?? '{}'),
    }
  }

  async totals(
    sourceInstanceId: string,
  ): Promise<{ requests: number; inputTokens: number; outputTokens: number }> {
    this.assertOpen()
    const row = queryOne(
      this.db,
      `SELECT
         COUNT(*) AS requests,
         COALESCE(SUM(input_tokens), 0) AS input_tokens,
         COALESCE(SUM(output_tokens), 0) AS output_tokens
       FROM requests
       WHERE source_instance_id = ?`,
      [sourceInstanceId],
    )
    return {
      requests: asNumber(row?.requests) ?? 0,
      inputTokens: asNumber(row?.input_tokens) ?? 0,
      outputTokens: asNumber(row?.output_tokens) ?? 0,
    }
  }

  exportBytes(): Uint8Array {
    this.assertOpen()
    return this.db.export()
  }

  async flush(destinationPath: string): Promise<void> {
    this.assertOpen()
    this.assertWriter()
    const tmpPath = `${destinationPath}.tmp`
    const bytes = this.db.export()
    try {
      await this.fileIo.writeFile(tmpPath, bytes)
      await this.fileIo.rename(tmpPath, destinationPath)
    } catch (error) {
      try {
        await this.fileIo.unlink(tmpPath)
      } catch {
        // temp may not exist
      }
      const previous = await this.fileIo.readFile(destinationPath)
      if (previous !== null) {
        this.db.close()
        this.db = new this.sql.Database(previous)
        migrateSchema(this.db)
      }
      throw error
    }
  }

  async close(): Promise<void> {
    if (this.closed) {
      return
    }
    this.closed = true
    this.db.close()
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('RequestStore is closed')
    }
  }
}

export function openRequestStore(
  bytes: Uint8Array | null,
  sql: SqlJsStatic,
  fileIo: StoreFileIo = defaultFileIo(),
): RequestStore {
  return new SqlJsRequestStore(sql, bytes, fileIo)
}

/** Test helper: list observations in insertion order. */
export function listObservations(
  store: RequestStore,
): { requestId: string; attributesSpend: number }[] {
  const db = (store as unknown as { db: Database }).db
  return queryAll(
    db,
    'SELECT request_id, attributes_spend FROM request_observations ORDER BY observed_at, id',
  ).map((row) => ({
    requestId: asString(row.request_id) ?? '',
    attributesSpend: asNumber(row.attributes_spend) ?? 0,
  }))
}

export function countRequests(store: RequestStore): number {
  const db = (store as unknown as { db: Database }).db
  const row = queryOne(db, 'SELECT COUNT(*) AS c FROM requests')
  return asNumber(row?.c) ?? 0
}
