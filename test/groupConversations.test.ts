import { describe, expect, it } from 'vitest'
import {
  groupConversations,
  titleGroupKey,
  UNGROUPED_CONVERSATION_ID,
} from '../src/usage/groupConversations'
import type { UsageQuery } from '../src/usage/types'

function query(
  partial: Partial<UsageQuery> & Pick<UsageQuery, 'timestamp'>,
): UsageQuery {
  return {
    model: 'model-a',
    kind: 'usage',
    costUsd: 1,
    tokens: 100,
    inputTokens: 40,
    outputTokens: 30,
    cacheWriteTokens: 20,
    cacheReadTokens: 10,
    ...partial,
  }
}

describe('groupConversations', () => {
  it('splits two ids and keeps one Ungrouped bucket, oldest to newest', () => {
    const groups = groupConversations([
      query({ timestamp: 300, conversationId: 'alpha-conversation' }),
      query({ timestamp: 400 }),
      query({ timestamp: 200, conversationId: 'beta-conversation' }),
      query({ timestamp: 100, conversationId: 'alpha-conversation' }),
      query({ timestamp: 50 }),
    ])

    expect(groups.map((group) => group.id)).toEqual([
      UNGROUPED_CONVERSATION_ID,
      'alpha-conversation',
      'beta-conversation',
    ])
    expect(groups[0]?.queries.map((item) => item.timestamp)).toEqual([50, 400])
    expect(groups[1]?.queries.map((item) => item.timestamp)).toEqual([100, 300])
    expect(groups[2]?.queries.map((item) => item.timestamp)).toEqual([200])
    expect(groups[0]?.named).toBe(false)
    expect(groups[1]?.title).toBe('alpha-co')
    expect(groups[1]?.named).toBe(false)
  })

  it('uses a local title when one is supplied and caps the row label', () => {
    const groups = groupConversations(
      [query({ timestamp: 1, conversationId: 'composer-9' })],
      { 'composer-9': `  ${'n'.repeat(250)}  ` },
    )
    expect(groups[0]?.named).toBe(true)
    expect(groups[0]?.title).toHaveLength(200)
    expect(groups[0]?.title.startsWith('n')).toBe(true)
  })

  it('keeps a single request as its own conversation', () => {
    const groups = groupConversations([
      query({ timestamp: 5, conversationId: 'only' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.id).toBe('only')
    expect(groups[0]?.queries).toHaveLength(1)
  })
})

describe('titleGroupKey', () => {
  it('gives two ids with the same title one key', () => {
    const left = titleGroupKey('alpha-conversation', 'Fix login bug')
    const right = titleGroupKey('beta-conversation', '  fix   LOGIN bug ')
    expect(left.key).toBe(right.key)
    expect(left.named).toBe(true)
    expect(left.label).toBe('Fix login bug')
  })

  it('falls back to a short id label when no title is known', () => {
    const group = titleGroupKey('ab12cd34ef56', '')
    expect(group.key).toBe('id:ab12cd34ef56')
    expect(group.label).toBe('#ab12cd34')
    expect(group.named).toBe(false)
  })

  it('treats a missing or oversized id as ungrouped', () => {
    expect(titleGroupKey('  ', 'Named chat').key).toBe(UNGROUPED_CONVERSATION_ID)
    expect(titleGroupKey('x'.repeat(129), 'Named chat').key).toBe(
      UNGROUPED_CONVERSATION_ID,
    )
  })
})
