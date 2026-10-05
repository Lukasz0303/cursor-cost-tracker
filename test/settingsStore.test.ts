import { describe, expect, it } from 'vitest'
import { coercePersistedSetting } from '../src/settingsStore'

describe('coercePersistedSetting', () => {
  it('clamps a numeric overlay and drops a non-number', () => {
    expect(coercePersistedSetting('historyLimit', 50)).toBe(100)
    expect(coercePersistedSetting('historyLimit', 2500)).toBe(2500)
    expect(coercePersistedSetting('historyLimit', '2000')).toBeUndefined()
    expect(coercePersistedSetting('pollIntervalMinutes', 99)).toBe(60)
  })

  it('keeps booleans and drops other types', () => {
    expect(coercePersistedSetting('showStatusBar', false)).toBe(false)
    expect(coercePersistedSetting('showStatusBar', 'false')).toBeUndefined()
  })

  it('accepts a real calendar day and drops a broken one', () => {
    expect(coercePersistedSetting('historyFromDate', '2026-10-05')).toBe(
      '2026-10-05',
    )
    expect(coercePersistedSetting('historyFromDate', '')).toBeNull()
    expect(coercePersistedSetting('historyFromDate', 'yesterday')).toBeUndefined()
  })

  it('accepts known enums and hex colors only', () => {
    expect(coercePersistedSetting('language', 'pl')).toBe('pl')
    expect(coercePersistedSetting('language', 'xx')).toBeUndefined()
    expect(coercePersistedSetting('optimizeDepth', 'deep')).toBe('deep')
    expect(coercePersistedSetting('budgetDayBasis', 'calendarDays')).toBe(
      'calendarDays',
    )
    expect(coercePersistedSetting('forecastWindow', 'billingCycle')).toBe(
      'billingCycle',
    )
    expect(coercePersistedSetting('okColor', '#abc')).toBe('#AABBCC')
    expect(coercePersistedSetting('warnColor', 'red')).toBeUndefined()
  })
})
