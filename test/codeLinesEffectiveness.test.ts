import { describe, expect, it } from 'vitest'
import {
  lineVolumeRates,
  parseDiffNumstatInsertions,
} from '../src/codeLines/effectiveness'

describe('lineVolumeRates', () => {
  it('keeps landed and pending independent of AI', () => {
    const result = lineVolumeRates(15_000, 6_200, 4_625)
    expect(result.ai).toBe(15_000)
    expect(result.landed).toBe(6_200)
    expect(result.pending).toBe(4_625)
    expect(result.mergeRate).toBeCloseTo(6_200 / 15_000)
    expect(result.accountedRate).toBeCloseTo((6_200 + 4_625) / 15_000)
  })

  it('allows landed + pending to exceed AI', () => {
    const result = lineVolumeRates(1_000, 800, 500)
    expect(result.mergeRate).toBeCloseTo(0.8)
    expect(result.accountedRate).toBeCloseTo(1.3)
  })

  it('returns null rates when AI unknown', () => {
    const result = lineVolumeRates(null, 100, 50)
    expect(result.ai).toBeNull()
    expect(result.landed).toBe(100)
    expect(result.pending).toBe(50)
    expect(result.mergeRate).toBeNull()
    expect(result.accountedRate).toBeNull()
  })
})

describe('parseDiffNumstatInsertions', () => {
  it('sums insertions and skips binary', () => {
    expect(
      parseDiffNumstatInsertions('10\t2\ta.ts\n-\t-\tbin\n5\t0\tb.ts\n'),
    ).toBe(15)
  })
})
