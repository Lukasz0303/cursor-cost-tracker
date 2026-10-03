import { describe, expect, it } from 'vitest'
import {
  billingCycleRenewalIsMidday,
  effectiveForecastWindow,
  hasUsableBillingCycle,
  isInBillingCycle,
  parseBillingCycleRange,
} from '../src/forecastWindow'

describe('forecast window helpers', () => {
  it.each([
    [25, false],
    [26, true],
    [35, true],
    [36, false],
  ])('gates a %d-day cycle', (days, usable) => {
    const start = '2026-01-01T00:00:00.000Z'
    const end = new Date(Date.parse(start) + days * 24 * 60 * 60 * 1000).toISOString()
    expect(hasUsableBillingCycle(start, end)).toBe(usable)
  })

  it('falls back when the end is missing or inverted', () => {
    expect(hasUsableBillingCycle('2026-01-01T00:00:00.000Z', null)).toBe(false)
    expect(
      effectiveForecastWindow(
        'billingCycle',
        '2026-02-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
      ),
    ).toBe('calendarMonth')
  })

  it('uses half-open instant membership', () => {
    const range = parseBillingCycleRange(
      '2026-01-01T12:00:00.000Z',
      '2026-02-01T12:00:00.000Z',
    )
    expect(range).not.toBeNull()
    expect(isInBillingCycle(Date.parse('2026-01-01T11:59:59.999Z'), range!)).toBe(false)
    expect(isInBillingCycle(Date.parse('2026-01-01T12:00:00.000Z'), range!)).toBe(true)
    expect(isInBillingCycle(Date.parse('2026-02-01T12:00:00.000Z'), range!)).toBe(false)
  })

  it('exposes the local renewal day and midday marker', () => {
    const end = '2026-10-15T13:51:29.000Z'
    expect(billingCycleRenewalIsMidday(end)).toBe(true)
    expect(
      billingCycleRenewalIsMidday(new Date(2026, 9, 15).toISOString()),
    ).toBe(false)
  })
})
