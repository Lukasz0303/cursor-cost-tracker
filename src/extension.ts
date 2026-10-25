import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import {
  mkdir,
  readdir,
  readFile,
  realpath,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import initSqlJs from 'sql.js'
import * as vscode from 'vscode'
import {
  CURSOR_DASHBOARD_URL,
  CURSOR_PRICING_URL,
  EXPORT_CSV_COMMAND,
  EXPORT_LEADERBOARD_CSV_COMMAND,
  OPEN_DASHBOARD_COMMAND,
  OPEN_PRICING_COMMAND,
} from './constants'
import { readCursorCostConfig } from './config'
import { discoverRolloutFiles, type FsDeps } from './openaiHistory/codex/discover'
import { resolveCodexRoot } from './openaiHistory/codex/sourceRoot'
import { HistoryService, type HistoryServiceOptions } from './openaiHistory/historyService'
import { openRequestStore } from './openaiHistory/store/sqlJsRequestStore'
import {
  tryAcquireImportLease,
  type LeaseStore,
} from './openaiHistory/store/storeLease'
import { loadPersistedSettingOverrides } from './settingsStore'
import { CriticalAlertController } from './ui/criticalAlert'
import { BurnRateAlertController } from './ui/burnRateAlert'
import {
  HistoryPanel,
  parseHistoryTab,
  saveQueriesCsv,
  type CodexHost,
} from './ui/historyPanel'
import { StatusBarController } from './ui/statusBar'
import { fetchRecentEvents, fetchUsageSummary } from './usage/api'
import { readCursorSession } from './usage/session'
import { registerActivityRefresh } from './usage/activityRefresh'
import { UsageService } from './usage/service'

const CODEX_DEVICE_ID_KEY = 'cursorCost.codexDeviceId'
const CODEX_IMPORT_LEASE_KEY = 'cursorCost.codexImportLease'
const CODEX_STORE_FILENAME = 'openai-request-history.sqlite'

function readWorkspaceConfig(): ReturnType<typeof readCursorCostConfig> {
  return readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost'))
}

function nodeFsDeps(): FsDeps {
  return {
    readdir: async (path) => readdir(path),
    stat: async (path) => {
      try {
        const info = await stat(path)
        return info.isDirectory() ? 'dir' : info.isFile() ? 'file' : 'missing'
      } catch {
        return 'missing'
      }
    },
    sizeMtime: async (path) => {
      const info = await stat(path)
      return { size: info.size, mtimeMs: info.mtimeMs }
    },
    realpath: async (path) => realpath(path),
  }
}

function ensureCodexDeviceId(globalState: vscode.Memento): string {
  const existing = globalState.get(CODEX_DEVICE_ID_KEY)
  if (typeof existing === 'string' && existing.trim() !== '') {
    return existing
  }
  const id = randomUUID()
  void globalState.update(CODEX_DEVICE_ID_KEY, id)
  return id
}

function createLeaseStore(globalState: vscode.Memento): LeaseStore {
  return {
    async read(): Promise<string | null> {
      const value = globalState.get(CODEX_IMPORT_LEASE_KEY)
      return typeof value === 'string' ? value : null
    },
    async write(value: string): Promise<void> {
      await globalState.update(CODEX_IMPORT_LEASE_KEY, value)
    },
  }
}

async function bootstrapCodexHost(
  context: vscode.ExtensionContext,
): Promise<CodexHost> {
  const storageRoot = context.globalStorageUri.fsPath
  mkdirSync(storageRoot, { recursive: true })
  const storePath = join(storageRoot, CODEX_STORE_FILENAME)
  const sql = await initSqlJs({
    locateFile: (file) => join(__dirname, file),
  })
  const bytes = existsSync(storePath)
    ? new Uint8Array(readFileSync(storePath))
    : null
  let store = openRequestStore(bytes, sql, {
    writeFile: async (path, data) => {
      await writeFile(path, data)
    },
    rename: async (from, to) => {
      const { rename } = await import('node:fs/promises')
      await rename(from, to)
    },
    unlink: async (path) => {
      try {
        await unlink(path)
      } catch {
        // ignore missing temp
      }
    },
    readFile: async (path) => {
      try {
        return new Uint8Array(await readFile(path))
      } catch {
        return null
      }
    },
  })

  const config = readWorkspaceConfig()
  const deviceId = ensureCodexDeviceId(context.globalState)
  const leaseStore = createLeaseStore(context.globalState)
  const ownerId = randomUUID()
  const fsDeps = nodeFsDeps()

  const options: HistoryServiceOptions = {
    importEnabled: config.codexImportEnabled,
    resolveRoot: async () =>
      resolveCodexRoot({
        codexHomeSetting: readWorkspaceConfig().codexHome,
        codexHomeEnv: process.env.CODEX_HOME,
        homeDir: homedir(),
        stat: fsDeps.stat,
        realpath: fsDeps.realpath,
        readdir: fsDeps.readdir,
      }),
    discover: discoverRolloutFiles,
    store,
    lease: async () => tryAcquireImportLease(leaseStore, ownerId, Date.now()),
    now: () => Date.now(),
    scanIntervalMs: readWorkspaceConfig().pollIntervalMinutes * 60_000,
    onAfterRefresh: () => {
      HistoryPanel.refreshOpenCodex()
    },
    deviceId,
    fsDeps,
    readFrom: async (path, offset) => {
      const buf = await readFile(path)
      return new Uint8Array(buf.subarray(offset))
    },
  }

  const history = new HistoryService(options)

  const flush = async (): Promise<void> => {
    await options.store.flush(storePath)
  }

  const forget = async (): Promise<void> => {
    await options.store.close()
    try {
      await unlink(storePath)
    } catch {
      // missing is fine
    }
    try {
      await unlink(`${storePath}.tmp`)
    } catch {
      // ignore
    }
    store = openRequestStore(null, sql)
    options.store = store
  }

  // Ensure storage dir stays available for later flushes.
  await mkdir(storageRoot, { recursive: true })

  return {
    history,
    options,
    getStore: () => options.store,
    storePath,
    flush,
    forget,
    ownerId,
  }
}

export function activate(context: vscode.ExtensionContext): void {
  loadPersistedSettingOverrides(context.globalState)
  const config = readWorkspaceConfig()
  const service = new UsageService(
    {
      readSession: () =>
        readCursorSession({
          locateWasm: (file) => join(__dirname, file),
        }),
      fetchSummary: fetchUsageSummary,
      fetchEvents: (cookie, signal) => {
        const next = readWorkspaceConfig()
        return fetchRecentEvents(cookie, signal, {
          limit: next.historyLimit,
          fromDate: next.historyFromDate,
          toDate: next.historyToDate,
        })
      },
      budgetDayBasis: () => readWorkspaceConfig().budgetDayBasis,
    },
    { pollIntervalMinutes: config.pollIntervalMinutes },
  )

  service.start()
  StatusBarController.register(context, service)
  CriticalAlertController.register(context, service)
  BurnRateAlertController.register(context, service)

  let codexHost: CodexHost | null = null
  const codexReady = bootstrapCodexHost(context)
    .then((host) => {
      codexHost = host
      HistoryPanel.bindCodex(host)
      if (readWorkspaceConfig().codexImportEnabled) {
        void host.history.start()
      }
      return host
    })
    .catch(() => {
      // Keep Cursor path working if sql.js fails to load.
      return null
    })

  context.subscriptions.push(
    service,
    registerActivityRefresh(service, vscode),
    {
      dispose: () => {
        codexHost?.history.stop()
        void codexHost?.getStore().close()
      },
    },
    vscode.commands.registerCommand('cursorCost.showHistory', (tab?: unknown) => {
      // Status bar Current/Today pass a tab argument; the command palette does not.
      const forceCursorSource = tab !== undefined && tab !== null
      HistoryPanel.show(context, service, parseHistoryTab(tab), {
        forceCursorSource,
      })
    }),
    vscode.commands.registerCommand('cursorCost.refresh', () => {
      void service.refresh()
    }),
    vscode.commands.registerCommand(EXPORT_CSV_COMMAND, () => {
      void saveQueriesCsv(
        service.getCachedQueries(),
        readWorkspaceConfig().historyLimit,
        readWorkspaceConfig().historyFromDate,
        readWorkspaceConfig().historyToDate,
      )
    }),
    vscode.commands.registerCommand(EXPORT_LEADERBOARD_CSV_COMMAND, () => {
      HistoryPanel.exportLeaderboard()
    }),
    vscode.commands.registerCommand(OPEN_DASHBOARD_COMMAND, () => {
      void vscode.env.openExternal(vscode.Uri.parse(CURSOR_DASHBOARD_URL))
    }),
    vscode.commands.registerCommand(OPEN_PRICING_COMMAND, () => {
      void vscode.env.openExternal(vscode.Uri.parse(CURSOR_PRICING_URL))
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('cursorCost')) {
        return
      }
      const next = readWorkspaceConfig()
      service.reconfigure({ pollIntervalMinutes: next.pollIntervalMinutes })
      if (event.affectsConfiguration('cursorCost.pollIntervalMinutes')) {
        void codexReady.then((host) => {
          host?.history.setScanInterval(next.pollIntervalMinutes * 60_000)
        })
      }
      if (
        event.affectsConfiguration('cursorCost.historyLimit') ||
        event.affectsConfiguration('cursorCost.historyFromDate') ||
        event.affectsConfiguration('cursorCost.historyToDate')
      ) {
        void service.refresh()
      }

      const codexKeysChanged =
        event.affectsConfiguration('cursorCost.codexImportEnabled') ||
        event.affectsConfiguration('cursorCost.codexHome') ||
        event.affectsConfiguration('cursorCost.codexGroupByConversation') ||
        event.affectsConfiguration('cursorCost.querySource')
      if (!codexKeysChanged) {
        return
      }
      void codexReady.then((host) => {
        if (host === null) {
          return
        }
        const enabled = next.codexImportEnabled
        const wasEnabled = host.options.importEnabled
        host.options.importEnabled = enabled
        if (!enabled) {
          host.history.stop()
          return
        }
        if (!wasEnabled) {
          host.history.stop()
          void host.history.start()
          return
        }
        void host.history.refresh().then(() => host.flush())
      })
    }),
  )
}

export function deactivate(): void {}
