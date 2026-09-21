/** UI language for Cursor Cost Tracker (independent of VS Code display language). */
export type Locale =
  | 'en'
  | 'pl'
  | 'zh-cn'
  | 'ja'
  | 'es'
  | 'pt-br'
  | 'ru'
  | 'ko'
  | 'fr'
  | 'de'

export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALES: Locale[] = [
  'en',
  'pl',
  'zh-cn',
  'ja',
  'es',
  'pt-br',
  'ru',
  'ko',
  'fr',
  'de',
]

const LOCALE_SET = new Set<string>(LOCALES)

export function parseLocale(value: unknown): Locale {
  if (typeof value === 'string' && LOCALE_SET.has(value)) {
    return value as Locale
  }
  return DEFAULT_LOCALE
}

const BCP47: Record<Locale, string> = {
  en: 'en-US',
  pl: 'pl-PL',
  'zh-cn': 'zh-CN',
  ja: 'ja-JP',
  es: 'es-ES',
  'pt-br': 'pt-BR',
  ru: 'ru-RU',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
}

export function localeBcp47(locale: Locale): string {
  return BCP47[locale]
}
