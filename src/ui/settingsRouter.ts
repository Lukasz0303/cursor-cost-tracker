import * as vscode from 'vscode'
import { parseBudgetDayBasis, parseHexColor, parseOptimizeDepth, readCursorCostConfig, DEFAULT_OK_COLOR, DEFAULT_WARN_COLOR } from '../config'
import { parseForecastWindow } from '../forecastWindow'
import { parseHistoryFromDate } from '../historyFromDate'
import { clampHistoryLimit } from '../historyLimit'
import { parseLocale } from '../locale'
import {
  CODE_LINES_AUTHORS_STATE_KEY,
  parseStoredAuthorChoice,
} from '../codeLines/authorChoice'
import {
  clampBurnRateMinQueries,
  clampBurnRateThresholds,
  clampBurnRateWindowMinutes,
} from '../burnRate/detect'
import {
  clampCriticalCostUsdThreshold,
  clampCriticalTokenThreshold,
} from '../spikes/criticalAlert'
import { clampSpikeTokenThreshold } from '../spikes/threshold'
import { clampPollIntervalMinutes, clampRecentQueryCount } from '../clamps'
import type { WebviewFlag, WebviewMessage } from '../webview/messages'

const SETTINGS_TYPES = [
  'setSpikeThreshold',
  'setShowSpikeWarning',
  'setShowCriticalAlert',
  'setCriticalTokenThreshold',
  'setCriticalCostUsdThreshold',
  'setBurnRateGuard',
  'setBurnRateWindowMinutes',
  'setBurnRateWarningUsd',
  'setBurnRateCriticalUsd',
  'setBurnRateMinQueries',
  'setBurnRateWarningToast',
  'setBurnRateCriticalToast',
  'setCodeLinesInsight',
  'setGroupQueriesByConversation',
  'setCodeLinesAuthors',
  'setShowStatusBar',
  'setShowToday',
  'setMinimalMode',
  'setRecentQueryCount',
  'setPollIntervalMinutes',
  'setBudgetDayBasis',
  'setForecastWindow',
  'setOptimizeDepth',
  'setLanguage',
  'setOkColor',
  'setWarnColor',
  'setHistoryLimit',
  'setHistoryFromDate',
  'setHistoryToDate',
  'setHistorySample',
] as const

type ListedSettingsType = (typeof SETTINGS_TYPES)[number] | WebviewFlag

export type SettingsMessage = Extract<WebviewMessage, { type: ListedSettingsType }>

export function isSettingsMessage(message: WebviewMessage): message is SettingsMessage {
  return (SETTINGS_TYPES as readonly string[]).includes(message.type)
}

export type SettingsRouterDeps = {
  writeSetting: (key: string, value: string | number | boolean) => Promise<void>
  postData: () => void
  refresh: () => void
  updateWorkspaceState: (key: string, value: unknown) => Thenable<void>
}

export class SettingsRouter {
  constructor(private readonly deps: SettingsRouterDeps) {}

  handle(message: SettingsMessage): void {
    switch (message.type) {
      case 'setSpikeThreshold':
        void this.deps.writeSetting(
          'spikeTokenThreshold',
          clampSpikeTokenThreshold(message.value),
        )
        return
      case 'setShowSpikeWarning':
        void this.deps.writeSetting('showSpikeWarning', message.value)
        return
      case 'setShowCriticalAlert':
        void this.deps.writeSetting('showCriticalAlert', message.value)
        return
      case 'setCriticalTokenThreshold':
        void this.deps.writeSetting(
          'criticalTokenThreshold',
          clampCriticalTokenThreshold(message.value),
        )
        return
      case 'setCriticalCostUsdThreshold':
        void this.deps.writeSetting(
          'criticalCostUsdThreshold',
          clampCriticalCostUsdThreshold(message.value),
        )
        return
      case 'setBurnRateGuard':
        void this.deps.writeSetting('burnRateGuard', message.value)
        return
      case 'setBurnRateWindowMinutes':
        void this.deps.writeSetting(
          'burnRateWindowMinutes',
          clampBurnRateWindowMinutes(message.value),
        )
        return
      case 'setBurnRateWarningUsd':
      case 'setBurnRateCriticalUsd': {
        const current = readCursorCostConfig(
          vscode.workspace.getConfiguration('cursorCost'),
        )
        const warning =
          message.type === 'setBurnRateWarningUsd'
            ? message.value
            : current.burnRateWarningUsd
        const critical =
          message.type === 'setBurnRateCriticalUsd'
            ? message.value
            : current.burnRateCriticalUsd
        const next = clampBurnRateThresholds(warning, critical)
        void this.deps.writeSetting('burnRateWarningUsd', next.warningUsd)
        void this.deps.writeSetting('burnRateCriticalUsd', next.criticalUsd)
        return
      }
      case 'setBurnRateMinQueries':
        void this.deps.writeSetting(
          'burnRateMinQueries',
          clampBurnRateMinQueries(message.value),
        )
        return
      case 'setBurnRateWarningToast':
        void this.deps.writeSetting('burnRateWarningToast', message.value)
        return
      case 'setBurnRateCriticalToast':
        void this.deps.writeSetting('burnRateCriticalToast', message.value)
        return
      case 'setCodeLinesInsight':
        void this.deps.writeSetting('codeLinesInsight', message.value)
        return
      case 'setGroupQueriesByConversation':
        void this.deps.writeSetting('groupQueriesByConversation', message.value)
        return
      case 'setCodeLinesAuthors': {
        const parsed = parseStoredAuthorChoice({
          emails: message.emails,
          sumMultiple: message.sumMultiple,
        })
        void this.deps
          .updateWorkspaceState(
            CODE_LINES_AUTHORS_STATE_KEY,
            parsed ?? { emails: [], sumMultiple: false },
          )
          .then(() => {
            this.deps.postData()
          })
        return
      }
      case 'setShowStatusBar':
        void this.deps.writeSetting('showStatusBar', message.value)
        return
      case 'setShowToday':
        void this.deps.writeSetting('showToday', message.value)
        return
      case 'setMinimalMode':
        void this.deps.writeSetting('minimalMode', message.value)
        return
      case 'setRecentQueryCount':
        if (!Number.isFinite(message.value)) {
          return
        }
        void this.deps.writeSetting(
          'recentQueryCount',
          clampRecentQueryCount(message.value),
        )
        return
      case 'setPollIntervalMinutes':
        void this.deps.writeSetting(
          'pollIntervalMinutes',
          clampPollIntervalMinutes(message.value),
        )
        return
      case 'setBudgetDayBasis':
        void this.deps.writeSetting(
          'budgetDayBasis',
          parseBudgetDayBasis(message.value),
        )
        return
      case 'setForecastWindow':
        void this.deps.writeSetting(
          'forecastWindow',
          parseForecastWindow(message.value),
        )
        return
      case 'setOptimizeDepth':
        void this.deps.writeSetting(
          'optimizeDepth',
          parseOptimizeDepth(message.value),
        )
        return
      case 'setLanguage':
        void this.deps.writeSetting('language', parseLocale(message.value))
        return
      case 'setOkColor':
        void this.deps.writeSetting(
          'okColor',
          parseHexColor(message.value, DEFAULT_OK_COLOR),
        )
        return
      case 'setWarnColor':
        void this.deps.writeSetting(
          'warnColor',
          parseHexColor(message.value, DEFAULT_WARN_COLOR),
        )
        return
      case 'setHistoryLimit':
        void this.deps.writeSetting('historyLimit', clampHistoryLimit(message.value)).then(
          async () => {
            const current = readCursorCostConfig(
              vscode.workspace.getConfiguration('cursorCost'),
            )
            if (current.historyFromDate !== null) {
              await this.deps.writeSetting('historyFromDate', '')
            }
            if (current.historyToDate !== null) {
              await this.deps.writeSetting('historyToDate', '')
            }
            this.deps.refresh()
          },
        )
        return
      case 'setHistoryFromDate': {
        const parsed = parseHistoryFromDate(message.value)
        void this.deps.writeSetting('historyFromDate', parsed ?? '').then(async () => {
          if (parsed === null) {
            await this.deps.writeSetting('historyToDate', '')
          }
          this.deps.refresh()
        })
        return
      }
      case 'setHistoryToDate': {
        const parsed = parseHistoryFromDate(message.value)
        void this.deps.writeSetting('historyToDate', parsed ?? '').then(() => {
          this.deps.refresh()
        })
        return
      }
      case 'setHistorySample':
        void (async () => {
          if (message.mode === 'lastN') {
            const raw = message.limit
            const parsed = typeof raw === 'number' ? raw : Number(raw)
            if (Number.isFinite(parsed)) {
              await this.deps.writeSetting('historyLimit', clampHistoryLimit(parsed))
            }
            await this.deps.writeSetting('historyFromDate', '')
            await this.deps.writeSetting('historyToDate', '')
          } else {
            const from = parseHistoryFromDate(message.fromDate)
            const to = parseHistoryFromDate(message.toDate)
            if (from === null) {
              return
            }
            await this.deps.writeSetting('historyFromDate', from)
            await this.deps.writeSetting('historyToDate', to ?? '')
          }
          this.deps.refresh()
        })()
        return
      default: {
        const unreachable: never = message
        return unreachable
      }
    }
  }
}
