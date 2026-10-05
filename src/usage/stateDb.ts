import { access } from 'node:fs/promises'

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** ItemTable and composerHeaders store text or a UTF-8 blob. */
export function sqlValueToString(value: unknown): string | null {
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

/**
 * Read-only `node:sqlite` handle. `null` when the module is missing or open throws.
 */
export async function openStateDb(
  dbPath: string,
): Promise<import('node:sqlite').DatabaseSync | null> {
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
  try {
    return new DatabaseSync(dbPath, { readOnly: true, timeout: 5000 })
  } catch {
    return null
  }
}
