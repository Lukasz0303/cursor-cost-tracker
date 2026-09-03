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
  historyLimit: number
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
  historyLimit: DEFAULT_HISTORY_LIMIT,
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
    historyLimit: clampHistoryLimit(
      section.get('historyLimit', DEFAULT_CURSOR_COST_CONFIG.historyLimit),
    ),
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
