import type { Database } from 'sql.js'
import type { RequestStore } from './types'

function storeDb(store: RequestStore): Database {
  const db = (store as unknown as { db: Database }).db
  if (db === undefined) {
    throw new Error('RequestStore database is not available')
  }
  return db
}

/**
 * A parser version change must re-read rollout files. Checkpoints otherwise
 * skip the lines that now carry rate limits, and the old unrecognized count
 * would keep the partial-history banner.
 */
export function rewindParserVersion(store: RequestStore, version: string): boolean {
  const db = storeDb(store)
  const stmt = db.prepare(
    'SELECT parser_version FROM source_instances ORDER BY last_scan_at DESC LIMIT 1',
  )
  let current: string | null = null
  try {
    if (stmt.step()) {
      const row = stmt.getAsObject()
      current = typeof row.parser_version === 'string' ? row.parser_version : null
    }
  } finally {
    stmt.free()
  }
  if (current === null || current === version) {
    return false
  }
  db.run(
    `UPDATE source_instances
     SET unrecognized_lines = 0, ignored_lines = 0, parser_version = ?`,
    [version],
  )
  db.run('DELETE FROM import_checkpoints')
  return true
}
