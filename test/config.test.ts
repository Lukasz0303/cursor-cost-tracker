import { describe, expect, it } from 'vitest'
import {
  cursorCostConfigFrom,
  DEFAULT_OK_COLOR,
  DEFAULT_OK_COLOR_LIGHT,
  DEFAULT_WARN_COLOR,
  DEFAULT_WARN_COLOR_LIGHT,
  colorSchemeFromKind,
  parseHexColor,
  resolveStatusColors,
} from '../src/config'

describe('parseHexColor', () => {
  it('accepts #RGB and #RRGGBB', () => {
    expect(parseHexColor('#0f0', DEFAULT_OK_COLOR)).toBe('#00FF00')
    expect(parseHexColor('#89d185', DEFAULT_OK_COLOR)).toBe('#89D185')
  })

  it('falls back on garbage', () => {
    expect(parseHexColor('green', DEFAULT_OK_COLOR)).toBe(DEFAULT_OK_COLOR)
    expect(parseHexColor('', DEFAULT_WARN_COLOR)).toBe(DEFAULT_WARN_COLOR)
  })
})

describe('cursorCostConfigFrom', () => {
  it('reads warning colors from settings', () => {
    const config = cursorCostConfigFrom({
      get(key, defaultValue) {
        if (key === 'okColor') {
          return '#abc'
        }
        if (key === 'warnColor') {
          return 'nope'
        }
        if (key === 'showSpikeWarning') {
          return false
        }
        return defaultValue
      },
    })
    expect(config.okColor).toBe('#AABBCC')
    expect(config.warnColor).toBe(DEFAULT_WARN_COLOR)
    expect(config.showSpikeWarning).toBe(false)
  })
})

describe('colorSchemeFromKind', () => {
  it('treats Light and High Contrast Light as light', () => {
    expect(colorSchemeFromKind(1)).toBe('light')
    expect(colorSchemeFromKind(4)).toBe('light')
  })

  it('treats Dark and High Contrast as dark', () => {
    expect(colorSchemeFromKind(2)).toBe('dark')
    expect(colorSchemeFromKind(3)).toBe('dark')
  })
})

describe('resolveStatusColors', () => {
  it('keeps custom hex on every theme', () => {
    expect(
      resolveStatusColors(
        { okColor: '#AABBCC', warnColor: '#112233' },
        'light',
      ),
    ).toEqual({ okColor: '#AABBCC', warnColor: '#112233' })
  })

  it('uses darker defaults on a light theme', () => {
    expect(
      resolveStatusColors(
        { okColor: DEFAULT_OK_COLOR, warnColor: DEFAULT_WARN_COLOR },
        'light',
      ),
    ).toEqual({
      okColor: DEFAULT_OK_COLOR_LIGHT,
      warnColor: DEFAULT_WARN_COLOR_LIGHT,
    })
  })

  it('keeps mint/coral defaults on a dark theme', () => {
    expect(
      resolveStatusColors(
        { okColor: DEFAULT_OK_COLOR_LIGHT, warnColor: DEFAULT_WARN_COLOR_LIGHT },
        'dark',
      ),
    ).toEqual({
      okColor: DEFAULT_OK_COLOR,
      warnColor: DEFAULT_WARN_COLOR,
    })
  })
})
