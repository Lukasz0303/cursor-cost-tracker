import { describe, expect, it } from 'vitest'
import { groupConversations } from '../src/usage/groupConversations'
import { buildConversationOptimizePrompt } from '../src/ui/conversationOptimizePrompt'
import type { UsageQuery } from '../src/usage/types'

function query(
  partial: Partial<UsageQuery> & Pick<UsageQuery, 'timestamp'>,
): UsageQuery {
  return {
    model: partial.model ?? 'cheap',
    kind: 'usage',
    costUsd: partial.costUsd ?? 0.1,
    tokens: partial.tokens ?? 100,
    inputTokens: 40,
    outputTokens: 30,
    cacheWriteTokens: 20,
    cacheReadTokens: partial.cacheReadTokens ?? 10,
    conversationId: 'conv-1',
    ...partial,
  }
}

function series(count: number, stepMs = 60_000): UsageQuery[] {
  const start = Date.UTC(2026, 8, 1, 8, 0, 0)
  return Array.from({ length: count }, (_, index) =>
    query({
      timestamp: start + index * stepMs,
      costUsd: index % 5 === 0 ? 10 : 0.25,
      tokens: 1_000 + index,
      model: index % 5 === 0 ? 'expensive' : 'cheap',
    }),
  )
}

function sectionBody(prompt: string, heading: string): string[] {
  const marker = `## ${heading}`
  const start = prompt.indexOf(marker)
  expect(start).toBeGreaterThanOrEqual(0)
  const rest = prompt.slice(start + marker.length)
  const next = rest.search(/\n## /)
  const body = next === -1 ? rest : rest.slice(0, next)
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

function promptFor(count: number): string {
  const groups = groupConversations(series(count))
  const group = groups[0]
  expect(group).toBeDefined()
  return buildConversationOptimizePrompt(group!)
}

describe('buildConversationOptimizePrompt', () => {
  it('emits six reqs numbers and at most five other events for 12 and 300', () => {
    for (const count of [12, 300]) {
      const prompt = promptFor(count)
      expect(prompt.match(/\breqs\b/g)).toHaveLength(6)
      expect(sectionBody(prompt, 'Other events')).toHaveLength(5)
      expect(sectionBody(prompt, 'Cost curve — 6 equal slices, oldest -> newest').filter((line) =>
        line.includes('reqs'),
      )).toHaveLength(6)
    }
    const twelve = promptFor(12)
    expect(twelve.match(/reqs (\d+)/g)?.map((line) => line.replace('reqs ', ''))).toEqual([
      '2',
      '2',
      '2',
      '2',
      '2',
      '2',
    ])
  })

  it('asks the open chat for the habit instead of a generic length rule', () => {
    const prompt = promptFor(12)
    expect(prompt).toContain('Cursor conversation (Optimize Balanced)')
    expect(prompt).toContain("Use this chat's real history")
    expect(prompt).toContain('## Next time')
    expect(prompt).not.toContain('## Next time (Quick)')
    expect(prompt).not.toContain('## Diagnosis checklist (Deep)')
    expect(prompt).toContain('## Rules')
    expect(prompt).not.toContain('.cursor/rules/cct-conversation-length.mdc')
    expect(prompt).not.toContain('Use only the numbers below')
    expect(prompt).not.toContain('## Findings')
    expect(prompt).not.toContain('call no tools')
    expect(prompt).toContain('unnamed conversation')
    expect(prompt).toContain('.ai/optimize-savings.md')
  })

  it('quick depth asks for at most one rule grounded in this chat', () => {
    const groups = groupConversations(series(12))
    const group = groups[0]
    expect(group).toBeDefined()
    const prompt = buildConversationOptimizePrompt(group!, { depth: 'quick' })
    expect(prompt).toContain('Cursor conversation (Optimize Quick)')
    expect(prompt).toContain('## Next time (Quick)')
    expect(prompt).toContain('At most one tiny rule.')
    expect(prompt).toContain('Three concrete changes to the next message')
    expect(prompt).not.toContain('.cursor/rules/cct-conversation-length.mdc')
    expect(prompt).not.toContain('Write no rule file')
    expect(prompt).toContain('.ai/optimize-savings.md')
  })

  it('keeps a fired finding as a meter hint, not a required rule filename', () => {
    const group = groupConversations(series(4))[0]
    expect(group).toBeDefined()
    const prompt = buildConversationOptimizePrompt(group!, {
      depth: 'quick',
      findings: [{ id: 'stale-resume', line: 'long idle then expensive resume' }],
    })
    expect(prompt).not.toContain('.cursor/rules/cct-stale-resume.mdc')
    expect(prompt).toContain('## Findings')
    expect(prompt).toContain('stale-resume: long idle then expensive resume')
    expect(prompt).toContain('Confirm each one against this chat')
  })

  it('deep depth adds the diagnosis checklist playbook', () => {
    const groups = groupConversations(series(12))
    const group = groups[0]
    expect(group).toBeDefined()
    const prompt = buildConversationOptimizePrompt(group!, { depth: 'deep' })
    expect(prompt).toContain('Cursor conversation (Optimize Deep)')
    expect(prompt).toContain('## Diagnosis checklist (Deep)')
    expect(prompt).toContain('## Next time (Deep)')
    expect(prompt).toContain('playbook for the whole thread')
    expect(prompt).toContain('What did this thread keep re-sending')
    expect(prompt).not.toContain('.cursor/rules/cct-conversation-length.mdc')
    expect(prompt).toContain('.ai/optimize-savings.md')
  })

  it('quick, balanced, and deep prompts are distinct', () => {
    const group = groupConversations(series(12))[0]
    expect(group).toBeDefined()
    const quick = buildConversationOptimizePrompt(group!, { depth: 'quick' })
    const balanced = buildConversationOptimizePrompt(group!, { depth: 'balanced' })
    const deep = buildConversationOptimizePrompt(group!, { depth: 'deep' })
    expect(quick).not.toEqual(balanced)
    expect(balanced).not.toEqual(deep)
    expect(quick).not.toEqual(deep)
    expect(buildConversationOptimizePrompt(group!)).toEqual(balanced)
  })

  it('shows a context-blowup finding as a hint, not a forced rule file', () => {
    const group = groupConversations(series(4))[0]
    expect(group).toBeDefined()
    const prompt = buildConversationOptimizePrompt(group!, {
      findings: [{ id: 'context-blowup', line: 'cache write jumped after the gap' }],
    })
    expect(prompt).not.toContain('.cursor/rules/cct-context-blowup.mdc')
    expect(prompt).not.toContain('cct-conversation-length')
    expect(prompt).toContain('## Findings')
    expect(prompt).toContain('context-blowup: cache write jumped after the gap')
    expect(prompt).not.toContain('call no tools')
  })

  it('treats two billed requests as a thin meter sample', () => {
    const prompt = promptFor(2)
    expect(prompt).toContain('## Rules')
    expect(prompt).toContain('2 billed requests')
    expect(prompt).toContain('meter sample is thin')
    expect(prompt).not.toContain('.cursor/rules/cct-')
    expect(prompt).not.toContain('call no tools')
  })

  it('records a 45 minute idle gap and keeps at most six markers', () => {
    const idleGroup = groupConversations([
      query({ timestamp: Date.UTC(2026, 8, 1, 8, 0, 0) }),
      query({ timestamp: Date.UTC(2026, 8, 1, 8, 45, 0) }),
    ])[0]
    expect(idleGroup).toBeDefined()
    const idlePrompt = buildConversationOptimizePrompt(idleGroup!)
    expect(idlePrompt).toContain('45m idle before #2 (slice 2)')

    const many = groupConversations(
      series(8, 45 * 60 * 1000),
    )[0]
    expect(many).toBeDefined()
    const manyPrompt = buildConversationOptimizePrompt(many!)
    expect(manyPrompt.match(/^\d+m idle before/gm)).toHaveLength(6)
  })

  it('puts the local title in the brief and the account-dollar note when asked', () => {
    const group = groupConversations(series(3), {
      'conv-1': 'Rename the parser',
    })[0]
    expect(group).toBeDefined()
    const prompt = buildConversationOptimizePrompt(group!, {
      accountSpend: true,
      projectLabel: 'cursor-cost-tracker',
    })
    expect(prompt).toContain('title: Rename the parser')
    expect(prompt).toContain('This thread is titled "Rename the parser".')
    expect(prompt).toContain("account's usage events")
    expect(prompt).toContain('project: cursor-cost-tracker')
    expect(prompt).toContain('## Lifetime savings')
    expect(prompt).toContain('run: 1')
    expect(prompt).not.toContain('call no tools')
  })

  it('tells the next fence to keep the prior lifetime mid and bump run', () => {
    const group = groupConversations(series(3))[0]
    expect(group).toBeDefined()
    const prompt = buildConversationOptimizePrompt(group!, {
      projectLabel: 'cursor-cost-tracker',
      priorMarkdown: [
        '```cct-savings',
        'project: cursor-cost-tracker',
        'tokens_mid: 20000000',
        'usd_mid: 12.37',
        'run: 12',
        '```',
      ].join('\n'),
    })
    expect(prompt).toContain('Prior mid: ~20.0M tokens / ~12.37 $.')
    expect(prompt).toContain('Prior run: 12. Set run to 13.')
    expect(prompt).toContain('tokens_mid: <20000000 + integer tokens saved on the NEXT similar turn>')
    expect(prompt).toContain('usd_mid: <12.37 + dollars saved on the NEXT similar turn>')
    expect(prompt).toContain('run: 13')
    expect(prompt).toContain('lifetime totals')
  })

  it('keeps the credited lifetime when the savings file was reset lower', () => {
    const group = groupConversations(series(3))[0]
    expect(group).toBeDefined()
    const prompt = buildConversationOptimizePrompt(group!, {
      projectLabel: 'cursor-cost-tracker',
      priorMarkdown: [
        '```cct-savings',
        'project: cursor-cost-tracker',
        'tokens_mid: 9408777',
        'usd_mid: 5.62',
        'run: 2',
        '```',
      ].join('\n'),
      creditedTokensMid: 20_000_000,
      creditedUsdMid: 12.37,
      creditedRun: 12,
    })
    expect(prompt).toContain('Prior mid: ~20.0M tokens / ~12.37 $.')
    expect(prompt).toContain('Prior run: 12. Set run to 13.')
    expect(prompt).toContain('tokens_mid: <20000000 + integer tokens saved on the NEXT similar turn>')
    expect(prompt).toContain('usd_mid: <12.37 + dollars saved on the NEXT similar turn>')
    expect(prompt).not.toContain('run: 3')
  })
})
