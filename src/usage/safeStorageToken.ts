import { execFile } from 'node:child_process'
import { createDecipheriv, pbkdf2Sync } from 'node:crypto'

/**
 * Cursor `cursorAuthTokenStorageCodec` seals `cursorAuth/accessToken` and
 * `cursorAuth/refreshToken` when `cursor.storage.authTokenEncryptionAtRest`
 * is true. The extension host runs as Node (`ELECTRON_RUN_AS_NODE`), so
 * Electron `safeStorage` is not available here. On macOS the ciphertext is
 * Chromium OSCrypt v10 and the password lives in the login keychain.
 * The password and the plaintext token must not be logged.
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

/** Post-ready Cursor identity, then the pre-ready Chromium identity. */
export const MAC_KEYCHAIN_IDENTITIES: readonly {
  service: string
  account: string
}[] = [
  { service: 'Cursor Safe Storage', account: 'Cursor Key' },
  { service: 'Chromium Safe Storage', account: 'Chromium Key' },
]

export type KeychainIdentity = { service: string; account: string }

export type ReadKeychainPassword = (
  identity: KeychainIdentity,
) => Promise<string | null>

export function isCursorSafeStorageValue(value: string): boolean {
  return value.startsWith(CURSOR_SAFE_STORAGE_MARK)
}

export function deriveOsCryptKey(password: string): Buffer {
  return pbkdf2Sync(password, OSCRYPT_SALT, OSCRYPT_ITERATIONS, OSCRYPT_KEY_BYTES, 'sha1')
}

/** Chromium macOS OSCrypt. `null` when the prefix or PKCS#7 padding does not match. */
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

export type UnsealResult =
  | { status: 'ready'; value: string }
  | { status: 'decrypt_failed' }

export async function unsealStoredAccessToken(
  stored: string,
  options?: {
    platform?: NodeJS.Platform
    readKeychainPassword?: ReadKeychainPassword
    /** When set, keep looking if this plaintext is not the session JWT. */
    accept?: (plain: string) => boolean
  },
): Promise<UnsealResult> {
  if (!isCursorSafeStorageValue(stored)) {
    return { status: 'ready', value: stored }
  }
  const platform = options?.platform ?? process.platform
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
