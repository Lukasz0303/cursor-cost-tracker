import { describe, expect, it } from 'vitest'
import { aggregateSpendMix, spendMixView } from '../src/spendMix/aggregate'
import type { SpendMixRow } from '../src/spendMix/aggregate'
import { gradeBucket, vendorLabel } from '../src/spendMix/classify'
import {
  DEFAULT_SPEND_MIX_BUCKETS,
  resolveSpendMixBuckets,
  SPEND_MIX_SCHEMA_ERROR,
} from '../src/spendMix/schema'
import type { SpendMixBucket } from '../src/spendMix/schema'

const EXAMPLE = {
  buckets: [
    { id: 'cheap', label: 'Cheap', match: ['luna', 'haiku'] },
    { id: 'balanced', label: 'Balanced', match: ['terra', 'sonnet'] },
    { id: 'high', label: 'High', match: ['sol', 'opus'] },
  ],
}

const CUSTOM: SpendMixBucket[] = [{ id: 'cheap', label: 'Cheap', match: ['haiku'] }]

function row(
  model: string | null,
  costUsd: number,
  extra: Partial<SpendMixRow> = {},
): SpendMixRow {
  return { model, costUsd, ...extra }
}

describe('resolveSpendMixBuckets', () => {
  it('uses the built-in list when the setting is empty', () => {
    const resolved = resolveSpendMixBuckets('   ')
    expect(resolved.error).toBeNull()
    expect(resolved.buckets).toEqual(EXAMPLE.buckets)
    expect(resolved.buckets).not.toBe(DEFAULT_SPEND_MIX_BUCKETS)
    expect(resolved.buckets[0]?.match).not.toBe(DEFAULT_SPEND_MIX_BUCKETS[0]?.match)
  })

  it('parses the documented example', () => {
    const resolved = resolveSpendMixBuckets(JSON.stringify(EXAMPLE))
    expect(resolved).toEqual({ buckets: EXAMPLE.buckets, error: null })
  })

  it('keeps the previous list when JSON or the schema is rejected', () => {
    const rejected = resolveSpendMixBuckets('{', CUSTOM)
    expect(rejected).toEqual({
      buckets: CUSTOM,
      error: SPEND_MIX_SCHEMA_ERROR.json,
    })
    expect(rejected.buckets).not.toBe(CUSTOM)
    expect(rejected.buckets[0]?.match).not.toBe(CUSTOM[0]?.match)
    expect(resolveSpendMixBuckets('[]', CUSTOM).error).toBe(SPEND_MIX_SCHEMA_ERROR.shape)
    expect(resolveSpendMixBuckets(null, CUSTOM).error).toBe(SPEND_MIX_SCHEMA_ERROR.json)
    expect(() => resolveSpendMixBuckets('{', CUSTOM)).not.toThrow()
  })

  it('rejects a payload over 4 KB before parsing', () => {
    const resolved = resolveSpendMixBuckets('x'.repeat(4097), CUSTOM)
    expect(resolved.error).toBe(SPEND_MIX_SCHEMA_ERROR.size)
    expect(resolved.buckets).toEqual(CUSTOM)
    expect(resolveSpendMixBuckets('x'.repeat(4096), CUSTOM).error).toBe(
      SPEND_MIX_SCHEMA_ERROR.json,
    )
  })

  it('rejects more than 8 buckets, duplicate ids, and a bad slug', () => {
    const buckets = Array.from({ length: 9 }, (_, index) => ({
      id: `b${index}`,
      label: `Bucket ${index}`,
      match: ['a'],
    }))
    expect(resolveSpendMixBuckets(JSON.stringify({ buckets }), CUSTOM).error).toBe(
      SPEND_MIX_SCHEMA_ERROR.buckets,
    )
    expect(
      resolveSpendMixBuckets(
        JSON.stringify({
          buckets: [
            { id: 'cheap', label: 'Cheap', match: ['a'] },
            { id: 'cheap', label: 'Again', match: ['b'] },
          ],
        }),
        CUSTOM,
      ).error,
    ).toBe(SPEND_MIX_SCHEMA_ERROR.duplicateId)
    expect(
      resolveSpendMixBuckets(
        JSON.stringify({ buckets: [{ id: 'Cheap', label: 'Cheap', match: ['a'] }] }),
        CUSTOM,
      ).error,
    ).toBe(SPEND_MIX_SCHEMA_ERROR.id)
  })

  it('rejects empty matches, long labels, markup, and more than 32 needles', () => {
    expect(
      resolveSpendMixBuckets(
        JSON.stringify({ buckets: [{ id: 'cheap', label: 'Cheap', match: [] }] }),
        CUSTOM,
      ).error,
    ).toBe(SPEND_MIX_SCHEMA_ERROR.matchCount)
    expect(
      resolveSpendMixBuckets(
        JSON.stringify({ buckets: [{ id: 'cheap', label: 'Cheap', match: [''] }] }),
        CUSTOM,
      ).error,
    ).toBe(SPEND_MIX_SCHEMA_ERROR.match)
    expect(
      resolveSpendMixBuckets(
        JSON.stringify({
          buckets: [{ id: 'cheap', label: 'C'.repeat(41), match: ['a'] }],
        }),
        CUSTOM,
      ).error,
    ).toBe(SPEND_MIX_SCHEMA_ERROR.label)
    expect(
      resolveSpendMixBuckets(
        JSON.stringify({
          buckets: [{ id: 'cheap', label: '<b>Cheap</b>', match: ['a'] }],
        }),
        CUSTOM,
      ).error,
    ).toBe(SPEND_MIX_SCHEMA_ERROR.label)
    const many = {
      buckets: [
        { id: 'one', label: 'One', match: Array.from({ length: 24 }, (_, index) => `a${index}`) },
        { id: 'two', label: 'Two', match: Array.from({ length: 9 }, (_, index) => `b${index}`) },
      ],
    }
    expect(resolveSpendMixBuckets(JSON.stringify(many), CUSTOM).error).toBe(
      SPEND_MIX_SCHEMA_ERROR.totalMatch,
    )
    many.buckets[1]?.match.pop()
    expect(resolveSpendMixBuckets(JSON.stringify(many), CUSTOM).error).toBeNull()
  })
})

describe('vendorLabel', () => {
  it('prefers a non-empty catalog provider over the family map', () => {
    expect(vendorLabel('claude-opus', [{ id: 'claude-opus', provider: 'Custom Lab' }])).toBe(
      'Custom Lab',
    )
    expect(vendorLabel('grok-4.7-high', [{ id: 'grok-4.7', provider: 'xAI' }])).toBe('xAI')
    expect(vendorLabel('claude-opus', [{ id: 'claude-opus', provider: '  ' }])).toBe('Anthropic')
  })

  it('maps family tokens and leaves everything else Unknown', () => {
    expect(vendorLabel('claude-haiku', [])).toBe('Anthropic')
    expect(vendorLabel('gpt-5.6-luna', [])).toBe('OpenAI')
    expect(vendorLabel('o3-mini', [])).toBe('OpenAI')
    expect(vendorLabel('o4', [])).toBe('OpenAI')
    expect(vendorLabel('grok-4', [])).toBe('xAI')
    expect(vendorLabel('gemini-3-flash', [])).toBe('Google')
    expect(vendorLabel('composer-2.5', [])).toBe('Cursor')
    expect(vendorLabel('cursor-small', [])).toBe('Cursor')
    expect(vendorLabel('cursor-grok', [])).toBe('xAI')
    expect(vendorLabel('mystery-model', [])).toBe('Unknown')
    expect(vendorLabel(null, [])).toBe('Unknown')
    expect(vendorLabel('   ', [])).toBe('Unknown')
  })
})

describe('gradeBucket', () => {
  it('uses the first case-insensitive substring and parks the rest in Other', () => {
    expect(gradeBucket('GPT-5.6-Luna', DEFAULT_SPEND_MIX_BUCKETS)).toEqual({
      id: 'cheap',
      label: 'Cheap',
    })
    expect(gradeBucket('claude-sonnet-5', DEFAULT_SPEND_MIX_BUCKETS).id).toBe('balanced')
    expect(gradeBucket('gpt-5.6-sol', DEFAULT_SPEND_MIX_BUCKETS).id).toBe('high')
    expect(gradeBucket('mystery', DEFAULT_SPEND_MIX_BUCKETS)).toEqual({
      id: 'other',
      label: 'Other',
    })
    expect(gradeBucket(null, DEFAULT_SPEND_MIX_BUCKETS).id).toBe('other')
  })

  it('does not compile match text as a regular expression', () => {
    const buckets: SpendMixBucket[] = [
      { id: 'cheap', label: 'Cheap', match: ['haiku'] },
      { id: 'wild', label: 'Wild', match: ['.*', 'haiku'] },
    ]
    expect(gradeBucket('claude-3-haiku', buckets).id).toBe('cheap')
    expect(gradeBucket('gpt-5', buckets)).toEqual({ id: 'other', label: 'Other' })
    expect(gradeBucket('sol', [{ id: 'wild', label: 'Wild', match: ['s.l'] }]).id).toBe('other')
  })
})

describe('aggregateSpendMix', () => {
  const options = { catalog: [], buckets: DEFAULT_SPEND_MIX_BUCKETS }

  it('sums billed dollars and ignores zero or negative rows', () => {
    const result = aggregateSpendMix(
      [row('claude-haiku', 0), row('claude-opus', 5), row('gpt-5', -2), row('gpt-5', Number.NaN)],
      'vendor',
      options,
    )
    expect(result.empty).toBe(false)
    expect(result.totalUsd).toBe(5)
    expect(result.slices).toEqual([
      { id: 'anthropic', label: 'Anthropic', costUsd: 5, queryCount: 1, share: 1 },
    ])
  })

  it('reports an empty pie when the sample has no billed dollars', () => {
    const result = aggregateSpendMix(
      [row('claude-haiku', 0), row('gpt-5', 0)],
      'grade',
      options,
    )
    expect(result).toEqual({ dimension: 'grade', totalUsd: 0, empty: true, slices: [] })
  })

  it('keeps a 1% slice and folds anything smaller into Other', () => {
    const kept = aggregateSpendMix(
      [row('claude-haiku', 99), row('grok-4', 1)],
      'vendor',
      options,
    )
    expect(kept.slices.map((slice) => slice.label)).toEqual(['Anthropic', 'xAI'])
    const folded = aggregateSpendMix(
      [row('claude-haiku', 199), row('grok-4', 1)],
      'vendor',
      options,
    )
    expect(folded.slices.map((slice) => [slice.label, slice.costUsd])).toEqual([
      ['Anthropic', 199],
      ['Other', 1],
    ])
    expect(folded.slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1, 5)
  })

  it('merges a tiny grade into the existing Other slice by label', () => {
    const result = aggregateSpendMix(
      [
        row('claude-haiku', 50),
        row('claude-sonnet', 49),
        row('claude-opus', 0.5),
        row('mystery-model', 0.5),
      ],
      'grade',
      options,
    )
    expect(result.slices.map((slice) => [slice.id, slice.costUsd])).toEqual([
      ['cheap', 50],
      ['balanced', 49],
      ['other', 1],
    ])
  })
})

describe('model, kind, size, and cache slices', () => {
  const options = { catalog: [], buckets: DEFAULT_SPEND_MIX_BUCKETS }

  it('groups models after the cursor- prefix and kinds by the billing label', () => {
    const result = aggregateSpendMix(
      [
        row('cursor-grok-4.7-high', 30, { kind: 'USAGE_EVENT_KIND_INCLUDED_IN_PRO' }),
        row('cursor-grok-4.7-high', 10, { kind: 'USAGE_EVENT_KIND_FREE_CREDIT' }),
        row('gpt-5.6-sol-high', 10, { kind: 'USAGE_EVENT_KIND_INCLUDED_IN_PRO' }),
      ],
      'model',
      options,
    )
    expect(result.slices.map((slice) => [slice.label, slice.costUsd])).toEqual([
      ['grok-4.7-high', 40],
      ['gpt-5.6-sol-high', 10],
    ])
    const kinds = aggregateSpendMix(
      [
        row('cursor-grok-4.7-high', 30, { kind: 'USAGE_EVENT_KIND_INCLUDED_IN_PRO' }),
        row('cursor-grok-4.7-high', 10, { kind: 'USAGE_EVENT_KIND_FREE_CREDIT' }),
      ],
      'kind',
      options,
    )
    expect(kinds.slices.map((slice) => slice.label)).toEqual(['Included In Pro', 'Free Credit'])
  })

  it('keeps CLI and a zero-dollar kind instead of folding them away', () => {
    const result = aggregateSpendMix(
      [
        row('grok', 100, {
          kind: 'USAGE_EVENT_KIND_INCLUDED_IN_PRO',
          conversationId: 'chat',
        }),
        row('grok', 0.4, {
          kind: 'USAGE_EVENT_KIND_INCLUDED_IN_PRO',
          conversationId: 'cli-1',
        }),
        row('default', 0, {
          kind: 'USAGE_EVENT_KIND_FREE_CREDIT',
          conversationId: 'chat',
        }),
        row('default', 0, {
          kind: 'USAGE_EVENT_KIND_FREE_CREDIT',
          conversationId: 'chat',
        }),
      ],
      'kind',
      { ...options, titles: { chat: 'Framework usage discussion' } },
    )
    expect(result.slices.map((slice) => [slice.label, slice.costUsd, slice.queryCount])).toEqual([
      ['Included In Pro', 100, 1],
      ['CLI', 0.4, 1],
      ['Free Credit', 0, 2],
    ])
  })

  it('puts billed dollars into token-size bands', () => {
    const result = aggregateSpendMix(
      [
        row('a', 5, { tokens: 10_000 }),
        row('b', 15, { tokens: 20_000 }),
        row('c', 40, { tokens: 1_000_000 }),
        row('d', 0, { tokens: 5_000_000 }),
      ],
      'size',
      options,
    )
    expect(result.slices.map((slice) => [slice.id, slice.costUsd])).toEqual([
      ['1m-up', 40],
      ['20-100k', 15],
      ['under-20k', 5],
    ])
  })

  it('assigns a row to the token bucket that dominates it', () => {
    const result = aggregateSpendMix(
      [
        row('a', 8, { cacheReadTokens: 90, inputTokens: 10 }),
        row('b', 2, { outputTokens: 40, inputTokens: 10 }),
        row('c', 1, { inputTokens: 4, cacheWriteTokens: 4 }),
      ],
      'cache',
      options,
    )
    expect(result.slices.map((slice) => slice.id)).toEqual(['cache-read', 'output', 'cache-write'])
  })

  it('counts billed queries on the slice and folds that count into Other', () => {
    const result = aggregateSpendMix(
      [
        row('claude-haiku', 50),
        row('claude-haiku', 49),
        row('mystery-a', 0.4),
        row('mystery-b', 0.4),
      ],
      'vendor',
      options,
    )
    expect(result.slices.map((slice) => [slice.label, slice.queryCount])).toEqual([
      ['Anthropic', 2],
      ['Other', 2],
    ])
  })
})

describe('limit slices', () => {
  const options = {
    catalog: [],
    buckets: DEFAULT_SPEND_MIX_BUCKETS,
    spikeTokenThreshold: 1_000_000,
    optimizedTargets: {
      version: 1 as const,
      conversationIds: ['done'],
      fingerprints: [],
    },
  }

  it('calls a query under the limit good, and keeps an optimized chat out of that bucket', () => {
    const result = aggregateSpendMix(
      [
        row('a', 2, { tokens: 10_000, conversationId: 'ok' }),
        row('b', 0, { tokens: 20_000, conversationId: 'also-ok' }),
        row('c', 9, { tokens: 2_000_000, conversationId: 'big' }),
        row('d', 4, { tokens: 5_000_000, conversationId: 'done' }),
      ],
      'limit',
      options,
    )
    expect(result.slices.map((slice) => [slice.id, slice.costUsd, slice.queryCount])).toEqual([
      ['over', 9, 1],
      ['optimized', 4, 1],
      ['good', 2, 2],
    ])
  })

  it('keeps All as the full sample and offers one entry per workspace folder', () => {
    const rows = [
      row('grok', 10, { conversationId: 'a', timestamp: Date.UTC(2026, 8, 1) }),
      row('grok', 4, { conversationId: 'b', timestamp: Date.UTC(2026, 9, 25) }),
      row('gpt', 1, { conversationId: 'missing', timestamp: Date.UTC(2026, 9, 2) }),
    ]
    const view = spendMixView(rows, '', [], {}, {
      projects: { a: 'cursor-cost-tracker', b: 'cursor-cost-tracker', c: 'other-app' },
      savedUsd: 9,
      savedProjects: [{ label: 'cursor-cost-tracker', usd: 3, tokens: 100 }],
    })
    expect(view.model.reduce((sum, slice) => sum + slice.costUsd, 0)).toBe(15)
    expect(view.projects.map((project) => project.label)).toEqual(['cursor-cost-tracker'])
    expect(view.projects[0]?.model.reduce((sum, slice) => sum + slice.costUsd, 0)).toBe(14)
    expect(view.projects[0]?.saved).toEqual({ usd: 3, tokens: 100 })
    expect(view.saved).toEqual({ usd: 9, tokens: 0 })
  })

  it('carries the credited Optimize total onto the view', () => {
    const view = spendMixView([row('a', 1, { tokens: 10 })], '', [], {}, {
      savedUsd: 12.5,
      savedTokens: 40_000,
    })
    expect(view.saved).toEqual({ usd: 12.5, tokens: 40_000 })
    const empty = spendMixView([row('a', 1)], '', [])
    expect(empty.saved).toEqual({ usd: 0, tokens: 0 })
  })
})

describe('conversation slices', () => {
  const titles = {
    a: 'Alpha',
    b: 'Alpha',
    c: 'Beta',
    d: 'Gamma',
    e: 'Delta',
    f: 'Epsilon',
    g: 'Zeta',
    h: 'Eta',
  }
  const options = { catalog: [], buckets: DEFAULT_SPEND_MIX_BUCKETS, titles }

  it('merges the same title, keeps the six largest chats, and reports sample facts', () => {
    const rows = [
      row('m', 10, { conversationId: 'a', timestamp: 1_700_000_000_000 }),
      row('m', 5, { conversationId: 'b', timestamp: 1_700_000_100_000 }),
      row('m', 20, { conversationId: 'c', timestamp: 1_700_086_400_000 }),
      row('m', 4, { conversationId: 'd' }),
      row('m', 3, { conversationId: 'e' }),
      row('m', 2, { conversationId: 'f' }),
      row('m', 1, { conversationId: 'g' }),
      row('m', 1, { conversationId: 'h' }),
      row('m', 0, { conversationId: 'i', timestamp: 1_699_000_000_000 }),
    ]
    const result = aggregateSpendMix(rows, 'conversation', options)
    expect(result.slices.map((slice) => [slice.label, slice.costUsd, slice.queryCount])).toEqual([
      ['Beta', 20, 1],
      ['Alpha', 15, 2],
      ['Gamma', 4, 1],
      ['Delta', 3, 1],
      ['Epsilon', 2, 1],
      ['Eta', 1, 1],
      ['Other', 1, 1],
    ])
    const view = spendMixView(rows, '', [], titles)
    expect(view.facts).toEqual({
      queryCount: 9,
      billedQueryCount: 8,
      conversationCount: 9,
      fromMs: 1_699_000_000_000,
      toMs: 1_700_086_400_000,
    })
  })
})

describe('spendMixView', () => {
  it('sends every chip and keeps the built-in buckets when JSON is invalid', () => {
    const view = spendMixView(
      [row('claude-haiku', 2, { tokens: 50_000, outputTokens: 10 }), row('gpt-5', 0)],
      '',
      [],
    )
    expect(view.error).toBeNull()
    expect(view.empty).toBe(false)
    expect(view.grade.map((slice) => slice.id)).toEqual(['cheap'])
    expect(view.vendor.map((slice) => slice.label)).toEqual(['Anthropic'])
    expect(view.model.map((slice) => slice.label)).toEqual(['claude-haiku'])
    expect(view.size.map((slice) => slice.id)).toEqual(['20-100k'])
    expect(view.cache.map((slice) => slice.id)).toEqual(['output'])
    expect(view.facts).toEqual({
      queryCount: 2,
      billedQueryCount: 1,
      conversationCount: 0,
      fromMs: null,
      toMs: null,
    })
    const rejected = spendMixView([row('claude-haiku', 2)], '{', [])
    expect(rejected.error).toBe(SPEND_MIX_SCHEMA_ERROR.json)
    expect(rejected.grade[0]?.id).toBe('cheap')
    expect(rejected.raw).toBe('{')
  })
})
