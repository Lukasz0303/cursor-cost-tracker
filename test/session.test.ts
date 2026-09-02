import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { afterEach, describe, expect, it } from 'vitest'
import {
  SESSION_READ_ERROR,
  SIGN_IN_MESSAGE,
  buildWorkosCookie,
  decodeJwtSub,
  getStateDbPath,
  jwtFromStoredValue,
  readCursorSession,
} from '../src/usage/session'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const sqlWasmDir = join(repoRoot, 'node_modules', 'sql.js', 'dist')

function locateWasm(file: string): string {
  return join(sqlWasmDir, file)
}

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
    'base64url',
  )
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.sig`
}

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('getStateDbPath', () => {
  it('resolves the Windows APPDATA Cursor DB', () => {
    expect(
      getStateDbPath('win32', { APPDATA: 'C:\\Users\\x\\AppData\\Roaming' }),
    ).toBe(
      join('C:\\Users\\x\\AppData\\Roaming', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    )
  })

  it('falls back to USERPROFILE\\AppData\\Roaming on Windows', () => {
    expect(getStateDbPath('win32', { USERPROFILE: 'C:\\Users\\x' })).toBe(
      join(
        'C:\\Users\\x',
        'AppData',
        'Roaming',
        'Cursor',
        'User',
        'globalStorage',
        'state.vscdb',
      ),
    )
  })

  it('resolves the macOS Application Support path', () => {
    expect(getStateDbPath('darwin', { HOME: '/Users/dev' })).toBe(
      join(
        '/Users/dev',
        'Library',
        'Application Support',
        'Cursor',
        'User',
        'globalStorage',
        'state.vscdb',
      ),
    )
  })

  it('resolves the Linux XDG path', () => {
    expect(getStateDbPath('linux', { HOME: '/home/dev' })).toBe(
      join('/home/dev', '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    )
  })
})

describe('decodeJwtSub', () => {
  it('reads sub from a three-part fake token', () => {
    expect(decodeJwtSub(fakeJwt({ sub: 'user_test' }))).toBe('user_test')
  })

  it('returns null for malformed tokens', () => {
    expect(decodeJwtSub('not-a-jwt')).toBeNull()
    expect(decodeJwtSub('a.b')).toBeNull()
    expect(decodeJwtSub('a.%%%notjson%%%.c')).toBeNull()
    expect(decodeJwtSub(fakeJwt({ role: 'x' }))).toBeNull()
    expect(decodeJwtSub(fakeJwt({ sub: '' }))).toBeNull()
  })
})

describe('jwtFromStoredValue', () => {
  it('unwraps a stored sub::jwt value and URI encoding', () => {
    const jwt = fakeJwt({ sub: 'user_test' })
    expect(jwtFromStoredValue(`user_test::${jwt}`)).toBe(jwt)
    expect(jwtFromStoredValue(encodeURIComponent(`user_test::${jwt}`))).toBe(jwt)
  })
})

describe('readCursorSession', () => {
  it('returns Sign in to Cursor when the DB file is missing', async () => {
    const result = await readCursorSession({
      dbPath: join(tmpdir(), 'cct-missing-state.vscdb'),
      locateWasm,
    })
    expect(result).toEqual({ ok: false, error: SIGN_IN_MESSAGE })
  })

  it('reads a copied sqlite file with a parameterized SELECT', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cct-session-'))
    tempDirs.push(dir)
    const dbPath = join(dir, 'state.vscdb')
    const jwt = fakeJwt({ sub: 'user_test' })

    const SQL = await initSqlJs({ locateFile: locateWasm })
    const db = new SQL.Database()
    db.run('CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT)')
    db.run('INSERT INTO ItemTable (key, value) VALUES (?, ?)', [
      'cursorAuth/accessToken',
      jwt,
    ])
    db.run('INSERT INTO ItemTable (key, value) VALUES (?, ?)', [
      'cursorAuth/cachedEmail',
      'dev@example.com',
    ])
    await writeFile(dbPath, Buffer.from(db.export()))
    db.close()

    const result = await readCursorSession({ dbPath, locateWasm })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.email).toBe('dev@example.com')
    expect(result.cookie).toBe(buildWorkosCookie('user_test', jwt))
  })

  it('reads the same fixture through sql.js when native sqlite is skipped', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cct-session-'))
    tempDirs.push(dir)
    const dbPath = join(dir, 'state.vscdb')
    const jwt = fakeJwt({ sub: 'user_test' })

    const SQL = await initSqlJs({ locateFile: locateWasm })
    const db = new SQL.Database()
    db.run('CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT)')
    db.run('INSERT INTO ItemTable (key, value) VALUES (?, ?)', [
      'cursorAuth/accessToken',
      jwt,
    ])
    await writeFile(dbPath, Buffer.from(db.export()))
    db.close()

    const result = await readCursorSession({
      dbPath,
      locateWasm,
      preferSqlJs: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.cookie).toBe(buildWorkosCookie('user_test', jwt))
  })

  it('returns Could not read Cursor session when sql.js cannot load a huge file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cct-session-'))
    tempDirs.push(dir)
    const dbPath = join(dir, 'state.vscdb')
    await writeFile(dbPath, 'not-a-database')

    const result = await readCursorSession({
      dbPath,
      locateWasm,
      preferSqlJs: true,
      sqlJsMaxBytes: 4,
    })
    expect(result).toEqual({ ok: false, error: SESSION_READ_ERROR })
  })

  it('returns Sign in to Cursor when the access token key is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cct-session-'))
    tempDirs.push(dir)
    const dbPath = join(dir, 'state.vscdb')

    const SQL = await initSqlJs({ locateFile: locateWasm })
    const db = new SQL.Database()
    db.run('CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT)')
    await writeFile(dbPath, Buffer.from(db.export()))
    db.close()

    const result = await readCursorSession({ dbPath, locateWasm })
    expect(result).toEqual({ ok: false, error: SIGN_IN_MESSAGE })
  })

  it('returns Could not read Cursor session when the file is not sqlite', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cct-session-'))
    tempDirs.push(dir)
    const dbPath = join(dir, 'state.vscdb')
    await writeFile(dbPath, 'not-a-database')

    const result = await readCursorSession({ dbPath, locateWasm })
    expect(result).toEqual({ ok: false, error: SESSION_READ_ERROR })
  })
})

describe.skipIf(process.env.CURSOR_SESSION_TEST !== '1')(
  'live Cursor state.vscdb',
  () => {
    it('returns ok or a generic error without throwing', async () => {
      const result = await readCursorSession({ locateWasm })
      expect(result.ok === true || result.ok === false).toBe(true)
      if (!result.ok) {
        expect([SIGN_IN_MESSAGE, SESSION_READ_ERROR]).toContain(result.error)
      }
    })
  },
)
