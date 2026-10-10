/** Cursor Settings → Models, stored on the account. No tokens or mailboxes. */
export type AccountVariant = {
  label: string
  fast: boolean
  longContext: boolean
}

export type AccountModel = {
  /** Catalog slug, such as `grok-4.7`. */
  id: string
  /** Picker label, such as `Grok 4.7`. */
  name: string
  provider: string
  enabled: boolean
  variants: AccountVariant[]
}

export const APPLICATION_USER_KEY =
  'src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Picker labels ship as HTML (`Name <span>Fast</span>`). Keep the visible option only. */
export function visibleLabel(raw: string): string {
  const span = raw.match(/<span[^>]*>([^<]*)<\/span>/i)
  const picked = span?.[1]?.trim() ? span[1] : raw.replace(/<[^>]+>/g, ' ')
  return picked
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string' && item.trim() !== '') {
      out.push(item.trim())
    }
  }
  return out
}

export function variantFlags(
  label: string,
  values: readonly string[],
): { fast: boolean; longContext: boolean } {
  const blob = `${label} ${values.join(' ')}`.toLowerCase()
  return {
    fast: /\bfast\b/.test(blob),
    longContext: /\b500k\b|\b1m\b|\blong context\b/.test(blob),
  }
}

function variantFromRecord(value: unknown): AccountVariant | null {
  const row = asRecord(value)
  if (row === null) {
    return null
  }
  const values: string[] = []
  if (Array.isArray(row.parameterValues)) {
    for (const item of row.parameterValues) {
      const param = asRecord(item)
      if (param === null) {
        continue
      }
      const id = asString(param.id)
      const paramValue = asString(param.value)
      if (paramValue !== '') {
        values.push(paramValue)
      } else if (id !== '') {
        values.push(id)
      }
    }
  }
  const label = visibleLabel(
    asString(row.displayName) ||
      asString(row.displayNameOutsidePicker) ||
      asString(row.variantStringRepresentation) ||
      values[0] ||
      '',
  )
  if (label === '') {
    return null
  }
  const flags = variantFlags(label, values)
  return { label, fast: flags.fast, longContext: flags.longContext }
}

function enumOptions(raw: Record<string, unknown>): AccountVariant[] {
  if (!Array.isArray(raw.parameterDefinitions)) {
    return []
  }
  const options: AccountVariant[] = []
  for (const def of raw.parameterDefinitions) {
    const record = asRecord(def)
    const parameterType = record ? asRecord(record.parameterType) : null
    const enumParameter = parameterType ? asRecord(parameterType.enumParameter) : null
    if (enumParameter === null || !Array.isArray(enumParameter.values)) {
      continue
    }
    for (const item of enumParameter.values) {
      const row = asRecord(item)
      if (row === null) {
        continue
      }
      const label = visibleLabel(asString(row.displayName) || asString(row.value))
      if (label === '') {
        continue
      }
      const flags = variantFlags(label, [asString(row.value)])
      options.push({ label, fast: flags.fast, longContext: flags.longContext })
    }
  }
  return options
}

function deduped(variants: AccountVariant[]): AccountVariant[] {
  const seen = new Set<string>()
  const out: AccountVariant[] = []
  for (const variant of variants) {
    const key = variant.label.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(variant)
  }
  return out
}

function providerOf(raw: Record<string, unknown>): string {
  const named = asString(raw.vendorName)
  if (named !== '') {
    return named
  }
  const vendor = asRecord(raw.vendor)
  return vendor ? asString(vendor.displayName) : ''
}

/**
 * A model is on when Cursor Settings shows the switch on: not in
 * `modelOverrideDisabled`, and either listed in `modelOverrideEnabled` or
 * `defaultOn` (missing counts as on).
 */
export function accountModelEnabled(
  id: string,
  defaultOn: boolean,
  enabledIds: readonly string[],
  disabledIds: readonly string[],
): boolean {
  if (disabledIds.includes(id)) {
    return false
  }
  if (enabledIds.includes(id)) {
    return true
  }
  return defaultOn
}

/** `null` when the payload is not the application-user blob. */
export function parseAccountModels(raw: string): AccountModel[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const root = asRecord(parsed)
  if (root === null || !Array.isArray(root.availableDefaultModels2)) {
    return null
  }
  const settings = asRecord(root.aiSettings)
  const enabledIds = stringList(settings?.modelOverrideEnabled)
  const disabledIds = stringList(settings?.modelOverrideDisabled)
  const models: AccountModel[] = []
  for (const item of root.availableDefaultModels2) {
    const rawModel = asRecord(item)
    if (rawModel === null || rawModel.isHidden === true) {
      continue
    }
    const id = asString(rawModel.name)
    if (id === '' || id === 'default') {
      continue
    }
    const name = visibleLabel(asString(rawModel.clientDisplayName)) || id
    const listed = Array.isArray(rawModel.variants)
      ? rawModel.variants.flatMap((variant) => {
          const parsedVariant = variantFromRecord(variant)
          return parsedVariant ? [parsedVariant] : []
        })
      : []
    const variants = deduped(listed.length > 0 ? listed : enumOptions(rawModel))
    models.push({
      id,
      name,
      provider: providerOf(rawModel),
      enabled: accountModelEnabled(
        id,
        rawModel.defaultOn !== false,
        enabledIds,
        disabledIds,
      ),
      variants,
    })
  }
  return models
}
