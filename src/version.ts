import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function parsePackageVersion(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('version' in value)) {
    return undefined
  }
  const version = (value as { version: unknown }).version
  if (typeof version !== 'string') {
    return undefined
  }
  const trimmed = version.trim()
  return trimmed === '' ? undefined : trimmed
}

export function readVersionFromExtensionRoot(
  extensionRoot: string,
): string | undefined {
  try {
    const raw = readFileSync(join(extensionRoot, 'package.json'), 'utf8')
    return parsePackageVersion(JSON.parse(raw) as unknown)
  } catch {
    return undefined
  }
}

export function resolveExtensionVersion(
  extensionRoot: string,
  packageJson: unknown,
): string {
  return (
    readVersionFromExtensionRoot(extensionRoot) ??
    parsePackageVersion(packageJson) ??
    '0.0.0'
  )
}
