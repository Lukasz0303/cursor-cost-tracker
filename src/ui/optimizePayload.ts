import {
  DEFAULT_OPTIMIZE_DEPTH,
  parseOptimizeDepth,
  type OptimizeDepth,
} from '../optimizeDepth'
import { clampHistoryLimit, DEFAULT_HISTORY_LIMIT } from '../historyLimit'
import { DEFAULT_SPIKE_TOKEN_THRESHOLD } from '../spikes/threshold'
import type { UsageQuery } from '../usage/types'
import {
  toOptimizeInsights,
  type OptimizeFinding,
} from './optimizeInsights'
import { buildOptimizePrompt } from './optimizePrompt'
import {
  emptyLifetimeSavings,
  toLifetimePayload,
  type LifetimePayload,
  type LifetimeSavings,
} from './optimizeLifetimeSavings'
import {
  emptySavings,
  parseOptimizeSavingsMarkdown,
} from './optimizeSavings'

export type OptimizePrompts = Record<OptimizeDepth, string>

export type OptimizePayload = {
  /** Default depth from settings (`cursorCost.optimizeDepth`). */
  depth: OptimizeDepth
  summary: string
  note: string
  findings: OptimizeFinding[]
  /** Prompt for the default depth (same as `prompts[depth]`). */
  prompt: string
  /** All three depth prompts for the colored cards. */
  prompts: OptimizePrompts
  /** Mid tokens from `.ai/optimize-savings.md`; 0 until the agent writes it. */
  estTokensSaved: number | null
  /** Mid USD from `.ai/optimize-savings.md`; 0 until the agent writes it. */
  estUsdSaved: number | null
  hasProjection: boolean
  /** Lifetime credited savings (globalState), total + per project. */
  lifetime: LifetimePayload
  empty: boolean
}

export type OptimizePayloadOptions = {
  depth?: OptimizeDepth | unknown
  historyLimit?: number
  spikeTokenThreshold?: number
  /** Raw contents of `.ai/optimize-savings.md` when present. */
  savingsMarkdown?: string | null
  /** Workspace folder basename for Optimize prompts / fence. */
  projectLabel?: string
  /** Credited lifetime savings from extension globalState. */
  lifetimeSavings?: LifetimeSavings | null
}

export function toOptimizePayload(
  queries: UsageQuery[],
  options?: OptimizePayloadOptions,
): OptimizePayload {
  const depth = parseOptimizeDepth(
    options?.depth ?? DEFAULT_OPTIMIZE_DEPTH,
  )
  const historyLimit = clampHistoryLimit(
    options?.historyLimit ?? DEFAULT_HISTORY_LIMIT,
  )
  const spikeTokenThreshold =
    options?.spikeTokenThreshold ?? DEFAULT_SPIKE_TOKEN_THRESHOLD
  const insights = toOptimizeInsights(queries, {
    historyLimit,
    spikeTokenThreshold,
  })
  const priorMarkdown = options?.savingsMarkdown ?? null
  const savings =
    priorMarkdown === null || priorMarkdown === undefined
      ? emptySavings()
      : parseOptimizeSavingsMarkdown(priorMarkdown)
  const projectLabel = options?.projectLabel?.trim() ?? ''
  const lifetime = toLifetimePayload(
    options?.lifetimeSavings ?? emptyLifetimeSavings(),
  )
  const empty = insights.sampleSize === 0
  const prompts: OptimizePrompts = empty
    ? { quick: '', balanced: '', deep: '' }
    : {
        quick: buildOptimizePrompt(
          insights,
          'quick',
          priorMarkdown,
          savings,
          projectLabel,
        ),
        balanced: buildOptimizePrompt(
          insights,
          'balanced',
          priorMarkdown,
          savings,
          projectLabel,
        ),
        deep: buildOptimizePrompt(
          insights,
          'deep',
          priorMarkdown,
          savings,
          projectLabel,
        ),
      }

  return {
    depth,
    summary: empty ? 'No queries yet' : savings.summary,
    note: empty
      ? 'Refresh usage, then Run Optimize (toolbar) or a depth card.'
      : savings.note,
    findings: insights.findings,
    prompt: prompts[depth],
    prompts,
    estTokensSaved: savings.estTokensSaved,
    estUsdSaved: savings.estUsdSaved,
    hasProjection: savings.hasProjection,
    lifetime,
    empty,
  }
}
