import { createCipheriv } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  CURSOR_SAFE_STORAGE_PREFIX,
  decryptOsCryptV10,
  deriveOsCryptKey,
  isCursorSafeStorageValue,
  openCursorSafeStorageValue,
  unsealStoredAccessToken,
} from '../src/usage/safeStorageToken'

function sealCursorSafeStorage(plaintext: string, password: string): string {
  const cipher = createCipheriv(
    'aes-128-cbc',
    deriveOsCryptKey(password),
    Buffer.alloc(16, 0x20),
  )
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return (
    CURSOR_SAFE_STORAGE_PREFIX +
    Buffer.concat([Buffer.from('v10'), body]).toString('base64')
  )
}

describe('decryptOsCryptV10', () => {
  it('matches Chromium’s macOS known answer for mock_password', () => {
    const plaintext = Buffer.from([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
      0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b,
      0x1c, 0x1d, 0x1e, 0x1f,
    ])
    const ciphertext = Buffer.from([
      0x76, 0x31, 0x30, 0xbf, 0x08, 0x6d, 0x20, 0x56, 0x86, 0x1a, 0x80, 0xde, 0x82, 0x5f,
      0xc9, 0x35, 0x86, 0x86, 0x30, 0x64, 0x4f, 0x2c, 0xa1, 0x87, 0x45, 0x02, 0x13, 0xae,
      0x66, 0x81, 0xb4, 0xd6, 0x43, 0xd1, 0x9b, 0x25, 0x81, 0xc8, 0x5c, 0x88, 0x78, 0xc1,
      0xbc, 0x97, 0xe7, 0x26, 0xa1, 0x0e, 0x51, 0xea, 0x77,
    ])
    const key = deriveOsCryptKey('mock_password')
    expect(decryptOsCryptV10(ciphertext, key)?.equals(plaintext)).toBe(true)
  })

  it('returns null for a bad key or a missing v10 prefix', () => {
    const sealed = sealCursorSafeStorage('token', 'correct-password')
    expect(openCursorSafeStorageValue(sealed, 'other-password')).toBeNull()
    expect(decryptOsCryptV10(Buffer.from('nope'), deriveOsCryptKey('correct-password'))).toBeNull()
  })
})

describe('unsealStoredAccessToken', () => {
  it('leaves a plaintext token untouched', async () => {
    expect(isCursorSafeStorageValue('eyJhbGciOiJIUzI1NiJ9.e30.sig')).toBe(false)
    expect(isCursorSafeStorageValue('cursor-safe-storage:v2:abc')).toBe(true)
    await expect(
      unsealStoredAccessToken('eyJhbGciOiJIUzI1NiJ9.e30.sig', { platform: 'linux' }),
    ).resolves.toEqual({ status: 'ready', value: 'eyJhbGciOiJIUzI1NiJ9.e30.sig' })
  })

  it('opens a sealed token with the Cursor keychain identity', async () => {
    const sealed = sealCursorSafeStorage('user_test::jwt', 'cursor-secret')
    const plain = await unsealStoredAccessToken(sealed, {
      platform: 'linux',
      readKeychainPassword: async (identity) =>
        identity.account === 'Cursor Key' ? 'cursor-secret' : null,
    })
    expect(plain).toEqual({ status: 'ready', value: 'user_test::jwt' })
  })

  it('falls through to the Chromium identity when the Cursor item is missing', async () => {
    const sealed = sealCursorSafeStorage('legacy', 'chromium-secret')
    const plain = await unsealStoredAccessToken(sealed, {
      platform: 'darwin',
      readKeychainPassword: async (identity) =>
        identity.account === 'Chromium Key' ? 'chromium-secret' : null,
    })
    expect(plain).toEqual({ status: 'ready', value: 'legacy' })
  })

  it('returns decrypt_failed on Windows and Linux when no password reader is injected', async () => {
    const sealed = sealCursorSafeStorage('jwt', 'secret')
    await expect(unsealStoredAccessToken(sealed, { platform: 'win32' })).resolves.toEqual({
      status: 'decrypt_failed',
    })
    await expect(unsealStoredAccessToken(sealed, { platform: 'linux' })).resolves.toEqual({
      status: 'decrypt_failed',
    })
  })

  it('skips a password whose plaintext fails accept and tries the next identity', async () => {
    const sealed = sealCursorSafeStorage('good-jwt', 'right')
    const plain = await unsealStoredAccessToken(sealed, {
      platform: 'darwin',
      readKeychainPassword: async (identity) =>
        identity.account === 'Cursor Key' ? 'wrong' : 'right',
      accept: (value) => value === 'good-jwt',
    })
    expect(plain).toEqual({ status: 'ready', value: 'good-jwt' })
  })

  it('fails closed for a safe-storage prefix this build cannot open', async () => {
    await expect(
      unsealStoredAccessToken('cursor-safe-storage:v2:not-v1', {
        platform: 'darwin',
        readKeychainPassword: async () => 'cursor-secret',
      }),
    ).resolves.toEqual({ status: 'decrypt_failed' })
  })
})
