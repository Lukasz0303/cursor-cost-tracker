import { watch as fsWatch, type FSWatcher } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { ROLLOUT_PARSER_VERSION } from './domain'
import {
  discoverRolloutFiles,
  type DiscoveredFile,
  type FsDeps,
} from './codex/discover'
import { importDiscoveredFile } from './codex/importer'
import {
  applySessionTitles,
  parseSessionIndex,
  sessionIndexCandidates,
} from './codex/sessionIndex'
import { repriceUnpricedRequests } from './pricing/reprice'
import { rewindParserVersion } from './store/parserUpgrade'
import {
  sessionsDirectoryExists,
  type ResolvedCodexRoot,
} from './codex/sourceRoot'
import type { LeaseRole } from './store/storeLease'
import type { RequestStore } from './store/types'

const WATCH_DEBOUNCE_MS = 750
/** Matches `cursorCost.pollIntervalMinutes` default (1). */
const DEFAULT_SCAN_INTERVAL_MS = 60_000

export type HistoryServiceOptions = {
  importEnabled: boolean
  resolveRoot: () => Promise<ResolvedCodexRoot>
  discover: typeof discoverRolloutFiles
  store: RequestStore
  lease: () => Promise<LeaseRole>
  now: () => number
  deviceId?: string
  readFrom?: (path: string, offset: number) => Promise<Uint8Array>
  fsDeps?: FsDeps
  watchRoot?: (
    rootRealpath: string,
    onChange: () => void,
  ) => { close(): void } | FSWatcher
  /** Auto-import period. The host passes `pollIntervalMinutes` × 60s. */
  scanIntervalMs?: number
  /** Fired after a scan so the open Codex view can repaint. */
  onAfterRefresh?: () => void
  setIntervalFn?: typeof setInterval
  clearIntervalFn?: typeof clearInterval
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
}

export class HistoryService {
  private readonly options: HistoryServiceOptions
  private running = false
  private refreshInFlight = false
  private dirty = false
  private timer: ReturnType<typeof setInterval> | null = null
  private watcher: { close(): void } | null = null
  private watchDebounce: ReturnType<typeof setTimeout> | null = null
  /** Remembered for phase 3 while import is off. */
  sessionsFound = false

  constructor(options: HistoryServiceOptions) {
    this.options = options
  }

  start(): void {
    if (this.running) {
      return
    }
    this.running = true
    if (!this.options.importEnabled) {
      return
    }

    this.armTimer()

    void this.refresh().then(() => {
      void this.ensureWatcher()
    })
  }

  async refresh(): Promise<void> {
    if (this.refreshInFlight) {
      this.dirty = true
      return
    }
    this.refreshInFlight = true
    try {
      do {
        this.dirty = false
        await this.runOnce()
      } while (this.dirty)
      this.options.onAfterRefresh?.()
    } finally {
      this.refreshInFlight = false
    }
  }

  /** Restart the auto-import clock. Used when Auto-refresh changes in Settings. */
  setScanInterval(ms: number): void {
    this.options.scanIntervalMs = ms
    if (!this.running || !this.options.importEnabled) {
      return
    }
    this.armTimer()
  }

  stop(): void {
    this.running = false
    const clearIntervalFn = this.options.clearIntervalFn ?? clearInterval
    const clearTimeoutFn = this.options.clearTimeoutFn ?? clearTimeout
    if (this.timer !== null) {
      clearIntervalFn(this.timer)
      this.timer = null
    }
    if (this.watchDebounce !== null) {
      clearTimeoutFn(this.watchDebounce)
      this.watchDebounce = null
    }
    if (this.watcher !== null) {
      this.watcher.close()
      this.watcher = null
    }
  }

  private scanEveryMs(): number {
    const ms = this.options.scanIntervalMs
    if (typeof ms === 'number' && Number.isFinite(ms) && ms >= DEFAULT_SCAN_INTERVAL_MS) {
      return ms
    }
    return DEFAULT_SCAN_INTERVAL_MS
  }

  private armTimer(): void {
    const clearIntervalFn = this.options.clearIntervalFn ?? clearInterval
    const setIntervalFn = this.options.setIntervalFn ?? setInterval
    if (this.timer !== null) {
      clearIntervalFn(this.timer)
    }
    this.timer = setIntervalFn(() => {
      void this.refresh()
    }, this.scanEveryMs())
  }

  private async runOnce(): Promise<void> {
    const root = await this.options.resolveRoot()
    if (!root.ok) {
      this.sessionsFound = false
      return
    }

    if (!this.options.importEnabled) {
      const fsDeps = this.options.fsDeps
      if (fsDeps === undefined) {
        this.sessionsFound = await sessionsDirectoryExists(
          root.realpath,
          async () => 'missing',
        )
        return
      }
      const files = await this.options.discover(root.realpath, fsDeps, {
        scanDirect: root.scanDirect,
      })
      this.sessionsFound = files.length > 0
      return
    }

    const role = await this.options.lease()
    this.options.store.setLeaseRole(role)
    if (role !== 'writer') {
      return
    }

    const fsDeps = this.options.fsDeps
    if (fsDeps === undefined) {
      throw new Error('HistoryService requires fsDeps when import is enabled')
    }

    const files = await this.options.discover(root.realpath, fsDeps, {
      scanDirect: root.scanDirect,
    })
    rewindParserVersion(this.options.store, ROLLOUT_PARSER_VERSION)
    const readFrom =
      this.options.readFrom ??
      (async (path: string, offset: number): Promise<Uint8Array> => {
        const buf = await readFile(path)
        return new Uint8Array(buf.subarray(offset))
      })
    const deviceId = this.options.deviceId ?? 'device-unknown'

    for (const file of files) {
      if (!this.running) {
        return
      }
      await importDiscoveredFile({
        file,
        root,
        deviceId,
        store: this.options.store,
        readFrom,
        now: this.options.now,
      })
      await yieldMacrotask()
    }
    await this.applyTitles(root)
    repriceUnpricedRequests(this.options.store)
  }

  private async applyTitles(
    root: Extract<ResolvedCodexRoot, { ok: true }>,
  ): Promise<void> {
    for (const path of sessionIndexCandidates(root)) {
      try {
        const text = await readFile(path, 'utf8')
        applySessionTitles(this.options.store, parseSessionIndex(text))
        return
      } catch {
        // The next candidate, or no index on disk.
      }
    }
  }

  private async ensureWatcher(): Promise<void> {
    if (!this.running || !this.options.importEnabled || this.watcher !== null) {
      return
    }
    const root = await this.options.resolveRoot()
    if (!root.ok) {
      return
    }
    const onChange = (): void => {
      const setTimeoutFn = this.options.setTimeoutFn ?? setTimeout
      const clearTimeoutFn = this.options.clearTimeoutFn ?? clearTimeout
      if (this.watchDebounce !== null) {
        clearTimeoutFn(this.watchDebounce)
      }
      this.watchDebounce = setTimeoutFn(() => {
        this.watchDebounce = null
        void this.refresh()
      }, WATCH_DEBOUNCE_MS)
    }
    const watchRoot =
      this.options.watchRoot ??
      ((realpath: string, cb: () => void) =>
        fsWatch(realpath, { recursive: true }, () => {
          cb()
        }))
    this.watcher = watchRoot(root.realpath, onChange)
  }
}

function yieldMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

export type { DiscoveredFile }
