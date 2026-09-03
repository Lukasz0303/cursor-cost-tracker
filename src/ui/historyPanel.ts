import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
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
  parseHexColor,
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
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
  lastQueriesTitle,
} from '../historyLimit'
import {
  clampCriticalCostUsdThreshold,
  clampCriticalTokenThreshold,
} from '../spikes/criticalAlert'
import { clampSpikeTokenThreshold } from '../spikes/threshold'
import type { UsageQuery } from '../usage/types'
import {
  clampPollIntervalMinutes,
  type UsageService,
} from '../usage/service'
import { resolveExtensionVersion } from '../version'
import { buildQueriesCsv } from './exportCsv'
import { payloadForSnapshot } from './historyRows'
import type { HistoryTab } from './statusBarView'

const VIEW_TYPE = 'cursorCost.history'
const HISTORY_TABS: HistoryTab[] = ['queries', 'stats', 'charts', 'settings']

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
    case 'historyLimit':
      return { [key]: value as number }
    case 'showStatusBar':
    case 'showToday':
    case 'minimalMode':
    case 'showSpikeWarning':
    case 'showCriticalAlert':
      return { [key]: value === true }
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
  private readonly disposables: vscode.Disposable[] = []
  private pendingTab: HistoryTab

  private constructor(
    context: vscode.ExtensionContext,
    private readonly service: UsageService,
    version: string,
    initialTab: HistoryTab,
  ) {
    this.panelVersion = version
    this.globalState = context.globalState
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
        () => {
          void this.service.refresh()
        },
      )
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
      void vscode.window.showErrorMessage(
        `Could not save Cursor Cost setting: ${message}`,
      )
      this.postData(patch)
      return
    }
    reconcileCursorCostConfigOverlay(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    this.postData(patch)
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
      pollIntervalMinutes: number
      showStatusBar: boolean
      showToday: boolean
      minimalMode: boolean
      recentQueryCount: number
      refreshing: boolean
    }>,
  ): void {
    const snapshot = this.service.getSnapshot()
    const queries = this.service.getCachedQueries()
    const config = {
      ...readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost')),
      ...overrides,
    }
    const colors = resolveStatusColors(
      config,
      colorSchemeFromKind(vscode.window.activeColorTheme.kind),
    )
    this.panel.title = lastQueriesTitle(config.historyLimit)
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
        pollIntervalMinutes: config.pollIntervalMinutes,
        showStatusBar: config.showStatusBar,
        showToday: config.showToday,
        minimalMode: config.minimalMode,
        recentQueryCount: config.recentQueryCount,
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
    HistoryPanel.current = undefined
    for (const disposable of this.disposables) {
      disposable.dispose()
    }
  }
}

export async function saveQueriesCsv(
  queries: UsageQuery[],
  limit: number = DEFAULT_HISTORY_LIMIT,
): Promise<void> {
  const historyLimit = clampHistoryLimit(limit)
  const csv = buildQueriesCsv(queries, historyLimit)
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.joinPath(
      vscode.Uri.file(homedir()),
      `cursor-last-${historyLimit}.csv`,
    ),
    filters: { CSV: ['csv'] },
    saveLabel: 'Export',
  })
  if (!uri) {
    return
  }
  await vscode.workspace.fs.writeFile(uri, Buffer.from(csv, 'utf8'))
}
