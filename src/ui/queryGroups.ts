import { contextFillForQuery, type ContextFill } from '../contextFill/fill'
import { formatDateTime, formatDollars, formatKind, formatTokens } from '../format'
import { catalogFor } from '../i18n'
import { DEFAULT_LOCALE, type Locale } from '../locale'
import { DEFAULT_SPIKE_TOKEN_THRESHOLD, isSpike } from '../spikes/threshold'
import type { ComposerContextMeter } from '../usage/conversationTitles'
import {
  titleGroupKey,
  UNGROUPED_CONVERSATION_ID,
} from '../usage/groupConversations'
import { stripModelPrefix } from '../usage/parse'
import type { UsageQuery } from '../usage/types'
import { emptyOptimizedTargets, isOptimizedQuery, type OptimizedTargets } from './optimizedTargets'

export type QueryGroupPayload = {
  key: string
  /** Row label: local title, `#ab12cd34`, or the localized Ungrouped bucket. */
  title: string
  named: boolean
  /** Conversation ids folded into this row. Empty for the Ungrouped bucket. */
  ids: string[]
  queryCount: number
  firstTimestamp: number
  lastTimestamp: number
  rangeLabel: string
  cost: string
  tokens: string
  inputOutput: string
  model: string
  kind: string
  spike: boolean
  /** Every request in the group was already sent to Optimize. */
  optimized: boolean
  /**
   * True when the row can open Optimize. Merged-title rows (several ids) stay
   * on — play targets the id that owns the dearest request.
   */
  optimizable: boolean
  optimizeId: string | null
  optimizeTimestamp: number | null
  /** Newest turn's share of that model's context window. */
  context: ContextFill
  /** Indexes into the same sample `toHistoryRows` renders, newest first. */
  rowIndexes: number[]
}

export type QueryGroupOptions = {
  titles?: Readonly<Record<string, string>>
  /** Cursor context meters keyed by conversation id. */
  conversationContext?: Readonly<Record<string, ComposerContextMeter>>
  spikeTokenThreshold?: number
  showSpikeWarning?: boolean
  optimizedTargets?: OptimizedTargets | null
  locale?: Locale
}

type Bucket = {
  key: string
  label: string
  named: boolean
  ids: string[]
  rowIndexes: number[]
  queries: UsageQuery[]
}

function titleFor(
  query: UsageQuery,
  titles: Readonly<Record<string, string>> | undefined,
): string {
  const id = query.conversationId?.trim() ?? ''
  if (id === '' || titles === undefined) {
    return ''
  }
  const raw = titles[id]
  return typeof raw === 'string' ? raw : ''
}

function clockLabel(ms: number): string {
  const stamp = formatDateTime(ms)
  const comma = stamp.lastIndexOf(', ')
  return comma === -1 ? stamp : stamp.slice(comma + 2)
}

function sameLocalDay(a: number, b: number): boolean {
  const left = new Date(a)
  const right = new Date(b)
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function newestQuery(queries: readonly UsageQuery[]): UsageQuery {
  let best = queries[0] as UsageQuery
  for (const query of queries) {
    if (query.timestamp >= best.timestamp) {
      best = query
    }
  }
  return best
}

function rangeLabel(first: number, last: number): string {
  if (first === last) {
    return formatDateTime(last)
  }
  if (sameLocalDay(first, last)) {
    return `${formatDateTime(first)} → ${clockLabel(last)}`
  }
  return `${formatDateTime(first)} → ${formatDateTime(last)}`
}

function summarizeLabels(values: readonly string[]): string {
  const unique: string[] = []
  for (const value of values) {
    const clean = value.trim()
    if (clean === '' || unique.includes(clean)) {
      continue
    }
    unique.push(clean)
  }
  if (unique.length === 0) {
    return '—'
  }
  if (unique.length === 1) {
    return unique[0] as string
  }
  return `${unique[0] as string} +${unique.length - 1}`
}

/**
 * Which conversation id the group play button optimizes.
 * One id → that id. Several (same title) → the id that owns the dearest
 * request, so a merged title row still gets a brief for one real chat.
 */
function pickOptimizeTarget(
  queries: readonly UsageQuery[],
  ids: readonly string[],
): { id: string; timestamp: number } | null {
  if (ids.length === 0) {
    return null
  }
  if (ids.length === 1) {
    const id = ids[0] as string
    let latest = 0
    for (const query of queries) {
      if (query.conversationId?.trim() === id && query.timestamp > latest) {
        latest = query.timestamp
      }
    }
    return { id, timestamp: latest }
  }
  const idSet = new Set(ids)
  let bestId = ids[0] as string
  let bestTokens = -1
  let bestCost = -1
  let bestTimestamp = 0
  for (const query of queries) {
    const id = query.conversationId?.trim() ?? ''
    if (id === '' || !idSet.has(id)) {
      continue
    }
    if (
      query.tokens > bestTokens ||
      (query.tokens === bestTokens && query.costUsd > bestCost) ||
      (query.tokens === bestTokens &&
        query.costUsd === bestCost &&
        query.timestamp > bestTimestamp)
    ) {
      bestId = id
      bestTokens = query.tokens
      bestCost = query.costUsd
      bestTimestamp = query.timestamp
    }
  }
  let latest = bestTimestamp
  for (const query of queries) {
    if (query.conversationId?.trim() === bestId && query.timestamp > latest) {
      latest = query.timestamp
    }
  }
  return { id: bestId, timestamp: latest }
}

/**
 * Fold a Last N sample into conversation rows keyed by local chat title.
 * `queries` must be the same newest-first sample the table renders, so
 * `rowIndexes` line up with `toHistoryRows` output.
 */
export function toQueryGroups(
  queries: readonly UsageQuery[],
  options: QueryGroupOptions = {},
): QueryGroupPayload[] {
  const titles = options.titles
  const targets = options.optimizedTargets ?? emptyOptimizedTargets()
  const showSpikeWarning = options.showSpikeWarning !== false
  const spikeTokenThreshold =
    options.spikeTokenThreshold ?? DEFAULT_SPIKE_TOKEN_THRESHOLD
  const copy = catalogFor(options.locale ?? DEFAULT_LOCALE)

  const buckets = new Map<string, Bucket>()
  const order: string[] = []
  for (let index = 0; index < queries.length; index += 1) {
    const query = queries[index] as UsageQuery
    const id = query.conversationId?.trim() ?? ''
    const group = titleGroupKey(id, titleFor(query, titles))
    const existing = buckets.get(group.key)
    if (existing === undefined) {
      buckets.set(group.key, {
        key: group.key,
        label: group.label,
        named: group.named,
        ids: id === '' ? [] : [id],
        rowIndexes: [index],
        queries: [query],
      })
      order.push(group.key)
      continue
    }
    if (id !== '' && !existing.ids.includes(id)) {
      existing.ids.push(id)
    }
    existing.rowIndexes.push(index)
    existing.queries.push(query)
  }

  const groups: QueryGroupPayload[] = []
  for (const key of order) {
    const bucket = buckets.get(key)
    if (bucket === undefined || bucket.queries.length === 0) {
      continue
    }
    const stamps = bucket.queries.map((query) => query.timestamp)
    const firstTimestamp = Math.min(...stamps)
    const lastTimestamp = Math.max(...stamps)
    const totals = bucket.queries.reduce(
      (acc, query) => ({
        cost: acc.cost + query.costUsd,
        tokens: acc.tokens + query.tokens,
        input: acc.input + query.inputTokens,
        output: acc.output + query.outputTokens,
      }),
      { cost: 0, tokens: 0, input: 0, output: 0 },
    )
    const spike =
      showSpikeWarning &&
      bucket.queries.some((query) => isSpike(query.tokens, spikeTokenThreshold))
    const tokens = formatTokens(totals.tokens)
    const ungrouped = bucket.key === UNGROUPED_CONVERSATION_ID
    const target = ungrouped ? null : pickOptimizeTarget(bucket.queries, bucket.ids)
    const optimizable = target !== null
    groups.push({
      key: bucket.key,
      title: ungrouped ? copy.queries.groupUngrouped : bucket.label,
      named: bucket.named,
      ids: bucket.ids,
      queryCount: bucket.queries.length,
      firstTimestamp,
      lastTimestamp,
      rangeLabel: rangeLabel(firstTimestamp, lastTimestamp),
      cost: formatDollars(totals.cost),
      tokens: spike ? `! ${tokens}` : tokens,
      inputOutput: `${formatTokens(totals.input)} / ${formatTokens(totals.output)}`,
      model: summarizeLabels(
        bucket.queries.map((query) => stripModelPrefix(query.model) ?? ''),
      ),
      kind: summarizeLabels(bucket.queries.map((query) => formatKind(query.kind))),
      spike,
      optimized: bucket.queries.every((query) => isOptimizedQuery(query, targets)),
      optimizable,
      optimizeId: target?.id ?? null,
      optimizeTimestamp: target?.timestamp ?? null,
      context: contextFillForQuery(newestQuery(bucket.queries), options.conversationContext),
      rowIndexes: bucket.rowIndexes,
    })
  }

  groups.sort((a, b) => {
    if (b.lastTimestamp !== a.lastTimestamp) {
      return b.lastTimestamp - a.lastTimestamp
    }
    if (a.key < b.key) {
      return -1
    }
    return a.key > b.key ? 1 : 0
  })
  return groups
}
