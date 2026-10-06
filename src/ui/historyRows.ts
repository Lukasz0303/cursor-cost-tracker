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
import { billingCycleStartIso, parseHistoryFromDate } from '../historyFromDate'
import type { ForecastWindow } from '../forecastWindow'
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
import type { ModelCatalogPayload } from '../pricing/parse'
import { pricePerMillion } from '../pricing/money'
import {
  queryListPrice,
  type ListPriceSplit,
} from '../pricing/listPrice'
import { matchPricedModel } from '../pricing/usageMatch'
import {
  toOptimizePayload,
  type OptimizePayload,
} from './optimizePayload'
import type { LifetimeSavings } from './optimizeLifetimeSavings'
import {
  emptyOptimizedTargets,
  isOptimizedQuery,
  type OptimizedTargets,
} from './optimizedTargets'
import { supportLinkReady } from '../supportLinks'
import { PUBLISHED_COMMENTS, type PublishedComment } from '../support/comments'
import {
  toStatusBarPreviewChips,
  type StatusBarPreviewChip,
} from './statusBarView'
import type { CodeLinesPayload } from '../codeLines/collect'
import { cleanConversationTitle } from '../usage/conversationTitles'
import { toQueryGroups, type QueryGroupPayload } from './queryGroups'

export const HISTORY_ROW_KEYS = [
  'time',
  'model',
  'cost',
  'tokens',
  'inputOutput',
  'kind',
  'spike',
  'inBurnWindow',
  'timestamp',
  'conversationId',
  'listPrice',
  'optimized',
  'conversationTitle',
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
  timestamp: number
  /** Empty when the usage event had no conversation id. */
  conversationId: string
  /** Null when the catalog is missing or errored. All-null split = no model match. */
  listPrice: ListPriceSplit | null
  /** True when this query's conversation (or ungrouped fingerprint) was sent to Optimize. */
  optimized: boolean
  /** Local Cursor composer title for this conversation id. Empty when unknown. */
  conversationTitle: string
}

export type HistoryRowOptions = {
  spikeTokenThreshold?: number
  showSpikeWarning?: boolean
  showCriticalAlert?: boolean
  criticalTokenThreshold?: number
  criticalCostUsdThreshold?: number
  okColor?: string
  warnColor?: string
  extensionVersion?: string
  historyLimit?: number
  historyFromDate?: string | null
  historyToDate?: string | null
  refreshing?: boolean
  pollIntervalMinutes?: number
  showStatusBar?: boolean
  showToday?: boolean
  minimalMode?: boolean
  recentQueryCount?: number
  budgetDayBasis?: BudgetDayBasis
  forecastWindow?: ForecastWindow
  optimizeDepth?: OptimizeDepth
  /** Raw `.ai/optimize-savings.md` when present (agent-written after Start). */
  optimizeSavingsMarkdown?: string | null
  /** Workspace folder basename for Optimize fence `project:`. */
  optimizeProjectLabel?: string
  /** Credited lifetime savings from extension globalState. */
  optimizeLifetimeSavings?: LifetimeSavings | null
  /** Conversations and ungrouped queries already sent to Optimize. */
  optimizedTargets?: OptimizedTargets | null
  burnRateGuard?: boolean
  burnRateWindowMinutes?: number
  burnRateWarningUsd?: number
  burnRateCriticalUsd?: number
  burnRateMinQueries?: number
  burnRateWarningToast?: boolean
  burnRateCriticalToast?: boolean
  codeLinesInsight?: boolean
  codeLines?: CodeLinesPayload | null
  /** Fold the queries table into one row per conversation title. */
  groupQueriesByConversation?: boolean
  /** Local conversation titles keyed by usage-event id. Not sent raw to the webview. */
  conversationTitles?: Readonly<Record<string, string>>
  nowMs?: number
  language?: Locale
  modelCatalog?: ModelCatalogPayload | null
  /** Nickname derived from the Cursor account email. */
  cursorNickname?: string
  /** Cursor account email, used only to prefill Support → Write a message. */
  cursorEmail?: string | null
  leaderboardUnlocked?: boolean
}

function listPriceForQuery(
  query: UsageQuery,
  catalog: ModelCatalogPayload | null | undefined,
): ListPriceSplit | null {
  if (catalog === null || catalog === undefined || catalog.error) {
    return null
  }
  const priced = matchPricedModel(query.model, catalog)
  if (priced === null) {
    return queryListPrice(query, {
      input: null,
      output: null,
      cacheWrite: null,
      cacheRead: null,
    })
  }
  return queryListPrice(query, {
    input: pricePerMillion(priced.input),
    output: pricePerMillion(priced.output),
    cacheWrite: pricePerMillion(priced.cacheWrite),
    cacheRead: pricePerMillion(priced.cacheRead),
  })
}

/** Newest-first sample the table renders. Shared so group row indexes line up. */
export function historyRowSample(
  queries: readonly UsageQuery[],
  limit: number,
): UsageQuery[] {
  const capped = clampHistoryLimit(limit)
  return [...queries]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, capped)
}

export function toHistoryRows(
  queries: UsageQuery[],
  options?: HistoryRowOptions,
): HistoryRow[] {
  const burn = burnWindowForRows(queries, options)
  const catalog = options?.modelCatalog
  const targets = options?.optimizedTargets ?? emptyOptimizedTargets()
  const titles = options?.conversationTitles
  const sample = historyRowSample(
    queries,
    options?.historyLimit ?? DEFAULT_HISTORY_LIMIT,
  )
  return sample.map((query) => {
    const model = stripModelPrefix(query.model)
    const tokens = formatTokens(query.tokens)
    const spike =
      options?.showSpikeWarning === true &&
      options.spikeTokenThreshold !== undefined &&
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
      timestamp: query.timestamp,
      conversationId: query.conversationId ?? '',
      listPrice: listPriceForQuery(query, catalog),
      optimized: isOptimizedQuery(query, targets),
      conversationTitle: conversationTitleForQuery(query, titles),
    }
  })
}

function conversationTitleForQuery(
  query: UsageQuery,
  titles: Readonly<Record<string, string>> | undefined,
): string {
  const id = query.conversationId?.trim() ?? ''
  if (id === '' || titles === undefined) {
    return ''
  }
  const raw = titles[id]
  if (typeof raw !== 'string') {
    return ''
  }
  return cleanConversationTitle(raw) ?? ''
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
  /** Conversation rows for the same sample as `events`. Always sent. */
  queryGroups: QueryGroupPayload[]
  groupQueriesByConversation: boolean
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
  historyToDate: string | null
  /** ISO day for Settings → This billing cycle preset; null when unknown. */
  billingCycleStart: string | null
  pollIntervalMinutes: number
  showStatusBar: boolean
  showToday: boolean
  minimalMode: boolean
  recentQueryCount: number
  budgetDayBasis: BudgetDayBasis
  forecastWindow: ForecastWindow
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
  support: {
    buyMeACoffee: boolean
    githubSponsors: boolean
    nickname: string
    email: string
    comments: PublishedComment[]
    leaderboardUnlocked: boolean
  }
  refreshing: boolean
  language: Locale
  i18n: ReturnType<typeof catalogFor>
  modelCatalog: ModelCatalogPayload | null
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
  const historyToDate = parseHistoryFromDate(options?.historyToDate)
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
  const forecastWindow =
    options?.forecastWindow ?? DEFAULT_CURSOR_COST_CONFIG.forecastWindow
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
  const modelCatalog = options?.modelCatalog ?? null
  const rowOptions: HistoryRowOptions = {
    spikeTokenThreshold,
    showSpikeWarning,
    showCriticalAlert,
    criticalTokenThreshold,
    criticalCostUsdThreshold,
    historyLimit: sampleLimit,
    historyFromDate,
    historyToDate,
    okColor: options?.okColor ?? DEFAULT_OK_COLOR,
    warnColor: options?.warnColor ?? DEFAULT_WARN_COLOR,
    extensionVersion: options?.extensionVersion ?? '0.0.0',
    pollIntervalMinutes,
    showStatusBar,
    showToday,
    minimalMode,
    recentQueryCount,
    budgetDayBasis,
    forecastWindow,
    optimizeDepth,
    burnRateGuard,
    burnRateWindowMinutes,
    burnRateWarningUsd,
    burnRateCriticalUsd,
    burnRateMinQueries,
    nowMs,
    modelCatalog,
    optimizedTargets: options?.optimizedTargets,
    conversationTitles: options?.conversationTitles,
  }
  const payload: HistoryDataPayload = {
    type: 'data',
    events: toHistoryRows(queries, rowOptions),
    queryGroups: toQueryGroups(historyRowSample(queries, sampleLimit), {
      titles: options?.conversationTitles,
      spikeTokenThreshold,
      showSpikeWarning,
      optimizedTargets: options?.optimizedTargets,
      locale: language,
    }),
    groupQueriesByConversation: options?.groupQueriesByConversation === true,
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
    historyToDate,
    billingCycleStart:
      pacedSnapshot.status === 'ready'
        ? billingCycleStartIso(pacedSnapshot.data.billingCycleStart)
        : null,
    pollIntervalMinutes,
    showStatusBar,
    showToday,
    minimalMode,
    recentQueryCount,
    budgetDayBasis,
    forecastWindow,
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
      historyToDate,
      budgetDayBasis,
      locale: language,
      modelCatalog,
    }),
    charts: toChartSeries(queries, sampleLimit),
    periods: toPeriodCards(queries, { historyLimit: sampleLimit, locale: language }),
    mtd: toMtdPace(pacedSnapshot, queries, {
      historyLimit,
      historyFromDate,
      historyToDate,
      budgetDayBasis,
      locale: language,
      forecastWindow,
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
      nickname: options?.cursorNickname?.trim() ?? '',
      email: options?.cursorEmail?.trim() ?? '',
      comments: [...PUBLISHED_COMMENTS],
      leaderboardUnlocked: options?.leaderboardUnlocked === true,
    },
    refreshing: options?.refreshing === true,
    language,
    i18n,
    modelCatalog: options?.modelCatalog ?? null,
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
