import { formatKind } from '../format'
import { isGeneratedThreadTitle } from '../openaiHistory/ids'
import { usageModelKey } from '../pricing/usageMatch'
import { DEFAULT_SPIKE_TOKEN_THRESHOLD, isSpike } from '../spikes/threshold'
import { cleanConversationTitle } from '../usage/conversationTitles'
import { stripModelPrefix } from '../usage/events'
import type { UsageQuery } from '../usage/types'
import { isOptimizedQuery, type OptimizedTargets } from '../ui/optimizedTargets'
import type { SpendMixBucket } from './schema'

export const UNKNOWN_VENDOR_LABEL = 'Unknown'
export const OTHER_SLICE_ID = 'other'
export const OTHER_SLICE_LABEL = 'Other'

export type SpendMixCatalogModel = {
  id: string
  provider: string
}

export type SpendMixSliceKey = {
  id: string
  label: string
}

/**
 * Family token before the `cursor` wrapper, so `cursor-grok` stays xAI
 * while `cursor-small` stays Cursor.
 */
const FAMILY_VENDORS: readonly { needle: string; label: string }[] = [
  { needle: 'claude', label: 'Anthropic' },
  { needle: 'gpt', label: 'OpenAI' },
  { needle: 'grok', label: 'xAI' },
  { needle: 'gemini', label: 'Google' },
  { needle: 'composer', label: 'Cursor' },
  { needle: 'cursor', label: 'Cursor' },
]

const OPENAI_SERIES = /(^|[^a-z0-9])o[134]([^a-z0-9]|$)/

function providerFromCatalog(
  model: string,
  catalog: readonly SpendMixCatalogModel[],
): string | null {
  const exact = model.trim().toLowerCase()
  const key = usageModelKey(model)
  for (const row of catalog) {
    const id = row.id.trim().toLowerCase()
    if (id !== exact && usageModelKey(row.id) !== key) {
      continue
    }
    const provider = row.provider.trim()
    if (provider !== '') {
      return provider
    }
  }
  return null
}

function vendorFromFamily(model: string): string | null {
  const slug = model.toLowerCase()
  for (const row of FAMILY_VENDORS) {
    if (slug.includes(row.needle)) {
      return row.label
    }
  }
  if (OPENAI_SERIES.test(slug)) {
    return 'OpenAI'
  }
  return null
}

/** Catalog provider, then a local family map, then Unknown. Not a price list. */
export function vendorLabel(
  model: string | null,
  catalog: readonly SpendMixCatalogModel[],
): string {
  if (model === null || model.trim() === '') {
    return UNKNOWN_VENDOR_LABEL
  }
  return providerFromCatalog(model, catalog) ?? vendorFromFamily(model) ?? UNKNOWN_VENDOR_LABEL
}

/** First matching bucket wins. Match strings are substrings, not regular expressions. */
export function gradeBucket(
  model: string | null,
  buckets: readonly SpendMixBucket[],
): SpendMixSliceKey {
  const slug = model?.toLowerCase() ?? ''
  if (slug.trim() === '') {
    return { id: OTHER_SLICE_ID, label: OTHER_SLICE_LABEL }
  }
  for (const bucket of buckets) {
    for (const needle of bucket.match) {
      const term = needle.trim().toLowerCase()
      if (term !== '' && slug.includes(term)) {
        return { id: bucket.id, label: bucket.label }
      }
    }
  }
  return { id: OTHER_SLICE_ID, label: OTHER_SLICE_LABEL }
}

/** Same label the model bars used: drop the `cursor-` wrapper. */
export function modelSliceLabel(model: string | null): string {
  const stripped = stripModelPrefix(model)
  if (stripped === null || stripped.trim() === '') {
    return '—'
  }
  return stripped
}

/**
 * Same label as the queries table. A conversation id with no local title
 * (or a generated CLI title) is CLI, not the billing kind underneath.
 */
export const LIMIT_GOOD_SLICE: SpendMixSliceKey = { id: 'good', label: 'Good' }
export const LIMIT_OVER_SLICE: SpendMixSliceKey = { id: 'over', label: 'Over limit' }
export const LIMIT_OPTIMIZED_SLICE: SpendMixSliceKey = { id: 'optimized', label: 'Optimized' }

/**
 * One bucket per query. Optimized wins, then a query at or over Warn at,
 * then everything under that limit.
 */
export function limitSlice(
  row: {
    model: string | null
    kind?: string | null
    tokens?: number
    inputTokens?: number
    outputTokens?: number
    cacheWriteTokens?: number
    cacheReadTokens?: number
    timestamp?: number
    conversationId?: string
    costUsd: number
  },
  threshold: number,
  targets: OptimizedTargets,
): SpendMixSliceKey {
  if (isOptimizedQuery(asUsageQuery(row), targets)) {
    return LIMIT_OPTIMIZED_SLICE
  }
  const limit = Number.isFinite(threshold) ? threshold : DEFAULT_SPIKE_TOKEN_THRESHOLD
  if (isSpike(row.tokens ?? 0, limit)) {
    return LIMIT_OVER_SLICE
  }
  return LIMIT_GOOD_SLICE
}

function asUsageQuery(row: {
  model: string | null
  kind?: string | null
  tokens?: number
  inputTokens?: number
  outputTokens?: number
  cacheWriteTokens?: number
  cacheReadTokens?: number
  timestamp?: number
  conversationId?: string
  costUsd: number
}): UsageQuery {
  return {
    timestamp: row.timestamp ?? 0,
    model: row.model,
    kind: row.kind ?? null,
    costUsd: row.costUsd,
    tokens: row.tokens ?? 0,
    inputTokens: row.inputTokens ?? 0,
    outputTokens: row.outputTokens ?? 0,
    cacheWriteTokens: row.cacheWriteTokens ?? 0,
    cacheReadTokens: row.cacheReadTokens ?? 0,
    conversationId: row.conversationId,
  }
}

export function kindSliceLabel(
  kind: string | null | undefined,
  conversationId: string | null | undefined,
  titles: Readonly<Record<string, string>>,
): string {
  if (isCliThread(conversationId, titles)) {
    return 'CLI'
  }
  return formatKind(kind ?? null)
}

function isCliThread(
  conversationId: string | null | undefined,
  titles: Readonly<Record<string, string>>,
): boolean {
  const id = conversationId?.trim() ?? ''
  if (id === '') {
    return false
  }
  const raw = titles[id]
  const title = typeof raw === 'string' ? (cleanConversationTitle(raw) ?? '') : ''
  if (title === '') {
    return true
  }
  return isGeneratedThreadTitle(title, id)
}

const SIZE_BANDS: readonly SpendMixSliceKey[] = [
  { id: 'under-20k', label: '< 20k' },
  { id: '20-100k', label: '20–100k' },
  { id: '100-500k', label: '100–500k' },
  { id: '500k-1m', label: '500k–1M' },
  { id: '1m-up', label: '≥ 1M' },
]

const SIZE_CAPS = [20_000, 100_000, 500_000, 1_000_000] as const

/** Token size of the request that carried the dollars. Zero tokens stay in the first band. */
export function sizeBand(tokens: number): SpendMixSliceKey {
  const n = Number.isFinite(tokens) && tokens > 0 ? tokens : 0
  for (let i = 0; i < SIZE_CAPS.length; i++) {
    const band = SIZE_BANDS[i]
    const cap = SIZE_CAPS[i]
    if (band !== undefined && cap !== undefined && n < cap) {
      return band
    }
  }
  return SIZE_BANDS[SIZE_BANDS.length - 1] ?? { id: '1m-up', label: '≥ 1M' }
}

export const CACHE_READ_SLICE: SpendMixSliceKey = { id: 'cache-read', label: 'Cache read' }
export const CACHE_WRITE_SLICE: SpendMixSliceKey = { id: 'cache-write', label: 'Cache write' }
export const OUTPUT_SLICE: SpendMixSliceKey = { id: 'output', label: 'Output' }
export const INPUT_SLICE: SpendMixSliceKey = { id: 'input', label: 'Input' }

/**
 * Which token bucket dominated the billed request.
 * Ties prefer cache read, then cache write, then output, then input.
 */
export function cacheBand(tokens: {
  inputTokens?: number
  outputTokens?: number
  cacheWriteTokens?: number
  cacheReadTokens?: number
}): SpendMixSliceKey {
  const ranked: { slice: SpendMixSliceKey; n: number }[] = [
    { slice: CACHE_READ_SLICE, n: finiteTokens(tokens.cacheReadTokens) },
    { slice: CACHE_WRITE_SLICE, n: finiteTokens(tokens.cacheWriteTokens) },
    { slice: OUTPUT_SLICE, n: finiteTokens(tokens.outputTokens) },
    { slice: INPUT_SLICE, n: finiteTokens(tokens.inputTokens) },
  ]
  let best = ranked[0] ?? { slice: INPUT_SLICE, n: 0 }
  for (const item of ranked) {
    if (item.n > best.n) {
      best = item
    }
  }
  if (best.n <= 0) {
    return { id: OTHER_SLICE_ID, label: OTHER_SLICE_LABEL }
  }
  return best.slice
}

function finiteTokens(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

const NO_CONVERSATION_SLICE: SpendMixSliceKey = { id: 'none', label: 'No conversation' }
const UNTITLED_CONVERSATION_SLICE: SpendMixSliceKey = { id: 'untitled', label: 'Untitled' }

/** Title when the local chat name is known. Same titles share one slice. */
export function conversationSlice(
  conversationId: string | null | undefined,
  titles: Readonly<Record<string, string>>,
): SpendMixSliceKey {
  const id = conversationId?.trim() ?? ''
  if (id === '') {
    return NO_CONVERSATION_SLICE
  }
  const title = titles[id]?.trim() ?? ''
  if (title === '') {
    return UNTITLED_CONVERSATION_SLICE
  }
  const label = title.length > 80 ? `${title.slice(0, 79)}…` : title
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return { id: slug === '' ? 'untitled' : `chat-${slug}`, label }
}
