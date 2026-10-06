import { DEFAULT_LOCALE, type Locale } from './locale'
import { catalogForLocale, EN, PL, type UiCatalog } from './i18n/catalogs'

export type { UiCatalog }
export { EN, PL }

export function interpolate(
  template: string,
  vars: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) {
      return match
    }
    return String(vars[key])
  })
}

export function catalogFor(locale: Locale = DEFAULT_LOCALE): UiCatalog {
  return catalogForLocale(locale)
}
