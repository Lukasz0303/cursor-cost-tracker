import {
  clampRecentQueryCount,
  DEFAULT_CURSOR_COST_CONFIG,
  DEFAULT_OK_COLOR,
  DEFAULT_RECENT_QUERY_COUNT,
  DEFAULT_WARN_COLOR,
} from '../config'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
} from '../historyLimit'
import { formatDateTime, formatDollars, formatKind, formatTokens } from '../format'
import {
  DEFAULT_CRITICAL_COST_USD_THRESHOLD,
  DEFAULT_CRITICAL_TOKEN_THRESHOLD,
} from '../spikes/criticalAlert'
import { DEFAULT_SPIKE_TOKEN_THRESHOLD, isSpike } from '../spikes/threshold'
import { stripModelPrefix } from '../usage/parse'
import type { UsageQuery, UsageSnapshot } from '../usage/types'
import { toPeriodStats, type PeriodStatsPayload } from './periodStats'
import { toChartSeries, type ChartPoint } from './chartSeries'
import { toPeriodCards, type PeriodCard } from './periodCards'
import { toMtdPace, type MtdPacePayload } from './mtdPace'
import {
  toStatusBarPreviewChips,
  type StatusBarPreviewChip,
} from './statusBarView'

export const HISTORY_ROW_KEYS = [
  'time',
  'model',
  'cost',
  'tokens',
  'inputOutput',
  'kind',
  'spike',
] as const

export type HistoryRow = {
  time: string
  model: string
  cost: string
  tokens: string
  inputOutput: string
  kind: string
  spike: boolean
}

export type HistoryRowOptions = {
  spikeTokenThreshold: number
  showSpikeWarning: boolean
  showCriticalAlert?: boolean
  criticalTokenThreshold?: number
  criticalCostUsdThreshold?: number
  okColor?: string
  warnColor?: string
  extensionVersion?: string
  historyLimit?: number
  refreshing?: boolean
  pollIntervalMinutes?: number
  showStatusBar?: boolean
  showToday?: boolean
  minimalMode?: boolean
  recentQueryCount?: number
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
    const spike =
      options !== undefined &&
      options.showSpikeWarning &&
      isSpike(query.tokens, options.spikeTokenThreshold)
    return {
      time: formatDateTime(query.timestamp),
      model: model === null || model === '' ? '—' : model,
      cost: formatDollars(query.costUsd),
      tokens: spike ? `! ${tokens}` : tokens,
      inputOutput: `${formatTokens(query.inputTokens)} / ${formatTokens(query.outputTokens)}`,
      kind: formatKind(query.kind),
      spike,
    }
  })
}

export function visibleHistoryRows(
  rows: HistoryRow[],
  spikesOnly: boolean,
): HistoryRow[] {
  if (!spikesOnly) {
    return rows
  }
  return rows.filter((row) => row.spike)
}

export type HistoryDataPayload = {
  type: 'data'
  events: HistoryRow[]
  message?: string
  spikeTokenThreshold: number
  showSpikeWarning: boolean
  showCriticalAlert: boolean
  criticalTokenThreshold: number
  criticalCostUsdThreshold: number
  okColor: string
  warnColor: string
  extensionVersion: string
  historyLimit: number
  pollIntervalMinutes: number
  showStatusBar: boolean
  showToday: boolean
  minimalMode: boolean
  recentQueryCount: number
  statusBarPreview: StatusBarPreviewChip[]
  stats: PeriodStatsPayload
  charts: ChartPoint[]
  periods: PeriodCard[]
  mtd: MtdPacePayload
  refreshing: boolean
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
  const showCriticalAlert = options?.showCriticalAlert !== false
  const criticalTokenThreshold =
    options?.criticalTokenThreshold ?? DEFAULT_CRITICAL_TOKEN_THRESHOLD
  const criticalCostUsdThreshold =
    options?.criticalCostUsdThreshold ?? DEFAULT_CRITICAL_COST_USD_THRESHOLD
  const historyLimit = clampHistoryLimit(
    options?.historyLimit ?? DEFAULT_HISTORY_LIMIT,
  )
  const pollIntervalMinutes =
    options?.pollIntervalMinutes ??
    DEFAULT_CURSOR_COST_CONFIG.pollIntervalMinutes
  const showStatusBar = options?.showStatusBar !== false
  const showToday = options?.showToday !== false
  const minimalMode = options?.minimalMode === true
  const recentQueryCount = clampRecentQueryCount(
    options?.recentQueryCount ?? DEFAULT_RECENT_QUERY_COUNT,
  )
  const rowOptions: HistoryRowOptions = {
    spikeTokenThreshold,
    showSpikeWarning,
    showCriticalAlert,
    criticalTokenThreshold,
    criticalCostUsdThreshold,
    historyLimit,
    okColor: options?.okColor ?? DEFAULT_OK_COLOR,
    warnColor: options?.warnColor ?? DEFAULT_WARN_COLOR,
    extensionVersion: options?.extensionVersion ?? '0.0.0',
    pollIntervalMinutes,
    showStatusBar,
    showToday,
    minimalMode,
    recentQueryCount,
  }
  const payload: HistoryDataPayload = {
    type: 'data',
    events: toHistoryRows(queries, rowOptions),
    spikeTokenThreshold,
    showSpikeWarning,
    showCriticalAlert,
    criticalTokenThreshold,
    criticalCostUsdThreshold,
    okColor: rowOptions.okColor ?? DEFAULT_OK_COLOR,
    warnColor: rowOptions.warnColor ?? DEFAULT_WARN_COLOR,
    extensionVersion: rowOptions.extensionVersion ?? '0.0.0',
    historyLimit,
    pollIntervalMinutes,
    showStatusBar,
    showToday,
    minimalMode,
    recentQueryCount,
    statusBarPreview: toStatusBarPreviewChips({
      ...DEFAULT_CURSOR_COST_CONFIG,
      spikeTokenThreshold,
      showSpikeWarning,
      showStatusBar,
      showToday,
      minimalMode,
      recentQueryCount,
    }),
    stats: toPeriodStats(snapshot, queries, {
      spikeTokenThreshold,
      historyLimit,
    }),
    charts: toChartSeries(queries, historyLimit),
    periods: toPeriodCards(queries, { historyLimit }),
    mtd: toMtdPace(snapshot, queries, { historyLimit }),
    refreshing: options?.refreshing === true,
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
