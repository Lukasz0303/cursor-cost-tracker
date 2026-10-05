import { normalizeEmail } from '../codeLines/authorChoice'
import type { ParsedLeaderboardCommit } from './types'

const COMMIT_HEADER = /^([0-9a-f]{7,64})\t(\d+)\t([^\t]*)\t([\s\S]*)$/i

const MERGE_PARENTS = /^([0-9a-f]{7,64})\t(\d+)\t([0-9a-f]{7,64}(?: [0-9a-f]{7,64})+)\s*$/i

export type FirstParentMerge = {
  hash: string
  timestampMs: number
  firstParent: string
  secondParent: string
}

/**
 * `git log --first-parent --merges --format=%H%x09%ct%x09%P`.
 * Parent 1 is the default branch; parent 2 is the branch that landed.
 */
export function parseFirstParentMerges(raw: string): FirstParentMerge[] {
  const merges: FirstParentMerge[] = []
  for (const line of raw.split(/\r?\n/)) {
    const match = MERGE_PARENTS.exec(line.trim())
    if (match === null) {
      continue
    }
    const unix = Number(match[2])
    const parents = (match[3] ?? '').split(' ')
    const firstParent = parents[0]
    const secondParent = parents[1]
    if (!Number.isFinite(unix) || firstParent === undefined || secondParent === undefined) {
      continue
    }
    merges.push({
      hash: match[1] ?? '',
      timestampMs: unix * 1000,
      firstParent,
      secondParent,
    })
  }
  return merges
}

/** Unique authors of `git log --format=%ae%x09%an` (first seen name wins). */
export function parseRangeAuthors(raw: string): { email: string; name: string }[] {
  const seen = new Map<string, { email: string; name: string }>()
  for (const line of raw.split(/\r?\n/)) {
    const tab = line.indexOf('\t')
    if (tab <= 0) {
      continue
    }
    const email = line.slice(0, tab).trim()
    const name = line.slice(tab + 1).trim()
    const key = email.toLowerCase()
    if (!email.includes('@') || seen.has(key)) {
      continue
    }
    seen.set(key, { email, name: name === '' ? email : name })
  }
  return [...seen.values()]
}

/**
 * Parse `git log --numstat` (or a merge diff prefixed with the same header).
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
