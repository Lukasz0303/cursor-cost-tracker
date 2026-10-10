import { join } from 'node:path'
import * as vscode from 'vscode'
import {
  colorSchemeFromKind,
  readCursorCostConfig,
  resolveStatusColors,
} from '../config'
import {
  CODE_LINES_AUTHORS_STATE_KEY,
  parseStoredAuthorChoice,
} from '../codeLines/authorChoice'
import {
  collectCodeLinesPayload,
  type CodeLinesPayload,
} from '../codeLines/collect'
import { localDayKey } from '../codeLines/gitMerged'
import { codeLinesWindowFromSample } from '../codeLines/window'
import { lastQueriesTitle, sampleSizeLimit } from '../historyLimit'
import { nicknameFromCursorEmail } from '../support/nickname'
import { contextRecord, titleRecord, type ComposerContextMeter } from '../usage/conversationTitles'
import {
  readConversationLocal,
  type ConversationLocal,
} from '../usage/readConversationTitles'
import { readCursorSession } from '../usage/session'
import type { UsageService } from '../usage/service'
import type { ModelCatalogPayload } from '../pricing/parse'
import { payloadForSnapshot } from './historyRows'
import type { PanelDataOverrides } from './panelData'
import { panelIoCacheKey, takePanelIoCache } from './panelIoCache'
import type { LifetimeSavings } from './optimizeLifetimeSavings'
import type { OptimizedTargets } from './optimizedTargets'
import { readOptimizeSavingsMarkdown } from './optimizeSavingsFile'

export type PanelPublisherDeps = {
  panel: vscode.WebviewPanel
  service: UsageService
  workspaceState: vscode.Memento
  panelVersion: string
  catalogForView: () => ModelCatalogPayload | null
  leaderboardUnlocked: () => boolean
  readLifetimeSavings: () => LifetimeSavings
  readOptimizedTargets: () => OptimizedTargets
  workspaceProject: () => { key: string; label: string }
  creditOptimizeSavings: (markdown: string | null) => Promise<LifetimeSavings>
}

/**
 * Full panel paint: session/titles cache, code-lines flight, and the data payload.
 * Theme-only updates stay on HistoryPanel.postColors.
 */
export class PanelPublisher {
  private postDataSeq = 0
  private linesFlight: {
    key: string
    abort: AbortController
    promise: Promise<CodeLinesPayload | null>
  } | null = null
  private panelIoCache: {
    key: string
    value: {
      session: Awaited<ReturnType<typeof readCursorSession>>
      local: ConversationLocal
    }
  } | null = null
  private optimizeSavingsMarkdown: string | null = null
  private conversationTitles: Record<string, string> = {}
  private conversationContext: Record<string, ComposerContextMeter> = {}
  private conversationAccountSpend = false

  constructor(private readonly deps: PanelPublisherDeps) {}

  titles(): Readonly<Record<string, string>> {
    return this.conversationTitles
  }

  accountSpend(): boolean {
    return this.conversationAccountSpend
  }

  setSavingsMarkdown(markdown: string | null): void {
    this.optimizeSavingsMarkdown = markdown
  }

  postData(overrides?: PanelDataOverrides): void {
    void this.postDataAsync(overrides)
  }

  async creditSavingsThenPost(): Promise<void> {
    const markdown = await readOptimizeSavingsMarkdown()
    this.optimizeSavingsMarkdown = markdown
    await this.deps.creditOptimizeSavings(markdown)
    this.postData()
  }

  dispose(): void {
    this.linesFlight?.abort.abort()
    this.linesFlight = null
  }

  /**
   * Refresh fires several snapshot updates in a row. Aborting the in-flight
   * line collect on each one dropped the full-window dashboard total and the
   * next paint stuck on the shorter fallback. Same calendar window reuses the
   * flight; a different repo or date range starts a new one.
   */
  private codeLinesFor(
    key: string,
    start: (signal: AbortSignal) => Promise<CodeLinesPayload | null>,
  ): Promise<CodeLinesPayload | null> {
    const current = this.linesFlight
    if (current !== null && current.key === key) {
      return current.promise
    }
    current?.abort.abort()
    const abort = new AbortController()
    const promise = start(abort.signal)
    const flight = { key, abort, promise }
    this.linesFlight = flight
    void promise.finally(() => {
      if (this.linesFlight === flight) {
        this.linesFlight = null
      }
    })
    return promise
  }

  private async postDataAsync(overrides?: PanelDataOverrides): Promise<void> {
    const seq = ++this.postDataSeq
    // Theme / color-only paints use postColors. Full paint reuses cached
    // savings markdown (refreshed by watchOptimizeSavingsFile / Optimize run).
    if (this.optimizeSavingsMarkdown === null) {
      const savingsMarkdown = await readOptimizeSavingsMarkdown()
      if (seq !== this.postDataSeq) {
        return
      }
      this.optimizeSavingsMarkdown = savingsMarkdown
    }
    const lifetime = this.deps.readLifetimeSavings()
    const project = this.deps.workspaceProject()
    const snapshot = this.deps.service.getSnapshot()
    const queries = this.deps.service.getCachedQueries()
    const config = {
      ...readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost')),
      ...overrides,
    }
    const folder = vscode.workspace.workspaceFolders?.[0]
    const lineWindow = codeLinesWindowFromSample({
      queries,
      limit: sampleSizeLimit(config.historyLimit, config.historyFromDate),
      fromDate: config.historyFromDate,
      toDate: config.historyToDate,
    })
    const ioKey = panelIoCacheKey(folder?.uri.fsPath ?? null, queries)
    let session: Awaited<ReturnType<typeof readCursorSession>>
    let local: ConversationLocal
    const cached = takePanelIoCache(this.panelIoCache, ioKey)
    if (cached !== undefined) {
      session = cached.session
      local = cached.local
    } else {
      ;[session, local] = await Promise.all([
        readCursorSession({
          locateWasm: (file) => join(__dirname, file),
        }),
        readConversationLocal(),
      ])
      if (seq !== this.postDataSeq) {
        return
      }
      this.panelIoCache = { key: ioKey, value: { session, local } }
    }
    if (seq !== this.postDataSeq) {
      return
    }
    this.conversationTitles = titleRecord(local.titles)
    this.conversationContext = contextRecord(local.context)
    const savedAuthors = parseStoredAuthorChoice(
      this.deps.workspaceState.get(CODE_LINES_AUTHORS_STATE_KEY),
    )
    const workspacePath = folder?.uri.fsPath ?? null
    const linesKey = [
      workspacePath ?? '',
      localDayKey(lineWindow.sinceMs),
      localDayKey(lineWindow.untilMs),
      config.language,
      session.ok ? '1' : '0',
      JSON.stringify(savedAuthors),
    ].join('\0')
    const codeLines = config.codeLinesInsight
      ? await this.codeLinesFor(linesKey, (signal) =>
          collectCodeLinesPayload({
            enabled: true,
            activeWorkspacePath: workspacePath,
            locale: config.language,
            sinceMs: lineWindow.sinceMs,
            untilMs: lineWindow.untilMs,
            queries,
            cookie: session.ok ? session.cookie : null,
            cursorEmail: session.ok ? session.email : null,
            savedAuthors,
            signal,
          }),
        )
      : null
    if (!config.codeLinesInsight) {
      this.linesFlight?.abort.abort()
      this.linesFlight = null
    }
    if (seq !== this.postDataSeq) {
      return
    }
    this.conversationAccountSpend =
      config.codeLinesInsight && codeLines !== null
    const colors = resolveStatusColors(
      config,
      colorSchemeFromKind(vscode.window.activeColorTheme.kind),
    )
    this.deps.panel.title = lastQueriesTitle(
      config.historyLimit,
      config.historyFromDate,
      config.language,
      config.historyToDate,
    )
    void this.deps.panel.webview.postMessage(
      payloadForSnapshot(snapshot, queries, {
        spikeTokenThreshold: config.spikeTokenThreshold,
        showSpikeWarning: config.showSpikeWarning,
        showCriticalAlert: config.showCriticalAlert,
        criticalTokenThreshold: config.criticalTokenThreshold,
        criticalCostUsdThreshold: config.criticalCostUsdThreshold,
        okColor: colors.okColor,
        warnColor: colors.warnColor,
        extensionVersion: this.deps.panelVersion,
        historyLimit: config.historyLimit,
        historyFromDate: config.historyFromDate,
        historyToDate: config.historyToDate,
        pollIntervalMinutes: config.pollIntervalMinutes,
        showStatusBar: config.showStatusBar,
        showToday: config.showToday,
        minimalMode: config.minimalMode,
        recentQueryCount: config.recentQueryCount,
        budgetDayBasis: config.budgetDayBasis,
        forecastWindow: config.forecastWindow,
        optimizeDepth: config.optimizeDepth,
        burnRateGuard: config.burnRateGuard,
        burnRateWindowMinutes: config.burnRateWindowMinutes,
        burnRateWarningUsd: config.burnRateWarningUsd,
        burnRateCriticalUsd: config.burnRateCriticalUsd,
        burnRateMinQueries: config.burnRateMinQueries,
        burnRateWarningToast: config.burnRateWarningToast,
        burnRateCriticalToast: config.burnRateCriticalToast,
        codeLinesInsight: config.codeLinesInsight,
        codeLines,
        groupQueriesByConversation: config.groupQueriesByConversation,
        language: config.language,
        optimizeSavingsMarkdown: this.optimizeSavingsMarkdown,
        optimizeProjectLabel: project.label,
        optimizeLifetimeSavings: lifetime,
        optimizedTargets: this.deps.readOptimizedTargets(),
        conversationTitles: this.conversationTitles,
        conversationContext: this.conversationContext,
        refreshing: overrides?.refreshing ?? this.deps.service.isRefreshing(),
        modelCatalog: this.deps.catalogForView(),
        cursorNickname: nicknameFromCursorEmail(
          session.ok ? session.email : null,
        ),
        cursorEmail: session.ok ? session.email : null,
        leaderboardUnlocked: this.deps.leaderboardUnlocked(),
      }),
    )
  }
}
