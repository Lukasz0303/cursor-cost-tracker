import type { Database, SqlValue } from 'sql.js'
import type { BillingMode, TokenUsage } from '../domain'
import type { RequestStore } from '../store/types'
import { priceRequest } from './calculate'
import { mergeListPrices } from './listPrices'
import type { PricingSource, PricingVersion } from './types'

const EPOCH = '1970-01-01T00:00:00.000Z'

export type ModelRateInput = {
  model: string
  inputRate: string
  cachedInputRate: string
  outputRate: string
  cacheWriteRate: string | null
  reasoningRate: string | null
}

function storeDb(store: RequestStore): Database {
  const db = (store as unknown as { db: Database }).db
  if (db === undefined) {
    throw new Error('RequestStore database is not available')
  }
  return db
}

function queryAll(
  db: Database,
  sql: string,
  params: SqlValue[] = [],
): Record<string, SqlValue>[] {
  const stmt = db.prepare(sql)
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

function asNumber(value: SqlValue | undefined): number | null {
  return typeof value === 'number' ? value : null
}

function asString(value: SqlValue | undefined): string | null {
  return typeof value === 'string' ? value : null
}

export function loadPricingCatalog(db: Database): PricingVersion[] {
  const stored = queryAll(
    db,
    `SELECT id, model, effective_from, service_tier, input_rate, cached_input_rate,
            output_rate, cache_write_rate, reasoning_rate, source
     FROM pricing_versions
     ORDER BY model, effective_from`,
  ).map((row) => ({
    id: asString(row.id) ?? '',
    model: asString(row.model) ?? '',
    effectiveFrom: asString(row.effective_from) ?? EPOCH,
    serviceTier: asString(row.service_tier),
    inputRate: asString(row.input_rate) ?? '0',
    cachedInputRate: asString(row.cached_input_rate) ?? '0',
    outputRate: asString(row.output_rate) ?? '0',
    cacheWriteRate: asString(row.cache_write_rate),
    reasoningRate: asString(row.reasoning_rate),
    source: (asString(row.source) ?? 'manual') as PricingSource,
  }))
  return mergeListPrices(stored)
}

/** One rate per model, effective for every imported request. Blank rates delete it. */
export function replaceModelRates(db: Database, rates: readonly ModelRateInput[]): void {
  for (const rate of rates) {
    db.run('DELETE FROM pricing_versions WHERE model = ?', [rate.model])
    if (
      rate.inputRate.trim() === '' ||
      rate.cachedInputRate.trim() === '' ||
      rate.outputRate.trim() === ''
    ) {
      continue
    }
    db.run(
      `INSERT INTO pricing_versions(
        id, model, effective_from, service_tier, input_rate, cached_input_rate,
        output_rate, cache_write_rate, reasoning_rate, source
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 'manual')`,
      [
        `manual:${rate.model}`,
        rate.model,
        EPOCH,
        rate.inputRate.trim(),
        rate.cachedInputRate.trim(),
        rate.outputRate.trim(),
        rate.cacheWriteRate,
        rate.reasoningRate,
      ],
    )
  }
}

function usageFrom(row: Record<string, SqlValue>): TokenUsage {
  return {
    inputTokens: asNumber(row.input_tokens),
    cachedInputTokens: asNumber(row.cached_input_tokens),
    cacheWriteInputTokens: asNumber(row.cache_write_input_tokens),
    outputTokens: asNumber(row.output_tokens),
    reasoningOutputTokens: asNumber(row.reasoning_output_tokens),
    totalTokens: asNumber(row.total_tokens),
    anomaly: row.usage_anomaly === 1,
  }
}

/** Price rows that do not yet have an estimate. No-op when the catalog is empty. */
export function repriceUnpricedRequests(store: RequestStore): number {
  const db = storeDb(store)
  const catalog = loadPricingCatalog(db)
  if (catalog.length === 0) {
    return 0
  }
  const rows = queryAll(
    db,
    `SELECT * FROM requests
     WHERE estimated_api_cost_usd IS NULL OR estimated_api_cost_usd = ''`,
  )
  let priced = 0
  for (const row of rows) {
    const id = asString(row.id)
    if (id === null) {
      continue
    }
    const result = priceRequest({
      model: asString(row.model),
      billingMode: (asString(row.billing_mode) ?? 'unknown') as BillingMode,
      usage: usageFrom(row),
      reportedCostUsd: asString(row.reported_cost_usd),
      catalog,
      observedAt: asString(row.observed_at) ?? EPOCH,
    })
    const amount = result.estimatedApiCostUsd ?? result.apiEquivalentCostUsd
    if (amount === null) {
      continue
    }
    priced += 1
    db.run(
      `UPDATE requests
       SET estimated_api_cost_usd = ?, pricing_version = ?, cost_coverage = ?
       WHERE id = ?`,
      [amount, result.pricingVersion, result.costCoverage, id],
    )
  }
  return priced
}

/** Recompute every stored request from the current catalog. */
export function repriceStoredRequests(store: RequestStore): {
  priced: number
  denom: number
} {
  const db = storeDb(store)
  const catalog = loadPricingCatalog(db)
  const rows = queryAll(db, 'SELECT * FROM requests')
  let priced = 0
  for (const row of rows) {
    const id = asString(row.id)
    if (id === null) {
      continue
    }
    const billing = (asString(row.billing_mode) ?? 'unknown') as BillingMode
    const result = priceRequest({
      model: asString(row.model),
      billingMode: billing,
      usage: usageFrom(row),
      reportedCostUsd: asString(row.reported_cost_usd),
      catalog,
      observedAt: asString(row.observed_at) ?? EPOCH,
    })
    const amount = result.estimatedApiCostUsd ?? result.apiEquivalentCostUsd
    if (amount !== null) {
      priced += 1
    }
    db.run(
      `UPDATE requests
       SET estimated_api_cost_usd = ?, pricing_version = ?, cost_coverage = ?
       WHERE id = ?`,
      [amount, result.pricingVersion, result.costCoverage, id],
    )
  }
  return { priced, denom: rows.length }
}

export function saveModelRates(
  store: RequestStore,
  rates: readonly ModelRateInput[],
): { priced: number; denom: number } {
  replaceModelRates(storeDb(store), rates)
  return repriceStoredRequests(store)
}
