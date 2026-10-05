/** Fingerprint for session/title reuse across paints of the same sample. */
export function panelIoCacheKey(
  workspacePath: string | null,
  queries: readonly { timestamp: number }[],
): string {
  let newest = 0
  for (const query of queries) {
    if (query.timestamp > newest) {
      newest = query.timestamp
    }
  }
  return `${workspacePath ?? ''}\0${queries.length}\0${newest}`
}

/** Cached session/titles when the sample fingerprint still matches. */
export function takePanelIoCache<T>(
  cache: { key: string; value: T } | null,
  key: string,
): T | undefined {
  if (cache === null || cache.key !== key) {
    return undefined
  }
  return cache.value
}
