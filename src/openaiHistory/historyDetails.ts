import { formatDateTime, formatTokens } from '../format'
import type {
  AccountConfidence,
  BillingMode,
  CostCoverage,
  ModelEvidence,
  RequestStatus,
  UsageQuality,
} from './domain'
import { formatCodexMoney, type CodexCostBasis } from './historyRows'

export type CodexDetailSource = {
  source: string
  deviceId: string
  accountScopeKey: string
  accountConfidence: AccountConfidence
  conversationId: string | null
  sessionId: string | null
  turnId: string | null
  responseId: string | null
  usageQuality: UsageQuality
  inputTokens: number | null
  cachedInputTokens: number | null
  outputTokens: number | null
  reasoningOutputTokens: number | null
  totalTokens: number | null
  estimatedApiCostUsd: string | null
  reportedCostUsd: string | null
  billingMode: BillingMode
  modelEvidence: ModelEvidence
  pricingVersion: string | null
  costCoverage: CostCoverage
  status: RequestStatus
  errorCode: string | null
  observedAt: string
  startedAt: string | null
  completedAt: string | null
}

export type CodexDetailFields = {
  source: string
  device: string
  scope: string
  confidence: string
  conversation: string
  session: string
  turn: string
  responseId: string
  usageQuality: string
  input: string
  cachedInput: string
  output: string
  reasoning: string
  total: string
  costBasis: string
  formula: string
  pricingVersion: string
  status: string
  errorCode: string
  observed: string
  started: string | null
  finished: string | null
}

function tokenOrDash(n: number | null): string {
  return n === null ? '—' : formatTokens(n)
}

function formulaForBasis(basis: CodexCostBasis): string {
  if (basis === 'reported') {
    return 'Reported charge from the source when present'
  }
  if (basis === 'api-equivalent') {
    return 'API-equivalent: ((I - C) × input + C × cached input + O × output) / 1,000,000'
  }
  return 'Estimated API: ((I - C) × input + C × cached input + O × output) / 1,000,000'
}

export function mapRequestDetails(
  row: CodexDetailSource,
  costBasis: CodexCostBasis,
): CodexDetailFields {
  const money =
    costBasis === 'reported' ? row.reportedCostUsd : row.estimatedApiCostUsd
  const observedMs = Date.parse(row.observedAt)
  const startedMs = row.startedAt !== null ? Date.parse(row.startedAt) : Number.NaN
  const finishedMs =
    row.completedAt !== null ? Date.parse(row.completedAt) : Number.NaN

  return {
    source: row.source,
    device: 'this computer',
    scope: row.accountScopeKey,
    confidence: row.accountConfidence,
    conversation: row.conversationId ?? '—',
    session: row.sessionId ?? '—',
    turn: row.turnId ?? '—',
    responseId: row.responseId ?? '—',
    usageQuality: row.usageQuality,
    input: tokenOrDash(row.inputTokens),
    cachedInput: tokenOrDash(row.cachedInputTokens),
    output: tokenOrDash(row.outputTokens),
    reasoning: tokenOrDash(row.reasoningOutputTokens),
    total: tokenOrDash(row.totalTokens),
    costBasis: formatCodexMoney(money, costBasis),
    formula: formulaForBasis(costBasis),
    pricingVersion:
      row.pricingVersion !== null && row.pricingVersion !== ''
        ? row.pricingVersion
        : 'Price unavailable',
    status: row.status,
    errorCode: row.errorCode ?? '—',
    observed: Number.isFinite(observedMs)
      ? formatDateTime(observedMs)
      : row.observedAt,
    started: Number.isFinite(startedMs) ? formatDateTime(startedMs) : null,
    finished: Number.isFinite(finishedMs) ? formatDateTime(finishedMs) : null,
  }
}
