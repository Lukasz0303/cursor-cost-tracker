import { describe, expect, it } from 'vitest'
import { panelIoCacheKey, takePanelIoCache } from '../src/ui/panelIoCache'

describe('panelIoCacheKey', () => {
  it('changes when the sample size or newest timestamp changes', () => {
    const a = panelIoCacheKey('/repo', [
      { timestamp: 100 },
      { timestamp: 200 },
    ])
    const b = panelIoCacheKey('/repo', [
      { timestamp: 100 },
      { timestamp: 200 },
    ])
    const c = panelIoCacheKey('/repo', [
      { timestamp: 100 },
      { timestamp: 201 },
    ])
    const d = panelIoCacheKey('/other', [
      { timestamp: 100 },
      { timestamp: 200 },
    ])
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).not.toBe(d)
  })
})

describe('takePanelIoCache', () => {
  const session = { ok: true as const, cookie: 'cookie', email: 'dev@example.com' }
  const titles = new Map([['abc', 'Hello']])
  const value = { session, titles }

  it('returns the cached session and titles for the same key', () => {
    const key = panelIoCacheKey('/repo', [{ timestamp: 100 }])
    expect(takePanelIoCache({ key, value }, key)).toBe(value)
  })

  it('returns undefined for another workspace or another query list', () => {
    const key = panelIoCacheKey('/repo', [{ timestamp: 100 }])
    const cache = { key, value }
    const otherWorkspace = panelIoCacheKey('/other', [{ timestamp: 100 }])
    const otherQueries = panelIoCacheKey('/repo', [
      { timestamp: 100 },
      { timestamp: 200 },
    ])
    expect(takePanelIoCache(cache, otherWorkspace)).toBeUndefined()
    expect(takePanelIoCache(cache, otherQueries)).toBeUndefined()
    expect(takePanelIoCache(null, key)).toBeUndefined()
  })
})
