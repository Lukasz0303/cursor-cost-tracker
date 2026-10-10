import { describe, expect, it } from 'vitest'
import { splitCatalogName } from '../src/pricing/family'

describe('splitCatalogName', () => {
  it('keeps a single price row as the family', () => {
    expect(splitCatalogName('Muse Spark 1.3')).toEqual({
      family: 'Muse Spark 1.3',
      variant: '',
    })
    expect(splitCatalogName('Composer 2.5')).toEqual({
      family: 'Composer 2.5',
      variant: '',
    })
  })

  it('splits Fast and long-context prices off the model name', () => {
    expect(splitCatalogName('Grok 4.7')).toEqual({
      family: 'Grok 4.7',
      variant: '',
    })
    expect(splitCatalogName('Grok 4.7 (Fast)')).toEqual({
      family: 'Grok 4.7',
      variant: 'Fast',
    })
    expect(splitCatalogName('Grok 4.7 500k')).toEqual({
      family: 'Grok 4.7',
      variant: '500k',
    })
    expect(splitCatalogName('Grok 4.7 500k (Fast)')).toEqual({
      family: 'Grok 4.7',
      variant: '500k Fast',
    })
    expect(splitCatalogName('Claude 4 Sonnet 1M')).toEqual({
      family: 'Claude 4 Sonnet',
      variant: '1M',
    })
    expect(splitCatalogName('GPT-5 Fast')).toEqual({
      family: 'GPT-5',
      variant: 'Fast',
    })
    expect(splitCatalogName('Claude Opus 4.7 (fast mode)')).toEqual({
      family: 'Claude Opus 4.7',
      variant: 'Fast',
    })
  })
})
