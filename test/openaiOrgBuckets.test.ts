import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import { importOrganizationUsage } from '../src/openaiHistory/org/client'
import {
  parseCostsBody,
  parseUsageBody,
  readOrgUsageSummary,
  replaceOrgBuckets,
  summarizeOrgRows,
} from '../src/openaiHistory/org/buckets'
import { migrateSchema } from '../src/openaiHistory/store/migrations'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function scalar(db: Awaited<ReturnType<typeof openDb>>, sql: string): unknown {
  const stmt = db.prepare(sql)
  try {
    if (!stmt.step()) {
      return null
    }
    const row = stmt.getAsObject()
    const key = Object.keys(row)[0]
    return key === undefined ? null : row[key]
  } finally {
    stmt.free()
  }
}

async function openDb() {
  const SQL = await initSqlJs({
    locateFile: (file) => join(repoRoot, 'node_modules', 'sql.js', 'dist', file),
  })
  const db = new SQL.Database()
  migrateSchema(db)
  return db
}

const usagePage = {
  data: [
    {
      start_time: 1_700_000_000,
      end_time: 1_700_086_400,
      results: [
        {
          model: 'gpt-5',
          input_tokens: 100,
          output_tokens: 40,
          input_cached_tokens: 10,
          num_model_requests: 2,
        },
        {
          model: 'gpt-5-mini',
          input_tokens: 5,
          output_tokens: 1,
          input_cached_tokens: 0,
          num_model_requests: 1,
        },
      ],
    },
  ],
  next_page: 'cursor-2',
}

describe('organization usage buckets', () => {
  it('parses usage and cost pages without turning them into request costs', () => {
    const usage = parseUsageBody(usagePage)
    expect(usage.nextPage).toBe('cursor-2')
    expect(usage.rows).toHaveLength(2)
    expect(usage.rows[0]?.costUsd).toBeNull()
    expect(usage.rows[0]?.model).toBe('gpt-5')
    expect(summarizeOrgRows(usage.rows)?.requests).toBe(3)
    expect(summarizeOrgRows(usage.rows)?.inputTokens).toBe(105)
    const costs = parseCostsBody({
      data: [
        {
          start_time: 1_700_000_000,
          end_time: 1_700_086_400,
          results: [{ amount: { value: '3.5', currency: 'usd' } }],
        },
      ],
      next_page: null,
    })
    expect(costs.rows[0]?.costUsd).toBe('3.500000')
    expect(costs.rows[0]?.model).toBeNull()
    expect(costs.rows[0]?.requests).toBe(0)
  })

  it('replaces the same organization window and leaves request costs untouched', async () => {
    const db = await openDb()
    db.run(
      `INSERT INTO requests (
        id, provider, source, account_scope_key, account_confidence,
        observed_at, model_evidence, billing_mode, status, usage_quality,
        cost_coverage, device_id, source_instance_id, reported_cost_usd
      ) VALUES (
        'r1', 'openai', 'codex-local', 'acct', 'known',
        '2026-10-01T00:00:00.000Z', 'none', 'unknown', 'completed', 'exact',
        'unknown', 'dev', 'inst', '1.000000'
      )`,
    )
    const first = parseUsageBody(usagePage).rows
    replaceOrgBuckets(db, first, '2026-10-24T00:00:00.000Z')
    replaceOrgBuckets(db, first.slice(0, 1), '2026-10-24T00:15:00.000Z')
    const summary = readOrgUsageSummary(db)
    expect(summary?.requests).toBe(2)
    expect(summary?.inputTokens).toBe(100)
    expect(summary?.byModel.map((row) => row.model)).toEqual(['gpt-5'])
    expect(scalar(db, 'SELECT COUNT(*) FROM billing_buckets')).toBe(1)
    expect(scalar(db, 'SELECT reported_cost_usd FROM requests')).toBe('1.000000')
    db.close()
  })

  it('follows the next page and keeps the admin key out of the result', async () => {
    const secret = 'sk-admin-SECRET-VALUE'
    const seen: { url: string; authorization: string }[] = []
    const fetchImpl = async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      seen.push({ url, authorization: headers.get('authorization') ?? '' })
      const page = seen.length === 1 ? 'cursor-2' : null
      const body = url.includes('/costs')
        ? { data: [], next_page: null }
        : {
            data: [
              {
                start_time: 10,
                end_time: 20,
                results: [
                  {
                    model: seen.length === 1 ? 'gpt-5' : 'gpt-5-mini',
                    input_tokens: 3,
                    output_tokens: 1,
                    input_cached_tokens: 0,
                    num_model_requests: 1,
                  },
                ],
              },
            ],
            next_page: page,
          }
      return new Response(JSON.stringify(body), { status: 200 })
    }
    const result = await importOrganizationUsage({
      key: secret,
      fetchImpl,
      nowSec: 1_800_000_000,
    })
    expect(result.error).toBeNull()
    expect(result.rows.map((row) => row.model).filter(Boolean)).toEqual(['gpt-5', 'gpt-5-mini'])
    expect(seen.length).toBeGreaterThan(2)
    expect(seen.every((call) => call.authorization === `Bearer ${secret}`)).toBe(true)
    expect(seen.every((call) => !call.url.includes(secret))).toBe(true)
    expect(seen[0]?.url.includes('group_by')).toBe(true)
    expect(JSON.stringify(result).includes(secret)).toBe(false)
  })

  it('returns no rows on 429 so the previous window can stay', async () => {
    const secret = 'sk-admin-SECRET-VALUE'
    const result = await importOrganizationUsage({
      key: secret,
      nowSec: 1_800_000_000,
      fetchImpl: async () => new Response('slow down', { status: 429 }),
    })
    expect(result.rows).toEqual([])
    expect(result.error).toBe('OpenAI usage is rate limited. Previous numbers stay.')
    expect(result.error?.includes(secret)).toBe(false)
  })
})
