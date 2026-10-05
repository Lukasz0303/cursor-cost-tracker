import type { Locale } from '../../locale'
import { EN, type UiCatalog } from './en'
import { PL } from './pl'
import { ZH_CN } from './zh-cn'
import { JA } from './ja'
import { ES } from './es'
import { PT_BR } from './pt-br'
import { RU } from './ru'
import { KO } from './ko'
import { FR } from './fr'
import { DE } from './de'
import { UK } from './uk'

export type { UiCatalog }
export { EN, PL }

const CATALOGS: Record<Locale, UiCatalog> = {
  en: EN,
  pl: withEnglishDefaults(PL),
  'zh-cn': withEnglishDefaults(ZH_CN),
  ja: withEnglishDefaults(JA),
  es: withEnglishDefaults(ES),
  'pt-br': withEnglishDefaults(PT_BR),
  ru: withEnglishDefaults(RU),
  ko: withEnglishDefaults(KO),
  fr: withEnglishDefaults(FR),
  de: withEnglishDefaults(DE),
  uk: withEnglishDefaults(UK),
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Fill keys added in English when a locale catalog has not caught up yet. */
function withEnglishDefaults(catalog: object): UiCatalog {
  return mergeRecords(EN, catalog) as UiCatalog
}

function mergeRecords(
  base: object,
  over: object,
): Record<string, unknown> {
  const baseRec = base as Record<string, unknown>
  const overRec = over as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(baseRec)) {
    const left = baseRec[key]
    const right = overRec[key]
    if (isPlainRecord(left) && isPlainRecord(right)) {
      out[key] = mergeRecords(left, right)
      continue
    }
    out[key] = right === undefined ? left : right
  }
  return out
}

export function missingCatalogKeys(catalog: object): string[] {
  return collectMissing(EN, catalog, '')
}

/** Missing keys, extra keys, and `{placeholder}` sets that differ from English. */
export function catalogDrift(catalog: object): string[] {
  return collectDrift(EN, catalog, '')
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{[^{}]+\}/g)].map((match) => match[0]).sort()
}

function collectDrift(base: object, over: object, prefix: string): string[] {
  const baseRec = base as Record<string, unknown>
  const overRec = over as Record<string, unknown>
  const problems: string[] = []
  for (const key of Object.keys(overRec)) {
    if (!(key in baseRec)) {
      const path = prefix === '' ? key : `${prefix}.${key}`
      problems.push(`extra ${path}`)
    }
  }
  for (const key of Object.keys(baseRec)) {
    const path = prefix === '' ? key : `${prefix}.${key}`
    const left = baseRec[key]
    const right = overRec[key]
    if (isPlainRecord(left)) {
      if (!isPlainRecord(right)) {
        problems.push(`missing ${path}`)
        continue
      }
      problems.push(...collectDrift(left, right, path))
      continue
    }
    if (typeof left !== 'string') continue
    if (typeof right !== 'string') {
      problems.push(`missing ${path}`)
      continue
    }
    if (placeholders(left).join('\0') !== placeholders(right).join('\0')) {
      problems.push(`placeholders ${path}`)
    }
  }
  return problems
}

function collectMissing(base: object, over: object, prefix: string): string[] {
  const baseRec = base as Record<string, unknown>
  const overRec = over as Record<string, unknown>
  const missing: string[] = []
  for (const key of Object.keys(baseRec)) {
    const path = prefix === '' ? key : `${prefix}.${key}`
    const left = baseRec[key]
    const right = overRec[key]
    if (isPlainRecord(left)) {
      if (!isPlainRecord(right)) {
        missing.push(path)
        continue
      }
      missing.push(...collectMissing(left, right, path))
      continue
    }
    if (right === undefined) {
      missing.push(path)
    }
  }
  return missing
}

export function catalogForLocale(locale: Locale): UiCatalog {
  return CATALOGS[locale] ?? EN
}
