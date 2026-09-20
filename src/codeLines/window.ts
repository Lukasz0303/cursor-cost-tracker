import { historyFromDateStartMs, parseHistoryFromDate } from '../historyFromDate'

export const CODE_LINES_FALLBACK_DAYS = 90

export type CodeLinesTimeWindow = {
  sinceMs: number
  untilMs: number
}

function newestSample<T extends { timestamp: number }>(
  queries: readonly T[],
  limit: number,
): T[] {
  const cap = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : 0
  return [...queries]
    .filter((row) => Number.isFinite(row.timestamp) && row.timestamp > 0)
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, cap)
}

/**
 * Same bounds as Last N / From date. Last N → oldest row in the sample.
 * From date → local midnight of that day. Empty sample without a date → 90 days.
 */
export function codeLinesWindowFromSample(input: {
  queries: readonly { timestamp: number }[]
  limit: number
  fromDate?: string | null
  nowMs?: number
}): CodeLinesTimeWindow {
  const nowMs = input.nowMs ?? Date.now()
  const parsed = parseHistoryFromDate(input.fromDate ?? null)
  const fromStart = parsed !== null ? historyFromDateStartMs(parsed) : null
  if (fromStart !== null) {
    return { sinceMs: fromStart, untilMs: nowMs }
  }
  const sample = newestSample(input.queries, input.limit)
  const oldest = sample[sample.length - 1]?.timestamp
  if (oldest !== undefined) {
    return { sinceMs: oldest, untilMs: nowMs }
  }
  return {
    sinceMs: nowMs - CODE_LINES_FALLBACK_DAYS * 24 * 60 * 60 * 1000,
    untilMs: nowMs,
  }
}
