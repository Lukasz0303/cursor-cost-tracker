import { normalizeEmail } from '../codeLines/authorChoice'
import { localDayKey, eachLocalDay } from './dates'
import type {
  LeaderboardChart,
  LeaderboardRepo,
  LeaderboardRepoCommits,
  LeaderboardRow,
} from './types'

type Bucket = {
  email: string
  emails: string[]
  name: string
  linesMerged: number
  commits: number
  linesDeleted: number
  days: Set<string>
  byDay: Map<string, number>
  repos: Map<string, LeaderboardRepo>
}

function repoKey(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function collectLeaderboard(
  groups: readonly LeaderboardRepoCommits[],
  selectedEmails: readonly string[],
  merges: readonly (readonly string[])[] = [],
): { bucket: Bucket; row: LeaderboardRow }[] {
  const selected = new Map<string, string>()
  for (const raw of selectedEmails) {
    const email = raw.trim()
    const key = normalizeEmail(email)
    if (key === '' || !key.includes('@') || selected.has(key)) {
      continue
    }
    selected.set(key, email)
  }

  const alias = new Map<string, string>()
  const mergedEmails = new Map<string, string[]>()
  for (const merge of merges) {
    const members: string[] = []
    let canon = ''
    for (const raw of merge) {
      const key = normalizeEmail(raw)
      const email = selected.get(key)
      if (email === undefined || members.includes(email)) {
        continue
      }
      if (canon === '') {
        canon = key
      }
      alias.set(key, canon)
      members.push(email)
    }
    if (canon !== '' && members.length >= 2) {
      mergedEmails.set(canon, members)
    }
  }

  const buckets = new Map<string, Bucket>()
  for (const [key, email] of selected) {
    const canon = alias.get(key) ?? key
    if (buckets.has(canon)) {
      continue
    }
    const emails = mergedEmails.get(canon) ?? [email]
    buckets.set(canon, {
      email: emails[0] ?? email,
      emails,
      name: emails[0] ?? email,
      linesMerged: 0,
      commits: 0,
      linesDeleted: 0,
      days: new Set(),
      byDay: new Map(),
      repos: new Map(),
    })
  }

  for (const group of groups) {
    const keyPath = repoKey(group.path)
    for (const commit of group.commits) {
      const key = normalizeEmail(commit.email)
      const bucket = buckets.get(alias.get(key) ?? key)
      if (bucket === undefined) {
        continue
      }
      const named = commit.name.trim()
      if (named !== '' && bucket.emails.some((email) => normalizeEmail(email) === normalizeEmail(bucket.name))) {
        bucket.name = named
      }
      bucket.linesMerged += commit.insertions
      bucket.linesDeleted += commit.deletions
      bucket.commits += 1
      const day = localDayKey(commit.timestampMs)
      bucket.days.add(day)
      bucket.byDay.set(day, (bucket.byDay.get(day) ?? 0) + commit.insertions)
      const repo = bucket.repos.get(keyPath)
      if (repo === undefined) {
        bucket.repos.set(keyPath, {
          label: group.label,
          path: group.path,
          linesMerged: commit.insertions,
        })
      } else {
        repo.linesMerged += commit.insertions
      }
    }
  }

  return [...buckets.values()]
    .map((bucket) => ({
      bucket,
      row: {
        email: bucket.email,
        emails: bucket.emails,
        name: bucket.name,
        linesMerged: bucket.linesMerged,
        commits: bucket.commits,
        linesDeleted: bucket.linesDeleted,
        netLines: bucket.linesMerged - bucket.linesDeleted,
        activeDays: bucket.days.size,
        repositories: [...bucket.repos.values()].sort((left, right) => {
          if (right.linesMerged !== left.linesMerged) {
            return right.linesMerged - left.linesMerged
          }
          return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
        }),
      },
    }))
    .sort((left, right) => {
      if (right.row.linesMerged !== left.row.linesMerged) {
        return right.row.linesMerged - left.row.linesMerged
      }
      if (right.row.commits !== left.row.commits) {
        return right.row.commits - left.row.commits
      }
      return left.row.email.localeCompare(right.row.email, undefined, {
        sensitivity: 'base',
      })
    })
}

export function aggregateLeaderboard(
  groups: readonly LeaderboardRepoCommits[],
  selectedEmails: readonly string[],
  merges: readonly (readonly string[])[] = [],
): LeaderboardRow[] {
  return collectLeaderboard(groups, selectedEmails, merges).map((item) => item.row)
}

export function leaderboardDailyChart(
  groups: readonly LeaderboardRepoCommits[],
  selectedEmails: readonly string[],
  merges: readonly (readonly string[])[],
  from: string,
  to: string,
): LeaderboardChart {
  const dates = eachLocalDay(from, to)
  const series = collectLeaderboard(groups, selectedEmails, merges).map((item) => ({
    email: item.row.email,
    name: item.row.name,
    lines: dates.map((date) => item.bucket.byDay.get(date) ?? 0),
  }))
  return { dates, series }
}
