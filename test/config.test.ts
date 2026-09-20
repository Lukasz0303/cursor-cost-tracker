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

describe('config overlay', () => {
  it('overrides disk config until reconciled', async () => {
    const {
      clearCursorCostConfigOverlay,
      patchCursorCostConfigOverlay,
      readCursorCostConfig,
      reconcileCursorCostConfigOverlay,
    } = await import('../src/config')
    clearCursorCostConfigOverlay()
    const section = {
      get(key: string, defaultValue: unknown) {
        if (key === 'recentQueryCount') {
          return 6
        }
        return defaultValue
      },
    }
    patchCursorCostConfigOverlay({ recentQueryCount: 1 })
    expect(readCursorCostConfig(section).recentQueryCount).toBe(1)
    reconcileCursorCostConfigOverlay({
      get(key: string, defaultValue: unknown) {
        if (key === 'recentQueryCount') {
          return 1
        }
        return defaultValue
      },
    })
    expect(readCursorCostConfig(section).recentQueryCount).toBe(6)
    clearCursorCostConfigOverlay()
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
        if (key === 'showCriticalAlert') {
          return false
        }
        if (key === 'criticalTokenThreshold') {
          return 20_000_000
        }
        if (key === 'criticalCostUsdThreshold') {
          return 7.5
        }
        if (key === 'recentQueryCount') {
          return 12
        }
        return defaultValue
      },
    })
    expect(config.okColor).toBe('#AABBCC')
    expect(config.warnColor).toBe(DEFAULT_WARN_COLOR)
    expect(config.showSpikeWarning).toBe(false)
    expect(config.showCriticalAlert).toBe(false)
    expect(config.criticalTokenThreshold).toBe(20_000_000)
    expect(config.criticalCostUsdThreshold).toBe(7.5)
    expect(config.recentQueryCount).toBe(10)
    expect(config.historyFromDate).toBeNull()
  })

  it('reads Burn Rate Guard settings and raises critical to warning', () => {
    const config = cursorCostConfigFrom({
      get(key, defaultValue) {
        if (key === 'burnRateGuard') {
          return false
        }
        if (key === 'burnRateWindowMinutes') {
          return 90
        }
        if (key === 'burnRateWarningUsd') {
          return 4
        }
        if (key === 'burnRateCriticalUsd') {
          return 1
        }
        if (key === 'burnRateMinQueries') {
          return 3
        }
        if (key === 'burnRateWarningToast') {
          return false
        }
        return defaultValue
      },
    })
    expect(config.burnRateGuard).toBe(false)
    expect(config.burnRateWindowMinutes).toBe(60)
    expect(config.burnRateWarningUsd).toBe(4)
    expect(config.burnRateCriticalUsd).toBe(4)
    expect(config.burnRateMinQueries).toBe(3)
    expect(config.burnRateWarningToast).toBe(false)
    expect(config.burnRateCriticalToast).toBe(true)
  })

  it('reads language from settings', () => {
    const config = cursorCostConfigFrom({
      get(key, defaultValue) {
        if (key === 'language') {
          return 'pl'
        }
        return defaultValue
      },
    })
    expect(config.language).toBe('pl')
  })

  it('falls back to English for invalid language', () => {
    const config = cursorCostConfigFrom({
      get(key, defaultValue) {
        if (key === 'language') {
          return 'hi'
        }
        return defaultValue
      },
    })
    expect(config.language).toBe('en')
  })

  it('reads Chinese Simplified language from settings', () => {
    const config = cursorCostConfigFrom({
      get(key, defaultValue) {
        if (key === 'language') {
          return 'zh-cn'
        }
        return defaultValue
      },
    })
    expect(config.language).toBe('zh-cn')
  })

  it('reads historyFromDate from settings', () => {
    const config = cursorCostConfigFrom({
      get(key, defaultValue) {
        if (key === 'historyFromDate') {
          return '2026-09-01'
        }
        return defaultValue
      },
    })
    expect(config.historyFromDate).toBe('2026-09-01')
  })

  it('clears invalid historyFromDate', () => {
    const config = cursorCostConfigFrom({
      get(key, defaultValue) {
        if (key === 'historyFromDate') {
          return '01.09.2026'
        }
        return defaultValue
      },
    })
    expect(config.historyFromDate).toBeNull()
  })

  it('reads budgetDayBasis from settings', () => {
    const config = cursorCostConfigFrom({
      get(key, defaultValue) {
        if (key === 'budgetDayBasis') {
          return 'calendarDays'
        }
        return defaultValue
      },
    })
    expect(config.budgetDayBasis).toBe('calendarDays')
  })

  it('falls back to workingDays for unknown budgetDayBasis', () => {
    const config = cursorCostConfigFrom({
      get(key, defaultValue) {
        if (key === 'budgetDayBasis') {
          return 'weekendsOnly'
        }
        return defaultValue
      },
    })
    expect(config.budgetDayBasis).toBe('workingDays')
  })

  it('reads optimizeDepth from settings', () => {
    const config = cursorCostConfigFrom({
      get(key, defaultValue) {
        if (key === 'optimizeDepth') {
          return 'deep'
        }
        return defaultValue
      },
    })
    expect(config.optimizeDepth).toBe('deep')
  })

  it('falls back to balanced for unknown optimizeDepth', () => {
    const config = cursorCostConfigFrom({
      get(key, defaultValue) {
        if (key === 'optimizeDepth') {
          return 'mega'
        }
        return defaultValue
      },
    })
    expect(config.optimizeDepth).toBe('balanced')
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
