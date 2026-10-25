import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { afterEach, describe, expect, it } from 'vitest'
import { emptyParserContext } from '../src/openaiHistory/codex/rolloutParser'
import {
  countRequests,
  listObservations,
  openRequestStore,
} from '../src/openaiHistory/store/sqlJsRequestStore'
import { tryAcquireImportLease, type LeaseStore } from '../src/openaiHistory/store/storeLease'
import type {
  ImportBatch,
  ImportBatchRequest,
  StoreFileIo,
} from '../src/openaiHistory/store/types'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const sqlWasmDir = join(repoRoot, 'node_modules', 'sql.js', 'dist')

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

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'cct-openai-store-'))
  tempDirs.push(dir)
  return dir
}

function memoryLease(): LeaseStore & { value: string | null } {
  const store = {
    value: null as string | null,
    async read(): Promise<string | null> {
      return store.value
    },
    async write(value: string): Promise<void> {
      store.value = value
    },
  }
  return store
}

function baseRequest(
  overrides: Partial<ImportBatchRequest> & Pick<ImportBatchRequest, 'id' | 'accountScopeKey' | 'sourceInstanceId'>,
): ImportBatchRequest {
  return {
    provider: 'openai',
    source: 'codex-local',
    accountConfidence: 'unknown',
    conversationId: 'thread-1',
    sessionId: 'session-1',
    turnId: 'turn-1',
    responseId: 'resp-1',
    provisionalKey: null,
    observedAt: '2026-10-14T10:00:00.000Z',
    startedAt: null,
    completedAt: null,
    model: 'gpt-fixture',
    modelEvidence: 'response',
    billingMode: 'unknown',
    status: 'unknown',
    errorCode: null,
    inputTokens: 100,
    cachedInputTokens: null,
    cacheWriteInputTokens: null,
    outputTokens: 20,
    reasoningOutputTokens: null,
    totalTokens: 120,
    usageQuality: 'reported',
    usageAnomaly: false,
    estimatedApiCostUsd: null,
    reportedCostUsd: null,
    pricingVersion: null,
    deviceId: 'device-test',
    ...overrides,
  }
}

function makeBatch(input: {
  instanceId: string
  fileId: string
  byteOffset: number
  requests: ImportBatchRequest[]
  observations: ImportBatch['observations']
  unrecognizedDelta?: number
}): ImportBatch {
  return {
    instance: {
      id: input.instanceId,
      provider: 'openai',
      rootRealpath: `/tmp/${input.instanceId}`,
      deviceId: 'device-test',
      lastScanAt: '2026-10-14T12:00:00.000Z',
      parserVersion: 'rollout-v1',
    },
    file: {
      id: input.fileId,
      sourceInstanceId: input.instanceId,
      absolutePath: `/tmp/${input.instanceId}/sessions/rollout.jsonl`,
      generation: 1,
      sizeBytes: 1024,
      mtimeMs: 1_000,
      prefixFingerprint: 'fp-1',
    },
    checkpoint: {
      sourceFileId: input.fileId,
      generation: 1,
      byteOffset: input.byteOffset,
      partialBytes: null,
      parserContext: emptyParserContext(),
    },
    conversations: [
      {
        id: `conv-${input.requests[0]?.accountScopeKey ?? input.instanceId}-thread-1`,
        provider: 'openai',
        accountScopeKey:
          input.requests[0]?.accountScopeKey || `unknown-source:${input.instanceId}`,
        conversationId: 'thread-1',
        parentConversationId: null,
        title: '#thread-1',
        turnCount: 1,
        firstObservedAt: '2026-10-14T10:00:00.000Z',
        lastObservedAt: '2026-10-14T10:00:00.000Z',
      },
    ],
    requests: input.requests,
    observations: input.observations,
    snapshots: [],
    unrecognizedDelta: input.unrecognizedDelta ?? 0,
  }
}

describe('openaiHistory store', () => {
  it('flush and reopen keep request count and token sums', async () => {
    const sql = await loadSql()
    const dir = await tempDir()
    const dest = join(dir, 'openai-request-history.sqlite')
    const store = openRequestStore(null, sql)
    const instanceId = 'src-aaa'

    await store.applyBatch(
      makeBatch({
        instanceId,
        fileId: 'file-1',
        byteOffset: 200,
        requests: [
          baseRequest({
            id: 'req-1',
            accountScopeKey: `unknown-source:${instanceId}`,
            sourceInstanceId: instanceId,
            responseId: 'resp-a',
            inputTokens: 10,
            outputTokens: 3,
          }),
          baseRequest({
            id: 'req-2',
            accountScopeKey: `unknown-source:${instanceId}`,
            sourceInstanceId: instanceId,
            responseId: 'resp-b',
            inputTokens: 40,
            outputTokens: 7,
            observedAt: '2026-10-14T10:01:00.000Z',
          }),
        ],
        observations: [
          {
            id: 'obs-1',
            requestId: 'req-1',
            sourceFileId: 'file-1',
            generation: 1,
            byteOffset: 10,
            observedAt: '2026-10-14T10:00:00.000Z',
            attributesSpend: 1,
          },
          {
            id: 'obs-2',
            requestId: 'req-2',
            sourceFileId: 'file-1',
            generation: 1,
            byteOffset: 20,
            observedAt: '2026-10-14T10:01:00.000Z',
            attributesSpend: 1,
          },
        ],
      }),
    )

    await store.flush(dest)
    const bytes = await readFile(dest)
    await store.close()

    const reopened = openRequestStore(new Uint8Array(bytes), sql)
    await expect(reopened.totals(instanceId)).resolves.toEqual({
      requests: 2,
      inputTokens: 50,
      outputTokens: 10,
    })
    await reopened.close()
  })

  it('duplicate responseId adds observation without changing totals', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const instanceId = 'src-bbb'
    const scope = `unknown-source:${instanceId}`

    await store.applyBatch(
      makeBatch({
        instanceId,
        fileId: 'file-1',
        byteOffset: 100,
        requests: [
          baseRequest({
            id: 'req-1',
            accountScopeKey: scope,
            sourceInstanceId: instanceId,
            responseId: 'resp-shared',
            inputTokens: 15,
            outputTokens: 5,
          }),
        ],
        observations: [
          {
            id: 'obs-1',
            requestId: 'req-1',
            sourceFileId: 'file-1',
            generation: 1,
            byteOffset: 10,
            observedAt: '2026-10-14T10:00:00.000Z',
            attributesSpend: 1,
          },
        ],
      }),
    )

    await store.applyBatch(
      makeBatch({
        instanceId,
        fileId: 'file-1',
        byteOffset: 50,
        requests: [
          baseRequest({
            id: 'req-2',
            accountScopeKey: scope,
            sourceInstanceId: instanceId,
            responseId: 'resp-shared',
            inputTokens: 15,
            outputTokens: 5,
          }),
        ],
        observations: [
          {
            id: 'obs-2',
            requestId: 'req-2',
            sourceFileId: 'file-1',
            generation: 1,
            byteOffset: 40,
            observedAt: '2026-10-14T11:00:00.000Z',
            attributesSpend: 0,
          },
        ],
      }),
    )

    expect(countRequests(store)).toBe(1)
    const observations = listObservations(store)
    expect(observations).toHaveLength(2)
    expect(observations.map((o) => o.attributesSpend).sort()).toEqual([0, 1])
    expect(observations.every((o) => o.requestId === 'req-1')).toBe(true)
    await expect(store.totals(instanceId)).resolves.toEqual({
      requests: 1,
      inputTokens: 15,
      outputTokens: 5,
    })
    await store.close()
  })

  it('unknown-source scopes stay apart for the same responseId', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)

    await store.applyBatch(
      makeBatch({
        instanceId: 'aaa',
        fileId: 'file-aaa',
        byteOffset: 10,
        requests: [
          baseRequest({
            id: 'req-aaa',
            accountScopeKey: 'unknown-source:aaa',
            sourceInstanceId: 'aaa',
            responseId: 'resp-same',
          }),
        ],
        observations: [
          {
            id: 'obs-aaa',
            requestId: 'req-aaa',
            sourceFileId: 'file-aaa',
            generation: 1,
            byteOffset: 1,
            observedAt: '2026-10-14T10:00:00.000Z',
            attributesSpend: 1,
          },
        ],
      }),
    )

    await store.applyBatch(
      makeBatch({
        instanceId: 'bbb',
        fileId: 'file-bbb',
        byteOffset: 10,
        requests: [
          baseRequest({
            id: 'req-bbb',
            accountScopeKey: 'unknown-source:bbb',
            sourceInstanceId: 'bbb',
            responseId: 'resp-same',
          }),
        ],
        observations: [
          {
            id: 'obs-bbb',
            requestId: 'req-bbb',
            sourceFileId: 'file-bbb',
            generation: 1,
            byteOffset: 1,
            observedAt: '2026-10-14T10:00:00.000Z',
            attributesSpend: 1,
          },
        ],
      }),
    )

    expect(countRequests(store)).toBe(2)
    await expect(store.totals('aaa')).resolves.toMatchObject({ requests: 1 })
    await expect(store.totals('bbb')).resolves.toMatchObject({ requests: 1 })
    await store.close()
  })

  it('rolled-back batch does not advance the checkpoint', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const instanceId = 'src-rollback'
    const fileId = 'file-rollback'

    await store.applyBatch(
      makeBatch({
        instanceId,
        fileId,
        byteOffset: 100,
        requests: [
          baseRequest({
            id: 'req-ok',
            accountScopeKey: `unknown-source:${instanceId}`,
            sourceInstanceId: instanceId,
            responseId: 'resp-ok',
          }),
        ],
        observations: [
          {
            id: 'obs-ok',
            requestId: 'req-ok',
            sourceFileId: fileId,
            generation: 1,
            byteOffset: 1,
            observedAt: '2026-10-14T10:00:00.000Z',
            attributesSpend: 1,
          },
        ],
      }),
    )

    await expect(
      store.applyBatch(
        makeBatch({
          instanceId,
          fileId,
          byteOffset: 999,
          requests: [
            baseRequest({
              id: 'req-bad',
              accountScopeKey: '',
              sourceInstanceId: instanceId,
              responseId: 'resp-bad',
            }),
          ],
          observations: [
            {
              id: 'obs-bad',
              requestId: 'req-bad',
              sourceFileId: fileId,
              generation: 1,
              byteOffset: 2,
              observedAt: '2026-10-14T10:02:00.000Z',
              attributesSpend: 1,
            },
          ],
        }),
      ),
    ).rejects.toThrow(/account_scope_key/)

    const checkpoint = await store.readCheckpoint(fileId)
    expect(checkpoint?.byteOffset).toBe(100)
    expect(countRequests(store)).toBe(1)
    await store.close()
  })

  it('failed flush leaves the previous destination and checkpoint', async () => {
    const sql = await loadSql()
    const dir = await tempDir()
    const dest = join(dir, 'openai-request-history.sqlite')
    const instanceId = 'src-flush'
    const fileId = 'file-flush'

    const goodIo: StoreFileIo = {
      async writeFile(path, data) {
        await writeFile(path, data)
      },
      async rename(from, to) {
        const { rename } = await import('node:fs/promises')
        await rename(from, to)
      },
      async unlink(path) {
        const { unlink } = await import('node:fs/promises')
        try {
          await unlink(path)
        } catch {
          // ignore
        }
      },
      async readFile(path) {
        try {
          return new Uint8Array(await readFile(path))
        } catch {
          return null
        }
      },
    }

    const store = openRequestStore(null, sql, goodIo)
    await store.applyBatch(
      makeBatch({
        instanceId,
        fileId,
        byteOffset: 50,
        requests: [
          baseRequest({
            id: 'req-1',
            accountScopeKey: `unknown-source:${instanceId}`,
            sourceInstanceId: instanceId,
            responseId: 'resp-1',
            inputTokens: 8,
            outputTokens: 2,
          }),
        ],
        observations: [
          {
            id: 'obs-1',
            requestId: 'req-1',
            sourceFileId: fileId,
            generation: 1,
            byteOffset: 1,
            observedAt: '2026-10-14T10:00:00.000Z',
            attributesSpend: 1,
          },
        ],
      }),
    )
    await store.flush(dest)
    await store.close()

    const previousBytes = new Uint8Array(await readFile(dest))
    let writeCount = 0
    const failingIo: StoreFileIo = {
      ...goodIo,
      async writeFile(path, data) {
        writeCount += 1
        if (path.endsWith('.tmp') && writeCount >= 1) {
          throw new Error('disk full')
        }
        await goodIo.writeFile(path, data)
      },
    }

    const store2 = openRequestStore(previousBytes, sql, failingIo)
    await store2.applyBatch(
      makeBatch({
        instanceId,
        fileId,
        byteOffset: 500,
        requests: [
          baseRequest({
            id: 'req-2',
            accountScopeKey: `unknown-source:${instanceId}`,
            sourceInstanceId: instanceId,
            responseId: 'resp-2',
            inputTokens: 99,
            outputTokens: 99,
          }),
        ],
        observations: [
          {
            id: 'obs-2',
            requestId: 'req-2',
            sourceFileId: fileId,
            generation: 1,
            byteOffset: 2,
            observedAt: '2026-10-14T11:00:00.000Z',
            attributesSpend: 1,
          },
        ],
      }),
    )

    await expect(store2.flush(dest)).rejects.toThrow(/disk full/)

    const onDisk = new Uint8Array(await readFile(dest))
    expect(Buffer.from(onDisk).equals(Buffer.from(previousBytes))).toBe(true)

    const reopened = openRequestStore(onDisk, sql)
    const checkpoint = await reopened.readCheckpoint(fileId)
    expect(checkpoint?.byteOffset).toBe(50)
    await expect(reopened.totals(instanceId)).resolves.toEqual({
      requests: 1,
      inputTokens: 8,
      outputTokens: 2,
    })
    await reopened.close()
    await store2.close()
  })

  it('rejects batches that carry prompt, text, or arguments fields', async () => {
    const sql = await loadSql()
    const store = openRequestStore(null, sql)
    const batch = makeBatch({
      instanceId: 'src-sec',
      fileId: 'file-sec',
      byteOffset: 1,
      requests: [
        baseRequest({
          id: 'req-sec',
          accountScopeKey: 'unknown-source:src-sec',
          sourceInstanceId: 'src-sec',
        }),
      ],
      observations: [
        {
          id: 'obs-sec',
          requestId: 'req-sec',
          sourceFileId: 'file-sec',
          generation: 1,
          byteOffset: 1,
          observedAt: '2026-10-14T10:00:00.000Z',
          attributesSpend: 1,
        },
      ],
    })
    const smuggled = {
      ...batch,
      requests: [{ ...batch.requests[0], prompt: 'secret' }],
    } as unknown as ImportBatch

    await expect(store.applyBatch(smuggled)).rejects.toThrow(/prompt/)
    await store.close()
  })

  it('tryAcquireImportLease: writer, reader, then writer after expiry', async () => {
    const lease = memoryLease()
    const t0 = 1_000_000

    await expect(tryAcquireImportLease(lease, 'owner-a', t0)).resolves.toBe('writer')
    await expect(tryAcquireImportLease(lease, 'owner-b', t0 + 1_000)).resolves.toBe('reader')
    await expect(
      tryAcquireImportLease(lease, 'owner-c', t0 + 60_000 + 1),
    ).resolves.toBe('writer')
  })
})
