import { describe, expect, it } from 'vitest'
import type { AccountModel } from '../src/pricing/accountModels'
import { buildCatalogLines } from '../src/pricing/catalogLines'
import { catalogFromModels, type PricedModel } from '../src/pricing/parse'

function row(name: string, provider: string, fast = false): PricedModel {
  return {
    name,
    provider,
    pool: provider === 'Cursor' ? 'cursor' : 'other',
    input: fast ? '$4' : '$2',
    cacheWrite: null,
    cacheRead: null,
    output: fast ? '$12' : '$6',
    hiddenByDefault: false,
    fast,
    requests: fast ? 1 : 4,
    requestPercent: fast ? 10 : 40,
    benchScore: fast ? null : 46.3,
  }
}

describe('buildCatalogLines', () => {
  const catalog = catalogFromModels(
    [
      row('Grok 4.7', 'Cursor'),
      row('Grok 4.7 (Fast)', 'Cursor', true),
      row('Grok 4.7 500k', 'Cursor'),
      row('Muse Spark 1.3', 'Meta'),
    ],
    '2026-10-10T00:00:00.000Z',
  )
  catalog.models = catalog.models.map((model) => ({
    ...model,
    requests: model.fast ? 1 : model.name === 'Muse Spark 1.3' ? 0 : 4,
    requestPercent: model.fast ? 10 : 40,
    benchScore: model.fast ? null : model.name.startsWith('Grok') ? 46.3 : null,
  }))

  it('puts one price on a model with a single option', () => {
    const account: AccountModel[] = [
      {
        id: 'muse-spark-1.3',
        name: 'Muse Spark 1.3',
        provider: 'Meta',
        enabled: true,
        variants: [],
      },
    ]
    expect(buildCatalogLines(catalog, account)).toEqual([
      expect.objectContaining({
        family: 'Muse Spark 1.3',
        variantLabel: '',
        provider: 'Meta',
        input: '$2',
        output: '$6',
        enabled: true,
        fast: false,
      }),
    ])
  })

  it('keeps effort options and distinct Fast or long-context prices inside the model', () => {
    const account: AccountModel[] = [
      {
        id: 'grok-4.7',
        name: 'Grok 4.7',
        provider: 'Cursor',
        enabled: true,
        variants: [
          { label: 'Medium', fast: false, longContext: false },
          { label: 'High', fast: false, longContext: false },
        ],
      },
    ]
    const lines = buildCatalogLines(catalog, account)
    expect(lines.map((line) => line.variantLabel)).toEqual([
      'Medium',
      'High',
      'Fast',
      '500k',
    ])
    expect(lines.find((line) => line.variantLabel === 'High')).toMatchObject({
      input: '$2',
      output: '$6',
    })
    expect(lines.find((line) => line.variantLabel === 'Fast')).toMatchObject({
      input: '$4',
      output: '$12',
      fast: true,
    })
    expect(lines.find((line) => line.variantLabel === '500k')?.input).toBe('$2')
  })

  it('marks models the account switch turned off', () => {
    const account: AccountModel[] = [
      {
        id: 'grok-4.5',
        name: 'Grok 4.5',
        provider: 'Cursor',
        enabled: false,
        variants: [],
      },
    ]
    expect(buildCatalogLines(catalog, account)[0]).toMatchObject({
      family: 'Grok 4.5',
      enabled: false,
      input: null,
    })
  })
})
