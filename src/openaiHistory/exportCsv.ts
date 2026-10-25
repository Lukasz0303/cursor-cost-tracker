export type CodexCsvSourceRow = {
  source: string
  deviceId: string
  accountScopeKey: string
  accountConfidence: string
  conversationId: string | null
  conversationTitle: string | null
  turnId: string | null
  responseId: string | null
  observedAt: string
  model: string | null
  modelEvidence: string
  status: string
  inputTokens: number | null
  cachedInputTokens: number | null
  outputTokens: number | null
  reasoningOutputTokens: number | null
  totalTokens: number | null
  estimatedApiCostUsd: string | null
  reportedCostUsd: string | null
  billingMode: string
  pricingVersion: string | null
  usageQuality: string
  costCoverage: string
}

const HEADER = [
  'source',
  'device_id',
  'account_scope',
  'account_confidence',
  'conversation_id',
  'conversation_title',
  'turn_id',
  'response_id',
  'observed_at_utc',
  'model',
  'model_evidence',
  'status',
  'input_tokens',
  'cached_input_tokens',
  'output_tokens',
  'reasoning_output_tokens',
  'total_tokens',
  'estimated_api_cost_usd',
  'reported_cost_usd',
  'billing_mode',
  'pricing_version',
  'usage_quality',
  'cost_coverage',
] as const

function needsFormulaPrefix(value: string): boolean {
  if (value.length === 0) {
    return false
  }
  const first = value[0]!
  return first === '=' || first === '+' || first === '-' || first === '@' || first === '\t'
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }
  let text = typeof value === 'number' ? String(value) : value
  if (needsFormulaPrefix(text)) {
    text = `'${text}`
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function buildCodexCsv(rows: readonly CodexCsvSourceRow[]): string {
  const lines = [HEADER.join(',')]
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.source),
        csvCell(row.deviceId),
        csvCell(row.accountScopeKey),
        csvCell(row.accountConfidence),
        csvCell(row.conversationId),
        csvCell(row.conversationTitle),
        csvCell(row.turnId),
        csvCell(row.responseId),
        csvCell(row.observedAt),
        csvCell(row.model),
        csvCell(row.modelEvidence),
        csvCell(row.status),
        csvCell(row.inputTokens),
        csvCell(row.cachedInputTokens),
        csvCell(row.outputTokens),
        csvCell(row.reasoningOutputTokens),
        csvCell(row.totalTokens),
        csvCell(row.estimatedApiCostUsd),
        csvCell(row.reportedCostUsd),
        csvCell(row.billingMode),
        csvCell(row.pricingVersion),
        csvCell(row.usageQuality),
        csvCell(row.costCoverage),
      ].join(','),
    )
  }
  return `${lines.join('\n')}\n`
}
