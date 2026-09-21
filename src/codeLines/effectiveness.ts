/**
 * Merge rate = landedOnDefault / aiGenerated.
 * With-branch rate = (landedOnDefault + pendingOnBranch) / aiGenerated.
 * The two git counts are independent of composer totals — not AI − pending.
 */
export function lineVolumeRates(
  aiGenerated: number | null,
  landedOnDefault: number,
  pendingOnBranch: number,
): {
  ai: number | null
  landed: number
  pending: number
  mergeRate: number | null
  accountedRate: number | null
} {
  const landed = Math.max(0, Math.trunc(landedOnDefault))
  const pending = Math.max(0, Math.trunc(pendingOnBranch))
  if (aiGenerated === null || !Number.isFinite(aiGenerated)) {
    return {
      ai: null,
      landed,
      pending,
      mergeRate: null,
      accountedRate: null,
    }
  }
  const ai = Math.max(0, Math.trunc(aiGenerated))
  if (ai <= 0) {
    return {
      ai,
      landed,
      pending,
      mergeRate: null,
      accountedRate: null,
    }
  }
  return {
    ai,
    landed,
    pending,
    mergeRate: landed / ai,
    accountedRate: (landed + pending) / ai,
  }
}

/** Sum `+` column from `git diff --numstat` (no commit timestamps). */
export function parseDiffNumstatInsertions(raw: string): number {
  let total = 0
  for (const line of raw.split(/\r?\n/)) {
    if (line === '') {
      continue
    }
    const parts = line.split('\t')
    if (parts.length < 3) {
      continue
    }
    const insRaw = parts[0]
    if (insRaw === undefined || insRaw === '-') {
      continue
    }
    const insertions = Number(insRaw)
    if (Number.isFinite(insertions)) {
      total += insertions
    }
  }
  return total
}
