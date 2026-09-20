import { describe, expect, it } from 'vitest'
import { toCodeLinesSnapshot } from '../src/codeLines/aggregate'
import {
  allocateByWeight,
  applyRepoSplit,
  weightsByRepo,
} from '../src/codeLines/repoSplit'
import type { ComposerLineTotals } from '../src/codeLines/types'

describe('allocateByWeight', () => {
  it('sums exactly to the dashboard total', () => {
    const parts = allocateByWeight(100, [
      { id: '/a', label: 'a', weight: 1 },
      { id: '/b', label: 'b', weight: 2 },
    ])
    expect(parts.reduce((sum, row) => sum + row.edited, 0)).toBe(100)
    expect(parts.find((row) => row.id === '/b')?.edited).toBe(67)
    expect(parts.find((row) => row.id === '/a')?.edited).toBe(33)
  })
})

describe('applyRepoSplit', () => {
  const composers: ComposerLineTotals[] = [
    {
      composerId: '1',
      workspacePath: '/work/cursor-cost-tracker',
      linesAdded: 10,
      linesRemoved: 0,
      filesChanged: 1,
      lastUpdatedAt: Date.UTC(2026, 8, 10),
      createdAt: Date.UTC(2026, 8, 10),
    },
    {
      composerId: '2',
      workspacePath: '/work/other-app',
      linesAdded: 30,
      linesRemoved: 0,
      filesChanged: 1,
      lastUpdatedAt: Date.UTC(2026, 8, 10),
      createdAt: Date.UTC(2026, 8, 10),
    },
  ]

  it('puts current repo on top and keeps all-projects = dashboard sum', () => {
    const snap = toCodeLinesSnapshot({
      source: 'headers',
      composers,
      mergedDays: [],
      pendingInsertions: 0,
    })
    const next = applyRepoSplit({
      snapshot: snap,
      composers,
      dashboardDays: [
        { date: '2026-09-01', edited: 16_550 },
        { date: '2026-09-06', edited: 19_788 },
      ],
      activeWorkspacePath: '/work/cursor-cost-tracker',
      otherLabel: 'Other projects',
    })
    expect(next.summary.allEdited).toBe(36_338)
    expect(next.summary.dashboard).toBe(true)
    expect(next.repos.reduce((sum, row) => sum + row.edited, 0)).toBe(36_338)
    const current = next.repos.find((row) => row.current)
    expect(current?.label).toBe('cursor-cost-tracker')
    expect(next.summary.ai).toBe(current?.edited)
    expect(current?.edited).toBeGreaterThan(8000)
    expect(current?.edited).toBeLessThan(12_000)
    expect(next.summary.currentLabel).toBe('cursor-cost-tracker')
  })
})

describe('weightsByRepo', () => {
  it('groups by workspace folder name, including extra clones', () => {
    const weights = weightsByRepo(
      [
        {
          composerId: '1',
          workspacePath: '/a/one',
          linesAdded: 4,
          linesRemoved: 1,
          filesChanged: 1,
          lastUpdatedAt: 1,
          createdAt: 1,
        },
        {
          composerId: '2',
          workspacePath: '/tasks/ticket-9/one',
          linesAdded: 10,
          linesRemoved: 0,
          filesChanged: 1,
          lastUpdatedAt: 1,
          createdAt: 1,
        },
      ],
      'Other',
    )
    expect(weights).toEqual([{ id: 'one', label: 'one', weight: 15 }])
  })
})

describe('applyRepoSplit clones', () => {
  it('treats extra checkouts of the current repo as the same project', () => {
    const composers: ComposerLineTotals[] = [
      {
        composerId: '1',
        workspacePath: '/work/pc-playercenter-monorepo',
        linesAdded: 16_013,
        linesRemoved: 0,
        filesChanged: 1,
        lastUpdatedAt: Date.UTC(2026, 8, 10),
        createdAt: Date.UTC(2026, 8, 10),
      },
      {
        composerId: '2',
        workspacePath: '/work/tasks/pc-playercenter-monorepo',
        linesAdded: 8_309,
        linesRemoved: 0,
        filesChanged: 1,
        lastUpdatedAt: Date.UTC(2026, 8, 10),
        createdAt: Date.UTC(2026, 8, 10),
      },
      {
        composerId: '3',
        workspacePath: '/work/pc-toolsets',
        linesAdded: 10_245,
        linesRemoved: 0,
        filesChanged: 1,
        lastUpdatedAt: Date.UTC(2026, 8, 10),
        createdAt: Date.UTC(2026, 8, 10),
      },
    ]
    const snap = toCodeLinesSnapshot({
      source: 'headers',
      composers,
      mergedDays: [{ date: '2026-09-10', insertions: 22_376, deletions: 0 }],
      pendingInsertions: 0,
    })
    const next = applyRepoSplit({
      snapshot: snap,
      composers,
      dashboardDays: [],
      activeWorkspacePath: '/work/tasks/pc-playercenter-monorepo',
      otherLabel: 'Other projects',
    })
    const mono = next.repos.filter(
      (row) => row.label === 'pc-playercenter-monorepo',
    )
    expect(mono).toHaveLength(1)
    expect(mono[0]?.current).toBe(true)
    expect(mono[0]?.edited).toBe(16_013 + 8_309)
    expect(next.summary.ai).toBe(16_013 + 8_309)
    expect(next.summary.onMaster).toBe(22_376)
    expect(next.summary.effectiveness).toBeCloseTo(22_376 / (16_013 + 8_309))
  })

  it('replays the work-machine screenshot: dashboard split, extra clones, mixed paths', () => {
    const ts = Date.UTC(2026, 8, 10)
    function row(
      id: string,
      path: string,
      lines: number,
    ): ComposerLineTotals {
      return {
        composerId: id,
        workspacePath: path,
        linesAdded: lines,
        linesRemoved: 0,
        filesChanged: 1,
        lastUpdatedAt: ts,
        createdAt: ts,
      }
    }
    const composers = [
      row('a', 'C:\\work\\pc-playercenter-monorepo', 16_013),
      row('b', '/Users/me/pc-toolsets', 10_245),
      row('c', 'file:///Users/me/tasks/PC-9/pc-playercenter-monorepo/', 8_309),
      row('d', '/Users/me/rhino-rage', 3_071),
      row('e', '/Users/me/case-player-center-adapter-reward', 1_855),
      row('f', '/Users/me/case-player-center-adapter', 895),
      row('g', '/Users/me/pc-cli', 55),
      row('h', '/Users/me/old-checkouts/RHINO-RAGE', 47),
    ]
    const snap = toCodeLinesSnapshot({
      source: 'headers',
      composers,
      mergedDays: [{ date: '2026-09-10', insertions: 22_376, deletions: 0 }],
      pendingInsertions: 0,
    })
    const next = applyRepoSplit({
      snapshot: snap,
      composers,
      dashboardDays: [{ date: '2026-09-10', edited: 40_490 }],
      activeWorkspacePath: 'C:\\work\\pc-playercenter-monorepo',
      otherLabel: 'Other projects',
    })
    const labels = next.repos.map((repo) => repo.label)
    expect(labels.filter((name) => name === 'pc-playercenter-monorepo')).toHaveLength(1)
    expect(labels.filter((name) => name.toLowerCase() === 'rhino-rage')).toHaveLength(1)
    expect(next.repos).toHaveLength(6)
    expect(next.summary.allEdited).toBe(40_490)
    expect(next.summary.ai).toBe(16_013 + 8_309)
    expect(next.summary.effectiveness).toBeCloseTo(22_376 / (16_013 + 8_309))
    expect(Math.round((next.summary.effectiveness ?? 0) * 100)).toBe(92)
  })
})
