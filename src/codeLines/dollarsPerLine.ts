/** Display scale: windowUsd / lines * this (= dollars per 1k lines). */
export const LINES_PER_DOLLAR_RATE = 1000

export type LineDollarRates = {
  /** Sum of costUsd for queries inside the code-lines window. */
  windowUsd: number
  /** windowUsd / onMaster * 1000. Null when onMaster is 0 or unknown. */
  usdPerLandedLine: number | null
  /** windowUsd / ai * 1000. Null when ai is null or 0. */
  usdPerAiLine: number | null
}

export type WindowCostQuery = {
  timestamp: number
  costUsd: number
}

/**
 * Sum costUsd for queries in [startMs, endMs] inclusive.
 * Matches composersInWindow (`ms >= start && ms <= end`).
 * Non-finite costUsd is skipped so one bad event cannot NaN the card.
 */
export function sumWindowCostUsd(
  queries: readonly WindowCostQuery[],
  startMs: number,
  endMs: number,
): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return 0
  }
  let total = 0
  for (const row of queries) {
    if (!Number.isFinite(row.timestamp) || row.timestamp <= 0) {
      continue
    }
    if (row.timestamp < startMs || row.timestamp > endMs) {
      continue
    }
    if (!Number.isFinite(row.costUsd)) {
      continue
    }
    total += row.costUsd
  }
  return total
}

function positiveVolume(n: number | null): number | null {
  if (n === null || !Number.isFinite(n) || n <= 0) {
    return null
  }
  return n
}

export function dollarsPerLine(input: {
  windowUsd: number
  landed: number | null
  ai: number | null
}): LineDollarRates {
  const windowUsd = Number.isFinite(input.windowUsd) ? input.windowUsd : 0
  const dollarsOk = Number.isFinite(input.windowUsd) && input.windowUsd >= 0
  const landed = positiveVolume(input.landed)
  const ai = positiveVolume(input.ai)

  return {
    windowUsd,
    usdPerLandedLine:
      dollarsOk && landed !== null
        ? (windowUsd / landed) * LINES_PER_DOLLAR_RATE
        : null,
    usdPerAiLine:
      dollarsOk && ai !== null
        ? (windowUsd / ai) * LINES_PER_DOLLAR_RATE
        : null,
  }
}
