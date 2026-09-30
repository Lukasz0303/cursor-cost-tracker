import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

type ExecGit = (
  args: string[],
  cwd: string,
) => Promise<{ stdout: string; stderr: string }>

const execFileAsync = promisify(execFile)

export type ExecGh = (args: string[]) => Promise<{ stdout: string; stderr: string }>

const GH_TIMEOUT_MS = 30_000
const MAX_AUTHOR_QUERIES = 30
const GH_SEARCH_LIMIT = '1000'

async function defaultExecGh(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync('gh', args, {
    timeout: GH_TIMEOUT_MS,
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  })
  return { stdout: result.stdout, stderr: result.stderr }
}

/** `owner/repo` from a GitHub or GitHub Enterprise remote, or null. */
export function repoSlugFromRemote(url: string): string | null {
  const trimmed = url.trim().replace(/\.git$/i, '').replace(/\/+$/, '')
  const ssh = /^(?:ssh:\/\/)?git@[^:/]+(?::|\/)([^/\s]+)\/([^/\s]+)$/i.exec(trimmed)
  if (ssh?.[1] && ssh[2]) {
    return `${ssh[1]}/${ssh[2]}`.toLowerCase()
  }
  const https = /^https?:\/\/[^/]+\/([^/\s]+)\/([^/\s]+)$/i.exec(trimmed)
  if (https?.[1] && https[2]) {
    return `${https[1]}/${https[2]}`.toLowerCase()
  }
  return null
}

export function parseGhCommitSearch(stdout: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout) as unknown
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) {
    return []
  }
  const seen = new Set<string>()
  const slugs: string[] = []
  for (const row of parsed) {
    if (typeof row !== 'object' || row === null || !('repository' in row)) {
      continue
    }
    const repo = row.repository
    if (typeof repo !== 'object' || repo === null) {
      continue
    }
    const record = repo as {
      nameWithOwner?: unknown
      fullName?: unknown
      name?: unknown
      owner?: { login?: unknown }
    }
    let slug = ''
    if (typeof record.nameWithOwner === 'string') {
      slug = record.nameWithOwner
    } else if (typeof record.fullName === 'string') {
      slug = record.fullName
    } else if (
      typeof record.name === 'string' &&
      typeof record.owner?.login === 'string'
    ) {
      slug = `${record.owner.login}/${record.name}`
    }
    const key = slug.trim().toLowerCase()
    if (key === '' || !key.includes('/') || seen.has(key)) {
      continue
    }
    seen.add(key)
    slugs.push(key)
  }
  return slugs
}

function searchQuery(from: string, to: string, email: string | null): string {
  const who = email === null ? 'author:@me' : `author-email:${email}`
  return `${who} committer-date:${from}..${to}`
}

/**
 * Repo slugs (`owner/name`) the GitHub account committed to in the range.
 * `null` when `gh` is missing or the call fails — caller falls back to folders.
 */
export async function listGhRepoSlugs(
  from: string,
  to: string,
  emails: readonly string[],
  execGh: ExecGh = defaultExecGh,
): Promise<string[] | null> {
  const queries =
    emails.length === 0
      ? [searchQuery(from, to, null)]
      : emails.slice(0, MAX_AUTHOR_QUERIES).map((email) => searchQuery(from, to, email.trim()))
  try {
    const seen = new Set<string>()
    for (const query of queries) {
      const { stdout } = await execGh([
        'search',
        'commits',
        '--limit',
        GH_SEARCH_LIMIT,
        '--json',
        'repository',
        query,
      ])
      for (const slug of parseGhCommitSearch(stdout)) {
        seen.add(slug)
      }
    }
    return [...seen]
  } catch {
    return null
  }
}

export async function matchLocalReposToGh(
  roots: readonly string[],
  slugs: readonly string[],
  execGit: ExecGit,
): Promise<string[]> {
  const wanted = new Set(slugs.map((slug) => slug.toLowerCase()))
  if (wanted.size === 0) {
    return []
  }
  const matched: string[] = []
  for (const root of roots) {
    try {
      const { stdout } = await execGit(['remote', 'get-url', 'origin'], root)
      const slug = repoSlugFromRemote(stdout)
      if (slug !== null && wanted.has(slug)) {
        matched.push(root)
      }
    } catch {
      // no origin
    }
  }
  return matched
}

/**
 * Local folders always stay in the scan. `gh` only adds clones it named.
 * A partial GitHub answer must not drop other programmers' repositories.
 */
export function selectScanRoots(
  directoryRoots: readonly string[],
  ghSlugs: readonly string[] | null,
  matched: readonly string[],
): string[] {
  if (ghSlugs === null || ghSlugs.length === 0 || matched.length === 0) {
    return [...directoryRoots]
  }
  const seen = new Set(
    directoryRoots.map((path) => path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()),
  )
  const out = [...directoryRoots]
  for (const path of matched) {
    const key = path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
    if (key === '' || seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(path)
  }
  return out
}
