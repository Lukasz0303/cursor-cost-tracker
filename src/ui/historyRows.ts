import {
  clampRecentQueryCount,
  DEFAULT_BUDGET_DAY_BASIS,
  DEFAULT_CURSOR_COST_CONFIG,
  DEFAULT_OK_COLOR,
  DEFAULT_OPTIMIZE_DEPTH,
  DEFAULT_RECENT_QUERY_COUNT,
  DEFAULT_WARN_COLOR,
  type BudgetDayBasis,
  type OptimizeDepth,
} from '../config'
import { catalogFor } from '../i18n'
import { DEFAULT_LOCALE, parseLocale, type Locale } from '../locale'
import { parseHistoryFromDate } from '../historyFromDate'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
  sampleSizeLimit,
} from '../historyLimit'
import { formatDateTime, formatDollars, formatKind, formatTokens } from '../format'
import {
  DEFAULT_CRITICAL_COST_USD_THRESHOLD,
  DEFAULT_CRITICAL_TOKEN_THRESHOLD,
} from '../spikes/criticalAlert'
import { DEFAULT_SPIKE_TOKEN_THRESHOLD, isSpike } from '../spikes/threshold'
import {
  DEFAULT_BURN_RATE_CRITICAL_USD,
  DEFAULT_BURN_RATE_MIN_QUERIES,
  DEFAULT_BURN_RATE_WARNING_USD,
  DEFAULT_BURN_RATE_WINDOW_MINUTES,
  evaluateBurnRate,
} from '../burnRate/detect'
import { toBurnRatePayload, type BurnRatePayload } from '../burnRate/copy'
import { queryInLiveWindow } from '../burnRate/window'
import { applyBudgetDayBasis, stripModelPrefix } from '../usage/parse'
import type { UsageQuery, UsageSnapshot } from '../usage/types'
import { toPeriodStats, type PeriodStatsPayload } from './periodStats'
import { toChartSeries, type ChartPoint } from './chartSeries'
import { toPeriodCards, type PeriodCard } from './periodCards'
import { toMtdPace, type MtdPacePayload } from './mtdPace'
import {
  toOptimizePayload,
  type OptimizePayload,
} from './optimizePayload'
import type { LifetimeSavings } from './optimizeLifetimeSavings'
import {
  supportLinkReady,
  type SupportLinkId,
} from '../supportLinks'
import {
  toStatusBarPreviewChips,
  type StatusBarPreviewChip,
} from './statusBarView'
import type { CodeLinesPayload } from '../codeLines/collect'

export const HISTORY_ROW_KEYS = [
  'time',
  'model',
  'cost',
  'tokens',
  'inputOutput',
  'kind',
  'spike',
  'inBurnWindow',
] as const

export type HistoryRow = {
  time: string
  model: string
  cost: string
  tokens: string
  inputOutput: string
  kind: string
  spike: boolean
  inBurnWindow: boolean
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
  historyFromDate?: string | null
  refreshing?: boolean
  pollIntervalMinutes?: number
  showStatusBar?: boolean
  showToday?: boolean
  minimalMode?: boolean
  recentQueryCount?: number
  budgetDayBasis?: BudgetDayBasis
  optimizeDepth?: OptimizeDepth
  /** Raw `.ai/optimize-savings.md` when present (agent-written after Start). */
  optimizeSavingsMarkdown?: string | null
  /** Workspace folder basename for Optimize fence `project:`. */
  optimizeProjectLabel?: string
  /** Credited lifetime savings from extension globalState. */
  optimizeLifetimeSavings?: LifetimeSavings | null
  burnRateGuard?: boolean
  burnRateWindowMinutes?: number
  burnRateWarningUsd?: number
  burnRateCriticalUsd?: number
  burnRateMinQueries?: number
  burnRateWarningToast?: boolean
  burnRateCriticalToast?: boolean
  codeLinesInsight?: boolean
  codeLines?: CodeLinesPayload | null
  nowMs?: number
  language?: Locale
}

export function toHistoryRows(
  queries: UsageQuery[],
  options?: HistoryRowOptions,
): HistoryRow[] {
  const limit = clampHistoryLimit(
    options?.historyLimit ?? DEFAULT_HISTORY_LIMIT,
  )
  const burn = burnWindowForRows(queries, options)
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
      inBurnWindow: burn !== null && queryInLiveWindow(query.timestamp, burn),
    }
  })
}

function burnWindowForRows(
  queries: UsageQuery[],
  options?: HistoryRowOptions,
) {
  if (options?.burnRateGuard === false) {
    return null
  }
  return evaluateBurnRate({
    queries,
    enabled: true,
    windowMinutes:
      options?.burnRateWindowMinutes ?? DEFAULT_BURN_RATE_WINDOW_MINUTES,
    warningUsd: options?.burnRateWarningUsd ?? DEFAULT_BURN_RATE_WARNING_USD,
    criticalUsd: options?.burnRateCriticalUsd ?? DEFAULT_BURN_RATE_CRITICAL_USD,
    minQueries: options?.burnRateMinQueries ?? DEFAULT_BURN_RATE_MIN_QUERIES,
    nowMs: options?.nowMs ?? Date.now(),
  }).window
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
  historyFromDate: string | null
  pollIntervalMinutes: number
  showStatusBar: boolean
  showToday: boolean
  minimalMode: boolean
  recentQueryCount: number
  budgetDayBasis: BudgetDayBasis
  optimizeDepth: OptimizeDepth
  burnRateGuard: boolean
  burnRateWindowMinutes: number
  burnRateWarningUsd: number
  burnRateCriticalUsd: number
  burnRateMinQueries: number
  burnRateWarningToast: boolean
  burnRateCriticalToast: boolean
  burnRate: BurnRatePayload | null
  codeLinesInsight: boolean
  codeLines: CodeLinesPayload | null
  statusBarPreview: StatusBarPreviewChip[]
  stats: PeriodStatsPayload
  charts: ChartPoint[]
  periods: PeriodCard[]
  mtd: MtdPacePayload
  optimize: OptimizePayload
  support: Record<SupportLinkId, boolean>
  refreshing: boolean
  language: Locale
  i18n: ReturnType<typeof catalogFor>
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
  const historyFromDate = parseHistoryFromDate(options?.historyFromDate)
  const sampleLimit = sampleSizeLimit(historyLimit, historyFromDate)
  const pollIntervalMinutes =
    options?.pollIntervalMinutes ??
    DEFAULT_CURSOR_COST_CONFIG.pollIntervalMinutes
  const showStatusBar = options?.showStatusBar !== false
  const showToday = options?.showToday !== false
  const minimalMode = options?.minimalMode === true
  const recentQueryCount = clampRecentQueryCount(
    options?.recentQueryCount ?? DEFAULT_RECENT_QUERY_COUNT,
  )
  const budgetDayBasis = options?.budgetDayBasis ?? DEFAULT_BUDGET_DAY_BASIS
  const optimizeDepth = options?.optimizeDepth ?? DEFAULT_OPTIMIZE_DEPTH
  const burnRateGuard = options?.burnRateGuard !== false
  const burnRateWindowMinutes =
    options?.burnRateWindowMinutes ?? DEFAULT_BURN_RATE_WINDOW_MINUTES
  const burnRateWarningUsd =
    options?.burnRateWarningUsd ?? DEFAULT_BURN_RATE_WARNING_USD
  const burnRateCriticalUsd =
    options?.burnRateCriticalUsd ?? DEFAULT_BURN_RATE_CRITICAL_USD
  const burnRateMinQueries =
    options?.burnRateMinQueries ?? DEFAULT_BURN_RATE_MIN_QUERIES
  const burnRateWarningToast = options?.burnRateWarningToast !== false
  const burnRateCriticalToast = options?.burnRateCriticalToast !== false
  const codeLinesInsight = options?.codeLinesInsight !== false
  const codeLines = options?.codeLines ?? null
  const nowMs = options?.nowMs ?? Date.now()
  const language = parseLocale(options?.language ?? DEFAULT_LOCALE)
  const i18n = catalogFor(language)
  const pacedSnapshot: UsageSnapshot =
    snapshot.status === 'ready'
      ? {
          status: 'ready',
          data: applyBudgetDayBasis(snapshot.data, budgetDayBasis),
        }
      : snapshot
  const todayUsd =
    pacedSnapshot.status === 'ready' ? pacedSnapshot.data.todayUsedUsd : null
  const burnRate = toBurnRatePayload({
    queries,
    enabled: burnRateGuard,
    windowMinutes: burnRateWindowMinutes,
    warningUsd: burnRateWarningUsd,
    criticalUsd: burnRateCriticalUsd,
    minQueries: burnRateMinQueries,
    nowMs,
    todayUsd,
    locale: language,
  })
  const rowOptions: HistoryRowOptions = {
    spikeTokenThreshold,
    showSpikeWarning,
    showCriticalAlert,
    criticalTokenThreshold,
    criticalCostUsdThreshold,
    historyLimit: sampleLimit,
    historyFromDate,
    okColor: options?.okColor ?? DEFAULT_OK_COLOR,
    warnColor: options?.warnColor ?? DEFAULT_WARN_COLOR,
    extensionVersion: options?.extensionVersion ?? '0.0.0',
    pollIntervalMinutes,
    showStatusBar,
    showToday,
    minimalMode,
    recentQueryCount,
    budgetDayBasis,
    optimizeDepth,
    burnRateGuard,
    burnRateWindowMinutes,
    burnRateWarningUsd,
    burnRateCriticalUsd,
    burnRateMinQueries,
    nowMs,
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
    historyFromDate,
    pollIntervalMinutes,
    showStatusBar,
    showToday,
    minimalMode,
    recentQueryCount,
    budgetDayBasis,
    optimizeDepth,
    burnRateGuard,
    burnRateWindowMinutes,
    burnRateWarningUsd,
    burnRateCriticalUsd,
    burnRateMinQueries,
    burnRateWarningToast,
    burnRateCriticalToast,
    burnRate,
    codeLinesInsight,
    codeLines: codeLinesInsight ? codeLines : null,
    statusBarPreview: toStatusBarPreviewChips({
      ...DEFAULT_CURSOR_COST_CONFIG,
      spikeTokenThreshold,
      showSpikeWarning,
      showStatusBar,
      showToday,
      minimalMode,
      recentQueryCount,
      budgetDayBasis,
      optimizeDepth,
      language,
    }),
    stats: toPeriodStats(pacedSnapshot, queries, {
      spikeTokenThreshold,
      historyLimit,
      historyFromDate,
      budgetDayBasis,
      locale: language,
    }),
    charts: toChartSeries(queries, sampleLimit),
    periods: toPeriodCards(queries, { historyLimit: sampleLimit, locale: language }),
    mtd: toMtdPace(pacedSnapshot, queries, {
      historyLimit,
      historyFromDate,
      budgetDayBasis,
      locale: language,
    }),
    optimize: toOptimizePayload(queries, {
      depth: optimizeDepth,
      historyLimit: sampleLimit,
      spikeTokenThreshold,
      savingsMarkdown: options?.optimizeSavingsMarkdown ?? null,
      projectLabel: options?.optimizeProjectLabel ?? '',
      lifetimeSavings: options?.optimizeLifetimeSavings ?? null,
      locale: language,
    }),
    support: {
      buyMeACoffee: supportLinkReady('buyMeACoffee'),
      githubSponsors: supportLinkReady('githubSponsors'),
    },
    refreshing: options?.refreshing === true,
    language,
    i18n,
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
    return historyDataPayload(
      queries,
      catalogFor(parseLocale(options?.language ?? DEFAULT_LOCALE)).statusBar.loading,
      options,
      snapshot,
    )
  }
  return historyDataPayload(queries, undefined, options, snapshot)
}
