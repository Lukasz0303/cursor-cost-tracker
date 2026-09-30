import { execFile } from 'node:child_process'
import { lstat, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { promisify } from 'node:util'
import {
  MIN_NESTED_GIT_REPOS,
  listNestedIndependentGitRepos,
  mapPool,
  normalizeFsPath,
} from '../codeLines/nestedRepos'
import { resolveDefaultBranch } from '../codeLines/runGitMerged'
import { isValidLeaderboardRange, parseLocalDayEndExclusive, parseLocalDayStart } from './dates'
import {
  listGhRepoSlugs,
  matchLocalReposToGh,
  selectScanRoots,
  type ExecGh,
} from './ghRepos'
import { parseLeaderboardAuthors, parseLeaderboardLog } from './parse'
import type { LeaderboardSources } from './sources'
import type { LeaderboardRepoCommits } from './types'

const execFileAsync = promisify(execFile)

export type ExecGit = (
  args: string[],
  cwd: string,
) => Promise<{ stdout: string; stderr: string }>

const GIT_TIMEOUT_MS = 60_000
const GIT_MAX_BUFFER = 32 * 1024 * 1024
const MAX_SIBLING_REPOS = 200

const SKIP_DIR = new Set([
  '.git',
  '.cursor',
  '.vscode',
  '.next',
  '.venv',
  'venv',
  'node_modules',
  'dist',
  'out',
  'build',
  'coverage',
  'vendor',
  'target',
  '__pycache__',
])

async function defaultExecGit(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync('git', args, {
    cwd,
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: GIT_MAX_BUFFER,
    encoding: 'utf8',
  })
  return { stdout: result.stdout, stderr: result.stderr }
}

async function isGitCheckout(dir: string): Promise<boolean> {
  try {
    const git = await lstat(join(dir, '.git'))
    return git.isDirectory() || git.isFile()
  } catch {
    return false
  }
}

/** Other git checkouts next to `cwd` (same parent folder). Skips `$HOME`. */
export async function listSiblingGitRepos(cwd: string): Promise<string[]> {
  const parent = dirname(cwd)
  if (
    normalizeFsPath(parent) === normalizeFsPath(cwd) ||
    normalizeFsPath(parent) === normalizeFsPath(homedir())
  ) {
    return []
  }
  let names: string[] = []
  try {
    const entries = await readdir(parent, { withFileTypes: true })
    names = entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !SKIP_DIR.has(entry.name) &&
          !entry.name.startsWith('.'),
      )
      .map((entry) => entry.name)
  } catch {
    return []
  }
  const found: string[] = []
  const self = normalizeFsPath(cwd)
  for (const name of names.sort((a, b) => a.localeCompare(b))) {
    if (found.length >= MAX_SIBLING_REPOS) {
      break
    }
    const dir = join(parent, name)
    if (normalizeFsPath(dir) === self) {
      continue
    }
    if (await isGitCheckout(dir)) {
      found.push(dir)
    }
  }
  return found
}

async function listDirNames(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !SKIP_DIR.has(entry.name) &&
          !entry.name.startsWith('.'),
      )
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

/**
 * Git checkouts next to `cwd`, plus cousins one level up
 * (`work/team-a/repo` and `work/team-b/repo`). Skips `$HOME`.
 */
export async function listNearbyGitRepos(cwd: string): Promise<string[]> {
  const parent = dirname(cwd)
  const grand = dirname(parent)
  if (
    normalizeFsPath(grand) === normalizeFsPath(parent) ||
    normalizeFsPath(grand) === normalizeFsPath(homedir()) ||
    normalizeFsPath(parent) === normalizeFsPath(homedir())
  ) {
    return listSiblingGitRepos(cwd)
  }
  const found: string[] = []
  const self = normalizeFsPath(cwd)
  const add = async (dir: string): Promise<void> => {
    if (found.length >= MAX_SIBLING_REPOS) {
      return
    }
    if (normalizeFsPath(dir) === self) {
      return
    }
    if (await isGitCheckout(dir)) {
      found.push(dir)
    }
  }
  for (const name of await listDirNames(grand)) {
    const dir = join(grand, name)
    if (await isGitCheckout(dir)) {
      await add(dir)
      continue
    }
    for (const child of await listDirNames(dir)) {
      await add(join(dir, child))
    }
  }
  return found
}

/**
 * Git checkouts inside a chosen folder: the folder itself, its children,
 * and one level deeper when a child is not a checkout. User-picked, so `$HOME` is allowed.
 */
export async function listCatalogGitRepos(dir: string): Promise<string[]> {
  const root = dir.trim()
  if (root === '') {
    return []
  }
  const found: string[] = []
  const add = async (path: string): Promise<void> => {
    if (found.length >= MAX_SIBLING_REPOS) {
      return
    }
    if (await isGitCheckout(path)) {
      found.push(path)
    }
  }
  await add(root)
  for (const name of await listDirNames(root)) {
    const child = join(root, name)
    if (await isGitCheckout(child)) {
      await add(child)
      continue
    }
    for (const nested of await listDirNames(child)) {
      await add(join(child, nested))
    }
  }
  return uniquePaths(found)
}

export type LeaderboardRepoPreview = {
  path: string
  label: string
  source: 'discovered' | 'extra'
  included: boolean
}

export async function previewLeaderboardRepos(
  cwd: string | null,
  sources: LeaderboardSources,
  options?: {
    listNested?: (cwd: string) => Promise<string[]>
    listSiblings?: (cwd: string) => Promise<string[]>
    execGit?: ExecGit
    isGit?: (dir: string) => Promise<boolean>
  },
): Promise<{ catalogMissing: boolean; repos: LeaderboardRepoPreview[] }> {
  const isGit = options?.isGit ?? isGitCheckout
  const catalog = sources.catalog.trim()
  let catalogMissing = false
  if (catalog !== '') {
    try {
      const stat = await lstat(catalog)
      catalogMissing = !stat.isDirectory()
    } catch {
      catalogMissing = true
    }
  }
  const stored = uniquePaths([...sources.saved, ...sources.extra])
  if (sources.saved.length > 0) {
    return {
      catalogMissing,
      repos: await previewStoredRepos(stored, sources, isGit),
    }
  }
  let discovered: string[] = []
  if (catalog !== '' && !catalogMissing) {
    try {
      const stat = await lstat(catalog)
      catalogMissing = !stat.isDirectory()
    } catch {
      catalogMissing = true
    }
    if (!catalogMissing) {
      discovered = await listCatalogGitRepos(catalog)
    }
  }
  if (catalog === '' || catalogMissing) {
    if (cwd !== null && cwd.trim() !== '') {
      discovered = await leaderboardRoots(
        cwd,
        options?.listNested,
        options?.execGit,
        options?.listSiblings,
      )
    }
  }
  const extra: string[] = []
  for (const path of sources.extra) {
    if (await isGit(path)) {
      extra.push(path)
    }
  }
  return {
    catalogMissing,
    repos: await previewStoredRepos(uniquePaths([...discovered, ...extra]), sources, async () => true),
  }
}

async function previewStoredRepos(
  paths: readonly string[],
  sources: LeaderboardSources,
  isGit: (dir: string) => Promise<boolean>,
): Promise<LeaderboardRepoPreview[]> {
  const extraKeys = new Set(sources.extra.map((path) => normalizeFsPath(path)))
  const excluded = new Set(sources.excluded.map((path) => normalizeFsPath(path)))
  const repos: LeaderboardRepoPreview[] = []
  for (const path of paths) {
    if (!(await isGit(path))) {
      continue
    }
    repos.push({
      path,
      label: basename(path),
      source: extraKeys.has(normalizeFsPath(path)) ? 'extra' : 'discovered',
      included: !excluded.has(normalizeFsPath(path)),
    })
  }
  return repos
}

function uniquePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const path of paths) {
    const key = normalizeFsPath(path)
    if (key === '' || seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(path)
  }
  return out
}

export async function leaderboardRoots(
  cwd: string,
  listNested: (cwd: string) => Promise<string[]> = listNestedIndependentGitRepos,
  execGit: ExecGit = defaultExecGit,
  listSiblings: (cwd: string) => Promise<string[]> = listNearbyGitRepos,
): Promise<string[]> {
  const nested = await listNested(cwd)
  const siblings = await listSiblings(cwd)
  if (nested.length < MIN_NESTED_GIT_REPOS) {
    return uniquePaths([cwd, ...siblings])
  }
  const parentBranch = await resolveDefaultBranch(cwd, execGit)
  const here = parentBranch === null ? nested : [cwd, ...nested]
  return uniquePaths([...here, ...siblings])
}

function logArgs(sinceMs: number, untilMs: number, numstat: boolean): string[] {
  const args = [
    'log',
    '--branches',
    '--remotes',
    '--no-merges',
    '--format=%H%x09%ct%x09%ae%x09%an',
    `--since=${new Date(sinceMs).toISOString()}`,
    `--until=${new Date(untilMs).toISOString()}`,
  ]
  if (numstat) {
    args.splice(4, 0, '--numstat')
  }
  return args
}

export type LeaderboardScanPiece = {
  groups: LeaderboardRepoCommits[]
  reposScanned: number
  reposSkipped: number
}

async function scanRoot(
  cwd: string,
  sinceMs: number,
  untilMs: number,
  execGit: ExecGit,
  numstat: boolean,
): Promise<LeaderboardRepoCommits | null> {
  try {
    const { stdout } = await execGit(logArgs(sinceMs, untilMs, numstat), cwd)
    return {
      path: cwd,
      label: basename(cwd),
      commits: parseLeaderboardLog(stdout),
    }
  } catch {
    return null
  }
}

export async function scanLeaderboardRepos(
  cwd: string,
  from: string,
  to: string,
  options?: {
    execGit?: ExecGit
    execGh?: ExecGh
    authorEmails?: readonly string[]
    listNested?: (cwd: string) => Promise<string[]>
    listSiblings?: (cwd: string) => Promise<string[]>
    numstat?: boolean
    sources?: LeaderboardSources
  },
): Promise<LeaderboardScanPiece> {
  if (!isValidLeaderboardRange(from, to)) {
    return { groups: [], reposScanned: 0, reposSkipped: 0 }
  }
  const sinceMs = parseLocalDayStart(from)
  const untilMs = parseLocalDayEndExclusive(to)
  if (sinceMs === null || untilMs === null) {
    return { groups: [], reposScanned: 0, reposSkipped: 0 }
  }
  const execGit = options?.execGit ?? defaultExecGit
  const preview = await previewLeaderboardRepos(
    cwd,
    options?.sources ?? { catalog: '', saved: [], extra: [], excluded: [] },
    {
    listNested: options?.listNested,
    listSiblings: options?.listSiblings,
    execGit,
  })
  const directoryRoots = preview.repos.filter((repo) => repo.included).map((repo) => repo.path)
  const ghSlugs = await listGhRepoSlugs(
    from,
    to,
    options?.authorEmails ?? [],
    options?.execGh,
  )
  const matched =
    ghSlugs === null ? [] : await matchLocalReposToGh(directoryRoots, ghSlugs, execGit)
  const roots = selectScanRoots(directoryRoots, ghSlugs, matched)
  const numstat = options?.numstat ?? true
  const parts = await mapPool(roots, 4, (root) =>
    scanRoot(root, sinceMs, untilMs, execGit, numstat),
  )
  const groups = parts.filter((part): part is LeaderboardRepoCommits => part !== null)
  return {
    groups,
    reposScanned: groups.length,
    reposSkipped: parts.length - groups.length,
  }
}

export async function listLeaderboardAuthors(
  cwd: string,
  from: string,
  to: string,
  options?: {
    execGit?: ExecGit
    listNested?: (cwd: string) => Promise<string[]>
    listSiblings?: (cwd: string) => Promise<string[]>
    sources?: LeaderboardSources
  },
): Promise<{ email: string; name: string }[]> {
  const piece = await scanLeaderboardRepos(cwd, from, to, {
    ...options,
    numstat: false,
  })
  const raw = piece.groups
    .flatMap((group) => group.commits)
    .map(
      (commit) =>
        `${commit.hash}\t${Math.floor(commit.timestampMs / 1000)}\t${commit.email}\t${commit.name}`,
    )
    .join('\n')
  return parseLeaderboardAuthors(raw)
}
