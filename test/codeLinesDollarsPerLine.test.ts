import { describe, expect, it } from 'vitest'
import {
  dollarsPerLine,
  sumWindowCostUsd,
} from '../src/codeLines/dollarsPerLine'

describe('sumWindowCostUsd', () => {
  const startMs = 1_000
  const endMs = 2_000

  it('sums costUsd inside the inclusive window', () => {
    const total = sumWindowCostUsd(
      [
        { timestamp: startMs, costUsd: 0.5 },
        { timestamp: 1_500, costUsd: 1.5 },
        { timestamp: endMs, costUsd: 0.25 },
      ],
      startMs,
      endMs,
    )
    expect(total).toBe(2.25)
  })

  it('excludes a query one millisecond before startMs', () => {
    const total = sumWindowCostUsd(
      [
        { timestamp: startMs - 1, costUsd: 9 },
        { timestamp: startMs, costUsd: 1 },
      ],
      startMs,
      endMs,
    )
    expect(total).toBe(1)
  })

  it('includes a query at endMs (collector end is inclusive)', () => {
    // composersInWindow uses ms <= untilMs; dollar window must match.
    const total = sumWindowCostUsd(
      [{ timestamp: endMs, costUsd: 2 }],
      startMs,
      endMs,
    )
    expect(total).toBe(2)
  })

  it('skips non-finite costUsd so one bad event cannot NaN the card', () => {
    const total = sumWindowCostUsd(
      [
        { timestamp: 1_500, costUsd: 1 },
        { timestamp: 1_600, costUsd: Number.NaN },
        { timestamp: 1_700, costUsd: Number.POSITIVE_INFINITY },
      ],
      startMs,
      endMs,
    )
    expect(total).toBe(1)
  })
})

describe('dollarsPerLine', () => {
  it('returns per-1k rates: $2 / 10 landed / 20 AI → 200 / 100', () => {
    expect(
      dollarsPerLine({ windowUsd: 2, landed: 10, ai: 20 }),
    ).toEqual({
      windowUsd: 2,
      usdPerLandedLine: 200,
      usdPerAiLine: 100,
    })
  })

  it('nulls landed rate when landed is 0 and keeps AI rate', () => {
    expect(
      dollarsPerLine({ windowUsd: 2, landed: 0, ai: 20 }),
    ).toEqual({
      windowUsd: 2,
      usdPerLandedLine: null,
      usdPerAiLine: 100,
    })
  })

  it('nulls AI rate when ai is null', () => {
    expect(
      dollarsPerLine({ windowUsd: 2, landed: 10, ai: null }),
    ).toEqual({
      windowUsd: 2,
      usdPerLandedLine: 200,
      usdPerAiLine: null,
    })
  })

  it('keeps $0 rates when denominators are positive', () => {
    expect(
      dollarsPerLine({ windowUsd: 0, landed: 10, ai: 20 }),
    ).toEqual({
      windowUsd: 0,
      usdPerLandedLine: 0,
      usdPerAiLine: 0,
    })
  })

  it('nulls landed rate when landed is negative', () => {
    expect(
      dollarsPerLine({ windowUsd: 2, landed: -5, ai: 20 }),
    ).toEqual({
      windowUsd: 2,
      usdPerLandedLine: null,
      usdPerAiLine: 100,
    })
  })

  it('nulls both rates when windowUsd is non-finite', () => {
    expect(
      dollarsPerLine({ windowUsd: Number.NaN, landed: 10, ai: 20 }),
    ).toEqual({
      windowUsd: 0,
      usdPerLandedLine: null,
      usdPerAiLine: null,
    })
  })

  it('scales large volumes to readable per-1k dollars', () => {
    expect(
      dollarsPerLine({ windowUsd: 704, landed: 70_404, ai: 120_874 }),
    ).toEqual({
      windowUsd: 704,
      usdPerLandedLine: (704 / 70_404) * 1000,
      usdPerAiLine: (704 / 120_874) * 1000,
    })
  })
})
