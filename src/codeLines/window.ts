import { resolveHistorySample, codeLinesUntilMs } from '../historySample'

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
 * Same bounds as Last N / From–To. Last N → oldest row in the sample.
 * Calendar → local midnight of From through now (To open/today) or end of To.
 * Empty sample without a date → 90 days.
 */
export function codeLinesWindowFromSample(input: {
  queries: readonly { timestamp: number }[]
  limit: number
  fromDate?: string | null
  toDate?: string | null
  nowMs?: number
}): CodeLinesTimeWindow {
  const nowMs = input.nowMs ?? Date.now()
  const sample = resolveHistorySample({
    historyLimit: input.limit,
    historyFromDate: input.fromDate ?? null,
    historyToDate: input.toDate ?? null,
    now: new Date(nowMs),
  })
  if (sample.mode === 'calendar') {
    return {
      sinceMs: sample.startMs,
      untilMs: codeLinesUntilMs(sample, nowMs),
    }
  }
  const rows = newestSample(input.queries, sample.fetchLimit)
  const oldest = rows[rows.length - 1]?.timestamp
  if (oldest !== undefined) {
    return { sinceMs: oldest, untilMs: nowMs }
  }
  return {
    sinceMs: nowMs - CODE_LINES_FALLBACK_DAYS * 24 * 60 * 60 * 1000,
    untilMs: nowMs,
  }
}
