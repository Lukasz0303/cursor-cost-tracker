import { normalizeEmail } from '../codeLines/authorChoice'
import type { ParsedLeaderboardCommit } from './types'

const COMMIT_HEADER = /^([0-9a-f]{7,64})\t(\d+)\t([^\t]*)\t([\s\S]*)$/i

/**
 * Parse `git log --no-merges --numstat --format=%H%x09%ct%x09%ae%x09%an`.
 * Binary numstat (`-`) is skipped. A commit with no text lines still counts.
 */
export function parseLeaderboardLog(raw: string): ParsedLeaderboardCommit[] {
  const commits: ParsedLeaderboardCommit[] = []
  let current: ParsedLeaderboardCommit | null = null

  const flush = (): void => {
    if (current === null) {
      return
    }
    commits.push(current)
    current = null
  }

  for (const line of raw.split(/\r?\n/)) {
    if (line === '') {
      continue
    }
    const header = COMMIT_HEADER.exec(line)
    if (header !== null) {
      flush()
      const hash = header[1] ?? ''
      const unix = Number(header[2])
      const email = (header[3] ?? '').trim()
      const name = (header[4] ?? '').trim()
      if (email === '' || !email.includes('@') || !Number.isFinite(unix)) {
        continue
      }
      current = {
        hash,
        timestampMs: unix * 1000,
        email,
        name: name === '' ? email : name,
        insertions: 0,
        deletions: 0,
      }
      continue
    }
    if (current === null) {
      continue
    }
    const parts = line.split('\t')
    if (parts.length < 3) {
      continue
    }
    const insRaw = parts[0]
    const delRaw = parts[1]
    if (insRaw === undefined || delRaw === undefined) {
      continue
    }
    if (insRaw === '-' || delRaw === '-') {
      continue
    }
    const insertions = Number(insRaw)
    const deletions = Number(delRaw)
    if (!Number.isFinite(insertions) || !Number.isFinite(deletions)) {
      continue
    }
    current.insertions += insertions
    current.deletions += deletions
  }
  flush()
  return commits
}

export function parseLeaderboardAuthors(
  raw: string,
): { email: string; name: string }[] {
  const byEmail = new Map<string, { email: string; name: string }>()
  for (const commit of parseLeaderboardLog(raw)) {
    const key = normalizeEmail(commit.email)
    if (byEmail.has(key)) {
      continue
    }
    byEmail.set(key, { email: commit.email.trim(), name: commit.name })
  }
  return [...byEmail.values()].sort((left, right) =>
    left.email.localeCompare(right.email, undefined, { sensitivity: 'base' }),
  )
}
