import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import { emptyParserContext } from '../src/openaiHistory/codex/rolloutParser'
import { buildCodexCsv } from '../src/openaiHistory/exportCsv'
import { collectCodexCsvRows } from '../src/openaiHistory/historyQuery'
import { openRequestStore } from '../src/openaiHistory/store/sqlJsRequestStore'
import type { ImportBatch, ImportBatchRequest, RequestStore } from '../src/openaiHistory/store/types'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const sqlWasmDir = join(repoRoot, 'node_modules', 'sql.js', 'dist')

function locateWasm(file: string): string {
  return join(sqlWasmDir, file)
}

async function openStore(): Promise<RequestStore> {
  const sql = await initSqlJs({ locateFile: locateWasm })
  return openRequestStore(null, sql)
}

function request(
  overrides: Partial<ImportBatchRequest> & Pick<ImportBatchRequest, 'id' | 'responseId'>,
): ImportBatchRequest {
  return {
    provider: 'openai',
    source: 'codex-local',
    accountScopeKey: 'unknown-source:src-1',
    accountConfidence: 'unknown',
    conversationId: 'thread-1',
    sessionId: 'session-1',
    turnId: 'turn-1',
    provisionalKey: null,
    observedAt: '2026-10-01T10:00:00.000Z',
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
    estimatedApiCostUsd: '0.05',
    reportedCostUsd: null,
    pricingVersion: null,
    deviceId: 'device-test',
    sourceInstanceId: 'src-1',
    ...overrides,
  }
}

async function seed(store: RequestStore, requests: ImportBatchRequest[], title: string): Promise<void> {
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
    conversations: [
      {
        id: 'conv-1',
        provider: 'openai',
        accountScopeKey: 'unknown-source:src-1',
        conversationId: 'thread-1',
        parentConversationId: null,
        title,
        turnCount: 1,
        firstObservedAt: '2026-10-01T10:00:00.000Z',
        lastObservedAt: '2026-10-01T11:00:00.000Z',
      },
    ],
    requests,
    observations: requests.map((row, index) => ({
      id: `obs-${row.id}`,
      requestId: row.id,
      sourceFileId: 'file-1',
      generation: 1,
      byteOffset: index + 1,
      observedAt: row.observedAt,
      attributesSpend: 1 as const,
    })),
    snapshots: [],
    unrecognizedDelta: 0,
  }
  await store.applyBatch(batch)
  const db = (store as unknown as { db: { run: (sql: string, params?: unknown[]) => void } }).db
  for (const row of requests) {
    db.run(
      `UPDATE requests SET estimated_api_cost_usd = ?, input_tokens = ?, output_tokens = ?, total_tokens = ? WHERE id = ?`,
      [row.estimatedApiCostUsd, row.inputTokens, row.outputTokens, row.totalTokens, row.id],
    )
  }
  db.run(`UPDATE conversations SET title = ? WHERE id = ?`, [title, 'conv-1'])
}

describe('openaiHistory exportCsv', () => {
  it('matches filtered sums across all pages and has no group rows', async () => {
    const store = await openStore()
    await seed(
      store,
      [
        request({
          id: 'r1',
          responseId: 'a',
          observedAt: '2026-10-01T10:00:00.000Z',
          inputTokens: 10,
          outputTokens: 2,
          totalTokens: 12,
          estimatedApiCostUsd: '0.10',
        }),
        request({
          id: 'r2',
          responseId: 'b',
          observedAt: '2026-10-01T11:00:00.000Z',
          inputTokens: 20,
          outputTokens: 4,
          totalTokens: 24,
          estimatedApiCostUsd: '0.20',
        }),
      ],
      '#thread-1',
    )
    const rows = collectCodexCsvRows(store, {
      correlationId: 'c1',
      filterRevision: 1,
      from: null,
      to: null,
      accountScopeKey: null,
      model: null,
      status: null,
      sort: 'time-desc',
      costBasis: 'estimated-api',
    })
    const csv = buildCodexCsv(rows)
    expect(csv.startsWith('source,device_id,')).toBe(true)
    expect(csv).not.toContain('group')
    expect(rows).toHaveLength(2)
    const inputSum = rows.reduce((sum, row) => sum + (row.inputTokens ?? 0), 0)
    const costSum = rows.reduce((sum, row) => sum + Number(row.estimatedApiCostUsd ?? 0), 0)
    expect(inputSum).toBe(30)
    expect(costSum).toBeCloseTo(0.3, 5)
    await store.close()
  })

  it('prefixes formula-like titles with a single quote', () => {
    const csv = buildCodexCsv([
      {
        source: 'codex-local',
        deviceId: 'device-test',
        accountScopeKey: 'unknown-source:x',
        accountConfidence: 'unknown',
        conversationId: 't',
        conversationTitle: '=cmd',
        turnId: null,
        responseId: 'r',
        observedAt: '2026-10-01T10:00:00.000Z',
        model: null,
        modelEvidence: 'unknown',
        status: 'completed',
        inputTokens: null,
        cachedInputTokens: null,
        outputTokens: null,
        reasoningOutputTokens: null,
        totalTokens: null,
        estimatedApiCostUsd: null,
        reportedCostUsd: null,
        billingMode: 'unknown',
        pricingVersion: null,
        usageQuality: 'missing',
        costCoverage: 'unknown',
      },
    ])
    expect(csv).toContain("'=cmd")
  })

  it('uses empty cells for null usage and never emits a prompt column', async () => {
    const store = await openStore()
    await seed(
      store,
      [
        request({
          id: 'r1',
          responseId: 'a',
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          estimatedApiCostUsd: null,
        }),
      ],
      '#thread-1',
    )
    const rows = collectCodexCsvRows(store, {
      correlationId: 'c1',
      filterRevision: 1,
      from: null,
      to: null,
      accountScopeKey: null,
      model: null,
      status: null,
      sort: 'time-desc',
      costBasis: 'estimated-api',
    })
    const csv = buildCodexCsv(rows)
    expect(csv).not.toContain('prompt')
    expect(csv).not.toContain('SECRET')
    const dataLine = csv.trim().split('\n')[1]!
    expect(dataLine.includes(',,')).toBe(true)
    await store.close()
  })
})
