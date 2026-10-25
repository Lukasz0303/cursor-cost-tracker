export const ROLLOUT_PARSER_VERSION = 'rollout-v4'

export type RequestSource = 'codex-local' | 'openai-api'
export type AccountConfidence = 'source-reported' | 'user-assigned' | 'unknown'
export type ModelEvidence = 'response' | 'turn-context' | 'requested' | 'unknown'
export type BillingMode = 'api' | 'chatgpt-plan' | 'unknown'
export type RequestStatus =
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'incomplete'
  | 'unknown'
export type UsageQuality = 'reported' | 'derived' | 'partial' | 'missing'
export type CostCoverage = 'complete' | 'tokens-only' | 'partial' | 'unknown'

export type TokenUsage = {
  inputTokens: number | null
  cachedInputTokens: number | null
  cacheWriteInputTokens: number | null
  outputTokens: number | null
  reasoningOutputTokens: number | null
  totalTokens: number | null
  anomaly: boolean
}

export type RequestCandidate = {
  kind: 'request'
  responseId: string | null
  conversationId: string | null
  parentConversationId: string | null
  sessionId: string | null
  turnId: string | null
  observedAt: string
  model: string | null
  modelEvidence: ModelEvidence
  billingMode: BillingMode
  status: RequestStatus
  errorCode: string | null
  accountOpaqueId: string | null
  usage: TokenUsage
  usageQuality: UsageQuality
  /** Session `model_context_window` in tokens. Null when the file never said. */
  modelContextWindow: number | null
  byteOffset: number
}

export type UsageSnapshotEvent = {
  kind: 'snapshot'
  conversationId: string | null
  sessionId: string | null
  turnId: string | null
  observedAt: string
  usage: TokenUsage
  byteOffset: number
}

export type ParserContext = {
  sessionId: string | null
  threadId: string | null
  turnId: string | null
  model: string | null
  accountOpaqueId: string | null
  parentConversationId: string | null
  billingMode: BillingMode
  /** Latest `model_context_window` seen in this file. Null until a session says. */
  modelContextWindow: number | null
}

/** One Codex rate-limit window. `resetsAt` is unix seconds. Percents are not summed. */
export type RateLimitWindow = {
  usedPercent: number | null
  windowMinutes: number | null
  resetsAt: number | null
}

export type RateLimitCredits = {
  hasCredits: boolean | null
  unlimited: boolean | null
  balance: string | null
}

/** Latest-wins measurement copied off `token_count.rate_limits`. Not a token total. */
export type RateLimitMeasurement = {
  observedAt: string
  planType: string | null
  limitId: string | null
  primary: RateLimitWindow | null
  secondary: RateLimitWindow | null
  credits: RateLimitCredits
  rateLimitReachedType: string | null
  byteOffset: number
}
