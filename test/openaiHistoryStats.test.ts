import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import { emptyParserContext } from '../src/openaiHistory/codex/rolloutParser'
import { runCodexCharts, runCodexLimitSeries } from '../src/openaiHistory/historyCharts'
import { runCodexStats } from '../src/openaiHistory/historyStats'
import { openRequestStore } from '../src/openaiHistory/store/sqlJsRequestStore'
import type {
  ImportBatch,
  ImportBatchRequest,
  RequestStore,
} from '../src/openaiHistory/store/types'
import { localDayKey } from '../src/time'

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
    inputTokens: 100,
    cachedInputTokens: 20,
    cacheWriteInputTokens: null,
    outputTokens: 10,
    reasoningOutputTokens: 2,
    totalTokens: 110,
    usageQuality: 'reported',
    usageAnomaly: false,
    estimatedApiCostUsd: '0.10',
    reportedCostUsd: null,
    pricingVersion: null,
    deviceId: 'device-test',
    sourceInstanceId: 'src-1',
    ...overrides,
  }
}

async function seed(
  store: RequestStore,
  requests: ImportBatchRequest[],
): Promise<void> {
  const conversations: ImportBatch['conversations'] = [
    {
      id: 'conv-1',
      provider: 'openai',
      accountScopeKey: 'acct-1',
      conversationId: 'thread-1',
      parentConversationId: null,
      title: 'Thread',
      turnCount: 1,
      firstObservedAt: requests[0]!.observedAt,
      lastObservedAt: requests[requests.length - 1]!.observedAt,
    },
  ]
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
      sizeBytes: 10,
      mtimeMs: 1,
      prefixFingerprint: 'fp',
    },
    checkpoint: {
      sourceFileId: 'file-1',
      generation: 1,
      byteOffset: 10,
      partialBytes: null,
      parserContext: emptyParserContext(),
    },
    conversations,
    requests,
    observations: requests.map((request, index) => ({
      id: `obs-${request.id}`,
      requestId: request.id,
      sourceFileId: 'file-1',
      generation: 1,
      byteOffset: index,
      observedAt: request.observedAt,
      attributesSpend: 1 as const,
    })),
    snapshots: [],
    unrecognizedDelta: 0,
  }
  // applyBatch forces estimated/reported costs to null until phase 4 — set via SQL.
  await store.applyBatch(batch)
  const db = (store as unknown as { db: { run: (sql: string, params?: unknown[]) => void } }).db
  for (const request of requests) {
    db.run(
      `UPDATE requests SET
         estimated_api_cost_usd = ?,
         reported_cost_usd = ?,
         cached_input_tokens = ?
       WHERE id = ?`,
      [
        request.estimatedApiCostUsd,
        request.reportedCostUsd,
        request.cachedInputTokens,
        request.id,
      ],
    )
  }
}

const emptyFilter = {
  from: null,
  to: null,
  accountScopeKey: null,
  model: null,
  status: null,
}

describe('runCodexStats', () => {
  it('builds the statistics cards from estimated dollars', async () => {
    const store = await openStore()
    await seed(store, [
      baseRequest({
        id: 'r1',
        accountScopeKey: 'acct-1',
        responseId: 'resp-1',
        observedAt: '2026-10-10T10:00:00.000Z',
        model: 'gpt-6-astra',
        estimatedApiCostUsd: '1.00',
        totalTokens: 100,
        inputTokens: 80,
        cachedInputTokens: 40,
        outputTokens: 20,
      }),
      baseRequest({
        id: 'r2',
        accountScopeKey: 'acct-1',
        responseId: 'resp-2',
        observedAt: '2026-10-19T11:00:00.000Z',
        model: 'gpt-6.1-sol',
        estimatedApiCostUsd: '3.00',
        totalTokens: 300,
        inputTokens: 200,
        cachedInputTokens: 100,
        outputTokens: 100,
      }),
    ])
    const stats = runCodexStats(store, emptyFilter)
    expect(stats.mirror.totalUsd).toBeCloseTo(4)
    expect(stats.mirror.avgUsd).toBeCloseTo(2)
    expect(stats.mirror.medianUsd).toBeCloseTo(2)
    expect(stats.mirror.byModel.map((row) => row.label)).toEqual([
      'gpt-6.1-sol',
      'gpt-6-astra',
    ])
    expect(stats.mirror.rates.map((row) => row.model)).toEqual([
      'gpt-6.1-sol',
      'gpt-6-astra',
    ])
    expect(stats.mirror.priciest?.usd).toBeCloseTo(3)
    expect(stats.mirror.busiest?.usd).toBeCloseTo(3)
  })

  it('cache hit uses only paired non-null C/I rows', async () => {
    const store = await openStore()
    await seed(store, [
      baseRequest({
        id: 'r1',
        accountScopeKey: 'acct-1',
        responseId: 'resp-1',
        observedAt: '2026-10-10T10:00:00.000Z',
        inputTokens: 100,
        cachedInputTokens: 50,
      }),
      baseRequest({
        id: 'r2',
        accountScopeKey: 'acct-1',
        responseId: 'resp-2',
        observedAt: '2026-10-10T11:00:00.000Z',
        inputTokens: 100,
        cachedInputTokens: null,
      }),
    ])
    const stats = runCodexStats(store, emptyFilter)
    // Only r1 pairs: 50/100 = 0.5 (r2 excluded because C is null)
    expect(stats.cacheHit).toBeCloseTo(0.5)
  })

  it('keeps estimated and reported as separate fields', async () => {
    const store = await openStore()
    await seed(store, [
      baseRequest({
        id: 'r1',
        accountScopeKey: 'acct-1',
        responseId: 'resp-1',
        observedAt: '2026-10-10T10:00:00.000Z',
        estimatedApiCostUsd: '0.20',
        reportedCostUsd: '0.50',
      }),
      baseRequest({
        id: 'r2',
        accountScopeKey: 'acct-1',
        responseId: 'resp-2',
        observedAt: '2026-10-10T11:00:00.000Z',
        estimatedApiCostUsd: '0.10',
        reportedCostUsd: null,
      }),
    ])
    const stats = runCodexStats(store, emptyFilter)
    expect(stats.estimatedApiCostUsd).toBeCloseTo(0.3)
    expect(stats.reportedCostUsd).toBeCloseTo(0.5)
    expect(stats.estimatedApiCostUsd).not.toBe(stats.reportedCostUsd)
  })

  it('omits reported card when every reported cost is null', async () => {
    const store = await openStore()
    await seed(store, [
      baseRequest({
        id: 'r1',
        accountScopeKey: 'acct-1',
        responseId: 'resp-1',
        observedAt: '2026-10-10T10:00:00.000Z',
        reportedCostUsd: null,
      }),
    ])
    const stats = runCodexStats(store, emptyFilter)
    expect(stats.reportedCostUsd).toBeNull()
  })

  it('keeps the newest rate-limit sample and marks a passed 5 h window stale', async () => {
    const store = await openStore()
    const db = (store as unknown as { db: { run: (sql: string, params?: unknown[]) => void } }).db
    const insert = `INSERT INTO rate_limit_samples(
      id, source_file_id, generation, byte_offset, observed_at, plan_type, limit_id,
      primary_used_percent, primary_window_minutes, primary_resets_at,
      secondary_used_percent, secondary_window_minutes, secondary_resets_at,
      credits_has_credits, credits_unlimited, credits_balance, rate_limit_reached_type
    ) VALUES (?, 'file', 1, ?, ?, ?, 'codex', ?, ?, ?, ?, ?, ?, 1, 0, NULL, NULL)`
    db.run(insert, [
      'old',
      1,
      '2026-10-07T08:00:00.000Z',
      'team',
      50,
      300,
      1_760_000_000,
      8,
      10080,
      1_760_100_000,
    ])
    db.run(insert, [
      'new',
      2,
      '2026-10-19T10:15:34.000Z',
      'team',
      26,
      300,
      1_792_422_464,
      4,
      10080,
      1_793_009_264,
    ])
    const stats = runCodexStats(store, emptyFilter, {
      nowMs: Date.parse('2026-10-23T05:00:00.000Z'),
    })
    expect(stats.limits?.planType).toBe('team')
    expect(stats.limits?.includedInPlan).toBe(true)
    expect(stats.limits?.primary?.usedPercent).toBe(26)
    expect(stats.limits?.primary?.remainingPercent).toBe(74)
    expect(stats.limits?.primary?.kind).toBe('5h')
    expect(stats.limits?.primary?.stale).toBe(true)
    expect(stats.limits?.secondary?.usedPercent).toBe(4)
    expect(stats.limits?.secondary?.remainingPercent).toBe(96)
    expect(stats.limits?.secondary?.kind).toBe('7d')
    expect(stats.limits?.secondary?.stale).toBe(false)
    expect(stats.limits?.creditsHas).toBe(true)
    expect(stats.limits?.creditsBalance).toBeNull()
    await store.close()
  })

  it('keeps the last measured percent when a newer snapshot has an empty window', async () => {
    const store = await openStore()
    const db = (store as unknown as { db: { run: (sql: string, params?: unknown[]) => void } }).db
    const insert = `INSERT INTO rate_limit_samples(
      id, source_file_id, generation, byte_offset, observed_at, plan_type, limit_id,
      primary_used_percent, primary_window_minutes, primary_resets_at,
      secondary_used_percent, secondary_window_minutes, secondary_resets_at,
      credits_has_credits, credits_unlimited, credits_balance, rate_limit_reached_type
    ) VALUES (?, 'file', 1, ?, ?, 'go', 'codex', ?, ?, ?, NULL, NULL, NULL, 0, 0, NULL, NULL)`
    db.run(insert, [
      'measured',
      1,
      '2026-10-23T19:39:52.186Z',
      99,
      43200,
      1_795_373_700,
    ])
    db.run(insert, [
      'cleared',
      2,
      '2026-10-23T19:39:52.984Z',
      null,
      null,
      null,
    ])
    const stats = runCodexStats(store, emptyFilter, {
      nowMs: Date.parse('2026-10-23T20:00:00.000Z'),
    })
    expect(stats.limits?.planType).toBe('go')
    expect(stats.limits?.primary?.usedPercent).toBe(99)
    expect(stats.limits?.primary?.kind).toBe('30d')
    expect(stats.limits?.primary?.stale).toBe(false)
    expect(stats.mirror.pace?.used).toBe(99)
    expect(stats.mirror.pace?.unit).toBe('day')
    expect(stats.mirror.pace?.kind).toBe('30d')
    await store.close()
  })

  it('paces a limit from the window age, not the gap between samples', async () => {
    const store = await openStore()
    const db = (store as unknown as { db: { run: (sql: string, params?: unknown[]) => void } }).db
    const insert = `INSERT INTO rate_limit_samples(
      id, source_file_id, generation, byte_offset, observed_at, plan_type, limit_id,
      primary_used_percent, primary_window_minutes, primary_resets_at,
      secondary_used_percent, secondary_window_minutes, secondary_resets_at,
      credits_has_credits, credits_unlimited, credits_balance, rate_limit_reached_type
    ) VALUES (?, 'file', 1, ?, ?, 'team', 'codex', ?, ?, ?, ?, ?, ?, 1, 0, NULL, NULL)`
    const weekReset = 1_793_009_264
    const fiveReset = 1_792_422_464
    db.run(insert, [
      'early',
      1,
      '2026-10-19T10:07:50.000Z',
      0,
      300,
      fiveReset,
      0,
      10080,
      weekReset,
    ])
    db.run(insert, [
      'later',
      2,
      '2026-10-19T10:15:34.000Z',
      26,
      300,
      fiveReset,
      4,
      10080,
      weekReset,
    ])
    const stats = runCodexStats(store, emptyFilter, {
      nowMs: Date.parse('2026-10-24T06:33:00.000Z'),
    })
    expect(stats.limits?.primary?.stale).toBe(true)
    expect(stats.limits?.primary?.fresh).toBe(false)
    expect(stats.limits?.secondary?.stale).toBe(false)
    expect(stats.limits?.secondary?.fresh).toBe(false)
    const pace = stats.mirror.pace
    expect(pace?.kind).toBe('7d')
    expect(pace?.used).toBe(4)
    expect(pace?.remaining).toBe(96)
    expect(pace?.dailyPace).toBeNull()
    expect(pace?.forecast).toBeNull()
    expect(pace?.over).toBe(false)
    expect(pace?.runsOutLabel).toBeNull()
    expect(pace?.fresh).toBe(false)
    const nowMs = Date.parse('2026-10-24T06:33:00.000Z')
    const endMs = weekReset * 1000
    const startMs = endMs - 10080 * 60 * 1000
    const day = 24 * 60 * 60 * 1000
    expect(pace?.elapsed).toBeCloseTo((nowMs - startMs) / day, 5)
    expect(pace?.left).toBeCloseTo((endMs - nowMs) / day, 5)
    expect(pace?.toLast).toBeCloseTo(96 / ((endMs - nowMs) / day), 4)
    expect(pace?.dailyBudget).toBeCloseTo(100 / 7, 5)
    expect(pace?.windowElapsedPercent).toBeCloseTo(((nowMs - startMs) / (endMs - startMs)) * 100, 4)
    await store.close()
  })

  it('moves the window clock to now and drops it after reset', async () => {
    const store = await openStore()
    const db = (store as unknown as { db: { run: (sql: string, params?: unknown[]) => void } }).db
    const insert = `INSERT INTO rate_limit_samples(
      id, source_file_id, generation, byte_offset, observed_at, plan_type, limit_id,
      primary_used_percent, primary_window_minutes, primary_resets_at,
      secondary_used_percent, secondary_window_minutes, secondary_resets_at,
      credits_has_credits, credits_unlimited, credits_balance, rate_limit_reached_type
    ) VALUES (?, 'file', 1, ?, ?, 'team', 'codex', NULL, NULL, NULL, ?, ?, ?, 0, 0, NULL, NULL)`
    const day = 24 * 60 * 60 * 1000
    const start = new Date(2026, 9, 24, 8, 43, 45).getTime()
    const end = start + 7 * day
    const asOf = start + 9 * 60 * 1000
    const now = new Date(2026, 9, 24, 20, 44, 0).getTime()
    db.run(insert, ['clock', 1, new Date(asOf).toISOString(), 4, 10080, end / 1000])
    const pace = runCodexStats(store, emptyFilter, { nowMs: now }).mirror.pace
    expect(pace?.used).toBe(4)
    expect(pace?.remaining).toBe(96)
    expect(pace?.dailyPace).toBeNull()
    expect(pace?.elapsed).toBeCloseTo((now - start) / day, 5)
    expect(pace?.left).toBeCloseTo((end - now) / day, 5)
    expect(pace?.toLast).toBeCloseTo(96 / ((end - now) / day), 4)
    expect(pace?.windowElapsedPercent).toBeCloseTo(((now - start) / (end - start)) * 100, 4)
    expect(pace?.elapsed).toBeCloseTo(0.5, 1)
    expect(pace?.left).toBeCloseTo(6.5, 1)
    expect(pace?.toLast).toBeCloseTo(14.8, 1)
    expect(pace?.windowElapsedPercent).toBeCloseTo(7.1, 1)

    const later = runCodexStats(store, emptyFilter, { nowMs: end + 1000 })
    expect(later.limits?.secondary?.stale).toBe(true)
    expect(later.mirror.pace).toBeNull()
    await store.close()
  })

  it('drops pace until a short window is 30 minutes old and a day window is a day old', async () => {
    const store = await openStore()
    const db = (store as unknown as { db: { run: (sql: string, params?: unknown[]) => void } }).db
    const insert = `INSERT INTO rate_limit_samples(
      id, source_file_id, generation, byte_offset, observed_at, plan_type, limit_id,
      primary_used_percent, primary_window_minutes, primary_resets_at,
      secondary_used_percent, secondary_window_minutes, secondary_resets_at,
      credits_has_credits, credits_unlimited, credits_balance, rate_limit_reached_type
    ) VALUES (?, 'file', 1, ?, ?, 'team', 'codex', ?, ?, ?, NULL, NULL, NULL, 0, 0, NULL, NULL)`
    const asOf = Date.parse('2026-10-24T06:44:08.000Z')
    const youngReset = (asOf + 5 * 60 * 60 * 1000 - 18 * 1000) / 1000
    db.run(insert, ['young', 1, new Date(asOf).toISOString(), 3, 300, youngReset])
    const young = runCodexStats(store, emptyFilter, { nowMs: asOf })
    expect(young.limits?.primary?.fresh).toBe(true)
    expect(young.mirror.pace?.dailyPace).toBeNull()
    expect(young.mirror.pace?.forecast).toBeNull()
    expect(young.mirror.pace?.over).toBe(false)

    const aged = asOf
    const agedReset = (aged + 5 * 60 * 60 * 1000 - 31 * 60 * 1000) / 1000
    db.run(insert, ['aged', 2, new Date(aged).toISOString(), 3, 300, agedReset])
    const ready = runCodexStats(store, emptyFilter, { nowMs: aged })
    const pace = ready.mirror.pace
    expect(pace?.unit).toBe('hour')
    expect(pace?.dailyPace).toBeCloseTo(3 / (31 / 60), 4)
    expect(pace?.dailyBudget).toBeCloseTo(20, 5)
    expect(pace?.over).toBe(false)
    expect(pace?.forecast).toBeGreaterThan(3)
    expect(pace?.forecast).toBeLessThan(100)
    await store.close()
  })

  it('keeps the latest reset as current and ignores a steep gap inside an older series', async () => {
    const store = await openStore()
    const db = (store as unknown as { db: { run: (sql: string, params?: unknown[]) => void } }).db
    const insert = `INSERT INTO rate_limit_samples(
      id, source_file_id, generation, byte_offset, observed_at, plan_type, limit_id,
      primary_used_percent, primary_window_minutes, primary_resets_at,
      secondary_used_percent, secondary_window_minutes, secondary_resets_at,
      credits_has_credits, credits_unlimited, credits_balance, rate_limit_reached_type
    ) VALUES (?, 'file', 1, ?, ?, 'team', 'codex', ?, ?, ?, ?, ?, ?, 0, 0, NULL, NULL)`
    const day = 24 * 60 * 60 * 1000
    const last = Date.parse('2026-07-10T12:00:00.000Z')
    const start = last - 3 * day - 8 * 60 * 1000
    const oldReset = Math.round((start + 7 * day) / 1000)
    db.run(insert, [
      'slope-a',
      1,
      new Date(last - 8 * 60 * 1000).toISOString(),
      10,
      300,
      oldReset,
      10,
      10080,
      oldReset,
    ])
    db.run(insert, [
      'slope-b',
      2,
      new Date(last).toISOString(),
      14,
      300,
      oldReset,
      14,
      10080,
      oldReset,
    ])
    const next = Date.parse('2026-10-24T06:44:08.000Z')
    const fiveReset = 1_792_842_180
    const weekReset = 1_793_428_980
    db.run(insert, [
      'next-a',
      3,
      '2026-10-24T06:43:50.000Z',
      3,
      300,
      fiveReset,
      0,
      10080,
      weekReset,
    ])
    db.run(insert, [
      'next-b',
      4,
      '2026-10-24T06:44:08.000Z',
      3,
      300,
      fiveReset,
      1,
      10080,
      weekReset,
    ])
    const stats = runCodexStats(store, emptyFilter, { nowMs: next })
    expect(stats.limits?.primary?.usedPercent).toBe(3)
    expect(stats.limits?.primary?.fresh).toBe(true)
    expect(stats.limits?.secondary?.usedPercent).toBe(1)
    expect(stats.limits?.secondary?.fresh).toBe(true)
    const pace = stats.mirror.pace
    expect(pace?.kind).toBe('7d')
    expect(pace?.used).toBe(1)
    expect(pace?.remaining).toBe(99)
    expect(pace?.dailyPace).toBeNull()
    expect(pace?.resetsAtMs).toBe(weekReset * 1000)
    const series = runCodexLimitSeries(store)
    const weeks = series.filter((item) => item.kind === '7d')
    expect(weeks).toHaveLength(2)
    expect(weeks.map((item) => item.resetsAt).sort()).toEqual([oldReset, weekReset].sort())
    await store.close()
  })

  it('forecasts past 100 when a day of usage already outruns the window', async () => {
    const store = await openStore()
    const db = (store as unknown as { db: { run: (sql: string, params?: unknown[]) => void } }).db
    const insert = `INSERT INTO rate_limit_samples(
      id, source_file_id, generation, byte_offset, observed_at, plan_type, limit_id,
      primary_used_percent, primary_window_minutes, primary_resets_at,
      secondary_used_percent, secondary_window_minutes, secondary_resets_at,
      credits_has_credits, credits_unlimited, credits_balance, rate_limit_reached_type
    ) VALUES (?, 'file', 1, ?, ?, 'team', 'codex', NULL, NULL, NULL, ?, ?, ?, 0, 0, NULL, NULL)`
    const asOf = Date.parse('2026-07-10T12:00:00.000Z')
    const day = 24 * 60 * 60 * 1000
    const resetsAt = Math.round((asOf + 6 * day) / 1000)
    db.run(insert, ['fast', 1, new Date(asOf).toISOString(), 50, 10080, resetsAt])
    const pace = runCodexStats(store, emptyFilter, { nowMs: asOf }).mirror.pace
    expect(pace?.dailyPace).toBeCloseTo(50, 4)
    expect(pace?.forecast).toBeCloseTo(350, 3)
    expect(pace?.over).toBe(true)
    expect(pace?.runsOutLabel).not.toBeNull()
    expect(pace?.left).toBeCloseTo(6, 4)
    await store.close()
  })
})

describe('runCodexCharts', () => {
  it('leaves a missing calendar day absent from the series', async () => {
    const store = await openStore()
    await seed(store, [
      baseRequest({
        id: 'r1',
        accountScopeKey: 'acct-1',
        responseId: 'resp-1',
        observedAt: '2026-10-10T10:00:00.000Z',
      }),
      baseRequest({
        id: 'r2',
        accountScopeKey: 'acct-1',
        responseId: 'resp-2',
        observedAt: '2026-10-12T10:00:00.000Z',
      }),
    ])
    const points = runCodexCharts(store, emptyFilter)
    const days = points.map((point) => localDayKey(point.timestamp))
    expect(days).toContain(localDayKey(Date.parse('2026-10-10T10:00:00.000Z')))
    expect(days).toContain(localDayKey(Date.parse('2026-10-12T10:00:00.000Z')))
    expect(days).not.toContain(
      localDayKey(Date.parse('2026-10-11T10:00:00.000Z')),
    )
    expect(points).toHaveLength(2)
    expect(points.reduce((sum, point) => sum + point.inputTokens, 0)).toBe(200)
    expect(points.reduce((sum, point) => sum + point.cachedInputTokens, 0)).toBe(40)
    expect(points.reduce((sum, point) => sum + point.outputTokens, 0)).toBe(20)
  })
})

describe('runCodexLimitSeries', () => {
  it('keeps 5 h and 7 day samples as separate series', async () => {
    const store = await openStore()
    await seed(store, [
      baseRequest({
        id: 'r1',
        accountScopeKey: 'acct-1',
        responseId: 'resp-1',
        observedAt: '2026-10-07T10:00:00.000Z',
      }),
    ])
    const db = (store as unknown as { db: { run: (sql: string) => void } }).db
    db.run(`INSERT INTO rate_limit_samples(
      id, source_file_id, generation, byte_offset, observed_at,
      plan_type, limit_id,
      primary_used_percent, primary_window_minutes, primary_resets_at,
      secondary_used_percent, secondary_window_minutes, secondary_resets_at,
      credits_has_credits, credits_unlimited, credits_balance,
      rate_limit_reached_type
    ) VALUES
      ('a', 'file-1', 1, 1, '2026-10-07T10:00:00.000Z', 'team', 'lim', 50, 300, 1760000000, 4, 10080, 1762000000, 1, 0, NULL, NULL),
      ('b', 'file-1', 1, 2, '2026-10-19T10:00:00.000Z', 'team', 'lim', 26, 300, 1760900000, 4, 10080, 1762000000, 1, 0, NULL, NULL)`)
    const series = runCodexLimitSeries(store)
    const fives = series.filter((item) => item.kind === '5h')
    const week = series.find((item) => item.kind === '7d')
    expect(fives).toHaveLength(2)
    expect(fives.map((item) => item.points.map((point) => point.usedPercent)).sort()).toEqual([
      [26],
      [50],
    ])
    expect(fives[0]?.resetsAt).not.toBe(fives[1]?.resetsAt)
    expect(week?.points).toHaveLength(2)
    expect(week?.resetsAt).toBe(1762000000)
    expect(week?.points.every((point) => point.usedPercent === 4)).toBe(true)
    await store.close()
  })
})
