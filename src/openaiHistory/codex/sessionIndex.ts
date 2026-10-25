import { dirname, join } from 'node:path'
import type { Database, SqlValue } from 'sql.js'
import type { RequestStore } from '../store/types'

export type SessionIndexEntry = {
  id: string
  title: string
}

export function sessionIndexCandidates(root: {
  realpath: string
  scanDirect: boolean
}): string[] {
  const primary = join(root.realpath, 'session_index.jsonl')
  if (!root.scanDirect) {
    return [primary]
  }
  return [primary, join(dirname(root.realpath), 'session_index.jsonl')]
}

/** `{ id, thread_name }` lines. Bad JSON is skipped; it is not rollout history. */
export function parseSessionIndex(text: string): SessionIndexEntry[] {
  const out: SessionIndexEntry[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      continue
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed) as unknown
    } catch {
      continue
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      continue
    }
    const record = parsed as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    const title =
      typeof record.thread_name === 'string' ? record.thread_name.trim() : ''
    if (id.length === 0 || title.length === 0) {
      continue
    }
    out.push({ id, title })
  }
  return out
}

function storeDb(store: RequestStore): Database {
  const db = (store as unknown as { db: Database }).db
  if (db === undefined) {
    throw new Error('RequestStore database is not available')
  }
  return db
}

/** Last line for an id wins. Matches `conversations.conversation_id`. */
export function applySessionTitles(
  store: RequestStore,
  entries: readonly SessionIndexEntry[],
): number {
  const db = storeDb(store)
  const latest = new Map<string, string>()
  for (const entry of entries) {
    latest.set(entry.id, entry.title)
  }
  let updated = 0
  for (const [id, title] of latest) {
    const stmt = db.prepare(
      'SELECT title FROM conversations WHERE conversation_id = ?',
    )
    let current: SqlValue | null = null
    try {
      stmt.bind([id])
      if (stmt.step()) {
        const row = stmt.getAsObject()
        current = row.title ?? null
      }
    } finally {
      stmt.free()
    }
    if (typeof current !== 'string' || current === title) {
      continue
    }
    db.run('UPDATE conversations SET title = ? WHERE conversation_id = ?', [
      title,
      id,
    ])
    updated += 1
  }
  return updated
}
