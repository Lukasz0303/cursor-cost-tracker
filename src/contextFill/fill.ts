import { usageModelKey } from '../pricing/usageMatch'
import type { ComposerContextMeter } from '../usage/conversationTitles'
import type { UsageQuery } from '../usage/types'

/** At or above this share of the model window, the thread should start over. */
export const CONTEXT_FULL_PERCENT = 60

export type ContextLevel = 'ok' | 'full' | 'unknown'

export type ContextFill = {
  level: ContextLevel
  /** Share of the model window, rounded. Null when the window is unknown. */
  percent: number | null
  /** Compact window, such as `256k`. Empty when unknown. */
  windowLabel: string
  model: string
}

const WINDOWS: { pattern: RegExp; tokens: number }[] = [
  { pattern: /(^|-)1m($|-)/, tokens: 1_000_000 },
  { pattern: /500k/, tokens: 500_000 },
  { pattern: /gemini/, tokens: 1_000_000 },
  { pattern: /^grok-/, tokens: 256_000 },
  { pattern: /^claude-/, tokens: 200_000 },
  { pattern: /^gpt-/, tokens: 272_000 },
  { pattern: /^composer/, tokens: 200_000 },
  { pattern: /^muse-/, tokens: 200_000 },
]

/**
 * Prompt tokens sitting in the window on this turn. Output is the reply, not the cache.
 * Usage events sometimes report `inputTokens` as the whole prompt, cache included.
 * Adding cache again then doubles the meter (175% where Cursor shows 86%).
 * When input already covers the cache, keep input. Otherwise the two are disjoint.
 */
export function promptContextTokens(
  query: Pick<UsageQuery, 'inputTokens' | 'cacheReadTokens' | 'cacheWriteTokens'>,
): number {
  const input = Math.max(0, query.inputTokens)
  const cache = Math.max(0, query.cacheReadTokens) + Math.max(0, query.cacheWriteTokens)
  if (cache > 0 && input >= cache * 0.9) {
    return input
  }
  return input + cache
}

export function contextWindowTokens(model: string | null | undefined): number | null {
  if (model === null || model === undefined || model.trim() === '') {
    return null
  }
  const key = usageModelKey(model)
  for (const row of WINDOWS) {
    if (row.pattern.test(key)) {
      return row.tokens
    }
  }
  return null
}

function windowLabel(tokens: number): string {
  if (tokens % 1_000_000 === 0) {
    return `${tokens / 1_000_000}M`
  }
  if (tokens % 1_000 === 0) {
    return `${tokens / 1_000}k`
  }
  return String(tokens)
}

/** A window share above 100% is a billing total, not the Context Usage ring. */
function sharePercent(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return null
  }
  return Math.round(value)
}

function fillFromMeter(model: string, meter: ComposerContextMeter): ContextFill {
  const fromLimit =
    meter.tokenLimit !== null && meter.tokenLimit > 0 ? meter.tokenLimit : null
  const window = fromLimit ?? contextWindowTokens(model)
  const percent = sharePercent(meter.percent)
  if (percent === null) {
    return {
      level: 'unknown',
      percent: null,
      windowLabel: window === null ? '' : windowLabel(window),
      model,
    }
  }
  return {
    level: percent >= CONTEXT_FULL_PERCENT ? 'full' : 'ok',
    percent,
    windowLabel: window === null ? '' : windowLabel(window),
    model,
  }
}

function fillFromBilling(query: UsageQuery, model: string): ContextFill {
  const window = contextWindowTokens(model)
  if (window === null) {
    return { level: 'unknown', percent: null, windowLabel: '', model }
  }
  const used = promptContextTokens(query)
  const percent = sharePercent((used / window) * 100)
  if (percent === null) {
    return {
      level: 'unknown',
      percent: null,
      windowLabel: windowLabel(window),
      model,
    }
  }
  return {
    level: percent >= CONTEXT_FULL_PERCENT ? 'full' : 'ok',
    percent,
    windowLabel: windowLabel(window),
    model,
  }
}

/**
 * Prefer Cursor's stored meter for this conversation (`contextUsagePercent`).
 * Billing tokens are only a fallback when that composer has no meter yet.
 */
export function contextFillForQuery(
  query: UsageQuery,
  meters?: Readonly<Record<string, ComposerContextMeter>> | null,
): ContextFill {
  const model = query.model?.trim() || ''
  const id = query.conversationId?.trim() ?? ''
  const meter = id !== '' && meters !== undefined && meters !== null ? meters[id] : undefined
  if (meter !== undefined) {
    return fillFromMeter(model, meter)
  }
  return fillFromBilling(query, model)
}
