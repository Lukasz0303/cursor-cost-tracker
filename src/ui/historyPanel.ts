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
import { loadModelCatalog } from '../pricing/load'
import type { ModelCatalogPayload } from '../pricing/parse'
import { withRequestCounts } from '../pricing/usageMatch'
import { stripModelPrefix } from '../usage/parse'
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
import { parseForecastWindow, type ForecastWindow } from '../forecastWindow'
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
import {
  isLeaderboardUnlocked,
  LEADERBOARD_UNLOCK_STATE_KEY,
  parseUnlockRequest,
  unlockStateFor,
  verifyUnlockToken,
} from '../unlock/leaderboardUnlock'
import { unlockSecret } from '../unlock/secret'
import { clampSpikeTokenThreshold } from '../spikes/threshold'
import type { UsageQuery } from '../usage/types'
import {
  clampPollIntervalMinutes,
  type UsageService,
} from '../usage/service'
import { resolveExtensionVersion } from '../version'
import { resolveSupportUrl } from '../supportLinks'
import {
  parseAuthorMessage,
  postAuthorMessage,
} from '../support/authorMessage'
import { nicknameFromCursorEmail } from '../support/nickname'
import { aggregateLeaderboard, leaderboardDailyChart } from '../leaderboard/aggregate'
import { isValidLeaderboardRange } from '../leaderboard/dates'
import {
  listCatalogGitRepos,
  listLeaderboardAuthors,
  previewLeaderboardRepos,
  scanLeaderboardRepos,
} from '../leaderboard/scan'
import {
  appendSavedRepos,
  parseLeaderboardSources,
  withExtraPath,
  setRepoIncluded,
  withoutExtraPath,
  type LeaderboardSources,
} from '../leaderboard/sources'
import { normalizeLeaderboardMerges } from '../leaderboard/merges'
import { normalizeTeamEmails } from '../leaderboard/team'
import type { LeaderboardPayload, LeaderboardRow } from '../leaderboard/types'
import { buildLeaderboardCsv, buildQueriesCsv } from './exportCsv'
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
const LEADERBOARD_RANGE_KEY = 'cursorCost.leaderboardRange'
const LEADERBOARD_SOURCES_KEY = 'cursorCost.leaderboardSources'
const LEADERBOARD_MY_REPOS_KEY = 'cursorCost.leaderboardMyRepos'
const LEADERBOARD_TEAM_KEY = 'cursorCost.leaderboardTeam'
const LEADERBOARD_MERGES_KEY = 'cursorCost.leaderboardMerges'
const HISTORY_TABS: HistoryTab[] = [
  'queries',
  'stats',
  'charts',
  'optimize',
  'leaderboard',
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

export class HistoryPanel {
  private static current: HistoryPanel | undefined

  static exportLeaderboard(): void {
    const panel = HistoryPanel.current
    if (!panel?.leaderboardUnlocked()) {
      return
    }
    void panel.saveLeaderboardCsv()
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
  private leaderboardSeq = 0
  private leaderboardRows: LeaderboardRow[] = []
  private leaderboardExportFrom = ''
  private leaderboardExportTo = ''
  private modelCatalog: ModelCatalogPayload | null = null

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

  private leaderboardUnlocked(): boolean {
    return isLeaderboardUnlocked(
      this.globalState.get(LEADERBOARD_UNLOCK_STATE_KEY),
    )
  }

  private openTab(tab: HistoryTab): void {
    const target =
      tab === 'leaderboard' && !this.leaderboardUnlocked() ? 'queries' : tab
    this.pendingTab = target
    void this.panel.webview.postMessage({ type: 'openTab', tab: target })
  }

  private onMessage(message: unknown): void {
    if (typeof message !== 'object' || message === null) {
      return
    }
    const type = (message as { type?: unknown }).type
    if (
      typeof type === 'string' &&
      type.toLowerCase().includes('leaderboard') &&
      !this.leaderboardUnlocked()
    ) {
      return
    }
    if (type === 'ready') {
      this.postData()
      this.publishModelCatalog(false)
      if (this.leaderboardUnlocked()) {
        this.postLeaderboardRange()
        this.postLeaderboardTeam(null, true)
        this.postLeaderboardMerges()
        void this.postLeaderboardRepos()
      }
      this.openTab(this.pendingTab)
      return
    }
    if (type === 'saveLeaderboardMerges') {
      void this.saveLeaderboardMerges((message as { groups?: unknown }).groups)
      return
    }
    if (type === 'saveLeaderboardTeam') {
      void this.saveLeaderboardTeam(stringListField(message, 'emails'))
      return
    }
    if (type === 'loadLeaderboardAuthors') {
      const from = stringField(message, 'from')
      const to = stringField(message, 'to')
      void this.loadLeaderboardAuthors(from, to)
      return
    }
    if (type === 'runLeaderboardScan') {
      const from = stringField(message, 'from')
      const to = stringField(message, 'to')
      const emails = stringListField(message, 'emails')
      void this.runLeaderboardScan(from, to, emails)
      return
    }
    if (type === 'refreshLeaderboardRepos') {
      void this.mergeCatalogRepos(this.readLeaderboardSources().catalog)
      return
    }
    if (type === 'saveLeaderboardRepos') {
      void this.saveLeaderboardRepos()
      return
    }
    if (type === 'applyLeaderboardMyRepos') {
      void this.applyLeaderboardMyRepos()
      return
    }
    if (type === 'previewLeaderboardMyRepos') {
      void this.previewLeaderboardMyRepos()
      return
    }
    if (type === 'pickLeaderboardCatalog') {
      void this.pickLeaderboardCatalog()
      return
    }
    if (type === 'clearLeaderboardCatalog') {
      const sources = this.readLeaderboardSources()
      void this.writeLeaderboardSources({ ...sources, catalog: '' })
      return
    }
    if (type === 'addLeaderboardRepo') {
      void this.addLeaderboardRepo(stringField(message, 'path'))
      return
    }
    if (type === 'pickLeaderboardRepo') {
      void this.pickLeaderboardRepo()
      return
    }
    if (type === 'setLeaderboardRepoIncluded') {
      const included = (message as { included?: unknown }).included === true
      void this.writeLeaderboardSources(
        setRepoIncluded(this.readLeaderboardSources(), stringField(message, 'path'), included),
      )
      return
    }
    if (type === 'removeLeaderboardRepo') {
      const sources = withoutExtraPath(
        this.readLeaderboardSources(),
        stringField(message, 'path'),
      )
      void this.writeLeaderboardSources(sources)
      return
    }
    if (type === 'exportLeaderboardCsv') {
      void this.saveLeaderboardCsv(stringListField(message, 'emails'))
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
    if (type === 'refreshModelCatalog') {
      this.publishModelCatalog(true)
      return
    }
    if (type === 'openModelSettings') {
      void vscode.commands
        .executeCommand('aiSettings.action.open', 'models')
        .then(undefined, () => {
          void vscode.commands.executeCommand('cursor.openCursorSettings')
        })
      return
    }
    if (type === 'openCursorBench') {
      void vscode.env.openExternal(
        vscode.Uri.parse('https://cursor.com/cursorbench'),
      )
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
    if (type === 'sendAuthorMessage') {
      this.deliverAuthorMessage(message)
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
    if (type === 'setForecastWindow') {
      void this.writeSetting(
        'forecastWindow',
        parseForecastWindow((message as { value?: unknown }).value),
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
      forecastWindow: ForecastWindow
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
      forecastWindow: ForecastWindow
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
        forecastWindow: config.forecastWindow,
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
        modelCatalog: this.catalogForView(),
        cursorNickname: nicknameFromCursorEmail(
          session.ok ? session.email : null,
        ),
        cursorEmail: session.ok ? session.email : null,
        leaderboardUnlocked: this.leaderboardUnlocked(),
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
      .replaceAll('{{pricingHref}}', `command:${OPEN_PRICING_COMMAND}`)
      .replaceAll('__EXTENSION_VERSION__', this.panelVersion)
  }

  private postLeaderboardRange(): void {
    const raw = this.globalState.get(LEADERBOARD_RANGE_KEY)
    const from =
      typeof raw === 'object' && raw !== null && typeof (raw as { from?: unknown }).from === 'string'
        ? (raw as { from: string }).from
        : ''
    const to =
      typeof raw === 'object' && raw !== null && typeof (raw as { to?: unknown }).to === 'string'
        ? (raw as { to: string }).to
        : ''
    void this.panel.webview.postMessage({ type: 'leaderboardRange', from, to })
  }

  private readLeaderboardTeam(): string[] {
    return normalizeTeamEmails(this.globalState.get(LEADERBOARD_TEAM_KEY))
  }

  private postLeaderboardTeam(status: string | null = null, apply = false): void {
    void this.panel.webview.postMessage({
      type: 'leaderboardTeam',
      emails: this.readLeaderboardTeam(),
      status,
      apply,
    })
  }

  private async saveLeaderboardTeam(emails: string[]): Promise<void> {
    const clean = normalizeTeamEmails(emails)
    const copy = this.leaderboardCopy()
    if (clean.length === 0) {
      this.postLeaderboardTeam(copy.teamNeedSelection)
      return
    }
    await this.globalState.update(LEADERBOARD_TEAM_KEY, clean)
    this.postLeaderboardTeam(copy.teamSaved.replace('{n}', String(clean.length)))
  }

  private readLeaderboardMerges(): string[][] {
    return normalizeLeaderboardMerges(this.globalState.get(LEADERBOARD_MERGES_KEY))
  }

  private postLeaderboardMerges(): void {
    void this.panel.webview.postMessage({
      type: 'leaderboardMerges',
      groups: this.readLeaderboardMerges(),
    })
  }

  private async saveLeaderboardMerges(groups: unknown): Promise<void> {
    await this.globalState.update(LEADERBOARD_MERGES_KEY, normalizeLeaderboardMerges(groups))
    this.postLeaderboardMerges()
  }

  private workspaceRoot(): string | null {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null
  }

  private leaderboardCopy(): ReturnType<typeof catalogFor>['leaderboard'] {
    return catalogFor(
      readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost')).language,
    ).leaderboard
  }

  private readLeaderboardSources(): LeaderboardSources {
    return parseLeaderboardSources(this.globalState.get(LEADERBOARD_SOURCES_KEY))
  }

  private async writeLeaderboardSources(
    sources: LeaderboardSources,
    status: string | null = null,
  ): Promise<void> {
    await this.globalState.update(LEADERBOARD_SOURCES_KEY, sources)
    await this.postLeaderboardRepos(status)
  }

  private async saveLeaderboardRepos(): Promise<void> {
    let sources = this.readLeaderboardSources()
    if (sources.saved.length === 0 && sources.extra.length === 0 && sources.catalog.trim() !== '') {
      const found = await listCatalogGitRepos(sources.catalog)
      sources = appendSavedRepos(sources, found).sources
    }
    await this.globalState.update(LEADERBOARD_MY_REPOS_KEY, sources.excluded)
    await this.writeLeaderboardSources(sources, this.leaderboardCopy().savedList)
  }

  private myReposExcluded(): string[] | null {
    const raw = this.globalState.get(LEADERBOARD_MY_REPOS_KEY)
    if (!Array.isArray(raw)) {
      return null
    }
    return raw.filter((item): item is string => typeof item === 'string')
  }

  private async previewLeaderboardMyRepos(): Promise<void> {
    const excluded = this.myReposExcluded()
    const copy = this.leaderboardCopy()
    if (excluded === null) {
      void this.panel.webview.postMessage({
        type: 'leaderboardMyReposPreview',
        repos: [],
        error: copy.myReposEmpty,
      })
      return
    }
    const sources = { ...this.readLeaderboardSources(), excluded }
    const preview = await previewLeaderboardRepos(this.workspaceRoot(), sources)
    void this.panel.webview.postMessage({
      type: 'leaderboardMyReposPreview',
      repos: preview.repos
        .filter((repo) => repo.included)
        .map((repo) => ({ label: repo.label, path: repo.path })),
      error: null,
    })
  }

  private async applyLeaderboardMyRepos(): Promise<void> {
    const excluded = this.myReposExcluded()
    const copy = this.leaderboardCopy()
    if (excluded === null) {
      await this.postLeaderboardRepos(copy.myReposEmpty)
      return
    }
    const sources = this.readLeaderboardSources()
    await this.writeLeaderboardSources(
      { ...sources, excluded },
      copy.myReposApplied,
    )
  }

  private async mergeCatalogRepos(catalog: string): Promise<void> {
    const trimmed = catalog.trim()
    if (trimmed === '') {
      await this.postLeaderboardRepos()
      return
    }
    let sources = this.readLeaderboardSources()
    if (
      sources.saved.length === 0 &&
      sources.extra.length === 0 &&
      sources.catalog.trim() !== '' &&
      sources.catalog.trim() !== trimmed
    ) {
      const previous = await listCatalogGitRepos(sources.catalog)
      sources = appendSavedRepos(sources, previous).sources
    }
    const found = await listCatalogGitRepos(trimmed)
    const merged = appendSavedRepos({ ...sources, catalog: trimmed }, found)
    const copy = this.leaderboardCopy()
    const status =
      merged.skipped > 0
        ? copy.scanAdded
            .replace('{added}', String(merged.added))
            .replace('{skipped}', String(merged.skipped))
        : null
    await this.writeLeaderboardSources(merged.sources, status)
  }

  private async postLeaderboardRepos(error: string | null = null): Promise<void> {
    const sources = this.readLeaderboardSources()
    const preview = await previewLeaderboardRepos(this.workspaceRoot(), sources)
    void this.panel.webview.postMessage({
      type: 'leaderboardRepos',
      catalog: sources.catalog,
      catalogMissing: preview.catalogMissing,
      repos: preview.repos,
      error,
    })
  }

  private async pickFolder(openLabel: string, start: string): Promise<string | null> {
    const defaultUri =
      start.trim() !== ''
        ? vscode.Uri.file(start)
        : this.workspaceRoot() !== null
          ? vscode.Uri.file(this.workspaceRoot() as string)
          : undefined
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel,
      defaultUri,
    })
    return picked?.[0]?.fsPath ?? null
  }

  private async pickLeaderboardCatalog(): Promise<void> {
    const copy = this.leaderboardCopy()
    const sources = this.readLeaderboardSources()
    const path = await this.pickFolder(copy.browse, sources.catalog)
    if (path === null) {
      return
    }
    await this.mergeCatalogRepos(path)
  }

  private async addLeaderboardRepo(path: string): Promise<void> {
    const copy = this.leaderboardCopy()
    const trimmed = path.trim()
    if (trimmed === '') {
      return
    }
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(trimmed))
      if (stat.type !== vscode.FileType.Directory) {
        await this.postLeaderboardRepos(copy.invalidRepo)
        return
      }
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(vscode.Uri.file(trimmed), '.git'))
    } catch {
      await this.postLeaderboardRepos(copy.invalidRepo)
      return
    }
    const sources = this.readLeaderboardSources()
    const next = withExtraPath(sources, trimmed)
    if (next === sources) {
      await this.postLeaderboardRepos(copy.duplicateRepo)
      return
    }
    await this.writeLeaderboardSources(next)
  }

  private async pickLeaderboardRepo(): Promise<void> {
    const copy = this.leaderboardCopy()
    const path = await this.pickFolder(copy.addRepo, '')
    if (path === null) {
      return
    }
    await this.addLeaderboardRepo(path)
  }

  private async rememberLeaderboardRange(from: string, to: string): Promise<void> {
    await this.globalState.update(LEADERBOARD_RANGE_KEY, { from, to })
  }

  private async loadLeaderboardAuthors(from: string, to: string): Promise<void> {
    const copy = this.leaderboardCopy()
    const sources = this.readLeaderboardSources()
    const root = this.workspaceRoot() ?? (sources.catalog.trim() || null)
    if (root === null && sources.extra.length === 0) {
      void this.panel.webview.postMessage({
        type: 'leaderboardAuthors',
        from,
        to,
        authors: [],
        error: copy.noWorkspace,
      })
      return
    }
    if (!isValidLeaderboardRange(from, to)) {
      void this.panel.webview.postMessage({
        type: 'leaderboardAuthors',
        from,
        to,
        authors: [],
        error: copy.badRange,
      })
      return
    }
    await this.rememberLeaderboardRange(from, to)
    const seq = ++this.leaderboardSeq
    try {
      const authors = await listLeaderboardAuthors(root ?? sources.extra[0] ?? '', from, to, {
        sources,
      })
      if (seq !== this.leaderboardSeq) {
        return
      }
      void this.panel.webview.postMessage({
        type: 'leaderboardAuthors',
        from,
        to,
        authors,
        error: null,
      })
    } catch {
      if (seq !== this.leaderboardSeq) {
        return
      }
      void this.panel.webview.postMessage({
        type: 'leaderboardAuthors',
        from,
        to,
        authors: [],
        error: copy.error,
      })
    }
  }

  private async runLeaderboardScan(
    from: string,
    to: string,
    emails: string[],
  ): Promise<void> {
    const copy = this.leaderboardCopy()
    const sources = this.readLeaderboardSources()
    const root = this.workspaceRoot() ?? (sources.catalog.trim() || sources.extra[0] || null)
    const empty: LeaderboardPayload = {
      status: 'error',
      from,
      to,
      rows: [],
      chart: null,
      reposScanned: 0,
      reposSkipped: 0,
      error: copy.badRange,
    }
    if (root === null) {
      empty.error = copy.noWorkspace
      this.postLeaderboard(empty)
      return
    }
    if (!isValidLeaderboardRange(from, to) || emails.length === 0) {
      this.postLeaderboard(empty)
      return
    }
    await this.rememberLeaderboardRange(from, to)
    const seq = ++this.leaderboardSeq
    this.leaderboardRows = []
    this.postLeaderboard({
      status: 'scanning',
      from,
      to,
      rows: [],
      chart: null,
      reposScanned: 0,
      reposSkipped: 0,
      error: null,
    })
    try {
      const piece = await scanLeaderboardRepos(root ?? '', from, to, {
        authorEmails: emails,
        sources,
      })
      if (seq !== this.leaderboardSeq) {
        return
      }
      const merges = this.readLeaderboardMerges()
      const rows = aggregateLeaderboard(piece.groups, emails, merges)
      const chart = leaderboardDailyChart(piece.groups, emails, merges, from, to)
      this.leaderboardRows = rows
      this.leaderboardExportFrom = from
      this.leaderboardExportTo = to
      this.postLeaderboard({
        status: 'ready',
        from,
        to,
        rows,
        chart,
        reposScanned: piece.reposScanned,
        reposSkipped: piece.reposSkipped,
        error: null,
      })
    } catch {
      if (seq !== this.leaderboardSeq) {
        return
      }
      this.postLeaderboard({
        status: 'error',
        from,
        to,
        rows: [],
        chart: null,
        reposScanned: 0,
        reposSkipped: 0,
        error: copy.error,
      })
    }
  }

  private postLeaderboard(payload: LeaderboardPayload): void {
    void this.panel.webview.postMessage({ type: 'leaderboard', leaderboard: payload })
  }

  private async saveLeaderboardCsv(order: string[] = []): Promise<void> {
    if (this.leaderboardRows.length === 0) {
      return
    }
    const rows = orderLeaderboardRows(this.leaderboardRows, order)
    await saveLeaderboardCsv(
      rows,
      this.leaderboardExportFrom,
      this.leaderboardExportTo,
    )
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
    return withRequestCounts(this.modelCatalog, ids)
  }

  private publishModelCatalog(force: boolean): void {
    void loadModelCatalog(force).then((catalog) => {
      if (HistoryPanel.current !== this) {
        return
      }
      this.modelCatalog = catalog
      void this.panel.webview.postMessage({
        type: 'modelCatalog',
        modelCatalog: this.catalogForView(),
      })
    })
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
        this.postData()
        this.postLeaderboardRange()
        this.postLeaderboardTeam(null, true)
        this.postLeaderboardMerges()
        void this.postLeaderboardRepos()
      },
      () => {
        if (HistoryPanel.current !== this) {
          return
        }
        this.postAuthorMessageResult(false, copy.codeInvalid)
      },
    )
  }

  private deliverAuthorMessage(message: unknown): void {
    const copy = catalogFor(
      readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost'))
        .language,
    ).support
    const token = parseUnlockRequest((message as { body?: unknown }).body)
    if (token) {
      const typed = (message as { email?: unknown }).email
      this.handleUnlockCode(token, typeof typed === 'string' ? typed : '')
      return
    }
    const draft = parseAuthorMessage(message)
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

export async function saveLeaderboardCsv(
  rows: readonly LeaderboardRow[],
  from: string,
  to: string,
): Promise<void> {
  if (rows.length === 0) {
    return
  }
  const csv = buildLeaderboardCsv(rows)
  const fileName =
    from !== '' && to !== ''
      ? `leaderboard-${from}-to-${to}.csv`
      : 'leaderboard.csv'
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.joinPath(vscode.Uri.file(homedir()), fileName),
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

function orderLeaderboardRows(
  rows: readonly LeaderboardRow[],
  order: readonly string[],
): LeaderboardRow[] {
  if (order.length === 0) {
    return [...rows]
  }
  const byEmail = new Map(rows.map((row) => [row.email.toLowerCase(), row]))
  const used = new Set<string>()
  const sorted: LeaderboardRow[] = []
  for (const email of order) {
    const row = byEmail.get(email.toLowerCase())
    if (row === undefined || used.has(row.email.toLowerCase())) {
      continue
    }
    used.add(row.email.toLowerCase())
    sorted.push(row)
  }
  for (const row of rows) {
    if (!used.has(row.email.toLowerCase())) {
      sorted.push(row)
    }
  }
  return sorted
}

function stringField(message: object, key: string): string {
  const value = (message as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

function stringListField(message: object, key: string): string[] {
  const value = (message as Record<string, unknown>)[key]
  if (!Array.isArray(value)) {
    return []
  }
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string' && item.trim() !== '') {
      out.push(item.trim())
    }
  }
  return out
}
