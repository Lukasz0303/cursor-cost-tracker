import { formatDateTime, formatTokens } from '../format'
import { isGeneratedThreadTitle } from './ids'
import { codexContextMeter } from './pricing/listPrices'
import type { BillingMode } from './domain'
import {
  formatCodexMoney,
  formatKindLabel,
  missingRateLabel,
  tokensIoLabel,
  type CodexCostBasis,
  type CodexCostKind,
  type CodexRow,
} from './historyRows'

export type GroupAggregate = {
  provider: string
  accountScopeKey: string
  conversationId: string
  title: string
  turnCount: number | null
  requestCount: number
  firstObservedAt: string
  lastObservedAt: string
  modelCount: number
  singleModel: string | null
  billingModeCount: number
  singleBillingMode: BillingMode | null
  inputTokens: number | null
  cachedInputTokens: number | null
  outputTokens: number | null
  reasoningOutputTokens: number | null
  totalTokens: number | null
  priced: number
  pricedDenom: number
  missingUsage: number
  costSum: string | null
  /** Input tokens on the newest request, not the conversation sum. */
  contextInputTokens: number | null
  contextModel: string | null
  /** `model_context_window` on that same newest request. */
  contextWindowTokens: number | null
  /** Largest single request, not the conversation sum. */
  maxRequestTokens: number | null
}

function formatRangeInstant(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) {
    return ''
  }
  const d = new Date(ms)
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'short' })
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month} ${hours}:${minutes}`
}

function shortRange(fromIso: string, toIso: string): string {
  const a = formatRangeInstant(fromIso)
  const b = formatRangeInstant(toIso)
  if (a === '' || b === '') {
    return ''
  }
  return `${a} → ${b}`
}

function sumCount(left: number | null, right: number | null): number | null {
  if (left === null && right === null) {
    return null
  }
  return (left ?? 0) + (right ?? 0)
}

function earlierIso(left: string, right: string): string {
  if (left === '') {
    return right
  }
  if (right === '') {
    return left
  }
  return left < right ? left : right
}

function laterIso(left: string, right: string): string {
  return left > right ? left : right
}

/** Local clock hour of an ISO timestamp, `YYYY-MM-DDTHH`. */
export function localHourKey(iso: string): string | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) {
    return null
  }
  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}T${hour}`
}

/** `25.10.2026, 01:00–02:00` in local time. */
export function hourRangeTitle(hourKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/.exec(hourKey)
  if (match === null) {
    return hourKey
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const start = new Date(year, month - 1, day, hour, 0, 0, 0)
  const end = new Date(year, month - 1, day, hour + 1, 0, 0, 0)
  const startDate = `${start.getDate()}.${String(start.getMonth() + 1).padStart(2, '0')}.${start.getFullYear()}`
  const startHour = String(start.getHours()).padStart(2, '0')
  const endHour = String(end.getHours()).padStart(2, '0')
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  if (sameDay) {
    return `${startDate}, ${startHour}:00–${endHour}:00`
  }
  const endDate = `${end.getDate()}.${String(end.getMonth() + 1).padStart(2, '0')}.${end.getFullYear()}`
  return `${startDate}, ${startHour}:00–${endDate}, ${endHour}:00`
}

export function isUntitledConversation(title: string, conversationId: string): boolean {
  const trimmed = title.trim()
  if (trimmed === '') {
    return true
  }
  return isGeneratedThreadTitle(trimmed, conversationId)
}

/** Member ids of an hour bucket, or null when this is a normal conversation id. */
export function hourBucketMembers(conversationId: string): string[] | null {
  if (!conversationId.startsWith('hour:')) {
    return null
  }
  const members = conversationId.split('|').slice(1).filter((id) => id.length > 0)
  return members
}

function untitledHour(group: GroupAggregate): string | null {
  if (!isUntitledConversation(group.title, group.conversationId)) {
    return null
  }
  return localHourKey(group.lastObservedAt)
}

function mergeModels(
  left: GroupAggregate,
  right: GroupAggregate,
): { modelCount: number; singleModel: string | null } {
  const names = new Set<string>()
  let opaque = false
  for (const group of [left, right]) {
    const single = group.singleModel?.trim() ?? ''
    if (group.modelCount > 1 || (group.modelCount === 1 && single === '')) {
      opaque = true
    }
    if (single !== '' && group.modelCount <= 1) {
      names.add(single)
    }
  }
  if (opaque) {
    return {
      modelCount: Math.max(2, left.modelCount + right.modelCount),
      singleModel: null,
    }
  }
  if (names.size <= 1) {
    const only = [...names][0] ?? null
    return { modelCount: names.size, singleModel: only }
  }
  return { modelCount: names.size, singleModel: null }
}

function mergeModes(
  left: GroupAggregate,
  right: GroupAggregate,
): { billingModeCount: number; singleBillingMode: BillingMode | null } {
  const modes = new Set<BillingMode>()
  let opaque = false
  for (const group of [left, right]) {
    if (group.billingModeCount > 1 || group.singleBillingMode === null) {
      opaque = true
    }
    if (group.singleBillingMode !== null && group.billingModeCount <= 1) {
      modes.add(group.singleBillingMode)
    }
  }
  if (opaque || modes.size > 1) {
    return {
      billingModeCount: Math.max(2, modes.size, left.billingModeCount, right.billingModeCount),
      singleBillingMode: null,
    }
  }
  const only = [...modes][0] ?? null
  return { billingModeCount: modes.size, singleBillingMode: only }
}

function withHourIdentity(group: GroupAggregate, hour: string, memberIds: string[]): GroupAggregate {
  const unique = [...new Set(memberIds)].sort()
  return {
    ...group,
    title: hourRangeTitle(hour),
    conversationId: `hour:${hour}|${unique.join('|')}`,
  }
}

function mergeHourGroups(
  left: GroupAggregate,
  right: GroupAggregate,
  hour: string,
): GroupAggregate {
  const newer = laterIso(left.lastObservedAt, right.lastObservedAt) === right.lastObservedAt
    ? right
    : left
  const models = mergeModels(left, right)
  const modes = mergeModes(left, right)
  const members = [
    ...(hourBucketMembers(left.conversationId) ?? [left.conversationId]),
    right.conversationId,
  ]
  return withHourIdentity(
    {
      ...left,
      turnCount: sumCount(left.turnCount, right.turnCount),
      requestCount: left.requestCount + right.requestCount,
      firstObservedAt: earlierIso(left.firstObservedAt, right.firstObservedAt),
      lastObservedAt: laterIso(left.lastObservedAt, right.lastObservedAt),
      modelCount: models.modelCount,
      singleModel: models.singleModel,
      billingModeCount: modes.billingModeCount,
      singleBillingMode: modes.singleBillingMode,
      inputTokens: sumCount(left.inputTokens, right.inputTokens),
      cachedInputTokens: sumCount(left.cachedInputTokens, right.cachedInputTokens),
      outputTokens: sumCount(left.outputTokens, right.outputTokens),
      reasoningOutputTokens: sumCount(left.reasoningOutputTokens, right.reasoningOutputTokens),
      totalTokens: sumCount(left.totalTokens, right.totalTokens),
      priced: left.priced + right.priced,
      pricedDenom: left.pricedDenom + right.pricedDenom,
      missingUsage: left.missingUsage + right.missingUsage,
      costSum: addMoney([left.costSum, right.costSum]),
      contextInputTokens: newer.contextInputTokens,
      contextModel: newer.contextModel,
      contextWindowTokens: newer.contextWindowTokens,
      maxRequestTokens:
        left.maxRequestTokens === null
          ? right.maxRequestTokens
          : right.maxRequestTokens === null
            ? left.maxRequestTokens
            : Math.max(left.maxRequestTokens, right.maxRequestTokens),
    },
    hour,
    members,
  )
}

/**
 * Untitled threads (`#01a17025`) that end in the same local hour become one
 * row. The title is that hour. Named chats stay on their own row.
 */
export function foldUntitledHourGroups<T extends GroupAggregate>(groups: readonly T[]): T[] {
  const named: T[] = []
  const buckets = new Map<string, T>()
  for (const group of groups) {
    const hour = untitledHour(group)
    if (hour === null) {
      named.push(group)
      continue
    }
    const bucketKey = `${group.provider}\0${group.accountScopeKey}\0${hour}`
    const existing = buckets.get(bucketKey)
    if (existing === undefined) {
      buckets.set(bucketKey, {
        ...group,
        ...withHourIdentity(group, hour, [group.conversationId]),
      })
      continue
    }
    buckets.set(bucketKey, {
      ...existing,
      ...mergeHourGroups(existing, group, hour),
    })
  }
  return [...named, ...buckets.values()]
}

function timeTitleForGroup(turnCount: number | null, requestCount: number): string {
  const parts: string[] = []
  if (turnCount !== null) {
    parts.push(`${turnCount} turn${turnCount === 1 ? '' : 's'}`)
  }
  if (requestCount > 0) {
    parts.push(`${requestCount} model request${requestCount === 1 ? '' : 's'}`)
  }
  return parts.join(' · ')
}

export function mapGroupRow(
  group: GroupAggregate,
  options: {
    costBasis: CodexCostBasis
    spikeTokenThreshold: number
    showSpike: boolean
  },
): CodexRow {
  const modelLabel =
    group.modelCount <= 1
      ? group.singleModel && group.singleModel.trim() !== ''
        ? group.singleModel
        : 'Unknown'
      : `Mixed (${group.modelCount})`

  const cli =
    group.conversationId.startsWith('hour:') ||
    isUntitledConversation(group.title, group.conversationId)
  const kindLabel = cli
    ? 'CLI'
    : group.billingModeCount <= 1
      ? formatKindLabel(group.singleBillingMode ?? 'unknown')
      : 'Mixed'

  const modelForRate =
    group.modelCount <= 1 &&
    group.singleModel !== null &&
    group.singleModel.trim() !== ''
      ? group.singleModel
      : null
  let costKind: CodexCostKind = 'empty'
  let missingModel: string | null = null
  let costLabel = formatCodexMoney(group.costSum, options.costBasis)
  if (group.priced === 0 && group.pricedDenom > 0) {
    costKind = 'missing-rate'
    missingModel = modelForRate
    costLabel = missingRateLabel(modelForRate)
  } else if (group.priced < group.pricedDenom && group.pricedDenom > 0) {
    costKind = 'partial'
    costLabel = `${group.priced}/${group.pricedDenom} priced`
  } else if (group.priced > 0) {
    costKind = 'amount'
  } else {
    costLabel = '—'
  }

  const io = tokensIoLabel(group.inputTokens, group.outputTokens)
  const partial =
    group.missingUsage > 0 ? `${io.inputOutputLabel} partial` : io.inputOutputLabel

  const context = codexContextMeter(
    group.contextModel,
    group.contextInputTokens,
    group.contextWindowTokens,
  )
  const spike =
    options.showSpike &&
    group.maxRequestTokens !== null &&
    group.maxRequestTokens >= options.spikeTokenThreshold

  const title =
    group.title.trim() !== ''
      ? group.title
      : `#${group.conversationId.slice(0, 8)}`
  const lastMs = Date.parse(group.lastObservedAt)
  const whenLabel = Number.isFinite(lastMs)
    ? formatDateTime(lastMs)
    : group.lastObservedAt

  return {
    rowKind: 'group',
    id: `${group.provider}\0${group.accountScopeKey}\0${group.conversationId}`,
    timeLabel: title,
    timeTitle: timeTitleForGroup(group.turnCount, group.requestCount),
    rangeLabel: shortRange(group.firstObservedAt, group.lastObservedAt),
    whenLabel,
    requestCount: group.requestCount,
    modelLabel,
    modelTitle: '',
    costLabel,
    costKind,
    missingModel,
    tokensLabel: spike ? `! ${io.tokensLabel}` : io.tokensLabel,
    spike,
    inputLabel: group.inputTokens === null ? '—' : formatTokens(group.inputTokens),
    cachedLabel:
      group.cachedInputTokens === null ? '—' : formatTokens(group.cachedInputTokens),
    outputLabel: group.outputTokens === null ? '—' : formatTokens(group.outputTokens),
    reasoningLabel:
      group.reasoningOutputTokens === null
        ? '—'
        : formatTokens(group.reasoningOutputTokens),
    inputOutputLabel: partial,
    inputOutputTitle: '',
    kindLabel,
    cli,
    conversationId: group.conversationId,
    accountScopeKey: group.accountScopeKey,
    inputTokens: group.inputTokens,
    cachedInputTokens: group.cachedInputTokens,
    outputTokens: group.outputTokens,
    reasoningOutputTokens: group.reasoningOutputTokens,
    contextLevel: context.level,
    contextPercent: context.percent,
    contextWindowLabel: context.windowLabel,
  }
}

/** Stable decimal sum for money columns. */
export function addMoney(values: readonly (string | null)[]): string | null {
  let sum = 0
  let any = false
  for (const value of values) {
    if (value === null || value.trim() === '') {
      continue
    }
    const n = Number(value)
    if (!Number.isFinite(n)) {
      continue
    }
    sum += n
    any = true
  }
  if (!any) {
    return null
  }
  return sum.toFixed(6)
}
