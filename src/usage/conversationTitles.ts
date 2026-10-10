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

export type ComposerContextMeter = {
  /** Cursor's own meter, 0–100, same number as the Context Usage ring. */
  percent: number
  tokensUsed: number | null
  tokenLimit: number | null
}

function asPercent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.round(value)
}

function asTokens(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.round(value)
}

function meterFromFields(record: Record<string, unknown>): ComposerContextMeter | null {
  const tokensUsed = asTokens(record.contextTokensUsed)
  const tokenLimit = asTokens(record.contextTokenLimit)
  let percent = asPercent(record.contextUsagePercent)
  if (
    percent === null &&
    tokensUsed !== null &&
    tokenLimit !== null &&
    tokenLimit > 0
  ) {
    percent = Math.round((tokensUsed / tokenLimit) * 100)
  }
  if (percent === null) {
    return null
  }
  return { percent, tokensUsed, tokenLimit }
}

function putMeter(
  target: Map<string, ComposerContextMeter>,
  id: unknown,
  meter: ComposerContextMeter | null,
): void {
  const key = cleanId(id)
  if (key === undefined || meter === null) {
    return
  }
  const existing = target.get(key)
  if (existing === undefined || (existing.tokenLimit === null && meter.tokenLimit !== null)) {
    target.set(key, meter)
  }
}

/**
 * `composer.composerData` → `allComposers[]` context meter.
 * Reads only the percent and token totals. Ignores message text.
 */
export function metersFromComposerIndex(raw: string): Map<string, ComposerContextMeter> {
  const meters = new Map<string, ComposerContextMeter>()
  const parsed = parseJson(raw)
  if (!isRecord(parsed) || !Array.isArray(parsed.allComposers)) {
    return meters
  }
  for (const item of parsed.allComposers) {
    if (!isRecord(item)) {
      continue
    }
    putMeter(meters, item.composerId, meterFromFields(item))
  }
  return meters
}

/** Context meter on a `composerHeaders` blob. Does not return chat text. */
export function meterFromComposerHeader(
  raw: string,
  fallbackId: string,
): { id: string; meter: ComposerContextMeter } | null {
  const parsed = parseJson(raw)
  if (!isRecord(parsed)) {
    return null
  }
  const meter = meterFromFields(parsed)
  const id = cleanId(parsed.composerId) ?? cleanId(fallbackId)
  if (meter === null || id === undefined) {
    return null
  }
  return { id, meter }
}

export function contextRecord(
  meters: ReadonlyMap<string, ComposerContextMeter>,
): Record<string, ComposerContextMeter> {
  const out: Record<string, ComposerContextMeter> = {}
  for (const [id, meter] of meters) {
    out[id] = meter
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
