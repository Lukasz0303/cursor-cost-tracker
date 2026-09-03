import { join } from 'node:path'
import * as vscode from 'vscode'
import {
  CURSOR_DASHBOARD_URL,
  EXPORT_CSV_COMMAND,
  OPEN_DASHBOARD_COMMAND,
} from './constants'
import { readCursorCostConfig } from './config'
import { loadPersistedSettingOverrides } from './settingsStore'
import { CriticalAlertController } from './ui/criticalAlert'
import { HistoryPanel, parseHistoryTab, saveQueriesCsv } from './ui/historyPanel'
import { StatusBarController } from './ui/statusBar'
import { fetchRecentEvents, fetchUsageSummary } from './usage/api'
import { readCursorSession } from './usage/session'
import { registerActivityRefresh } from './usage/activityRefresh'
import { UsageService } from './usage/service'

function readWorkspaceConfig(): ReturnType<typeof readCursorCostConfig> {
  return readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost'))
}

export function activate(context: vscode.ExtensionContext): void {
  loadPersistedSettingOverrides(context.globalState)
  const config = readWorkspaceConfig()
  const service = new UsageService(
    {
      readSession: () =>
        readCursorSession({
          locateWasm: (file) => join(__dirname, file),
        }),
      fetchSummary: fetchUsageSummary,
      fetchEvents: (cookie, signal) =>
        fetchRecentEvents(cookie, signal, {
          limit: readWorkspaceConfig().historyLimit,
        }),
    },
    { pollIntervalMinutes: config.pollIntervalMinutes },
  )

  service.start()
  StatusBarController.register(context, service)
  CriticalAlertController.register(context, service)

  context.subscriptions.push(
    service,
    registerActivityRefresh(service, vscode),
    vscode.commands.registerCommand('cursorCost.showHistory', (tab?: unknown) => {
      HistoryPanel.show(context, service, parseHistoryTab(tab))
    }),
    vscode.commands.registerCommand('cursorCost.refresh', () => {
      void service.refresh()
    }),
    vscode.commands.registerCommand(EXPORT_CSV_COMMAND, () => {
      void saveQueriesCsv(
        service.getCachedQueries(),
        readWorkspaceConfig().historyLimit,
      )
    }),
    vscode.commands.registerCommand(OPEN_DASHBOARD_COMMAND, () => {
      void vscode.env.openExternal(vscode.Uri.parse(CURSOR_DASHBOARD_URL))
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('cursorCost')) {
        return
      }
      const next = readWorkspaceConfig()
      service.reconfigure({ pollIntervalMinutes: next.pollIntervalMinutes })
      if (event.affectsConfiguration('cursorCost.historyLimit')) {
        void service.refresh()
      }
    }),
  )
}

export function deactivate(): void {}
