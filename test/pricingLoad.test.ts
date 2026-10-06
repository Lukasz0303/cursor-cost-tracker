import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearModelCatalogCache, loadModelCatalog } from '../src/pricing/load'

const SAMPLE = `
## Cursor Models

| Model | Provider | Input | Cache write | Cache read | Output | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Composer 2.5 | Cursor | $0.5 | - | $0.2 | $2.5 | - |
`

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, { status })
}

describe('loadModelCatalog', () => {
  beforeEach(() => {
    clearModelCatalogCache()
    vi.unstubAllGlobals()
  })

  it('reuses a successful catalog for the cache window', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(SAMPLE))
    vi.stubGlobal('fetch', fetchMock)

    const first = await loadModelCatalog()
    const second = await loadModelCatalog()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second.models.map((model) => model.name)).toEqual(['Composer 2.5'])
    expect(second).toBe(first)
  })

  it('fetches again when force is set', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(SAMPLE))
    vi.stubGlobal('fetch', fetchMock)

    await loadModelCatalog()
    await loadModelCatalog(true)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares one in-flight request', async () => {
    let release: (value: Response) => void = () => {}
    const gate = new Promise<Response>((resolve) => {
      release = resolve
    })
    const fetchMock = vi.fn(() => gate)
    vi.stubGlobal('fetch', fetchMock)

    const pendingA = loadModelCatalog()
    const pendingB = loadModelCatalog()
    release(jsonResponse(SAMPLE))
    const [a, b] = await Promise.all([pendingA, pendingB])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a.models).toHaveLength(1)
    expect(b).toEqual(a)
  })

  it('keeps the last good catalog when the next fetch fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(SAMPLE))
      .mockRejectedValueOnce(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)

    const cached = await loadModelCatalog()
    const again = await loadModelCatalog(true)

    expect(again.models).toEqual(cached.models)
    expect(again.error).toBeNull()
  })

  it('returns an error catalog when nothing has been cached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse('no table', 503)),
    )

    const catalog = await loadModelCatalog()

    expect(catalog.models).toEqual([])
    expect(catalog.error).toBe('HTTP 503')
  })
})
