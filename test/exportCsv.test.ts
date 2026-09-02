import { describe, expect, it } from 'vitest'
import { buildQueriesCsv } from '../src/ui/exportCsv'
import type { UsageQuery } from '../src/usage/types'

describe('buildQueriesCsv', () => {
  it('exports newest-first rows with a header', () => {
    const queries: UsageQuery[] = [
      {
        timestamp: 1,
        model: 'cursor-default',
        kind: 'USAGE_EVENT_KIND_INCLUDED_IN_BUSINESS',
        costUsd: 0.03,
        tokens: 100,
        inputTokens: 80,
        outputTokens: 20,
      },
      {
        timestamp: 2,
        model: 'gpt-5',
        kind: null,
        costUsd: 1.5,
        tokens: 2000,
        inputTokens: 1500,
        outputTokens: 500,
      },
    ]
    const csv = buildQueriesCsv(queries)
    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'TIME,MODEL,COST_USD,TOKENS,INPUT_TOKENS,OUTPUT_TOKENS,KIND',
    )
    expect(lines[1]).toContain('gpt-5')
    expect(lines[2]).toContain('default')
  })
})
