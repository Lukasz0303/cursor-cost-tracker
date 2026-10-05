import {
  catalogFromModels,
  CURSOR_PRICING_MD_URL,
  emptyModelCatalog,
  parseModelPricingMarkdown,
  type ModelCatalogPayload,
} from './parse'

const TTL_MS = 6 * 60 * 60 * 1000

let cached: { at: number; payload: ModelCatalogPayload } | null = null
let inflight: Promise<ModelCatalogPayload> | null = null

async function fetchCatalog(): Promise<ModelCatalogPayload> {
  const response = await fetch(CURSOR_PRICING_MD_URL, {
    // `Accept: text/markdown` makes this docs route return 404. Default */* is markdown.
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) {
    return emptyModelCatalog(`HTTP ${response.status}`)
  }
  const markdown = await response.text()
  const models = parseModelPricingMarkdown(markdown)
  if (models.length === 0) {
    return emptyModelCatalog('Pricing page had no model table.')
  }
  return catalogFromModels(models, new Date().toISOString())
}

/** Latest model prices from the public docs page. Cached for six hours. */
export function loadModelCatalog(force = false): Promise<ModelCatalogPayload> {
  if (
    !force &&
    cached &&
    cached.payload.error === null &&
    Date.now() - cached.at < TTL_MS
  ) {
    return Promise.resolve(cached.payload)
  }
  if (!force && inflight) {
    return inflight
  }
  const pending = fetchCatalog()
    .then((payload) => {
      if (payload.error === null) {
        cached = { at: Date.now(), payload }
        return payload
      }
      if (cached && cached.payload.models.length > 0) {
        return cached.payload
      }
      return payload
    })
    .catch(() => {
      if (cached && cached.payload.models.length > 0) {
        return cached.payload
      }
      return emptyModelCatalog('Could not load the pricing page.')
    })
    .finally(() => {
      if (inflight === pending) {
        inflight = null
      }
    })
  inflight = pending
  return pending
}

/** Test hook. Production calls leave the six-hour cache in place. */
export function clearModelCatalogCache(): void {
  cached = null
  inflight = null
}
