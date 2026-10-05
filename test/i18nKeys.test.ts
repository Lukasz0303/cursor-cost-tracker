import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DE } from '../src/i18n/catalogs/de'
import { EN } from '../src/i18n/catalogs/en'
import { ES } from '../src/i18n/catalogs/es'
import { FR } from '../src/i18n/catalogs/fr'
import { catalogDrift } from '../src/i18n/catalogs'
import { JA } from '../src/i18n/catalogs/ja'
import { KO } from '../src/i18n/catalogs/ko'
import { PL } from '../src/i18n/catalogs/pl'
import { PT_BR } from '../src/i18n/catalogs/pt-br'
import { RU } from '../src/i18n/catalogs/ru'
import { UK } from '../src/i18n/catalogs/uk'
import { ZH_CN } from '../src/i18n/catalogs/zh-cn'

const CATALOGS = {
  pl: PL,
  'zh-cn': ZH_CN,
  ja: JA,
  es: ES,
  'pt-br': PT_BR,
  ru: RU,
  ko: KO,
  fr: FR,
  de: DE,
  uk: UK,
}

const catalogsDir = join(dirname(fileURLToPath(import.meta.url)), '../src/i18n/catalogs')

describe('catalog key parity', () => {
  it('English has no drift against itself', () => {
    expect(catalogDrift(EN)).toEqual([])
  })

  it('ships one TypeScript catalog per locale', () => {
    const jsonCatalogs = readdirSync(catalogsDir).filter((name) => name.endsWith('.json'))
    expect(jsonCatalogs).toEqual([])
  })

  it.each(Object.entries(CATALOGS))('%s matches English keys and placeholders', (_locale, catalog) => {
    expect(catalogDrift(catalog)).toEqual([])
  })
})
