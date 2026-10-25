import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Database, SqlValue } from 'sql.js'
import * as vscode from 'vscode'
import { buildCodexCsv } from '../openaiHistory/exportCsv'
import { runCodexCharts, runCodexLimitSeries } from '../openaiHistory/historyCharts'
import {
  collectCodexCsvRows,
  listCodexChildren,
  loadCodexDetails,
  runCodexQuery,
} from '../openaiHistory/historyQuery'
import {
  collectCodexOptimizeHints,
  runCodexStats,
} from '../openaiHistory/historyStats'
import { buildCodexOptimizeBrief } from '../openaiHistory/optimizeBrief'
import { listPriceFor } from '../openaiHistory/pricing/listPrices'
import {
  repriceUnpricedRequests,
  saveModelRates,
  type ModelRateInput,
} from '../openaiHistory/pricing/reprice'
import { discoverRolloutFiles, type FsDeps } from '../openaiHistory/codex/discover'
import { resolveCodexRoot } from '../openaiHistory/codex/sourceRoot'
import type { HistoryService, HistoryServiceOptions } from '../openaiHistory/historyService'
import type { RequestStore } from '../openaiHistory/store/types'
import {
  EXPORT_CSV_COMMAND,
  EXPORT_LEADERBOARD_CSV_COMMAND,
  OPEN_DASHBOARD_COMMAND,
  OPEN_PRICING_COMMAND,
} from '../constants'
import {
  APPLICATION_USER_KEY,
  parseAccountModels,
  type AccountModel,
} from '../pricing/accountModels'
import { buildCatalogLines } from '../pricing/catalogLines'
import { loadModelCatalog } from '../pricing/load'
import type { ModelCatalogPayload } from '../pricing/parse'
import { withRequestCounts } from '../pricing/usageMatch'
import { stripModelPrefix } from '../usage/parse'
import {
  colorSchemeFromKind,
  parseBudgetDayBasis,
  parseOpenaiConnectMode,
  parseOptimizeDepth,
  parseQuerySource,
  patchCursorCostConfigOverlay,
  readCursorCostConfig,
  reconcileCursorCostConfigOverlay,
  resolveStatusColors,
  type CursorCostConfig,
  type OpenaiConnectMode,
} from '../config'
import {
  OPENAI_ADMIN_KEY_SECRET,
  OPENAI_ADMIN_KEYS_URL,
  verifyOpenaiAdminKey,
} from '../openaiHistory/org/adminKey'
import {
  readOrgUsageSummary,
  replaceOrgBuckets,
  summarizeOrgRows,
  type OrgUsageSummary,
} from '../openaiHistory/org/buckets'
import { importOrganizationUsage } from '../openaiHistory/org/client'
import {
  isUnregisteredConfigError,
  persistedSettingKey,
} from '../settingsStore'
import { catalogFor, interpolate } from '../i18n'
import { parseLocale } from '../locale'
import { parseHistoryFromDate } from '../historyFromDate'
import { parseForecastWindow } from '../forecastWindow'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
  lastQueriesTitle,
  sampleSizeLimit,
} from '../historyLimit'
import { readCursorSession, readStateDbItem } from '../usage/session'
import { newestSample } from '../usage/groupConversations'
import {
  isLeaderboardUnlocked,
  LEADERBOARD_UNLOCK_STATE_KEY,
  parseUnlockRequest,
  unlockStateFor,
  verifyUnlockToken,
} from '../unlock/leaderboardUnlock'
import { buildContextSummaryPrompt } from '../contextFill/summaryPrompt'
import { openConversationComposer, pasteIntoConversation } from './openOptimizeChat'
import { OptimizeRouter } from './optimizeRouter'
import { isSettingsMessage, SettingsRouter } from './settingsRouter'
import { PanelPublisher } from './panelPublisher'
import { unlockSecret } from '../unlock/secret'
import type { UsageQuery } from '../usage/types'
import type { UsageService } from '../usage/service'
import { resolveExtensionVersion } from '../version'
import { resolveSupportUrl } from '../supportLinks'
import {
  parseAuthorMessage,
  postAuthorMessage,
} from '../support/authorMessage'
import { buildQueriesCsv } from './exportCsv'
import { setForecastSeriesFocus } from './forecastSeriesFocus'
import { parseWebviewMessage, type WebviewMessage } from '../webview/messages'
import {
  isLeaderboardMessage,
  LeaderboardHost,
} from './leaderboardHost'
import { lastRedQuery } from './optimizeInsights'
import {
  OPTIMIZED_TARGETS_STATE_KEY,
  optimizedTargetForQuery,
  parseOptimizedTargets,
  rememberOptimizedTarget,
  type OptimizedTargetInput,
  type OptimizedTargets,
} from './optimizedTargets'
import {
  applyOptimizeCredit,
  basenameLabel,
  LIFETIME_SAVINGS_STATE_KEY,
  parseLifetimeSavings,
  type LifetimeSavings,
} from './optimizeLifetimeSavings'
import {
  parseOptimizeSavingsMarkdown,
} from './optimizeSavings'
import { watchOptimizeSavingsFile } from './optimizeSavingsFile'
import type { HistoryTab } from './statusBarView'

const VIEW_TYPE = 'cursorCost.history'
const HISTORY_TABS: HistoryTab[] = [
  'queries',
  'stats',
  'charts',
  'optimize',
  'leaderboard',
  'support',
  'settings',
]

function historyTabFrom(value: unknown): HistoryTab | undefined {
  if (typeof value !== 'string' || !(HISTORY_TABS as readonly string[]).includes(value)) {
    return undefined
  }
  return value as HistoryTab
}

export function parseHistoryTab(value: unknown): HistoryTab {
  const direct = historyTabFrom(value)
  if (direct !== undefined) {
    return direct
  }
  if (typeof value === 'object' && value !== null && 'tab' in value) {
    const nested = historyTabFrom(value.tab)
    if (nested !== undefined) {
      return nested
    }
  }
  return 'queries'
}

function asConfigPatch(
  key: string,
  value: string | number | boolean,
): Partial<CursorCostConfig> | undefined {
  switch (key) {
    case 'pollIntervalMinutes':
    case 'recentQueryCount':
    case 'spikeTokenThreshold':
    case 'criticalTokenThreshold':
    case 'criticalCostUsdThreshold':
    case 'burnRateWindowMinutes':
    case 'burnRateWarningUsd':
    case 'burnRateCriticalUsd':
    case 'burnRateMinQueries':
    case 'historyLimit':
      return { [key]: value as number }
    case 'historyFromDate':
      return { historyFromDate: parseHistoryFromDate(value) }
    case 'historyToDate':
      return { historyToDate: parseHistoryFromDate(value) }
    case 'showStatusBar':
    case 'showToday':
    case 'minimalMode':
    case 'showSpikeWarning':
    case 'showCriticalAlert':
    case 'burnRateGuard':
    case 'burnRateWarningToast':
    case 'burnRateCriticalToast':
    case 'codeLinesInsight':
    case 'groupQueriesByConversation':
    case 'showCliThreads':
    case 'codexImportEnabled':
    case 'codexGroupByConversation':
      return { [key]: value === true }
    case 'codexHome':
      return { codexHome: String(value) }
    case 'openaiSinkPath':
      return { openaiSinkPath: String(value).trim() }
    case 'openaiConnectMode':
      return { openaiConnectMode: parseOpenaiConnectMode(value) }
    case 'querySource':
      return { querySource: parseQuerySource(value) }
    case 'budgetDayBasis':
      return { budgetDayBasis: parseBudgetDayBasis(value) }
    case 'forecastWindow':
      return { forecastWindow: parseForecastWindow(value) }
    case 'optimizeDepth':
      return { optimizeDepth: parseOptimizeDepth(value) }
    case 'language':
      return { language: parseLocale(value) }
    case 'okColor':
    case 'warnColor':
      return { [key]: String(value) }
    default:
      return undefined
  }
}

const DATA_SETTING_KEYS = [
  'pollIntervalMinutes',
  'showStatusBar',
  'showToday',
  'minimalMode',
  'recentQueryCount',
  'spikeTokenThreshold',
  'showSpikeWarning',
  'showCriticalAlert',
  'criticalTokenThreshold',
  'criticalCostUsdThreshold',
  'burnRateGuard',
  'burnRateWindowMinutes',
  'burnRateWarningUsd',
  'burnRateCriticalUsd',
  'burnRateMinQueries',
  'burnRateWarningToast',
  'burnRateCriticalToast',
  'codeLinesInsight',
  'groupQueriesByConversation',
  'showCliThreads',
  'codexImportEnabled',
  'codexHome',
  'codexGroupByConversation',
  'querySource',
  'openaiSinkPath',
  'openaiConnectMode',
  'historyLimit',
  'historyFromDate',
  'historyToDate',
  'budgetDayBasis',
  'forecastWindow',
  'optimizeDepth',
  'language',
] as const

function colorSettingsOnly(event: vscode.ConfigurationChangeEvent): boolean {
  const color =
    event.affectsConfiguration('cursorCost.okColor') ||
    event.affectsConfiguration('cursorCost.warnColor')
  if (!color) {
    return false
  }
  return !DATA_SETTING_KEYS.some((key) =>
    event.affectsConfiguration(`cursorCost.${key}`),
  )
}

/** Wired from `extension.ts` after the sql.js store is ready. */
export type CodexHost = {
  history: HistoryService
  options: HistoryServiceOptions
  getStore: () => RequestStore
  storePath: string
  flush: () => Promise<void>
  forget: () => Promise<void>
  ownerId: string
}

export class HistoryPanel {
  private static current: HistoryPanel | undefined
  private static codexHost: CodexHost | null = null

  /** Repaint Codex after the background scan. Cursor usage keeps its own poll. */
  static refreshOpenCodex(): void {
    const panel = HistoryPanel.current
    if (panel === undefined) {
      return
    }
    const source = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    ).querySource
    if (source !== 'codex-local') {
      return
    }
    void panel.postCodexStatus()
  }

  static bindCodex(host: CodexHost): void {
    HistoryPanel.codexHost = host
    const panel = HistoryPanel.current
    if (panel === undefined) {
      return
    }
    const source = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    ).querySource
    if (source === 'openai-api') {
      void panel.postOpenaiStatus(null, true)
    }
  }

  static exportLeaderboard(): void {
    const panel = HistoryPanel.current
    if (!panel?.leaderboardUnlocked()) {
      return
    }
    void panel.leaderboard.exportCsv()
  }

  static show(
    context: vscode.ExtensionContext,
    service: UsageService,
    tab: HistoryTab = 'queries',
    options?: { forceCursorSource?: boolean },
  ): void {
    if (options?.forceCursorSource === true) {
      void vscode.workspace
        .getConfiguration('cursorCost')
        .update('querySource', 'cursor', vscode.ConfigurationTarget.Global)
      patchCursorCostConfigOverlay({ querySource: 'cursor' })
    }
    const version = resolveExtensionVersion(
      context.extensionUri.fsPath,
      context.extension?.packageJSON,
    )
    if (HistoryPanel.current?.panelVersion !== version) {
      HistoryPanel.current?.panel.dispose()
      HistoryPanel.current = undefined
    }
    if (HistoryPanel.current) {
      HistoryPanel.current.panel.reveal(vscode.ViewColumn.Active)
      HistoryPanel.current.openTab(tab)
      // Cursor payload only — opening on Codex must not refresh the usage API.
      HistoryPanel.current.publisher.postData()
      void HistoryPanel.current.postSourceChrome()
      return
    }
    HistoryPanel.current = new HistoryPanel(context, service, version, tab)
  }

  readonly panelVersion: string
  private readonly panel: vscode.WebviewPanel
  private readonly globalState: vscode.Memento
  private readonly workspaceState: vscode.Memento
  private readonly secrets: vscode.SecretStorage
  private readonly disposables: vscode.Disposable[] = []
  private pendingTab: HistoryTab
  private leaderboardScriptUri = ''
  private readonly leaderboard: LeaderboardHost
  private readonly settingsRouter: SettingsRouter
  private readonly optimizeRouter: OptimizeRouter
  private readonly publisher: PanelPublisher
  private modelCatalog: ModelCatalogPayload | null = null
  private accountModels: AccountModel[] | null = null
  private orgFetchedAt = 0
  private orgRefreshTimer: ReturnType<typeof setTimeout> | undefined

  private constructor(
    context: vscode.ExtensionContext,
    private readonly service: UsageService,
    version: string,
    initialTab: HistoryTab,
  ) {
    this.panelVersion = version
    this.globalState = context.globalState
    this.workspaceState = context.workspaceState
    this.secrets = context.secrets
    this.pendingTab = initialTab
    const mediaRoot = vscode.Uri.joinPath(context.extensionUri, 'media')
    this.panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      lastQueriesTitle(DEFAULT_HISTORY_LIMIT),
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        enableCommandUris: [
          EXPORT_CSV_COMMAND,
          EXPORT_LEADERBOARD_CSV_COMMAND,
          OPEN_DASHBOARD_COMMAND,
          OPEN_PRICING_COMMAND,
        ],
        localResourceRoots: [mediaRoot],
      },
    )
    this.panel.webview.html = this.renderHtml(this.panel.webview, mediaRoot)
    this.leaderboard = new LeaderboardHost({
      globalState: this.globalState,
      post: (message) => {
        void this.panel.webview.postMessage(message)
      },
      workspaceRoot: () =>
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null,
    })

    this.disposables.push(
      this.panel.onDidDispose(() => {
        this.dispose()
      }),
      this.panel.webview.onDidReceiveMessage((message: unknown) => {
        this.onMessage(message)
      }),
      this.service.onDidChange(() => {
        this.publisher.postData()
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration('cursorCost')) {
          return
        }
        if (colorSettingsOnly(event)) {
          this.postColors()
          return
        }
        this.publisher.postData()
      }),
      vscode.window.onDidChangeActiveColorTheme(() => {
        this.postColors()
      }),
      watchOptimizeSavingsFile(() => {
        void this.publisher.creditSavingsThenPost()
      }),
    )
    this.publisher = new PanelPublisher({
      panel: this.panel,
      service: this.service,
      workspaceState: this.workspaceState,
      panelVersion: this.panelVersion,
      catalogForView: () => this.catalogForView(),
      leaderboardUnlocked: () => this.leaderboardUnlocked(),
      readLifetimeSavings: () => this.readLifetimeSavings(),
      readOptimizedTargets: () => this.readOptimizedTargets(),
      workspaceProject: () => this.workspaceProject(),
      creditOptimizeSavings: (markdown) => this.creditOptimizeSavings(markdown),
    })
    this.settingsRouter = new SettingsRouter({
      writeSetting: (key, value) => this.writeSetting(key, value),
      postData: () => {
        this.publisher.postData()
      },
      refresh: () => {
        void this.service.refresh()
      },
      updateWorkspaceState: (key, value) => this.workspaceState.update(key, value),
    })
    this.optimizeRouter = new OptimizeRouter({
      getSnapshot: () => this.service.getSnapshot(),
      getQueries: () => this.service.getCachedQueries(),
      titles: () => this.publisher.titles(),
      accountSpend: () => this.publisher.accountSpend(),
      setSavingsMarkdown: (markdown) => {
        this.publisher.setSavingsMarkdown(markdown)
      },
      creditOptimizeSavings: (markdown) => this.creditOptimizeSavings(markdown),
      workspaceProject: () => this.workspaceProject(),
      readLifetimeSavings: () => this.readLifetimeSavings(),
      rememberLastRedTarget: (config) => this.rememberLastRedTarget(config),
      persistOptimizedTarget: (input) => this.persistOptimizedTarget(input),
    })
  }

  private leaderboardUnlocked(): boolean {
    return isLeaderboardUnlocked(
      this.globalState.get(LEADERBOARD_UNLOCK_STATE_KEY),
    )
  }

  /** Clears the unlock flag. The next data payload hides the tab. */
  private async lockLeaderboard(): Promise<void> {
    if (!this.leaderboardUnlocked()) {
      return
    }
    await this.globalState.update(LEADERBOARD_UNLOCK_STATE_KEY, undefined)
    if (HistoryPanel.current !== this) {
      return
    }
    this.publisher.postData()
  }

  private openTab(tab: HistoryTab): void {
    const target =
      tab === 'leaderboard' && !this.leaderboardUnlocked() ? 'queries' : tab
    this.pendingTab = target
    void this.panel.webview.postMessage({ type: 'openTab', tab: target })
  }

  private onMessage(raw: unknown): void {
    const message = parseWebviewMessage(raw)
    if (message === undefined) {
      return
    }
    if (isLeaderboardMessage(message)) {
      if (!this.leaderboardUnlocked()) {
        return
      }
      this.leaderboard.handle(message)
      return
    }
    if (isSettingsMessage(message)) {
      this.settingsRouter.handle(message)
      return
    }
    switch (message.type) {
      case 'lockLeaderboard':
        void this.lockLeaderboard()
        return
      case 'ready': {
        const boot = catalogFor(
          readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost'))
            .language,
        ).boot
        void this.panel.webview.postMessage({
          type: 'boot',
          title: boot.title,
          hint: boot.hint,
        })
        this.publisher.postData()
        this.publishModelCatalog(false)
        if (this.leaderboardUnlocked()) {
          this.leaderboard.publishChrome()
        }
        this.openTab(this.pendingTab)
        void this.postSourceChrome()
        return
      }
      case 'close':
        this.panel.dispose()
        return
      case 'refresh':
        void this.service.refresh()
        void this.refreshOpenaiIfSelected()
        return
      case 'setForecastSeries':
        setForecastSeriesFocus(message.value)
        return
      case 'refreshModelCatalog':
        this.publishModelCatalog(true)
        return
      case 'openModelSettings':
        void vscode.commands
          .executeCommand('aiSettings.action.open', 'models')
          .then(undefined, () => {
            void vscode.commands.executeCommand('cursor.openCursorSettings')
          })
        return
      case 'openCursorBench':
        void vscode.env.openExternal(
          vscode.Uri.parse('https://cursor.com/cursorbench'),
        )
        return
      case 'exportCsv':
        void saveQueriesCsv(this.service.getCachedQueries())
        return
      case 'openDashboard':
        void vscode.commands.executeCommand(OPEN_DASHBOARD_COMMAND)
        return
      case 'openSupportLink': {
        const url = resolveSupportUrl(message.id)
        if (!url) {
          void vscode.window.showInformationMessage(
            catalogFor(
              readCursorCostConfig(
                vscode.workspace.getConfiguration('cursorCost'),
              ).language,
            ).support.linkNotLive,
          )
          return
        }
        void vscode.env.openExternal(vscode.Uri.parse(url))
        return
      }
      case 'sendAuthorMessage':
        this.deliverAuthorMessage(message)
        return
      case 'runOptimize':
        void this.optimizeRouter.run('chat', message.depth)
        return
      case 'openConversation':
        void openConversationComposer(message.id)
        return
      case 'summarizeConversation':
        void pasteIntoConversation(message.id, buildContextSummaryPrompt())
        return
      case 'optimizeConversation':
        void this.optimizeRouter.conversation(
          message.id,
          message.timestamp,
          message.depth,
        )
        return
      case 'copyOptimizePrompt':
        void this.optimizeRouter.run('copy', message.depth)
        return
      case 'setQuerySource':
        void this.handleSetQuerySource(message.value)
        return
      case 'setCodexImportEnabled':
        void this.writeSetting(
          'codexImportEnabled',
          message.value === true,
        )
        return
      case 'setCodexHome':
        void this.writeSetting(
          'codexHome',
          typeof message.value === 'string' ? message.value : '',
        )
        return
      case 'setCodexGroupByConversation':
        void this.writeSetting(
          'codexGroupByConversation',
          message.value === true,
        )
        return
      case 'codex.refresh':
        void this.handleCodexRefresh()
        return
      case 'codex.query':
        void this.handleCodexQuery(message)
        return
      case 'codex.expand':
        void this.handleCodexExpand(message.conversationId, message.accountScopeKey)
        return
      case 'codex.details':
        void this.handleCodexDetails(message.requestId)
        return
      case 'codex.exportCsv':
        void this.handleCodexExportCsv(message)
        return
      case 'codex.forget':
        void this.handleCodexForget()
        return
      case 'codex.setRates':
        void this.handleCodexSetRates(message.rates)
        return
      case 'openai.refresh':
        void this.postOpenaiStatus()
        return
      case 'openai.setMode':
        void this.handleOpenaiSetMode(message.value)
        return
      case 'openai.connect':
        void this.handleOpenaiConnect(message.mode)
        return
      case 'openai.disconnect':
        void this.handleOpenaiDisconnect()
        return
      case 'openai.openAdminKeys':
        void vscode.env.openExternal(vscode.Uri.parse(OPENAI_ADMIN_KEYS_URL))
        return
      case 'codex.analyze':
        void this.handleCodexAnalyze(message)
        return
      default: {
        const unreachable: never = message
        return unreachable
      }
    }
  }

  private codex(): CodexHost | null {
    return HistoryPanel.codexHost
  }

  private async postSourceChrome(): Promise<void> {
    const source = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    ).querySource
    if (source === 'openai-api') {
      await this.postOpenaiStatus()
      return
    }
    if (source === 'codex-local') {
      await this.postCodexStatus()
    }
  }

  private async handleSetQuerySource(value: unknown): Promise<void> {
    const source = parseQuerySource(value)
    await this.writeSetting('querySource', source)
    // Do not call Cursor refresh when switching source.
    if (source === 'cursor') {
      this.publisher.postData()
      return
    }
    if (source === 'openai-api') {
      await this.postOpenaiStatus()
      return
    }
    await this.postCodexStatus()
  }

  private async postOpenaiStatus(detail: string | null = null, force = false): Promise<void> {
    const cfg = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    const mode = cfg.openaiConnectMode
    const sinkPath = cfg.openaiSinkPath.trim()
    const adminKey = await this.secrets.get(OPENAI_ADMIN_KEY_SECRET)
    const trimmedKey = typeof adminKey === 'string' ? adminKey.trim() : ''
    const hasAdminKey = trimmedKey.length > 0
    const connected = mode === 'web' ? hasAdminKey : sinkPath.length > 0
    let usage: OrgUsageSummary | null = null
    let nextDetail = detail
    if (mode === 'web' && hasAdminKey) {
      const loaded = await this.loadOrgUsage(trimmedKey, force)
      usage = loaded.usage
      if (nextDetail === null && loaded.error) {
        nextDetail = loaded.error
      }
      if (nextDetail === null && usage === null) {
        nextDetail =
          cfg.language === 'pl'
            ? 'OpenAI nie zwróciło zużycia z ostatnich 30 dni.'
            : 'OpenAI returned no usage for the last 30 days.'
      }
      this.armOrgRefresh()
    } else if (this.orgRefreshTimer) {
      clearTimeout(this.orgRefreshTimer)
      this.orgRefreshTimer = undefined
    }
    void this.panel.webview.postMessage({
      type: 'openai.status',
      state: connected ? 'connected' : 'not-connected',
      mode,
      detail: nextDetail,
      sinkPath: sinkPath.length > 0 ? sinkPath : null,
      hasAdminKey,
      usage,
    })
  }

  private refreshOpenaiIfSelected(): void {
    const source = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    ).querySource
    if (source === 'openai-api') {
      void this.postOpenaiStatus(null, true)
    }
  }

  /** Organization aggregates only. The admin key stays in this function and is not posted. */
  private async loadOrgUsage(
    key: string,
    force: boolean,
  ): Promise<{ usage: OrgUsageSummary | null; error: string | null }> {
    const stale = Date.now() - this.orgFetchedAt >= 15 * 60 * 1000
    let error: string | null = null
    let fetched: OrgUsageSummary | null = null
    if (force || this.orgFetchedAt === 0 || stale) {
      const imported = await importOrganizationUsage({ key })
      this.orgFetchedAt = Date.now()
      if (imported.error !== null) {
        error = imported.error
      } else {
        fetched = summarizeOrgRows(imported.rows)
        const host = this.codex()
        const db = host ? (host.getStore() as unknown as { db?: Database }).db : undefined
        if (host && db) {
          try {
            host.getStore().setLeaseRole('writer')
            replaceOrgBuckets(db, imported.rows, new Date().toISOString())
            await host.flush()
          } catch {
            error = 'Could not store organization usage.'
          }
        }
      }
    }
    const host = this.codex()
    const db = host ? (host.getStore() as unknown as { db?: Database }).db : undefined
    if (host && db) {
      try {
        const stored = readOrgUsageSummary(db)
        if (stored) {
          return { usage: stored, error }
        }
      } catch {
        return { usage: fetched, error }
      }
    }
    return { usage: fetched, error }
  }

  private armOrgRefresh(): void {
    if (this.orgRefreshTimer) {
      clearTimeout(this.orgRefreshTimer)
    }
    this.orgRefreshTimer = setTimeout(() => {
      this.orgRefreshTimer = undefined
      if (HistoryPanel.current !== this) {
        return
      }
      const source = readCursorCostConfig(
        vscode.workspace.getConfiguration('cursorCost'),
      ).querySource
      if (source === 'openai-api') {
        void this.postOpenaiStatus(null, true)
      }
    }, 15 * 60 * 1000)
  }

  private async handleOpenaiSetMode(mode: OpenaiConnectMode): Promise<void> {
    await this.writeSetting('openaiConnectMode', mode)
    await this.postOpenaiStatus()
  }

  private async handleOpenaiConnect(mode: OpenaiConnectMode): Promise<void> {
    await this.writeSetting('openaiConnectMode', mode)
    if (mode === 'local') {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: 'Use as OpenAI sink',
        filters: { JSONL: ['jsonl', 'json'], 'All files': ['*'] },
      })
      const path = picked?.[0]?.fsPath?.trim() ?? ''
      if (path.length === 0) {
        await this.postOpenaiStatus()
        return
      }
      await this.writeSetting('openaiSinkPath', path)
      await this.postOpenaiStatus(null)
      return
    }
    const existing = await this.secrets.get(OPENAI_ADMIN_KEY_SECRET)
    const key = await vscode.window.showInputBox({
      title: 'OpenAI organization admin key',
      prompt:
        'Paste an organization admin API key from platform.openai.com. Stored only in Secret Storage — never in settings or the panel.',
      password: true,
      ignoreFocusOut: true,
      value: typeof existing === 'string' ? existing : '',
      placeHolder: 'sk-admin-…',
    })
    if (key === undefined) {
      await this.postOpenaiStatus()
      return
    }
    const trimmed = key.trim()
    if (trimmed.length === 0) {
      await this.secrets.delete(OPENAI_ADMIN_KEY_SECRET)
      await this.postOpenaiStatus('Admin key cleared.')
      return
    }
    const check = await verifyOpenaiAdminKey(trimmed)
    if (!check.ok) {
      await this.postOpenaiStatus(check.message)
      return
    }
    await this.secrets.store(OPENAI_ADMIN_KEY_SECRET, trimmed)
    await this.postOpenaiStatus(null, true)
  }

  private async handleOpenaiDisconnect(): Promise<void> {
    const cfg = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    if (cfg.openaiConnectMode === 'web') {
      await this.secrets.delete(OPENAI_ADMIN_KEY_SECRET)
    } else {
      await this.writeSetting('openaiSinkPath', '')
    }
    await this.postOpenaiStatus(null)
  }

  private async handleCodexSetRates(rates: ModelRateInput[]): Promise<void> {
    const host = this.codex()
    if (host === null) {
      void this.panel.webview.postMessage({
        type: 'operation.error',
        message: 'Codex history is not ready.',
      })
      return
    }
    try {
      host.getStore().setLeaseRole('writer')
      saveModelRates(host.getStore(), rates)
      await host.flush()
      await this.postCodexStatus()
    } catch {
      void this.panel.webview.postMessage({
        type: 'operation.error',
        message: 'Codex rates could not be saved.',
      })
    }
  }

  private async handleCodexRefresh(): Promise<void> {
    const host = this.codex()
    if (host === null) {
      void this.panel.webview.postMessage({
        type: 'operation.error',
        message: 'Codex history is not ready.',
      })
      return
    }
    try {
      await host.history.refresh()
      await host.flush()
      await this.postCodexStatus()
    } catch {
      void this.panel.webview.postMessage({
        type: 'operation.error',
        message: 'Codex refresh failed.',
      })
    }
  }

  private async handleCodexQuery(
    message: Extract<WebviewMessage, { type: 'codex.query' }>,
  ): Promise<void> {
    const host = this.codex()
    if (host === null) {
      void this.panel.webview.postMessage({
        type: 'operation.error',
        correlationId: message.correlationId,
        message: 'Codex history is not ready.',
      })
      return
    }
    try {
      const newlyPriced = repriceUnpricedRequests(host.getStore())
      if (newlyPriced > 0) {
        await host.flush()
      }
      const config = readCursorCostConfig(
        vscode.workspace.getConfiguration('cursorCost'),
      )
      const groupBy =
        config.codexGroupByConversation && message.groupBy === 'conversation'
          ? 'conversation'
          : 'none'
      const filter = {
        from: message.from,
        to: message.to,
        accountScopeKey: message.accountScopeKey,
        model: message.model,
        status: message.status as Parameters<typeof runCodexQuery>[1]['status'],
      }
      const page = runCodexQuery(
        host.getStore(),
        {
          correlationId: message.correlationId,
          filterRevision: message.filterRevision,
          ...filter,
          groupBy,
          sort: message.sort,
          costBasis: message.costBasis,
          cursor: message.cursor,
          limit: message.limit,
        },
        {
          spikeTokenThreshold: config.spikeTokenThreshold,
          showSpikeWarning: config.showSpikeWarning,
        },
      )
      const stats = runCodexStats(host.getStore(), filter, {
        spikeTokenThreshold: config.spikeTokenThreshold,
      })
      const charts = runCodexCharts(host.getStore(), filter)
      const limitSeries = runCodexLimitSeries(host.getStore())
      void this.panel.webview.postMessage({
        type: 'codex.result',
        ...page,
        stats,
        charts,
        limitSeries,
      })
    } catch {
      void this.panel.webview.postMessage({
        type: 'operation.error',
        correlationId: message.correlationId,
        message: 'Codex query failed.',
      })
    }
  }

  private async handleCodexAnalyze(
    message: Extract<WebviewMessage, { type: 'codex.analyze' }>,
  ): Promise<void> {
    const host = this.codex()
    if (host === null) {
      void this.panel.webview.postMessage({
        type: 'operation.error',
        message: 'Codex history is not ready.',
      })
      return
    }
    const config = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    let requestId =
      typeof message.requestId === 'string' && message.requestId.trim() !== ''
        ? message.requestId.trim()
        : null
    if (requestId === null) {
      const stats = runCodexStats(
        host.getStore(),
        {
          from: null,
          to: null,
          accountScopeKey: null,
          model: null,
          status: null,
        },
        { spikeTokenThreshold: config.spikeTokenThreshold },
      )
      requestId = stats.analyzeRequestId
    }
    if (requestId === null) {
      void this.panel.webview.postMessage({
        type: 'operation.error',
        message: 'No Codex request to analyze.',
      })
      return
    }
    const fields = loadCodexDetails(host.getStore(), requestId, 'estimated-api')
    if (fields === null) {
      void this.panel.webview.postMessage({
        type: 'operation.error',
        message: 'Request details are unavailable.',
      })
      return
    }
    const depth =
      message.depth === 'quick' || message.depth === 'deep'
        ? message.depth
        : config.optimizeDepth === 'quick' || config.optimizeDepth === 'deep'
          ? config.optimizeDepth
          : 'balanced'
    const hints = collectCodexOptimizeHints(host.getStore(), requestId)
    const brief = buildCodexOptimizeBrief({
      depth,
      row: fields,
      hints,
    })
    await this.pasteCodexBrief(brief, config.language)
  }

  /** Paste into the open Agent chat via focusComposer only — never openComposer. */
  private async pasteCodexBrief(
    brief: string,
    language: CursorCostConfig['language'],
  ): Promise<void> {
    const previous = await vscode.env.clipboard.readText()
    await vscode.env.clipboard.writeText(brief)
    try {
      const commands = await vscode.commands.getCommands(true)
      if (commands.includes('composer.focusComposer')) {
        await vscode.commands.executeCommand('composer.focusComposer')
        await new Promise((resolve) => setTimeout(resolve, 150))
        await vscode.commands.executeCommand('editor.action.clipboardPasteAction')
        return
      }
      vscode.window.showInformationMessage(
        catalogFor(language).optimize.clipboard,
      )
    } catch {
      vscode.window.showInformationMessage(
        catalogFor(language).optimize.clipboard,
      )
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 150))
      await vscode.env.clipboard.writeText(previous)
    }
  }

  private async handleCodexExpand(
    conversationId: string,
    accountScopeKey: string,
  ): Promise<void> {
    const host = this.codex()
    if (host === null) {
      return
    }
    const config = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    const rows = listCodexChildren(host.getStore(), {
      conversationId,
      accountScopeKey,
      costBasis: 'estimated-api',
      spikeTokenThreshold: config.spikeTokenThreshold,
      showSpikeWarning: config.showSpikeWarning,
    })
    void this.panel.webview.postMessage({
      type: 'codex.children',
      conversationId,
      accountScopeKey,
      rows,
    })
  }

  private async handleCodexDetails(requestId: string): Promise<void> {
    const host = this.codex()
    if (host === null) {
      return
    }
    const fields = loadCodexDetails(host.getStore(), requestId, 'estimated-api')
    if (fields === null) {
      void this.panel.webview.postMessage({
        type: 'operation.error',
        message: 'Request details are unavailable.',
      })
      return
    }
    void this.panel.webview.postMessage({ type: 'codex.detail', fields })
  }

  private async handleCodexExportCsv(
    message: Extract<WebviewMessage, { type: 'codex.exportCsv' }>,
  ): Promise<void> {
    const host = this.codex()
    if (host === null) {
      void this.panel.webview.postMessage({
        type: 'codex.exportReady',
        correlationId: message.correlationId,
        ok: false,
      })
      return
    }
    try {
      const rows = collectCodexCsvRows(host.getStore(), {
        correlationId: message.correlationId,
        filterRevision: message.filterRevision,
        from: message.from,
        to: message.to,
        accountScopeKey: message.accountScopeKey,
        model: message.model,
        status: message.status as Parameters<typeof collectCodexCsvRows>[1]['status'],
        sort: message.sort,
        costBasis: message.costBasis,
      })
      const csv = buildCodexCsv(rows)
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.joinPath(
          vscode.Uri.file(homedir()),
          'codex-requests.csv',
        ),
        filters: { CSV: ['csv'] },
        saveLabel: catalogFor(
          readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost'))
            .language,
        ).alerts.export,
      })
      if (!uri) {
        void this.panel.webview.postMessage({
          type: 'codex.exportReady',
          correlationId: message.correlationId,
          ok: false,
        })
        return
      }
      await vscode.workspace.fs.writeFile(uri, Buffer.from(csv, 'utf8'))
      void this.panel.webview.postMessage({
        type: 'codex.exportReady',
        correlationId: message.correlationId,
        ok: true,
      })
    } catch {
      void this.panel.webview.postMessage({
        type: 'codex.exportReady',
        correlationId: message.correlationId,
        ok: false,
      })
      void this.panel.webview.postMessage({
        type: 'operation.error',
        correlationId: message.correlationId,
        message: 'Codex CSV export failed.',
      })
    }
  }

  private async handleCodexForget(): Promise<void> {
    const host = this.codex()
    if (host === null) {
      return
    }
    try {
      await host.forget()
      await this.postCodexStatus()
    } catch {
      void this.panel.webview.postMessage({
        type: 'operation.error',
        message: 'Could not delete imported Codex data.',
      })
    }
  }

  private async postCodexStatus(): Promise<void> {
    const host = this.codex()
    const config = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    const { readdir, realpath, stat } = await import('node:fs/promises')
    const fsDeps: FsDeps = {
      readdir: async (path) => readdir(path),
      stat: async (path) => {
        try {
          const info = await stat(path)
          return info.isDirectory() ? 'dir' : info.isFile() ? 'file' : 'missing'
        } catch {
          return 'missing'
        }
      },
      sizeMtime: async (path) => {
        const info = await stat(path)
        return { size: info.size, mtimeMs: info.mtimeMs }
      },
      realpath: async (path) => realpath(path),
    }
    const root = await resolveCodexRoot({
      codexHomeSetting: config.codexHome,
      codexHomeEnv: process.env.CODEX_HOME,
      homeDir: homedir(),
      stat: fsDeps.stat,
      realpath: fsDeps.realpath,
      readdir: fsDeps.readdir,
    })
    const sessionsPath = !root.ok
      ? null
      : root.scanDirect
        ? root.realpath
        : join(root.realpath, 'sessions')
    let archivedSessionsPath: string | null = null
    if (root.ok && !root.scanDirect) {
      const archived = join(root.realpath, 'archived_sessions')
      if ((await fsDeps.stat(archived)) === 'dir') {
        archivedSessionsPath = archived
      }
    }
    let rolloutsOnDisk = false
    if (root.ok) {
      try {
        const found = await discoverRolloutFiles(root.realpath, fsDeps, {
          scanDirect: root.scanDirect,
        })
        rolloutsOnDisk = found.length > 0
      } catch {
        rolloutsOnDisk = false
      }
    }
    let unrecognizedCount = 0
    let ignoredCount = 0
    let sessionCount = 0
    let lastSyncAt: string | null = null
    let parserVersion: string | null = null
    let accounts: string[] = []
    let models: string[] = []
    let dateSpan: string | null = null
    let partial = false
    let rates: ModelRateInput[] = []

    if (host !== null) {
      const db = (host.getStore() as unknown as { db: Database }).db
      const one = (sql: string, params: SqlValue[] = []): Record<string, SqlValue> | null => {
        const stmt = db.prepare(sql)
        try {
          stmt.bind(params)
          if (!stmt.step()) {
            return null
          }
          return stmt.getAsObject()
        } finally {
          stmt.free()
        }
      }
      const all = (sql: string): Record<string, SqlValue>[] => {
        const stmt = db.prepare(sql)
        const rows: Record<string, SqlValue>[] = []
        try {
          while (stmt.step()) {
            rows.push(stmt.getAsObject())
          }
        } finally {
          stmt.free()
        }
        return rows
      }
      const instance = one(
        `SELECT unrecognized_lines, ignored_lines, last_scan_at, parser_version
         FROM source_instances LIMIT 1`,
      )
      unrecognizedCount =
        typeof instance?.unrecognized_lines === 'number'
          ? instance.unrecognized_lines
          : 0
      ignoredCount =
        typeof instance?.ignored_lines === 'number' ? instance.ignored_lines : 0
      lastSyncAt =
        typeof instance?.last_scan_at === 'string' ? instance.last_scan_at : null
      parserVersion =
        typeof instance?.parser_version === 'string'
          ? instance.parser_version
          : null
      partial = unrecognizedCount > 0
      const sessionRow = one(`SELECT COUNT(*) AS c FROM conversations`)
      sessionCount = typeof sessionRow?.c === 'number' ? sessionRow.c : 0
      accounts = all(
        `SELECT DISTINCT account_scope_key AS k FROM requests ORDER BY k`,
      )
        .map((row) => (typeof row.k === 'string' ? row.k : ''))
        .filter((k) => k !== '')
      models = all(
        `SELECT DISTINCT model AS k FROM requests WHERE model IS NOT NULL AND model != '' ORDER BY k`,
      )
        .map((row) => (typeof row.k === 'string' ? row.k : ''))
        .filter((k) => k !== '')
      const span = one(
        `SELECT MIN(observed_at) AS a, MAX(observed_at) AS b FROM requests`,
      )
      if (typeof span?.a === 'string' && typeof span.b === 'string') {
        dateSpan = `${span.a.slice(0, 10)} – ${span.b.slice(0, 10)}`
      }
      const seen = new Set<string>()
      rates = all(
        `SELECT model, input_rate, cached_input_rate, output_rate,
                cache_write_rate, reasoning_rate, effective_from
         FROM pricing_versions
         ORDER BY model, effective_from DESC`,
      ).flatMap((row) => {
        const model = typeof row.model === 'string' ? row.model : ''
        if (model === '' || seen.has(model)) {
          return []
        }
        seen.add(model)
        return [
          {
            model,
            inputRate: typeof row.input_rate === 'string' ? row.input_rate : '',
            cachedInputRate:
              typeof row.cached_input_rate === 'string' ? row.cached_input_rate : '',
            outputRate: typeof row.output_rate === 'string' ? row.output_rate : '',
            cacheWriteRate:
              typeof row.cache_write_rate === 'string' ? row.cache_write_rate : null,
            reasoningRate:
              typeof row.reasoning_rate === 'string' ? row.reasoning_rate : null,
          },
        ]
      })
    }

    const rootState = !root.ok
      ? root.reason
      : !config.codexImportEnabled
        ? 'import-off'
        : 'ok'

    void this.panel.webview.postMessage({
      type: 'codex.status',
      importEnabled: config.codexImportEnabled,
      rootState,
      partial,
      unrecognizedCount,
      ignoredCount,
      rates,
      listRates: models.flatMap((model) => {
        const price = listPriceFor(model)
        if (price === null) {
          return []
        }
        return [
          {
            model,
            inputRate: price.inputRate,
            cachedInputRate: price.cachedInputRate,
            outputRate: price.outputRate,
            cacheWriteRate: price.cacheWriteRate,
            reasoningRate: null,
          },
        ]
      }),
      sessionCount,
      dateSpan,
      lastSyncAt,
      parserVersion,
      accounts,
      models,
      remoteWindow: typeof vscode.env.remoteName === 'string' && vscode.env.remoteName !== '',
      resolvedHome: root.ok ? root.realpath : null,
      sessionsPath,
      archivedSessionsPath,
      pointedAtSessions: root.ok && root.pointedAtSessions,
      rolloutsOnDisk,
    })
  }

  private async writeSetting(
    key: string,
    value: string | number | boolean,
  ): Promise<void> {
    const patch = asConfigPatch(key, value)
    if (patch) {
      // Apply immediately in-memory so the UI/bar update even if settings I/O fails.
      patchCursorCostConfigOverlay(patch)
    }
    try {
      // Window-scoped user prefs: always write Global (User settings.json).
      await vscode.workspace
        .getConfiguration('cursorCost')
        .update(key, value, vscode.ConfigurationTarget.Global)
      if (patch) {
        const cfgKey = Object.keys(patch)[0] as keyof CursorCostConfig | undefined
        if (cfgKey) {
          await this.globalState.update(persistedSettingKey(cfgKey), undefined)
        }
      }
    } catch (error) {
      if (isUnregisteredConfigError(error) && patch) {
        // Host registry can lag after VSIX upgrade / multi-version installs.
        // Keep the value in extension state so Apply still sticks.
        const cfgKey = Object.keys(patch)[0] as keyof CursorCostConfig | undefined
        if (cfgKey) {
          await this.globalState.update(persistedSettingKey(cfgKey), value)
        }
        this.publishAfterSetting(patch)
        return
      }
      const message = error instanceof Error ? error.message : String(error)
      const language = readCursorCostConfig(
        vscode.workspace.getConfiguration('cursorCost'),
      ).language
      void vscode.window.showErrorMessage(
        interpolate(catalogFor(language).alerts.saveSetting, { message }),
      )
      this.publishAfterSetting(patch)
      return
    }
    reconcileCursorCostConfigOverlay(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    this.publishAfterSetting(patch)
  }

  private publishAfterSetting(patch: Partial<CursorCostConfig> | undefined): void {
    const keys = patch ? Object.keys(patch) : []
    if (
      patch &&
      keys.length > 0 &&
      keys.every((key) => key === 'okColor' || key === 'warnColor')
    ) {
      this.postColors(patch)
      return
    }
    this.publisher.postData(patch)
  }

  private workspaceProject(): { key: string; label: string } {
    const folder = vscode.workspace.workspaceFolders?.[0]
    if (folder === undefined) {
      return { key: '', label: '' }
    }
    return {
      key: folder.uri.fsPath,
      label: basenameLabel(folder.uri.fsPath),
    }
  }

  private readOptimizedTargets(): OptimizedTargets {
    return parseOptimizedTargets(
      this.globalState.get(OPTIMIZED_TARGETS_STATE_KEY),
    )
  }

  private async persistOptimizedTarget(
    input: OptimizedTargetInput,
  ): Promise<void> {
    const current = this.readOptimizedTargets()
    const next = rememberOptimizedTarget(current, input)
    if (next === current) {
      return
    }
    await this.globalState.update(OPTIMIZED_TARGETS_STATE_KEY, next)
    this.publisher.postData()
  }

  /** Same newest-first sample Run Optimize already used for the prompt. */
  private async rememberLastRedTarget(config: CursorCostConfig): Promise<void> {
    const limit = sampleSizeLimit(config.historyLimit, config.historyFromDate)
    const sample = newestSample(this.service.getCachedQueries(), limit)
    const red = lastRedQuery(sample, config.spikeTokenThreshold)
    if (red === undefined) {
      return
    }
    await this.persistOptimizedTarget(optimizedTargetForQuery(red))
  }

  private readLifetimeSavings(): LifetimeSavings {
    return parseLifetimeSavings(
      this.globalState.get(LIFETIME_SAVINGS_STATE_KEY),
    )
  }

  /**
   * When `.ai/optimize-savings.md` has a new Optimize run, credit mid growth
   * into globalState (total + per workspace folder).
   */
  private async creditOptimizeSavings(
    savingsMarkdown: string | null,
  ): Promise<LifetimeSavings> {
    const current = this.readLifetimeSavings()
    const project = this.workspaceProject()
    if (project.key === '' || savingsMarkdown === null) {
      return current
    }
    const savings = parseOptimizeSavingsMarkdown(savingsMarkdown)
    if (!savings.hasProjection) {
      return current
    }
    const label =
      savings.project?.trim() || project.label || basenameLabel(project.key)
    const result = applyOptimizeCredit(current, project.key, {
      run: savings.run,
      tokensMid: savings.estTokensSaved,
      usdMid: savings.estUsdSaved,
      label,
    })
    if (!result.changed) {
      return current
    }
    await this.globalState.update(LIFETIME_SAVINGS_STATE_KEY, result.state)
    return result.state
  }

  /**
   * Refresh fires several snapshot updates in a row. Aborting the in-flight
   * line collect on each one dropped the full-window dashboard total and the
   * next paint stuck on the shorter fallback. Same calendar window reuses the
   * flight; a different repo or date range starts a new one.
   */
  private postColors(
    overrides?: Partial<Pick<CursorCostConfig, 'okColor' | 'warnColor'>>,
  ): void {
    const config = {
      ...readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost')),
      ...overrides,
    }
    const colors = resolveStatusColors(
      config,
      colorSchemeFromKind(vscode.window.activeColorTheme.kind),
    )
    void this.panel.webview.postMessage({
      type: 'colors',
      okColor: colors.okColor,
      warnColor: colors.warnColor,
    })
  }

  private postLeaderboardScript(): void {
    if (this.leaderboardScriptUri === '') {
      return
    }
    void this.panel.webview.postMessage({
      type: 'leaderboardScript',
      uri: this.leaderboardScriptUri,
    })
  }

  private renderHtml(webview: vscode.Webview, mediaRoot: vscode.Uri): string {
    const nonce = randomBytes(16).toString('base64')
    const htmlPath = vscode.Uri.joinPath(mediaRoot, 'history.html')
    const cacheKey = encodeURIComponent(this.panelVersion)
    const cssUri = `${webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'history.css')).toString()}?v=${cacheKey}`
    const limitsUri = `${webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'limits.js')).toString()}?v=${cacheKey}`
    const jsUri = `${webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'history.js')).toString()}?v=${cacheKey}`
    this.leaderboardScriptUri = `${webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'leaderboard.js')).toString()}?v=${cacheKey}`
    const leaderboardScript = this.leaderboardUnlocked()
      ? `<script nonce="${nonce}" src="${this.leaderboardScriptUri}"></script>`
      : ''
    const template = readFileSync(htmlPath.fsPath, 'utf8')
    return template
      .replaceAll('{{cspSource}}', webview.cspSource)
      .replaceAll('{{nonce}}', nonce)
      .replaceAll('{{cssUri}}', cssUri)
      .replaceAll('{{limitsUri}}', limitsUri)
      .replaceAll('{{jsUri}}', jsUri)
      .replaceAll('{{leaderboardScript}}', leaderboardScript)
      .replaceAll('{{exportCsvHref}}', `command:${EXPORT_CSV_COMMAND}`)
      .replaceAll('{{dashboardHref}}', `command:${OPEN_DASHBOARD_COMMAND}`)
      .replaceAll('{{pricingHref}}', `command:${OPEN_PRICING_COMMAND}`)
      .replaceAll('__EXTENSION_VERSION__', this.panelVersion)
  }

  private catalogForView(): ModelCatalogPayload | null {
    if (this.modelCatalog === null) {
      return null
    }
    const config = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    const limit = sampleSizeLimit(config.historyLimit, config.historyFromDate)
    const ids = [...this.service.getCachedQueries()]
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, limit)
      .map((query) => stripModelPrefix(query.model) ?? '')
    const priced = withRequestCounts(this.modelCatalog, ids)
    return {
      ...priced,
      accountKnown: this.accountModels !== null,
      lines: buildCatalogLines(priced, this.accountModels),
    }
  }

  private publishModelCatalog(force: boolean): void {
    void Promise.all([loadModelCatalog(force), this.loadAccountModels()]).then(
      ([catalog, account]) => {
        if (HistoryPanel.current !== this) {
          return
        }
        this.modelCatalog = catalog
        this.accountModels = account
        void this.panel.webview.postMessage({
          type: 'modelCatalog',
          modelCatalog: this.catalogForView(),
        })
      },
    )
  }

  private async loadAccountModels(): Promise<AccountModel[] | null> {
    try {
      const raw = await readStateDbItem(APPLICATION_USER_KEY, {
        locateWasm: (file) => join(__dirname, file),
      })
      if (raw === null) {
        return null
      }
      return parseAccountModels(raw)
    } catch {
      return null
    }
  }

  /**
   * Codes are bound to the Cursor account address. The address typed in the form is only a
   * fallback for hosts without a local session (Remote SSH), where that address is all we have.
   */
  private async applyUnlockCode(token: string, typedEmail: string): Promise<boolean> {
    const session = await readCursorSession({
      locateWasm: (file) => join(__dirname, file),
    })
    const accountEmail = session.ok ? (session.email ?? '') : ''
    const email = accountEmail || typedEmail
    const secret = unlockSecret()
    if (!verifyUnlockToken(email, token, secret)) {
      return false
    }
    await this.globalState.update(
      LEADERBOARD_UNLOCK_STATE_KEY,
      unlockStateFor(email, secret, Date.now()),
    )
    return true
  }

  private handleUnlockCode(token: string, typedEmail: string): void {
    const copy = catalogFor(
      readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost'))
        .language,
    ).support
    void this.applyUnlockCode(token, typedEmail).then(
      (ok) => {
        if (HistoryPanel.current !== this) {
          return
        }
        this.postAuthorMessageResult(
          ok,
          ok ? copy.codeApplied : copy.codeInvalid,
        )
        if (!ok) {
          return
        }
        this.postLeaderboardScript()
        this.publisher.postData()
        this.leaderboard.publishChrome()
      },
      () => {
        if (HistoryPanel.current !== this) {
          return
        }
        this.postAuthorMessageResult(false, copy.codeInvalid)
      },
    )
  }

  private deliverAuthorMessage(message: {
    body: unknown
    email: unknown
    raw: unknown
  }): void {
    const copy = catalogFor(
      readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost'))
        .language,
    ).support
    const token = parseUnlockRequest(message.body)
    if (token) {
      this.handleUnlockCode(
        token,
        typeof message.email === 'string' ? message.email : '',
      )
      return
    }
    const draft = parseAuthorMessage(message.raw)
    if (!draft) {
      this.postAuthorMessageResult(false, copy.messageInvalid)
      return
    }
    const topicLabel = {
      comment: copy.topicComment,
      feature: copy.topicFeature,
      bug: copy.topicBug,
      other: copy.topicOther,
    }[draft.topic]
    void postAuthorMessage(draft, new Date(), topicLabel).then(
      (result) => {
        if (HistoryPanel.current !== this) {
          return
        }
        if (result.activation) {
          this.postAuthorMessageResult(false, copy.mailActivate)
          return
        }
        this.postAuthorMessageResult(
          result.ok,
          result.ok ? copy.sent : copy.mailFailed,
        )
      },
      () => {
        if (HistoryPanel.current !== this) {
          return
        }
        this.postAuthorMessageResult(false, copy.mailFailed)
      },
    )
  }

  private postAuthorMessageResult(ok: boolean, detail: string): void {
    void this.panel.webview.postMessage({
      type: 'authorMessageResult',
      ok,
      detail,
    })
  }

  private dispose(): void {
    if (this.orgRefreshTimer) {
      clearTimeout(this.orgRefreshTimer)
      this.orgRefreshTimer = undefined
    }
    this.publisher.dispose()
    HistoryPanel.current = undefined
    for (const disposable of this.disposables) {
      disposable.dispose()
    }
  }
}

export async function saveQueriesCsv(
  queries: UsageQuery[],
  limit: number = DEFAULT_HISTORY_LIMIT,
  fromDate?: string | null,
  toDate?: string | null,
): Promise<void> {
  const historyLimit = clampHistoryLimit(limit)
  const iso = parseHistoryFromDate(fromDate)
  const toIso = parseHistoryFromDate(toDate)
  const csv = buildQueriesCsv(queries, historyLimit, iso)
  const fileName =
    iso === null
      ? `cursor-last-${historyLimit}.csv`
      : toIso !== null
        ? `cursor-from-${iso}-to-${toIso}.csv`
        : `cursor-from-${iso}.csv`
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.joinPath(
      vscode.Uri.file(homedir()),
      fileName,
    ),
    filters: { CSV: ['csv'] },
    saveLabel: catalogFor(
      readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost'))
        .language,
    ).alerts.export,
  })
  if (!uri) {
    return
  }
  await vscode.workspace.fs.writeFile(uri, Buffer.from(csv, 'utf8'))
}
