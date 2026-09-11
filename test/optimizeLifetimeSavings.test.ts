import { describe, expect, it } from 'vitest'
import {
  applyOptimizeCredit,
  basenameLabel,
  emptyLifetimeSavings,
  parseLifetimeSavings,
  toLifetimePayload,
} from '../src/ui/optimizeLifetimeSavings'

describe('basenameLabel', () => {
  it('returns the last path segment', () => {
    expect(basenameLabel('/Users/me/PROJEKTY/cursor-cost-tracker')).toBe(
      'cursor-cost-tracker',
    )
    expect(basenameLabel('C:\\work\\other-repo\\')).toBe('other-repo')
  })
})

describe('parseLifetimeSavings', () => {
  it('returns empty for invalid input', () => {
    expect(parseLifetimeSavings(null)).toEqual(emptyLifetimeSavings())
    expect(parseLifetimeSavings({ version: 2 })).toEqual(emptyLifetimeSavings())
  })

  it('recomputes totals from projects', () => {
    const state = parseLifetimeSavings({
      version: 1,
      totalTokens: 999,
      totalUsd: 9,
      projects: {
        '/a': {
          key: '/a',
          label: 'a',
          tokens: 100,
          usd: 0.1,
          lastRun: 1,
          lastTokensMid: 100,
          lastUsdMid: 0.1,
          updatedAt: 1,
        },
        '/b': {
          key: '/b',
          label: 'b',
          tokens: 50,
          usd: 0.05,
          lastRun: 2,
          lastTokensMid: 50,
          lastUsdMid: 0.05,
          updatedAt: 2,
        },
      },
    })
    expect(state.totalTokens).toBe(150)
    expect(state.totalUsd).toBe(0.15)
  })
})

describe('applyOptimizeCredit', () => {
  it('credits full mid on first run', () => {
    const result = applyOptimizeCredit(
      emptyLifetimeSavings(),
      '/proj/one',
      {
        run: 1,
        tokensMid: 500_000,
        usdMid: 0.27,
        label: 'one',
      },
      1000,
    )
    expect(result.changed).toBe(true)
    expect(result.creditedTokens).toBe(500_000)
    expect(result.creditedUsd).toBe(0.27)
    expect(result.state.totalTokens).toBe(500_000)
    expect(result.state.totalUsd).toBe(0.27)
    expect(result.state.projects['/proj/one']?.label).toBe('one')
    expect(result.state.projects['/proj/one']?.lastRun).toBe(1)
  })

  it('credits only mid delta on a later run', () => {
    const first = applyOptimizeCredit(emptyLifetimeSavings(), '/proj/one', {
      run: 1,
      tokensMid: 500_000,
      usdMid: 0.27,
      label: 'one',
    })
    const second = applyOptimizeCredit(first.state, '/proj/one', {
      run: 2,
      tokensMid: 750_000,
      usdMid: 0.41,
      label: 'one',
    })
    expect(second.changed).toBe(true)
    expect(second.creditedTokens).toBe(250_000)
    expect(second.creditedUsd).toBe(0.14)
    expect(second.state.totalTokens).toBe(750_000)
    expect(second.state.totalUsd).toBe(0.41)
  })

  it('is a no-op for the same run', () => {
    const first = applyOptimizeCredit(emptyLifetimeSavings(), '/proj/one', {
      run: 2,
      tokensMid: 750_000,
      usdMid: 0.41,
      label: 'one',
    })
    const again = applyOptimizeCredit(first.state, '/proj/one', {
      run: 2,
      tokensMid: 900_000,
      usdMid: 0.5,
      label: 'one',
    })
    expect(again.changed).toBe(false)
    expect(again.creditedTokens).toBe(0)
    expect(again.state.totalTokens).toBe(750_000)
  })

  it('credits zero when mid shrinks but still advances lastRun', () => {
    const first = applyOptimizeCredit(emptyLifetimeSavings(), '/proj/one', {
      run: 1,
      tokensMid: 500_000,
      usdMid: 0.27,
      label: 'one',
    })
    const second = applyOptimizeCredit(first.state, '/proj/one', {
      run: 2,
      tokensMid: 400_000,
      usdMid: 0.2,
      label: 'one',
    })
    expect(second.changed).toBe(true)
    expect(second.creditedTokens).toBe(0)
    expect(second.creditedUsd).toBe(0)
    expect(second.state.totalTokens).toBe(500_000)
    expect(second.state.projects['/proj/one']?.lastRun).toBe(2)
    expect(second.state.projects['/proj/one']?.lastTokensMid).toBe(400_000)
  })

  it('accumulates across projects', () => {
    const a = applyOptimizeCredit(emptyLifetimeSavings(), '/a', {
      run: 1,
      tokensMid: 100_000,
      usdMid: 0.1,
      label: 'alpha',
    })
    const b = applyOptimizeCredit(a.state, '/b', {
      run: 1,
      tokensMid: 200_000,
      usdMid: 0.2,
      label: 'beta',
    })
    expect(b.state.totalTokens).toBe(300_000)
    expect(b.state.totalUsd).toBe(0.3)
    const payload = toLifetimePayload(b.state)
    expect(payload.empty).toBe(false)
    expect(payload.summary).toContain('Saved so far:')
    expect(payload.projects.map((p) => p.label)).toEqual(['beta', 'alpha'])
  })
})
