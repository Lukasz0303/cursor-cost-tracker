import type { BudgetDayBasis } from '../budgetDayBasis'
import type { ForecastWindow } from '../forecastWindow'
import type { Locale } from '../locale'
import type { OptimizeDepth } from '../optimizeDepth'

/** Fields the panel may push before the configuration service has caught up. */
export type PanelDataOverrides = Partial<{
  spikeTokenThreshold: number
  showSpikeWarning: boolean
  showCriticalAlert: boolean
  criticalTokenThreshold: number
  criticalCostUsdThreshold: number
  okColor: string
  warnColor: string
  historyLimit: number
  historyFromDate: string | null
  historyToDate: string | null
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
}>
