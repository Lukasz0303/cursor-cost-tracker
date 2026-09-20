import * as vscode from 'vscode'
import { readCursorCostConfig } from '../config'
import {
  BURN_RATE_SEEN_KEY,
  BURN_RATE_SNOOZE_MS,
  BURN_RATE_SNOOZE_UNTIL_KEY,
  decideBurnRateAlert,
  evaluateBurnRate,
} from '../burnRate/detect'
import { formatBurnRateToastCopy } from '../burnRate/copy'
import { catalogFor } from '../i18n'
import type { UsageService } from '../usage/service'
import { SHOW_HISTORY_COMMAND } from './statusBarView'

const COMPOSER_FOCUS = 'composer.focusComposer'
const COMPOSER_OPEN = 'composer.openComposer'

export class BurnRateAlertController implements vscode.Disposable {
  static register(
    context: vscode.ExtensionContext,
    service: UsageService,
  ): BurnRateAlertController {
    const controller = new BurnRateAlertController(context, service)
    context.subscriptions.push(controller)
    return controller
  }

  private lastSeenKey: string | undefined
  private snoozeUntilMs = 0
  private showing = false
  private readonly disposables: vscode.Disposable[] = []

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly service: UsageService,
  ) {
    this.lastSeenKey = readStoredKey(
      this.context.globalState.get(BURN_RATE_SEEN_KEY),
    )
    this.snoozeUntilMs = readStoredMs(
      this.context.globalState.get(BURN_RATE_SNOOZE_UNTIL_KEY),
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
    const nowMs = Date.now()
    const evaluated = evaluateBurnRate({
      queries: snapshot.data.recentQueries,
      enabled: config.burnRateGuard,
      windowMinutes: config.burnRateWindowMinutes,
      warningUsd: config.burnRateWarningUsd,
      criticalUsd: config.burnRateCriticalUsd,
      minQueries: config.burnRateMinQueries,
      nowMs,
    })
    const decision = decideBurnRateAlert({
      level: evaluated.level,
      window: evaluated.window,
      multiplier: evaluated.multiplier,
      warningToast: config.burnRateWarningToast,
      criticalToast: config.burnRateCriticalToast,
      lastSeenKey: this.lastSeenKey,
      snoozeUntilMs: this.snoozeUntilMs,
      nowMs,
    })
    if (decision.kind === 'skip') {
      return
    }
    if (decision.kind === 'remember') {
      void this.remember(decision.key)
      return
    }
    void this.present(decision, config.burnRateWindowMinutes)
  }

  private async remember(key: string): Promise<void> {
    this.lastSeenKey = key === '' ? undefined : key
    await this.context.globalState.update(
      BURN_RATE_SEEN_KEY,
      key === '' ? undefined : key,
    )
  }

  private async snooze(nowMs: number): Promise<void> {
    this.snoozeUntilMs = nowMs + BURN_RATE_SNOOZE_MS
    await this.context.globalState.update(
      BURN_RATE_SNOOZE_UNTIL_KEY,
      this.snoozeUntilMs,
    )
    await this.remember('')
  }

  private async present(
    decision: Extract<
      ReturnType<typeof decideBurnRateAlert>,
      { kind: 'alert' }
    >,
    windowMinutes: number,
  ): Promise<void> {
    if (this.showing) {
      return
    }
    this.showing = true
    try {
      await this.remember(decision.key)
      const nowMs = Date.now()
      const config = readCursorCostConfig(
        vscode.workspace.getConfiguration('cursorCost'),
      )
      const alerts = catalogFor(config.language).alerts
      const copy = formatBurnRateToastCopy(
        decision.episode,
        nowMs,
        windowMinutes,
        config.language,
      )
      const commands = await vscode.commands.getCommands(true)
      const focusAvailable = hasComposerFocus(commands)
      const buttons =
        decision.episode.level === 'critical' && focusAvailable
          ? [alerts.viewDetails, alerts.focusComposer, alerts.dismiss, alerts.snooze]
          : [alerts.viewDetails, alerts.dismiss, alerts.snooze]
      const show =
        decision.episode.level === 'critical'
          ? vscode.window.showErrorMessage
          : vscode.window.showWarningMessage
      const choice = await show(copy.message, ...buttons)
      if (choice === alerts.viewDetails) {
        await vscode.commands.executeCommand(SHOW_HISTORY_COMMAND, 'stats')
        return
      }
      if (choice === alerts.focusComposer) {
        await focusComposer(commands)
        return
      }
      if (choice === alerts.snooze) {
        await this.snooze(nowMs)
      }
    } finally {
      this.showing = false
      this.evaluate()
    }
  }
}

function hasComposerFocus(commands: readonly string[]): boolean {
  return commands.includes(COMPOSER_FOCUS) || commands.includes(COMPOSER_OPEN)
}

async function focusComposer(commands: readonly string[]): Promise<void> {
  if (commands.includes(COMPOSER_FOCUS)) {
    await vscode.commands.executeCommand(COMPOSER_FOCUS)
    return
  }
  if (commands.includes(COMPOSER_OPEN)) {
    await vscode.commands.executeCommand(COMPOSER_OPEN)
  }
}

function readStoredKey(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') {
    return undefined
  }
  return value
}

function readStoredMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  return value
}
