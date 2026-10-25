import {
  cacheBand,
  conversationSlice,
  gradeBucket,
  kindSliceLabel,
  limitSlice,
  modelSliceLabel,
  OTHER_SLICE_ID,
  OTHER_SLICE_LABEL,
  sizeBand,
  vendorLabel,
} from './classify'
import type { SpendMixCatalogModel } from './classify'
import { DEFAULT_SPIKE_TOKEN_THRESHOLD } from '../spikes/threshold'
import { emptyOptimizedTargets, type OptimizedTargets } from '../ui/optimizedTargets'
import { resolveSpendMixBuckets } from './schema'
import type { SpendMixBucket } from './schema'

export type SpendMixDimension =
  | 'model'
  | 'kind'
  | 'limit'
  | 'conversation'
  | 'vendor'
  | 'grade'
  | 'size'
  | 'cache'

export type SpendMixRow = {
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
}

export type SpendMixSlice = {
  id: string
  label: string
  costUsd: number
  /** Billed queries in this slice. A $0 row is not counted. */
  queryCount: number
  /** Fraction of billed dollars in this sample, from 0 to 1. */
  share: number
}

export type SpendMixFacts = {
  /** Rows in the loaded sample, including $0. */
  queryCount: number
  /** Rows with a positive billed amount. */
  billedQueryCount: number
  /** Distinct conversation ids in the sample. Rows without one are not counted. */
  conversationCount: number
  /** Oldest and newest query timestamps in the sample. Null when a row has no time. */
  fromMs: number | null
  toMs: number | null
}

export type SpendMixAggregate = {
  dimension: SpendMixDimension
  totalUsd: number
  /** No billed dollars in the sample, so there is no pie. */
  empty: boolean
  slices: SpendMixSlice[]
}

export type SpendMixAggregateOptions = {
  catalog: readonly SpendMixCatalogModel[]
  buckets: readonly SpendMixBucket[]
  titles?: Readonly<Record<string, string>>
  spikeTokenThreshold?: number
  optimizedTargets?: OptimizedTargets
}

type Accumulator = {
  id: string
  label: string
  costUsd: number
  queryCount: number
}

/** Largest chats stay visible. The tail folds into Other even above 1%. */
const CONVERSATION_KEEP = 6

function sliceId(label: string): string {
  const id = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return id === '' ? OTHER_SLICE_ID : id
}

function classify(
  row: SpendMixRow,
  dimension: SpendMixDimension,
  options: SpendMixAggregateOptions,
): Accumulator {
    if (dimension === 'grade') {
    const grade = gradeBucket(row.model, options.buckets)
    return { id: grade.id, label: grade.label, costUsd: 0, queryCount: 0 }
  }
  if (dimension === 'model') {
    const label = modelSliceLabel(row.model)
    return { id: sliceId(label), label, costUsd: 0, queryCount: 0 }
  }
  if (dimension === 'kind') {
    const label = kindSliceLabel(row.kind, row.conversationId, options.titles ?? {})
    return { id: sliceId(label), label, costUsd: 0, queryCount: 0 }
  }
  if (dimension === 'limit') {
    const band = limitSlice(
      row,
      options.spikeTokenThreshold ?? DEFAULT_SPIKE_TOKEN_THRESHOLD,
      options.optimizedTargets ?? emptyOptimizedTargets(),
    )
    return { id: band.id, label: band.label, costUsd: 0, queryCount: 0 }
  }
  if (dimension === 'size') {
    const band = sizeBand(row.tokens ?? 0)
    return { id: band.id, label: band.label, costUsd: 0, queryCount: 0 }
  }
  if (dimension === 'cache') {
    const band = cacheBand(row)
    return { id: band.id, label: band.label, costUsd: 0, queryCount: 0 }
  }
  if (dimension === 'conversation') {
    const chat = conversationSlice(row.conversationId, options.titles ?? {})
    return { id: chat.id, label: chat.label, costUsd: 0, queryCount: 0 }
  }
  const label = vendorLabel(row.model, options.catalog)
  return { id: sliceId(label), label, costUsd: 0, queryCount: 0 }
}

function mergeByLabel(slices: readonly Accumulator[]): Accumulator[] {
  const merged = new Map<string, Accumulator>()
  for (const slice of slices) {
    const existing = merged.get(slice.label)
    if (existing === undefined) {
      merged.set(slice.label, { ...slice })
      continue
    }
    existing.costUsd += slice.costUsd
    existing.queryCount += slice.queryCount
    if (existing.id === OTHER_SLICE_ID && slice.id !== OTHER_SLICE_ID) {
      existing.id = slice.id
    }
  }
  return [...merged.values()]
}

function combineOther(existing: Accumulator | null, slice: Accumulator): Accumulator {
  if (existing === null) {
    return { ...slice }
  }
  return {
    id: existing.id === OTHER_SLICE_ID ? slice.id : existing.id,
    label: OTHER_SLICE_LABEL,
    costUsd: existing.costUsd + slice.costUsd,
    queryCount: existing.queryCount + slice.queryCount,
  }
}

function capConversations(slices: readonly Accumulator[]): Accumulator[] {
  const merged = mergeByLabel(slices)
  if (merged.length <= CONVERSATION_KEEP) {
    return merged
  }
  const sorted = [...merged].sort(
    (left, right) => right.costUsd - left.costUsd || left.label.localeCompare(right.label),
  )
  const kept = sorted.slice(0, CONVERSATION_KEEP)
  let other: Accumulator | null = null
  for (const slice of sorted.slice(CONVERSATION_KEEP)) {
    other = combineOther(other, {
      id: OTHER_SLICE_ID,
      label: OTHER_SLICE_LABEL,
      costUsd: slice.costUsd,
      queryCount: slice.queryCount,
    })
  }
  if (other !== null && other.costUsd > 0) {
    kept.push(other)
  }
  return kept
}

/** Slices under 1% fold into Other. An existing Other slice merges by label. */
function collapseSmallSlices(slices: readonly Accumulator[], total: number): Accumulator[] {
  let other: Accumulator | null = null
  const kept: Accumulator[] = []
  for (const slice of mergeByLabel(slices)) {
    if (slice.label === OTHER_SLICE_LABEL) {
      other = combineOther(other, slice)
      continue
    }
    if (slice.costUsd * 100 < total) {
      other = combineOther(other, {
        id: OTHER_SLICE_ID,
        label: OTHER_SLICE_LABEL,
        costUsd: slice.costUsd,
        queryCount: slice.queryCount,
      })
      continue
    }
    kept.push(slice)
  }
  if (other !== null && other.costUsd > 0) {
    kept.push(other)
  }
  return kept
}

/**
 * Billed `costUsd` only. A $0 row does not open or grow a slice.
 * A zero total is an empty pie, not a token chart.
 */
export function aggregateSpendMix(
  rows: readonly SpendMixRow[],
  dimension: SpendMixDimension,
  options: SpendMixAggregateOptions,
): SpendMixAggregate {
  const grouped = new Map<string, Accumulator>()
  let totalUsd = 0
  for (const row of rows) {
    if (!Number.isFinite(row.costUsd) || row.costUsd < 0) {
      continue
    }
    // Kind keeps a $0 row so Free Credit still appears. It does not add dollars.
    if (row.costUsd === 0 && dimension !== 'kind' && dimension !== 'limit') {
      continue
    }
    if (row.costUsd > 0) {
      totalUsd += row.costUsd
    }
    const key = classify(row, dimension, options)
    const groupKey = `${key.id}\0${key.label}`
    const existing = grouped.get(groupKey)
    if (existing === undefined) {
      grouped.set(groupKey, { ...key, costUsd: row.costUsd, queryCount: 1 })
      continue
    }
    existing.costUsd += row.costUsd
    existing.queryCount += 1
  }
  if (totalUsd <= 0 && grouped.size === 0) {
    return { dimension, totalUsd: 0, empty: true, slices: [] }
  }
  const prepared =
    dimension === 'conversation'
      ? capConversations([...grouped.values()])
      : dimension === 'kind' || dimension === 'limit'
        ? mergeByLabel([...grouped.values()])
        : collapseSmallSlices([...grouped.values()], totalUsd)
  const slices = prepared
    .map((slice) => ({
      id: slice.id,
      label: slice.label,
      costUsd: slice.costUsd,
      queryCount: slice.queryCount,
      share: totalUsd > 0 ? slice.costUsd / totalUsd : 0,
    }))
    .sort((left, right) => right.costUsd - left.costUsd || left.label.localeCompare(right.label))
  return { dimension, totalUsd, empty: false, slices }
}

export type SpendMixSaved = {
  /** Credited Optimize total, dollars. */
  usd: number
  /** Credited Optimize total, tokens. */
  tokens: number
}

export type SpendMixProject = {
  id: string
  label: string
  facts: SpendMixFacts
  saved: SpendMixSaved
  model: SpendMixSlice[]
  kind: SpendMixSlice[]
  limit: SpendMixSlice[]
  conversation: SpendMixSlice[]
  vendor: SpendMixSlice[]
  grade: SpendMixSlice[]
  size: SpendMixSlice[]
  cache: SpendMixSlice[]
}

export type SpendMixView = {
  raw: string
  error: string | null
  empty: boolean
  facts: SpendMixFacts
  saved: SpendMixSaved
  /** Folder names joined from the composer workspace. Absent rows stay in All. */
  projects: SpendMixProject[]
  model: SpendMixSlice[]
  kind: SpendMixSlice[]
  limit: SpendMixSlice[]
  conversation: SpendMixSlice[]
  vendor: SpendMixSlice[]
  grade: SpendMixSlice[]
  size: SpendMixSlice[]
  cache: SpendMixSlice[]
}

const VIEW_DIMENSIONS: readonly SpendMixDimension[] = [
  'model',
  'kind',
  'limit',
  'conversation',
  'vendor',
  'grade',
  'size',
  'cache',
]

export function spendMixFacts(rows: readonly SpendMixRow[]): SpendMixFacts {
  let billedQueryCount = 0
  let fromMs: number | null = null
  let toMs: number | null = null
  const conversations = new Set<string>()
  for (const row of rows) {
    if (Number.isFinite(row.costUsd) && row.costUsd > 0) {
      billedQueryCount += 1
    }
    if (typeof row.timestamp === 'number' && Number.isFinite(row.timestamp)) {
      fromMs = fromMs === null ? row.timestamp : Math.min(fromMs, row.timestamp)
      toMs = toMs === null ? row.timestamp : Math.max(toMs, row.timestamp)
    }
    const id = row.conversationId?.trim() ?? ''
    if (id !== '') {
      conversations.add(id)
    }
  }
  return {
    queryCount: rows.length,
    billedQueryCount,
    conversationCount: conversations.size,
    fromMs,
    toMs,
  }
}

function mixDimensions(
  rows: readonly SpendMixRow[],
  options: SpendMixAggregateOptions,
): { empty: boolean } & Record<SpendMixDimension, SpendMixSlice[]> {
  const slices = {} as Record<SpendMixDimension, SpendMixSlice[]>
  let empty = true
  for (const dimension of VIEW_DIMENSIONS) {
    const aggregate = aggregateSpendMix(rows, dimension, options)
    slices[dimension] = aggregate.slices
    empty = aggregate.empty
  }
  return { empty, ...slices }
}

function projectMixes(
  rows: readonly SpendMixRow[],
  options: SpendMixAggregateOptions,
  projects: Readonly<Record<string, string>>,
  savedProjects: readonly { label: string; usd: number; tokens: number }[],
): SpendMixProject[] {
  const grouped = new Map<string, SpendMixRow[]>()
  for (const row of rows) {
    const id = row.conversationId?.trim() ?? ''
    const label = id === '' ? '' : (projects[id]?.trim() ?? '')
    if (label === '') {
      continue
    }
    const bucket = grouped.get(label)
    if (bucket === undefined) {
      grouped.set(label, [row])
      continue
    }
    bucket.push(row)
  }
  return [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([label, bucket]) => {
      const built = mixDimensions(bucket, options)
      return {
        id: label,
        label,
        facts: spendMixFacts(bucket),
        saved: savedForProject(label, savedProjects),
        model: built.model,
        kind: built.kind,
        limit: built.limit,
        conversation: built.conversation,
        vendor: built.vendor,
        grade: built.grade,
        size: built.size,
        cache: built.cache,
      }
    })
}

function savedForProject(
  label: string,
  savedProjects: readonly { label: string; usd: number; tokens: number }[],
): SpendMixSaved {
  let usd = 0
  let tokens = 0
  const key = label.trim().toLowerCase()
  for (const project of savedProjects) {
    if (project.label.trim().toLowerCase() !== key) {
      continue
    }
    usd += finiteSaved(project.usd)
    tokens += finiteSaved(project.tokens)
  }
  return { usd, tokens }
}

function finiteSaved(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/** Every chip for one sample. Invalid JSON keeps the built-in grade buckets. */
export function spendMixView(
  rows: readonly SpendMixRow[],
  raw: string,
  catalog: readonly SpendMixCatalogModel[],
  titles: Readonly<Record<string, string>> = {},
  limit: {
    spikeTokenThreshold?: number
    optimizedTargets?: OptimizedTargets
    savedUsd?: number
    savedTokens?: number
    savedProjects?: readonly { label: string; usd: number; tokens: number }[]
    /** Conversation id → workspace folder name. */
    projects?: Readonly<Record<string, string>>
  } = {},
): SpendMixView {
  const resolved = resolveSpendMixBuckets(raw)
  const options = {
    catalog,
    buckets: resolved.buckets,
    titles,
    spikeTokenThreshold: limit.spikeTokenThreshold,
    optimizedTargets: limit.optimizedTargets,
  }
  const built = mixDimensions(rows, options)
  const savedProjects = limit.savedProjects ?? []
  return {
    raw,
    error: resolved.error,
    empty: built.empty,
    facts: spendMixFacts(rows),
    saved: {
      usd: finiteSaved(limit.savedUsd),
      tokens: finiteSaved(limit.savedTokens),
    },
    projects: projectMixes(rows, options, limit.projects ?? {}, savedProjects),
    model: built.model,
    kind: built.kind,
    limit: built.limit,
    conversation: built.conversation,
    vendor: built.vendor,
    grade: built.grade,
    size: built.size,
    cache: built.cache,
  }
}
