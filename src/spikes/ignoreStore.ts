import type { UsageQuery } from '../usage/types'
import { queryFingerprint } from './criticalAlert'
import { isSpike } from './threshold'

/** `globalState` key for dismissed spike fingerprints (PRD §8). */
export const IGNORED_SPIKES_KEY = 'cursorCost.ignoredSpikes'

/** Same formula as critical-alert fingerprint — stable across reload. */
export const spikeFingerprint = queryFingerprint

export type SpikeMemento = {
  get(key: string): unknown
  update(key: string, value: unknown): Thenable<void>
}

export type IgnoreStore = {
  list(): string[]
  has(key: string): boolean
  ignore(key: string): Promise<void>
}

export function parseIgnoredSpikes(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string' || item.length === 0) {
      continue
    }
    if (seen.has(item)) {
      continue
    }
    seen.add(item)
    out.push(item)
  }
  return out
}

export function createIgnoreStore(state: SpikeMemento): IgnoreStore {
  return {
    list(): string[] {
      return parseIgnoredSpikes(state.get(IGNORED_SPIKES_KEY))
    },
    has(key: string): boolean {
      if (key.length === 0) {
        return false
      }
      return parseIgnoredSpikes(state.get(IGNORED_SPIKES_KEY)).includes(key)
    },
    async ignore(key: string): Promise<void> {
      if (key.length === 0) {
        return
      }
      const current = parseIgnoredSpikes(state.get(IGNORED_SPIKES_KEY))
      if (current.includes(key)) {
        return
      }
      await state.update(IGNORED_SPIKES_KEY, [...current, key])
    },
  }
}

/** Spike at/over Warn at that the user has not dismissed. */
export function isActiveSpike(
  query: UsageQuery,
  threshold: number,
  ignored: ReadonlySet<string> | readonly string[],
): boolean {
  if (!isSpike(query.tokens, threshold)) {
    return false
  }
  const key = spikeFingerprint(query)
  if ('has' in ignored) {
    return !ignored.has(key)
  }
  return !ignored.includes(key)
}

export function ignoredSetFrom(raw: unknown): Set<string> {
  return new Set(parseIgnoredSpikes(raw))
}
