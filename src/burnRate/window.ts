import type { UsageQuery } from '../usage/types'

export type BurnRateWindow = {
  windowMs: number
  startMs: number
  endMs: number
  queries: UsageQuery[]
  queryCount: number
  costUsd: number
  tokens: number
}

export function windowMsFromMinutes(windowMinutes: number): number {
  return Math.max(0, windowMinutes) * 60_000
}

export function liveWindow(
  queries: readonly UsageQuery[],
  windowMinutes: number,
  nowMs: number,
): BurnRateWindow {
  const windowMs = windowMsFromMinutes(windowMinutes)
  const endMs = nowMs
  const startMs = nowMs - windowMs
  const included: UsageQuery[] = []
  for (const query of queries) {
    if (query.timestamp > nowMs || query.timestamp < startMs) {
      continue
    }
    included.push(query)
  }
  included.sort((left, right) => right.timestamp - left.timestamp)
  let costUsd = 0
  let tokens = 0
  for (const query of included) {
    costUsd += query.costUsd
    tokens += query.tokens
  }
  return {
    windowMs,
    startMs,
    endMs,
    queries: included,
    queryCount: included.length,
    costUsd,
    tokens,
  }
}

export function queryInLiveWindow(
  timestamp: number,
  window: BurnRateWindow,
): boolean {
  return timestamp >= window.startMs && timestamp <= window.endMs
}
