import { USAGE_CANCELLED, USAGE_LOAD_ERROR } from './api'
import type { FetchEventsResult, FetchSummaryResult } from './api'
import { buildUsageReady } from './parse'
import type { SessionResult } from './session'
import type { UsageQuery, UsageReady, UsageSnapshot } from './types'

export type Disposable = {
  dispose: () => void
}

export type SnapshotListener = (snapshot: UsageSnapshot) => void

export type UsageDependencies = {
  readSession: () => Promise<SessionResult>
  fetchSummary: (
    cookie: string,
    signal: AbortSignal,
  ) => Promise<FetchSummaryResult>
  fetchEvents: (
    cookie: string,
    signal: AbortSignal,
  ) => Promise<FetchEventsResult>
  now?: () => Date
}

export type UsageServiceOptions = {
  pollIntervalMinutes?: number
  activityRefreshCooldownMs?: number
}

const DEFAULT_POLL_MINUTES = 1
export const DEFAULT_ACTIVITY_REFRESH_COOLDOWN_MS = 60_000

export function isActivityRefreshDue(
  lastFetchedAtMs: number | undefined,
  nowMs: number,
  cooldownMs: number = DEFAULT_ACTIVITY_REFRESH_COOLDOWN_MS,
): boolean {
  if (lastFetchedAtMs === undefined) {
    return true
  }
  if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) {
    return true
  }
  return nowMs - lastFetchedAtMs >= cooldownMs
}

export function clampPollIntervalMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_POLL_MINUTES
  }
  return Math.min(60, Math.max(1, Math.round(value)))
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

class SnapshotEmitter {
  private readonly listeners = new Set<SnapshotListener>()

  subscribe(listener: SnapshotListener): Disposable {
    this.listeners.add(listener)
    return {
      dispose: (): void => {
        this.listeners.delete(listener)
      },
    }
  }

  fire(snapshot: UsageSnapshot): void {
    for (const listener of [...this.listeners]) {
      listener(snapshot)
    }
  }

  dispose(): void {
    this.listeners.clear()
  }
}

export class UsageService implements Disposable {
  private readonly deps: UsageDependencies
  private readonly emitter = new SnapshotEmitter()
  private snapshot: UsageSnapshot = { status: 'loading' }
  private cachedReady: UsageReady | undefined
  private pollMinutes: number
  private activityCooldownMs: number
  private pollTimer: ReturnType<typeof setInterval> | undefined
  private inFlight: AbortController | undefined
  private lastFetchedAtMs: number | undefined
  private generation = 0
  private started = false
  private disposed = false

  constructor(deps: UsageDependencies, options?: UsageServiceOptions) {
    this.deps = deps
    this.pollMinutes = clampPollIntervalMinutes(
      options?.pollIntervalMinutes ?? DEFAULT_POLL_MINUTES,
    )
    this.activityCooldownMs =
      options?.activityRefreshCooldownMs ?? DEFAULT_ACTIVITY_REFRESH_COOLDOWN_MS
  }

  readonly onDidChange = (listener: SnapshotListener): Disposable => {
    return this.emitter.subscribe(listener)
  }

  getSnapshot(): UsageSnapshot {
    return this.snapshot
  }

  getCachedQueries(): UsageQuery[] {
    return this.cachedReady?.recentQueries ?? []
  }

  isRefreshing(): boolean {
    return this.inFlight !== undefined
  }

  start(): void {
    if (this.disposed || this.started) {
      return
    }
    this.started = true
    if (this.snapshot.status !== 'ready') {
      this.setSnapshot({ status: 'loading' })
    }
    void this.refresh()
    this.startPollTimer()
  }

  reconfigure(options: { pollIntervalMinutes?: number }): void {
    if (options.pollIntervalMinutes === undefined) {
      return
    }
    this.pollMinutes = clampPollIntervalMinutes(options.pollIntervalMinutes)
    if (this.started && !this.disposed) {
      this.startPollTimer()
    }
  }

  refreshOnActivity(): void {
    if (this.disposed || !this.started || this.inFlight !== undefined) {
      return
    }
    if (
      !isActivityRefreshDue(
        this.lastFetchedAtMs,
        this.nowMs(),
        this.activityCooldownMs,
      )
    ) {
      return
    }
    void this.refresh()
  }

  async refresh(): Promise<void> {
    if (this.disposed) {
      return
    }

    this.inFlight?.abort()
    const controller = new AbortController()
    this.inFlight = controller
    const generation = ++this.generation
    this.emitter.fire(this.snapshot)

    try {
      const session = await this.deps.readSession()
      if (this.isStale(generation, controller)) {
        return
      }
      if (!session.ok) {
        this.markFetched()
        this.setSnapshot({ status: 'error', message: session.error })
        return
      }

      const cookie = session.cookie
      const [summary, events] = await Promise.all([
        this.deps.fetchSummary(cookie, controller.signal),
        this.deps.fetchEvents(cookie, controller.signal),
      ])
      if (this.isStale(generation, controller)) {
        return
      }

      if (!summary.ok) {
        if (summary.message === USAGE_CANCELLED) {
          return
        }
        this.markFetched()
        this.setSnapshot({ status: 'error', message: summary.message })
        return
      }

      const data = buildUsageReady({
        summary: summary.raw,
        queries: events.ok ? events.queries : [],
        eventsAvailable: events.ok,
        now: this.now(),
        email: session.email,
      })
      this.cachedReady = data
      this.markFetched()
      this.setSnapshot({ status: 'ready', data })
    } catch (error) {
      if (this.isStale(generation, controller) || isAbortError(error)) {
        return
      }
      this.markFetched()
      this.setSnapshot({ status: 'error', message: USAGE_LOAD_ERROR })
    } finally {
      if (this.inFlight === controller) {
        this.inFlight = undefined
        this.emitter.fire(this.snapshot)
      }
    }
  }

  dispose(): void {
    this.disposed = true
    this.clearPollTimer()
    this.inFlight?.abort()
    this.inFlight = undefined
    this.emitter.dispose()
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date()
  }

  private nowMs(): number {
    return this.now().getTime()
  }

  private markFetched(): void {
    this.lastFetchedAtMs = this.nowMs()
  }

  private isStale(generation: number, controller: AbortController): boolean {
    return (
      this.disposed ||
      generation !== this.generation ||
      controller.signal.aborted
    )
  }

  private setSnapshot(snapshot: UsageSnapshot): void {
    this.snapshot = snapshot
    this.emitter.fire(snapshot)
  }

  private startPollTimer(): void {
    this.clearPollTimer()
    const ms = this.pollMinutes * 60_000
    this.pollTimer = setInterval(() => {
      void this.refresh()
    }, ms)
  }

  private clearPollTimer(): void {
    if (this.pollTimer === undefined) {
      return
    }
    clearInterval(this.pollTimer)
    this.pollTimer = undefined
  }
}
