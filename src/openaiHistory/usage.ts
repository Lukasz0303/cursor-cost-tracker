import type { TokenUsage } from './domain'

export function readTokenCount(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null
  }
  if (!Number.isFinite(value)) {
    return null
  }
  if (!Number.isInteger(value) || value < 0) {
    return null
  }
  return value
}

export function normalizeUsage(raw: unknown): TokenUsage {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyUsage()
  }
  const record = raw as Record<string, unknown>
  return applyUsageRules({
    inputTokens: readTokenCount(record.input_tokens),
    cachedInputTokens: readTokenCount(record.cached_input_tokens),
    cacheWriteInputTokens: readTokenCount(record.cache_write_input_tokens),
    outputTokens: readTokenCount(record.output_tokens),
    reasoningOutputTokens: readTokenCount(record.reasoning_output_tokens),
    totalTokens: readTokenCount(record.total_tokens),
    anomaly: false,
  })
}

export function applyUsageRules(usage: TokenUsage): TokenUsage {
  let anomaly = usage.anomaly
  const { inputTokens: i, cachedInputTokens: c, outputTokens: o, reasoningOutputTokens: r, totalTokens: t } =
    usage

  if (i !== null && c !== null && (c < 0 || c > i)) {
    anomaly = true
  }
  if (o !== null && r !== null && (r < 0 || r > o)) {
    anomaly = true
  }
  if (t !== null && i !== null && o !== null && t !== i + o) {
    anomaly = true
  }

  return {
    ...usage,
    anomaly,
  }
}

export function billableTotal(usage: TokenUsage): number | null {
  if (usage.inputTokens === null || usage.outputTokens === null) {
    return null
  }
  return usage.inputTokens + usage.outputTokens
}

function emptyUsage(): TokenUsage {
  return {
    inputTokens: null,
    cachedInputTokens: null,
    cacheWriteInputTokens: null,
    outputTokens: null,
    reasoningOutputTokens: null,
    totalTokens: null,
    anomaly: false,
  }
}
