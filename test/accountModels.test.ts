import { describe, expect, it } from 'vitest'
import {
  accountModelEnabled,
  parseAccountModels,
  visibleLabel,
} from '../src/pricing/accountModels'

describe('accountModelEnabled', () => {
  it('follows the Cursor Settings switch', () => {
    expect(accountModelEnabled('grok-4.7', true, [], [])).toBe(true)
    expect(accountModelEnabled('grok-4.5', true, [], ['grok-4.5'])).toBe(false)
    expect(accountModelEnabled('muse-spark-1.3', false, ['muse-spark-1.3'], [])).toBe(
      true,
    )
    expect(accountModelEnabled('gpt-5.6-luna', false, [], [])).toBe(false)
  })
})

describe('visibleLabel', () => {
  it('keeps the option inside the picker span and drops the markup', () => {
    expect(
      visibleLabel(
        'Composer 2.5 <span style="color: var(--cursor-text-tertiary);">Fast</span>',
      ),
    ).toBe('Fast')
    expect(
      visibleLabel(
        'Gemini 3.8 Flash <span style="color: var(--cursor-text-tertiary);">Low</span>',
      ),
    ).toBe('Low')
  })
})

describe('parseAccountModels', () => {
  it('keeps enabled picker models and their effort options', () => {
    const raw = JSON.stringify({
      cursorCreds: { accessToken: 'secret' },
      aiSettings: {
        modelOverrideEnabled: ['muse-spark-1.3'],
        modelOverrideDisabled: ['grok-4.5'],
      },
      availableDefaultModels2: [
        { name: 'default', clientDisplayName: 'Auto', defaultOn: true },
        {
          name: 'grok-4.7',
          clientDisplayName: 'Grok 4.7',
          defaultOn: true,
          vendorName: 'Cursor',
          variants: [
            { displayName: 'Medium', parameterValues: [{ id: 'effort', value: 'medium' }] },
            { displayName: 'High', parameterValues: [{ id: 'effort', value: 'high' }] },
          ],
        },
        {
          name: 'grok-4.5',
          clientDisplayName: 'Grok 4.5',
          defaultOn: true,
          vendorName: 'Cursor',
        },
        {
          name: 'muse-spark-1.3',
          clientDisplayName: 'Muse Spark 1.3',
          defaultOn: false,
          vendor: { displayName: 'Meta' },
        },
        { name: 'hidden-model', clientDisplayName: 'Hidden', defaultOn: true, isHidden: true },
      ],
    })
    const models = parseAccountModels(raw)
    expect(models).toEqual([
      {
        id: 'grok-4.7',
        name: 'Grok 4.7',
        provider: 'Cursor',
        enabled: true,
        variants: [
          { label: 'Medium', fast: false, longContext: false },
          { label: 'High', fast: false, longContext: false },
        ],
      },
      {
        id: 'grok-4.5',
        name: 'Grok 4.5',
        provider: 'Cursor',
        enabled: false,
        variants: [],
      },
      {
        id: 'muse-spark-1.3',
        name: 'Muse Spark 1.3',
        provider: 'Meta',
        enabled: true,
        variants: [],
      },
    ])
    expect(JSON.stringify(models)).not.toContain('secret')
  })

  it('returns null when the blob is not the model list', () => {
    expect(parseAccountModels('{"aiSettings":{}}')).toBeNull()
    expect(parseAccountModels('not-json')).toBeNull()
  })
})
