import { DEFAULT_OK_COLOR, DEFAULT_WARN_COLOR } from '../config'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
} from '../historyLimit'
import { formatDateTime, formatDollars, formatKind, formatTokens } from '../format'
import { DEFAULT_SPIKE_TOKEN_THRESHOLD, isSpike } from '../spikes/threshold'
import { stripModelPrefix } from '../usage/parse'
import type { UsageQuery, UsageSnapshot } from '../usage/types'
import { toPeriodStats, type PeriodStatsPayload } from './periodStats'
import { toChartSeries, type ChartPoint } from './chartSeries'

export const HISTORY_ROW_KEYS = [
  'time',
  'model',
  'cost',
  'tokens',
  'inputOutput',
  'kind',
] as const

export type HistoryRow = {
  time: string
  model: string
  cost: string
  tokens: string
  inputOutput: string
  kind: string
}

export type HistoryRowOptions = {
  spikeTokenThreshold: number
  showSpikeWarning: boolean
  okColor?: string
  warnColor?: string
  extensionVersion?: string
  historyLimit?: number
}

export function toHistoryRows(
  queries: UsageQuery[],
  options?: HistoryRowOptions,
): HistoryRow[] {
  const limit = clampHistoryLimit(
    options?.historyLimit ?? DEFAULT_HISTORY_LIMIT,
  )
  const sorted = [...queries].sort((a, b) => b.timestamp - a.timestamp)
  return sorted.slice(0, limit).map((query) => {
    const model = stripModelPrefix(query.model)
    const tokens = formatTokens(query.tokens)
    const bang =
      options !== undefined &&
      options.showSpikeWarning &&
      isSpike(query.tokens, options.spikeTokenThreshold)
    return {
      time: formatDateTime(query.timestamp),
      model: model === null || model === '' ? '—' : model,
      cost: formatDollars(query.costUsd),
      tokens: bang ? `! ${tokens}` : tokens,
      inputOutput: `${formatTokens(query.inputTokens)} / ${formatTokens(query.outputTokens)}`,
      kind: formatKind(query.kind),
    }
  })
}

export type HistoryDataPayload = {
  type: 'data'
  events: HistoryRow[]
  message?: string
  spikeTokenThreshold: number
  showSpikeWarning: boolean
  okColor: string
  warnColor: string
  extensionVersion: string
  historyLimit: number
  stats: PeriodStatsPayload
  charts: ChartPoint[]
}

export function historyDataPayload(
  queries: UsageQuery[],
  message?: string,
  options?: HistoryRowOptions,
  snapshot: UsageSnapshot = { status: 'loading' },
): HistoryDataPayload {
  const spikeTokenThreshold =
    options?.spikeTokenThreshold ?? DEFAULT_SPIKE_TOKEN_THRESHOLD
  const showSpikeWarning = options?.showSpikeWarning !== false
  const historyLimit = clampHistoryLimit(
    options?.historyLimit ?? DEFAULT_HISTORY_LIMIT,
  )
  const rowOptions: HistoryRowOptions = {
    spikeTokenThreshold,
    showSpikeWarning,
    historyLimit,
    okColor: options?.okColor ?? DEFAULT_OK_COLOR,
    warnColor: options?.warnColor ?? DEFAULT_WARN_COLOR,
    extensionVersion: options?.extensionVersion ?? '0.0.0',
  }
  const payload: HistoryDataPayload = {
    type: 'data',
    events: toHistoryRows(queries, rowOptions),
    spikeTokenThreshold,
    showSpikeWarning,
    okColor: rowOptions.okColor ?? DEFAULT_OK_COLOR,
    warnColor: rowOptions.warnColor ?? DEFAULT_WARN_COLOR,
    extensionVersion: rowOptions.extensionVersion ?? '0.0.0',
    historyLimit,
    stats: toPeriodStats(snapshot, queries, {
      spikeTokenThreshold,
      historyLimit,
    }),
    charts: toChartSeries(queries, historyLimit),
  }
  if (message !== undefined && message !== '') {
    payload.message = message
  }
  return payload
}

export function payloadForSnapshot(
  snapshot: UsageSnapshot,
  queries: UsageQuery[],
  options?: HistoryRowOptions,
): HistoryDataPayload {
  if (queries.length > 0) {
    return historyDataPayload(queries, undefined, options, snapshot)
  }
  if (snapshot.status === 'error') {
    return historyDataPayload(queries, snapshot.message, options, snapshot)
  }
  if (snapshot.status === 'loading') {
    return historyDataPayload(queries, 'Loading usage…', options, snapshot)
  }
  return historyDataPayload(queries, undefined, options, snapshot)
}
