import { describe, expect, it } from 'vitest'
import {
  createIgnoreStore,
  IGNORED_SPIKES_KEY,
  isActiveSpike,
  parseIgnoredSpikes,
  spikeFingerprint,
  type SpikeMemento,
} from '../src/spikes/ignoreStore'
import type { UsageQuery } from '../src/usage/types'

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

function mockMemento(initial?: Record<string, unknown>): SpikeMemento {
  const store = new Map<string, unknown>(Object.entries(initial ?? {}))
  return {
    get(key: string): unknown {
      return store.get(key)
    },
    async update(key: string, value: unknown): Promise<void> {
      if (value === undefined) {
        store.delete(key)
        return
      }
      store.set(key, value)
    },
  }
}

describe('spikeFingerprint', () => {
  it('uses timestamp|tokens|costUsd|model', () => {
    expect(
      spikeFingerprint(
        query({
          timestamp: 1_700_000_000_000,
          tokens: 2_000_000,
          costUsd: 3.5,
          model: 'claude-4',
        }),
      ),
    ).toBe('1700000000000|2000000|3.5|claude-4')
  })

  it('uses an empty model segment when model is null', () => {
    expect(
      spikeFingerprint(query({ timestamp: 10, tokens: 1, costUsd: 0, model: null })),
    ).toBe('10|1|0|')
  })
})

describe('parseIgnoredSpikes', () => {
  it('returns an empty list for missing or invalid storage', () => {
    expect(parseIgnoredSpikes(undefined)).toEqual([])
    expect(parseIgnoredSpikes(null)).toEqual([])
    expect(parseIgnoredSpikes('nope')).toEqual([])
    expect(parseIgnoredSpikes(42)).toEqual([])
  })

  it('keeps unique non-empty strings in order', () => {
    expect(parseIgnoredSpikes(['a', '', 'b', 'a', 3, 'c'])).toEqual([
      'a',
      'b',
      'c',
    ])
  })
})

describe('createIgnoreStore', () => {
  it('starts empty and reports unknown keys as not ignored', () => {
    const store = createIgnoreStore(mockMemento())
    expect(store.list()).toEqual([])
    expect(store.has('missing')).toBe(false)
  })

  it('persists an ignore and survives a fresh store on the same memento', async () => {
    const memento = mockMemento()
    const store = createIgnoreStore(memento)
    const key = spikeFingerprint(query({ timestamp: 99 }))

    await store.ignore(key)

    expect(store.has(key)).toBe(true)
    expect(store.list()).toEqual([key])
    expect(memento.get(IGNORED_SPIKES_KEY)).toEqual([key])
    expect(createIgnoreStore(memento).has(key)).toBe(true)
  })

  it('is idempotent when the same key is ignored twice', async () => {
    const store = createIgnoreStore(mockMemento())
    const key = 'same-key'

    await store.ignore(key)
    await store.ignore(key)

    expect(store.list()).toEqual([key])
  })

  it('ignores empty keys', async () => {
    const store = createIgnoreStore(mockMemento())
    await store.ignore('')
    expect(store.list()).toEqual([])
    expect(store.has('')).toBe(false)
  })

  it('loads a previously stored list from memento', () => {
    const store = createIgnoreStore(
      mockMemento({ [IGNORED_SPIKES_KEY]: ['old-a', 'old-b'] }),
    )
    expect(store.list()).toEqual(['old-a', 'old-b'])
    expect(store.has('old-a')).toBe(true)
    expect(store.has('old-c')).toBe(false)
  })
})

describe('isActiveSpike', () => {
  const threshold = 1_000_000

  it('is false below the token threshold', () => {
    const q = query({ timestamp: 1, tokens: 999_999 })
    expect(isActiveSpike(q, threshold, [])).toBe(false)
  })

  it('is true at the threshold when not ignored', () => {
    const q = query({ timestamp: 1, tokens: 1_000_000 })
    expect(isActiveSpike(q, threshold, [])).toBe(true)
  })

  it('removes the key from active spikes after ignore', async () => {
    const memento = mockMemento()
    const store = createIgnoreStore(memento)
    const q = query({ timestamp: 42, tokens: 2_000_000, costUsd: 4 })
    const key = spikeFingerprint(q)

    expect(isActiveSpike(q, threshold, store.list())).toBe(true)

    await store.ignore(key)

    expect(isActiveSpike(q, threshold, store.list())).toBe(false)
    expect(isActiveSpike(q, threshold, new Set(store.list()))).toBe(false)
  })

  it('keeps other spikes active when one is ignored', async () => {
    const store = createIgnoreStore(mockMemento())
    const kept = query({ timestamp: 1, tokens: 1_500_000 })
    const dismissed = query({ timestamp: 2, tokens: 2_000_000 })

    await store.ignore(spikeFingerprint(dismissed))

    expect(isActiveSpike(kept, threshold, store.list())).toBe(true)
    expect(isActiveSpike(dismissed, threshold, store.list())).toBe(false)
  })
})
