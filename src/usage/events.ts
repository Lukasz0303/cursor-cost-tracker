import { pickConversationId } from './conversationId'
import type { UsageQuery } from './types'
import { DEFAULT_HISTORY_LIMIT } from '../historyLimit'
import {
  asFiniteNumber,
  centsToUsd,
  isRecord,
  parseDollarString,
} from './parseShared'

const MODEL_PREFIX = /^cursor-/

function tokenField(
  usage: Record<string, unknown>,
  ...keys: string[]
): number {
  for (const key of keys) {
    const n = asFiniteNumber(usage[key])
    if (n !== null) {
      return n
    }
  }
  return 0
}

function readTimestamp(raw: Record<string, unknown>): number | null {
  const value = raw.timestamp ?? raw.time ?? raw.createdAt
  const numeric = asFiniteNumber(value)
  if (numeric !== null) {
    return numeric
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    if (Number.isFinite(ms)) {
      return ms
    }
  }
  return null
}

function eventCostUsd(
  raw: Record<string, unknown>,
  usage: Record<string, unknown> | null,
): number {
  const charged = asFiniteNumber(raw.chargedCents)
  if (charged !== null) {
    return centsToUsd(charged)
  }
  const totalCents = usage ? asFiniteNumber(usage.totalCents) : null
  if (totalCents !== null) {
    return centsToUsd(totalCents)
  }
  const fromString = parseDollarString(raw.usageBasedCosts)
  if (fromString !== null) {
    return fromString
  }
  return 0
}

export function mapEventToQuery(raw: unknown): UsageQuery | null {
  if (!isRecord(raw)) {
    return null
  }

  const timestamp = readTimestamp(raw)
  if (timestamp === null) {
    return null
  }

  const usage = isRecord(raw.tokenUsage) ? raw.tokenUsage : null
  const inputTokens = usage
    ? tokenField(usage, 'inputTokens', 'input_tokens')
    : 0
  const outputTokens = usage
    ? tokenField(usage, 'outputTokens', 'output_tokens')
    : 0
  const cacheRead = usage
    ? tokenField(usage, 'cacheReadTokens', 'cache_read_tokens')
    : 0
  const cacheWrite = usage
    ? tokenField(usage, 'cacheWriteTokens', 'cache_write_tokens')
    : 0

  const model =
    typeof raw.model === 'string' && raw.model !== '' ? raw.model : null
  const kind = typeof raw.kind === 'string' && raw.kind !== '' ? raw.kind : null
  const conversationId = pickConversationId(raw)

  return {
    timestamp,
    model,
    kind,
    costUsd: eventCostUsd(raw, usage),
    tokens: inputTokens + outputTokens + cacheRead + cacheWrite,
    inputTokens,
    outputTokens,
    cacheWriteTokens: cacheWrite,
    cacheReadTokens: cacheRead,
    ...(conversationId !== undefined ? { conversationId } : {}),
  }
}

export function mapEventsPayload(
  raw: unknown,
  limit: number = DEFAULT_HISTORY_LIMIT,
): UsageQuery[] {
  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (isRecord(raw) && Array.isArray(raw.usageEventsDisplay)) {
    list = raw.usageEventsDisplay
  }

  const queries: UsageQuery[] = []
  for (const item of list) {
    const query = mapEventToQuery(item)
    if (query !== null) {
      queries.push(query)
    }
  }
  queries.sort((a, b) => b.timestamp - a.timestamp)
  return queries.slice(0, limit)
}

export function stripModelPrefix(model: string | null): string | null {
  if (model === null) {
    return null
  }
  return model.replace(MODEL_PREFIX, '')
}
