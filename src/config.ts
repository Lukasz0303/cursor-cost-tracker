import {
  DEFAULT_BUDGET_DAY_BASIS,
  parseBudgetDayBasis,
  type BudgetDayBasis,
} from './budgetDayBasis'
import {
  DEFAULT_OPTIMIZE_DEPTH,
  parseOptimizeDepth,
  type OptimizeDepth,
} from './optimizeDepth'
import { parseHistoryFromDate } from './historyFromDate'
import {
  clampHistoryLimit,
  DEFAULT_HISTORY_LIMIT,
} from './historyLimit'
import { clampPollIntervalMinutes } from './usage/service'
import {
  clampCriticalCostUsdThreshold,
  clampCriticalTokenThreshold,
  DEFAULT_CRITICAL_COST_USD_THRESHOLD,
  DEFAULT_CRITICAL_TOKEN_THRESHOLD,
} from './spikes/criticalAlert'
import {
  clampSpikeTokenThreshold,
  DEFAULT_SPIKE_TOKEN_THRESHOLD,
} from './spikes/threshold'
import {
  clampBurnRateMinQueries,
  clampBurnRateThresholds,
  clampBurnRateWindowMinutes,
  DEFAULT_BURN_RATE_CRITICAL_USD,
  DEFAULT_BURN_RATE_MIN_QUERIES,
  DEFAULT_BURN_RATE_WARNING_USD,
  DEFAULT_BURN_RATE_WINDOW_MINUTES,
} from './burnRate/detect'
import { DEFAULT_LOCALE, parseLocale, type Locale } from './locale'

export type { BudgetDayBasis, Locale, OptimizeDepth }
export { DEFAULT_BUDGET_DAY_BASIS, parseBudgetDayBasis }
export { DEFAULT_LOCALE, parseLocale }
export { DEFAULT_OPTIMIZE_DEPTH, parseOptimizeDepth }

const HEX_COLOR = /^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i

export const MIN_RECENT_QUERY_COUNT = 1
export const MAX_RECENT_QUERY_COUNT = 10
export const DEFAULT_RECENT_QUERY_COUNT = 3

export function clampRecentQueryCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_RECENT_QUERY_COUNT
  }
  return Math.min(
    MAX_RECENT_QUERY_COUNT,
    Math.max(MIN_RECENT_QUERY_COUNT, Math.round(parsed)),
  )
}

/** VS Code ColorThemeKind.Light / HighContrastLight. */
const LIGHT_THEME_KIND = 1
const HIGH_CONTRAST_LIGHT_THEME_KIND = 4

/** Dark-theme defaults (VS Code charts.green / charts.red). */
export const DEFAULT_OK_COLOR = '#89D185'
export const DEFAULT_WARN_COLOR = '#F14C4C'
/** Darker defaults so mint/salmon still read on a light status bar. */
export const DEFAULT_OK_COLOR_LIGHT = '#18794E'
export const DEFAULT_WARN_COLOR_LIGHT = '#C50F1F'

const ADAPTIVE_OK_COLORS = new Set([DEFAULT_OK_COLOR, DEFAULT_OK_COLOR_LIGHT])
const ADAPTIVE_WARN_COLORS = new Set([
  DEFAULT_WARN_COLOR,
  DEFAULT_WARN_COLOR_LIGHT,
])

export type ColorScheme = 'light' | 'dark'

export function colorSchemeFromKind(kind: number): ColorScheme {
  if (kind === LIGHT_THEME_KIND || kind === HIGH_CONTRAST_LIGHT_THEME_KIND) {
    return 'light'
  }
  return 'dark'
}

function resolveAdaptiveColor(
  configured: string,
  scheme: ColorScheme,
  adaptive: ReadonlySet<string>,
  dark: string,
  light: string,
): string {
  if (!adaptive.has(configured.toUpperCase())) {
    return configured
  }
  if (scheme === 'light') {
    return light
  }
  return dark
}

export function resolveStatusColors(
  colors: Pick<CursorCostConfig, 'okColor' | 'warnColor'>,
  scheme: ColorScheme,
): Pick<CursorCostConfig, 'okColor' | 'warnColor'> {
  return {
    okColor: resolveAdaptiveColor(
      colors.okColor,
      scheme,
      ADAPTIVE_OK_COLORS,
      DEFAULT_OK_COLOR,
      DEFAULT_OK_COLOR_LIGHT,
    ),
    warnColor: resolveAdaptiveColor(
      colors.warnColor,
      scheme,
      ADAPTIVE_WARN_COLORS,
      DEFAULT_WARN_COLOR,
      DEFAULT_WARN_COLOR_LIGHT,
    ),
  }
}

export type CursorCostConfig = {
  pollIntervalMinutes: number
  showStatusBar: boolean
  showToday: boolean
  minimalMode: boolean
  recentQueryCount: number
  spikeTokenThreshold: number
  showSpikeWarning: boolean
  showCriticalAlert: boolean
  criticalTokenThreshold: number
  criticalCostUsdThreshold: number
  burnRateGuard: boolean
  burnRateWindowMinutes: number
  burnRateWarningUsd: number
  burnRateCriticalUsd: number
  burnRateMinQueries: number
  burnRateWarningToast: boolean
  burnRateCriticalToast: boolean
  codeLinesInsight: boolean
  historyLimit: number
  /** Local `YYYY-MM-DD`; `null` uses Last N (`historyLimit`). */
  historyFromDate: string | null
  budgetDayBasis: BudgetDayBasis
  optimizeDepth: OptimizeDepth
  language: Locale
  okColor: string
  warnColor: string
}

export const DEFAULT_CURSOR_COST_CONFIG: CursorCostConfig = {
  pollIntervalMinutes: 1,
  showStatusBar: true,
  showToday: true,
  minimalMode: false,
  recentQueryCount: DEFAULT_RECENT_QUERY_COUNT,
  spikeTokenThreshold: DEFAULT_SPIKE_TOKEN_THRESHOLD,
  showSpikeWarning: true,
  showCriticalAlert: true,
  criticalTokenThreshold: DEFAULT_CRITICAL_TOKEN_THRESHOLD,
  criticalCostUsdThreshold: DEFAULT_CRITICAL_COST_USD_THRESHOLD,
  burnRateGuard: true,
  burnRateWindowMinutes: DEFAULT_BURN_RATE_WINDOW_MINUTES,
  burnRateWarningUsd: DEFAULT_BURN_RATE_WARNING_USD,
  burnRateCriticalUsd: DEFAULT_BURN_RATE_CRITICAL_USD,
  burnRateMinQueries: DEFAULT_BURN_RATE_MIN_QUERIES,
  burnRateWarningToast: true,
  burnRateCriticalToast: true,
  codeLinesInsight: true,
  historyLimit: DEFAULT_HISTORY_LIMIT,
  historyFromDate: null,
  budgetDayBasis: DEFAULT_BUDGET_DAY_BASIS,
  optimizeDepth: DEFAULT_OPTIMIZE_DEPTH,
  language: DEFAULT_LOCALE,
  okColor: DEFAULT_OK_COLOR,
  warnColor: DEFAULT_WARN_COLOR,
}

export type ConfigSection = {
  get<T>(key: string, defaultValue: T): T
}

export function parseHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }
  const trimmed = value.trim()
  if (!HEX_COLOR.test(trimmed)) {
    return fallback
  }
  const hex = trimmed.toUpperCase()
  if (hex.length === 4) {
    const r = hex[1]
    const g = hex[2]
    const b = hex[3]
    if (!r || !g || !b) {
      return fallback
    }
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return hex.slice(0, 7)
}

export function cursorCostConfigFrom(section: ConfigSection): CursorCostConfig {
  const burnUsd = clampBurnRateThresholds(
    section.get(
      'burnRateWarningUsd',
      DEFAULT_CURSOR_COST_CONFIG.burnRateWarningUsd,
    ),
    section.get(
      'burnRateCriticalUsd',
      DEFAULT_CURSOR_COST_CONFIG.burnRateCriticalUsd,
    ),
  )
  return {
    pollIntervalMinutes: clampPollIntervalMinutes(
      section.get(
        'pollIntervalMinutes',
        DEFAULT_CURSOR_COST_CONFIG.pollIntervalMinutes,
      ),
    ),
    showStatusBar: section.get('showStatusBar', true) === true,
    showToday: section.get('showToday', true) === true,
    minimalMode: section.get('minimalMode', DEFAULT_CURSOR_COST_CONFIG.minimalMode) === true,
    recentQueryCount: clampRecentQueryCount(
      section.get(
        'recentQueryCount',
        DEFAULT_CURSOR_COST_CONFIG.recentQueryCount,
      ),
    ),
    spikeTokenThreshold: clampSpikeTokenThreshold(
      section.get(
        'spikeTokenThreshold',
        DEFAULT_CURSOR_COST_CONFIG.spikeTokenThreshold,
      ),
    ),
    showSpikeWarning: section.get('showSpikeWarning', true) === true,
    showCriticalAlert: section.get('showCriticalAlert', true) === true,
    criticalTokenThreshold: clampCriticalTokenThreshold(
      section.get(
        'criticalTokenThreshold',
        DEFAULT_CURSOR_COST_CONFIG.criticalTokenThreshold,
      ),
    ),
    criticalCostUsdThreshold: clampCriticalCostUsdThreshold(
      section.get(
        'criticalCostUsdThreshold',
        DEFAULT_CURSOR_COST_CONFIG.criticalCostUsdThreshold,
      ),
    ),
    burnRateGuard: section.get('burnRateGuard', true) === true,
    burnRateWindowMinutes: clampBurnRateWindowMinutes(
      section.get(
        'burnRateWindowMinutes',
        DEFAULT_CURSOR_COST_CONFIG.burnRateWindowMinutes,
      ),
    ),
    burnRateWarningUsd: burnUsd.warningUsd,
    burnRateCriticalUsd: burnUsd.criticalUsd,
    burnRateMinQueries: clampBurnRateMinQueries(
      section.get(
        'burnRateMinQueries',
        DEFAULT_CURSOR_COST_CONFIG.burnRateMinQueries,
      ),
    ),
    burnRateWarningToast: section.get('burnRateWarningToast', true) === true,
    burnRateCriticalToast: section.get('burnRateCriticalToast', true) === true,
    codeLinesInsight: section.get('codeLinesInsight', true) === true,
    historyLimit: clampHistoryLimit(
      section.get('historyLimit', DEFAULT_CURSOR_COST_CONFIG.historyLimit),
    ),
    historyFromDate: parseHistoryFromDate(section.get('historyFromDate', '')),
    budgetDayBasis: parseBudgetDayBasis(
      section.get('budgetDayBasis', DEFAULT_BUDGET_DAY_BASIS),
    ),
    optimizeDepth: parseOptimizeDepth(
      section.get('optimizeDepth', DEFAULT_OPTIMIZE_DEPTH),
    ),
    language: parseLocale(section.get('language', DEFAULT_LOCALE)),
    okColor: parseHexColor(
      section.get('okColor', DEFAULT_OK_COLOR),
      DEFAULT_OK_COLOR,
    ),
    warnColor: parseHexColor(
      section.get('warnColor', DEFAULT_WARN_COLOR),
      DEFAULT_WARN_COLOR,
    ),
  }
}

export function readCursorCostConfig(section: ConfigSection): CursorCostConfig {
  return {
    ...cursorCostConfigFrom(section),
    ...configOverlay,
  }
}

type ConfigOverlay = Partial<CursorCostConfig>

let configOverlay: ConfigOverlay = {}
const overlayListeners = new Set<() => void>()

/** In-memory patch so the status bar updates even if settings.json lags. */
export function patchCursorCostConfigOverlay(patch: ConfigOverlay): void {
  configOverlay = { ...configOverlay, ...patch }
  for (const listener of [...overlayListeners]) {
    listener()
  }
}

export function clearCursorCostConfigOverlay(): void {
  if (Object.keys(configOverlay).length === 0) {
    return
  }
  configOverlay = {}
  for (const listener of [...overlayListeners]) {
    listener()
  }
}

/** Drop overlay keys that now match the persisted configuration. */
export function reconcileCursorCostConfigOverlay(section: ConfigSection): void {
  if (Object.keys(configOverlay).length === 0) {
    return
  }
  const disk = cursorCostConfigFrom(section)
  const next: ConfigOverlay = { ...configOverlay }
  let changed = false
  for (const key of Object.keys(next) as (keyof CursorCostConfig)[]) {
    if (next[key] === disk[key]) {
      delete next[key]
      changed = true
    }
  }
  if (!changed) {
    return
  }
  configOverlay = next
}

export function onDidChangeCursorCostConfigOverlay(
  listener: () => void,
): { dispose: () => void } {
  overlayListeners.add(listener)
  return {
    dispose: (): void => {
      overlayListeners.delete(listener)
    },
  }
}
