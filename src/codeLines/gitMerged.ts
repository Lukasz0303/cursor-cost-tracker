import type { GitNumstatDay } from './types'

export function localDayKey(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Parse `git log --numstat --format=%ct` style output.
 * Blocks: unix timestamp line, then zero or more `insertions\tdeletions\tpath` lines,
 * blank line optional between commits.
 */
export function parseGitNumstatLog(raw: string): GitNumstatDay[] {
  const byDay = new Map<string, { insertions: number; deletions: number }>()
  let currentTs: number | null = null

  for (const line of raw.split(/\r?\n/)) {
    if (line === '') {
      continue
    }
    if (/^\d+$/.test(line)) {
      currentTs = Number(line) * 1000
      continue
    }
    if (currentTs === null) {
      continue
    }
    const parts = line.split('\t')
    if (parts.length < 3) {
      continue
    }
    const [insRaw, delRaw] = parts
    if (insRaw === undefined || delRaw === undefined) {
      continue
    }
    // Binary files show `-`
    if (insRaw === '-' || delRaw === '-') {
      continue
    }
    const insertions = Number(insRaw)
    const deletions = Number(delRaw)
    if (!Number.isFinite(insertions) || !Number.isFinite(deletions)) {
      continue
    }
    const date = localDayKey(currentTs)
    const prev = byDay.get(date) ?? { insertions: 0, deletions: 0 }
    byDay.set(date, {
      insertions: prev.insertions + insertions,
      deletions: prev.deletions + deletions,
    })
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      insertions: counts.insertions,
      deletions: counts.deletions,
    }))
}
