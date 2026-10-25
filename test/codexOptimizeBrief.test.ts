import { describe, expect, it } from 'vitest'
import type { CodexDetailFields } from '../src/openaiHistory/historyDetails'
import { buildCodexOptimizeBrief } from '../src/openaiHistory/optimizeBrief'

const row: CodexDetailFields = {
  source: 'codex-local',
  device: 'this computer',
  scope: 'acct-1',
  confidence: 'unknown',
  conversation: 'thread-1',
  session: 'session-1',
  turn: 'turn-1',
  responseId: 'resp-1',
  usageQuality: 'reported',
  input: '100',
  cachedInput: '20',
  output: '10',
  reasoning: '2',
  total: '110',
  costBasis: '—',
  formula: 'Estimated API',
  pricingVersion: 'Price unavailable',
  status: 'completed',
  errorCode: '—',
  observed: '14 Oct 2026, 12:00',
  started: null,
  finished: null,
}

describe('buildCodexOptimizeBrief', () => {
  it('does not include a prompt-instruction fixture sentence', () => {
    const brief = buildCodexOptimizeBrief({
      depth: 'balanced',
      row,
      hints: ['Hypothesis: Cache share is low (10% cached input).'],
      model: 'gpt-fixture',
    })
    expect(brief).not.toMatch(/You are inside this Cursor conversation/i)
    expect(brief).not.toMatch(/paste this HERE/i)
    expect(brief).not.toMatch(/press Start/i)
    expect(brief).toContain('Hypothesis:')
    expect(brief).toContain('resp-1')
  })

  it('does not mention composer.openComposer', () => {
    const brief = buildCodexOptimizeBrief({
      depth: 'deep',
      row,
      hints: ['Hypothesis: Input grew versus the previous attributed request.'],
    })
    expect(brief).not.toContain('composer.openComposer')
    expect(brief).toContain('Token breakdown:')
    expect(brief).toContain('Input: 100')
  })

  it('quick depth keeps a single hint', () => {
    const brief = buildCodexOptimizeBrief({
      depth: 'quick',
      row,
      hints: [
        'Hypothesis: first',
        'Hypothesis: second',
        'Hypothesis: third',
      ],
    })
    expect(brief).toContain('Hypothesis: first')
    expect(brief).not.toContain('Hypothesis: second')
  })
})
