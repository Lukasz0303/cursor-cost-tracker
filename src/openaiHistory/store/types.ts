import type {
  AccountConfidence,
  BillingMode,
  ModelEvidence,
  ParserContext,
  RequestSource,
  RequestStatus,
  UsageQuality,
} from '../domain'

export type Checkpoint = {
  sourceFileId: string
  generation: number
  byteOffset: number
  partialBytes: Uint8Array | null
  parserContext: ParserContext
}

export type ImportBatchInstance = {
  id: string
  provider: 'openai'
  rootRealpath: string
  deviceId: string
  lastScanAt: string
  parserVersion: string
}

export type ImportBatchFile = {
  id: string
  sourceInstanceId: string
  absolutePath: string
  generation: number
  sizeBytes: number
  mtimeMs: number
  prefixFingerprint: string
}

export type ImportBatchConversation = {
  id: string
  provider: 'openai'
  accountScopeKey: string
  conversationId: string
  parentConversationId: string | null
  title: string
  turnCount: number | null
  firstObservedAt: string
  lastObservedAt: string
}

export type ImportBatchRequest = {
  id: string
  provider: 'openai'
  source: RequestSource
  accountScopeKey: string
  accountConfidence: AccountConfidence
  conversationId: string | null
  sessionId: string | null
  turnId: string | null
  responseId: string | null
  provisionalKey: string | null
  observedAt: string
  startedAt: string | null
  completedAt: string | null
  model: string | null
  modelEvidence: ModelEvidence
  billingMode: BillingMode
  status: RequestStatus
  errorCode: string | null
  inputTokens: number | null
  cachedInputTokens: number | null
  cacheWriteInputTokens: number | null
  outputTokens: number | null
  reasoningOutputTokens: number | null
  totalTokens: number | null
  /** Session context window in tokens. Null when the rollout never recorded one. */
  modelContextWindow?: number | null
  usageQuality: UsageQuality
  usageAnomaly: boolean
  estimatedApiCostUsd: string | null
  reportedCostUsd: string | null
  pricingVersion: string | null
  deviceId: string
  sourceInstanceId: string
}

export type ImportBatchObservation = {
  id: string
  requestId: string
  sourceFileId: string
  generation: number
  byteOffset: number
  observedAt: string
  attributesSpend: 0 | 1
}

export type ImportBatchRateLimit = {
  id: string
  sourceFileId: string
  generation: number
  byteOffset: number
  observedAt: string
  planType: string | null
  limitId: string | null
  primaryUsedPercent: number | null
  primaryWindowMinutes: number | null
  primaryResetsAt: number | null
  secondaryUsedPercent: number | null
  secondaryWindowMinutes: number | null
  secondaryResetsAt: number | null
  creditsHasCredits: number | null
  creditsUnlimited: number | null
  creditsBalance: string | null
  rateLimitReachedType: string | null
}

export type ImportBatchSnapshot = {
  id: string
  sourceFileId: string
  generation: number
  byteOffset: number
  conversationId: string | null
  observedAt: string
  inputTokens: number | null
  cachedInputTokens: number | null
  cacheWriteInputTokens: number | null
  outputTokens: number | null
  reasoningOutputTokens: number | null
  totalTokens: number | null
  gap: number
}

export type ImportBatch = {
  instance: ImportBatchInstance
  file: ImportBatchFile
  checkpoint: Checkpoint
  conversations: ImportBatchConversation[]
  requests: ImportBatchRequest[]
  observations: ImportBatchObservation[]
  snapshots: ImportBatchSnapshot[]
  rateLimits?: ImportBatchRateLimit[]
  unrecognizedDelta: number
  /** Known non-usage lines (response text, world state). Not a partial import. */
  ignoredDelta?: number
}

export type RequestStore = {
  applyBatch(batch: ImportBatch): Promise<void>
  readCheckpoint(fileId: string): Promise<Checkpoint | null>
  totals(
    sourceInstanceId: string,
  ): Promise<{ requests: number; inputTokens: number; outputTokens: number }>
  exportBytes(): Uint8Array
  flush(destinationPath: string): Promise<void>
  close(): Promise<void>
  setLeaseRole(role: 'writer' | 'reader'): void
  assertWriter(): void
}

export type StoreFileIo = {
  writeFile(path: string, data: Uint8Array): Promise<void>
  rename(from: string, to: string): Promise<void>
  unlink(path: string): Promise<void>
  readFile(path: string): Promise<Uint8Array | null>
}