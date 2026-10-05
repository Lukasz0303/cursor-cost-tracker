import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COMPOSER_INDEX_KEY,
  mergeConversationTitles,
  nameFromComposerHeader,
  titlesFromChatTabs,
  titlesFromComposerIndex,
} from '../src/usage/conversationTitles'

describe('conversation titles', () => {
  it('reads composer index names and ignores message bodies', () => {
    const raw = JSON.stringify({
      allComposers: [
        {
          composerId: 'abc',
          name: '  Hello  ',
          messages: [{ text: 'secret prompt' }],
        },
        { composerId: '', name: 'dropped' },
        { composerId: 'blank', name: '   ' },
      ],
    })
    const titles = titlesFromComposerIndex(raw)
    expect(titles.get('abc')).toBe('Hello')
    expect(titles.has('blank')).toBe(false)
    expect([...titles.values()].join(' ')).not.toContain('secret prompt')
  })

  it('prefers chatTitle over title', () => {
    const titles = titlesFromChatTabs(
      JSON.stringify({
        tabs: [
          { tabId: 'tab-1', chatTitle: 'Chat A', title: 'ignored' },
          { tabId: 'tab-2', title: 'Fallback' },
        ],
      }),
    )
    expect(titles.get('tab-1')).toBe('Chat A')
    expect(titles.get('tab-2')).toBe('Fallback')
  })

  it('reads a header name without line totals', () => {
    const named = nameFromComposerHeader(
      JSON.stringify({
        composerId: 'cid',
        name: 'From header',
        bubbles: [{ text: 'do not keep' }],
      }),
      'fallback',
    )
    expect(named).toEqual({ id: 'cid', name: 'From header' })
  })

  it('lets the composer index win over chat tabs and headers', () => {
    const merged = mergeConversationTitles(
      titlesFromComposerIndex(
        JSON.stringify({
          allComposers: [{ composerId: 'same', name: 'Index' }],
        }),
      ),
      titlesFromChatTabs(
        JSON.stringify({ tabs: [{ tabId: 'same', chatTitle: 'Tab' }] }),
      ),
      new Map([['same', 'Header'], ['only-header', 'Header only']]),
    )
    expect(merged.get('same')).toBe('Index')
    expect(merged.get('only-header')).toBe('Header only')
  })

  it('caps titles at 200 characters', () => {
    const titles = titlesFromComposerIndex(
      JSON.stringify({
        allComposers: [{ composerId: 'long', name: 't'.repeat(240) }],
      }),
    )
    expect(titles.get('long')).toHaveLength(200)
  })
})

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function locateWasm(file: string): string {
  return join(repoRoot, 'node_modules', 'sql.js', 'dist', file)
}

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('readConversationTitles without node:sqlite', () => {
  it('returns an empty map when node:sqlite is missing', async () => {
    vi.doMock('node:sqlite', () => {
      throw new Error('node:sqlite unavailable')
    })
    vi.resetModules()
    try {
      const { readConversationTitles } = await import('../src/usage/readConversationTitles')
      const dir = await mkdtemp(join(tmpdir(), 'cct-titles-'))
      tempDirs.push(dir)
      const dbPath = join(dir, 'state.vscdb')
      const SQL = await initSqlJs({ locateFile: locateWasm })
      const db = new SQL.Database()
      db.run('CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT)')
      db.run('INSERT INTO ItemTable (key, value) VALUES (?, ?)', [
        COMPOSER_INDEX_KEY,
        JSON.stringify({
          allComposers: [{ composerId: 'abc', name: 'Would show if sqlite opened' }],
        }),
      ])
      await writeFile(dbPath, Buffer.from(db.export()))
      db.close()

      const titles = await readConversationTitles({ dbPath })
      expect(titles.size).toBe(0)
    } finally {
      vi.doUnmock('node:sqlite')
      vi.resetModules()
    }
  })
})
