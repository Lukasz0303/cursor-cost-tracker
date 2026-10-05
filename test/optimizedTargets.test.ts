import { describe, expect, it } from 'vitest'
import { queryFingerprint } from '../src/spikes/criticalAlert'
import type { UsageQuery } from '../src/usage/types'
import {
  emptyOptimizedTargets,
  isOptimizedQuery,
  OPTIMIZED_TARGETS_MAX,
  optimizedTargetForConversation,
  optimizedTargetForQuery,
  parseOptimizedTargets,
  rememberOptimizedTarget,
} from '../src/ui/optimizedTargets'

function query(
  partial: Partial<UsageQuery> & { timestamp: number },
): UsageQuery {
  return {
    model: 'gpt-5',
    kind: 'USAGE_EVENT_KIND_INCLUDED',
    costUsd: 1.25,
    tokens: 1_500_000,
    inputTokens: 100_000,
    outputTokens: 50_000,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    ...partial,
  }
}

describe('parseOptimizedTargets', () => {
  it('returns empty lists for missing, wrong version, or a non-object', () => {
    const empty = emptyOptimizedTargets()
    expect(parseOptimizedTargets(undefined)).toEqual(empty)
    expect(parseOptimizedTargets(null)).toEqual(empty)
    expect(parseOptimizedTargets('nope')).toEqual(empty)
    expect(parseOptimizedTargets(42)).toEqual(empty)
    expect(parseOptimizedTargets(['a'])).toEqual(empty)
    expect(
      parseOptimizedTargets({
        version: 2,
        conversationIds: ['chat-1'],
        fingerprints: ['10|1|0|gpt-5'],
      }),
    ).toEqual(empty)
  })

  it('drops empty, oversized, ungrouped, and duplicate ids', () => {
    const parsed = parseOptimizedTargets({
      version: 1,
      conversationIds: [
        '  chat-1  ',
        '',
        'ungrouped',
        'x'.repeat(257),
        'chat-1',
        3,
        'x'.repeat(256),
      ],
      fingerprints: 'not-a-list',
    })
    expect(parsed.conversationIds).toEqual(['chat-1', 'x'.repeat(256)])
    expect(parsed.fingerprints).toEqual([])
  })
})

describe('rememberOptimizedTarget', () => {
  it('moves a repeated conversation id to the front', () => {
    const first = rememberOptimizedTarget(emptyOptimizedTargets(), {
      conversationId: 'chat-a',
    })
    const second = rememberOptimizedTarget(first, {
      conversationId: 'chat-b',
    })
    const repeated = rememberOptimizedTarget(second, {
      conversationId: 'chat-a',
    })
    expect(repeated.conversationIds).toEqual(['chat-a', 'chat-b'])
    expect(repeated.fingerprints).toEqual([])
  })

  it('drops the oldest id past the cap', () => {
    let state = emptyOptimizedTargets()
    for (let i = 1; i <= OPTIMIZED_TARGETS_MAX + 1; i++) {
      state = rememberOptimizedTarget(state, { conversationId: `chat-${i}` })
    }
    expect(state.conversationIds).toHaveLength(OPTIMIZED_TARGETS_MAX)
    expect(state.conversationIds[0]).toBe(`chat-${OPTIMIZED_TARGETS_MAX + 1}`)
    expect(state.conversationIds).not.toContain('chat-1')
  })

  it('rejects an oversized id, an empty string, and the ungrouped bucket', () => {
    const state = emptyOptimizedTargets()
    expect(
      rememberOptimizedTarget(state, { conversationId: 'x'.repeat(257) }),
    ).toBe(state)
    expect(rememberOptimizedTarget(state, { conversationId: '' })).toBe(state)
    expect(rememberOptimizedTarget(state, { conversationId: '   ' })).toBe(
      state,
    )
    expect(
      rememberOptimizedTarget(state, { conversationId: 'ungrouped' }),
    ).toBe(state)
  })

  it('stores a fingerprint when the conversation id is rejected', () => {
    const state = rememberOptimizedTarget(emptyOptimizedTargets(), {
      conversationId: 'ungrouped',
      fingerprint: '10|1|0|gpt-5',
    })
    expect(state.conversationIds).toEqual([])
    expect(state.fingerprints).toEqual(['10|1|0|gpt-5'])
  })
})

describe('isOptimizedQuery', () => {
  it('matches every query in a stored conversation, including an older one', () => {
    const targets = rememberOptimizedTarget(emptyOptimizedTargets(), {
      conversationId: 'chat-1',
    })
    const older = query({
      timestamp: 10,
      tokens: 100,
      conversationId: 'chat-1',
    })
    const newer = query({
      timestamp: 20,
      tokens: 2_000_000,
      conversationId: 'chat-1',
    })
    expect(isOptimizedQuery(older, targets)).toBe(true)
    expect(isOptimizedQuery(newer, targets)).toBe(true)
  })

  it('does not match a different conversation id', () => {
    const targets = rememberOptimizedTarget(emptyOptimizedTargets(), {
      conversationId: 'chat-1',
    })
    expect(
      isOptimizedQuery(
        query({ timestamp: 10, conversationId: 'chat-2' }),
        targets,
      ),
    ).toBe(false)
  })

  it('matches an ungrouped query by fingerprint', () => {
    const row = query({ timestamp: 10, tokens: 1, costUsd: 0, model: null })
    const targets = rememberOptimizedTarget(emptyOptimizedTargets(), {
      fingerprint: queryFingerprint(row),
    })
    expect(isOptimizedQuery(row, targets)).toBe(true)
    expect(
      isOptimizedQuery(query({ timestamp: 11, tokens: 1, costUsd: 0 }), targets),
    ).toBe(false)
  })

  it('stores a conversation id, or a fingerprint when the query has none', () => {
    expect(
      optimizedTargetForQuery(query({ timestamp: 10, conversationId: 'chat-1' })),
    ).toEqual({ conversationId: 'chat-1' })
    const bare = query({ timestamp: 10, tokens: 1, costUsd: 0, model: null })
    expect(optimizedTargetForQuery(bare)).toEqual({
      fingerprint: queryFingerprint(bare),
    })
    expect(optimizedTargetForConversation('ungrouped')).toBeNull()
    expect(optimizedTargetForConversation('chat-9')).toEqual({
      conversationId: 'chat-9',
    })
    expect(
      optimizedTargetForConversation('query-10', bare),
    ).toEqual({ fingerprint: queryFingerprint(bare) })
    expect(optimizedTargetForConversation('query-10')).toBeNull()
  })

  it('does not paint a grouped row from a fingerprint alone', () => {
    const row = query({
      timestamp: 10,
      tokens: 1,
      costUsd: 0,
      conversationId: 'chat-other',
    })
    const targets = rememberOptimizedTarget(emptyOptimizedTargets(), {
      fingerprint: queryFingerprint(row),
    })
    expect(isOptimizedQuery(row, targets)).toBe(false)
  })
})
