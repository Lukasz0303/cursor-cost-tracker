/** Official pricing page, markdown form (stable tables). */
export const CURSOR_PRICING_MD_URL =
  'https://cursor.com/docs/models-and-pricing.md'

export type PricingPool = 'cursor' | 'other'

export type PricedModel = {
  name: string
  provider: string
  pool: PricingPool
  /** Per million tokens, as printed on the page (`$2`). */
  input: string | null
  cacheWrite: string | null
  cacheRead: string | null
  output: string | null
  /** Notes say "Hidden by default" — Cursor's model list starts with these off. */
  hiddenByDefault: boolean
  /** Separate Fast variant row, not a base model whose notes mention Fast. */
  fast: boolean
  /** Requests in the current Last N sample that match this catalog row. */
  requests?: number
  /** Share of that sample, one decimal. */
  requestPercent?: number
  /** Best published CursorBench 4.0 score, when this row is on that board. */
  benchScore?: number | null
}

export type ModelCatalogPayload = {
  sourceUrl: string
  fetchedAt: string
  models: PricedModel[]
  visibleByDefault: number
  hiddenByDefault: number
  fast: number
  error: string | null
  /** Leaderboard the bench scores link to. */
  benchUrl?: string
}

const FAST_NAME = /\bfast\b/i
const HIDDEN_NOTE = /hidden by default/i

function splitRow(line: string): string[] {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return body.split('|').map((cell) => cell.trim())
}

function isSeparator(cells: string[]): boolean {
  return (
    cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell))
  )
}

function plainCell(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function priceCell(raw: string): string | null {
  const text = plainCell(raw)
  if (text === '' || text === '-' || text === '—') {
    return null
  }
  return text
}

function columnIndex(header: string[], name: string): number {
  return header.findIndex((cell) => cell === name)
}

function isPricingHeader(cells: string[]): boolean {
  const header = cells.map((cell) => plainCell(cell).toLowerCase())
  return header.includes('input') && header.includes('output') && header.includes('model')
}

export function emptyModelCatalog(error: string | null): ModelCatalogPayload {
  return {
    sourceUrl: CURSOR_PRICING_MD_URL,
    fetchedAt: new Date(0).toISOString(),
    models: [],
    visibleByDefault: 0,
    hiddenByDefault: 0,
    fast: 0,
    error,
  }
}

export function catalogFromModels(
  models: PricedModel[],
  fetchedAt: string,
  error: string | null = null,
): ModelCatalogPayload {
  let hiddenByDefault = 0
  let fast = 0
  for (const model of models) {
    if (model.hiddenByDefault) {
      hiddenByDefault += 1
    }
    if (model.fast) {
      fast += 1
    }
  }
  return {
    sourceUrl: CURSOR_PRICING_MD_URL,
    fetchedAt,
    models,
    visibleByDefault: models.length - hiddenByDefault,
    hiddenByDefault,
    fast,
    error,
  }
}

export function parseModelPricingMarkdown(markdown: string): PricedModel[] {
  const models: PricedModel[] = []
  let pool: PricingPool = 'cursor'
  let inTable = false
  let nameCol = 0
  let providerCol = 1
  let inputCol = 2
  let cacheWriteCol = 3
  let cacheReadCol = 4
  let outputCol = 5
  let notesCol = 6

  for (const line of markdown.split(/\r?\n/)) {
    if (/^##\s+Cursor Models\b/i.test(line)) {
      pool = 'cursor'
    } else if (/^##\s+Other Models\b/i.test(line)) {
      pool = 'other'
    }

    if (!line.trim().startsWith('|')) {
      inTable = false
      continue
    }

    const cells = splitRow(line)
    if (isSeparator(cells)) {
      continue
    }
    if (!inTable) {
      const header = cells.map((cell) => plainCell(cell).toLowerCase())
      inTable = isPricingHeader(cells)
      if (!inTable) {
        continue
      }
      nameCol = columnIndex(header, 'model')
      providerCol = columnIndex(header, 'provider')
      inputCol = columnIndex(header, 'input')
      cacheWriteCol = columnIndex(header, 'cache write')
      cacheReadCol = columnIndex(header, 'cache read')
      outputCol = columnIndex(header, 'output')
      notesCol = columnIndex(header, 'notes')
      continue
    }

    const name = plainCell(cells[nameCol] ?? '')
    if (name === '') {
      continue
    }
    const notes = notesCol >= 0 ? plainCell(cells[notesCol] ?? '') : ''
    models.push({
      name,
      provider: providerCol >= 0 ? plainCell(cells[providerCol] ?? '') : '',
      pool,
      input: inputCol >= 0 ? priceCell(cells[inputCol] ?? '') : null,
      cacheWrite:
        cacheWriteCol >= 0 ? priceCell(cells[cacheWriteCol] ?? '') : null,
      cacheRead: cacheReadCol >= 0 ? priceCell(cells[cacheReadCol] ?? '') : null,
      output: outputCol >= 0 ? priceCell(cells[outputCol] ?? '') : null,
      hiddenByDefault: HIDDEN_NOTE.test(notes),
      fast: FAST_NAME.test(name),
    })
  }

  return models
}
