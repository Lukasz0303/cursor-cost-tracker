export function shortThreadTitle(threadId: string): string {
  if (threadId.length <= 8) {
    return `#${threadId}`
  }
  return `#${threadId.slice(0, 8)}`
}

/** `#01a153a1` style placeholder. A session-index title must not be replaced by one. */
export function isGeneratedThreadTitle(title: string, conversationId: string): boolean {
  if (!title.startsWith('#')) {
    return false
  }
  const body = title.slice(1)
  if (body.length === 0 || conversationId.length === 0) {
    return false
  }
  return conversationId === body || conversationId.startsWith(body)
}

export function unknownScopeKey(sourceInstanceId: string): string {
  return `unknown-source:${sourceInstanceId}`
}

export function accountScopeKey(opaqueId: string): string {
  return `account:${opaqueId}`
}

export function provisionalRequestKey(
  sourceInstanceId: string,
  fileGeneration: number,
  byteOffset: number,
): string {
  return `${sourceInstanceId}:${fileGeneration}:${byteOffset}`
}
