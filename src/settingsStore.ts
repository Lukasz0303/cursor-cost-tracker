import type * as vscode from 'vscode'
import {
  cursorCostConfigFrom,
  DEFAULT_CURSOR_COST_CONFIG,
  parseHexColor,
  patchCursorCostConfigOverlay,
  type CursorCostConfig,
} from './config'
import { parseHistoryFromDate } from './historyFromDate'
import { LOCALES } from './locale'
import { OPTIMIZE_DEPTHS } from './optimizeDepth'

const CFG_PREFIX = 'cursorCost.cfg.'

const BOOLEAN_KEYS = new Set<keyof CursorCostConfig>([
  'showStatusBar',
  'showToday',
  'minimalMode',
  'showSpikeWarning',
  'showCriticalAlert',
  'burnRateGuard',
  'burnRateWarningToast',
  'burnRateCriticalToast',
  'codeLinesInsight',
  'groupQueriesByConversation',
])

const NUMBER_KEYS = new Set<keyof CursorCostConfig>([
  'pollIntervalMinutes',
  'recentQueryCount',
  'spikeTokenThreshold',
  'criticalTokenThreshold',
  'criticalCostUsdThreshold',
  'burnRateWindowMinutes',
  'burnRateWarningUsd',
  'burnRateCriticalUsd',
  'burnRateMinQueries',
  'historyLimit',
])

export function persistedSettingKey(key: keyof CursorCostConfig): string {
  return `${CFG_PREFIX}${key}`
}

/**
 * Values saved when the configuration registry rejected a write.
 * Wrong types are dropped. Numbers are clamped the same way as a live setting.
 */
export function coercePersistedSetting(
  key: keyof CursorCostConfig,
  stored: unknown,
): CursorCostConfig[keyof CursorCostConfig] | undefined {
  if (BOOLEAN_KEYS.has(key)) {
    return typeof stored === 'boolean' ? stored : undefined
  }
  if (NUMBER_KEYS.has(key)) {
    if (typeof stored !== 'number' || !Number.isFinite(stored)) {
      return undefined
    }
    const config = cursorCostConfigFrom({
      get(name, fallback) {
        return name === key ? (stored as never) : fallback
      },
    })
    return config[key]
  }
  if (key === 'historyFromDate' || key === 'historyToDate') {
    if (stored === '' || stored === null) {
      return null
    }
    if (typeof stored !== 'string') {
      return undefined
    }
    return parseHistoryFromDate(stored) ?? undefined
  }
  if (key === 'language') {
    return typeof stored === 'string' &&
      (LOCALES as readonly string[]).includes(stored)
      ? (stored as CursorCostConfig['language'])
      : undefined
  }
  if (key === 'budgetDayBasis') {
    return stored === 'workingDays' || stored === 'calendarDays'
      ? stored
      : undefined
  }
  if (key === 'forecastWindow') {
    return stored === 'calendarMonth' || stored === 'billingCycle'
      ? stored
      : undefined
  }
  if (key === 'optimizeDepth') {
    return typeof stored === 'string' &&
      (OPTIMIZE_DEPTHS as readonly string[]).includes(stored)
      ? (stored as CursorCostConfig['optimizeDepth'])
      : undefined
  }
  if (key === 'okColor' || key === 'warnColor') {
    if (typeof stored !== 'string') {
      return undefined
    }
    if (!/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(stored.trim())) {
      return undefined
    }
    return parseHexColor(stored, DEFAULT_CURSOR_COST_CONFIG[key])
  }
  return undefined
}

/** Reload overrides saved when the configuration registry rejected a write. */
export function loadPersistedSettingOverrides(state: vscode.Memento): void {
  const patch: Partial<CursorCostConfig> = {}
  for (const key of Object.keys(
    DEFAULT_CURSOR_COST_CONFIG,
  ) as (keyof CursorCostConfig)[]) {
    const stored = state.get(persistedSettingKey(key))
    if (stored === undefined) {
      continue
    }
    const coerced = coercePersistedSetting(key, stored)
    if (coerced === undefined) {
      continue
    }
    Object.assign(patch, { [key]: coerced })
  }
  if (Object.keys(patch).length === 0) {
    return
  }
  patchCursorCostConfigOverlay(patch)
}

export function isUnregisteredConfigError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /not a registered configuration/i.test(message)
}
