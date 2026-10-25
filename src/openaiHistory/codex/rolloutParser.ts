import type {
  BillingMode,
  ModelEvidence,
  ParserContext,
  RateLimitCredits,
  RateLimitMeasurement,
  RateLimitWindow,
  RequestStatus,
  UsageQuality,
} from '../domain'
import { normalizeUsage } from '../usage'
import type { ParseOutcome } from './rolloutTypes'

/** Conversation text and bookkeeping. Known, so they are not "unrecognized". */
const IGNORED_LINE_TYPES = new Set([
  'response_item',
  'world_state',
  'compacted',
])

const DROPPED_BODY_TYPES = new Set([
  'user_message',
  'agent_message',
  'agent_reasoning',
  'tool_call',
  'tool_result',
  'function_call',
  'function_call_output',
  'instructions',
  'input_message',
  'output_message',
  'message',
])

const TERMINAL_STATUSES = new Set<RequestStatus>([
  'failed',
  'cancelled',
  'incomplete',
  'completed',
])

export function emptyParserContext(): ParserContext {
  return {
    sessionId: null,
    threadId: null,
    turnId: null,
    model: null,
    accountOpaqueId: null,
    parentConversationId: null,
    billingMode: 'unknown',
    modelContextWindow: null,
  }
}

export function parseRolloutLine(
  line: string,
  context: ParserContext,
  byteOffset: number,
): ParseOutcome {
  const trimmed = line.trim()
  if (trimmed.length === 0) {
    return { type: 'skip', reason: 'empty' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed) as unknown
  } catch {
    return { type: 'skip', reason: 'bad-json' }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { type: 'skip', reason: 'bad-json' }
  }

  const record = parsed as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type : null
  if (type === null) {
    return { type: 'skip', reason: 'unknown-type' }
  }

  if (IGNORED_LINE_TYPES.has(type)) {
    return { type: 'skip', reason: 'ignored' }
  }

  if (DROPPED_BODY_TYPES.has(type) || isMessageLike(type, record)) {
    return { type: 'skip', reason: 'dropped-body' }
  }

  if (type === 'session_meta') {
    return parseSessionMeta(record, context)
  }
  if (type === 'turn_context') {
    return parseTurnContext(record, context)
  }
  if (type === 'token_usage_record') {
    return parseTokenUsageRecord(record, context, byteOffset)
  }
  if (type === 'event_msg') {
    return parseEventMsg(record, context, byteOffset)
  }
  if (isTerminalErrorType(type, record)) {
    return parseTerminalError(record, context)
  }

  return { type: 'skip', reason: 'unknown-type' }
}

function parseSessionMeta(
  record: Record<string, unknown>,
  context: ParserContext,
): ParseOutcome {
  const payload = asObject(record.payload) ?? record
  const next: ParserContext = {
    ...context,
    sessionId: readString(payload.session_id) ?? readString(payload.id) ?? context.sessionId,
    threadId:
      readString(payload.thread_id) ??
      readString(payload.conversation_id) ??
      context.threadId,
    accountOpaqueId:
      readNonEmptyString(payload.creator_account_id) ??
      readNonEmptyString(payload.creator_user_id) ??
      context.accountOpaqueId,
    parentConversationId:
      readString(payload.parent_thread_id) ??
      readString(payload.parent_conversation_id) ??
      context.parentConversationId,
    billingMode: readBillingMode(payload) ?? context.billingMode,
  }
  return { type: 'context', context: next }
}

function parseTurnContext(
  record: Record<string, unknown>,
  context: ParserContext,
): ParseOutcome {
  const payload = asObject(record.payload) ?? record
  const next: ParserContext = {
    ...context,
    turnId: readString(payload.turn_id) ?? context.turnId,
    model: readString(payload.model) ?? context.model,
    threadId:
      readString(payload.thread_id) ??
      readString(payload.conversation_id) ??
      context.threadId,
    sessionId: readString(payload.session_id) ?? context.sessionId,
  }
  return { type: 'context', context: next }
}

function parseTokenUsageRecord(
  record: Record<string, unknown>,
  context: ParserContext,
  byteOffset: number,
): ParseOutcome {
  const payload = asObject(record.payload) ?? {}
  const usage = normalizeUsage(payload.usage)
  const responseModel = readString(payload.model)
  let model: string | null
  let modelEvidence: ModelEvidence
  if (responseModel !== null) {
    model = responseModel
    modelEvidence = 'response'
  } else if (context.model !== null) {
    model = context.model
    modelEvidence = 'turn-context'
  } else {
    model = null
    modelEvidence = 'unknown'
  }

  const usageQuality: UsageQuality =
    usage.inputTokens !== null || usage.outputTokens !== null ? 'reported' : 'missing'

  const conversationId =
    readString(payload.thread_id) ??
    readString(payload.conversation_id) ??
    context.threadId
  const turnId = readString(payload.turn_id) ?? context.turnId
  const sessionId = readString(payload.session_id) ?? context.sessionId
  const next: ParserContext = {
    ...context,
    threadId: conversationId ?? context.threadId,
    turnId: turnId ?? context.turnId,
    sessionId: sessionId ?? context.sessionId,
  }

  return {
    type: 'request',
    context: next,
    candidate: {
      kind: 'request',
      responseId: readString(payload.response_id),
      conversationId,
      parentConversationId:
        readString(payload.parent_thread_id) ??
        readString(payload.parent_conversation_id) ??
        context.parentConversationId,
      sessionId,
      turnId,
      observedAt: readString(record.timestamp) ?? '',
      model,
      modelEvidence,
      billingMode: readBillingMode(payload) ?? context.billingMode,
      status: 'unknown',
      errorCode: null,
      accountOpaqueId: context.accountOpaqueId,
      usage,
      usageQuality,
      modelContextWindow: context.modelContextWindow ?? null,
      byteOffset,
    },
  }
}

function parseEventMsg(
  record: Record<string, unknown>,
  context: ParserContext,
  byteOffset: number,
): ParseOutcome {
  const payload = asObject(record.payload)
  if (payload === null) {
    return { type: 'skip', reason: 'unknown-type' }
  }
  const eventType = readString(payload.type)
  if (eventType === 'task_started') {
    const window = readContextWindow(payload.model_context_window)
    if (window === null) {
      return { type: 'skip', reason: 'ignored' }
    }
    return {
      type: 'context',
      context: { ...context, modelContextWindow: window },
    }
  }
  if (eventType !== 'token_count') {
    if (eventType !== null && eventType.length > 0) {
      return { type: 'skip', reason: 'ignored' }
    }
    return { type: 'skip', reason: 'unknown-type' }
  }

  const info = asObject(payload.info) ?? payload
  const contextWindow = readContextWindow(info.model_context_window)
  const nextContext =
    contextWindow === null ? context : { ...context, modelContextWindow: contextWindow }
  const usage = normalizeUsage(
    asObject(info.total_token_usage) ??
      asObject(info.last_token_usage) ??
      asObject(info.usage) ??
      info,
  )

  const observedAt = readString(record.timestamp) ?? ''
  const rateLimit = readRateLimit(payload.rate_limits, observedAt, byteOffset)
  const fromPlan = billingModeFromPlanType(rateLimit?.planType ?? null)
  const contextWithPlan =
    fromPlan !== null && nextContext.billingMode === 'unknown'
      ? { ...nextContext, billingMode: fromPlan }
      : nextContext
  return {
    type: 'snapshot',
    context: contextWithPlan,
    rateLimit,
    snapshot: {
      kind: 'snapshot',
      conversationId: nextContext.threadId,
      sessionId: nextContext.sessionId,
      turnId: nextContext.turnId,
      observedAt,
      usage,
      byteOffset,
    },
  }
}

function parseTerminalError(
  record: Record<string, unknown>,
  context: ParserContext,
): ParseOutcome {
  const payload = asObject(record.payload) ?? record
  const responseId = readString(payload.response_id)
  const turnId = readString(payload.turn_id)
  if (responseId === null && turnId === null) {
    return { type: 'skip', reason: 'unknown-type' }
  }

  const namedMatchesContext =
    (responseId !== null && responseId.length > 0) ||
    (turnId !== null && turnId === context.turnId)
  if (!namedMatchesContext && responseId === null) {
    return { type: 'skip', reason: 'unknown-type' }
  }

  if (asObject(payload.usage) !== null) {
    // Usage present → treat as a request line via the usage path would require a type
    // change; callers that send usage on error should use token_usage_record.
    // Status-only when usage is absent.
  }

  const status = readStatus(payload.status) ?? readStatus(record.type) ?? 'failed'
  return {
    type: 'status',
    status,
    errorCode: readString(payload.error_code) ?? readString(payload.code),
    responseId,
    turnId: turnId ?? context.turnId,
    context,
  }
}

function isMessageLike(type: string, record: Record<string, unknown>): boolean {
  if (type === 'response_item') {
    const payload = asObject(record.payload)
    const itemType = payload ? readString(payload.type) : null
    if (itemType !== null && DROPPED_BODY_TYPES.has(itemType)) {
      return true
    }
  }
  return false
}

function isTerminalErrorType(type: string, record: Record<string, unknown>): boolean {
  if (type === 'error' || type === 'turn_failed' || type === 'task_complete') {
    return true
  }
  const payload = asObject(record.payload)
  if (payload === null) {
    return false
  }
  const status = readStatus(payload.status)
  return status !== null && TERMINAL_STATUSES.has(status) && status !== 'completed'
}

function readRateLimit(
  value: unknown,
  observedAt: string,
  byteOffset: number,
): RateLimitMeasurement | null {
  const payload = asObject(value)
  if (payload === null) {
    return null
  }
  const credits = asObject(payload.credits)
  const measurement: RateLimitMeasurement = {
    observedAt,
    planType: readString(payload.plan_type),
    limitId: readString(payload.limit_id),
    primary: readWindow(payload.primary),
    secondary: readWindow(payload.secondary),
    credits: readCredits(credits),
    rateLimitReachedType: readNullableString(payload.rate_limit_reached_type),
    byteOffset,
  }
  const empty =
    measurement.planType === null &&
    measurement.limitId === null &&
    measurement.primary === null &&
    measurement.secondary === null &&
    measurement.credits.hasCredits === null &&
    measurement.rateLimitReachedType === null
  return empty ? null : measurement
}

function readWindow(value: unknown): RateLimitWindow | null {
  const payload = asObject(value)
  if (payload === null) {
    return null
  }
  return {
    usedPercent: readNumber(payload.used_percent),
    windowMinutes: readInteger(payload.window_minutes),
    resetsAt: readInteger(payload.resets_at),
  }
}

function readCredits(payload: Record<string, unknown> | null): RateLimitCredits {
  if (payload === null) {
    return { hasCredits: null, unlimited: null, balance: null }
  }
  return {
    hasCredits: readBoolean(payload.has_credits),
    unlimited: readBoolean(payload.unlimited),
    balance: readBalance(payload.balance),
  }
}

function readBalance(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim()
  }
  return null
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return Math.trunc(value)
}

function readContextWindow(value: unknown): number | null {
  const window = readInteger(value)
  if (window === null || window <= 0) {
    return null
  }
  return window
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return readString(value)
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  return value
}

function readNonEmptyString(value: unknown): string | null {
  const s = readString(value)
  if (s === null || s.length === 0) {
    return null
  }
  return s
}

const CHATGPT_PLAN_TYPES = new Set([
  'free',
  'go',
  'plus',
  'pro',
  'team',
  'business',
  'enterprise',
  'edu',
  'education',
])

/** Codex `plan_type` on a rate-limit sample. `api` stays API; a subscription plan is ChatGPT. */
export function billingModeFromPlanType(value: string | null): BillingMode | null {
  if (value === null) {
    return null
  }
  const raw = value.trim().toLowerCase()
  if (raw === 'api') {
    return 'api'
  }
  if (raw === 'chatgpt-plan' || CHATGPT_PLAN_TYPES.has(raw)) {
    return 'chatgpt-plan'
  }
  return null
}

function readBillingMode(payload: Record<string, unknown>): BillingMode | null {
  const raw = readString(payload.billing_mode) ?? readString(payload.billingMode)
  if (raw === 'api' || raw === 'chatgpt-plan' || raw === 'unknown') {
    return raw
  }
  const plan = readString(payload.plan_type) ?? readString(payload.planType)
  return billingModeFromPlanType(plan)
}

function readStatus(value: unknown): RequestStatus | null {
  if (typeof value !== 'string') {
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
  if (value === 'error' || value === 'turn_failed') {
    return 'failed'
  }
  return null
}
