import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as vscode from 'vscode'
import {
  EXPORT_CSV_COMMAND,
  OPEN_DASHBOARD_COMMAND,
} from '../constants'
import {
  clampRecentQueryCount,
  colorSchemeFromKind,
  DEFAULT_OK_COLOR,
  DEFAULT_WARN_COLOR,
  parseBudgetDayBasis,
  parseHexColor,
  parseOptimizeDepth,
  patchCursorCostConfigOverlay,
  readCursorCostConfig,
  reconcileCursorCostConfigOverlay,
  resolveStatusColors,
  type BudgetDayBasis,
  type CursorCostConfig,
  type Locale,
  type OptimizeDepth,
} from '../config'
import {
  isUnregisteredConfigError,
  persistedSettingKey,
} from '../settingsStore'
import { catalogFor, interpolate } from '../i18n'
import { parseLocale } from '../locale'
import { parseHistoryFromDate } from '../historyFromDate'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
  lastQueriesTitle,
  sampleSizeLimit,
} from '../historyLimit'
import { codeLinesWindowFromSample } from '../codeLines/window'
import {
  clampCriticalCostUsdThreshold,
  clampCriticalTokenThreshold,
} from '../spikes/criticalAlert'
import {
  clampBurnRateMinQueries,
  clampBurnRateThresholds,
  clampBurnRateWindowMinutes,
} from '../burnRate/detect'
import { collectCodeLinesPayload } from '../codeLines/collect'
import {
  CODE_LINES_AUTHORS_STATE_KEY,
  parseStoredAuthorChoice,
} from '../codeLines/authorChoice'
import { readCursorSession } from '../usage/session'
import { clampSpikeTokenThreshold } from '../spikes/threshold'
import type { UsageQuery } from '../usage/types'
import {
  clampPollIntervalMinutes,
  type UsageService,
} from '../usage/service'
import { resolveExtensionVersion } from '../version'
import { resolveSupportUrl } from '../supportLinks'
import { buildQueriesCsv } from './exportCsv'
import { payloadForSnapshot } from './historyRows'
import { openOptimizeChat } from './openOptimizeChat'
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
import {
  readOptimizeSavingsMarkdown,
  watchOptimizeSavingsFile,
} from './optimizeSavingsFile'
import type { HistoryTab } from './statusBarView'

const VIEW_TYPE = 'cursorCost.history'
const HISTORY_TABS: HistoryTab[] = [
  'queries',
  'stats',
  'charts',
  'optimize',
  'support',
  'settings',
]

export function parseHistoryTab(value: unknown): HistoryTab {
  if (typeof value === 'string' && HISTORY_TABS.includes(value as HistoryTab)) {
    return value as HistoryTab
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'tab' in value &&
    typeof (value as { tab: unknown }).tab === 'string' &&
    HISTORY_TABS.includes((value as { tab: string }).tab as HistoryTab)
  ) {
    return (value as { tab: HistoryTab }).tab
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
    case 'showStatusBar':
    case 'showToday':
    case 'minimalMode':
    case 'showSpikeWarning':
    case 'showCriticalAlert':
    case 'burnRateGuard':
    case 'burnRateWarningToast':
    case 'burnRateCriticalToast':
    case 'codeLinesInsight':
      return { [key]: value === true }
    case 'budgetDayBasis':
      return { budgetDayBasis: parseBudgetDayBasis(value) }
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

export class HistoryPanel {
  private static current: HistoryPanel | undefined

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
      HistoryPanel.current.postData()
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
  private optimizeSavingsMarkdown: string | null = null
  private postDataSeq = 0
  private collectAbort: AbortController | undefined

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
        enableCommandUris: [EXPORT_CSV_COMMAND, OPEN_DASHBOARD_COMMAND],
        localResourceRoots: [mediaRoot],
      },
    )
    this.panel.webview.html = this.renderHtml(this.panel.webview, mediaRoot)

    this.disposables.push(
      this.panel.onDidDispose(() => {
        this.dispose()
      }),
      this.panel.webview.onDidReceiveMessage((message: unknown) => {
        this.onMessage(message)
      }),
      this.service.onDidChange(() => {
        this.postData()
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('cursorCost')) {
          this.postData()
        }
      }),
      vscode.window.onDidChangeActiveColorTheme(() => {
        this.postData()
      }),
      watchOptimizeSavingsFile(() => {
        this.postData()
      }),
    )
  }

  private openTab(tab: HistoryTab): void {
    this.pendingTab = tab
    void this.panel.webview.postMessage({ type: 'openTab', tab })
  }

  private onMessage(message: unknown): void {
    if (typeof message !== 'object' || message === null) {
      return
    }
    const type = (message as { type?: unknown }).type
    if (type === 'ready') {
      this.postData()
      this.openTab(this.pendingTab)
      return
    }
    if (type === 'close') {
      this.panel.dispose()
      return
    }
    if (type === 'refresh') {
      void this.service.refresh()
      return
    }
    if (type === 'exportCsv') {
      void saveQueriesCsv(this.service.getCachedQueries())
      return
    }
    if (type === 'openDashboard') {
      void vscode.commands.executeCommand(OPEN_DASHBOARD_COMMAND)
      return
    }
    if (type === 'openSupportLink') {
      const url = resolveSupportUrl((message as { id?: unknown }).id)
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
    if (type === 'setSpikeThreshold') {
      const raw = (message as { value?: unknown }).value
      const parsed = typeof raw === 'number' ? raw : Number(raw)
      void this.writeSetting(
        'spikeTokenThreshold',
        clampSpikeTokenThreshold(parsed),
      )
      return
    }
    if (type === 'setShowSpikeWarning') {
      void this.writeSetting(
        'showSpikeWarning',
        (message as { value?: unknown }).value === true,
      )
      return
    }
    if (type === 'setShowCriticalAlert') {
      void this.writeSetting(
        'showCriticalAlert',
        (message as { value?: unknown }).value === true,
      )
      return
    }
    if (type === 'setCriticalTokenThreshold') {
      const raw = (message as { value?: unknown }).value
      const parsed = typeof raw === 'number' ? raw : Number(raw)
      void this.writeSetting(
        'criticalTokenThreshold',
        clampCriticalTokenThreshold(parsed),
      )
      return
    }
    if (type === 'setCriticalCostUsdThreshold') {
      const raw = (message as { value?: unknown }).value
      const parsed = typeof raw === 'number' ? raw : Number(raw)
      void this.writeSetting(
        'criticalCostUsdThreshold',
        clampCriticalCostUsdThreshold(parsed),
      )
      return
    }
    if (type === 'setBurnRateGuard') {
      void this.writeSetting(
        'burnRateGuard',
        (message as { value?: unknown }).value === true,
      )
      return
    }
    if (type === 'setBurnRateWindowMinutes') {
      const raw = (message as { value?: unknown }).value
      const parsed = typeof raw === 'number' ? raw : Number(raw)
      void this.writeSetting(
        'burnRateWindowMinutes',
        clampBurnRateWindowMinutes(parsed),
      )
      return
    }
    if (type === 'setBurnRateWarningUsd' || type === 'setBurnRateCriticalUsd') {
      const raw = (message as { value?: unknown }).value
      const current = readCursorCostConfig(
        vscode.workspace.getConfiguration('cursorCost'),
      )
      const warning =
        type === 'setBurnRateWarningUsd'
          ? raw
          : current.burnRateWarningUsd
      const critical =
        type === 'setBurnRateCriticalUsd'
          ? raw
          : current.burnRateCriticalUsd
      const next = clampBurnRateThresholds(warning, critical)
      void this.writeSetting('burnRateWarningUsd', next.warningUsd)
      void this.writeSetting('burnRateCriticalUsd', next.criticalUsd)
      return
    }
    if (type === 'setBurnRateMinQueries') {
      const raw = (message as { value?: unknown }).value
      const parsed = typeof raw === 'number' ? raw : Number(raw)
      void this.writeSetting(
        'burnRateMinQueries',
        clampBurnRateMinQueries(parsed),
      )
      return
    }
    if (type === 'setBurnRateWarningToast') {
      void this.writeSetting(
        'burnRateWarningToast',
        (message as { value?: unknown }).value === true,
      )
      return
    }
    if (type === 'setBurnRateCriticalToast') {
      void this.writeSetting(
        'burnRateCriticalToast',
        (message as { value?: unknown }).value === true,
      )
      return
    }
    if (type === 'setCodeLinesInsight') {
      void this.writeSetting(
        'codeLinesInsight',
        (message as { value?: unknown }).value === true,
      )
      return
    }
    if (type === 'setCodeLinesAuthors') {
      const parsed = parseStoredAuthorChoice({
        emails: (message as { emails?: unknown }).emails,
        sumMultiple: (message as { sumMultiple?: unknown }).sumMultiple,
      })
      void this.workspaceState
        .update(
          CODE_LINES_AUTHORS_STATE_KEY,
          parsed ?? { emails: [], sumMultiple: false },
        )
        .then(() => {
          this.postData()
        })
      return
    }
    if (type === 'setShowStatusBar') {
      void this.writeSetting(
        'showStatusBar',
        (message as { value?: unknown }).value === true,
      )
      return
    }
    if (type === 'setShowToday') {
      void this.writeSetting(
        'showToday',
        (message as { value?: unknown }).value === true,
      )
      return
    }
    if (type === 'setMinimalMode') {
      void this.writeSetting(
        'minimalMode',
        (message as { value?: unknown }).value === true,
      )
      return
    }
    if (type === 'setRecentQueryCount') {
      const raw = (message as { value?: unknown }).value
      const parsed = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(parsed)) {
        return
      }
      void this.writeSetting(
        'recentQueryCount',
        clampRecentQueryCount(parsed),
      )
      return
    }
    if (type === 'setPollIntervalMinutes') {
      const raw = (message as { value?: unknown }).value
      const parsed = typeof raw === 'number' ? raw : Number(raw)
      void this.writeSetting(
        'pollIntervalMinutes',
        clampPollIntervalMinutes(parsed),
      )
      return
    }
    if (type === 'setBudgetDayBasis') {
      void this.writeSetting(
        'budgetDayBasis',
        parseBudgetDayBasis((message as { value?: unknown }).value),
      )
      return
    }
    if (type === 'setOptimizeDepth') {
      void this.writeSetting(
        'optimizeDepth',
        parseOptimizeDepth((message as { value?: unknown }).value),
      )
      return
    }
    if (type === 'setLanguage') {
      void this.writeSetting(
        'language',
        parseLocale((message as { value?: unknown }).value),
      )
      return
    }
    if (type === 'runOptimize') {
      const raw = (message as { depth?: unknown }).depth
      const depth =
        raw === 'quick' || raw === 'balanced' || raw === 'deep'
          ? raw
          : undefined
      void this.runOptimizeAction('chat', depth)
      return
    }
    if (type === 'copyOptimizePrompt') {
      const raw = (message as { depth?: unknown }).depth
      const depth =
        raw === 'quick' || raw === 'balanced' || raw === 'deep'
          ? raw
          : undefined
      void this.runOptimizeAction('copy', depth)
      return
    }
    if (type === 'setOkColor') {
      void this.writeSetting(
        'okColor',
        parseHexColor((message as { value?: unknown }).value, DEFAULT_OK_COLOR),
      )
      return
    }
    if (type === 'setWarnColor') {
      void this.writeSetting(
        'warnColor',
        parseHexColor((message as { value?: unknown }).value, DEFAULT_WARN_COLOR),
      )
      return
    }
    if (type === 'setHistoryLimit') {
      const raw = (message as { value?: unknown }).value
      const parsed = typeof raw === 'number' ? raw : Number(raw)
      void this.writeSetting('historyLimit', clampHistoryLimit(parsed)).then(
        async () => {
          const current = readCursorCostConfig(
            vscode.workspace.getConfiguration('cursorCost'),
          )
          if (current.historyFromDate !== null) {
            await this.writeSetting('historyFromDate', '')
          }
          void this.service.refresh()
        },
      )
      return
    }
    if (type === 'setHistoryFromDate') {
      const parsed = parseHistoryFromDate((message as { value?: unknown }).value)
      void this.writeSetting('historyFromDate', parsed ?? '').then(() => {
        void this.service.refresh()
      })
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
        this.postData(patch)
        return
      }
      const message = error instanceof Error ? error.message : String(error)
      const language = readCursorCostConfig(
        vscode.workspace.getConfiguration('cursorCost'),
      ).language
      void vscode.window.showErrorMessage(
        interpolate(catalogFor(language).alerts.saveSetting, { message }),
      )
      this.postData(patch)
      return
    }
    reconcileCursorCostConfigOverlay(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    this.postData(patch)
  }

  private async runOptimizeAction(
    mode: 'chat' | 'copy',
    depthOverride?: OptimizeDepth,
  ): Promise<void> {
    const savingsMarkdown = await readOptimizeSavingsMarkdown()
    this.optimizeSavingsMarkdown = savingsMarkdown
    const lifetime = await this.creditOptimizeSavings(savingsMarkdown)
    const project = this.workspaceProject()
    const config = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    const depth = depthOverride ?? config.optimizeDepth
    const optimize = payloadForSnapshot(
      this.service.getSnapshot(),
      this.service.getCachedQueries(),
      {
        spikeTokenThreshold: config.spikeTokenThreshold,
        showSpikeWarning: config.showSpikeWarning,
        historyLimit: config.historyLimit,
        historyFromDate: config.historyFromDate,
        optimizeDepth: depth,
        language: config.language,
        optimizeSavingsMarkdown: savingsMarkdown,
        optimizeProjectLabel: project.label,
        optimizeLifetimeSavings: lifetime,
      },
    ).optimize
    const prompt = optimize.prompts[depth] || optimize.prompt
    if (mode === 'chat') {
      void openOptimizeChat(prompt, undefined, config.language)
      return
    }
    await vscode.env.clipboard.writeText(prompt)
    void vscode.window.showInformationMessage('Optimize prompt copied.')
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

  private postData(
    overrides?: Partial<{
      spikeTokenThreshold: number
      showSpikeWarning: boolean
      showCriticalAlert: boolean
      criticalTokenThreshold: number
      criticalCostUsdThreshold: number
      okColor: string
      warnColor: string
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
      codeLinesInsight: boolean
      language: Locale
      refreshing: boolean
    }>,
  ): void {
    void this.postDataAsync(overrides)
  }

  private async postDataAsync(
    overrides?: Partial<{
      spikeTokenThreshold: number
      showSpikeWarning: boolean
      showCriticalAlert: boolean
      criticalTokenThreshold: number
      criticalCostUsdThreshold: number
      okColor: string
      warnColor: string
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
      codeLinesInsight: boolean
      language: Locale
      refreshing: boolean
    }>,
  ): Promise<void> {
    this.collectAbort?.abort()
    const collectAbort = new AbortController()
    this.collectAbort = collectAbort
    const seq = ++this.postDataSeq
    const savingsMarkdown = await readOptimizeSavingsMarkdown()
    if (seq !== this.postDataSeq) {
      return
    }
    this.optimizeSavingsMarkdown = savingsMarkdown
    const lifetime = await this.creditOptimizeSavings(savingsMarkdown)
    if (seq !== this.postDataSeq) {
      return
    }
    const project = this.workspaceProject()
    const snapshot = this.service.getSnapshot()
    const queries = this.service.getCachedQueries()
    const config = {
      ...readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost')),
      ...overrides,
    }
    const folder = vscode.workspace.workspaceFolders?.[0]
    const lineWindow = codeLinesWindowFromSample({
      queries,
      limit: sampleSizeLimit(config.historyLimit, config.historyFromDate),
      fromDate: config.historyFromDate,
    })
    const session = await readCursorSession({
      locateWasm: (file) => join(__dirname, file),
    })
    if (seq !== this.postDataSeq) {
      return
    }
    const codeLines = await collectCodeLinesPayload({
      enabled: config.codeLinesInsight,
      activeWorkspacePath: folder?.uri.fsPath ?? null,
      locale: config.language,
      sinceMs: lineWindow.sinceMs,
      untilMs: lineWindow.untilMs,
      cookie: session.ok ? session.cookie : null,
      cursorEmail: session.ok ? session.email : null,
      savedAuthors: parseStoredAuthorChoice(
        this.workspaceState.get(CODE_LINES_AUTHORS_STATE_KEY),
      ),
      signal: collectAbort.signal,
    })
    if (seq !== this.postDataSeq) {
      return
    }
    const colors = resolveStatusColors(
      config,
      colorSchemeFromKind(vscode.window.activeColorTheme.kind),
    )
    this.panel.title = lastQueriesTitle(
      config.historyLimit,
      config.historyFromDate,
      config.language,
    )
    void this.panel.webview.postMessage(
      payloadForSnapshot(snapshot, queries, {
        spikeTokenThreshold: config.spikeTokenThreshold,
        showSpikeWarning: config.showSpikeWarning,
        showCriticalAlert: config.showCriticalAlert,
        criticalTokenThreshold: config.criticalTokenThreshold,
        criticalCostUsdThreshold: config.criticalCostUsdThreshold,
        okColor: colors.okColor,
        warnColor: colors.warnColor,
        extensionVersion: this.panelVersion,
        historyLimit: config.historyLimit,
        historyFromDate: config.historyFromDate,
        pollIntervalMinutes: config.pollIntervalMinutes,
        showStatusBar: config.showStatusBar,
        showToday: config.showToday,
        minimalMode: config.minimalMode,
        recentQueryCount: config.recentQueryCount,
        budgetDayBasis: config.budgetDayBasis,
        optimizeDepth: config.optimizeDepth,
        burnRateGuard: config.burnRateGuard,
        burnRateWindowMinutes: config.burnRateWindowMinutes,
        burnRateWarningUsd: config.burnRateWarningUsd,
        burnRateCriticalUsd: config.burnRateCriticalUsd,
        burnRateMinQueries: config.burnRateMinQueries,
        burnRateWarningToast: config.burnRateWarningToast,
        burnRateCriticalToast: config.burnRateCriticalToast,
        codeLinesInsight: config.codeLinesInsight,
        codeLines,
        language: config.language,
        optimizeSavingsMarkdown: this.optimizeSavingsMarkdown,
        optimizeProjectLabel: project.label,
        optimizeLifetimeSavings: lifetime,
        refreshing: overrides?.refreshing ?? this.service.isRefreshing(),
      }),
    )
  }

  private renderHtml(webview: vscode.Webview, mediaRoot: vscode.Uri): string {
    const nonce = randomBytes(16).toString('base64')
    const htmlPath = vscode.Uri.joinPath(mediaRoot, 'history.html')
    const cacheKey = encodeURIComponent(this.panelVersion)
    const cssUri = `${webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'history.css')).toString()}?v=${cacheKey}`
    const jsUri = `${webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'history.js')).toString()}?v=${cacheKey}`
    const template = readFileSync(htmlPath.fsPath, 'utf8')
    return template
      .replaceAll('{{cspSource}}', webview.cspSource)
      .replaceAll('{{nonce}}', nonce)
      .replaceAll('{{cssUri}}', cssUri)
      .replaceAll('{{jsUri}}', jsUri)
      .replaceAll('{{exportCsvHref}}', `command:${EXPORT_CSV_COMMAND}`)
      .replaceAll('{{dashboardHref}}', `command:${OPEN_DASHBOARD_COMMAND}`)
      .replaceAll('__EXTENSION_VERSION__', this.panelVersion)
  }

  private dispose(): void {
    this.collectAbort?.abort()
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
): Promise<void> {
  const historyLimit = clampHistoryLimit(limit)
  const iso = parseHistoryFromDate(fromDate)
  const csv = buildQueriesCsv(queries, historyLimit, iso)
  const fileName =
    iso === null
      ? `cursor-last-${historyLimit}.csv`
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
