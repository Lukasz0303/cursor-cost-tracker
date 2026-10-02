import { describe, expect, it } from 'vitest'
import { catalogFor, interpolate, type UiCatalog } from '../src/i18n'
import { localeBcp47, LOCALES, parseLocale } from '../src/locale'

describe('parseLocale', () => {
  it('defaults to English', () => {
    expect(parseLocale(undefined)).toBe('en')
    expect(parseLocale('hi')).toBe('en')
    expect(parseLocale('zh-tw')).toBe('en')
    expect(parseLocale('')).toBe('en')
  })

  it('accepts every shipped locale', () => {
    for (const locale of LOCALES) {
      expect(parseLocale(locale)).toBe(locale)
    }
  })

  it('maps each locale to a BCP 47 tag', () => {
    expect(localeBcp47('en')).toBe('en-US')
    expect(localeBcp47('pl')).toBe('pl-PL')
    expect(localeBcp47('zh-cn')).toBe('zh-CN')
  })
})

describe('catalogs', () => {
  it('translates selected values', () => {
    const en = catalogFor('en')
    expect(catalogFor('pl').tabs.settings).toBe('Ustawienia')
    expect(en.tabs.settings).toBe('Settings')
    expect(catalogFor('zh-cn').tabs.settings).not.toBe('Settings')
    expect(catalogFor('de').tabs.settings).not.toBe('Settings')
  })

  describe.each(LOCALES)('%s', (locale) => {
    const en = catalogFor('en')
    type SectionKey = keyof UiCatalog
    const enKeys = Object.keys(en) as SectionKey[]

    it('has the same section keys as english', () => {
      expect(Object.keys(catalogFor(locale))).toEqual(enKeys)
    })

    it.each(enKeys)('%s section has the same keys', (key) => {
      expect(Object.keys(catalogFor(locale)[key])).toEqual(Object.keys(en[key]))
    })
  })

  it('interpolates placeholders', () => {
    expect(interpolate('Last {n} Cursor queries', { n: 1000 })).toBe(
      'Last 1000 Cursor queries',
    )
  })
})
