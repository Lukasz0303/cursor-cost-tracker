import { describe, expect, it } from 'vitest'
import {
  clampSpikeTokenThreshold,
  DEFAULT_SPIKE_TOKEN_THRESHOLD,
  isSpike,
  kiloToTokens,
  snapKiloThreshold,
  tokensToKilo,
} from '../src/spikes/threshold'

describe('isSpike', () => {
  it('is false just below the default 1M threshold', () => {
    expect(isSpike(999_999, DEFAULT_SPIKE_TOKEN_THRESHOLD)).toBe(false)
  })

  it('is true at 1,000,000 tokens', () => {
    expect(isSpike(1_000_000, DEFAULT_SPIKE_TOKEN_THRESHOLD)).toBe(true)
  })

  it('respects a custom 2M threshold', () => {
    expect(isSpike(1_500_000, 2_000_000)).toBe(false)
    expect(isSpike(2_000_000, 2_000_000)).toBe(true)
  })
})

describe('clampSpikeTokenThreshold', () => {
  it('floors at 1,000 and defaults non-finite values to 1M', () => {
    expect(clampSpikeTokenThreshold(50)).toBe(1_000)
    expect(clampSpikeTokenThreshold(Number.NaN)).toBe(1_000_000)
  })
})

describe('kilo conversion', () => {
  it('edits the threshold in k units (100k, 200k, …)', () => {
    expect(kiloToTokens(100)).toBe(100_000)
    expect(kiloToTokens(200)).toBe(200_000)
    expect(tokensToKilo(1_000_000)).toBe(1_000)
    expect(kiloToTokens(1)).toBe(1_000)
  })
})

describe('snapKiloThreshold', () => {
  it('keeps 1–99 for manual minimum entry', () => {
    expect(snapKiloThreshold(1)).toBe(1)
    expect(snapKiloThreshold(50)).toBe(50)
  })

  it('snaps spinner drift (701) to 100k steps', () => {
    expect(snapKiloThreshold(701)).toBe(700)
    expect(snapKiloThreshold(901)).toBe(900)
    expect(snapKiloThreshold(1000)).toBe(1000)
    expect(snapKiloThreshold(150)).toBe(200)
  })
})
