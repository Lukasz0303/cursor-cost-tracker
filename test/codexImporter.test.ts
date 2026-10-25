import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { discoverRolloutFiles, type FsDeps } from '../src/openaiHistory/codex/discover'
import { importDiscoveredFile } from '../src/openaiHistory/codex/importer'
import type { ResolvedCodexRoot } from '../src/openaiHistory/codex/sourceRoot'
import { HistoryService } from '../src/openaiHistory/historyService'
import { openRequestStore } from '../src/openaiHistory/store/sqlJsRequestStore'
import { listObservations } from '../src/openaiHistory/store/sqlJsRequestStore'
import type { RequestStore } from '../src/openaiHistory/store/types'
import type { Database, SqlValue } from 'sql.js'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const sqlWasmDir = join(repoRoot, 'node_modules', 'sql.js', 'dist')
const FIXTURE_DIR = join(repoRoot, 'test', 'fixtures', 'codex-rollouts')

function locateWasm(file: string): string {
  return join(sqlWasmDir, file)
}

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function loadSql(): Promise<Awaited<ReturnType<typeof initSqlJs>>> {
  return initSqlJs({ locateFile: locateWasm })
}

async function tempRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'cct-codex-import-'))
  tempDirs.push(dir)
  await mkdir(join(dir, 'sessions'), { recursive: true })
  await mkdir(join(dir, 'archived_sessions'), { recursive: true })
  return realpath(dir)
}

function nodeFsDeps(): FsDeps {
  return {
    readdir: async (path) => {
      const { readdir } = await import('node:fs/promises')
      return readdir(path)
    },
    stat: async (path) => {
      try {
        const info = await stat(path)
        return info.isDirectory() ? 'dir' : info.isFile() ? 'file' : 'missing'
      } catch {
        return 'missing'
      }
    },
    sizeMtime: async (path) => {
      const info = await stat(path)
      return { size: info.size, mtimeMs: info.mtimeMs }
    },
    realpath: async (path) => realpath(path),
  }
}

async function readFrom(path: string, offset: number): Promise<Uint8Array> {
  const buf = await readFile(path)
  return new Uint8Array(buf.subarray(offset))
}

function rootFor(realpath: string): ResolvedCodexRoot & { ok: true } {
  return {
    ok: true,
    realpath,
    sourceInstanceId: createHash('sha256').update(realpath, 'utf8').digest('hex'),
    via: 'setting',
    pointedAtSessions: false,
    scanDirect: false,
  }
}

async function writeSession(
  root: string,
  name: string,
  contents: string | Uint8Array,
  dir: 'sessions' | 'archived_sessions' = 'sessions',
): Promise<string> {
  const path = join(root, dir, name)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents)
  return realpath(path)
}

async function discovered(absolutePath: string) {
  const info = await stat(absolutePath)
  return { absolutePath, size: info.size, mtimeMs: info.mtimeMs }
}

async function importPath(
  store: RequestStore,
  root: ResolvedCodexRoot & { ok: true },
  absolutePath: string,
): Promise<void> {
  await importDiscoveredFile({
    file: await discovered(absolutePath),
    root,
    deviceId: 'device-test',
    store,
    readFrom,
  })
}

function getDb(store: RequestStore): Database {
  return (store as unknown as { db: Database }).db
}

function queryAll(
  store: RequestStore,
  sql: string,
  params: SqlValue[] = [],
): Record<string, SqlValue>[] {
  const stmt = getDb(store).prepare(sql)
  const rows: Record<string, SqlValue>[] = []
  try {
    stmt.bind(params)
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
  } finally {
    stmt.free()
  }
  return rows
}

describe('codex importer', () => {
  it('import twice keeps the same request count and token sums', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const rootPath = await tempRoot()
    const root = rootFor(rootPath)
    const body = await readFile(join(FIXTURE_DIR, 'token-usage-record.jsonl'), 'utf8')
    const filePath = await writeSession(rootPath, 'rollout.jsonl', body)

    await importPath(store, root, filePath)
    const first = await store.totals(root.sourceInstanceId)
    await importPath(store, root, filePath)
    const second = await store.totals(root.sourceInstanceId)

    expect(first).toEqual(second)
    expect(first.requests).toBe(1)
    expect(first.inputTokens).toBe(15347)
    expect(first.outputTokens).toBe(185)
    await store.close()
  })

  it('usage record plus token-count snapshot → one request and one snapshot', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const rootPath = await tempRoot()
    const root = rootFor(rootPath)
    const body = await readFile(join(FIXTURE_DIR, 'token-count-snapshot.jsonl'), 'utf8')
    const filePath = await writeSession(rootPath, 'snap.jsonl', body)

    await importPath(store, root, filePath)
    expect(await store.totals(root.sourceInstanceId)).toMatchObject({ requests: 1 })
    expect(queryAll(store, 'SELECT id FROM usage_snapshots')).toHaveLength(1)
    await store.close()
  })

  it('rate-limit plan_type team sets billing_mode on the earlier request', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const rootPath = await tempRoot()
    const root = rootFor(rootPath)
    const body = [
      JSON.stringify({
        timestamp: '2026-10-24T19:00:00.000Z',
        type: 'token_usage_record',
        payload: {
          thread_id: 'thread-exec',
          response_id: 'resp-exec',
          model: 'gpt-fixture',
          usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
        },
      }),
      JSON.stringify({
        timestamp: '2026-10-24T19:00:01.000Z',
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: { total_token_usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 } },
          rate_limits: { plan_type: 'team', limit_id: 'codex' },
        },
      }),
    ].join('\n')
    const filePath = await writeSession(rootPath, 'exec.jsonl', body + '\n')

    await importPath(store, root, filePath)
    const rows = queryAll(store, 'SELECT billing_mode FROM requests')
    expect(rows).toEqual([{ billing_mode: 'chatgpt-plan' }])
    await store.close()
  })

  it('snapshot-only file → zero requests', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const rootPath = await tempRoot()
    const root = rootFor(rootPath)
    const body = await readFile(join(FIXTURE_DIR, 'snapshot-only.jsonl'), 'utf8')
    const filePath = await writeSession(rootPath, 'only-snap.jsonl', body)

    await importPath(store, root, filePath)
    expect(await store.totals(root.sourceInstanceId)).toEqual({
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
    })
    expect(queryAll(store, 'SELECT id FROM usage_snapshots')).toHaveLength(2)
    const conv = queryAll(store, 'SELECT turn_count FROM conversations')
    expect(conv.every((row) => row.turn_count === null)).toBe(true)
    await store.close()
  })

  it('fork reuses responseId; child links parent; new child response spends once', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const rootPath = await tempRoot()
    const root = rootFor(rootPath)
    const fork = await readFile(join(FIXTURE_DIR, 'fork.jsonl'), 'utf8')
    const extra =
      '{"timestamp":"2026-10-07T10:02:00.000Z","type":"token_usage_record","payload":{"thread_id":"thread-child","session_id":"session-child","turn_id":"turn-c2","response_id":"resp_child_only","parent_thread_id":"thread-parent","usage":{"input_tokens":4,"output_tokens":1,"total_tokens":5}}}\n'
    const filePath = await writeSession(rootPath, 'fork.jsonl', fork.trimEnd() + '\n' + extra)

    await importPath(store, root, filePath)

    expect(await store.totals(root.sourceInstanceId)).toEqual({
      requests: 2,
      inputTokens: 14,
      outputTokens: 3,
    })
    const observations = listObservations(store)
    expect(observations).toHaveLength(3)
    expect(observations.filter((o) => o.attributesSpend === 1)).toHaveLength(2)
    expect(observations.filter((o) => o.attributesSpend === 0)).toHaveLength(1)

    const child = queryAll(
      store,
      `SELECT parent_conversation_id FROM conversations WHERE conversation_id = ?`,
      ['thread-child'],
    )
    expect(child[0]?.parent_conversation_id).toBe('thread-parent')

    const childSpend = queryAll(
      store,
      `SELECT r.response_id, o.attributes_spend
       FROM request_observations o
       JOIN requests r ON r.id = o.request_id
       WHERE r.conversation_id = ?`,
      ['thread-child'],
    )
    const spendRows = childSpend.filter((row) => row.attributes_spend === 1)
    expect(spendRows).toHaveLength(1)
    expect(spendRows[0]?.response_id).toBe('resp_child_only')
    await store.close()
  })

  it('two roots without account id stay on separate unknown-source keys', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const aPath = await tempRoot()
    const bPath = await tempRoot()
    const a = rootFor(aPath)
    const b = rootFor(bPath)
    const line =
      '{"timestamp":"2026-10-07T10:00:00.000Z","type":"token_usage_record","payload":{"thread_id":"same-title","response_id":"resp_x","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}\n'
    const fileA = await writeSession(aPath, 'a.jsonl', line)
    const fileB = await writeSession(bPath, 'b.jsonl', line)

    await importPath(store, a, fileA)
    await importPath(store, b, fileB)

    const scopes = queryAll(store, 'SELECT DISTINCT account_scope_key FROM requests')
    expect(scopes).toHaveLength(2)
    expect(scopes.map((s) => String(s.account_scope_key)).sort()).toEqual(
      [`unknown-source:${a.sourceInstanceId}`, `unknown-source:${b.sourceInstanceId}`].sort(),
    )
    await store.close()
  })

  it('shrink starts a new generation without duplicating requests', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const rootPath = await tempRoot()
    const root = rootFor(rootPath)
    const line =
      '{"timestamp":"2026-10-07T10:00:00.000Z","type":"token_usage_record","payload":{"thread_id":"t","response_id":"resp_shrink","usage":{"input_tokens":9,"output_tokens":1,"total_tokens":10}}}\n'
    const filePath = await writeSession(rootPath, 'shrink.jsonl', line + line)
    await importPath(store, root, filePath)

    await writeFile(filePath, line)
    await importPath(store, root, filePath)

    expect(await store.totals(root.sourceInstanceId)).toMatchObject({ requests: 1 })
    const gens = queryAll(store, 'SELECT generation FROM source_files')
    expect(gens[0]?.generation).toBe(2)
    await store.close()
  })

  it('same size with a different prefix starts a new generation', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const rootPath = await tempRoot()
    const root = rootFor(rootPath)
    const a =
      '{"timestamp":"2026-10-07T10:00:00.000Z","type":"token_usage_record","payload":{"thread_id":"t","response_id":"resp_pref","usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3},"pad":"AAAA"}}\n'
    const b =
      '{"timestamp":"2026-10-07T10:00:00.000Z","type":"token_usage_record","payload":{"thread_id":"t","response_id":"resp_pref","usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3},"pad":"BBBB"}}\n'
    expect(Buffer.byteLength(a)).toBe(Buffer.byteLength(b))
    const filePath = await writeSession(rootPath, 'prefix.jsonl', a)
    await importPath(store, root, filePath)
    await writeFile(filePath, b)
    await importPath(store, root, filePath)

    expect(await store.totals(root.sourceInstanceId)).toMatchObject({ requests: 1 })
    expect(queryAll(store, 'SELECT generation FROM source_files')[0]?.generation).toBe(2)
    await store.close()
  })

  it('moving a file under archived_sessions keeps one request', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const rootPath = await tempRoot()
    const root = rootFor(rootPath)
    const body = await readFile(join(FIXTURE_DIR, 'token-usage-record.jsonl'), 'utf8')
    const sessionsPath = await writeSession(rootPath, 'move-me.jsonl', body)
    await importPath(store, root, sessionsPath)

    const archivedPath = join(rootPath, 'archived_sessions', 'move-me.jsonl')
    await rename(sessionsPath, archivedPath)
    const archivedReal = await realpath(archivedPath)
    await importPath(store, root, archivedReal)

    // Different absolute path → new source_files row, but same response id dedups.
    expect(await store.totals(root.sourceInstanceId)).toMatchObject({ requests: 1 })
    expect(listObservations(store).length).toBeGreaterThanOrEqual(1)
    await store.close()
  })

  it('reopen store and import again stays at one request', async () => {
    const sql = await loadSql()
    const rootPath = await tempRoot()
    const root = rootFor(rootPath)
    const body = await readFile(join(FIXTURE_DIR, 'token-usage-record.jsonl'), 'utf8')
    const filePath = await writeSession(rootPath, 'reopen.jsonl', body)

    const store1 = openRequestStore(null, sql)
    await importPath(store1, root, filePath)
    const bytes = store1.exportBytes()
    await store1.close()

    const store2 = openRequestStore(bytes, sql)
    await importPath(store2, root, filePath)
    expect(await store2.totals(root.sourceInstanceId)).toMatchObject({ requests: 1 })
    await store2.close()
  })

  it('prompt text from a rollout line never lands in SQL text columns', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const rootPath = await tempRoot()
    const root = rootFor(rootPath)
    const body =
      '{"timestamp":"2026-10-07T10:00:00.000Z","type":"user_message","payload":{"text":"SECRET_PROMPT_PHRASE"}}\n' +
      '{"timestamp":"2026-10-07T10:00:01.000Z","type":"token_usage_record","payload":{"thread_id":"t","response_id":"resp_p","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}\n'
    const filePath = await writeSession(rootPath, 'prompt.jsonl', body)
    await importPath(store, root, filePath)

    const dump = queryAll(store, `SELECT * FROM requests`)
      .concat(queryAll(store, `SELECT * FROM conversations`))
      .concat(queryAll(store, `SELECT * FROM import_checkpoints`))
    const blob = JSON.stringify(dump)
    expect(blob).not.toContain('SECRET_PROMPT_PHRASE')
    await store.close()
  })

  it('skips a symlink whose realpath leaves the root', async () => {
    const rootPath = await tempRoot()
    const outsideDir = await mkdtemp(join(tmpdir(), 'cct-codex-outside-'))
    tempDirs.push(outsideDir)
    const outsideFile = join(outsideDir, 'escape.jsonl')
    await writeFile(
      outsideFile,
      '{"timestamp":"2026-10-07T10:00:00.000Z","type":"token_usage_record","payload":{"thread_id":"t","response_id":"resp_out","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}\n',
    )
    await symlink(outsideFile, join(rootPath, 'sessions', 'rollout-link.jsonl'))

    const found = await discoverRolloutFiles(rootPath, nodeFsDeps())
    expect(found.every((f) => !f.absolutePath.includes('escape'))).toBe(true)
    expect(found.some((f) => f.absolutePath.endsWith('rollout-link.jsonl'))).toBe(false)
  })

  it('skips history.jsonl', async () => {
    const rootPath = await tempRoot()
    await writeSession(rootPath, 'history.jsonl', '{"type":"x"}\n')
    await writeSession(
      rootPath,
      'rollout-keep.jsonl',
      '{"timestamp":"2026-10-07T10:00:00.000Z","type":"token_usage_record","payload":{"thread_id":"t","response_id":"resp_k","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}\n',
    )
    await writeSession(rootPath, 'notes.jsonl', '{"type":"x"}\n')
    const found = await discoverRolloutFiles(rootPath, nodeFsDeps())
    expect(found.every((f) => !f.absolutePath.endsWith('history.jsonl'))).toBe(true)
    expect(found.every((f) => !f.absolutePath.endsWith('notes.jsonl'))).toBe(true)
    expect(found).toHaveLength(1)
    expect(found[0]?.absolutePath.endsWith('rollout-keep.jsonl')).toBe(true)
  })

  it('import disabled refresh does not call readFrom', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const rootPath = await tempRoot()
    await writeSession(
      rootPath,
      'rollout-x.jsonl',
      '{"timestamp":"2026-10-07T10:00:00.000Z","type":"token_usage_record","payload":{"thread_id":"t","response_id":"resp","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}\n',
    )
    const readFromMock = vi.fn(readFrom)
    const service = new HistoryService({
      importEnabled: false,
      resolveRoot: async () => rootFor(rootPath),
      discover: discoverRolloutFiles,
      store,
      lease: async () => 'writer',
      now: () => 1,
      deviceId: 'device-test',
      readFrom: readFromMock,
      fsDeps: nodeFsDeps(),
    })
    await service.refresh()
    expect(readFromMock).not.toHaveBeenCalled()
    expect(service.sessionsFound).toBe(true)
    await store.close()
  })

  it('scans on the settings interval and notifies after each refresh', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const rootPath = await tempRoot()
    let notify: () => void = () => undefined
    const notified = new Promise<void>((resolve) => {
      notify = resolve
    })
    const setIntervalFn = vi.fn(() => 7 as unknown as ReturnType<typeof setInterval>)
    const clearIntervalFn = vi.fn()
    const service = new HistoryService({
      importEnabled: true,
      resolveRoot: async () => rootFor(rootPath),
      discover: discoverRolloutFiles,
      store,
      lease: async () => 'writer',
      now: () => 1,
      deviceId: 'device-test',
      fsDeps: nodeFsDeps(),
      scanIntervalMs: 60_000,
      onAfterRefresh: notify,
      setIntervalFn,
      clearIntervalFn,
    })
    service.start()
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 60_000)
    service.setScanInterval(5 * 60_000)
    expect(setIntervalFn).toHaveBeenLastCalledWith(expect.any(Function), 5 * 60_000)
    await notified
    service.stop()
    expect(clearIntervalFn).toHaveBeenCalled()
    await store.close()
  })

  it('prefers plain jsonl over a sibling zst and skips cache', async () => {
    const rootPath = await tempRoot()
    await writeSession(rootPath, 'rollout-a.jsonl', '{}\n')
    await writeSession(rootPath, 'rollout-a.jsonl.zst', 'stale')
    await writeSession(rootPath, 'rollout-b.jsonl.zst', 'only')
    await writeSession(rootPath, 'cache/rollout-hidden.jsonl', '{}\n')
    const found = await discoverRolloutFiles(rootPath, nodeFsDeps())
    const names = found.map((file) => file.absolutePath.split('/').pop())
    expect(names).toEqual(['rollout-a.jsonl', 'rollout-b.jsonl.zst'])
  })

  it('imports a zstd rollout', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const rootPath = await tempRoot()
    const root = rootFor(rootPath)
    const line =
      '{"timestamp":"2026-10-07T10:00:00.000Z","type":"token_usage_record","payload":{"thread_id":"t","response_id":"resp_z","usage":{"input_tokens":3,"cached_input_tokens":1,"output_tokens":1,"reasoning_output_tokens":0,"total_tokens":4}}}\n'
    const filePath = await writeSession(
      rootPath,
      'rollout-z.jsonl.zst',
      Buffer.from(rawZstdFrame(Buffer.from(line, 'utf8'))),
    )
    await importPath(store, root, filePath)
    await importPath(store, root, filePath)
    expect(await store.totals(root.sourceInstanceId)).toMatchObject({
      requests: 1,
      inputTokens: 3,
      outputTokens: 1,
    })
    await store.close()
  })
})

function rawZstdFrame(payload: Uint8Array): Uint8Array {
  if (payload.byteLength > 255) {
    throw new Error('test frame supports at most 255 bytes')
  }
  const size = payload.byteLength
  const header = 1 | (size << 3)
  const out = new Uint8Array(9 + size)
  out.set([
    0x28, 0xb5, 0x2f, 0xfd, 0x20, size,
    header & 0xff, (header >> 8) & 0xff, (header >> 16) & 0xff,
  ])
  out.set(payload, 9)
  return out
}
