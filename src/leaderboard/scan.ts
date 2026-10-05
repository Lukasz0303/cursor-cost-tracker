import { lstat, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import {
  createExecGit,
  GIT_SCAN_MAX_BUFFER,
  GIT_SCAN_TIMEOUT_MS,
  type ExecGit,
} from '../codeLines/execGit'
import {
  GIT_SKIP_DIRS,
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
import {
  parseFirstParentMerges,
  parseLeaderboardAuthors,
  parseLeaderboardLog,
  parseRangeAuthors,
  type FirstParentMerge,
} from './parse'
import type { LeaderboardSources } from './sources'
import type { LeaderboardRepoCommits, ParsedLeaderboardCommit } from './types'

export type { ExecGit }

const MAX_SIBLING_REPOS = 200

const defaultExecGit = createExecGit({
  timeoutMs: GIT_SCAN_TIMEOUT_MS,
  maxBuffer: GIT_SCAN_MAX_BUFFER,
})

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
          !GIT_SKIP_DIRS.has(entry.name) &&
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
          !GIT_SKIP_DIRS.has(entry.name) &&
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

/**
 * First-parent history of the default branch (`origin/main` when that
 * ref exists, otherwise the local branch). Commits that landed on
 * main/master, not every feature branch. GitHub merge commits stay in
 * the walk: `--no-merges` would drop "Merge pull request #N" and hide
 * the author whose branch actually landed.
 */
async function mergedBranchRef(cwd: string, execGit: ExecGit): Promise<string | null> {
  const branch = await resolveDefaultBranch(cwd, execGit)
  if (branch === null) {
    return null
  }
  const remote = `origin/${branch}`
  try {
    await execGit(['rev-parse', '--verify', remote], cwd)
    return remote
  } catch {
    return branch
  }
}

function logArgs(
  sinceMs: number,
  untilMs: number,
  numstat: boolean,
  branchRef: string,
): string[] {
  const args = ['log', '--first-parent', '--no-merges']
  if (numstat) {
    args.push('--numstat')
  }
  args.push(
    '--format=%H%x09%ct%x09%ae%x09%an',
    `--since=${new Date(sinceMs).toISOString()}`,
    `--until=${new Date(untilMs).toISOString()}`,
    branchRef,
  )
  return args
}

function mergeListArgs(sinceMs: number, untilMs: number, branchRef: string): string[] {
  return [
    'log',
    '--first-parent',
    '--merges',
    '--format=%H%x09%ct%x09%P',
    `--since=${new Date(sinceMs).toISOString()}`,
    `--until=${new Date(untilMs).toISOString()}`,
    branchRef,
  ]
}

/** One GitHub-style merge: the diff that landed, credited to the branch author. */
async function commitsFromMerge(
  cwd: string,
  merge: FirstParentMerge,
  execGit: ExecGit,
  numstat: boolean,
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
    const args = ['log', '--no-merges']
    if (numstat) {
      args.push('--numstat')
    }
    args.push('--format=%H%x09%ct%x09%ae%x09%an', range)
    const { stdout } = await execGit(args, cwd)
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
  if (!numstat) {
    return parseLeaderboardLog(header)
  }
  const { stdout } = await execGit(
    ['diff', '--numstat', merge.firstParent, merge.hash],
    cwd,
  )
  return parseLeaderboardLog(header + stdout)
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
    const branchRef = await mergedBranchRef(cwd, execGit)
    if (branchRef === null) {
      return null
    }
    const { stdout } = await execGit(logArgs(sinceMs, untilMs, numstat, branchRef), cwd)
    const direct = parseLeaderboardLog(stdout)
    let landed: ParsedLeaderboardCommit[] = []
    try {
      const listed = await execGit(mergeListArgs(sinceMs, untilMs, branchRef), cwd)
      const merges = parseFirstParentMerges(listed.stdout)
      const parts = await mapPool(merges, 4, (merge) =>
        commitsFromMerge(cwd, merge, execGit, numstat),
      )
      landed = parts.flat()
    } catch {
      landed = []
    }
    return {
      path: cwd,
      label: basename(cwd),
      commits: [...direct, ...landed],
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
