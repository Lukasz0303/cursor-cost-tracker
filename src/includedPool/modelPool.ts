import { usageModelKey } from '../pricing/usageMatch'

/** Pro included quota: Cursor Models vs Other Models. */
export type IncludedModelPool = 'cursor' | 'other'

const CURSOR_PREFIXES = ['grok', 'composer'] as const
const CURSOR_EXACT = new Set(['default'])

/**
 * Maps a usage-event model id to the Pro included pool.
 * Cursor Models: Grok, Default, Composer. Everything else → Other Models.
 */
export function includedPoolForModel(model: string | null): IncludedModelPool {
  if (model === null || model.trim() === '') {
    return 'other'
  }
  const key = usageModelKey(model)
  if (key === 'default' || CURSOR_EXACT.has(key)) {
    return 'cursor'
  }
  for (const prefix of CURSOR_PREFIXES) {
    if (key === prefix || key.startsWith(`${prefix}-`)) {
      return 'cursor'
    }
  }
  return 'other'
}

export function includedPoolForQuotaName(name: string): IncludedModelPool {
  if (name === 'Cursor Models') {
    return 'cursor'
  }
  return 'other'
}
