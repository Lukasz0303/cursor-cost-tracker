import { access, copyFile, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'

export const SIGN_IN_MESSAGE = 'Sign in to Cursor'
export const SESSION_READ_ERROR = 'Could not read Cursor session'

const ACCESS_TOKEN_KEY = 'cursorAuth/accessToken'
const EMAIL_KEYS = ['cursorAuth/cachedEmail', 'cursorAuth/email'] as const

/** Node `readFile` and sql.js both need the whole file; they fail above ~2 GiB. */
export const SQLJS_MAX_BYTES = 1536 * 1024 * 1024

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

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readDbCopy(dbPath: string): Promise<Uint8Array> {
  const tmpPath = join(tmpdir(), `cct-${randomUUID()}.vscdb`)
  try {
    await copyFile(dbPath, tmpPath)
    return await readFile(tmpPath)
  } catch {
    return await readFile(dbPath)
  } finally {
    await rm(tmpPath, { force: true })
  }
}

function sqlValueToString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  if (value instanceof Uint8Array) {
    const text = new TextDecoder().decode(value).trim()
    return text === '' ? null : text
  }
  return null
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
  let DatabaseSync: typeof import('node:sqlite').DatabaseSync
  try {
    const sqlite = await import('node:sqlite')
    if (typeof sqlite.DatabaseSync !== 'function') {
      return null
    }
    DatabaseSync = sqlite.DatabaseSync
  } catch {
    return null
  }

  let db: InstanceType<typeof DatabaseSync> | undefined
  try {
    db = new DatabaseSync(dbPath, { readOnly: true, timeout: 5000 })
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
      db?.close()
    } catch {
      // already closed or never opened
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
