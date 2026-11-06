import { execFile } from 'node:child_process'
import { createDecipheriv, pbkdf2Sync } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Cursor `cursorAuthTokenStorageCodec` seals `cursorAuth/accessToken` and
 * `cursorAuth/refreshToken` when `cursor.storage.authTokenEncryptionAtRest`
 * is true. The extension host runs as Node (`ELECTRON_RUN_AS_NODE`), so
 * Electron `safeStorage` is not available here. The ciphertext is Chromium
 * OSCrypt v10 on both platforms that ship a reader:
 *
 * - macOS: AES-128-CBC, key PBKDF2-derived from the login-keychain password.
 * - Windows: AES-256-GCM (v10 + 12-byte nonce + ciphertext + 16-byte tag),
 *   key = raw DPAPI-unprotected `os_crypt.encrypted_key` from Cursor's
 *   `Local State` file.
 *
 * The key material and the plaintext token must not be logged.
 */
/** Any sealed Cursor auth value. A later version must not be treated as a plaintext JWT. */
export const CURSOR_SAFE_STORAGE_MARK = 'cursor-safe-storage:'

/** Ciphertext layout written by Cursor's `cursorAuthTokenStorageCodec`. */
export const CURSOR_SAFE_STORAGE_PREFIX = 'cursor-safe-storage:v1:'

const V10_PREFIX = 'v10'
const OSCRYPT_SALT = 'saltysalt'
const OSCRYPT_ITERATIONS = 1003
const OSCRYPT_KEY_BYTES = 16
const OSCRYPT_IV = Buffer.alloc(16, 0x20)
const KEYCHAIN_TIMEOUT_MS = 30_000
const DPAPI_BLOB_PREFIX = 'DPAPI'

/** Post-ready Cursor identity, then the pre-ready Chromium identity. */
export const MAC_KEYCHAIN_IDENTITIES: readonly {
  service: string
  account: string
}[] = [
  { service: 'Cursor Safe Storage', account: 'Cursor Key' },
  { service: 'Chromium Safe Storage', account: 'Chromium Key' },
]

export type KeychainIdentity = { service: string; account: string }

export type ReadKeychainPassword = (identity: KeychainIdentity) => Promise<string | null>

export type ReadWindowsSafeStorageKey = () => Promise<string | null>

export function isCursorSafeStorageValue(value: string): boolean {
  return value.startsWith(CURSOR_SAFE_STORAGE_MARK)
}

export function deriveOsCryptKey(password: string): Buffer {
  return pbkdf2Sync(password, OSCRYPT_SALT, OSCRYPT_ITERATIONS, OSCRYPT_KEY_BYTES, 'sha1')
}

/** Chromium macOS OSCrypt. AES-128-CBC with the PBKDF2-derived 16-byte key. `null` when the prefix or PKCS#7 padding does not match. */
export function decryptOsCryptV10(ciphertext: Buffer, key: Buffer): Buffer | null {
  if (key.length !== OSCRYPT_KEY_BYTES) {
    return null
  }
  if (ciphertext.length < V10_PREFIX.length + 16) {
    return null
  }
  if (ciphertext.subarray(0, V10_PREFIX.length).toString('ascii') !== V10_PREFIX) {
    return null
  }
  const body = ciphertext.subarray(V10_PREFIX.length)
  if (body.length % 16 !== 0) {
    return null
  }
  try {
    const decipher = createDecipheriv('aes-128-cbc', key, OSCRYPT_IV)
    return Buffer.concat([decipher.update(body), decipher.final()])
  } catch {
    return null
  }
}

export function openCursorSafeStorageValue(stored: string, password: string): string | null {
  if (!stored.startsWith(CURSOR_SAFE_STORAGE_PREFIX) || password === '') {
    return null
  }
  const raw = Buffer.from(stored.slice(CURSOR_SAFE_STORAGE_PREFIX.length), 'base64')
  if (raw.length === 0) {
    return null
  }
  const plain = decryptOsCryptV10(raw, deriveOsCryptKey(password))
  if (plain === null) {
    return null
  }
  return plain.toString('utf8')
}

/** Windows: the DPAPI-unprotected `encrypted_key` is the raw AES-256-GCM key, no PBKDF2 step. */
export function openCursorSafeStorageRawKey(stored: string, rawKey: Buffer): string | null {
  if (!stored.startsWith(CURSOR_SAFE_STORAGE_PREFIX) || rawKey.length !== 32) {
    return null
  }
  const raw = Buffer.from(stored.slice(CURSOR_SAFE_STORAGE_PREFIX.length), 'base64')
  if (raw.subarray(0, V10_PREFIX.length).toString('ascii') !== V10_PREFIX) {
    return null
  }
  const body = raw.subarray(V10_PREFIX.length)
  if (body.length < 12 + 16) {
    return null
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', rawKey, body.subarray(0, 12), {
      authTagLength: 16,
    })
    decipher.setAuthTag(body.subarray(body.length - 16))
    const plain = Buffer.concat([
      decipher.update(body.subarray(12, body.length - 16)),
      decipher.final(),
    ])
    return plain.toString('utf8')
  } catch {
    return null
  }
}

const passwordCache = new Map<string, string>()

function cacheKey(identity: KeychainIdentity): string {
  return `${identity.service}\0${identity.account}`
}

function execFileText(file: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { timeout: KEYCHAIN_TIMEOUT_MS, maxBuffer: 65_536, encoding: 'utf8' },
      (error, stdout) => {
        if (error) {
          reject(error)
          return
        }
        resolve(stdout)
      },
    )
  })
}

/** Login-keychain password. `null` when the item is missing or the user denies access. */
export async function readMacKeychainPassword(
  identity: KeychainIdentity,
): Promise<string | null> {
  const key = cacheKey(identity)
  const cached = passwordCache.get(key)
  if (cached !== undefined) {
    return cached
  }
  try {
    const stdout = await execFileText('security', [
      'find-generic-password',
      '-s',
      identity.service,
      '-a',
      identity.account,
      '-w',
    ])
    const password = stdout.replace(/[\r\n]+$/, '')
    if (password === '') {
      return null
    }
    passwordCache.set(key, password)
    return password
  } catch {
    return null
  }
}

/** `%APPDATA%\Cursor\Local State`. `getStateDbPath` lives in `session.ts`; this stays beside the reader that consumes it. */
export function getWindowsLocalStatePath(env: NodeJS.ProcessEnv): string {
  const appData =
    env.APPDATA ?? (env.USERPROFILE ? join(env.USERPROFILE, 'AppData', 'Roaming') : '')
  return join(appData, 'Cursor', 'Local State')
}

function osCryptEncryptedKey(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null) {
    return null
  }
  const osCrypt = (parsed as Record<string, unknown>)['os_crypt']
  if (typeof osCrypt !== 'object' || osCrypt === null) {
    return null
  }
  const encoded = (osCrypt as Record<string, unknown>)['encrypted_key']
  if (typeof encoded !== 'string' || encoded === '') {
    return null
  }
  return encoded
}

/**
 * DPAPI-unprotect the base64 blob via PowerShell (`ProtectedData.Unprotect`).
 * Chromium stores `"DPAPI"` + blob; the 5-byte marker is stripped first. The
 * base64 charset cannot break out of the single-quoted PowerShell literal.
 * Returns the unprotected 32-byte key as base64. `null` on any failure.
 */
export async function unprotectDpapiBase64(encoded: string): Promise<string | null> {
  const blob = Buffer.from(encoded, 'base64')
  if (blob.length < 6 || blob.subarray(0, 5).toString('ascii') !== DPAPI_BLOB_PREFIX) {
    return null
  }
  const dpapiBlobBase64 = blob.subarray(5).toString('base64')
  const script =
    'Add-Type -AssemblyName System.Security; ' +
    '[Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Unprotect(' +
    `[Convert]::FromBase64String('${dpapiBlobBase64}'), ` +
    '$null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))'
  try {
    const stdout = await execFileText('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script,
    ])
    const out = stdout.trim()
    if (out === '') {
      return null
    }
    if (Buffer.from(out, 'base64').length !== 32) {
      return null
    }
    return out
  } catch {
    return null
  }
}

/** Reads `Local State`, unprotects `os_crypt.encrypted_key`, returns the key as base64. */
export async function readWindowsLocalStateKey(localStatePath: string): Promise<string | null> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(localStatePath, 'utf8'))
  } catch {
    return null
  }
  const encoded = osCryptEncryptedKey(parsed)
  if (encoded === null) {
    return null
  }
  return unprotectDpapiBase64(encoded)
}

/** Cached wrapper over `readWindowsLocalStateKey` for the real `Local State` path. */
export async function readWindowsSafeStorageKey(): Promise<string | null> {
  const cache = 'win\0Local State'
  const cached = passwordCache.get(cache)
  if (cached !== undefined) {
    return cached
  }
  const value = await readWindowsLocalStateKey(getWindowsLocalStatePath(process.env))
  if (value === null) {
    return null
  }
  passwordCache.set(cache, value)
  return value
}

export type UnsealResult = { status: 'ready'; value: string } | { status: 'decrypt_failed' }

export async function unsealStoredAccessToken(
  stored: string,
  options?: {
    platform?: NodeJS.Platform
    readKeychainPassword?: ReadKeychainPassword
    readWindowsSafeStorageKey?: ReadWindowsSafeStorageKey
    /** When set, keep looking if this plaintext is not the session JWT. */
    accept?: (plain: string) => boolean
  },
): Promise<UnsealResult> {
  if (!isCursorSafeStorageValue(stored)) {
    return { status: 'ready', value: stored }
  }
  const platform = options?.platform ?? process.platform
  const readWindows = options?.readWindowsSafeStorageKey
  if (readWindows !== undefined || platform === 'win32') {
    const read = readWindows ?? readWindowsSafeStorageKey
    const encodedKey = await read()
    if (encodedKey === null || encodedKey === '') {
      return { status: 'decrypt_failed' }
    }
    const plain = openCursorSafeStorageRawKey(stored, Buffer.from(encodedKey, 'base64'))
    if (plain === null) {
      return { status: 'decrypt_failed' }
    }
    return { status: 'ready', value: plain }
  }
  const readPassword = options?.readKeychainPassword
  if (readPassword === undefined && platform !== 'darwin') {
    return { status: 'decrypt_failed' }
  }
  const read = readPassword ?? readMacKeychainPassword
  const accept = options?.accept
  let opened: string | null = null
  for (const identity of MAC_KEYCHAIN_IDENTITIES) {
    const password = await read(identity)
    if (password === null || password === '') {
      continue
    }
    const plain = openCursorSafeStorageValue(stored, password)
    if (plain === null) {
      continue
    }
    if (accept === undefined || accept(plain)) {
      return { status: 'ready', value: plain }
    }
    if (opened === null) {
      opened = plain
    }
  }
  if (opened !== null) {
    return { status: 'ready', value: opened }
  }
  return { status: 'decrypt_failed' }
}
