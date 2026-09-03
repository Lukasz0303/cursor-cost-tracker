import type * as vscode from 'vscode'
import {
  DEFAULT_CURSOR_COST_CONFIG,
  patchCursorCostConfigOverlay,
  type CursorCostConfig,
} from './config'

const CFG_PREFIX = 'cursorCost.cfg.'

export function persistedSettingKey(key: keyof CursorCostConfig): string {
  return `${CFG_PREFIX}${key}`
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
    Object.assign(patch, { [key]: stored })
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
