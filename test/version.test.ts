import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  parsePackageVersion,
  readVersionFromExtensionRoot,
  resolveExtensionVersion,
} from '../src/version'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('parsePackageVersion', () => {
  it('reads a semver string and ignores empty or non-string values', () => {
    expect(parsePackageVersion({ version: '0.7.5' })).toBe('0.7.5')
    expect(parsePackageVersion({ version: '  1.2.3  ' })).toBe('1.2.3')
    expect(parsePackageVersion({ version: '' })).toBeUndefined()
    expect(parsePackageVersion({ version: 1 })).toBeUndefined()
    expect(parsePackageVersion(null)).toBeUndefined()
  })
})

describe('resolveExtensionVersion', () => {
  it('prefers package.json on disk over a missing API field', () => {
    const fromDisk = readVersionFromExtensionRoot(repoRoot)
    expect(fromDisk).toMatch(/^\d+\.\d+\.\d+/)
    expect(resolveExtensionVersion(repoRoot, {})).toBe(fromDisk)
    expect(resolveExtensionVersion(repoRoot, { version: '9.9.9' })).toBe(fromDisk)
  })

  it('falls back to the API packageJSON when the file is missing', () => {
    expect(resolveExtensionVersion(join(repoRoot, 'no-such-dir'), { version: '1.2.3' })).toBe(
      '1.2.3',
    )
    expect(resolveExtensionVersion(join(repoRoot, 'no-such-dir'), {})).toBe('0.0.0')
  })
})
