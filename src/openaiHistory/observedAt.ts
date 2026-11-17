const KNOWN_HISTORY_MS = Date.UTC(1980, 0, 1)

/** Epoch and blank stamps are missing metadata, not a real session time. */
export function isUnknownObservedAt(value: string | null | undefined): boolean {
  if (value === null || value === undefined) {
    return true
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return true
  }
  const ms = Date.parse(trimmed)
  if (!Number.isFinite(ms) || ms < KNOWN_HISTORY_MS) {
    return true
  }
  return false
}

/** Earlier real instant. An unknown side never wins over a real one. */
export function earlierObservedAt(
  left: string | null,
  right: string | null,
): string | null {
  const leftKnown = !isUnknownObservedAt(left)
  const rightKnown = !isUnknownObservedAt(right)
  if (!leftKnown) {
    return rightKnown ? right : left
  }
  if (!rightKnown) {
    return left
  }
  return left! <= right! ? left : right
}

/** Later real instant. An unknown side never wins over a real one. */
export function laterObservedAt(
  left: string | null,
  right: string | null,
): string | null {
  const leftKnown = !isUnknownObservedAt(left)
  const rightKnown = !isUnknownObservedAt(right)
  if (!leftKnown) {
    return rightKnown ? right : left
  }
  if (!rightKnown) {
    return left
  }
  return left! >= right! ? left : right
}
