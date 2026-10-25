import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import { emptyParserContext } from '../src/openaiHistory/codex/rolloutParser'
import { hourRangeTitle, localHourKey } from '../src/openaiHistory/historyGroups'
import {
  listCodexChildren,
  runCodexQuery,
  type CodexQuery,
} from '../src/openaiHistory/historyQuery'
import { codexContextMeter } from '../src/openaiHistory/pricing/listPrices'
import { openRequestStore } from '../src/openaiHistory/store/sqlJsRequestStore'
import type {
  ImportBatch,
  ImportBatchRequest,
  RequestStore,
} from '../src/openaiHistory/store/types'
import { startOfLocalDayMs } from '../src/time'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const sqlWasmDir = join(repoRoot, 'node_modules', 'sql.js', 'dist')

function locateWasm(file: string): string {
  return join(sqlWasmDir, file)
}

async function openStore(): Promise<RequestStore> {
  const sql = await initSqlJs({ locateFile: locateWasm })
  return openRequestStore(null, sql)
}

function baseRequest(
  overrides: Partial<ImportBatchRequest> &
    Pick<ImportBatchRequest, 'id' | 'accountScopeKey' | 'responseId' | 'observedAt'>,
): ImportBatchRequest {
  return {
    provider: 'openai',
    source: 'codex-local',
    accountConfidence: 'unknown',
    conversationId: 'thread-1',
    sessionId: 'session-1',
    turnId: 'turn-1',
    provisionalKey: null,
    startedAt: null,
    completedAt: null,
    model: 'model-a',
    modelEvidence: 'response',
    billingMode: 'api',
    status: 'completed',
    errorCode: null,
    inputTokens: 10,
    cachedInputTokens: null,
    cacheWriteInputTokens: null,
    outputTokens: 2,
    reasoningOutputTokens: null,
    totalTokens: 12,
    usageQuality: 'reported',
    usageAnomaly: false,
    estimatedApiCostUsd: '0.01',
    reportedCostUsd: null,
    pricingVersion: null,
    deviceId: 'device-test',
    sourceInstanceId: 'src-1',
    ...overrides,
  }
}

async function seedRequests(
  store: RequestStore,
  requests: ImportBatchRequest[],
  conversations?: ImportBatch['conversations'],
): Promise<void> {
  const byConv = new Map<string, ImportBatch['conversations'][number]>()
  for (const request of requests) {
    const convId = request.conversationId ?? 'missing'
    const key = `${request.accountScopeKey}\0${convId}`
    if (!byConv.has(key)) {
      byConv.set(key, {
        id: `conv-${key}`,
        provider: 'openai',
        accountScopeKey: request.accountScopeKey,
        conversationId: convId,
        parentConversationId: null,
        title: `#${convId.slice(0, 8)}`,
        turnCount: 1,
        firstObservedAt: request.observedAt,
        lastObservedAt: request.observedAt,
      })
    }
  }
  const batch: ImportBatch = {
    instance: {
      id: 'src-1',
      provider: 'openai',
      rootRealpath: '/tmp/codex',
      deviceId: 'device-test',
      lastScanAt: '2026-10-14T12:00:00.000Z',
      parserVersion: 'rollout-v1',
    },
    file: {
      id: 'file-1',
      sourceInstanceId: 'src-1',
      absolutePath: '/tmp/codex/sessions/a.jsonl',
      generation: 1,
      sizeBytes: 100,
      mtimeMs: 1,
      prefixFingerprint: 'fp',
    },
    checkpoint: {
      sourceFileId: 'file-1',
      generation: 1,
      byteOffset: 100,
      partialBytes: null,
      parserContext: emptyParserContext(),
    },
    conversations: conversations ?? [...byConv.values()],
    requests,
    observations: requests.map((request, index) => ({
      id: `obs-${request.id}`,
      requestId: request.id,
      sourceFileId: 'file-1',
      generation: 1,
      byteOffset: index + 1,
      observedAt: request.observedAt,
      attributesSpend: 1 as const,
    })),
    snapshots: [],
    unrecognizedDelta: 0,
  }
  // applyBatch forces estimated/reported costs to null — set via SQL after.
  await store.applyBatch(batch)
  const db = (store as unknown as { db: { run: (sql: string, params?: unknown[]) => void } }).db
  for (const request of requests) {
    db.run(
      `UPDATE requests SET
         estimated_api_cost_usd = ?,
         reported_cost_usd = ?,
         model = ?,
         status = ?,
         input_tokens = ?,
         output_tokens = ?,
         total_tokens = ?,
         conversation_id = ?,
         account_scope_key = ?
       WHERE id = ?`,
      [
        request.estimatedApiCostUsd,
        request.reportedCostUsd,
        request.model,
        request.status,
        request.inputTokens,
        request.outputTokens,
        request.totalTokens,
        request.conversationId,
        request.accountScopeKey,
        request.id,
      ],
    )
  }
}

function baseQuery(overrides: Partial<CodexQuery> = {}): CodexQuery {
  return {
    correlationId: 'c1',
    filterRevision: 1,
    from: null,
    to: null,
    accountScopeKey: null,
    model: null,
    status: null,
    groupBy: 'none',
    sort: 'time-desc',
    costBasis: 'estimated-api',
    cursor: null,
    limit: 100,
    ...overrides,
  }
}

describe('openaiHistory query', () => {
  it('keeps half-open local day bounds across DST transition days', async () => {
    const store = await openStore()
    // Local calendar construction so spring-forward / fall-back days stay half-open.
    const spring = '2026-03-29'
    const fall = '2026-10-25'
    const springStart = startOfLocalDayMs(spring)!
    const springNext = startOfLocalDayMs('2026-03-30')!
    const fallStart = startOfLocalDayMs(fall)!
    const fallNext = startOfLocalDayMs('2026-10-26')!

    const springEarly = new Date(springStart + 60 * 60 * 1000).toISOString()
    const springLate = new Date(springNext - 60 * 60 * 1000).toISOString()
    const springOutside = new Date(springNext + 60 * 60 * 1000).toISOString()
    const fallEarly = new Date(fallStart + 60 * 60 * 1000).toISOString()
    const fallLate = new Date(fallNext - 60 * 60 * 1000).toISOString()
    const fallOutside = new Date(fallNext + 30 * 60 * 1000).toISOString()

    await seedRequests(store, [
      baseRequest({
        id: 's1',
        accountScopeKey: 'unknown-source:src-1',
        responseId: 'resp-s1',
        observedAt: springEarly,
      }),
      baseRequest({
        id: 's2',
        accountScopeKey: 'unknown-source:src-1',
        responseId: 'resp-s2',
        observedAt: springLate,
      }),
      baseRequest({
        id: 's3',
        accountScopeKey: 'unknown-source:src-1',
        responseId: 'resp-s3',
        observedAt: springOutside,
      }),
      baseRequest({
        id: 'f1',
        accountScopeKey: 'unknown-source:src-1',
        responseId: 'resp-f1',
        observedAt: fallEarly,
      }),
      baseRequest({
        id: 'f2',
        accountScopeKey: 'unknown-source:src-1',
        responseId: 'resp-f2',
        observedAt: fallLate,
      }),
      baseRequest({
        id: 'f3',
        accountScopeKey: 'unknown-source:src-1',
        responseId: 'resp-f3',
        observedAt: fallOutside,
      }),
    ])

    const springPage = runCodexQuery(
      store,
      baseQuery({ from: spring, to: '2026-03-30' }),
      { spikeTokenThreshold: 1_000_000 },
    )
    expect(springPage.rows.map((r) => r.id).sort()).toEqual(['s1', 's2'])

    const fallPage = runCodexQuery(
      store,
      baseQuery({ from: fall, to: '2026-10-26' }),
      { spikeTokenThreshold: 1_000_000 },
    )
    expect(fallPage.rows.map((r) => r.id).sort()).toEqual(['f1', 'f2'])
    await store.close()
  })

  it('renders Mixed (2) for a group with two models', async () => {
    const store = await openStore()
    await seedRequests(store, [
      baseRequest({
        id: 'r1',
        accountScopeKey: 'unknown-source:src-1',
        responseId: 'a',
        observedAt: '2026-10-01T10:00:00.000Z',
        model: 'model-a',
        conversationId: 'thread-mix',
      }),
      baseRequest({
        id: 'r2',
        accountScopeKey: 'unknown-source:src-1',
        responseId: 'b',
        observedAt: '2026-10-01T11:00:00.000Z',
        model: 'model-b',
        conversationId: 'thread-mix',
      }),
    ])
    const page = runCodexQuery(
      store,
      baseQuery({ groupBy: 'conversation' }),
      { spikeTokenThreshold: 1_000_000 },
    )
    expect(page.rows).toHaveLength(1)
    expect(page.rows[0]?.modelLabel).toBe('Mixed (2)')
    await store.close()
  })

  it('shows 9/10 priced and sums only priced money', async () => {
    const store = await openStore()
    const requests = Array.from({ length: 10 }, (_, i) =>
      baseRequest({
        id: `r${i}`,
        accountScopeKey: 'unknown-source:src-1',
        responseId: `resp-${i}`,
        observedAt: `2026-10-01T10:0${i}:00.000Z`,
        estimatedApiCostUsd: i === 9 ? null : '0.10',
        conversationId: 'thread-price',
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      }),
    )
    await seedRequests(store, requests)
    const page = runCodexQuery(
      store,
      baseQuery({ groupBy: 'conversation', costBasis: 'estimated-api' }),
      { spikeTokenThreshold: 1_000_000 },
    )
    expect(page.rows[0]?.costLabel).toContain('9/10 priced')
    expect(page.totals.costUsd).toBeCloseTo(0.9, 5)
    expect(page.coverage.priced).toBe(9)
    expect(page.coverage.pricedDenom).toBe(10)
    await store.close()
  })

  it('keyset paging does not repeat ids', async () => {
    const store = await openStore()
    const requests = Array.from({ length: 5 }, (_, i) =>
      baseRequest({
        id: `r${i}`,
        accountScopeKey: 'unknown-source:src-1',
        responseId: `resp-${i}`,
        observedAt: `2026-10-0${i + 1}T10:00:00.000Z`,
      }),
    )
    await seedRequests(store, requests)

    const first = runCodexQuery(store, baseQuery({ limit: 2 }), {
      spikeTokenThreshold: 1_000_000,
    })
    expect(first.rows).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()

    const second = runCodexQuery(
      store,
      baseQuery({ limit: 2, cursor: first.nextCursor }),
      { spikeTokenThreshold: 1_000_000 },
    )
    const third = runCodexQuery(
      store,
      baseQuery({ limit: 2, cursor: second.nextCursor }),
      { spikeTokenThreshold: 1_000_000 },
    )
    const ids = [...first.rows, ...second.rows, ...third.rows].map((r) => r.id)
    expect(new Set(ids).size).toBe(5)
    expect(ids).toHaveLength(5)
    await store.close()
  })

  it('same title with two account scopes stays two groups', async () => {
    const store = await openStore()
    await seedRequests(store, [
      baseRequest({
        id: 'r1',
        accountScopeKey: 'unknown-source:aaa',
        responseId: 'resp-1',
        observedAt: '2026-10-01T10:00:00.000Z',
        conversationId: 'same-title',
        sourceInstanceId: 'aaa',
      }),
      baseRequest({
        id: 'r2',
        accountScopeKey: 'unknown-source:bbb',
        responseId: 'resp-2',
        observedAt: '2026-10-01T11:00:00.000Z',
        conversationId: 'same-title',
        sourceInstanceId: 'bbb',
      }),
    ])
    const page = runCodexQuery(
      store,
      baseQuery({ groupBy: 'conversation' }),
      { spikeTokenThreshold: 1_000_000 },
    )
    expect(page.rows).toHaveLength(2)
    await store.close()
  })

  it('status and model filters change SQL aggregates', async () => {
    const store = await openStore()
    await seedRequests(store, [
      baseRequest({
        id: 'r1',
        accountScopeKey: 'unknown-source:src-1',
        responseId: 'a',
        observedAt: '2026-10-01T10:00:00.000Z',
        model: 'model-a',
        status: 'completed',
        inputTokens: 100,
        outputTokens: 10,
        totalTokens: 110,
      }),
      baseRequest({
        id: 'r2',
        accountScopeKey: 'unknown-source:src-1',
        responseId: 'b',
        observedAt: '2026-10-01T11:00:00.000Z',
        model: 'model-b',
        status: 'failed',
        inputTokens: 50,
        outputTokens: 5,
        totalTokens: 55,
      }),
    ])
    const all = runCodexQuery(store, baseQuery(), { spikeTokenThreshold: 1_000_000 })
    expect(all.totals.requests).toBe(2)
    const filtered = runCodexQuery(
      store,
      baseQuery({ model: 'model-a', status: 'completed' }),
      { spikeTokenThreshold: 1_000_000 },
    )
    expect(filtered.totals.requests).toBe(1)
    expect(filtered.totals.inputTokens).toBe(100)
    expect(filtered.rows).toHaveLength(1)
    await store.close()
  })

  it('uses the session window and spikes only a single request', async () => {
    expect(codexContextMeter('gpt-6-astra', 142_065, 258_400)).toMatchObject({
      level: 'ok',
      percent: 55,
      windowLabel: '258,400',
    })
    expect(codexContextMeter('gpt-6.1-sol', 105_742, 258_400).percent).toBe(41)
    expect(codexContextMeter('gpt-6-astra', 36_790, 258_400).percent).toBe(14)
    expect(codexContextMeter('gpt-6-astra', 121_388, 258_400).percent).toBe(47)
    expect(codexContextMeter('gpt-6-astra', 63_913, 258_400).percent).toBe(25)
    expect(codexContextMeter('gpt-6.1-sol', 48_252, 258_400).percent).toBe(19)
    expect(codexContextMeter('gpt-6-astra', 142_065, null).level).toBe('unknown')

    const store = await openStore()
    await seedRequests(store, [
      baseRequest({
        id: 'old',
        accountScopeKey: 'unknown-source:src-1',
        responseId: 'old',
        observedAt: '2026-10-24T10:00:00.000Z',
        model: 'gpt-6-astra',
        conversationId: 'thread-plan',
        inputTokens: 200_000,
        outputTokens: 10_000,
        totalTokens: 1_200_000,
        modelContextWindow: 258_400,
      }),
      baseRequest({
        id: 'mid',
        accountScopeKey: 'unknown-source:src-1',
        responseId: 'mid',
        observedAt: '2026-10-24T18:00:00.000Z',
        model: 'gpt-6-astra',
        conversationId: 'thread-plan',
        inputTokens: 200_000,
        outputTokens: 10_000,
        totalTokens: 1_900_000,
        modelContextWindow: 258_400,
      }),
      baseRequest({
        id: 'new',
        accountScopeKey: 'unknown-source:src-1',
        responseId: 'new',
        observedAt: '2026-10-24T19:33:47.000Z',
        model: 'gpt-6-astra',
        conversationId: 'thread-plan',
        inputTokens: 142_065,
        outputTokens: 8_000,
        totalTokens: 229_895,
        modelContextWindow: 258_400,
      }),
    ])
    const grouped = runCodexQuery(
      store,
      baseQuery({ groupBy: 'conversation' }),
      { spikeTokenThreshold: 2_000_000 },
    )
    expect(grouped.rows).toHaveLength(1)
    expect(grouped.rows[0]?.spike).toBe(false)
    expect(grouped.rows[0]?.tokensLabel.startsWith('!')).toBe(false)
    expect(grouped.rows[0]?.contextPercent).toBe(55)
    expect(grouped.rows[0]?.contextLevel).toBe('ok')
    expect(grouped.rows[0]?.contextWindowLabel).toBe('258,400')

    const flat = runCodexQuery(store, baseQuery(), { spikeTokenThreshold: 2_000_000 })
    expect(flat.rows.every((row) => row.spike === false)).toBe(true)
    await store.close()
  })

  it('folds untitled threads from the same hour and leaves a named chat alone', async () => {
    const store = await openStore()
    const early = new Date(2026, 9, 25, 1, 2, 23).toISOString()
    const later = new Date(2026, 9, 25, 1, 40, 0).toISOString()
    const namedAt = new Date(2026, 9, 25, 1, 10, 0).toISOString()
    const scope = 'unknown-source:src-1'
    const conversation = (
      conversationId: string,
      title: string,
      observedAt: string,
    ) => ({
      id: `conv-${conversationId}`,
      provider: 'openai' as const,
      accountScopeKey: scope,
      conversationId,
      parentConversationId: null,
      title,
      turnCount: 1,
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
    })
    await seedRequests(
      store,
      [
        baseRequest({
          id: 'r1',
          accountScopeKey: scope,
          responseId: 'a',
          observedAt: early,
          conversationId: '01a17025aaaa',
          totalTokens: 100,
          inputTokens: 80,
          outputTokens: 20,
        }),
        baseRequest({
          id: 'r2',
          accountScopeKey: scope,
          responseId: 'b',
          observedAt: later,
          conversationId: '01a17026bbbb',
          totalTokens: 50,
          inputTokens: 40,
          outputTokens: 10,
        }),
        baseRequest({
          id: 'r3',
          accountScopeKey: scope,
          responseId: 'c',
          observedAt: namedAt,
          conversationId: 'named-thread',
          totalTokens: 10,
          inputTokens: 8,
          outputTokens: 2,
        }),
      ],
      [
        conversation('01a17025aaaa', '#01a17025', early),
        conversation('01a17026bbbb', '#01a17026', later),
        conversation('named-thread', 'Plan pracy', namedAt),
      ],
    )
    const page = runCodexQuery(
      store,
      baseQuery({ groupBy: 'conversation' }),
      { spikeTokenThreshold: 1_000_000 },
    )
    const hour = localHourKey(later)
    expect(hour).not.toBeNull()
    const folded = page.rows.find((row) => row.timeLabel === hourRangeTitle(hour ?? ''))
    const named = page.rows.find((row) => row.timeLabel === 'Plan pracy')
    expect(page.rows).toHaveLength(2)
    expect(folded?.requestCount).toBe(2)
    expect(folded?.conversationId.startsWith('hour:')).toBe(true)
    expect(named?.requestCount).toBe(1)
    const children = listCodexChildren(store, {
      conversationId: folded?.conversationId ?? '',
      accountScopeKey: scope,
      costBasis: 'estimated-api',
      spikeTokenThreshold: 1_000_000,
    })
    expect(children.map((row) => row.id)).toEqual(['r2', 'r1'])
    await store.close()
  })
})
