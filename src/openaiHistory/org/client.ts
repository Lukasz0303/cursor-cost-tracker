import { parseCostsBody, parseUsageBody, type OrgBucketRow } from './buckets'

const USAGE_URL = 'https://api.openai.com/v1/organization/usage/completions'
const COSTS_URL = 'https://api.openai.com/v1/organization/costs'
const WINDOW_DAYS = 30
const PAGE_CAP = 8

export type OrgImportResult = {
  rows: OrgBucketRow[]
  error: string | null
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/**
 * Read organization usage and costs. The key is sent only as the Authorization header
 * and is never copied into the result or the error text.
 */
export async function importOrganizationUsage(options: {
  key: string
  fetchImpl?: FetchLike
  nowSec?: number
}): Promise<OrgImportResult> {
  const key = options.key.trim()
  if (!key) {
    return { rows: [], error: 'Missing admin key.' }
  }
  const fetchImpl = options.fetchImpl ?? fetch
  const end = options.nowSec ?? Math.floor(Date.now() / 1000)
  const start = end - WINDOW_DAYS * 24 * 60 * 60
  try {
    const usage = await collect(fetchImpl, key, USAGE_URL, start, end, true)
    let costs: OrgBucketRow[] = []
    try {
      costs = await collect(fetchImpl, key, COSTS_URL, start, end, false)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message === 'unauthorized' || message === 'rate-limit') {
        throw err
      }
    }
    return { rows: usage.concat(costs), error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message === 'unauthorized') {
      return { rows: [], error: 'OpenAI rejected the admin key.' }
    }
    if (message === 'rate-limit') {
      return { rows: [], error: 'OpenAI usage is rate limited. Previous numbers stay.' }
    }
    if (message.startsWith('http:')) {
      return { rows: [], error: `OpenAI returned HTTP ${message.slice(5)}.` }
    }
    return { rows: [], error: 'Could not reach api.openai.com.' }
  }
}

async function collect(
  fetchImpl: FetchLike,
  key: string,
  base: string,
  start: number,
  end: number,
  grouped: boolean,
): Promise<OrgBucketRow[]> {
  const rows: OrgBucketRow[] = []
  let page: string | null = null
  let group = grouped
  for (let i = 0; i < PAGE_CAP; i += 1) {
    const response = await getPage(fetchImpl, key, base, start, end, page, group)
    if (response.status === 400 && group) {
      group = false
      i -= 1
      continue
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('unauthorized')
    }
    if (response.status === 429) {
      throw new Error('rate-limit')
    }
    if (!response.ok) {
      throw new Error(`http:${response.status}`)
    }
    const body: unknown = await response.json()
    const parsed = base === COSTS_URL ? parseCostsBody(body) : parseUsageBody(body)
    rows.push(...parsed.rows)
    if (!parsed.nextPage) {
      return rows
    }
    page = parsed.nextPage
  }
  return rows
}

async function getPage(
  fetchImpl: FetchLike,
  key: string,
  base: string,
  start: number,
  end: number,
  page: string | null,
  grouped: boolean,
): Promise<Response> {
  const query = new URLSearchParams({
    start_time: String(start),
    end_time: String(end),
    bucket_width: '1d',
    limit: '31',
  })
  if (grouped) {
    query.append('group_by[]', 'model')
  }
  if (page) {
    query.set('page', page)
  }
  return fetchImpl(`${base}?${query.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(20_000),
  })
}
