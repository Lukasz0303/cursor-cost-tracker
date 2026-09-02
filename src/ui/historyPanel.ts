import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import * as vscode from 'vscode'
import {
  EXPORT_CSV_COMMAND,
  OPEN_DASHBOARD_COMMAND,
} from '../constants'
import {
  colorSchemeFromKind,
  cursorCostConfigFrom,
  DEFAULT_OK_COLOR,
  DEFAULT_WARN_COLOR,
  parseHexColor,
  resolveStatusColors,
} from '../config'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
  lastQueriesTitle,
} from '../historyLimit'
import { clampSpikeTokenThreshold } from '../spikes/threshold'
import type { UsageQuery } from '../usage/types'
import type { UsageService } from '../usage/service'
import { resolveExtensionVersion } from '../version'
import { buildQueriesCsv } from './exportCsv'
import { payloadForSnapshot } from './historyRows'

const VIEW_TYPE = 'cursorCost.history'

function configTarget(
  section: vscode.WorkspaceConfiguration,
  key: string,
): vscode.ConfigurationTarget {
  const inspected = section.inspect(key)
  if (inspected?.workspaceFolderValue !== undefined) {
    return vscode.ConfigurationTarget.WorkspaceFolder
  }
  if (inspected?.workspaceValue !== undefined) {
    return vscode.ConfigurationTarget.Workspace
  }
  return vscode.ConfigurationTarget.Global
}

export class HistoryPanel {
  private static current: HistoryPanel | undefined

  static show(context: vscode.ExtensionContext, service: UsageService): void {
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
      HistoryPanel.current.postData()
      return
    }
    HistoryPanel.current = new HistoryPanel(context, service, version)
  }

  readonly panelVersion: string
  private readonly panel: vscode.WebviewPanel
  private readonly disposables: vscode.Disposable[] = []

  private constructor(
    context: vscode.ExtensionContext,
    private readonly service: UsageService,
    version: string,
  ) {
    this.panelVersion = version
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

  private onMessage(message: unknown): void {
    if (typeof message !== 'object' || message === null) {
      return
    }
    const type = (message as { type?: unknown }).type
    if (type === 'ready') {
      this.postData()
      return
    }
    if (type === 'close') {
      this.panel.dispose()
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
    const section = vscode.workspace.getConfiguration('cursorCost')
    try {
      await section.update(key, value, configTarget(section, key))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      void vscode.window.showErrorMessage(
        `Could not save Cursor Cost setting: ${message}`,
      )
      return
    }
    this.postData()
  }

  private postData(): void {
    const snapshot = this.service.getSnapshot()
    const queries = this.service.getCachedQueries()
    const config = cursorCostConfigFrom(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    const colors = resolveStatusColors(
      config,
      colorSchemeFromKind(vscode.window.activeColorTheme.kind),
    )
    this.panel.title = lastQueriesTitle(config.historyLimit)
    void this.panel.webview.postMessage(
      payloadForSnapshot(snapshot, queries, {
        spikeTokenThreshold: config.spikeTokenThreshold,
        showSpikeWarning: config.showSpikeWarning,
        okColor: colors.okColor,
        warnColor: colors.warnColor,
        extensionVersion: this.panelVersion,
        historyLimit: config.historyLimit,
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
