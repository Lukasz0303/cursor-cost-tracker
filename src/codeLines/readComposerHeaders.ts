import {
  filterComposerTotalsForWorkspace,
  parseComposerHeaderValue,
} from './composerHeaders'
import type { ComposerLineTotals } from './types'
import { getStateDbPath } from '../usage/session'
import { fileExists, openStateDb, sqlValueToString } from '../usage/stateDb'

export type ReadComposerHeadersOptions = {
  dbPath?: string
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  activeWorkspacePath?: string | null
}

/**
 * Read `composerHeaders` via node:sqlite (read-only). Does not load chat bubbles.
 */
export async function readComposerLineTotals(
  options: ReadComposerHeadersOptions = {},
): Promise<ComposerLineTotals[]> {
  const dbPath =
    options.dbPath ??
    getStateDbPath(
      options.platform ?? process.platform,
      options.env ?? process.env,
    )
  if (!(await fileExists(dbPath))) {
    return []
  }

  const db = await openStateDb(dbPath)
  if (db === null) {
    return []
  }
  const rows: ComposerLineTotals[] = []
  try {
    type HeaderRow = {
      composerId: unknown
      createdAt: unknown
      lastUpdatedAt: unknown
      value: unknown
    }
    const stmt = db.prepare(
      'SELECT composerId, createdAt, lastUpdatedAt, value FROM composerHeaders',
    ) as unknown as { all: () => HeaderRow[] }
    const rawRows = stmt.all()
    for (const row of rawRows) {
      const composerId =
        typeof row.composerId === 'string' ? row.composerId : ''
      if (composerId === '') {
        continue
      }
      const raw = sqlValueToString(row.value)
      if (raw === null) {
        continue
      }
      const createdAt =
        typeof row.createdAt === 'number' && Number.isFinite(row.createdAt)
          ? row.createdAt
          : null
      const lastUpdatedAt =
        typeof row.lastUpdatedAt === 'number' &&
        Number.isFinite(row.lastUpdatedAt)
          ? row.lastUpdatedAt
          : null
      const parsed = parseComposerHeaderValue(
        raw,
        composerId,
        createdAt,
        lastUpdatedAt,
      )
      if (parsed !== null) {
        rows.push(parsed)
      }
    }
  } catch {
    return []
  } finally {
    try {
      db?.close()
    } catch {
      // already closed
    }
  }

  const active = options.activeWorkspacePath?.trim() ?? ''
  if (active === '') {
    return rows
  }
  return filterComposerTotalsForWorkspace(rows, active)
}
