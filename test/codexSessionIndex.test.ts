import { describe, expect, it } from 'vitest'
import { parseSessionIndex } from '../src/openaiHistory/codex/sessionIndex'

describe('parseSessionIndex', () => {
  it('reads a title from thread_name or title', () => {
    const text = [
      JSON.stringify({ id: 'aaa', thread_name: 'Pokaż cennik' }),
      JSON.stringify({ threadId: 'bbb', title: 'Inna rozmowa' }),
    ].join('\n')
    expect(parseSessionIndex(text)).toEqual([
      { id: 'aaa', title: 'Pokaż cennik' },
      { id: 'bbb', title: 'Inna rozmowa' },
    ])
  })
})
