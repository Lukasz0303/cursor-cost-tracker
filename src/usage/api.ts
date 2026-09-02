import { mapEventsPayload } from './parse'
import type { UsageQuery } from './types'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
} from '../historyLimit'

export const USAGE_SUMMARY_URL = 'https://cursor.com/api/usage-summary'
export const USAGE_EVENTS_URL =
  'https://cursor.com/api/dashboard/get-filtered-usage-events'
export const ALLOWED_HOST = 'cursor.com'
export const FETCH_TIMEOUT_MS = 15_000
export const DEFAULT_PAGE_SIZE = 100
export const MAX_TODAY_PAGES = 50

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

function fail(error: unknown): { ok: false; message: string } {
  if (isAbortError(error)) {
    return { ok: false, message: USAGE_CANCELLED }
  }
  return { ok: false, message: USAGE_LOAD_ERROR }
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
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
  return {
    startDate: String(start.getTime()),
    endDate: String(end.getTime()),
  }
}

function sameLocalDay(timestamp: number, now: Date): boolean {
  const d = new Date(timestamp)
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
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
): Promise<FetchEventsResult> {
  try {
    const response = await cursorFetch(USAGE_EVENTS_URL, cookie, signal, {
      method: 'POST',
      body: JSON.stringify(body),
    })
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
    const failed = fail(error)
    return { ok: false, message: failed.message }
  }
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
    return fail(error)
  }
}

export async function fetchRecentEvents(
  cookie: string,
  signal: AbortSignal,
  options?: { pageSize?: number; limit?: number },
): Promise<FetchEventsResult> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
  const limit = clampHistoryLimit(options?.limit ?? DEFAULT_HISTORY_LIMIT)
  const collected: UsageQuery[] = []
  const maxPages = Math.max(1, Math.ceil(limit / pageSize))

  for (let page = 1; page <= maxPages; page++) {
    const result = await postEventsPage(cookie, signal, {
      page,
      pageSize,
    })
    if (!result.ok) {
      return result
    }
    if (result.queries.length === 0) {
      break
    }
    collected.push(...result.queries)
    if (result.queries.length < pageSize) {
      break
    }
    if (collected.length >= limit) {
      break
    }
  }

  collected.sort((left, right) => right.timestamp - left.timestamp)
  return { ok: true, queries: collected.slice(0, limit) }
}

export async function fetchTodayEvents(
  cookie: string,
  signal: AbortSignal,
  now: Date,
  options?: { pageSize?: number; maxPages?: number; limit?: number },
): Promise<FetchEventsResult> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
  const maxPages = options?.maxPages ?? MAX_TODAY_PAGES
  const bounds = localDayBounds(now)
  const collected: UsageQuery[] = []

  for (let page = 1; page <= maxPages; page++) {
    const result = await postEventsPage(cookie, signal, {
      page,
      pageSize,
      ...bounds,
    })
    if (!result.ok) {
      return result
    }
    if (result.queries.length === 0) {
      break
    }
    collected.push(...result.queries)
    if (result.queries.length < pageSize) {
      break
    }
  }

  if (collected.length > 0) {
    collected.sort((a, b) => b.timestamp - a.timestamp)
    return { ok: true, queries: collected }
  }

  const fallback = await fetchRecentEvents(cookie, signal, {
    pageSize,
    limit: options?.limit,
  })
  if (!fallback.ok) {
    return fallback
  }
  return {
    ok: true,
    queries: fallback.queries.filter((query) => sameLocalDay(query.timestamp, now)),
  }
}
