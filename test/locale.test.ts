import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
    expect(catalogFor('zh-cn').tabs.settings).toBe('设置')
    expect(catalogFor('de').tabs.settings).toBe('Einstellungen')
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
  
  describe('settings in package.json', async () => {
    const packageJson = await import('../package.json');

    const getLanguageProperty = () => packageJson.contributes.configuration.properties['cursorCost.language'];

    it('has the same locales as the catalogs', () => {
      expect(getLanguageProperty().enum).toEqual(LOCALES)
    })

    it('has the same default locale as the catalogs', () => {
      expect(getLanguageProperty().default).toEqual('en')
    })

    it('has the same number of enum descriptions as the catalogs', () => {
      expect(getLanguageProperty().enumDescriptions).toHaveLength(LOCALES.length)
    })
  })
})

describe('webview language allowlists', () => {
  const repoRoot = join(import.meta.dirname, '..')
  const historyJs = readFileSync(join(repoRoot, 'media/history.js'), 'utf8')
  const historyHtml = readFileSync(join(repoRoot, 'media/history.html'), 'utf8')

  function extractHistoryJsObjectBody(constName: string): string {
    const re = new RegExp(`const ${constName} = \\{([\\s\\S]*?)\\n  \\}`)
    const match = historyJs.match(re)
    if (!match) {
      throw new Error(`const ${constName} not found in media/history.js`)
    }
    return match[1]
  }

  function keysFromHistoryJsObjectBody(body: string): string[] {
    const keys: string[] = []
    for (const line of body.split('\n')) {
      const keyMatch = line.match(
        /^\s*(?:'([^']+)'|"([^"]+)"|([a-z]{2}(?:-[a-z]{2})?))\s*:/,
      )
      if (keyMatch) {
        keys.push(keyMatch[1] ?? keyMatch[2] ?? keyMatch[3]!)
      }
    }
    return keys
  }

  function entriesFromHistoryJsObjectBody(
    body: string,
  ): { key: string; value: string }[] {
    const entries: { key: string; value: string }[] = []
    for (const line of body.split('\n')) {
      const entryMatch = line.match(
        /^\s*(?:'([^']+)'|"([^"]+)"|([a-z]{2}(?:-[a-z]{2})?))\s*:\s*'([^']*)'/,
      )
      if (entryMatch) {
        entries.push({
          key: entryMatch[1] ?? entryMatch[2] ?? entryMatch[3]!,
          value: entryMatch[4],
        })
      }
    }
    return entries
  }

  function languageSettingOptionValues(html: string): string[] {
    const selectMatch = html.match(
      /<select id="languageSetting">([\s\S]*?)<\/select>/,
    )
    if (!selectMatch) {
      throw new Error('#languageSetting select not found in media/history.html')
    }
    return [...selectMatch[1].matchAll(/<option value="([^"]+)"/g)].map(
      (m) => m[1],
    )
  }

  it('SUPPORTED_LANGUAGES keys match LOCALES', () => {
    const body = extractHistoryJsObjectBody('SUPPORTED_LANGUAGES')
    expect(keysFromHistoryJsObjectBody(body)).toEqual(LOCALES)
  })

  it('DOCUMENT_LANG keys match LOCALES', () => {
    const body = extractHistoryJsObjectBody('DOCUMENT_LANG')
    expect(keysFromHistoryJsObjectBody(body)).toEqual(LOCALES)
  })

  it('DOCUMENT_LANG values are non-empty BCP-style tags', () => {
    const body = extractHistoryJsObjectBody('DOCUMENT_LANG')
    const entries = entriesFromHistoryJsObjectBody(body)
    expect(entries.map((e) => e.key)).toEqual(LOCALES)
    for (const { value } of entries) {
      expect(value.length).toBeGreaterThan(0)
    }
    expect(Object.fromEntries(entries.map((e) => [e.key, e.value]))).toMatchObject({
      'zh-cn': 'zh-CN',
      'pt-br': 'pt-BR',
    })
  })

  it('languageSetting options match LOCALES', () => {
    expect(languageSettingOptionValues(historyHtml)).toEqual([...LOCALES])
  })
})
