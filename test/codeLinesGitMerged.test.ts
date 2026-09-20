import { describe, expect, it } from 'vitest'
import { localDayKey, parseGitNumstatLog } from '../src/codeLines/gitMerged'

describe('parseGitNumstatLog', () => {
  it('aggregates insertions by local day', () => {
    // 2026-09-01 12:00 UTC ≈ depends on TZ; use fixed ms via known unix
    const ts = Math.floor(Date.UTC(2026, 8, 1, 15, 0, 0) / 1000)
    const raw = [
      String(ts),
      '10\t2\tsrc/a.ts',
      '5\t0\tsrc/b.ts',
      '',
      String(ts + 86400),
      '3\t1\tsrc/c.ts',
      '-\t-\tbin/blob',
    ].join('\n')
    const days = parseGitNumstatLog(raw)
    expect(days).toHaveLength(2)
    expect(days[0]?.insertions).toBe(15)
    expect(days[0]?.deletions).toBe(2)
    expect(days[1]?.insertions).toBe(3)
    expect(days[0]?.date).toBe(localDayKey(ts * 1000))
  })

  it('skips malformed lines', () => {
    expect(parseGitNumstatLog('not-a-ts\n1\t2\tfile.ts')).toEqual([])
  })
})
