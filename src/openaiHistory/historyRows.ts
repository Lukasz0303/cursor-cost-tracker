import { formatDateTime, formatTokens } from '../format'
import { isGeneratedThreadTitle } from './ids'
import { codexContextMeter } from './pricing/listPrices'
import { localZoneLabel } from '../time/zoneLabel'
import type {
  AccountConfidence,
  BillingMode,
  ModelEvidence,
  RequestStatus,
} from './domain'

export type CodexCostBasis = 'estimated-api' | 'reported' | 'api-equivalent'

export type CodexCostKind = 'amount' | 'missing-rate' | 'partial' | 'empty'

export type CodexRow = {
  rowKind: 'request' | 'group'
  id: string
  timeLabel: string
  timeTitle: string
  rangeLabel: string
  whenLabel: string
  requestCount: number | null
  modelLabel: string
  modelTitle: string
  costLabel: string
  costKind: CodexCostKind
  missingModel: string | null
  tokensLabel: string
  spike: boolean
  inputLabel: string
  cachedLabel: string
  outputLabel: string
  reasoningLabel: string
  inputOutputLabel: string
  inputOutputTitle: string
  kindLabel: string
  /** Untitled thread, including an hour bucket of Cursor-style CLI calls. */
  cli: boolean
  conversationId: string
  accountScopeKey: string
  inputTokens: number | null
  cachedInputTokens: number | null
  outputTokens: number | null
  reasoningOutputTokens: number | null
  /** Newest turn's share of the model window. `unknown` when the window is not known. */
  contextLevel: 'ok' | 'full' | 'unknown'
  contextPercent: number | null
  contextWindowLabel: string
}

export type RequestRowSource = {
  id: string
  observedAt: string
  model: string | null
  modelEvidence: ModelEvidence
  billingMode: BillingMode
  status: RequestStatus
  inputTokens: number | null
  cachedInputTokens: number | null
  outputTokens: number | null
  reasoningOutputTokens: number | null
  totalTokens: number | null
  modelContextWindow: number | null
  /** Local thread title. Empty means the thread has no name. */
  conversationTitle?: string | null
  estimatedApiCostUsd: string | null
  reportedCostUsd: string | null
  conversationId: string | null
  accountScopeKey: string
  accountConfidence: AccountConfidence
}

export function moneyForBasis(
  row: {
    estimatedApiCostUsd: string | null
    reportedCostUsd: string | null
  },
  basis: CodexCostBasis,
): string | null {
  if (basis === 'reported') {
    return row.reportedCostUsd
  }
  return row.estimatedApiCostUsd
}

/** `< $0.01` when a non-zero amount rounds to 0.00 at two places. */
export function formatCodexMoney(
  decimal: string | null,
  basis: CodexCostBasis,
): string {
  if (decimal === null || decimal.trim() === '') {
    return '—'
  }
  const n = Number(decimal)
  if (!Number.isFinite(n)) {
    return '—'
  }
  const rounded = Math.round(n * 100) / 100
  const prefix = basis === 'api-equivalent' ? 'API-equiv. ' : ''
  if (n !== 0 && rounded === 0) {
    return `${prefix}< $0.01`
  }
  return `${prefix}$${rounded.toFixed(2)}`
}

/** Codex requests with no real thread title are the CLI calls. */
export function isCliCodexThread(title: string, conversationId: string): boolean {
  if (conversationId.startsWith('hour:')) {
    return true
  }
  const id = conversationId.trim()
  if (id === '') {
    return false
  }
  const trimmed = title.trim()
  if (trimmed === '') {
    return true
  }
  return isGeneratedThreadTitle(trimmed, id)
}

export function formatKindLabel(mode: BillingMode): string {
  if (mode === 'api') {
    return 'API'
  }
  if (mode === 'chatgpt-plan') {
    return 'ChatGPT plan'
  }
  return 'Unknown'
}

export function formatModelEvidence(evidence: ModelEvidence): string {
  if (evidence === 'response') {
    return 'response'
  }
  if (evidence === 'turn-context') {
    return 'turn context'
  }
  if (evidence === 'requested') {
    return 'requested'
  }
  return 'unknown'
}

function tokenOrDash(value: number | null): string {
  return value === null ? '—' : formatTokens(value)
}

export function missingRateLabel(model: string | null): string {
  if (model !== null && model.trim() !== '' && model !== 'Unknown') {
    return `no rate for ${model}`
  }
  return 'no rate'
}

export function tokensIoLabel(
  input: number | null,
  output: number | null,
): { tokensLabel: string; inputOutputLabel: string } {
  if (input === null && output === null) {
    return { tokensLabel: '—', inputOutputLabel: '— / —' }
  }
  const i = input ?? 0
  const o = output ?? 0
  return {
    tokensLabel: formatTokens(i + o),
    inputOutputLabel: `${formatTokens(i)} / ${formatTokens(o)}`,
  }
}

export function inputOutputTitle(
  cached: number | null,
  reasoning: number | null,
): string {
  const parts: string[] = []
  if (cached !== null) {
    parts.push(`cached ${formatTokens(cached)}`)
  }
  if (reasoning !== null) {
    parts.push(`reasoning ${formatTokens(reasoning)}`)
  }
  return parts.join(' · ')
}

export function mapRequestRow(
  row: RequestRowSource,
  options: { costBasis: CodexCostBasis; spikeTokenThreshold: number; showSpike: boolean },
): CodexRow {
  const ms = Date.parse(row.observedAt)
  const timeLabel = Number.isFinite(ms) ? formatDateTime(ms) : row.observedAt
  const zone = Number.isFinite(ms) ? localZoneLabel(ms) : ''
  const money = moneyForBasis(row, options.costBasis)
  const modelLabel = row.model && row.model.trim() !== '' ? row.model : 'Unknown'
  const missing =
    (money === null || money.trim() === '') && modelLabel !== 'Unknown'
  const io = tokensIoLabel(row.inputTokens, row.outputTokens)
  const tokenCount =
    row.totalTokens !== null
      ? row.totalTokens
      : row.inputTokens !== null || row.outputTokens !== null
        ? (row.inputTokens ?? 0) + (row.outputTokens ?? 0)
        : null
  const spike =
    options.showSpike &&
    tokenCount !== null &&
    tokenCount >= options.spikeTokenThreshold
  const context = codexContextMeter(row.model, row.inputTokens, row.modelContextWindow)
  const cli = isCliCodexThread(row.conversationTitle ?? '', row.conversationId ?? '')

  return {
    rowKind: 'request',
    id: row.id,
    timeLabel,
    timeTitle: zone,
    rangeLabel: '',
    whenLabel: timeLabel,
    requestCount: null,
    modelLabel,
    modelTitle: formatModelEvidence(row.modelEvidence),
    costLabel: missing
      ? missingRateLabel(modelLabel)
      : formatCodexMoney(money, options.costBasis),
    costKind: missing ? 'missing-rate' : money === null ? 'empty' : 'amount',
    missingModel: missing ? modelLabel : null,
    tokensLabel: spike ? `! ${io.tokensLabel}` : io.tokensLabel,
    spike,
    inputLabel: tokenOrDash(row.inputTokens),
    cachedLabel: tokenOrDash(row.cachedInputTokens),
    outputLabel: tokenOrDash(row.outputTokens),
    reasoningLabel: tokenOrDash(row.reasoningOutputTokens),
    inputOutputLabel: io.inputOutputLabel,
    inputOutputTitle: inputOutputTitle(row.cachedInputTokens, row.reasoningOutputTokens),
    cli,
    kindLabel: cli ? 'CLI' : formatKindLabel(row.billingMode),
    conversationId: row.conversationId ?? '',
    accountScopeKey: row.accountScopeKey,
    inputTokens: row.inputTokens,
    cachedInputTokens: row.cachedInputTokens,
    outputTokens: row.outputTokens,
    reasoningOutputTokens: row.reasoningOutputTokens,
    contextLevel: context.level,
    contextPercent: context.percent,
    contextWindowLabel: context.windowLabel,
  }
}
