import { queryFingerprint } from '../spikes/criticalAlert'
import { UNGROUPED_CONVERSATION_ID } from '../usage/groupConversations'
import type { UsageQuery } from '../usage/types'

/** `globalState` key. Not a `cursorCost.*` setting. */
export const OPTIMIZED_TARGETS_STATE_KEY = 'cursorCost.optimizedTargets'

/** Cap per list so globalState stays small. Newest entries stay at the front. */
export const OPTIMIZED_TARGETS_MAX = 200

const MAX_KEY_LENGTH = 256

export type OptimizedTargets = {
  version: 1
  conversationIds: string[]
  fingerprints: string[]
}

export type OptimizedTargetInput = {
  conversationId?: string
  fingerprint?: string
}

export function emptyOptimizedTargets(): OptimizedTargets {
  return {
    version: 1,
    conversationIds: [],
    fingerprints: [],
  }
}

/** Parse stored globalState value; never throws. */
export function parseOptimizedTargets(raw: unknown): OptimizedTargets {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return emptyOptimizedTargets()
  }
  const record = raw as Record<string, unknown>
  if (record.version !== 1) {
    return emptyOptimizedTargets()
  }
  return {
    version: 1,
    conversationIds: parseKeys(record.conversationIds, true),
    fingerprints: parseKeys(record.fingerprints, false),
  }
}

/**
 * Append a conversation id and/or an ungrouped-query fingerprint.
 * A repeat moves to the front. Invalid keys are dropped. The input state
 * is returned unchanged when nothing is stored.
 */
export function rememberOptimizedTarget(
  state: OptimizedTargets,
  input: OptimizedTargetInput,
): OptimizedTargets {
  const conversationId = acceptKey(input.conversationId, true)
  const fingerprint = acceptKey(input.fingerprint, false)
  if (conversationId === null && fingerprint === null) {
    return state
  }
  return {
    version: 1,
    conversationIds:
      conversationId === null
        ? state.conversationIds
        : pushFront(state.conversationIds, conversationId),
    fingerprints:
      fingerprint === null
        ? state.fingerprints
        : pushFront(state.fingerprints, fingerprint),
  }
}

/**
 * True when this query belongs to a stored conversation, or when it has no
 * conversation id and its fingerprint was stored. A grouped row never
 * matches on fingerprint alone.
 */
export function isOptimizedQuery(
  query: UsageQuery,
  targets: OptimizedTargets,
): boolean {
  const id = query.conversationId?.trim() ?? ''
  if (id !== '') {
    return targets.conversationIds.includes(id)
  }
  return targets.fingerprints.includes(queryFingerprint(query))
}

/** Conversation id when the query has one; otherwise its fingerprint. */
export function optimizedTargetForQuery(query: UsageQuery): OptimizedTargetInput {
  const id = query.conversationId?.trim() ?? ''
  if (id !== '' && id !== UNGROUPED_CONVERSATION_ID) {
    return { conversationId: id }
  }
  return { fingerprint: queryFingerprint(query) }
}

/**
 * Target stored after Optimize this conversation.
 * `query-<timestamp>` is the synthetic id for one ungrouped row — store that
 * query, not the synthetic id, because the table never has it.
 */
export function optimizedTargetForConversation(
  id: string,
  query?: UsageQuery,
): OptimizedTargetInput | null {
  const trimmed = id.trim()
  if (trimmed === '' || trimmed === UNGROUPED_CONVERSATION_ID) {
    return null
  }
  if (/^query-\d+$/.test(trimmed)) {
    if (query === undefined) {
      return null
    }
    return optimizedTargetForQuery(query)
  }
  return { conversationId: trimmed }
}

function parseKeys(raw: unknown, conversation: boolean): string[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const key = acceptKey(item, conversation)
    if (key === null || seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(key)
    if (out.length >= OPTIMIZED_TARGETS_MAX) {
      break
    }
  }
  return out
}

function acceptKey(value: unknown, conversation: boolean): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const key = value.trim()
  if (key.length === 0 || key.length > MAX_KEY_LENGTH) {
    return null
  }
  if (conversation && key === UNGROUPED_CONVERSATION_ID) {
    return null
  }
  return key
}

function pushFront(list: readonly string[], key: string): string[] {
  return [key, ...list.filter((item) => item !== key)].slice(
    0,
    OPTIMIZED_TARGETS_MAX,
  )
}
