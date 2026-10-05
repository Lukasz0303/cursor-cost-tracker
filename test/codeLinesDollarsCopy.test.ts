import { describe, expect, it } from 'vitest'
import { lineDollarsSummary } from '../src/codeLines/copy'

describe('lineDollarsSummary', () => {
  it('joins both rates in English', () => {
    expect(
      lineDollarsSummary(
        {
          windowUsd: 2,
          usdPerLandedLine: 40,
          usdPerAiLine: 20,
        },
        'en',
      ),
    ).toBe('40.00 $ / 1k landed lines · 20.00 $ / 1k AI lines')
  })

  it('shows only landed when AI rate is null', () => {
    expect(
      lineDollarsSummary(
        {
          windowUsd: 2,
          usdPerLandedLine: 40,
          usdPerAiLine: null,
        },
        'en',
      ),
    ).toBe('40.00 $ / 1k landed lines')
  })

  it('returns empty when neither rate is set', () => {
    expect(
      lineDollarsSummary(
        {
          windowUsd: 0,
          usdPerLandedLine: null,
          usdPerAiLine: null,
        },
        'en',
      ),
    ).toBe('')
  })

  it('joins both rates in Polish', () => {
    expect(
      lineDollarsSummary(
        {
          windowUsd: 2,
          usdPerLandedLine: 40,
          usdPerAiLine: 20,
        },
        'pl',
      ),
    ).toBe('40.00 $ / 1000 linii, które wylądowały · 20.00 $ / 1000 linii AI')
  })
})
