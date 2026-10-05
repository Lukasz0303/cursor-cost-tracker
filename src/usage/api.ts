import { mapEventsPayload } from './parse'
import type { UsageQuery } from './types'
import { resolveHistorySample } from '../historySample'
import {
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
} from '../historyLimit'
import { analyticsChunks } from '../codeLines/analyticsParse'
import { localDayBoundsMs, sameLocalDay } from '../time/localDay'

export const USAGE_SUMMARY_URL = 'https://cursor.com/api/usage-summary'
export const USAGE_EVENTS_URL =
  'https://cursor.com/api/dashboard/get-filtered-usage-events'
export const USER_ANALYTICS_URL =
  'https://cursor.com/api/dashboard/get-user-analytics'
export const ALLOWED_HOST = 'cursor.com'
export const FETCH_TIMEOUT_MS = 15_000
/** First try: fewer round-trips for Last 1k–10k. */
export const DEFAULT_PAGE_SIZE = 1_000
/** Cursor dashboard historically served 100; used if 1000 times out or is capped. */
export const FALLBACK_PAGE_SIZE = 100
export const MAX_EVENTS_PAGE_SIZE = 1_000
export const MAX_TODAY_PAGES = 100
export const PAGE_GAP_MS = 100
export const RATE_LIMIT_RETRY_MS = 250

export const USAGE_LOAD_ERROR = 'Could not load usage'
export const USAGE_SIGN_IN = 'Sign in to Cursor'
export const USAGE_CANCELLED = 'Cancelled'

export type FetchSummaryResult =
  | { ok: true; raw: unknown }
  | { ok: false; message: string }

export type FetchEventsResult =
  | { ok: true; queries: UsageQuery[] }
  | { ok: false; message: string }

export function assertCursorHost(url: string): void {
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    throw new Error(USAGE_LOAD_ERROR)
  }
  if (hostname !== ALLOWED_HOST) {
    throw new Error(USAGE_LOAD_ERROR)
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function withTimeout(signal: AbortSignal, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms)
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([signal, timeout])
  }
  const controller = new AbortController()
  const abort = (): void => {
    controller.abort()
  }
  if (signal.aborted || timeout.aborted) {
    abort()
    return controller.signal
  }
  signal.addEventListener('abort', abort, { once: true })
  timeout.addEventListener('abort', abort, { once: true })
  return controller.signal
}

function statusMessage(status: number): string {
  if (status === 401 || status === 403) {
    return USAGE_SIGN_IN
  }
  return USAGE_LOAD_ERROR
}

function fail(
  error: unknown,
  signal: AbortSignal,
): { ok: false; message: string } {
  if (signal.aborted) {
    return { ok: false, message: USAGE_CANCELLED }
  }
  if (isAbortError(error)) {
    return { ok: false, message: USAGE_LOAD_ERROR }
  }
  return { ok: false, message: USAGE_LOAD_ERROR }
}

function clampPageSize(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_PAGE_SIZE
  }
  return Math.min(MAX_EVENTS_PAGE_SIZE, Math.max(1, Math.round(value)))
}

function maxPagesFor(limit: number, pageSize: number): number {
  const step = Math.min(pageSize, FALLBACK_PAGE_SIZE)
  return Math.max(1, Math.ceil(limit / step))
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function cookieHeaders(cookie: string, jsonBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Cookie: cookie,
    Accept: 'application/json',
  }
  if (jsonBody) {
    headers['Content-Type'] = 'application/json'
    headers.Origin = 'https://cursor.com'
  }
  return headers
}

async function cursorFetch(
  url: string,
  cookie: string,
  signal: AbortSignal,
  init: RequestInit,
): Promise<Response> {
  assertCursorHost(url)
  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  return await fetch(url, {
    ...init,
    redirect: 'error',
    signal: withTimeout(signal, FETCH_TIMEOUT_MS),
    headers: cookieHeaders(cookie, init.method === 'POST'),
  })
}

async function readUnknownJson(response: Response): Promise<unknown | undefined> {
  try {
    return (await response.json()) as unknown
  } catch {
    return undefined
  }
}

function localDayBounds(now: Date): { startDate: string; endDate: string } {
  const bounds = localDayBoundsMs(now)
  return {
    startDate: bounds.startDate,
    endDate: bounds.endDate,
  }
}

function isSameLocalDayAsNow(timestamp: number, now: Date): boolean {
  return sameLocalDay(timestamp, now.getTime())
}

async function postEventsPage(
  cookie: string,
  signal: AbortSignal,
  body: {
    page: number
    pageSize: number
    startDate?: string
    endDate?: string
  },
  retriesLeft = 1,
): Promise<FetchEventsResult> {
  try {
    const response = await cursorFetch(USAGE_EVENTS_URL, cookie, signal, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (response.status === 429 && retriesLeft > 0 && !signal.aborted) {
      try {
        await sleep(RATE_LIMIT_RETRY_MS, signal)
      } catch {
        return { ok: false, message: USAGE_CANCELLED }
      }
      return postEventsPage(cookie, signal, body, retriesLeft - 1)
    }
    if (!response.ok) {
      return { ok: false, message: statusMessage(response.status) }
    }
    const raw = await readUnknownJson(response)
    if (raw === undefined) {
      return { ok: false, message: USAGE_LOAD_ERROR }
    }
    return {
      ok: true,
      queries: mapEventsPayload(raw, Number.POSITIVE_INFINITY),
    }
  } catch (error) {
    return fail(error, signal)
  }
}

function finishQueries(
  collected: UsageQuery[],
  limit: number,
  startMs: number | null,
  endMs: number | null,
): FetchEventsResult {
  collected.sort((left, right) => right.timestamp - left.timestamp)
  const inRange = collected.filter((query) => {
    if (startMs !== null && query.timestamp < startMs) {
      return false
    }
    if (endMs !== null && query.timestamp > endMs) {
      return false
    }
    return true
  })
  return { ok: true, queries: inRange.slice(0, limit) }
}

async function collectEventPages(
  cookie: string,
  signal: AbortSignal,
  options: {
    pageSize: number
    maxPages: number
    limit: number
    startDate?: string
    endDate?: string
    startMs?: number | null
    endMs?: number | null
  },
): Promise<FetchEventsResult> {
  const startMs = options.startMs ?? null
  const endMs = options.endMs ?? null
  const collected: UsageQuery[] = []
  let pageSize = clampPageSize(Math.min(options.pageSize, options.limit))
  let maxPages = Math.max(options.maxPages, maxPagesFor(options.limit, pageSize))
  let triedFallback = false
  let page = 1

  while (page <= maxPages) {
    if (signal.aborted) {
      return { ok: false, message: USAGE_CANCELLED }
    }

    const result = await postEventsPage(cookie, signal, {
      page,
      pageSize,
      ...(options.startDate !== undefined ? { startDate: options.startDate } : {}),
      ...(options.endDate !== undefined ? { endDate: options.endDate } : {}),
    })

    if (!result.ok) {
      if (
        result.message === USAGE_CANCELLED ||
        result.message === USAGE_SIGN_IN
      ) {
        return result
      }
      if (
        page === 1 &&
        collected.length === 0 &&
        !triedFallback &&
        pageSize > FALLBACK_PAGE_SIZE
      ) {
        pageSize = FALLBACK_PAGE_SIZE
        triedFallback = true
        maxPages = Math.max(maxPages, maxPagesFor(options.limit, pageSize))
        continue
      }
      if (collected.length > 0) {
        return finishQueries(collected, options.limit, startMs, endMs)
      }
      return result
    }

    if (result.queries.length === 0) {
      break
    }

    collected.push(...result.queries)

    const looksLikeServerCap =
      result.queries.length >= FALLBACK_PAGE_SIZE &&
      result.queries.length < pageSize
    if (looksLikeServerCap) {
      pageSize = result.queries.length
      maxPages = Math.max(maxPages, maxPagesFor(options.limit, pageSize))
    } else if (result.queries.length < pageSize) {
      break
    }

    if (
      startMs !== null &&
      result.queries.some((query) => query.timestamp < startMs)
    ) {
      break
    }
    if (collected.length >= options.limit) {
      break
    }

    page += 1
    if (page <= maxPages) {
      try {
        await sleep(PAGE_GAP_MS, signal)
      } catch {
        return { ok: false, message: USAGE_CANCELLED }
      }
    }
  }

  return finishQueries(collected, options.limit, startMs, endMs)
}

export async function fetchUsageSummary(
  cookie: string,
  signal: AbortSignal,
): Promise<FetchSummaryResult> {
  try {
    const response = await cursorFetch(USAGE_SUMMARY_URL, cookie, signal, {
      method: 'GET',
    })
    if (!response.ok) {
      return { ok: false, message: statusMessage(response.status) }
    }
    const raw = await readUnknownJson(response)
    if (raw === undefined) {
      return { ok: false, message: USAGE_LOAD_ERROR }
    }
    return { ok: true, raw }
  } catch (error) {
    return fail(error, signal)
  }
}

export type FetchRecentEventsOptions = {
  pageSize?: number
  limit?: number
  fromDate?: string | null
  toDate?: string | null
  now?: Date
}

export async function fetchRecentEvents(
  cookie: string,
  signal: AbortSignal,
  options?: FetchRecentEventsOptions,
): Promise<FetchEventsResult> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
  const now = options?.now ?? new Date()
  const sample = resolveHistorySample({
    historyLimit: options?.limit ?? DEFAULT_HISTORY_LIMIT,
    historyFromDate: options?.fromDate ?? null,
    historyToDate: options?.toDate ?? null,
    now,
  })
  const limit = sample.fetchLimit
  if (sample.mode === 'calendar') {
    return collectEventPages(cookie, signal, {
      pageSize,
      maxPages: maxPagesFor(limit, pageSize),
      limit,
      startDate: sample.startDate,
      endDate: sample.endDate,
      startMs: sample.startMs,
      endMs: sample.endMs,
    })
  }
  return collectEventPages(cookie, signal, {
    pageSize,
    maxPages: maxPagesFor(limit, pageSize),
    limit,
    startMs: null,
    endMs: null,
  })
}

export async function fetchTodayEvents(
  cookie: string,
  signal: AbortSignal,
  now: Date,
  options?: { pageSize?: number; maxPages?: number; limit?: number },
): Promise<FetchEventsResult> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
  const limit = options?.limit ?? MAX_HISTORY_LIMIT
  const maxPages = options?.maxPages ?? MAX_TODAY_PAGES
  const bounds = localDayBounds(now)
  const dated = await collectEventPages(cookie, signal, {
    pageSize,
    maxPages,
    limit,
    ...bounds,
  })
  if (!dated.ok) {
    return dated
  }
  if (dated.queries.length > 0) {
    return dated
  }

  const fallback = await fetchRecentEvents(cookie, signal, {
    pageSize,
    limit,
  })
  if (!fallback.ok) {
    return fallback
  }
  return {
    ok: true,
    queries: fallback.queries.filter((query) =>
      isSameLocalDayAsNow(query.timestamp, now),
    ),
  }
}

async function fetchUserAnalyticsOnce(
  cookie: string,
  signal: AbortSignal,
  range: { startMs: number; endMs: number },
): Promise<FetchSummaryResult> {
  const query =
    `?startDate=${encodeURIComponent(String(range.startMs))}` +
    `&endDate=${encodeURIComponent(String(range.endMs))}`
  const getUrl = `${USER_ANALYTICS_URL}${query}`
  const body = JSON.stringify({
    startDate: String(range.startMs),
    endDate: String(range.endMs),
  })
  try {
    const getResponse = await cursorFetch(getUrl, cookie, signal, {
      method: 'GET',
    })
    if (getResponse.status === 401 || getResponse.status === 403) {
      return { ok: false, message: statusMessage(getResponse.status) }
    }
    if (getResponse.ok) {
      const raw = await readUnknownJson(getResponse)
      if (raw !== undefined) {
        return { ok: true, raw }
      }
    }
    const postResponse = await cursorFetch(USER_ANALYTICS_URL, cookie, signal, {
      method: 'POST',
      body,
    })
    if (!postResponse.ok) {
      return { ok: false, message: statusMessage(postResponse.status) }
    }
    const raw = await readUnknownJson(postResponse)
    if (raw === undefined) {
      return { ok: false, message: USAGE_LOAD_ERROR }
    }
    return { ok: true, raw }
  } catch (error) {
    return fail(error, signal)
  }
}

export async function fetchUserAnalytics(
  cookie: string,
  signal: AbortSignal,
  range: { startMs: number; endMs: number },
): Promise<FetchSummaryResult> {
  const chunks = analyticsChunks(range.startMs, range.endMs)
  if (chunks.length === 0) {
    return { ok: true, raw: { dailyMetrics: [] } }
  }
  const parts: unknown[] = []
  for (const chunk of chunks) {
    const result = await fetchUserAnalyticsOnce(cookie, signal, chunk)
    if (!result.ok) {
      // A 32-day window is two requests. Returning the first chunk as ok
      // published a short total and the card never restored the full window.
      return result
    }
    parts.push(result.raw)
  }
  return { ok: true, raw: parts.length === 1 ? parts[0] : parts }
}
