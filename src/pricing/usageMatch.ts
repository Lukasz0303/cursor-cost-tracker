import type { ModelCatalogPayload, PricedModel } from './parse'

/** Cursor's coding-agent leaderboard. Scores are the best published effort tier. */
export const CURSOR_BENCH_URL = 'https://cursor.com/cursorbench'

const CURSOR_BENCH_SCORE: Record<string, number> = {
  'claude-opus-5.5': 57.8,
  'claude-fable-5.1': 51.8,
  'claude-opus-5': 46.6,
  'grok-4.7': 46.3,
  'gpt-5.6-sol': 41.7,
  'muse-spark-1.3': 41.6,
  'grok-4.6': 41.4,
  'gpt-5.6-terra': 41.3,
  'gemini-3.8-flash': 39.6,
  'gpt-5.6-luna': 35.9,
  'claude-sonnet-5': 34.1,
  'composer-2.5': 27.7,
}

export function cursorBenchScore(
  model: Pick<PricedModel, 'name' | 'fast'>,
): number | null {
  if (model.fast) {
    return null
  }
  const score = CURSOR_BENCH_SCORE[catalogModelKey(model)]
  return score === undefined ? null : score
}

const EFFORT_SUFFIX = /-(thinking|xhigh|extra-high|high|medium|low|max)$/

/** Usage id such as `grok-4.7-high` or `claude-opus-5-thinking-high`. */
export function usageModelKey(model: string): string {
  let slug = model.trim().toLowerCase().replace(/^cursor-/, '')
  const fast = slug.includes('-fast')
  if (fast) {
    slug = slug.replace(/-fast/g, '')
  }
  while (EFFORT_SUFFIX.test(slug)) {
    slug = slug.replace(EFFORT_SUFFIX, '')
  }
  slug = slug.replace(/-+$/g, '')
  return fast ? `${slug}-fast` : slug
}

/** Catalog name such as `Grok 4.7 (Fast)` or `GPT-5.6 Sol`. */
export function catalogModelKey(model: Pick<PricedModel, 'name' | 'fast'>): string {
  const fast = model.fast || /\bfast\b/i.test(model.name)
  let slug = model.name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bfast\b/g, ' ')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (fast && !slug.endsWith('-fast')) {
    slug = `${slug}-fast`
  }
  return slug
}

/**
 * Catalog row for a usage model id. Prefer non-fast when both match unless the
 * usage id is a fast variant (keys already encode `-fast` via usageModelKey).
 */
export function matchPricedModel(
  modelId: string | null | undefined,
  catalog: ModelCatalogPayload | null | undefined,
): PricedModel | null {
  if (modelId === null || modelId === undefined || modelId.trim() === '') {
    return null
  }
  if (catalog === null || catalog === undefined || catalog.error) {
    return null
  }
  const key = usageModelKey(modelId)
  const matches = catalog.models.filter(
    (model) => catalogModelKey(model) === key,
  )
  if (matches.length === 0) {
    return null
  }
  if (matches.length === 1) {
    return matches[0] ?? null
  }
  const wantFast = key.endsWith('-fast')
  const preferred = wantFast
    ? matches.find((model) => model.fast)
    : matches.find((model) => !model.fast)
  return preferred ?? matches[0] ?? null
}

export function requestSharePercent(count: number, total: number): number {
  if (total <= 0 || count <= 0) {
    return 0
  }
  return Math.round((count / total) * 1000) / 10
}

export function withRequestCounts(
  catalog: ModelCatalogPayload,
  modelIds: readonly string[],
): ModelCatalogPayload {
  const counts = new Map<string, number>()
  for (const id of modelIds) {
    if (id.trim() === '') {
      continue
    }
    const key = usageModelKey(id)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const total = modelIds.filter((id) => id.trim() !== '').length
  return {
    ...catalog,
    benchUrl: CURSOR_BENCH_URL,
    models: catalog.models.map((model) => {
      const requests = counts.get(catalogModelKey(model)) ?? 0
      return {
        ...model,
        requests,
        requestPercent: requestSharePercent(requests, total),
        benchScore: cursorBenchScore(model),
      }
    }),
  }
}
