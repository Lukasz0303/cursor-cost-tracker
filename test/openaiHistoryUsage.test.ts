import { describe, expect, it } from 'vitest'
import {
  applyUsageRules,
  billableTotal,
  normalizeUsage,
  readTokenCount,
} from '../src/openaiHistory/usage'

describe('readTokenCount', () => {
  it('accepts finite non-negative integers', () => {
    expect(readTokenCount(0)).toBe(0)
    expect(readTokenCount(100000)).toBe(100000)
  })

  it('rejects non-integers and non-finite values', () => {
    expect(readTokenCount(-1)).toBeNull()
    expect(readTokenCount(1.5)).toBeNull()
    expect(readTokenCount(Number.NaN)).toBeNull()
    expect(readTokenCount(Number.POSITIVE_INFINITY)).toBeNull()
    expect(readTokenCount('10')).toBeNull()
  })
})

describe('normalizeUsage + billableTotal', () => {
  it('fixture counts yield T=110000 without anomaly', () => {
    const usage = normalizeUsage({
      input_tokens: 100000,
      cached_input_tokens: 80000,
      output_tokens: 10000,
      reasoning_output_tokens: 2000,
      total_tokens: 110000,
    })
    expect(usage.anomaly).toBe(false)
    expect(billableTotal(usage)).toBe(110000)
  })

  it('keeps null cached_input_tokens as null', () => {
    const usage = normalizeUsage({
      input_tokens: 10,
      output_tokens: 2,
      total_tokens: 12,
    })
    expect(usage.cachedInputTokens).toBeNull()
  })

  it('keeps cached_input_tokens 0 as zero', () => {
    const usage = normalizeUsage({
      input_tokens: 10,
      cached_input_tokens: 0,
      output_tokens: 2,
      total_tokens: 12,
    })
    expect(usage.cachedInputTokens).toBe(0)
  })

  it('sets anomaly when C > I and keeps both numbers', () => {
    const usage = normalizeUsage({
      input_tokens: 10,
      cached_input_tokens: 20,
      output_tokens: 2,
      total_tokens: 12,
    })
    expect(usage.anomaly).toBe(true)
    expect(usage.inputTokens).toBe(10)
    expect(usage.cachedInputTokens).toBe(20)
  })

  it('sets anomaly when total_tokens disagrees with I + O', () => {
    const usage = normalizeUsage({
      input_tokens: 10,
      output_tokens: 2,
      total_tokens: 99,
    })
    expect(usage.anomaly).toBe(true)
    expect(usage.totalTokens).toBe(99)
    expect(billableTotal(usage)).toBe(12)
  })

  it('stores non-zero cache_write and excludes it from T', () => {
    const usage = normalizeUsage({
      input_tokens: 100,
      cached_input_tokens: 10,
      cache_write_input_tokens: 7,
      output_tokens: 5,
      total_tokens: 105,
    })
    expect(usage.cacheWriteInputTokens).toBe(7)
    expect(billableTotal(usage)).toBe(105)
  })

  it('ignores sibling keys when only usage is passed', () => {
    const usage = normalizeUsage({
      input_tokens: 1,
      output_tokens: 1,
      total_tokens: 2,
      turn_token_usage: { input_tokens: 999 },
      thread_token_usage: { output_tokens: 999 },
    })
    expect(usage.inputTokens).toBe(1)
    expect(usage.outputTokens).toBe(1)
  })
})

describe('applyUsageRules', () => {
  it('sets anomaly when R > O', () => {
    const usage = applyUsageRules({
      inputTokens: 1,
      cachedInputTokens: null,
      cacheWriteInputTokens: null,
      outputTokens: 2,
      reasoningOutputTokens: 5,
      totalTokens: 3,
      anomaly: false,
    })
    expect(usage.anomaly).toBe(true)
    expect(usage.reasoningOutputTokens).toBe(5)
  })
})
