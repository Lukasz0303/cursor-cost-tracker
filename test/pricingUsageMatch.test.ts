import { describe, expect, it } from 'vitest'
import { catalogFromModels, type PricedModel } from '../src/pricing/parse'
import {
  catalogModelKey,
  cursorBenchScore,
  usageModelKey,
  withRequestCounts,
} from '../src/pricing/usageMatch'

function model(name: string, fast = false): PricedModel {
  return {
    name,
    provider: 'Cursor',
    pool: 'cursor',
    input: '$2',
    cacheWrite: null,
    cacheRead: '$0.5',
    output: '$6',
    hiddenByDefault: false,
    fast,
  }
}

describe('usage model keys', () => {
  it('drops effort suffixes and keeps fast on the usage id', () => {
    expect(usageModelKey('grok-4.7-high')).toBe('grok-4.7')
    expect(usageModelKey('grok-4.7-high-fast')).toBe('grok-4.7-fast')
    expect(usageModelKey('grok-4.6-medium')).toBe('grok-4.6')
    expect(usageModelKey('claude-opus-5-thinking-high')).toBe('claude-opus-5')
    expect(usageModelKey('gpt-5.6-sol-high')).toBe('gpt-5.6-sol')
  })

  it('builds the same key from catalog names', () => {
    expect(catalogModelKey(model('Grok 4.7'))).toBe('grok-4.7')
    expect(catalogModelKey(model('Grok 4.7 (Fast)', true))).toBe('grok-4.7-fast')
    expect(catalogModelKey(model('Grok 4.7 500k'))).toBe('grok-4.7-500k')
    expect(catalogModelKey(model('Claude Opus 5'))).toBe('claude-opus-5')
    expect(catalogModelKey(model('GPT-5.6 Sol'))).toBe('gpt-5.6-sol')
    expect(catalogModelKey(model('Claude Opus 4.7 (fast mode)', true))).toBe(
      'claude-opus-4.7-fast',
    )
  })

  it('counts requests and their share of the sample', () => {
    const catalog = catalogFromModels(
      [
        model('Grok 4.7'),
        model('Grok 4.6'),
        model('GPT-5.6 Sol'),
      ],
      '2026-09-26T00:00:00.000Z',
    )
    const counted = withRequestCounts(catalog, [
      'grok-4.7-high',
      'grok-4.7-high',
      'grok-4.6-medium',
      'gpt-5.6-sol-high',
      'default',
    ])
    const byName = new Map(counted.models.map((row) => [row.name, row]))
    expect(byName.get('Grok 4.7')).toMatchObject({ requests: 2, requestPercent: 40 })
    expect(byName.get('Grok 4.6')).toMatchObject({ requests: 1, requestPercent: 20 })
    expect(byName.get('GPT-5.6 Sol')).toMatchObject({ requests: 1, requestPercent: 20 })
  })

  it('uses the best CursorBench 4.0 score and skips Fast rows', () => {
    expect(cursorBenchScore(model('Grok 4.7'))).toBe(46.3)
    expect(cursorBenchScore(model('Composer 2.5'))).toBe(27.7)
    expect(cursorBenchScore(model('Claude Opus 5.5'))).toBe(57.8)
    expect(cursorBenchScore(model('Grok 4.7 (Fast)', true))).toBeNull()
    expect(cursorBenchScore(model('Grok 4.5'))).toBeNull()
  })
})
