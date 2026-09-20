import { describe, expect, it } from 'vitest'
import {
  bucketAiByDay,
  bucketEditedByDay,
  buildDaySeries,
  ratioLandedToAi,
  toCodeLinesSnapshot,
} from '../src/codeLines/aggregate'
import { localDayKey } from '../src/codeLines/gitMerged'
import type { ComposerLineTotals } from '../src/codeLines/types'
import { formatEffectiveness, formatLineCount } from '../src/codeLines/copy'

describe('ratioLandedToAi', () => {
  it('returns null when ai is 0 or unknown', () => {
    expect(ratioLandedToAi(10, 0)).toBeNull()
    expect(ratioLandedToAi(5, null)).toBeNull()
  })

  it('divides landed by ai', () => {
    expect(ratioLandedToAi(25, 50)).toBe(0.5)
  })
})

describe('toCodeLinesSnapshot', () => {
  const day = localDayKey(Date.UTC(2026, 8, 15, 12, 0, 0))
  const composers: ComposerLineTotals[] = [
    {
      composerId: 'c1',
      workspacePath: '/proj',
      linesAdded: 15_000,
      linesRemoved: 10,
      filesChanged: 2,
      lastUpdatedAt: Date.UTC(2026, 8, 15, 12, 0, 0),
      createdAt: Date.UTC(2026, 8, 15, 10, 0, 0),
    },
  ]

  it('uses independent git landed and pending volumes', () => {
    const snap = toCodeLinesSnapshot({
      source: 'headers',
      composers,
      mergedDays: [{ date: day, insertions: 6_200, deletions: 2 }],
      pendingInsertions: 4_625,
    })
    expect(snap.summary.ai).toBe(15_010)
    expect(snap.summary.added).toBe(15_000)
    expect(snap.summary.removed).toBe(10)
    expect(snap.summary.onMaster).toBe(6_200)
    expect(snap.summary.pending).toBe(4_625)
    expect(snap.summary.effectiveness).toBeCloseTo(6_200 / 15_010)
    expect(snap.summary.accountedRate).toBeCloseTo((6_200 + 4_625) / 15_010)
    expect(snap.summary.mergedAll).toBe(6_200)
    expect(snap.series[0]?.added).toBe(15_000)
    expect(snap.series[0]?.ai).toBe(15_010)
  })

  it('drops composers outside the sample window', () => {
    const snap = toCodeLinesSnapshot({
      source: 'headers',
      composers,
      mergedDays: [],
      pendingInsertions: 0,
      sinceMs: Date.UTC(2026, 9, 1),
      untilMs: Date.UTC(2026, 9, 19),
    })
    expect(snap.summary.ai).toBe(0)
    expect(snap.summary.effectiveness).toBeNull()
  })

  it('keeps git landed when AI is unknown', () => {
    const snap = toCodeLinesSnapshot({
      source: 'git-only',
      composers,
      mergedDays: [{ date: day, insertions: 40, deletions: 0 }],
      pendingInsertions: 5,
    })
    expect(snap.summary.ai).toBeNull()
    expect(snap.summary.onMaster).toBe(40)
    expect(snap.summary.pending).toBe(5)
    expect(snap.summary.effectiveness).toBeNull()
    expect(snap.summary.accountedRate).toBeNull()
  })
})

describe('bucketAiByDay', () => {
  it('sums multiple composers on the same day', () => {
    const ms = Date.UTC(2026, 0, 2, 8, 0, 0)
    const map = bucketAiByDay([
      {
        composerId: 'a',
        workspacePath: '/p',
        linesAdded: 10,
        linesRemoved: 0,
        filesChanged: 1,
        lastUpdatedAt: ms,
        createdAt: ms,
      },
      {
        composerId: 'b',
        workspacePath: '/p',
        linesAdded: 5,
        linesRemoved: 0,
        filesChanged: 1,
        lastUpdatedAt: ms,
        createdAt: ms,
      },
    ])
    expect(map.get(localDayKey(ms))).toBe(15)
  })
})

describe('bucketEditedByDay', () => {
  it('sums added and removed on the same day', () => {
    const ms = Date.UTC(2026, 0, 2, 8, 0, 0)
    const map = bucketEditedByDay([
      {
        composerId: 'a',
        workspacePath: '/p',
        linesAdded: 10,
        linesRemoved: 3,
        filesChanged: 1,
        lastUpdatedAt: ms,
        createdAt: ms,
      },
    ])
    expect(map.get(localDayKey(ms))).toBe(13)
  })
})

describe('buildDaySeries', () => {
  it('uses that day’s git landed, not a global rate', () => {
    const series = buildDaySeries(
      new Map([
        ['2026-09-01', 10],
        ['2026-09-02', 20],
      ]),
      new Map([['2026-09-02', 5]]),
    )
    expect(series).toHaveLength(2)
    expect(series[0]?.onMaster).toBe(0)
    expect(series[1]?.onMaster).toBe(5)
    expect(series[1]?.effectiveness).toBeCloseTo(5 / 20)
  })
})

describe('copy helpers', () => {
  it('formats counts and merge percent', () => {
    expect(formatLineCount(null)).toBe('—')
    expect(formatLineCount(1200)).toMatch(/1/)
    expect(formatEffectiveness(0.5)).toBe('50% merged')
  })
})
