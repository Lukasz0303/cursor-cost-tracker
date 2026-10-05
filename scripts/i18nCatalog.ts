type Dict = Record<string, unknown>

export function isRecord(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Copy English leaves that the locale is missing.
 * Existing keys stay in their current order. Nothing is deleted or reordered.
 */
export function fillMissing(
  english: unknown,
  catalog: unknown,
): { value: Dict; changed: boolean } {
  if (!isRecord(english)) return { value: {}, changed: false }
  if (!isRecord(catalog)) return { value: { ...english }, changed: true }
  const out: Dict = {}
  let changed = false
  for (const key of Object.keys(catalog)) {
    if (!(key in english)) {
      out[key] = catalog[key]
      continue
    }
    const fromEnglish = english[key]
    const current = catalog[key]
    if (isRecord(fromEnglish)) {
      const nested = fillMissing(fromEnglish, isRecord(current) ? current : {})
      out[key] = nested.value
      changed = changed || nested.changed || !isRecord(current)
      continue
    }
    out[key] = current
  }
  for (const key of Object.keys(english)) {
    if (key in out) continue
    out[key] = english[key]
    changed = true
  }
  return { value: out, changed }
}

/** Nested copy of leaves that are still the English sentence. */
export function sameAsEnglish(english: unknown, catalog: unknown): Dict {
  if (!isRecord(english) || !isRecord(catalog)) return {}
  const out: Dict = {}
  for (const key of Object.keys(english)) {
    const fromEnglish = english[key]
    const current = catalog[key]
    if (isRecord(fromEnglish)) {
      const nested = sameAsEnglish(fromEnglish, current)
      if (Object.keys(nested).length > 0) out[key] = nested
      continue
    }
    if (typeof fromEnglish === 'string' && current === fromEnglish) {
      out[key] = current
    }
  }
  return out
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{[^{}]+\}/g)].map((match) => match[0]).sort()
}

/**
 * Apply a translator JSON onto a catalog.
 * Unknown keys and `{placeholder}` mismatches are reported and not written.
 */
export function applyTranslations(
  english: unknown,
  catalog: unknown,
  patch: unknown,
): { value: Dict; problems: string[] } {
  const problems: string[] = []
  const filled = fillMissing(english, catalog)
  const value = applyPatch(english, filled.value, patch, '', problems)
  return { value, problems }
}

function applyPatch(
  english: unknown,
  catalog: Dict,
  patch: unknown,
  prefix: string,
  problems: string[],
): Dict {
  if (!isRecord(patch)) {
    if (prefix !== '') problems.push(`expected an object at ${prefix}`)
    return catalog
  }
  const englishRec = isRecord(english) ? english : {}
  const out: Dict = { ...catalog }
  for (const key of Object.keys(patch)) {
    const path = prefix === '' ? key : `${prefix}.${key}`
    const nextPatch = patch[key]
    const fromEnglish = englishRec[key]
    if (!(key in englishRec)) {
      problems.push(`unknown ${path}`)
      continue
    }
    if (isRecord(fromEnglish)) {
      if (!isRecord(nextPatch)) {
        problems.push(`expected an object at ${path}`)
        continue
      }
      const current = isRecord(out[key]) ? out[key] : {}
      out[key] = applyPatch(fromEnglish, current, nextPatch, path, problems)
      continue
    }
    if (typeof fromEnglish !== 'string') continue
    if (typeof nextPatch !== 'string') {
      problems.push(`expected a string at ${path}`)
      continue
    }
    if (placeholders(fromEnglish).join('\0') !== placeholders(nextPatch).join('\0')) {
      problems.push(`placeholders ${path}`)
      continue
    }
    out[key] = nextPatch
  }
  return out
}
