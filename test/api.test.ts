import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  USAGE_CANCELLED,
  USAGE_EVENTS_URL,
  USAGE_LOAD_ERROR,
  USAGE_SIGN_IN,
  USAGE_SUMMARY_URL,
  USER_ANALYTICS_URL,
  assertCursorHost,
  fetchRecentEvents,
  fetchTodayEvents,
  fetchUsageSummary,
  fetchUserAnalytics,
} from '../src/usage/api'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const eventsFixture = JSON.parse(
  readFileSync(join(fixtures, 'usage-events.sample.json'), 'utf8'),
) as unknown

const cookie = 'WorkosCursorSessionToken=user_test::aaa.bbb.ccc'

function fetchMock(): ReturnType<typeof vi.fn> {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>
}

function header(
  init: RequestInit | undefined,
  name: string,
): string | null {
  const headers = init?.headers
  if (!headers || headers instanceof Headers || Array.isArray(headers)) {
    if (headers instanceof Headers) {
      return headers.get(name)
    }
    return null
  }
  const record = headers as Record<string, string>
  return record[name] ?? null
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 200 })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('assertCursorHost', () => {
  it('allows cursor.com', () => {
    expect(() => assertCursorHost(USAGE_SUMMARY_URL)).not.toThrow()
  })

  it('rejects other hosts before any fetch', () => {
    expect(() => assertCursorHost('https://evil.example/api')).toThrow(
      USAGE_LOAD_ERROR,
    )
    expect(fetchMock()).not.toHaveBeenCalled()
  })
})

describe('fetchUsageSummary', () => {
  it('GETs the summary URL with Cookie and without Authorization', async () => {
    fetchMock().mockResolvedValueOnce(
      new Response(JSON.stringify({ membershipType: 'pro' }), { status: 200 }),
    )
    const result = await fetchUsageSummary(cookie, new AbortController().signal)
    expect(result).toEqual({ ok: true, raw: { membershipType: 'pro' } })
    expect(fetchMock()).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit]
    expect(url).toBe(USAGE_SUMMARY_URL)
    expect(init.method).toBe('GET')
    expect(header(init, 'Cookie')).toBe(cookie)
    expect(header(init, 'Authorization')).toBeNull()
    expect(header(init, 'Origin')).toBeNull()
  })

  it('maps 401 to Sign in without echoing the cookie', async () => {
    fetchMock().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: cookie }), { status: 401 }),
    )
    const result = await fetchUsageSummary(cookie, new AbortController().signal)
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.message).toBe(USAGE_SIGN_IN)
    expect(result.message.includes(cookie)).toBe(false)
  })

  it('maps malformed JSON to a generic load error', async () => {
    fetchMock().mockResolvedValueOnce(
      new Response('not-json{', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const result = await fetchUsageSummary(cookie, new AbortController().signal)
    expect(result).toEqual({ ok: false, message: USAGE_LOAD_ERROR })
  })

  it('returns Cancelled when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await fetchUsageSummary(cookie, controller.signal)
    expect(result).toEqual({ ok: false, message: USAGE_CANCELLED })
    expect(fetchMock()).not.toHaveBeenCalled()
  })
})

describe('fetchRecentEvents', () => {
  function pageOf(count: number, page: number): unknown {
    return {
      usageEventsDisplay: Array.from({ length: count }, (_, i) => ({
        timestamp: String(1_000_000 - page * 10_000 - i),
        model: 'default',
        chargedCents: 1,
        tokenUsage: { inputTokens: 1, outputTokens: 1 },
      })),
    }
  }

  function postedBody(call: number): { page: number; pageSize: number } {
    return JSON.parse(
      String((fetchMock().mock.calls[call] as [string, RequestInit])[1].body),
    ) as { page: number; pageSize: number }
  }

  it('POSTs page 1 and pageSize 1000 and maps fixture events', async () => {
    fetchMock().mockResolvedValueOnce(
      new Response(JSON.stringify(eventsFixture), { status: 200 }),
    )
    const result = await fetchRecentEvents(cookie, new AbortController().signal)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.queries).toHaveLength(3)
    expect(result.queries[0]?.timestamp).toBeGreaterThan(
      result.queries[1]?.timestamp ?? 0,
    )

    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit]
    expect(url).toBe(USAGE_EVENTS_URL)
    expect(init.method).toBe('POST')
    expect(header(init, 'Cookie')).toBe(cookie)
    expect(header(init, 'Authorization')).toBeNull()
    expect(header(init, 'Origin')).toBe('https://cursor.com')
    expect(JSON.parse(String(init.body))).toEqual({ page: 1, pageSize: 1000 })
  })

  it('pages until the history limit when each page is full', async () => {
    fetchMock()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pageOf(1000, 1)), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pageOf(200, 2)), { status: 200 }),
      )

    const result = await fetchRecentEvents(
      cookie,
      new AbortController().signal,
      { limit: 1200 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.queries).toHaveLength(1200)
    expect(fetchMock()).toHaveBeenCalledTimes(2)
    expect(postedBody(0)).toEqual({ page: 1, pageSize: 1000 })
    expect(postedBody(1)).toEqual({ page: 2, pageSize: 1000 })
  })

  it('retries with pageSize 100 when a 1000-row page fails', async () => {
    fetchMock()
      .mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(eventsFixture), { status: 200 }),
      )

    const result = await fetchRecentEvents(
      cookie,
      new AbortController().signal,
      { limit: 1000 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.queries).toHaveLength(3)
    expect(fetchMock()).toHaveBeenCalledTimes(2)
    expect(postedBody(0).pageSize).toBe(1000)
    expect(postedBody(1)).toEqual({ page: 1, pageSize: 100 })
  })

  it('keeps earlier pages when a later page times out', async () => {
    fetchMock()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pageOf(1000, 1)), { status: 200 }),
      )
      .mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))

    const result = await fetchRecentEvents(
      cookie,
      new AbortController().signal,
      { limit: 10_000 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.queries).toHaveLength(1000)
    expect(fetchMock()).toHaveBeenCalledTimes(2)
  })

  it('retries once after HTTP 429', async () => {
    fetchMock()
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(eventsFixture), { status: 200 }),
      )

    const result = await fetchRecentEvents(cookie, new AbortController().signal)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.queries).toHaveLength(3)
    expect(fetchMock()).toHaveBeenCalledTimes(2)
  })

  it('keeps paging when the API caps below the requested page size', async () => {
    fetchMock()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pageOf(100, 1)), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pageOf(100, 2)), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pageOf(50, 3)), { status: 200 }),
      )

    const result = await fetchRecentEvents(
      cookie,
      new AbortController().signal,
      { limit: 250 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.queries).toHaveLength(250)
    expect(postedBody(0).pageSize).toBe(250)
    expect(postedBody(1)).toEqual({ page: 2, pageSize: 100 })
    expect(postedBody(2)).toEqual({ page: 3, pageSize: 100 })
  })

  it('POSTs local day bounds when fromDate is set and drops older rows', async () => {
    const now = new Date(2026, 8, 7, 12, 0, 0)
    const start = new Date(2026, 8, 1).getTime()
    const end = new Date(2026, 8, 7).getTime() + 24 * 60 * 60 * 1000 - 1
    fetchMock().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          usageEventsDisplay: [
            {
              timestamp: start + 60_000,
              model: 'kept',
              chargedCents: 10,
              tokenUsage: { inputTokens: 1, outputTokens: 1 },
            },
            {
              timestamp: start - 60_000,
              model: 'old',
              chargedCents: 10,
              tokenUsage: { inputTokens: 1, outputTokens: 1 },
            },
          ],
        }),
        { status: 200 },
      ),
    )

    const result = await fetchRecentEvents(
      cookie,
      new AbortController().signal,
      { fromDate: '2026-09-01', now },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.queries).toHaveLength(1)
    expect(result.queries[0]?.model).toBe('kept')
    expect(
      JSON.parse(String((fetchMock().mock.calls[0] as [string, RequestInit])[1].body)),
    ).toEqual({
      page: 1,
      pageSize: 1000,
      startDate: String(start),
      endDate: String(end),
    })
  })
})

describe('fetchTodayEvents', () => {
  it('falls back to unfiltered Last 100 when the date filter is empty', async () => {
    const now = new Date(2026, 8, 1, 12, 0, 0)
    const todayTs = now.getTime()
    fetchMock()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ usageEventsDisplay: [] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            usageEventsDisplay: [
              {
                timestamp: todayTs,
                model: 'default',
                chargedCents: 10,
                tokenUsage: { inputTokens: 1, outputTokens: 1 },
              },
              {
                timestamp: todayTs - 86_400_000,
                model: 'old',
                chargedCents: 99,
                tokenUsage: { inputTokens: 1, outputTokens: 1 },
              },
            ],
          }),
          { status: 200 },
        ),
      )

    const result = await fetchTodayEvents(
      cookie,
      new AbortController().signal,
      now,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.queries).toHaveLength(1)
    expect(result.queries[0]?.model).toBe('default')
    expect(fetchMock()).toHaveBeenCalledTimes(2)

    const firstBody = JSON.parse(
      String((fetchMock().mock.calls[0] as [string, RequestInit])[1].body),
    ) as { startDate: string; endDate: string; page: number }
    expect(firstBody.page).toBe(1)
    expect(firstBody.startDate).toBeDefined()
    expect(firstBody.endDate).toBeDefined()

    const secondBody = JSON.parse(
      String((fetchMock().mock.calls[1] as [string, RequestInit])[1].body),
    ) as { startDate?: string; pageSize: number }
    expect(secondBody.startDate).toBeUndefined()
    expect(secondBody.pageSize).toBe(1000)
  })
})

describe('fetchUserAnalytics', () => {
  it('GETs get-user-analytics with the cookie and date range', async () => {
    fetchMock().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          dailyMetrics: [
            {
              day: '2026-09-01',
              acceptedLinesAdded: 1,
              acceptedLinesDeleted: 2,
            },
          ],
        }),
        { status: 200 },
      ),
    )
    const startMs = Date.UTC(2026, 8, 1)
    const endMs = Date.UTC(2026, 8, 20)
    const result = await fetchUserAnalytics(
      cookie,
      new AbortController().signal,
      { startMs, endMs },
    )
    expect(result.ok).toBe(true)
    expect(fetchMock()).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit]
    expect(String(url).startsWith(USER_ANALYTICS_URL)).toBe(true)
    expect(String(url)).toContain(String(startMs))
    expect(init.method).toBe('GET')
    expect(header(init, 'Cookie')).toBe(cookie)
    expect(header(init, 'Authorization')).toBeNull()
  })
})
