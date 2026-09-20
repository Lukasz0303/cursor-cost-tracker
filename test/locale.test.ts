import { describe, expect, it } from 'vitest'
import { catalogFor, interpolate } from '../src/i18n'
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
  it('keeps the same section keys in every locale', () => {
    const en = catalogFor('en')
    const enKeys = Object.keys(en)
    for (const locale of LOCALES) {
      expect(Object.keys(catalogFor(locale))).toEqual(enKeys)
    }
    expect(catalogFor('pl').tabs.settings).toBe('Ustawienia')
    expect(en.tabs.settings).toBe('Settings')
    expect(catalogFor('zh-cn').tabs.settings).not.toBe('Settings')
    expect(catalogFor('de').tabs.settings).not.toBe('Settings')
  })

  it('interpolates placeholders', () => {
    expect(interpolate('Last {n} Cursor queries', { n: 1000 })).toBe(
      'Last 1000 Cursor queries',
    )
  })
})
