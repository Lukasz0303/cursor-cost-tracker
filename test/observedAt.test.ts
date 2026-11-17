import { describe, expect, it } from 'vitest'
import { earlierObservedAt, isUnknownObservedAt, laterObservedAt } from '../src/openaiHistory/observedAt'

describe('observedAt', () => {
  it('treats epoch and blank stamps as unknown', () => {
    expect(isUnknownObservedAt('1970-01-01T00:00:00.000Z')).toBe(true)
    expect(isUnknownObservedAt('')).toBe(true)
    expect(isUnknownObservedAt(null)).toBe(true)
    expect(isUnknownObservedAt('2026-11-17T09:50:00.000Z')).toBe(false)
  })

  it('lets a real instant replace a stuck epoch bound', () => {
    expect(earlierObservedAt('1970-01-01T00:00:00.000Z', '2026-11-17T09:50:00.000Z')).toBe(
      '2026-11-17T09:50:00.000Z',
    )
    expect(laterObservedAt('1970-01-01T00:00:00.000Z', '2026-11-17T09:50:00.000Z')).toBe(
      '2026-11-17T09:50:00.000Z',
    )
    expect(earlierObservedAt('2026-11-17T09:50:00.000Z', '2026-11-17T12:00:00.000Z')).toBe(
      '2026-11-17T09:50:00.000Z',
    )
  })
})
