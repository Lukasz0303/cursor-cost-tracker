export type CatalogNameParts = {
  family: string
  /** Empty for the standard price row. `Fast`, `500k`, `500k Fast`, `1M`. */
  variant: string
}

const FAST_PAREN = /\s*\((?:fast|fast mode)\)\s*/i
const TRAILING_CONTEXT = /\s+(500k|1m)$/i
const TRAILING_FAST = /\s+fast$/i

/** Pricing-page name → model family plus the price option (`Grok 4.7 500k (Fast)`). */
export function splitCatalogName(name: string): CatalogNameParts {
  let rest = name.trim().replace(/\s+/g, ' ')
  const bits: string[] = []
  if (FAST_PAREN.test(rest)) {
    bits.push('Fast')
    rest = rest.replace(FAST_PAREN, ' ').replace(/\s+/g, ' ').trim()
  }
  const context = TRAILING_CONTEXT.exec(rest)
  if (context?.[1]) {
    bits.unshift(/^1m$/i.test(context[1]) ? '1M' : '500k')
    rest = rest.slice(0, context.index).trim()
  }
  if (TRAILING_FAST.test(rest)) {
    bits.push('Fast')
    rest = rest.replace(TRAILING_FAST, '').trim()
  }
  return { family: rest, variant: bits.join(' ') }
}
