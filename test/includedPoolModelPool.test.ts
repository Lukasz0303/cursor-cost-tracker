import { describe, expect, it } from 'vitest'
import {
  includedPoolForModel,
  includedPoolForQuotaName,
} from '../src/includedPool/modelPool'

describe('includedPoolForModel', () => {
  it('maps Grok, Default, and Composer to Cursor Models', () => {
    expect(includedPoolForModel('grok-4.7-high')).toBe('cursor')
    expect(includedPoolForModel('grok-4.7-high-fast')).toBe('cursor')
    expect(includedPoolForModel('grok-4.6-medium')).toBe('cursor')
    expect(includedPoolForModel('cursor-default')).toBe('cursor')
    expect(includedPoolForModel('default')).toBe('cursor')
    expect(includedPoolForModel('composer-2.5')).toBe('cursor')
  })

  it('maps named API models to Other Models', () => {
    expect(includedPoolForModel('claude-opus-5-thinking-high')).toBe('other')
    expect(includedPoolForModel('gpt-5.6-sol-high')).toBe('other')
    expect(includedPoolForModel('gemini-3.8-flash-high')).toBe('other')
  })

  it('treats missing model ids as Other Models', () => {
    expect(includedPoolForModel(null)).toBe('other')
    expect(includedPoolForModel('')).toBe('other')
  })
})

describe('includedPoolForQuotaName', () => {
  it('matches dashboard quota labels', () => {
    expect(includedPoolForQuotaName('Cursor Models')).toBe('cursor')
    expect(includedPoolForQuotaName('Other Models')).toBe('other')
    expect(includedPoolForQuotaName('Spend')).toBe('other')
  })
})
