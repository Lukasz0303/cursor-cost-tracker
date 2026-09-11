import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPTIMIZE_DEPTH,
  parseOptimizeDepth,
} from '../src/optimizeDepth'
import { toOptimizeInsights } from '../src/ui/optimizeInsights'
import {
  CCT_SAVINGS_FENCE,
  OPTIMIZE_SAVINGS_FILE,
  parseOptimizeSavingsMarkdown,
} from '../src/ui/optimizeSavings'
import { buildOptimizePrompt } from '../src/ui/optimizePrompt'
import { toOptimizePayload } from '../src/ui/optimizePayload'
import type { UsageQuery } from '../src/usage/types'

function query(
  partial: Partial<UsageQuery> & { timestamp: number },
): UsageQuery {
  return {
    model: 'cursor-default',
    kind: 'USAGE_EVENT_KIND_INCLUDED_IN_BUSINESS',
    costUsd: 0.1,
    tokens: 10_000,
    inputTokens: 8_000,
    outputTokens: 2_000,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    ...partial,
  }
}

function sampleMarkdown(
  tokensMid: number,
  usdMid: number,
  run = 1,
  project = 'cursor-cost-tracker',
): string {
  return `# Projected savings

\`\`\`${CCT_SAVINGS_FENCE}
project: ${project}
tokens_mid: ${tokensMid}
usd_mid: ${usdMid}
run: ${run}
\`\`\`
`
}

describe('parseOptimizeDepth', () => {
  it('defaults to balanced', () => {
    expect(parseOptimizeDepth(undefined)).toBe(DEFAULT_OPTIMIZE_DEPTH)
    expect(parseOptimizeDepth('nope')).toBe('balanced')
  })

  it('accepts quick and deep', () => {
    expect(parseOptimizeDepth('quick')).toBe('quick')
    expect(parseOptimizeDepth('deep')).toBe('deep')
  })
})

describe('toOptimizeInsights', () => {
  it('returns empty insights for no queries', () => {
    const insights = toOptimizeInsights([])
    expect(insights.sampleSize).toBe(0)
    expect(insights.newest).toBeNull()
    expect(insights.addressableTokens).toBe(0)
    expect(insights.findings).toEqual([])
  })

  it('flags spikes and low cache, counts addressable tokens', () => {
    const insights = toOptimizeInsights(
      [
        query({
          timestamp: 3,
          tokens: 2_000_000,
          inputTokens: 1_500_000,
          outputTokens: 100_000,
          cacheReadTokens: 0,
          costUsd: 2,
          model: 'gpt-5',
        }),
        query({
          timestamp: 2,
          tokens: 20_000,
          inputTokens: 15_000,
          outputTokens: 5_000,
          cacheReadTokens: 40_000,
          costUsd: 0.05,
          model: 'composer',
        }),
        query({
          timestamp: 1,
          tokens: 30_000,
          inputTokens: 25_000,
          outputTokens: 5_000,
          cacheReadTokens: 0,
          costUsd: 0.2,
          model: 'gpt-5',
        }),
      ],
      { spikeTokenThreshold: 1_000_000 },
    )
    expect(insights.sampleSize).toBe(3)
    expect(insights.focus?.tokens).toBe(2_000_000)
    expect(insights.newest?.tokens).toBe(2_000_000)
    expect(insights.spikeCount).toBe(1)
    expect(insights.findings.some((f) => f.id === 'spikes')).toBe(false)
    expect(insights.findings.some((f) => f.id === 'newest-spike')).toBe(true)
    expect(insights.wasteyQueryCount).toBeGreaterThan(0)
    expect(insights.addressableTokens).toBeGreaterThan(0)
    expect(insights.topModelsByCost[0]?.model).toBe('gpt-5')
  })

  it('targets the last red query even when a cheaper query is newer', () => {
    const insights = toOptimizeInsights(
      [
        query({
          timestamp: 4,
          tokens: 8_000,
          costUsd: 0.02,
          model: 'composer',
        }),
        query({
          timestamp: 3,
          tokens: 1_500_000,
          costUsd: 1.8,
          model: 'gpt-5',
        }),
        query({
          timestamp: 2,
          tokens: 2_000_000,
          costUsd: 2.2,
          model: 'claude',
        }),
      ],
      { spikeTokenThreshold: 1_000_000 },
    )
    expect(insights.focus?.model).toBe('gpt-5')
    expect(insights.focus?.tokens).toBe(1_500_000)
    expect(insights.findings.some((f) => f.id === 'newest-spike')).toBe(true)
    expect(insights.findings.some((f) => f.id === 'no-red-query')).toBe(false)
  })

  it('reports no red query when nothing reaches Warn at', () => {
    const insights = toOptimizeInsights(
      [
        query({ timestamp: 2, tokens: 50_000, costUsd: 3 }),
        query({ timestamp: 1, tokens: 20_000, costUsd: 0.5 }),
      ],
      { spikeTokenThreshold: 1_000_000 },
    )
    expect(insights.focus).toBeNull()
    expect(insights.findings.some((f) => f.id === 'no-red-query')).toBe(true)
    expect(insights.findings.some((f) => f.id === 'newest-expensive')).toBe(
      false,
    )
  })
})

describe('parseOptimizeSavingsMarkdown', () => {
  it('returns empty projection when file is missing', () => {
    const savings = parseOptimizeSavingsMarkdown(null)
    expect(savings.hasProjection).toBe(false)
    expect(savings.estTokensSaved).toBe(0)
    expect(savings.estUsdSaved).toBe(0)
    expect(savings.summary).toBe('Projected save per similar request: 0 / 0.00 $')
    expect(savings.note).toContain('similar request')
  })

  it('parses mid tokens and USD from cct-savings fence', () => {
    const savings = parseOptimizeSavingsMarkdown(
      sampleMarkdown(120_000, 0.15, 2, 'my-app'),
    )
    expect(savings.hasProjection).toBe(true)
    expect(savings.estTokensSaved).toBe(120_000)
    expect(savings.estUsdSaved).toBe(0.15)
    expect(savings.project).toBe('my-app')
    expect(savings.run).toBe(2)
    expect(savings.summary).toContain('120')
    expect(savings.note).toContain('run #2')
    expect(savings.note).toContain('similar request')
  })

  it('notes missing fence when markdown has no block', () => {
    const savings = parseOptimizeSavingsMarkdown('# just prose\n')
    expect(savings.hasProjection).toBe(false)
    expect(savings.note).toContain(CCT_SAVINGS_FENCE)
  })
})

describe('buildOptimizePrompt', () => {
  it('scales length Quick < Balanced < Deep', () => {
    const insights = toOptimizeInsights([
      query({
        timestamp: 2,
        tokens: 1_500_000,
        costUsd: 1.2,
        model: 'gpt-5',
      }),
      query({ timestamp: 1, tokens: 20_000, costUsd: 0.05, model: 'composer' }),
    ])
    const quick = buildOptimizePrompt(insights, 'quick')
    const balanced = buildOptimizePrompt(insights, 'balanced')
    const deep = buildOptimizePrompt(insights, 'deep')
    expect(quick.length).toBeLessThan(balanced.length)
    expect(balanced.length).toBeLessThan(deep.length)
    expect(quick).toContain('Task (Quick)')
    expect(quick).not.toContain('Diagnosis checklist')
    expect(balanced).toContain('Task (Balanced)')
    expect(balanced).toContain('Light context')
    expect(deep).toContain('Task (Deep)')
    expect(deep).toContain('Diagnosis checklist')
    expect(deep).toContain('Quality bar')
  })

  it('requires projected savings file and fence in every depth', () => {
    const insights = toOptimizeInsights([
      query({ timestamp: 1, tokens: 1_500_000, costUsd: 1.2 }),
    ])
    for (const depth of ['quick', 'balanced', 'deep'] as const) {
      const prompt = buildOptimizePrompt(
        insights,
        depth,
        null,
        undefined,
        'cursor-cost-tracker',
      )
      expect(prompt).toContain(OPTIMIZE_SAVINGS_FILE)
      expect(prompt).toContain(CCT_SAVINGS_FENCE)
      expect(prompt).toContain('do not audit the whole workspace')
      expect(prompt).toContain('project: cursor-cost-tracker')
      expect(prompt).toContain('Project (this workspace): cursor-cost-tracker')
      expect(prompt).toContain('mid tokens saved')
      expect(prompt).toContain('project name')
    }
  })

  it('includes prior file for cumulative updates on balanced/deep', () => {
    const insights = toOptimizeInsights([
      query({ timestamp: 1, tokens: 1_500_000, costUsd: 1.2 }),
    ])
    const prior = sampleMarkdown(50_000, 0.05, 1)
    const balanced = buildOptimizePrompt(
      insights,
      'balanced',
      prior,
      parseOptimizeSavingsMarkdown(prior),
    )
    const deep = buildOptimizePrompt(
      insights,
      'deep',
      prior,
      parseOptimizeSavingsMarkdown(prior),
    )
    expect(balanced).toContain('Prior projection')
    expect(balanced).toContain('tokens_mid: 50000')
    expect(deep).toContain('Prior projection')
    expect(deep).toContain('cumulative')
  })

  it('handles empty sample', () => {
    const insights = toOptimizeInsights([])
    expect(buildOptimizePrompt(insights, 'balanced')).toContain(
      'No usage queries',
    )
  })
})

describe('toOptimizePayload', () => {
  it('shows zero savings until savings file exists', () => {
    const payload = toOptimizePayload([
      query({ timestamp: 1, tokens: 2_000_000, costUsd: 2 }),
    ])
    expect(payload.depth).toBe('balanced')
    expect(payload.empty).toBe(false)
    expect(payload.hasProjection).toBe(false)
    expect(payload.estTokensSaved).toBe(0)
    expect(payload.estUsdSaved).toBe(0)
    expect(payload.summary).toBe('Projected save per similar request: 0 / 0.00 $')
    expect(payload.note).toContain('similar request')
    expect(payload.lifetime.empty).toBe(true)
    expect(payload.lifetime.summary).toContain('Saved so far:')
    expect(payload.prompts.quick.length).toBeGreaterThan(0)
    expect(payload.prompts.balanced.length).toBeGreaterThan(
      payload.prompts.quick.length,
    )
    expect(payload.prompts.deep.length).toBeGreaterThan(
      payload.prompts.balanced.length,
    )
    expect(payload.prompt).toBe(payload.prompts.balanced)
  })

  it('surfaces agent-written mid savings', () => {
    const payload = toOptimizePayload(
      [query({ timestamp: 1, tokens: 2_000_000, costUsd: 2 })],
      { savingsMarkdown: sampleMarkdown(80_000, 0.22, 3) },
    )
    expect(payload.hasProjection).toBe(true)
    expect(payload.estTokensSaved).toBe(80_000)
    expect(payload.estUsdSaved).toBe(0.22)
    expect(payload.summary).toContain('Projected save')
    expect(payload.note).toContain('similar request')
    expect(payload.prompt).toContain('tokens_mid: 80000')
  })

  it('includes lifetime savings in the payload', () => {
    const payload = toOptimizePayload(
      [query({ timestamp: 1, tokens: 2_000_000, costUsd: 2 })],
      {
        projectLabel: 'demo-repo',
        lifetimeSavings: {
          version: 1,
          totalTokens: 750_000,
          totalUsd: 0.41,
          projects: {
            '/demo-repo': {
              key: '/demo-repo',
              label: 'demo-repo',
              tokens: 750_000,
              usd: 0.41,
              lastRun: 2,
              lastTokensMid: 750_000,
              lastUsdMid: 0.41,
              updatedAt: 1,
            },
          },
        },
      },
    )
    expect(payload.lifetime.empty).toBe(false)
    expect(payload.lifetime.totalTokens).toBe(750_000)
    expect(payload.lifetime.projects[0]?.label).toBe('demo-repo')
    expect(payload.prompts.balanced).toContain('Project (this workspace): demo-repo')
    expect(payload.prompts.balanced).toContain('project: demo-repo')
  })
})
