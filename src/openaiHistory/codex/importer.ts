import { createHash } from 'node:crypto'
import type { Database, SqlValue } from 'sql.js'
import {
  ROLLOUT_PARSER_VERSION,
  type ParserContext,
  type RateLimitMeasurement,
} from '../domain'
import {
  accountScopeKey,
  provisionalRequestKey,
  shortThreadTitle,
  unknownScopeKey,
} from '../ids'
import type {
  Checkpoint,
  ImportBatch,
  ImportBatchConversation,
  ImportBatchObservation,
  ImportBatchRateLimit,
  ImportBatchRequest,
  ImportBatchSnapshot,
  RequestStore,
} from '../store/types'
import { createByteReader } from './byteReader'
import type { DiscoveredFile } from './discover'
import { emptyParserContext, parseRolloutLine } from './rolloutParser'
import type { ParseOutcome } from './rolloutTypes'
import type { ResolvedCodexRoot } from './sourceRoot'
import { decompressZstd } from './zstd'

const PREFIX_BYTES = 4096
const BATCH_OUTCOME_CAP = 200

export type ImportDiscoveredFileInput = {
  file: DiscoveredFile
  root: ResolvedCodexRoot & { ok: true }
  deviceId: string
  store: RequestStore
  readFrom: (path: string, offset: number) => Promise<Uint8Array>
  now?: () => number
}

type StoredFileMeta = {
  id: string
  generation: number
  sizeBytes: number
  prefixFingerprint: string
}

type ScopeInfo = {
  accountScopeKey: string
  accountConfidence: 'source-reported' | 'unknown'
}

function sha256Hex(data: Uint8Array | string): string {
  const hash = createHash('sha256')
  if (typeof data === 'string') {
    hash.update(data, 'utf8')
  } else {
    hash.update(data)
  }
  return hash.digest('hex')
}

export function sourceFileId(sourceInstanceId: string, absolutePath: string): string {
  return sha256Hex(`${sourceInstanceId}\0${absolutePath}`)
}

function conversationRowId(accountScope: string, conversationId: string): string {
  return sha256Hex(`openai\0${accountScope}\0${conversationId}`)
}

function requestRowId(
  accountScope: string,
  responseId: string | null,
  provisionalKey: string | null,
): string {
  if (responseId !== null && responseId !== '') {
    return sha256Hex(`req\0openai\0${accountScope}\0${responseId}`)
  }
  return sha256Hex(`req\0prov\0${provisionalKey ?? ''}`)
}

function getStoreDb(store: RequestStore): Database {
  const db = (store as unknown as { db: Database }).db
  if (db === undefined) {
    throw new Error('RequestStore database is not available')
  }
  return db
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

function asString(value: SqlValue | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: SqlValue | undefined): number | null {
  return typeof value === 'number' ? value : null
}

function readStoredFile(
  store: RequestStore,
  sourceInstanceId: string,
  absolutePath: string,
): StoredFileMeta | null {
  const row = queryOne(
    getStoreDb(store),
    `SELECT id, generation, size_bytes, prefix_fingerprint
     FROM source_files
     WHERE source_instance_id = ? AND absolute_path = ?`,
    [sourceInstanceId, absolutePath],
  )
  if (row === null) {
    return null
  }
  return {
    id: asString(row.id) ?? sourceFileId(sourceInstanceId, absolutePath),
    generation: asNumber(row.generation) ?? 1,
    sizeBytes: asNumber(row.size_bytes) ?? 0,
    prefixFingerprint: asString(row.prefix_fingerprint) ?? '',
  }
}

function findRequestByResponse(
  store: RequestStore,
  accountScope: string,
  responseId: string,
): string | null {
  const row = queryOne(
    getStoreDb(store),
    `SELECT id FROM requests
     WHERE provider = 'openai' AND account_scope_key = ? AND response_id = ?`,
    [accountScope, responseId],
  )
  return asString(row?.id)
}

function findRequestByProvisional(
  store: RequestStore,
  provisionalKey: string,
): string | null {
  const row = queryOne(
    getStoreDb(store),
    `SELECT id FROM requests WHERE provisional_key = ?`,
    [provisionalKey],
  )
  return asString(row?.id)
}

function findRequestByTurn(
  store: RequestStore,
  accountScope: string,
  turnId: string,
): string | null {
  const row = queryOne(
    getStoreDb(store),
    `SELECT id FROM requests
     WHERE provider = 'openai' AND account_scope_key = ? AND turn_id = ?
     ORDER BY observed_at DESC, id DESC LIMIT 1`,
    [accountScope, turnId],
  )
  return asString(row?.id)
}

function scopeFromContext(
  context: ParserContext,
  sourceInstanceId: string,
): ScopeInfo {
  if (context.accountOpaqueId !== null && context.accountOpaqueId !== '') {
    return {
      accountScopeKey: accountScopeKey(context.accountOpaqueId),
      accountConfidence: 'source-reported',
    }
  }
  return {
    accountScopeKey: unknownScopeKey(sourceInstanceId),
    accountConfidence: 'unknown',
  }
}

export function splitCompleteLines(
  data: Uint8Array,
  baseOffset: number,
): {
  lines: { text: string; offset: number }[]
  partial: Uint8Array
  nextOffset: number
  dropped: number
} {
  const reader = createByteReader()
  const linesRaw = reader.push(data)
  const starts = reader.lastLineStarts()
  const dropped = reader.lastDroppedCount()
  const consumed = reader.byteOffset()
  return {
    lines: linesRaw.map((text, i) => ({
      text,
      offset: baseOffset + (starts[i] ?? 0),
    })),
    partial:
      consumed < data.byteLength ? data.subarray(consumed).slice() : new Uint8Array(0),
    nextOffset: baseOffset + consumed,
    dropped,
  }
}

type ConversationState = {
  row: ImportBatchConversation
  turnIds: Set<string>
  sawRequestOrTurn: boolean
}

type BatchBuilder = {
  conversations: Map<string, ConversationState>
  requests: ImportBatchRequest[]
  observations: ImportBatchObservation[]
  snapshots: ImportBatchSnapshot[]
  rateLimits: ImportBatchRateLimit[]
  unrecognizedDelta: number
  ignoredDelta: number
  outcomeCount: number
  seenResponseIds: Set<string>
  lastSnapshotTokens: Map<string, number | null>
}

function createBuilder(
  seenResponseIds: Set<string>,
  lastSnapshotTokens: Map<string, number | null>,
): BatchBuilder {
  return {
    conversations: new Map(),
    requests: [],
    observations: [],
    snapshots: [],
    rateLimits: [],
    unrecognizedDelta: 0,
    ignoredDelta: 0,
    outcomeCount: 0,
    seenResponseIds,
    lastSnapshotTokens,
  }
}

function ensureConversation(
  builder: BatchBuilder,
  scope: ScopeInfo,
  conversationId: string,
  parentConversationId: string | null,
  observedAt: string,
): ConversationState {
  const key = `${scope.accountScopeKey}\0${conversationId}`
  const existing = builder.conversations.get(key)
  if (existing !== undefined) {
    if (parentConversationId !== null && existing.row.parentConversationId === null) {
      existing.row.parentConversationId = parentConversationId
    }
    if (observedAt && observedAt < existing.row.firstObservedAt) {
      existing.row.firstObservedAt = observedAt
    }
    if (observedAt && observedAt > existing.row.lastObservedAt) {
      existing.row.lastObservedAt = observedAt
    }
    return existing
  }
  const when = observedAt || '1970-01-01T00:00:00.000Z'
  const state: ConversationState = {
    row: {
      id: conversationRowId(scope.accountScopeKey, conversationId),
      provider: 'openai',
      accountScopeKey: scope.accountScopeKey,
      conversationId,
      parentConversationId,
      title: shortThreadTitle(conversationId),
      turnCount: null,
      firstObservedAt: when,
      lastObservedAt: when,
    },
    turnIds: new Set(),
    sawRequestOrTurn: false,
  }
  builder.conversations.set(key, state)
  return state
}

function noteTurn(state: ConversationState, turnId: string | null): void {
  if (turnId === null || turnId === '') {
    return
  }
  state.sawRequestOrTurn = true
  state.turnIds.add(turnId)
  state.row.turnCount = state.turnIds.size
}

function buildBatch(
  builder: BatchBuilder,
  meta: {
    root: ResolvedCodexRoot & { ok: true }
    deviceId: string
    fileId: string
    absolutePath: string
    generation: number
    sizeBytes: number
    mtimeMs: number
    prefixFingerprint: string
    checkpoint: Checkpoint
    nowIso: string
  },
): ImportBatch {
  return {
    instance: {
      id: meta.root.sourceInstanceId,
      provider: 'openai',
      rootRealpath: meta.root.realpath,
      deviceId: meta.deviceId,
      lastScanAt: meta.nowIso,
      parserVersion: ROLLOUT_PARSER_VERSION,
    },
    file: {
      id: meta.fileId,
      sourceInstanceId: meta.root.sourceInstanceId,
      absolutePath: meta.absolutePath,
      generation: meta.generation,
      sizeBytes: meta.sizeBytes,
      mtimeMs: meta.mtimeMs,
      prefixFingerprint: meta.prefixFingerprint,
    },
    checkpoint: meta.checkpoint,
    conversations: [...builder.conversations.values()].map((c) => ({
      ...c.row,
      turnCount: c.sawRequestOrTurn ? c.turnIds.size : null,
    })),
    requests: builder.requests,
    observations: builder.observations,
    snapshots: builder.snapshots,
    rateLimits: builder.rateLimits,
    unrecognizedDelta: builder.unrecognizedDelta,
    ignoredDelta: builder.ignoredDelta,
  }
}

function bit(value: boolean | null): number | null {
  if (value === null) {
    return null
  }
  return value ? 1 : 0
}

function toRateLimitRow(
  sample: RateLimitMeasurement,
  fileId: string,
  generation: number,
): ImportBatchRateLimit {
  return {
    id: sha256Hex(`rl\0${fileId}\0${generation}\0${sample.byteOffset}`),
    sourceFileId: fileId,
    generation,
    byteOffset: sample.byteOffset,
    observedAt: sample.observedAt || '1970-01-01T00:00:00.000Z',
    planType: sample.planType,
    limitId: sample.limitId,
    primaryUsedPercent: sample.primary?.usedPercent ?? null,
    primaryWindowMinutes: sample.primary?.windowMinutes ?? null,
    primaryResetsAt: sample.primary?.resetsAt ?? null,
    secondaryUsedPercent: sample.secondary?.usedPercent ?? null,
    secondaryWindowMinutes: sample.secondary?.windowMinutes ?? null,
    secondaryResetsAt: sample.secondary?.resetsAt ?? null,
    creditsHasCredits: bit(sample.credits.hasCredits),
    creditsUnlimited: bit(sample.credits.unlimited),
    creditsBalance: sample.credits.balance,
    rateLimitReachedType: sample.rateLimitReachedType,
  }
}

function handleOutcome(
  outcome: ParseOutcome,
  builder: BatchBuilder,
  ctx: {
    store: RequestStore
    sourceInstanceId: string
    deviceId: string
    fileId: string
    generation: number
  },
): ParserContext | null {
  builder.outcomeCount += 1

  if (outcome.type === 'skip') {
    if (outcome.reason === 'bad-json' || outcome.reason === 'unknown-type') {
      builder.unrecognizedDelta += 1
    } else if (outcome.reason === 'ignored' || outcome.reason === 'dropped-body') {
      builder.ignoredDelta += 1
    }
    return null
  }

  if (outcome.type === 'context') {
    const scope = scopeFromContext(outcome.context, ctx.sourceInstanceId)
    if (outcome.context.threadId !== null) {
      const state = ensureConversation(
        builder,
        scope,
        outcome.context.threadId,
        outcome.context.parentConversationId,
        '',
      )
      noteTurn(state, outcome.context.turnId)
    }
    return outcome.context
  }

  if (outcome.type === 'status') {
    const scope = scopeFromContext(outcome.context, ctx.sourceInstanceId)
    const queued = builder.requests.find(
      (r) =>
        r.accountScopeKey === scope.accountScopeKey &&
        ((outcome.responseId !== null &&
          outcome.responseId !== '' &&
          r.responseId === outcome.responseId) ||
          (outcome.turnId !== null && r.turnId === outcome.turnId)),
    )
    if (queued !== undefined) {
      queued.status = outcome.status
      queued.errorCode = outcome.errorCode
      return outcome.context
    }
    let existingId: string | null = null
    if (outcome.responseId !== null && outcome.responseId !== '') {
      existingId = findRequestByResponse(
        ctx.store,
        scope.accountScopeKey,
        outcome.responseId,
      )
    }
    if (existingId === null && outcome.turnId !== null) {
      existingId = findRequestByTurn(ctx.store, scope.accountScopeKey, outcome.turnId)
    }
    if (existingId === null) {
      return outcome.context
    }
    builder.requests.push({
      id: existingId,
      provider: 'openai',
      source: 'codex-local',
      accountScopeKey: scope.accountScopeKey,
      accountConfidence: scope.accountConfidence,
      conversationId: outcome.context.threadId,
      sessionId: outcome.context.sessionId,
      turnId: outcome.turnId,
      responseId: outcome.responseId,
      provisionalKey: null,
      observedAt: '1970-01-01T00:00:00.000Z',
      startedAt: null,
      completedAt: null,
      model: null,
      modelEvidence: 'unknown',
      billingMode: outcome.context.billingMode,
      status: outcome.status,
      errorCode: outcome.errorCode,
      inputTokens: null,
      cachedInputTokens: null,
      cacheWriteInputTokens: null,
      outputTokens: null,
      reasoningOutputTokens: null,
      totalTokens: null,
      usageQuality: 'missing',
      usageAnomaly: false,
      estimatedApiCostUsd: null,
      reportedCostUsd: null,
      pricingVersion: null,
      deviceId: ctx.deviceId,
      sourceInstanceId: ctx.sourceInstanceId,
    })
    return outcome.context
  }

  if (outcome.type === 'snapshot') {
    const snap = outcome.snapshot
    const key = snap.conversationId ?? ''
    const prev = builder.lastSnapshotTokens.get(key)
    const current = snap.usage.totalTokens
    const gap =
      prev !== undefined && (prev === null || current === null || current < prev) ? 1 : 0
    builder.lastSnapshotTokens.set(key, current)
    builder.snapshots.push({
      id: sha256Hex(`snap\0${ctx.fileId}\0${ctx.generation}\0${snap.byteOffset}`),
      sourceFileId: ctx.fileId,
      generation: ctx.generation,
      byteOffset: snap.byteOffset,
      conversationId: snap.conversationId,
      observedAt: snap.observedAt || '1970-01-01T00:00:00.000Z',
      inputTokens: snap.usage.inputTokens,
      cachedInputTokens: snap.usage.cachedInputTokens,
      cacheWriteInputTokens: snap.usage.cacheWriteInputTokens,
      outputTokens: snap.usage.outputTokens,
      reasoningOutputTokens: snap.usage.reasoningOutputTokens,
      totalTokens: snap.usage.totalTokens,
      gap,
    })
    if (outcome.rateLimit !== null) {
      builder.rateLimits.push(toRateLimitRow(outcome.rateLimit, ctx.fileId, ctx.generation))
    }
    if (outcome.context.billingMode !== 'unknown') {
      for (const request of builder.requests) {
        if (request.billingMode === 'unknown') {
          request.billingMode = outcome.context.billingMode
        }
      }
    }
    return outcome.context
  }

  const candidate = outcome.candidate
  const scope = scopeFromContext(
    {
      ...outcome.context,
      accountOpaqueId: candidate.accountOpaqueId ?? outcome.context.accountOpaqueId,
    },
    ctx.sourceInstanceId,
  )
  const conversationId =
    candidate.conversationId ?? outcome.context.threadId ?? `missing:${ctx.fileId}`
  const parentId =
    candidate.parentConversationId ?? outcome.context.parentConversationId
  const conv = ensureConversation(
    builder,
    scope,
    conversationId,
    parentId,
    candidate.observedAt,
  )
  noteTurn(conv, candidate.turnId)

  const responseId = candidate.responseId
  const provisionalKey =
    responseId === null || responseId === ''
      ? provisionalRequestKey(ctx.sourceInstanceId, ctx.generation, candidate.byteOffset)
      : null

  const responseKey =
    responseId !== null && responseId !== ''
      ? `${scope.accountScopeKey}\0${responseId}`
      : null

  let attributesSpend: 0 | 1 = 1
  let existingId: string | null = null
  if (responseKey !== null && responseId !== null) {
    existingId = findRequestByResponse(ctx.store, scope.accountScopeKey, responseId)
    if (existingId !== null || builder.seenResponseIds.has(responseKey)) {
      attributesSpend = 0
      if (existingId === null) {
        existingId =
          builder.requests.find(
            (r) =>
              r.accountScopeKey === scope.accountScopeKey && r.responseId === responseId,
          )?.id ?? null
      }
    }
    builder.seenResponseIds.add(responseKey)
  } else if (provisionalKey !== null) {
    existingId = findRequestByProvisional(ctx.store, provisionalKey)
    if (existingId !== null) {
      attributesSpend = 0
    }
  }

  const id =
    existingId ?? requestRowId(scope.accountScopeKey, responseId, provisionalKey)

  // Duplicate observations must not relocate the canonical request onto the child thread.
  builder.requests.push({
    id,
    provider: 'openai',
    source: 'codex-local',
    accountScopeKey: scope.accountScopeKey,
    accountConfidence: scope.accountConfidence,
    conversationId: attributesSpend === 1 ? conversationId : null,
    sessionId: attributesSpend === 1 ? candidate.sessionId : null,
    turnId: attributesSpend === 1 ? candidate.turnId : null,
    responseId,
    provisionalKey,
    observedAt: candidate.observedAt || '1970-01-01T00:00:00.000Z',
    startedAt: null,
    completedAt: null,
    model: attributesSpend === 1 ? candidate.model : null,
    modelEvidence: candidate.modelEvidence,
    billingMode: candidate.billingMode,
    status: candidate.status,
    errorCode: candidate.errorCode,
    inputTokens: attributesSpend === 1 ? candidate.usage.inputTokens : null,
    cachedInputTokens: attributesSpend === 1 ? candidate.usage.cachedInputTokens : null,
    cacheWriteInputTokens:
      attributesSpend === 1 ? candidate.usage.cacheWriteInputTokens : null,
    outputTokens: attributesSpend === 1 ? candidate.usage.outputTokens : null,
    reasoningOutputTokens:
      attributesSpend === 1 ? candidate.usage.reasoningOutputTokens : null,
    totalTokens: attributesSpend === 1 ? candidate.usage.totalTokens : null,
    modelContextWindow: candidate.modelContextWindow,
    usageQuality: candidate.usageQuality,
    usageAnomaly: candidate.usage.anomaly,
    estimatedApiCostUsd: null,
    reportedCostUsd: null,
    pricingVersion: null,
    deviceId: ctx.deviceId,
    sourceInstanceId: ctx.sourceInstanceId,
  })

  builder.observations.push({
    id: sha256Hex(`obs\0${ctx.fileId}\0${ctx.generation}\0${candidate.byteOffset}`),
    requestId: id,
    sourceFileId: ctx.fileId,
    generation: ctx.generation,
    byteOffset: candidate.byteOffset,
    observedAt: candidate.observedAt || '1970-01-01T00:00:00.000Z',
    attributesSpend,
  })
  return outcome.context
}

type RolloutBytes = {
  prefix: Uint8Array
  logicalSize: number
  read: (path: string, offset: number) => Promise<Uint8Array>
}

function withTrailingNewline(bytes: Uint8Array): Uint8Array {
  if (bytes.byteLength === 0 || bytes[bytes.byteLength - 1] === 0x0a) {
    return bytes
  }
  const next = new Uint8Array(bytes.byteLength + 1)
  next.set(bytes)
  next[bytes.byteLength] = 0x0a
  return next
}

async function openRolloutBytes(
  file: DiscoveredFile,
  readFrom: (path: string, offset: number) => Promise<Uint8Array>,
): Promise<RolloutBytes | 'corrupt'> {
  if (!file.absolutePath.endsWith('.jsonl.zst')) {
    return { prefix: await readFrom(file.absolutePath, 0), logicalSize: file.size, read: readFrom }
  }
  const compressedFull = await readFrom(file.absolutePath, 0)
  const compressed = compressedFull.subarray(
    0,
    Math.min(compressedFull.byteLength, file.size),
  )
  try {
    const plain = withTrailingNewline(decompressZstd(compressed))
    return {
      prefix: compressed,
      logicalSize: plain.byteLength,
      read: async (_path, offset) => plain.subarray(offset),
    }
  } catch {
    return 'corrupt'
  }
}

export async function importDiscoveredFile(
  input: ImportDiscoveredFileInput,
): Promise<{ unrecognized: number }> {
  const { file, root, deviceId, store, readFrom } = input
  const nowIso = new Date((input.now ?? Date.now)()).toISOString()
  const fileId = sourceFileId(root.sourceInstanceId, file.absolutePath)

  const opened = await openRolloutBytes(file, readFrom)
  if (opened === 'corrupt') {
    return { unrecognized: 1 }
  }
  const { prefix: prefixChunk, logicalSize, read } = opened
  const prefixLen = Math.min(PREFIX_BYTES, prefixChunk.byteLength, file.size)
  const prefixFingerprint = sha256Hex(prefixChunk.subarray(0, prefixLen))

  const stored = readStoredFile(store, root.sourceInstanceId, file.absolutePath)
  let generation = 1
  if (stored !== null) {
    generation = stored.generation
    const zstRewritten =
      file.absolutePath.endsWith('.jsonl.zst') &&
      (file.size !== stored.sizeBytes ||
        prefixFingerprint !== stored.prefixFingerprint)
    if (
      zstRewritten ||
      file.size < stored.sizeBytes ||
      (file.size === stored.sizeBytes &&
        prefixFingerprint !== stored.prefixFingerprint)
    ) {
      generation = stored.generation + 1
    }
  }

  const sameGeneration = stored !== null && generation === stored.generation
  const checkpoint = sameGeneration ? await store.readCheckpoint(stored.id) : null
  const startOffset = checkpoint?.byteOffset ?? 0
  let parserContext: ParserContext = checkpoint?.parserContext ?? emptyParserContext()
  const priorPartial = sameGeneration
    ? (checkpoint?.partialBytes ?? new Uint8Array(0))
    : new Uint8Array(0)

  if (sameGeneration && startOffset >= logicalSize && priorPartial.byteLength === 0) {
    return { unrecognized: 0 }
  }

  const readOffset = startOffset + priorPartial.byteLength
  const tail =
    readOffset < logicalSize ? await read(file.absolutePath, readOffset) : new Uint8Array(0)

  const combined = new Uint8Array(priorPartial.byteLength + tail.byteLength)
  combined.set(priorPartial)
  combined.set(tail, priorPartial.byteLength)

  if (combined.byteLength === 0 && sameGeneration) {
    return { unrecognized: 0 }
  }

  const split = splitCompleteLines(combined, startOffset)
  const seenResponseIds = new Set<string>()
  const snapshotBaselines = new Map<string, number | null>()
  let builder = createBuilder(seenResponseIds, snapshotBaselines)
  builder.unrecognizedDelta += split.dropped
  builder.outcomeCount += split.dropped

  let totalUnrecognized = 0

  const flush = async (byteOffset: number, partial: Uint8Array): Promise<void> => {
    const batch = buildBatch(builder, {
      root,
      deviceId,
      fileId,
      absolutePath: file.absolutePath,
      generation,
      sizeBytes: file.size,
      mtimeMs: file.mtimeMs,
      prefixFingerprint,
      nowIso,
      checkpoint: {
        sourceFileId: fileId,
        generation,
        byteOffset,
        partialBytes: partial.byteLength > 0 ? partial : null,
        parserContext,
      },
    })
    await store.applyBatch(batch)
    totalUnrecognized += builder.unrecognizedDelta
    builder = createBuilder(seenResponseIds, snapshotBaselines)
  }

  for (let i = 0; i < split.lines.length; i += 1) {
    const line = split.lines[i]!
    const outcome = parseRolloutLine(line.text, parserContext, line.offset)
    const nextContext = handleOutcome(outcome, builder, {
      store,
      sourceInstanceId: root.sourceInstanceId,
      deviceId,
      fileId,
      generation,
    })
    if (nextContext !== null) {
      parserContext = nextContext
    }

    if (builder.outcomeCount >= BATCH_OUTCOME_CAP) {
      const lineEnd = line.offset + Buffer.byteLength(line.text, 'utf8') + 1
      const isLast = i === split.lines.length - 1
      await flush(isLast ? split.nextOffset : lineEnd, isLast ? split.partial : new Uint8Array(0))
    }
  }

  if (
    builder.outcomeCount > 0 ||
    builder.unrecognizedDelta > 0 ||
    builder.conversations.size > 0 ||
    !sameGeneration ||
    split.nextOffset !== startOffset ||
    split.partial.byteLength > 0
  ) {
    await flush(split.nextOffset, split.partial)
  }

  return { unrecognized: totalUnrecognized }
}
