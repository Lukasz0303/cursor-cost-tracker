import { cleanConversationTitle } from './conversationTitles'
import type { UsageQuery } from './types'

/** Requests with no conversation id. Not a real chat — no Optimize button. */
export const UNGROUPED_CONVERSATION_ID = 'ungrouped'

export type ConversationGroup = {
  id: string
  /** Sessions row label: local title, or the first 8 characters of the id. */
  title: string
  /** True when a local index supplied a title. The prompt uses this. */
  named: boolean
  /** Oldest → newest. */
  queries: UsageQuery[]
}

function groupKey(query: UsageQuery): string | undefined {
  const id = query.conversationId?.trim()
  if (id === undefined || id === '' || id.length > 128) {
    return undefined
  }
  return id
}

function lookupTitle(
  id: string,
  titles: Readonly<Record<string, string>> | undefined,
): string | undefined {
  if (titles === undefined) {
    return undefined
  }
  const raw = titles[id]
  if (typeof raw !== 'string') {
    return undefined
  }
  return cleanConversationTitle(raw)
}

export function shortConversationId(id: string): string {
  return id.slice(0, 8)
}

export type ConversationGroupKey = {
  key: string
  label: string
  named: boolean
}

/** Same title with different spacing or casing is the same chat for the user. */
export function normalizeConversationTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Key for the queries table: title when the local index knows one, else the id.
 * Two chats sharing a title collapse into one row; that row carries both ids.
 */
export function titleGroupKey(
  conversationId: string,
  conversationTitle: string,
): ConversationGroupKey {
  const id = conversationId.trim()
  if (id === '' || id.length > 128) {
    return { key: UNGROUPED_CONVERSATION_ID, label: '', named: false }
  }
  const title = cleanConversationTitle(conversationTitle)
  if (title === undefined) {
    return {
      key: `id:${id}`,
      label: `#${shortConversationId(id)}`,
      named: false,
    }
  }
  return {
    key: `title:${normalizeConversationTitle(title)}`,
    label: title,
    named: true,
  }
}

/**
 * Group a Last N sample by conversation id.
 * Does not invent groups from time gaps. Missing ids share one Ungrouped bucket.
 */
export function groupConversations(
  queries: readonly UsageQuery[],
  titles?: Readonly<Record<string, string>>,
): ConversationGroup[] {
  const buckets = new Map<string, UsageQuery[]>()
  const order: string[] = []
  for (const query of queries) {
    const id = groupKey(query) ?? UNGROUPED_CONVERSATION_ID
    const bucket = buckets.get(id)
    if (bucket === undefined) {
      buckets.set(id, [query])
      order.push(id)
      continue
    }
    bucket.push(query)
  }

  const groups: ConversationGroup[] = []
  for (const id of order) {
    const bucket = buckets.get(id)
    if (bucket === undefined || bucket.length === 0) {
      continue
    }
    const sorted = [...bucket].sort((a, b) => a.timestamp - b.timestamp)
    const namedTitle =
      id === UNGROUPED_CONVERSATION_ID ? undefined : lookupTitle(id, titles)
    const named = namedTitle !== undefined
    groups.push({
      id,
      title:
        id === UNGROUPED_CONVERSATION_ID
          ? 'Ungrouped'
          : (namedTitle ?? shortConversationId(id)),
      named,
      queries: sorted,
    })
  }

  groups.sort((a, b) => {
    const aNewest = a.queries[a.queries.length - 1]?.timestamp ?? 0
    const bNewest = b.queries[b.queries.length - 1]?.timestamp ?? 0
    if (bNewest !== aNewest) {
      return bNewest - aNewest
    }
    if (a.id < b.id) {
      return -1
    }
    if (a.id > b.id) {
      return 1
    }
    return 0
  })
  return groups
}

/** Newest queries first, capped like the Last N table. */
export function newestSample(
  queries: readonly UsageQuery[],
  limit: number,
): UsageQuery[] {
  if (limit <= 0) {
    return []
  }
  return [...queries]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
}
