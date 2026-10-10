import { describe, expect, it } from 'vitest'
import {
  contextFillForQuery,
  contextWindowTokens,
  promptContextTokens,
} from '../src/contextFill/fill'
import { buildContextSummaryPrompt } from '../src/contextFill/summaryPrompt'
import type { UsageQuery } from '../src/usage/types'

function query(partial: Partial<UsageQuery> = {}): UsageQuery {
  return {
    timestamp: 1,
    model: 'grok-4.7-high',
    kind: 'usage',
    costUsd: 1,
    tokens: 100,
    inputTokens: 10_000,
    outputTokens: 2_000,
    cacheWriteTokens: 0,
    cacheReadTokens: 20_000,
    ...partial,
  }
}

describe('contextFill', () => {
  it('reads the published window, with a long-context name winning over the family', () => {
    expect(contextWindowTokens('grok-4.7-high')).toBe(256_000)
    expect(contextWindowTokens('grok-4.7-500k')).toBe(500_000)
    expect(contextWindowTokens('claude-opus-5-1m')).toBe(1_000_000)
    expect(contextWindowTokens('gemini-3.8-flash')).toBe(1_000_000)
    expect(contextWindowTokens('mystery-model')).toBeNull()
  })

  it('counts input and cache, not the reply, against the window', () => {
    const row = query({ inputTokens: 20_000, cacheReadTokens: 150_000, cacheWriteTokens: 0 })
    expect(promptContextTokens(row)).toBe(170_000)
    const fill = contextFillForQuery(row)
    expect(fill.level).toBe('full')
    expect(fill.percent).toBe(66)
    expect(fill.windowLabel).toBe('256k')
  })

  it('does not add cache on top of an input figure that already includes it', () => {
    const row = query({
      inputTokens: 220_900,
      cacheReadTokens: 199_700,
      cacheWriteTokens: 21_200,
    })
    expect(promptContextTokens(row)).toBe(220_900)
    expect(contextFillForQuery(row).percent).toBe(86)
  })

  it('uses the composer meter instead of billing tokens', () => {
    const row = query({
      conversationId: 'chat-1',
      inputTokens: 220_900,
      cacheReadTokens: 199_700,
      cacheWriteTokens: 21_200,
    })
    const fill = contextFillForQuery(row, {
      'chat-1': { percent: 86, tokensUsed: 220_900, tokenLimit: 256_000 },
    })
    expect(fill.percent).toBe(86)
    expect(fill.level).toBe('full')
    expect(fill.windowLabel).toBe('256k')
  })

  it('drops a billed total that is larger than the window', () => {
    const fill = contextFillForQuery(
      query({
        model: 'muse-spark-1-3-medium',
        inputTokens: 2_032_000,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    )
    expect(fill.percent).toBeNull()
    expect(fill.level).toBe('unknown')
  })

  it('keeps the composer meter when billed tokens exceed the window', () => {
    const fill = contextFillForQuery(
      query({
        conversationId: 'chat-1',
        model: 'muse-spark-1-3-medium',
        inputTokens: 2_032_000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
      { 'chat-1': { percent: 34, tokensUsed: 101_200, tokenLimit: 300_000 } },
    )
    expect(fill.percent).toBe(34)
    expect(fill.level).toBe('ok')
    expect(fill.windowLabel).toBe('300k')
  })

  it('ignores a meter that is not a share of the window', () => {
    const fill = contextFillForQuery(
      query({ conversationId: 'chat-1', inputTokens: 1_000, cacheReadTokens: 0 }),
      { 'chat-1': { percent: 1016, tokensUsed: null, tokenLimit: null } },
    )
    expect(fill.percent).toBeNull()
    expect(fill.level).toBe('unknown')
  })

  it('points up while the window still has room', () => {
    const fill = contextFillForQuery(
      query({ inputTokens: 4_000, cacheReadTokens: 8_000, cacheWriteTokens: 0 }),
    )
    expect(fill.level).toBe('ok')
    expect(fill.percent).toBe(5)
  })

  it('asks for one copyable handoff and nothing else', () => {
    const prompt = buildContextSummaryPrompt()
    expect(prompt).toContain('copy into a new chat')
    expect(prompt).toContain('Conversation handoff')
    expect(prompt).toContain('Do not continue the task')
  })
})