import { createHash } from 'node:crypto'
import { basename, dirname, isAbsolute, join, posix, win32 } from 'node:path'
import { isRolloutFileName } from './discover'

export type ResolvedCodexRoot =
  | {
      ok: true
      realpath: string
      sourceInstanceId: string
      via: 'setting' | 'env' | 'home'
      /** Setting or CODEX_HOME pointed at sessions/ or a folder of rollout files. */
      pointedAtSessions: boolean
      /** Rollouts sit in `realpath` itself, not in a child `sessions/` directory. */
      scanDirect: boolean
    }
  | {
      ok: false
      reason: 'missing' | 'not-directory' | 'sessions-folder'
      pointedPath?: string
    }

export type ResolveCodexRootInput = {
  codexHomeSetting: string
  codexHomeEnv: string | undefined
  homeDir: string
  stat: (path: string) => Promise<'dir' | 'file' | 'missing'>
  realpath: (path: string) => Promise<string>
  readdir?: (path: string) => Promise<string[]>
}

const SESSION_DIR_NAMES = new Set(['sessions', 'archived_sessions'])

function pathForHome(homeDir: string): typeof posix {
  if (/^[A-Za-z]:[\\/]/.test(homeDir) || homeDir.includes('\\')) {
    return win32
  }
  return posix
}

function homeJoin(homeDir: string, rest: string): string {
  return pathForHome(homeDir).join(homeDir, rest)
}

function expandUserPath(path: string, homeDir: string): string {
  if (path === '~') {
    return homeDir
  }
  if (path.startsWith('~/') || path.startsWith('~\\')) {
    return homeJoin(homeDir, path.slice(2))
  }
  const profile = path.match(/^%USERPROFILE%(.*)$/i)
  if (profile !== null) {
    const rest = (profile[1] ?? '').replace(/^[/\\]+/, '')
    return rest.length === 0 ? homeDir : homeJoin(homeDir, rest)
  }
  if (isAbsolute(path)) {
    return path
  }
  return homeJoin(homeDir, path)
}

function expandEnvPath(env: string | undefined, homeDir: string): string | null {
  if (env === undefined) {
    return null
  }
  const trimmed = env.trim()
  if (trimmed.length === 0) {
    return null
  }
  if (
    trimmed === '~' ||
    trimmed.startsWith('~/') ||
    trimmed.startsWith('~\\') ||
    /^%USERPROFILE%/i.test(trimmed)
  ) {
    return expandUserPath(trimmed, homeDir)
  }
  if (!isAbsolute(trimmed)) {
    return null
  }
  return trimmed
}

function sourceInstanceIdFor(realpath: string): string {
  return createHash('sha256').update(realpath, 'utf8').digest('hex')
}

async function tryDirectory(
  candidate: string,
  via: 'setting' | 'env' | 'home',
  input: ResolveCodexRootInput,
): Promise<Extract<ResolvedCodexRoot, { ok: true }> | ResolvedCodexRoot | null> {
  const kind = await input.stat(candidate)
  if (kind === 'missing') {
    return null
  }
  if (kind !== 'dir') {
    return { ok: false, reason: 'not-directory' }
  }
  const realpath = await input.realpath(candidate)
  return classifyDirectory(
    {
      ok: true,
      realpath,
      sourceInstanceId: sourceInstanceIdFor(realpath),
      via,
      pointedAtSessions: false,
      scanDirect: false,
    },
    input,
  )
}

async function classifyDirectory(
  found: Extract<ResolvedCodexRoot, { ok: true }>,
  input: ResolveCodexRootInput,
): Promise<ResolvedCodexRoot> {
  const base = basename(found.realpath)
  if (SESSION_DIR_NAMES.has(base)) {
    // `~/.codex/sessions` exists, but Codex home is the parent. Scanning it
    // would look for sessions/sessions and report 0 sessions.
    const parent = dirname(found.realpath)
    if ((await input.stat(parent)) !== 'dir') {
      return { ok: false, reason: 'sessions-folder', pointedPath: found.realpath }
    }
    let parentReal: string
    try {
      parentReal = await input.realpath(parent)
    } catch {
      return { ok: false, reason: 'sessions-folder', pointedPath: found.realpath }
    }
    return {
      ok: true,
      realpath: parentReal,
      sourceInstanceId: sourceInstanceIdFor(parentReal),
      via: found.via,
      pointedAtSessions: true,
      scanDirect: false,
    }
  }
  if (await hasLooseRollouts(found.realpath, input)) {
    return { ...found, pointedAtSessions: true, scanDirect: true }
  }
  return found
}

async function hasLooseRollouts(
  dir: string,
  input: ResolveCodexRootInput,
): Promise<boolean> {
  if (input.readdir === undefined) {
    return false
  }
  let names: string[]
  try {
    names = await input.readdir(dir)
  } catch {
    return false
  }
  if (names.includes('sessions')) {
    return false
  }
  return names.some((name) => isRolloutFileName(name))
}

export async function resolveCodexRoot(
  input: ResolveCodexRootInput,
): Promise<ResolvedCodexRoot> {
  const setting = input.codexHomeSetting.trim()
  if (setting.length > 0) {
    const resolved = await tryDirectory(
      expandUserPath(setting, input.homeDir),
      'setting',
      input,
    )
    if (resolved !== null) {
      return resolved
    }
  }

  const env = expandEnvPath(input.codexHomeEnv, input.homeDir)
  if (env !== null) {
    const resolved = await tryDirectory(env, 'env', input)
    if (resolved !== null) {
      return resolved
    }
  }

  const resolved = await tryDirectory(homeJoin(input.homeDir, '.codex'), 'home', input)
  if (resolved !== null) {
    return resolved
  }

  return { ok: false, reason: 'missing' }
}

export async function sessionsDirectoryExists(
  rootRealpath: string,
  stat: (path: string) => Promise<'dir' | 'file' | 'missing'>,
): Promise<boolean> {
  return (await stat(join(rootRealpath, 'sessions'))) === 'dir'
}
