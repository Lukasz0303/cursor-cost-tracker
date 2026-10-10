import { getStateDbPath } from './session'
import { fileExists, openStateDb, sqlValueToString } from './stateDb'
import {
  CHAT_INDEX_KEY,
  COMPOSER_INDEX_KEY,
  mergeConversationTitles,
  meterFromComposerHeader,
  metersFromComposerIndex,
  nameFromComposerHeader,
  titlesFromChatTabs,
  titlesFromComposerIndex,
  type ComposerContextMeter,
} from './conversationTitles'

export type ReadConversationTitlesOptions = {
  dbPath?: string
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
}

/**
 * Titles for Sessions rows. Two ItemTable index keys, plus `name` on
 * composer headers already used for line totals.
 * Never selects `composerData:{id}` or any message-list value.
 */
export type ConversationLocal = {
  titles: Map<string, string>
  context: Map<string, ComposerContextMeter>
}

export async function readConversationLocal(
  options: ReadConversationTitlesOptions = {},
): Promise<ConversationLocal> {
  const empty = {
    titles: new Map<string, string>(),
    context: new Map<string, ComposerContextMeter>(),
  }
  const dbPath =
    options.dbPath ??
    getStateDbPath(
      options.platform ?? process.platform,
      options.env ?? process.env,
    )
  if (!(await fileExists(dbPath))) {
    return empty
  }

  const db = await openStateDb(dbPath)
  if (db === null) {
    return empty
  }
  try {
    const itemStmt = db.prepare(
      'SELECT value FROM ItemTable WHERE key = ?',
    ) as unknown as {
      get: (key: string) => { value?: unknown } | undefined
    }
    const composerRaw = sqlValueToString(
      itemStmt.get(COMPOSER_INDEX_KEY)?.value,
    )
    const chatRaw = sqlValueToString(itemStmt.get(CHAT_INDEX_KEY)?.value)
    const headerNames = new Map<string, string>()
    const context = metersFromComposerIndex(composerRaw ?? '')
    try {
      const headerStmt = db.prepare(
        'SELECT composerId, value FROM composerHeaders',
      ) as unknown as {
        all: () => Array<{ composerId?: unknown; value?: unknown }>
      }
      for (const row of headerStmt.all()) {
        const fallback =
          typeof row.composerId === 'string' ? row.composerId : ''
        const raw = sqlValueToString(row.value)
        if (raw === null) {
          continue
        }
        const named = nameFromComposerHeader(raw, fallback)
        if (named !== null && !headerNames.has(named.id)) {
          headerNames.set(named.id, named.name)
        }
        const measured = meterFromComposerHeader(raw, fallback)
        if (measured !== null) {
          const previous = context.get(measured.id)
          if (
            previous === undefined ||
            (previous.tokenLimit === null && measured.meter.tokenLimit !== null)
          ) {
            context.set(measured.id, measured.meter)
          }
        }
      }
    } catch {
      // composerHeaders is optional. Index keys still apply.
    }
    return {
      titles: mergeConversationTitles(
      composerRaw === null ? undefined : titlesFromComposerIndex(composerRaw),
      chatRaw === null ? undefined : titlesFromChatTabs(chatRaw),
      headerNames,
      ),
      context,
    }
  } catch {
    return empty
  } finally {
    try {
      db?.close()
    } catch {
      // already closed
    }
  }
}

export async function readConversationTitles(
  options: ReadConversationTitlesOptions = {},
): Promise<Map<string, string>> {
  return (await readConversationLocal(options)).titles
}
