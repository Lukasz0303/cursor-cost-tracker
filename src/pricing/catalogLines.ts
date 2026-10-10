import type { AccountModel, AccountVariant } from './accountModels'
import { splitCatalogName } from './family'
import type { ModelCatalogPayload, PricedModel } from './parse'

/** One price option inside a model family. `variantLabel` empty = a single-line model. */
export type CatalogLine = {
  family: string
  variantLabel: string
  provider: string
  input: string | null
  output: string | null
  benchScore: number | null
  requests: number
  requestPercent: number
  /** Same key shares one request count, so a group header does not add it twice. */
  requestKey: string
  fast: boolean
  enabled: boolean
}

type RowFlags = { fast: boolean; longContext: boolean }

function rowFlags(model: PricedModel): RowFlags {
  const variant = splitCatalogName(model.name).variant.toLowerCase()
  return {
    fast: model.fast || variant.includes('fast'),
    longContext: variant.includes('500k') || variant.includes('1m'),
  }
}

function familyRows(name: string, models: readonly PricedModel[]): PricedModel[] {
  const key = name.trim().toLowerCase()
  return models.filter(
    (model) => splitCatalogName(model.name).family.toLowerCase() === key,
  )
}

function pickRow(
  rows: readonly PricedModel[],
  fast: boolean,
  longContext: boolean,
): PricedModel | null {
  return (
    rows.find((row) => {
      const flags = rowFlags(row)
      return flags.fast === fast && flags.longContext === longContext
    }) ?? null
  )
}

function requestKey(family: string, flags: RowFlags): string {
  return `${family.toLowerCase()}|${flags.fast ? 'f' : ''}|${flags.longContext ? 'l' : ''}`
}

function lineFrom(
  family: string,
  variantLabel: string,
  provider: string,
  row: PricedModel | null,
  enabled: boolean,
  flags: RowFlags,
): CatalogLine {
  return {
    family,
    variantLabel,
    provider: provider || row?.provider || '',
    input: row?.input ?? null,
    output: row?.output ?? null,
    benchScore: row?.benchScore ?? null,
    requests: row?.requests ?? 0,
    requestPercent: row?.requestPercent ?? 0,
    requestKey: requestKey(family, flags),
    fast: flags.fast,
    enabled,
  }
}

function optionsFor(
  variants: readonly AccountVariant[],
  rows: readonly PricedModel[],
): Array<AccountVariant> {
  const specs: AccountVariant[] = variants.map((variant) => ({ ...variant }))
  for (const row of rows) {
    const flags = rowFlags(row)
    const effortSharesBase =
      !flags.fast &&
      !flags.longContext &&
      specs.some((spec) => !spec.fast && !spec.longContext)
    const exact = specs.some(
      (spec) => spec.fast === flags.fast && spec.longContext === flags.longContext,
    )
    if (effortSharesBase || exact) {
      continue
    }
    const parts = splitCatalogName(row.name)
    specs.push({
      label: parts.variant,
      fast: flags.fast,
      longContext: flags.longContext,
    })
  }
  if (specs.length === 0) {
    return [{ label: '', fast: false, longContext: false }]
  }
  if (specs.length === 1) {
    return [{ label: '', fast: specs[0]?.fast === true, longContext: specs[0]?.longContext === true }]
  }
  return specs
}

function linesFromAccount(
  catalog: ModelCatalogPayload,
  account: readonly AccountModel[],
): CatalogLine[] {
  const lines: CatalogLine[] = []
  for (const model of account) {
    const rows = familyRows(model.name, catalog.models)
    const provider = model.provider || rows[0]?.provider || ''
    const options = optionsFor(model.variants, rows)
    for (const option of options) {
      const flags = { fast: option.fast, longContext: option.longContext }
      const row =
        pickRow(rows, flags.fast, flags.longContext) ??
        (flags.fast || flags.longContext ? null : (rows[0] ?? null))
      lines.push(
        lineFrom(
          model.name,
          options.length > 1 ? option.label : '',
          provider,
          row,
          model.enabled,
          flags,
        ),
      )
    }
  }
  return lines
}

function linesFromPricing(catalog: ModelCatalogPayload): CatalogLine[] {
  const order: string[] = []
  const groups = new Map<string, PricedModel[]>()
  for (const model of catalog.models) {
    const family = splitCatalogName(model.name).family
    const bucket = groups.get(family)
    if (bucket) {
      bucket.push(model)
      continue
    }
    groups.set(family, [model])
    order.push(family)
  }
  const lines: CatalogLine[] = []
  for (const family of order) {
    const rows = groups.get(family) ?? []
    const multi = rows.length > 1
    for (const row of rows) {
      const parts = splitCatalogName(row.name)
      const flags = rowFlags(row)
      lines.push(
        lineFrom(
          family,
          multi ? parts.variant : '',
          row.provider,
          row,
          !row.hiddenByDefault,
          flags,
        ),
      )
    }
  }
  return lines
}

/**
 * Account picker when Cursor Settings could be read. Otherwise one line per
 * pricing-page family, split when that family has Fast or long-context prices.
 */
export function buildCatalogLines(
  catalog: ModelCatalogPayload,
  account: readonly AccountModel[] | null,
): CatalogLine[] {
  if (account === null) {
    return linesFromPricing(catalog)
  }
  return linesFromAccount(catalog, account)
}
