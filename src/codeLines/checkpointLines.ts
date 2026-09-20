type DiffHunk = {
  modified?: unknown
}

type CheckpointFile = {
  originalModelDiffWrtV0?: unknown
}

type CheckpointPayload = {
  files?: unknown
}

/** Count inserted lines in one checkpoint blob (fallback when headers lack totals). */
export function countCheckpointInsertedLines(raw: string): number {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return 0
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return 0
  }
  const files = (parsed as CheckpointPayload).files
  if (!Array.isArray(files)) {
    return 0
  }
  let total = 0
  for (const file of files) {
    if (typeof file !== 'object' || file === null) {
      continue
    }
    const diffs = (file as CheckpointFile).originalModelDiffWrtV0
    if (!Array.isArray(diffs)) {
      continue
    }
    for (const hunk of diffs) {
      if (typeof hunk !== 'object' || hunk === null) {
        continue
      }
      const modified = (hunk as DiffHunk).modified
      if (Array.isArray(modified)) {
        total += modified.length
        continue
      }
      if (typeof modified === 'string') {
        total += modified === '' ? 0 : modified.split(/\r?\n/).length
      }
    }
  }
  return total
}

/**
 * Checkpoints are cumulative wrt conversation V0. Prefer the max per composer,
 * never the sum of all checkpoints.
 */
export function maxCheckpointLinesByComposer(
  rows: readonly { composerId: string; insertedLines: number }[],
): Map<string, number> {
  const maxByComposer = new Map<string, number>()
  for (const row of rows) {
    const prev = maxByComposer.get(row.composerId) ?? 0
    if (row.insertedLines > prev) {
      maxByComposer.set(row.composerId, row.insertedLines)
    }
  }
  return maxByComposer
}
