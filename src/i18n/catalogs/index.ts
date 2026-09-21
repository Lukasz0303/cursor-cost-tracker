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

export type { UiCatalog }
export { EN, PL }

const CATALOGS: Record<Locale, UiCatalog> = {
  en: EN,
  pl: PL,
  'zh-cn': ZH_CN,
  ja: JA,
  es: ES,
  'pt-br': PT_BR,
  ru: RU,
  ko: KO,
  fr: FR,
  de: DE,
}

export function catalogForLocale(locale: Locale): UiCatalog {
  return CATALOGS[locale] ?? EN
}
