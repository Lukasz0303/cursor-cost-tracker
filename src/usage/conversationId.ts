const ID_KEYS = [
  'conversationId',
  'conversation_id',
  'composerId',
  'threadId',
  'chatId',
] as const

/** Longer than this is treated as absent so a blob cannot become a group key. */
export const CONVERSATION_ID_MAX = 128

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * First non-empty conversation id on a usage event.
 * Order matches iair 0.8.2. Empty string, non-strings, and values over 128
 * characters are absent. Does not log the event.
 */
export function pickConversationId(event: unknown): string | undefined {
  if (!isRecord(event)) {
    return undefined
  }
  for (const key of ID_KEYS) {
    const value = event[key]
    if (typeof value !== 'string') {
      continue
    }
    const trimmed = value.trim()
    if (trimmed === '' || trimmed.length > CONVERSATION_ID_MAX) {
      continue
    }
    return trimmed
  }
  return undefined
}
