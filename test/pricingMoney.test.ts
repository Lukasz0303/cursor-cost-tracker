import { describe, expect, it } from 'vitest'
import { pricePerMillion } from '../src/pricing/money'

describe('pricePerMillion', () => {
  it('parses dollar and bare number cells', () => {
    expect(pricePerMillion('$2')).toBe(2)
    expect(pricePerMillion('$2.50')).toBe(2.5)
    expect(pricePerMillion('$0.20')).toBe(0.2)
    expect(pricePerMillion('2')).toBe(2)
    expect(pricePerMillion('$1,234.50')).toBe(1234.5)
  })

  it('rejects empty, dashes, Free, and sentence cells', () => {
    expect(pricePerMillion(null)).toBeNull()
    expect(pricePerMillion('')).toBeNull()
    expect(pricePerMillion('—')).toBeNull()
    expect(pricePerMillion('-')).toBeNull()
    expect(pricePerMillion('Free')).toBeNull()
    expect(pricePerMillion('$2 / 1M')).toBeNull()
    expect(pricePerMillion('$2 per 1M')).toBeNull()
  })
})
