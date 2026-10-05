import { copyFile, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { fileExists, openStateDb, sqlValueToString } from './stateDb'

export const SIGN_IN_MESSAGE = 'Sign in to Cursor'
export const SESSION_READ_ERROR = 'Could not read Cursor session'

const ACCESS_TOKEN_KEY = 'cursorAuth/accessToken'
const EMAIL_KEYS = ['cursorAuth/cachedEmail', 'cursorAuth/email'] as const

/** Node `readFile` and sql.js both need the whole file; they fail above ~2 GiB. */
export const SQLJS_MAX_BYTES = 1536 * 1024 * 1024

/** Leftover `cct-*.vscdb` copies from a killed sql.js read. */
export const SQLJS_STALE_COPY_MS = 60 * 60 * 1000

const SQLJS_COPY_PREFIX = 'cct-'
const SQLJS_COPY_SUFFIX = '.vscdb'

export function staleSqlJsCopyNames(
  entries: readonly { name: string; mtimeMs: number }[],
  nowMs: number,
): string[] {
  const cutoff = nowMs - SQLJS_STALE_COPY_MS
  const stale: string[] = []
  for (const entry of entries) {
    if (!isSqlJsCopyName(entry.name)) {
      continue
    }
    if (entry.mtimeMs < cutoff) {
      stale.push(entry.name)
    }
  }
  return stale
}

function isSqlJsCopyName(name: string): boolean {
  return (
    name.startsWith(SQLJS_COPY_PREFIX) &&
    name.endsWith(SQLJS_COPY_SUFFIX) &&
    name.length > SQLJS_COPY_PREFIX.length + SQLJS_COPY_SUFFIX.length
  )
}

export type SessionOk = {
  ok: true
  cookie: string
  email: string | null
}

export type SessionErr = {
  ok: false
  error: string
}

export type SessionResult = SessionOk | SessionErr

export type ReadCursorSessionOptions = {
  dbPath?: string
  locateWasm?: (file: string) => string
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  /** Test-only: skip `node:sqlite` and use sql.js. */
  preferSqlJs?: boolean
  sqlJsMaxBytes?: number
}

let sqlJsPromise: Promise<SqlJsStatic> | null = null

type ItemValues = {
  stored: string | null
  email: string | null
}

export function getStateDbPath(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): string {
  if (platform === 'win32') {
    const appData =
      env.APPDATA ??
      (env.USERPROFILE ? join(env.USERPROFILE, 'AppData', 'Roaming') : '')
    return join(appData, 'Cursor', 'User', 'globalStorage', 'state.vscdb')
  }

  const home = env.HOME ?? env.USERPROFILE ?? ''
  if (platform === 'darwin') {
    return join(
      home,
      'Library',
      'Application Support',
      'Cursor',
      'User',
      'globalStorage',
      'state.vscdb',
    )
  }

  return join(home, '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb')
}

export function decodeJwtSub(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }
  const payload = parts[1]
  if (payload === undefined || payload === '') {
    return null
  }

  try {
    const json = Buffer.from(fromBase64Url(payload), 'base64').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }
    const sub = (parsed as Record<string, unknown>).sub
    if (typeof sub !== 'string' || sub.trim() === '') {
      return null
    }
    return sub
  } catch {
    return null
  }
}

export function jwtFromStoredValue(raw: string): string | null {
  let value = raw.trim()
  if (value === '') {
    return null
  }
  try {
    value = decodeURIComponent(value)
  } catch {
    // Stored value is not URI-encoded; use it as-is.
  }
  const sep = '::'
  const idx = value.lastIndexOf(sep)
  if (idx !== -1) {
    value = value.slice(idx + sep.length)
  }
  return value === '' ? null : value
}

export function buildWorkosCookie(sub: string, accessToken: string): string {
  return `WorkosCursorSessionToken=${sub}::${accessToken}`
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4
  if (pad === 0) {
    return padded
  }
  return padded + '='.repeat(4 - pad)
}

function defaultLocateWasm(file: string): string {
  return join(__dirname, file)
}

function loadSqlJs(locateFile: (file: string) => string): Promise<SqlJsStatic> {
  if (sqlJsPromise === null) {
    sqlJsPromise = initSqlJs({ locateFile }).catch((error: unknown) => {
      sqlJsPromise = null
      throw error
    })
  }
  return sqlJsPromise
}

async function sweepStaleSqlJsCopies(dir: string, nowMs = Date.now()): Promise<void> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return
  }
  const entries: { name: string; mtimeMs: number }[] = []
  for (const name of names) {
    if (!isSqlJsCopyName(name)) {
      continue
    }
    try {
      const info = await stat(join(dir, name))
      entries.push({ name, mtimeMs: info.mtimeMs })
    } catch {
      // skip an entry we cannot stat
    }
  }
  for (const name of staleSqlJsCopyNames(entries, nowMs)) {
    try {
      await rm(join(dir, name), { force: true })
    } catch {
      // next sql.js read retries
    }
  }
}

async function readDbCopy(dbPath: string): Promise<Uint8Array> {
  const dir = tmpdir()
  await sweepStaleSqlJsCopies(dir)
  const tmpPath = join(dir, `${SQLJS_COPY_PREFIX}${randomUUID()}${SQLJS_COPY_SUFFIX}`)
  try {
    await copyFile(dbPath, tmpPath)
    return await readFile(tmpPath)
  } catch {
    return await readFile(dbPath)
  } finally {
    await rm(tmpPath, { force: true })
  }
}

function sessionFromItemValues(values: ItemValues): SessionResult {
  const jwt = values.stored ? jwtFromStoredValue(values.stored) : null
  const sub = jwt ? decodeJwtSub(jwt) : null
  if (jwt === null || sub === null) {
    return { ok: false, error: SIGN_IN_MESSAGE }
  }
  return { ok: true, cookie: buildWorkosCookie(sub, jwt), email: values.email }
}

function readItemValue(db: Database, key: string): string | null {
  const stmt = db.prepare('SELECT value FROM ItemTable WHERE key = ?')
  try {
    stmt.bind([key])
    if (!stmt.step()) {
      return null
    }
    return sqlValueToString(stmt.getAsObject().value)
  } finally {
    stmt.free()
  }
}

function readItemValuesFromSqlJs(db: Database): ItemValues {
  const stored = readItemValue(db, ACCESS_TOKEN_KEY)
  let email: string | null = null
  for (const key of EMAIL_KEYS) {
    email = readItemValue(db, key)
    if (email !== null) {
      break
    }
  }
  return { stored, email }
}

async function tryReadViaNativeSqlite(
  dbPath: string,
): Promise<ItemValues | null> {
  const db = await openStateDb(dbPath)
  if (db === null) {
    return null
  }
  try {
    const stmt = db.prepare('SELECT value FROM ItemTable WHERE key = ?')
    const stored = sqlValueToString(stmt.get(ACCESS_TOKEN_KEY)?.value)
    let email: string | null = null
    for (const key of EMAIL_KEYS) {
      email = sqlValueToString(stmt.get(key)?.value)
      if (email !== null) {
        break
      }
    }
    return { stored, email }
  } catch {
    return null
  } finally {
    try {
      db.close()
    } catch {
      // already closed
    }
  }
}

async function readViaSqlJs(
  dbPath: string,
  locateWasm: (file: string) => string,
  maxBytes: number,
): Promise<ItemValues> {
  const info = await stat(dbPath)
  if (info.size > maxBytes) {
    throw new Error('database too large for sql.js')
  }

  const bytes = await readDbCopy(dbPath)
  const SQL = await loadSqlJs(locateWasm)
  const db = new SQL.Database(bytes)
  try {
    return readItemValuesFromSqlJs(db)
  } finally {
    db.close()
  }
}

export async function readCursorSession(
  options?: ReadCursorSessionOptions,
): Promise<SessionResult> {
  const platform = options?.platform ?? process.platform
  const env = options?.env ?? process.env
  const dbPath = options?.dbPath ?? getStateDbPath(platform, env)
  const locateWasm = options?.locateWasm ?? defaultLocateWasm
  const maxBytes = options?.sqlJsMaxBytes ?? SQLJS_MAX_BYTES

  if (!(await fileExists(dbPath))) {
    return { ok: false, error: SIGN_IN_MESSAGE }
  }

  if (options?.preferSqlJs !== true) {
    const native = await tryReadViaNativeSqlite(dbPath)
    if (native !== null) {
      return sessionFromItemValues(native)
    }
  }

  try {
    return sessionFromItemValues(await readViaSqlJs(dbPath, locateWasm, maxBytes))
  } catch {
    return { ok: false, error: SESSION_READ_ERROR }
  }
}
