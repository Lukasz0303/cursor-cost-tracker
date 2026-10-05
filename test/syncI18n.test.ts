import { describe, expect, it } from 'vitest'
import { EN } from '../src/i18n/catalogs/en'
import { catalogDrift } from '../src/i18n/catalogs'
import {
  applyTranslations,
  fillMissing,
  sameAsEnglish,
} from '../scripts/i18nCatalog'

describe('i18n catalog sync', () => {
  it('leaves a complete catalog untouched and in the same order', () => {
    const catalog = {
      tabs: { settings: 'Ustawienia', support: 'Wsparcie' },
    }
    const english = {
      tabs: { support: 'Support', settings: 'Settings' },
    }
    const filled = fillMissing(english, catalog)
    expect(filled.changed).toBe(false)
    expect(Object.keys(filled.value['tabs'] as object)).toEqual([
      'settings',
      'support',
    ])
  })

  it('appends only the missing English key', () => {
    const filled = fillMissing(
      { tabs: { settings: 'Settings', support: 'Support' } },
      { tabs: { settings: 'Ustawienia' } },
    )
    expect(filled.changed).toBe(true)
    expect(filled.value).toEqual({
      tabs: { settings: 'Ustawienia', support: 'Support' },
    })
  })

  it('exports only sentences that still match English', () => {
    expect(
      sameAsEnglish(
        { tabs: { settings: 'Settings', support: 'Support' } },
        { tabs: { settings: 'Ustawienia', support: 'Support' } },
      ),
    ).toEqual({ tabs: { support: 'Support' } })
  })

  it('rejects a translation that drops a placeholder', () => {
    const applied = applyTranslations(
      { alerts: { detailLine: '{tokens} tokens · {cost}' } },
      { alerts: { detailLine: '{tokens} tokens · {cost}' } },
      { alerts: { detailLine: '{tokens} tokenów' } },
    )
    expect(applied.problems).toEqual(['placeholders alerts.detailLine'])
    expect(applied.value).toEqual({
      alerts: { detailLine: '{tokens} tokens · {cost}' },
    })
  })

  it('reports a placeholder added to a real catalog section', () => {
    const broken = {
      ...EN,
      tabs: { ...EN.tabs, settings: 'Settings {extra}' },
    }
    expect(catalogDrift(broken)).toContain('placeholders tabs.settings')
  })
})
