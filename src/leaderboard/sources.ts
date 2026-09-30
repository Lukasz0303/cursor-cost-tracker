import { basename } from 'node:path'
import { normalizeFsPath } from '../codeLines/nestedRepos'

/** Extension-global scan folder and the saved repository list. Same on every workspace. */
export type LeaderboardSources = {
  catalog: string
  /** Repositories accumulated from scan folders. The list only grows. */
  saved: string[]
  extra: string[]
  /** Paths left out of the scan. Missing means included. */
  excluded: string[]
}

export const EMPTY_LEADERBOARD_SOURCES: LeaderboardSources = {
  catalog: '',
  saved: [],
  extra: [],
  excluded: [],
}

const MAX_EXTRA = 200

export function parseLeaderboardSources(raw: unknown): LeaderboardSources {
  if (typeof raw !== 'object' || raw === null) {
    return { catalog: '', saved: [], extra: [], excluded: [] }
  }
  const record = raw as { catalog?: unknown; saved?: unknown; extra?: unknown; excluded?: unknown }
  const catalog = typeof record.catalog === 'string' ? record.catalog.trim() : ''
  return {
    catalog,
    saved: uniqueSourcePaths(record.saved),
    extra: uniqueSourcePaths(record.extra),
    excluded: uniqueSourcePaths(record.excluded),
  }
}

export function repoNameKey(path: string): string {
  return basename(path.trim()).toLowerCase()
}

function uniqueSourcePaths(raw: unknown): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  if (!Array.isArray(raw)) {
    return out
  }
  for (const item of raw) {
    if (typeof item !== 'string') {
      continue
    }
    const path = item.trim()
    const key = normalizeFsPath(path)
    if (key === '' || seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(path)
    if (out.length >= MAX_EXTRA) {
      break
    }
  }
  return out
}

export function withoutExtraPath(
  sources: LeaderboardSources,
  path: string,
): LeaderboardSources {
  const key = normalizeFsPath(path)
  return {
    catalog: sources.catalog,
    saved: sources.saved.filter((item) => normalizeFsPath(item) !== key),
    extra: sources.extra.filter((item) => normalizeFsPath(item) !== key),
    excluded: sources.excluded.filter((item) => normalizeFsPath(item) !== key),
  }
}

export function withExtraPath(
  sources: LeaderboardSources,
  path: string,
): LeaderboardSources {
  const trimmed = path.trim()
  const key = normalizeFsPath(trimmed)
  if (key === '' || knownRepoNames(sources).has(repoNameKey(trimmed))) {
    return sources
  }
  return {
    catalog: sources.catalog,
    saved: sources.saved,
    extra: [...sources.extra, trimmed].slice(0, MAX_EXTRA),
    excluded: sources.excluded,
  }
}

export function appendSavedRepos(
  sources: LeaderboardSources,
  paths: readonly string[],
): { sources: LeaderboardSources; added: number; skipped: number } {
  const names = knownRepoNames(sources)
  const saved = [...sources.saved]
  let added = 0
  let skipped = 0
  for (const path of paths) {
    const trimmed = path.trim()
    const name = repoNameKey(trimmed)
    if (name === '' || names.has(name)) {
      skipped++
      continue
    }
    names.add(name)
    saved.push(trimmed)
    added++
    if (saved.length >= MAX_EXTRA) {
      break
    }
  }
  return {
    sources: {
      catalog: sources.catalog,
      saved,
      extra: sources.extra,
      excluded: sources.excluded,
    },
    added,
    skipped,
  }
}

function knownRepoNames(sources: LeaderboardSources): Set<string> {
  const names = new Set<string>()
  for (const path of [...sources.saved, ...sources.extra]) {
    const name = repoNameKey(path)
    if (name !== '') {
      names.add(name)
    }
  }
  return names
}

export function setRepoIncluded(
  sources: LeaderboardSources,
  path: string,
  included: boolean,
): LeaderboardSources {
  const trimmed = path.trim()
  const key = normalizeFsPath(trimmed)
  if (key === '') {
    return sources
  }
  const excluded = sources.excluded.filter((item) => normalizeFsPath(item) !== key)
  if (!included) {
    excluded.push(trimmed)
  }
  return {
    catalog: sources.catalog,
    saved: sources.saved,
    extra: sources.extra,
    excluded: excluded.slice(0, MAX_EXTRA),
  }
}
