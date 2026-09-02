import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { USAGE_LOAD_ERROR } from '../src/usage/api'
import { SIGN_IN_MESSAGE } from '../src/usage/session'
import {
  clampPollIntervalMinutes,
  DEFAULT_ACTIVITY_REFRESH_COOLDOWN_MS,
  isActivityRefreshDue,
  UsageService,
  type UsageDependencies,
} from '../src/usage/service'
import type { UsageSnapshot } from '../src/usage/types'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const summary = JSON.parse(
  readFileSync(join(fixtures, 'usage-summary.sample.json'), 'utf8'),
) as unknown

const now = new Date(2026, 8, 1, 12, 0, 0)
const todayTs = now.getTime()

function queries() {
  return [
    {
      timestamp: todayTs,
      model: 'default',
      kind: null,
      costUsd: 1.25,
      tokens: 10,
      inputTokens: 8,
      outputTokens: 2,
    },
  ]
}

function okSession(): UsageDependencies['readSession'] {
  return async () => ({
    ok: true as const,
    cookie: 'WorkosCursorSessionToken=user_test::aaa.bbb.ccc',
    email: null,
  })
}

function hangUntilAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const fail = (): void => {
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal.aborted) {
      fail()
      return
    }
    signal.addEventListener('abort', fail, { once: true })
  })
}

function collect(service: UsageService): UsageSnapshot[] {
  const snapshots: UsageSnapshot[] = []
  service.onDidChange((snapshot) => {
    snapshots.push(snapshot)
  })
  return snapshots
}

async function waitFor(
  service: UsageService,
  status: UsageSnapshot['status'],
): Promise<void> {
  if (service.getSnapshot().status === status) {
    return
  }
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      sub.dispose()
      reject(new Error(`timed out waiting for ${status}`))
    }, 1_000)
    const sub = service.onDidChange((snapshot) => {
      if (snapshot.status === status) {
        clearTimeout(timeout)
        sub.dispose()
        resolve()
      }
    })
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('clampPollIntervalMinutes', () => {
  it('clamps to 1–60', () => {
    expect(clampPollIntervalMinutes(0)).toBe(1)
    expect(clampPollIntervalMinutes(99)).toBe(60)
    expect(clampPollIntervalMinutes(5)).toBe(5)
    expect(clampPollIntervalMinutes(Number.NaN)).toBe(5)
  })
})

describe('isActivityRefreshDue', () => {
  it('allows the first fetch and enforces the cooldown', () => {
    expect(isActivityRefreshDue(undefined, 0)).toBe(true)
    expect(isActivityRefreshDue(1_000, 1_000 + 59_999)).toBe(false)
    expect(
      isActivityRefreshDue(1_000, 1_000 + DEFAULT_ACTIVITY_REFRESH_COOLDOWN_MS),
    ).toBe(true)
  })
})

describe('UsageService', () => {
  it('emits loading then ready on start', async () => {
    const deps: UsageDependencies = {
      readSession: okSession(),
      fetchSummary: async () => ({ ok: true, raw: summary }),
      fetchEvents: async () => ({ ok: true, queries: queries() }),
      now: () => now,
    }
    const service = new UsageService(deps)
    const snapshots = collect(service)
    service.start()
    expect(snapshots[0]).toEqual({ status: 'loading' })
    await waitFor(service, 'ready')
    const last = snapshots.at(-1)
    expect(last?.status).toBe('ready')
    if (last?.status !== 'ready') {
      return
    }
    expect(last.data.usedUsd).toBe(3.79)
    expect(last.data.todayUsedUsd).toBe(1.25)
    expect(service.getCachedQueries()).toHaveLength(1)
    service.dispose()
  })

  it('emits a session error and does not fetch', async () => {
    const fetchSummary = vi.fn(async () => ({ ok: true as const, raw: summary }))
    const fetchEvents = vi.fn(async () => ({
      ok: true as const,
      queries: queries(),
    }))
    const service = new UsageService({
      readSession: async () => ({ ok: false, error: SIGN_IN_MESSAGE }),
      fetchSummary,
      fetchEvents,
      now: () => now,
    })
    service.start()
    await waitFor(service, 'error')
    expect(service.getSnapshot()).toEqual({
      status: 'error',
      message: SIGN_IN_MESSAGE,
    })
    expect(fetchSummary).not.toHaveBeenCalled()
    expect(fetchEvents).not.toHaveBeenCalled()
    service.dispose()
  })

  it('emits error when summary fails', async () => {
    const service = new UsageService({
      readSession: okSession(),
      fetchSummary: async () => ({ ok: false, message: USAGE_LOAD_ERROR }),
      fetchEvents: async () => ({ ok: true, queries: queries() }),
      now: () => now,
    })
    service.start()
    await waitFor(service, 'error')
    expect(service.getSnapshot()).toEqual({
      status: 'error',
      message: USAGE_LOAD_ERROR,
    })
    service.dispose()
  })

  it('stays ready when events fail but summary succeeds', async () => {
    const service = new UsageService({
      readSession: okSession(),
      fetchSummary: async () => ({ ok: true, raw: summary }),
      fetchEvents: async () => ({ ok: false, message: USAGE_LOAD_ERROR }),
      now: () => now,
    })
    service.start()
    await waitFor(service, 'ready')
    const snapshot = service.getSnapshot()
    expect(snapshot.status).toBe('ready')
    if (snapshot.status !== 'ready') {
      return
    }
    expect(snapshot.data.todayUsedUsd).toBeNull()
    expect(snapshot.data.recentQueries).toEqual([])
    expect(snapshot.data.usedUsd).toBe(3.79)
    service.dispose()
  })

  it('aborts the first in-flight refresh when a second starts', async () => {
    const signals: AbortSignal[] = []
    const service = new UsageService({
      readSession: okSession(),
      fetchSummary: async (_cookie, signal) => {
        signals.push(signal)
        if (signals.length === 1) {
          await hangUntilAbort(signal)
        }
        return { ok: true, raw: summary }
      },
      fetchEvents: async () => ({ ok: true, queries: queries() }),
      now: () => now,
    })

    const first = service.refresh()
    await Promise.resolve()
    const second = service.refresh()
    await second
    await first

    expect(signals[0]?.aborted).toBe(true)
    expect(service.getSnapshot().status).toBe('ready')
    service.dispose()
  })

  it('does not emit after dispose and does not poll', async () => {
    vi.useFakeTimers()
    const fetchSummary = vi.fn(async () => ({ ok: true as const, raw: summary }))
    const service = new UsageService(
      {
        readSession: okSession(),
        fetchSummary,
        fetchEvents: async () => ({ ok: true, queries: queries() }),
        now: () => now,
      },
      { pollIntervalMinutes: 5 },
    )
    service.start()
    await waitFor(service, 'ready')
    const calls = fetchSummary.mock.calls.length
    service.dispose()
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(fetchSummary.mock.calls.length).toBe(calls)
    expect(service.getSnapshot().status).toBe('ready')
  })

  it('polls on the clamped interval', async () => {
    vi.useFakeTimers()
    const fetchSummary = vi.fn(async () => ({ ok: true as const, raw: summary }))
    const service = new UsageService(
      {
        readSession: okSession(),
        fetchSummary,
        fetchEvents: async () => ({ ok: true, queries: queries() }),
        now: () => now,
      },
      { pollIntervalMinutes: 0 },
    )
    service.start()
    await waitFor(service, 'ready')
    expect(fetchSummary).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchSummary).toHaveBeenCalledTimes(2)
    service.reconfigure({ pollIntervalMinutes: 99 })
    await vi.advanceTimersByTimeAsync(59 * 60_000)
    expect(fetchSummary).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchSummary).toHaveBeenCalledTimes(3)
    service.dispose()
  })

  it('skips activity refresh inside the cooldown but manual refresh still runs', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 12, 0, 0))
    const fetchSummary = vi.fn(async () => ({ ok: true as const, raw: summary }))
    const service = new UsageService(
      {
        readSession: okSession(),
        fetchSummary,
        fetchEvents: async () => ({ ok: true, queries: queries() }),
        now: () => new Date(),
      },
      { activityRefreshCooldownMs: 60_000 },
    )
    service.start()
    await waitFor(service, 'ready')
    expect(fetchSummary).toHaveBeenCalledTimes(1)

    service.refreshOnActivity()
    await Promise.resolve()
    expect(fetchSummary).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(61_000)
    service.refreshOnActivity()
    await waitFor(service, 'ready')
    expect(fetchSummary).toHaveBeenCalledTimes(2)

    service.refreshOnActivity()
    await Promise.resolve()
    expect(fetchSummary).toHaveBeenCalledTimes(2)

    await service.refresh()
    expect(fetchSummary).toHaveBeenCalledTimes(3)
    service.dispose()
  })
})
