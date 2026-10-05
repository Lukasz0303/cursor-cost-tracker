import { normalizeEmail } from './authorChoice'
import { localDayKey } from './gitMerged'
import type { ExecGit } from './execGit'
import type { GitNumstatDay } from './types'
import {
  parseFirstParentMerges,
  parseLeaderboardLog,
  parseRangeAuthors,
  type FirstParentMerge,
} from '../leaderboard/parse'
import type { ParsedLeaderboardCommit } from '../leaderboard/types'
import { mapPool } from './nestedRepos'

function gitIsoBound(ms: number): string {
  return new Date(ms).toISOString()
}

function directLogArgs(
  sinceMs: number,
  untilMs: number,
  branchRef: string,
): string[] {
  return [
    'log',
    '--first-parent',
    '--no-merges',
    '--numstat',
    '--format=%H%x09%ct%x09%ae%x09%an',
    `--since=${gitIsoBound(sinceMs)}`,
    `--until=${gitIsoBound(untilMs)}`,
    branchRef,
  ]
}

function mergeListArgs(
  sinceMs: number,
  untilMs: number,
  branchRef: string,
): string[] {
  return [
    'log',
    '--first-parent',
    '--merges',
    '--format=%H%x09%ct%x09%P',
    `--since=${gitIsoBound(sinceMs)}`,
    `--until=${gitIsoBound(untilMs)}`,
    branchRef,
  ]
}

/**
 * One GitHub-style merge: credit the landed diff to the branch author(s),
 * not the person who clicked Merge (same rules as the leaderboard scan).
 */
async function commitsFromMerge(
  cwd: string,
  merge: FirstParentMerge,
  execGit: ExecGit,
): Promise<ParsedLeaderboardCommit[]> {
  const range = `${merge.firstParent}..${merge.secondParent}`
  const { stdout: authorLog } = await execGit(
    ['log', '--no-merges', '--format=%ae%x09%an', range],
    cwd,
  )
  const authors = parseRangeAuthors(authorLog)
  if (authors.length === 0) {
    return []
  }
  if (authors.length > 1) {
    const { stdout } = await execGit(
      [
        'log',
        '--no-merges',
        '--numstat',
        '--format=%H%x09%ct%x09%ae%x09%an',
        range,
      ],
      cwd,
    )
    return parseLeaderboardLog(stdout).map((commit) => ({
      ...commit,
      timestampMs: merge.timestampMs,
    }))
  }
  const author = authors[0]
  if (author === undefined) {
    return []
  }
  const unix = Math.floor(merge.timestampMs / 1000)
  const header = `${merge.hash}\t${unix}\t${author.email}\t${author.name}\n`
  const { stdout } = await execGit(
    ['diff', '--numstat', merge.firstParent, merge.hash],
    cwd,
  )
  return parseLeaderboardLog(header + stdout)
}

/** First-parent landings on the default branch (direct commits + merge diffs). */
export async function collectLandedCommits(
  cwd: string,
  branchRef: string,
  sinceMs: number,
  untilMs: number,
  execGit: ExecGit,
): Promise<ParsedLeaderboardCommit[]> {
  const { stdout } = await execGit(
    directLogArgs(sinceMs, untilMs, branchRef),
    cwd,
  )
  const direct = parseLeaderboardLog(stdout)
  let landed: ParsedLeaderboardCommit[] = []
  try {
    const listed = await execGit(mergeListArgs(sinceMs, untilMs, branchRef), cwd)
    const merges = parseFirstParentMerges(listed.stdout)
    const parts = await mapPool(merges, 4, (merge) =>
      commitsFromMerge(cwd, merge, execGit),
    )
    landed = parts.flat()
  } catch {
    landed = []
  }
  return [...direct, ...landed]
}

/** Keep only selected git emails, then bucket insertions by local day. */
export function daysForAuthorEmails(
  commits: readonly ParsedLeaderboardCommit[],
  emails: readonly string[],
): GitNumstatDay[] {
  const allowed = new Set(
    emails.map(normalizeEmail).filter((email) => email !== ''),
  )
  if (allowed.size === 0) {
    return []
  }
  const byDay = new Map<string, { insertions: number; deletions: number }>()
  for (const commit of commits) {
    if (!allowed.has(normalizeEmail(commit.email))) {
      continue
    }
    const date = localDayKey(commit.timestampMs)
    const prev = byDay.get(date) ?? { insertions: 0, deletions: 0 }
    byDay.set(date, {
      insertions: prev.insertions + commit.insertions,
      deletions: prev.deletions + commit.deletions,
    })
  }
  return [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, counts]) => ({
      date,
      insertions: counts.insertions,
      deletions: counts.deletions,
    }))
}
