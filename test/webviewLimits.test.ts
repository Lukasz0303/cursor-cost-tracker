import { describe, expect, it } from 'vitest'
import { clampHistoryLimit } from '../src/historyLimit'
import { parseHistoryFromDate } from '../src/historyFromDate'
import {
  clampBurnUsd,
  clampHistoryLimit as clampHistoryLimitInput,
  formatFromDateLabel,
  parseFromDate,
} from '../src/webview/limits'

describe('webview limits', () => {
  it('clamps history the same way as the host', () => {
    expect(clampHistoryLimitInput('2000')).toBe(clampHistoryLimit(2000))
    expect(clampHistoryLimitInput('2')).toBe(clampHistoryLimit(2))
    expect(clampHistoryLimitInput('nope')).toBe(clampHistoryLimit(Number.NaN))
  })

  it('rounds burn dollars and falls back when the value is empty', () => {
    expect(clampBurnUsd('1.239', 2)).toBe(1.24)
    expect(clampBurnUsd('nope', 2)).toBe(2)
  })

  it('parses calendar days the same way as the host, with an empty string', () => {
    expect(parseFromDate('2026-02-31')).toBe('')
    expect(parseFromDate('2026-02-31')).toBe(parseHistoryFromDate('2026-02-31') ?? '')
    expect(parseFromDate('2026-09-01')).toBe('2026-09-01')
    expect(formatFromDateLabel('2026-09-01')).toBe('1.09.2026')
    expect(formatFromDateLabel(12)).toBe('')
  })
})
