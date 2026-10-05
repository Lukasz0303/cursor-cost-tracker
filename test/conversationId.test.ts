import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { pickConversationId } from '../src/usage/conversationId'
import { mapEventToQuery } from '../src/usage/parse'

function loadFixture(): { usageEventsDisplay: unknown[] } {
  const raw = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'usage-events.sample.json'),
    'utf8',
  )
  return JSON.parse(raw) as { usageEventsDisplay: unknown[] }
}

describe('pickConversationId', () => {
  it('maps each spelling and trims', () => {
    const spellings = [
      'conversationId',
      'conversation_id',
      'composerId',
      'threadId',
      'chatId',
    ]
    for (const key of spellings) {
      expect(pickConversationId({ [key]: '  abc  ' })).toBe('abc')
    }
  })

  it('prefers conversationId over later spellings', () => {
    expect(
      pickConversationId({
        conversationId: 'first',
        composerId: 'second',
        chatId: 'third',
      }),
    ).toBe('first')
  })

  it('skips an empty string and uses the next spelling', () => {
    expect(
      pickConversationId({ conversationId: '  ', composerId: 'from-composer' }),
    ).toBe('from-composer')
  })

  it('returns undefined for missing, empty, null, and non-strings', () => {
    expect(pickConversationId({})).toBeUndefined()
    expect(pickConversationId({ conversationId: '' })).toBeUndefined()
    expect(pickConversationId(null)).toBeUndefined()
    expect(pickConversationId({ conversationId: 12 })).toBeUndefined()
    expect(pickConversationId('event')).toBeUndefined()
  })

  it('treats a 200-character string as absent and keeps 128', () => {
    expect(pickConversationId({ conversationId: 'a'.repeat(200) })).toBeUndefined()
    expect(pickConversationId({ conversationId: 'a'.repeat(129) })).toBeUndefined()
    expect(pickConversationId({ conversationId: 'a'.repeat(128) })).toBe(
      'a'.repeat(128),
    )
  })

  it('skips an overlong spelling and keeps a later short id', () => {
    expect(
      pickConversationId({
        conversationId: 'b'.repeat(200),
        threadId: 'short',
      }),
    ).toBe('short')
  })

  it('returns undefined on the checked-in usage fixture', () => {
    const fixture = loadFixture()
    for (const event of fixture.usageEventsDisplay) {
      expect(pickConversationId(event)).toBeUndefined()
      const query = mapEventToQuery(event)
      expect(query?.conversationId).toBeUndefined()
    }
  })

  it('stores the id on the parsed query and does not invent one', () => {
    const withId = mapEventToQuery({
      timestamp: 1,
      conversationId: ' conv-1 ',
      tokenUsage: { inputTokens: 1 },
    })
    expect(withId?.conversationId).toBe('conv-1')

    const withoutId = mapEventToQuery({
      timestamp: 1,
      tokenUsage: { inputTokens: 1 },
    })
    expect(withoutId?.conversationId).toBeUndefined()
  })
})
