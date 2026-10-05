import { CONVERSATION_ID_MAX } from './conversationId'

export const COMPOSER_INDEX_KEY = 'composer.composerData'
export const CHAT_INDEX_KEY = 'workbench.panel.aichat.view.aichat.chatdata'

/** Row and prompt titles. Longer names are cut, not dropped. */
export const CONVERSATION_TITLE_MAX = 200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function cleanConversationTitle(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed === '') {
    return undefined
  }
  return trimmed.slice(0, CONVERSATION_TITLE_MAX)
}

function cleanId(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.length > CONVERSATION_ID_MAX) {
    return undefined
  }
  return trimmed
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

function putTitle(
  target: Map<string, string>,
  id: unknown,
  title: unknown,
): void {
  const key = cleanId(id)
  if (key === undefined || target.has(key) || typeof title !== 'string') {
    return
  }
  const clean = cleanConversationTitle(title)
  if (clean === undefined) {
    return
  }
  target.set(key, clean)
}

/**
 * `composer.composerData` → `allComposers[]` `{ composerId, name }`.
 * Ignores every other field (including any message list).
 */
export function titlesFromComposerIndex(raw: string): Map<string, string> {
  const titles = new Map<string, string>()
  const parsed = parseJson(raw)
  if (!isRecord(parsed) || !Array.isArray(parsed.allComposers)) {
    return titles
  }
  for (const item of parsed.allComposers) {
    if (!isRecord(item)) {
      continue
    }
    putTitle(titles, item.composerId, item.name)
  }
  return titles
}

/**
 * `workbench.panel.aichat.view.aichat.chatdata` → `tabs[]`.
 * `chatTitle` wins over `title`.
 */
export function titlesFromChatTabs(raw: string): Map<string, string> {
  const titles = new Map<string, string>()
  const parsed = parseJson(raw)
  if (!isRecord(parsed) || !Array.isArray(parsed.tabs)) {
    return titles
  }
  for (const item of parsed.tabs) {
    if (!isRecord(item)) {
      continue
    }
    const title =
      typeof item.chatTitle === 'string' && item.chatTitle.trim() !== ''
        ? item.chatTitle
        : item.title
    putTitle(titles, item.tabId, title)
  }
  return titles
}

/**
 * Name already present on a `composerHeaders` JSON blob.
 * Does not require line totals and does not return any other field.
 */
export function nameFromComposerHeader(
  raw: string,
  fallbackId: string,
): { id: string; name: string } | null {
  const parsed = parseJson(raw)
  if (!isRecord(parsed) || typeof parsed.name !== 'string') {
    return null
  }
  const id = cleanId(parsed.composerId) ?? cleanId(fallbackId)
  const name = cleanConversationTitle(parsed.name)
  if (id === undefined || name === undefined) {
    return null
  }
  return { id, name }
}

/** Earlier maps win. Later maps only fill ids that are still unnamed. */
export function mergeConversationTitles(
  ...sources: Array<ReadonlyMap<string, string> | undefined>
): Map<string, string> {
  const out = new Map<string, string>()
  for (const source of sources) {
    if (source === undefined) {
      continue
    }
    for (const [id, title] of source) {
      putTitle(out, id, title)
    }
  }
  return out
}

export function titleRecord(
  titles: ReadonlyMap<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [id, title] of titles) {
    out[id] = title
  }
  return out
}
