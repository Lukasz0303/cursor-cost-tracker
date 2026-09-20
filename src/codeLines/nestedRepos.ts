import { lstat, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GitNumstatDay } from './types'

/** Nested git checkouts that trigger a polyrepo (stack) workspace. */
export const MIN_NESTED_GIT_REPOS = 2

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

const MAX_NESTED_REPOS = 40

export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = []
  const size = Math.max(1, Math.trunc(limit))
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size)
    out.push(...(await Promise.all(chunk.map((item) => fn(item)))))
  }
  return out
}

export function normalizeFsPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

export function pathInsideBundle(
  path: string | null,
  bundleRoot: string | null,
): boolean {
  if (path === null || bundleRoot === null) {
    return false
  }
  const left = normalizeFsPath(path)
  const root = normalizeFsPath(bundleRoot)
  if (left === '' || root === '') {
    return false
  }
  return left === root || left.startsWith(`${root}/`)
}

export function mergeGitNumstatDays(
  groups: readonly (readonly GitNumstatDay[])[],
): GitNumstatDay[] {
  const byDay = new Map<string, { insertions: number; deletions: number }>()
  for (const days of groups) {
    for (const day of days) {
      const prev = byDay.get(day.date) ?? { insertions: 0, deletions: 0 }
      byDay.set(day.date, {
        insertions: prev.insertions + day.insertions,
        deletions: prev.deletions + day.deletions,
      })
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      insertions: counts.insertions,
      deletions: counts.deletions,
    }))
}

/** `path = servers/foo` lines from `.gitmodules`. */
export function parseGitmodulesPaths(raw: string): string[] {
  const seen = new Set<string>()
  const paths: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*path\s*=\s*(.+)$/.exec(line)
    if (match === null) {
      continue
    }
    const rel = match[1]?.trim().replace(/\\/g, '/').replace(/\/+$/, '') ?? ''
    if (rel === '' || rel.includes('..')) {
      continue
    }
    const key = rel.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    paths.push(rel)
  }
  return paths
}

async function isNestedGitCheckout(dir: string): Promise<boolean> {
  try {
    const git = await lstat(join(dir, '.git'))
    return git.isDirectory() || git.isFile()
  } catch {
    return false
  }
}

async function listSubdirNames(cwd: string): Promise<string[]> {
  try {
    const entries = await readdir(cwd, { withFileTypes: true })
    return entries
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
}

/**
 * Nested git checkouts under a stack folder: `.gitmodules` paths, plus
 * one- and two-level children (`servers/rhino-api-provider-service`).
 * Includes submodules (`.git` file) and independent clones (`.git` dir).
 */
export async function listNestedIndependentGitRepos(
  cwd: string,
): Promise<string[]> {
  const found: string[] = []
  const seen = new Set<string>()
  const add = async (dir: string): Promise<void> => {
    if (found.length >= MAX_NESTED_REPOS) {
      return
    }
    const key = normalizeFsPath(dir)
    if (key === '' || seen.has(key)) {
      return
    }
    if (!(await isNestedGitCheckout(dir))) {
      return
    }
    seen.add(key)
    found.push(dir)
  }

  let gitmodules = ''
  try {
    gitmodules = await readFile(join(cwd, '.gitmodules'), 'utf8')
  } catch {
    gitmodules = ''
  }
  for (const rel of parseGitmodulesPaths(gitmodules)) {
    await add(join(cwd, ...rel.split('/').filter(Boolean)))
  }

  const top = await listSubdirNames(cwd)
  for (const name of top) {
    const dir = join(cwd, name)
    if (await isNestedGitCheckout(dir)) {
      await add(dir)
      continue
    }
    const nested = await listSubdirNames(dir)
    for (const child of nested) {
      await add(join(dir, child))
    }
  }
  return found
}
