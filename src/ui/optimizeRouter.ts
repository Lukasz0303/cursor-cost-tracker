import * as vscode from 'vscode'
import { readCursorCostConfig, type CursorCostConfig, type OptimizeDepth } from '../config'
import { catalogFor } from '../i18n'
import { sampleSizeLimit } from '../historyLimit'
import {
  groupConversations,
  newestSample,
  UNGROUPED_CONVERSATION_ID,
} from '../usage/groupConversations'
import type { UsageQuery, UsageSnapshot } from '../usage/types'
import { payloadForSnapshot } from './historyRows'
import { buildConversationOptimizePrompt } from './conversationOptimizePrompt'
import { openOptimizeChat } from './openOptimizeChat'
import { readOptimizeSavingsMarkdown } from './optimizeSavingsFile'
import type { LifetimeSavings } from './optimizeLifetimeSavings'
import {
  optimizedTargetForConversation,
  type OptimizedTargetInput,
} from './optimizedTargets'

export type OptimizeRouterHost = {
  getSnapshot: () => UsageSnapshot
  getQueries: () => UsageQuery[]
  titles: () => Readonly<Record<string, string>>
  accountSpend: () => boolean
  setSavingsMarkdown: (markdown: string | null) => void
  creditOptimizeSavings: (markdown: string | null) => Promise<LifetimeSavings>
  workspaceProject: () => { key: string; label: string }
  readLifetimeSavings: () => LifetimeSavings
  rememberLastRedTarget: (config: CursorCostConfig) => Promise<void>
  persistOptimizedTarget: (input: OptimizedTargetInput) => Promise<void>
}

export class OptimizeRouter {
  constructor(private readonly host: OptimizeRouterHost) {}

  async run(mode: 'chat' | 'copy', depthOverride?: OptimizeDepth): Promise<void> {
    const savingsMarkdown = await readOptimizeSavingsMarkdown()
    this.host.setSavingsMarkdown(savingsMarkdown)
    const lifetime = await this.host.creditOptimizeSavings(savingsMarkdown)
    const project = this.host.workspaceProject()
    const config = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    const depth = depthOverride ?? config.optimizeDepth
    const optimize = payloadForSnapshot(
      this.host.getSnapshot(),
      this.host.getQueries(),
      {
        spikeTokenThreshold: config.spikeTokenThreshold,
        showSpikeWarning: config.showSpikeWarning,
        historyLimit: config.historyLimit,
        historyFromDate: config.historyFromDate,
        historyToDate: config.historyToDate,
        optimizeDepth: depth,
        language: config.language,
        optimizeSavingsMarkdown: savingsMarkdown,
        optimizeProjectLabel: project.label,
        optimizeLifetimeSavings: lifetime,
      },
    ).optimize
    const prompt = optimize.prompts[depth] || optimize.prompt
    if (mode === 'chat') {
      const pasted = await openOptimizeChat(prompt, undefined, config.language, {
        target: 'new',
      })
      if (pasted !== 'clipboard') {
        await this.host.rememberLastRedTarget(config)
      }
      return
    }
    await vscode.env.clipboard.writeText(prompt)
    void vscode.window.showInformationMessage(
      catalogFor(config.language).optimize.copied,
    )
  }

  /**
   * Rebuild the conversation brief from the cached sample and paste it into
   * a new Agent chat. Ignores any prompt text from the webview.
   */
  async conversation(
    id: string,
    timestamp?: number,
    depthOverride?: OptimizeDepth,
  ): Promise<void> {
    const config = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    const depth = depthOverride ?? config.optimizeDepth
    const limit = sampleSizeLimit(config.historyLimit, config.historyFromDate)
    const sample = newestSample(this.host.getQueries(), limit)
    const groups = groupConversations(sample, this.host.titles())
    let group =
      id !== '' && id !== UNGROUPED_CONVERSATION_ID
        ? groups.find((item) => item.id === id)
        : undefined
    if (
      (group === undefined || group.id === UNGROUPED_CONVERSATION_ID) &&
      timestamp !== undefined
    ) {
      const query = sample.find((item) => item.timestamp === timestamp)
      const owned =
        query?.conversationId !== undefined && query.conversationId !== ''
          ? groups.find((item) => item.id === query.conversationId)
          : undefined
      if (owned !== undefined && owned.id !== UNGROUPED_CONVERSATION_ID) {
        group = owned
      } else if (query !== undefined) {
        group = {
          id: `query-${timestamp}`,
          title: 'unnamed conversation',
          named: false,
          queries: [query],
        }
      }
    }
    if (group === undefined || group.id === UNGROUPED_CONVERSATION_ID) {
      return
    }
    const savingsMarkdown = await readOptimizeSavingsMarkdown()
    this.host.setSavingsMarkdown(savingsMarkdown)
    const project = this.host.workspaceProject()
    const credited = this.host.readLifetimeSavings().projects[project.key]
    const prompt = buildConversationOptimizePrompt(group, {
      depth,
      accountSpend: this.host.accountSpend(),
      projectLabel: project.label,
      priorMarkdown: savingsMarkdown,
      creditedTokensMid: credited?.lastTokensMid,
      creditedUsdMid: credited?.lastUsdMid,
      creditedRun: credited?.lastRun,
    })
    const pasted = await openOptimizeChat(prompt, undefined, config.language, {
      target: 'new',
    })
    if (pasted === 'clipboard') {
      return
    }
    const target = optimizedTargetForConversation(group.id, group.queries[0])
    if (target === null) {
      return
    }
    await this.host.persistOptimizedTarget(target)
  }
}
