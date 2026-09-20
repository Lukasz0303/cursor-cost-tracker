import * as vscode from 'vscode'
import { readCursorCostConfig } from '../config'
import { catalogFor } from '../i18n'
import {
  CRITICAL_ALERT_ALERTED_TS_KEY,
  CRITICAL_ALERT_SEEN_KEY,
  CRITICAL_ALERT_STATE_KEY,
  decideCriticalAlert,
  formatCriticalAlertCopy,
  type CriticalAlertDecision,
  type CriticalAlertThresholds,
} from '../spikes/criticalAlert'
import type { UsageService } from '../usage/service'
import { SHOW_HISTORY_COMMAND } from './statusBarView'

export class CriticalAlertController implements vscode.Disposable {
  static register(
    context: vscode.ExtensionContext,
    service: UsageService,
  ): CriticalAlertController {
    const controller = new CriticalAlertController(context, service)
    context.subscriptions.push(controller)
    return controller
  }

  private lastSeenKey: string | undefined
  private lastAlertedTimestamp: number | undefined
  private showing = false
  private readonly disposables: vscode.Disposable[] = []

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly service: UsageService,
  ) {
    this.lastSeenKey =
      readStoredKey(this.context.globalState.get(CRITICAL_ALERT_SEEN_KEY)) ??
      readStoredKey(this.context.globalState.get(CRITICAL_ALERT_STATE_KEY))
    this.lastAlertedTimestamp = readStoredTimestamp(
      this.context.globalState.get(CRITICAL_ALERT_ALERTED_TS_KEY),
    )
    this.disposables.push(
      this.service.onDidChange(() => {
        this.evaluate()
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('cursorCost')) {
          this.evaluate()
        }
      }),
    )
    this.evaluate()
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose()
    }
  }

  private evaluate(): void {
    if (this.showing) {
      return
    }
    const snapshot = this.service.getSnapshot()
    if (snapshot.status !== 'ready') {
      return
    }
    const config = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    const thresholds: CriticalAlertThresholds = {
      tokenThreshold: config.criticalTokenThreshold,
      costUsdThreshold: config.criticalCostUsdThreshold,
    }
    const decision = decideCriticalAlert({
      queries: snapshot.data.recentQueries,
      thresholds,
      enabled: config.showCriticalAlert,
      lastSeenKey: this.lastSeenKey,
      lastAlertedTimestamp: this.lastAlertedTimestamp,
    })
    if (decision.kind === 'skip') {
      return
    }
    if (decision.kind === 'remember') {
      void this.remember(decision.key)
      return
    }
    void this.present(decision, thresholds)
  }

  private async remember(key: string): Promise<void> {
    this.lastSeenKey = key
    await this.context.globalState.update(CRITICAL_ALERT_SEEN_KEY, key)
  }

  private async rememberAlerted(timestamp: number): Promise<void> {
    this.lastAlertedTimestamp = timestamp
    await this.context.globalState.update(
      CRITICAL_ALERT_ALERTED_TS_KEY,
      timestamp,
    )
  }

  private async present(
    decision: Extract<CriticalAlertDecision, { kind: 'alert' }>,
    thresholds: CriticalAlertThresholds,
  ): Promise<void> {
    if (this.showing) {
      return
    }
    this.showing = true
    try {
      const config = readCursorCostConfig(
        vscode.workspace.getConfiguration('cursorCost'),
      )
      const copy = formatCriticalAlertCopy(
        decision.query,
        thresholds,
        decision.breach,
        config.language,
      )
      const alerts = catalogFor(config.language).alerts
      const ignore = alerts.ignore
      const openHistory = alerts.openHistory
      // Persist before the modal so Cancel / Ignore / revised API totals do not re-fire.
      await this.remember(decision.key)
      await this.rememberAlerted(decision.query.timestamp)
      const choice = await vscode.window.showErrorMessage(
        copy.message,
        { modal: true, detail: copy.detail },
        ignore,
        openHistory,
      )
      if (choice === openHistory) {
        await vscode.commands.executeCommand(SHOW_HISTORY_COMMAND)
      }
    } finally {
      this.showing = false
      this.evaluate()
    }
  }
}

function readStoredKey(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') {
    return undefined
  }
  return value
}

function readStoredTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return value
}
