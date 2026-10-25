import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import {
  computeFormulaCost,
  keepExistingPricingVersion,
  priceRequest,
} from '../src/openaiHistory/pricing/calculate'
import { addDecimal } from '../src/openaiHistory/pricing/decimal'
import {
  EMPTY_CATALOG,
  FIXTURE_PRICING_VERSION_ID,
  fixturePricingVersion,
} from '../src/openaiHistory/pricing/catalog'
import { formatCostCell, multiplyRate } from '../src/openaiHistory/pricing/decimal'
import { formatCodexMoney } from '../src/openaiHistory/historyRows'
import { openRequestStore } from '../src/openaiHistory/store/sqlJsRequestStore'
import type { TokenUsage } from '../src/openaiHistory/domain'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const sqlWasmDir = join(repoRoot, 'node_modules', 'sql.js', 'dist')

function locateWasm(file: string): string {
  return join(sqlWasmDir, file)
}

const fixtureUsage: TokenUsage = {
  inputTokens: 100_000,
  cachedInputTokens: 80_000,
  cacheWriteInputTokens: null,
  outputTokens: 10_000,
  reasoningOutputTokens: 2_000,
  totalTokens: 110_000,
  anomaly: false,
}

describe('decimal', () => {
  it('locks the 0.16 fixture as scale-6 canonical form', () => {
    // ((I-C)×2 + C×0.5 + O×8) / 1e6 = 0.16
    const uncached = multiplyRate(20_000, '2')
    const cached = multiplyRate(80_000, '0.5')
    const output = multiplyRate(10_000, '8')
    expect(uncached).toBe('0.040000')
    expect(cached).toBe('0.040000')
    expect(output).toBe('0.080000')
  })

  it('formatCostCell rounds only for display', () => {
    expect(formatCostCell(null)).toBe('—')
    expect(formatCostCell('0.160000')).toBe('$0.16')
    expect(formatCostCell('0.004000')).toBe('< $0.01')
    expect(formatCostCell('0')).toBe('$0.00')
  })
})

describe('priceRequest', () => {
  const catalog = [fixturePricingVersion()]

  it('prices the 0.16 fixture as 0.160000', () => {
    const priced = priceRequest({
      model: 'gpt-fixture',
      billingMode: 'api',
      usage: fixtureUsage,
      reportedCostUsd: null,
      catalog,
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    expect(priced.estimatedApiCostUsd).toBe('0.160000')
    expect(priced.apiEquivalentCostUsd).toBeNull()
    expect(priced.pricingVersion).toBe(FIXTURE_PRICING_VERSION_ID)
    expect(priced.costCoverage).toBe('complete')
    expect(priced.formulaBasis).toBe('estimated-api')
  })

  it('null cached input yields null cost', () => {
    const priced = priceRequest({
      model: 'gpt-fixture',
      billingMode: 'api',
      usage: { ...fixtureUsage, cachedInputTokens: null },
      reportedCostUsd: null,
      catalog,
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    expect(priced.estimatedApiCostUsd).toBeNull()
    expect(priced.costCoverage).toBe('partial')
  })

  it('missing model yields null cost and tokens-only coverage', () => {
    const priced = priceRequest({
      model: null,
      billingMode: 'api',
      usage: fixtureUsage,
      reportedCostUsd: null,
      catalog,
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    expect(priced.estimatedApiCostUsd).toBeNull()
    expect(priced.pricingVersion).toBeNull()
    expect(priced.costCoverage).toBe('tokens-only')
  })

  it('unknown model leaves cost null and coverage tokens-only', () => {
    const priced = priceRequest({
      model: 'not-in-catalog',
      billingMode: 'api',
      usage: fixtureUsage,
      reportedCostUsd: null,
      catalog,
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    expect(priced.estimatedApiCostUsd).toBeNull()
    expect(priced.costCoverage).toBe('tokens-only')
  })

  it('chatgpt-plan sets API-equivalent, keeps reported null, label starts with API-equiv.', () => {
    const priced = priceRequest({
      model: 'gpt-fixture',
      billingMode: 'chatgpt-plan',
      usage: fixtureUsage,
      reportedCostUsd: null,
      catalog,
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    expect(priced.estimatedApiCostUsd).toBeNull()
    expect(priced.apiEquivalentCostUsd).toBe('0.160000')
    expect(priced.reportedCostUsd).toBeNull()
    expect(priced.formulaBasis).toBe('api-equivalent')
    const label = formatCodexMoney(priced.apiEquivalentCostUsd, 'api-equivalent')
    expect(label.startsWith('API-equiv.')).toBe(true)
  })

  it('chatgpt-plan keeps a file-reported charge off the equivalent', () => {
    const priced = priceRequest({
      model: 'gpt-fixture',
      billingMode: 'chatgpt-plan',
      usage: fixtureUsage,
      reportedCostUsd: '1.250000',
      catalog,
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    expect(priced.reportedCostUsd).toBe('1.250000')
    expect(priced.apiEquivalentCostUsd).toBe('0.160000')
    expect(priced.estimatedApiCostUsd).toBeNull()
  })

  it('non-zero cache-write keeps coverage short of complete', () => {
    const priced = priceRequest({
      model: 'gpt-fixture',
      billingMode: 'api',
      usage: { ...fixtureUsage, cacheWriteInputTokens: 100 },
      reportedCostUsd: null,
      catalog,
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    expect(priced.estimatedApiCostUsd).toBe('0.160000')
    expect(priced.costCoverage).not.toBe('complete')
  })

  it('empty catalog yields null cost', () => {
    const priced = priceRequest({
      model: 'gpt-fixture',
      billingMode: 'api',
      usage: fixtureUsage,
      reportedCostUsd: null,
      catalog: EMPTY_CATALOG,
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    expect(priced.estimatedApiCostUsd).toBeNull()
    expect(priced.pricingVersion).toBeNull()
  })

  it('prices unknown billing as an API estimate', () => {
    const priced = priceRequest({
      model: 'gpt-fixture',
      billingMode: 'unknown',
      usage: fixtureUsage,
      reportedCostUsd: null,
      catalog,
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    expect(priced.estimatedApiCostUsd).toBe('0.160000')
    expect(priced.pricingVersion).toBe(FIXTURE_PRICING_VERSION_ID)
  })

  it('splits reasoning only when a reasoning rate exists', () => {
    const withReasoning = fixturePricingVersion({ reasoningRate: '16' })
    const priced = priceRequest({
      model: 'gpt-fixture',
      billingMode: 'unknown',
      usage: fixtureUsage,
      reportedCostUsd: null,
      catalog: [withReasoning],
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    // output 10000 includes reasoning 2000. output 8000×8 + reasoning 2000×16.
    // versus the no-reasoning-rate fixture 10000×8.
    expect(priced.estimatedApiCostUsd).toBe('0.176000')
  })

  it('sums per-request estimates to the formula on the token totals', () => {
    const catalog = [
      fixturePricingVersion({
        model: 'gpt-6-astra',
        inputRate: '2',
        cachedInputRate: '0.5',
        outputRate: '8',
      }),
    ]
    const left = priceRequest({
      model: 'gpt-6-astra',
      billingMode: 'unknown',
      usage: {
        inputTokens: 2_000_000,
        cachedInputTokens: 1_800_000,
        cacheWriteInputTokens: null,
        outputTokens: 20_000,
        reasoningOutputTokens: 1_000,
        totalTokens: 2_020_000,
        anomaly: false,
      },
      reportedCostUsd: null,
      catalog,
      observedAt: '2026-10-19T12:00:00.000Z',
    })
    const right = priceRequest({
      model: 'gpt-6-astra',
      billingMode: 'unknown',
      usage: {
        inputTokens: 1_619_408,
        cachedInputTokens: 1_417_920,
        cacheWriteInputTokens: null,
        outputTokens: 22_222,
        reasoningOutputTokens: 374,
        totalTokens: 1_641_630,
        anomaly: false,
      },
      reportedCostUsd: null,
      catalog,
      observedAt: '2026-10-19T12:00:00.000Z',
    })
    const whole = computeFormulaCost({
      inputTokens: 3_619_408,
      cachedInputTokens: 3_217_920,
      cacheWriteInputTokens: null,
      outputTokens: 42_222,
      reasoningOutputTokens: 1_374,
      inputRate: '2',
      cachedInputRate: '0.5',
      outputRate: '8',
      cacheWriteRate: null,
      reasoningRate: null,
    })
    expect(left.estimatedApiCostUsd).not.toBeNull()
    expect(right.estimatedApiCostUsd).not.toBeNull()
    expect(
      addDecimal(left.estimatedApiCostUsd ?? '0', right.estimatedApiCostUsd ?? '0'),
    ).toBe(whole)
  })

  it('re-applying the same response id keeps the first pricingVersion', () => {
    const first = priceRequest({
      model: 'gpt-fixture',
      billingMode: 'api',
      usage: fixtureUsage,
      reportedCostUsd: null,
      catalog,
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    const secondCatalog = [
      fixturePricingVersion({ id: 'fixture-gpt-v2', inputRate: '3' }),
    ]
    const second = priceRequest({
      model: 'gpt-fixture',
      billingMode: 'api',
      usage: fixtureUsage,
      reportedCostUsd: null,
      catalog: secondCatalog,
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    expect(second.pricingVersion).toBe('fixture-gpt-v2')
    expect(
      keepExistingPricingVersion(first.pricingVersion, second.pricingVersion),
    ).toBe(FIXTURE_PRICING_VERSION_ID)
  })

  it('prices gpt-6-astra from the OpenAI standard list without a saved rate', () => {
    const priced = priceRequest({
      model: 'gpt-6-astra',
      billingMode: 'unknown',
      usage: {
        inputTokens: 200_000,
        cachedInputTokens: 160_000,
        cacheWriteInputTokens: null,
        outputTokens: 1_000,
        reasoningOutputTokens: 0,
        totalTokens: 201_000,
        anomaly: false,
      },
      reportedCostUsd: null,
      catalog: [],
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    // (40k × $10 + 160k × $1 + 1k × $50) / 1e6 = 0.61
    expect(priced.estimatedApiCostUsd).toBe('0.610000')
    expect(priced.pricingVersion).toBe('openai-list:gpt-6-astra')
  })

  it('uses the long-context list rate above 272K input', () => {
    const priced = priceRequest({
      model: 'gpt-6.1-sol',
      billingMode: 'unknown',
      usage: {
        inputTokens: 300_000,
        cachedInputTokens: 0,
        cacheWriteInputTokens: null,
        outputTokens: 0,
        reasoningOutputTokens: null,
        totalTokens: 300_000,
        anomaly: false,
      },
      reportedCostUsd: null,
      catalog: [],
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    // 300k × ($2 × 2) / 1e6 = 1.20
    expect(priced.estimatedApiCostUsd).toBe('1.200000')
  })

  it('keeps a saved rate ahead of the list price', () => {
    const priced = priceRequest({
      model: 'gpt-6-astra',
      billingMode: 'unknown',
      usage: fixtureUsage,
      reportedCostUsd: null,
      catalog: [
        fixturePricingVersion({
          id: 'manual:gpt-6-astra',
          model: 'gpt-6-astra',
          inputRate: '1',
          cachedInputRate: '1',
          outputRate: '1',
        }),
      ],
      observedAt: '2026-10-14T12:00:00.000Z',
    })
    expect(priced.pricingVersion).toBe('manual:gpt-6-astra')
    expect(priced.estimatedApiCostUsd).toBe('0.110000')
  })
})

describe('migration 2 pricing_versions', () => {
  it('creates an empty pricing_versions table with no seed rows', async () => {
    const sql = await initSqlJs({ locateFile: locateWasm })
    const store = openRequestStore(null, sql)
    const db = (store as unknown as { db: { exec: (q: string) => unknown[] } }).db
    const rows = db.exec('SELECT COUNT(*) AS c FROM pricing_versions') as Array<{
      values: number[][]
    }>
    expect(rows[0]?.values[0]?.[0]).toBe(0)
    await store.close()
  })
})
