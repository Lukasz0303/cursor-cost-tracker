import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as vscode from 'vscode'
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
  parseOptimizeDepth,
  patchCursorCostConfigOverlay,
  readCursorCostConfig,
  reconcileCursorCostConfigOverlay,
  resolveStatusColors,
  type CursorCostConfig,
} from '../config'
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
import { parseWebviewMessage } from '../webview/messages'
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
      return { [key]: value === true }
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

export class HistoryPanel {
  private static current: HistoryPanel | undefined

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
  ): void {
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
      HistoryPanel.current.publisher.postData()
      return
    }
    HistoryPanel.current = new HistoryPanel(context, service, version, tab)
  }

  readonly panelVersion: string
  private readonly panel: vscode.WebviewPanel
  private readonly globalState: vscode.Memento
  private readonly workspaceState: vscode.Memento
  private readonly disposables: vscode.Disposable[] = []
  private pendingTab: HistoryTab
  private leaderboardScriptUri = ''
  private readonly leaderboard: LeaderboardHost
  private readonly settingsRouter: SettingsRouter
  private readonly optimizeRouter: OptimizeRouter
  private readonly publisher: PanelPublisher
  private modelCatalog: ModelCatalogPayload | null = null
  private accountModels: AccountModel[] | null = null

  private constructor(
    context: vscode.ExtensionContext,
    private readonly service: UsageService,
    version: string,
    initialTab: HistoryTab,
  ) {
    this.panelVersion = version
    this.globalState = context.globalState
    this.workspaceState = context.workspaceState
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
      case 'ready':
        this.publisher.postData()
        this.publishModelCatalog(false)
        if (this.leaderboardUnlocked()) {
          this.leaderboard.publishChrome()
        }
        this.openTab(this.pendingTab)
        return
      case 'close':
        this.panel.dispose()
        return
      case 'refresh':
        void this.service.refresh()
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
      default: {
        const unreachable: never = message
        return unreachable
      }
    }
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
