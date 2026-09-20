import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pickDefaultBranch } from './defaultBranch'
import { parseDiffNumstatInsertions } from './effectiveness'
import {
  gitAuthorLogArgsForEmails,
  mergeAuthorChoices,
  parseGitAuthorPorcelain,
  resolveAuthorChoice,
  selectedAuthorEmails,
  type CodeLinesAuthorChoice,
  type StoredAuthorChoice,
} from './authorChoice'
import { parseGitConfigValue, type GitAuthorIdentity } from './gitAuthor'
import { parseGitNumstatLog } from './gitMerged'
import {
  listNestedIndependentGitRepos,
  mapPool,
  mergeGitNumstatDays,
  MIN_NESTED_GIT_REPOS,
} from './nestedRepos'
import type { GitNumstatDay } from './types'

const execFileAsync = promisify(execFile)

export type RunGitMergedOptions = {
  cwd: string
  /** Look back this many days when `sinceMs` is omitted (default 90). */
  sinceDays?: number
  sinceMs?: number
  untilMs?: number
  /** Cursor account email — default git identity to count. */
  cursorEmail?: string | null
  savedAuthors?: StoredAuthorChoice | null
  listNestedGitRepos?: (cwd: string) => Promise<string[]>
  execGit?: (
    args: string[],
    cwd: string,
  ) => Promise<{ stdout: string; stderr: string }>
}

async function defaultExecGit(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync('git', args, {
    cwd,
    timeout: 15_000,
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  })
  return { stdout: result.stdout, stderr: result.stderr }
}

async function listLocalBranches(
  execGit: NonNullable<RunGitMergedOptions['execGit']>,
  cwd: string,
): Promise<string[]> {
  try {
    const { stdout } = await execGit(
      ['branch', '--format=%(refname:short)'],
      cwd,
    )
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

async function originHeadShort(
  execGit: NonNullable<RunGitMergedOptions['execGit']>,
  cwd: string,
): Promise<string | null> {
  try {
    const { stdout } = await execGit(
      ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
      cwd,
    )
    const name = stdout.trim().replace(/^origin\//, '')
    return name === '' ? null : name
  } catch {
    return null
  }
}

export async function resolveDefaultBranch(
  cwd: string,
  execGit: NonNullable<RunGitMergedOptions['execGit']> = defaultExecGit,
): Promise<string | null> {
  const branches = await listLocalBranches(execGit, cwd)
  const origin = await originHeadShort(execGit, cwd)
  return pickDefaultBranch(branches, origin)
}

async function safeGitText(
  execGit: NonNullable<RunGitMergedOptions['execGit']>,
  cwd: string,
  args: string[],
): Promise<string> {
  try {
    const { stdout } = await execGit(args, cwd)
    return stdout
  } catch {
    return ''
  }
}

async function safeDiffInsertions(
  execGit: NonNullable<RunGitMergedOptions['execGit']>,
  cwd: string,
  args: string[],
): Promise<number> {
  const stdout = await safeGitText(execGit, cwd, args)
  return parseDiffNumstatInsertions(stdout)
}

export async function readGitAuthorIdentity(
  cwd: string,
  execGit: NonNullable<RunGitMergedOptions['execGit']> = defaultExecGit,
): Promise<GitAuthorIdentity> {
  const emailRaw = await safeGitText(execGit, cwd, ['config', 'user.email'])
  const nameRaw = await safeGitText(execGit, cwd, ['config', 'user.name'])
  return {
    email: parseGitConfigValue(emailRaw),
    name: parseGitConfigValue(nameRaw),
  }
}

async function defaultBranchRef(
  cwd: string,
  short: string,
  execGit: NonNullable<RunGitMergedOptions['execGit']>,
): Promise<string> {
  const remote = `origin/${short}`
  try {
    await execGit(['rev-parse', '--verify', remote], cwd)
    return remote
  } catch {
    return short
  }
}

function gitIsoBound(ms: number): string {
  return new Date(ms).toISOString()
}

function resolveBounds(options: RunGitMergedOptions): {
  sinceMs: number
  untilMs: number
} {
  const untilMs = options.untilMs ?? Date.now()
  if (options.sinceMs !== undefined && Number.isFinite(options.sinceMs)) {
    return { sinceMs: options.sinceMs, untilMs }
  }
  const sinceDays = options.sinceDays ?? 90
  const since = new Date(untilMs)
  since.setDate(since.getDate() - sinceDays)
  return { sinceMs: since.getTime(), untilMs }
}

async function listBranchAuthors(
  cwd: string,
  branchRef: string,
  sinceMs: number,
  untilMs: number,
  execGit: NonNullable<RunGitMergedOptions['execGit']>,
): Promise<ReturnType<typeof parseGitAuthorPorcelain>> {
  const since = `--since=${gitIsoBound(sinceMs)}`
  const until = `--until=${gitIsoBound(untilMs)}`
  const format = '--format=%an%x09%ae'
  const head = await safeGitText(execGit, cwd, [
    'log',
    format,
    since,
    until,
    'HEAD',
  ])
  const base = await safeGitText(execGit, cwd, [
    'log',
    format,
    since,
    until,
    branchRef,
  ])
  return parseGitAuthorPorcelain(`${head}\n${base}`)
}

/**
 * This user's insertions on the current branch not in `base` (two-dot
 * `base..HEAD` — three-dot log is a symmetric difference and would add
 * teammates' commits already on main), plus the dirty tree vs HEAD.
 */
export async function collectPendingInsertions(
  cwd: string,
  baseBranch: string,
  execGit: NonNullable<RunGitMergedOptions['execGit']> = defaultExecGit,
  authorArgs: readonly string[] = [],
): Promise<number> {
  let ahead = 0
  if (authorArgs.length > 0) {
    const stdout = await safeGitText(execGit, cwd, [
      'log',
      '--pretty=tformat:',
      '--numstat',
      '--no-merges',
      ...authorArgs,
      `${baseBranch}..HEAD`,
    ])
    ahead = parseDiffNumstatInsertions(stdout)
  }
  const dirty = await safeDiffInsertions(execGit, cwd, [
    'diff',
    '--numstat',
    'HEAD',
  ])
  return ahead + dirty
}

export type GitMergedResult = {
  branch: string | null
  days: GitNumstatDay[]
  pendingInsertions: number
  authorFiltered: boolean
  authors: CodeLinesAuthorChoice
  bundleRoot: string | null
}

const emptyAuthors = (): CodeLinesAuthorChoice => ({
  accounts: [],
  sumMultiple: false,
})

async function collectOneGitRepo(
  options: RunGitMergedOptions,
): Promise<GitMergedResult> {
  const execGit = options.execGit ?? defaultExecGit
  const branch = await resolveDefaultBranch(options.cwd, execGit)
  if (branch === null) {
    return {
      branch: null,
      days: [],
      pendingInsertions: 0,
      authorFiltered: false,
      authors: emptyAuthors(),
      bundleRoot: null,
    }
  }
  const { sinceMs, untilMs } = resolveBounds(options)
  const identity = await readGitAuthorIdentity(options.cwd, execGit)
  const branchRef = await defaultBranchRef(options.cwd, branch, execGit)
  const listed = await listBranchAuthors(
    options.cwd,
    branchRef,
    sinceMs,
    untilMs,
    execGit,
  )
  const cursorEmail = options.cursorEmail?.trim() || identity.email
  const authors = resolveAuthorChoice({
    authors: listed,
    cursorEmail,
    saved: options.savedAuthors ?? null,
  })
  const authorArgs = gitAuthorLogArgsForEmails(selectedAuthorEmails(authors))
  const pendingInsertions = await collectPendingInsertions(
    options.cwd,
    branchRef,
    execGit,
    authorArgs,
  )
  if (authorArgs.length === 0) {
    return {
      branch,
      days: [],
      pendingInsertions,
      authorFiltered: false,
      authors,
      bundleRoot: null,
    }
  }
  try {
    const { stdout } = await execGit(
      [
        'log',
        '--first-parent',
        '--numstat',
        '--format=%ct',
        `--since=${gitIsoBound(sinceMs)}`,
        `--until=${gitIsoBound(untilMs)}`,
        ...authorArgs,
        branchRef,
      ],
      options.cwd,
    )
    return {
      branch,
      days: parseGitNumstatLog(stdout),
      pendingInsertions,
      authorFiltered: true,
      authors,
      bundleRoot: null,
    }
  } catch {
    return {
      branch,
      days: [],
      pendingInsertions,
      authorFiltered: true,
      authors,
      bundleRoot: null,
    }
  }
}

export async function collectMergedLineDays(
  options: RunGitMergedOptions,
): Promise<GitMergedResult> {
  const listNested =
    options.listNestedGitRepos ?? listNestedIndependentGitRepos
  const nested = await listNested(options.cwd)
  if (nested.length < MIN_NESTED_GIT_REPOS) {
    return collectOneGitRepo(options)
  }
  const execGit = options.execGit ?? defaultExecGit
  const parentBranch = await resolveDefaultBranch(options.cwd, execGit)
  const roots =
    parentBranch === null ? nested : [options.cwd, ...nested]
  const parts = await mapPool(roots, 4, (cwd) =>
    collectOneGitRepo({
      ...options,
      cwd,
    }),
  )
  const withDays = parts.filter(
    (part) =>
      part.days.length > 0 ||
      part.pendingInsertions > 0 ||
      part.authors.accounts.length > 0,
  )
  const source = withDays.length > 0 ? withDays : parts
  return {
    branch: source.find((part) => part.branch !== null)?.branch ?? null,
    days: mergeGitNumstatDays(source.map((part) => part.days)),
    pendingInsertions: source.reduce(
      (sum, part) => sum + part.pendingInsertions,
      0,
    ),
    authorFiltered: source.some((part) => part.authorFiltered),
    authors: mergeAuthorChoices(source.map((part) => part.authors)),
    bundleRoot: options.cwd,
  }
}
