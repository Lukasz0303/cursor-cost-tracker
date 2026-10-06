import { describe, expect, it } from 'vitest'
import { cacheDollarsSaved, queryListPrice } from '../src/pricing/listPrice'
import { pricePerMillion } from '../src/pricing/money'

describe('queryListPrice', () => {
  it('prices 500k input tokens at $2/1M as 1 dollar', () => {
    const split = queryListPrice(
      {
        inputTokens: 500_000,
        outputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      },
      {
        input: pricePerMillion('$2'),
        output: null,
        cacheWrite: null,
        cacheRead: null,
      },
    )
    expect(split.inputUsd).toBe(1)
    expect(split.totalUsd).toBe(1)
    expect(split.pricedTokenShare).toBe(1)
  })

  it('omits a missing rate instead of showing $0', () => {
    const split = queryListPrice(
      {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        cacheWriteTokens: 500_000,
        cacheReadTokens: 0,
      },
      {
        input: 2,
        output: 10,
        cacheWrite: null,
        cacheRead: null,
      },
    )
    expect(split.inputUsd).toBe(2)
    expect(split.outputUsd).toBe(1)
    expect(split.cacheWriteUsd).toBeNull()
    expect(split.totalUsd).toBe(3)
    expect(split.pricedTokenShare).toBeCloseTo(1_100_000 / 1_600_000)
  })

  it('returns all null when no rates match', () => {
    const split = queryListPrice(
      {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      },
      { input: null, output: null, cacheWrite: null, cacheRead: null },
    )
    expect(split).toEqual({
      inputUsd: null,
      outputUsd: null,
      cacheWriteUsd: null,
      cacheReadUsd: null,
      totalUsd: null,
      pricedTokenShare: null,
    })
  })

  it('still computes list price when billed costUsd is 0', () => {
    const split = queryListPrice(
      {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      },
      { input: 2, output: 10, cacheWrite: null, cacheRead: null },
    )
    expect(split.totalUsd).toBe(3)
  })
})

describe('cacheDollarsSaved', () => {
  it('saves 1.80 for 1M cache-read at $0.20 when input is $2', () => {
    expect(
      cacheDollarsSaved([
        {
          cacheReadTokens: 1_000_000,
          inputPerMillion: pricePerMillion('$2'),
          cacheReadPerMillion: pricePerMillion('$0.20'),
        },
      ]),
    ).toBeCloseTo(1.8)
  })

  it('skips a row when cache-read rate is higher than input', () => {
    expect(
      cacheDollarsSaved([
        {
          cacheReadTokens: 1_000_000,
          inputPerMillion: 0.2,
          cacheReadPerMillion: 2,
        },
      ]),
    ).toBeNull()
  })

  it('sums only matched rows when half the sample has no rates', () => {
    expect(
      cacheDollarsSaved([
        {
          cacheReadTokens: 1_000_000,
          inputPerMillion: 2,
          cacheReadPerMillion: 0.2,
        },
        {
          cacheReadTokens: 5_000_000,
          inputPerMillion: null,
          cacheReadPerMillion: null,
        },
      ]),
    ).toBeCloseTo(1.8)
  })

  it('shows 0.00 when rates exist but cache-read tokens are zero', () => {
    expect(
      cacheDollarsSaved([
        {
          cacheReadTokens: 0,
          inputPerMillion: 2,
          cacheReadPerMillion: 0.2,
        },
      ]),
    ).toBe(0)
  })

  it('returns null when no row had both rates', () => {
    expect(
      cacheDollarsSaved([
        {
          cacheReadTokens: 1_000_000,
          inputPerMillion: null,
          cacheReadPerMillion: 0.2,
        },
      ]),
    ).toBeNull()
  })
})
