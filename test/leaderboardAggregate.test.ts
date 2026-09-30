import { describe, expect, it } from 'vitest'
import { aggregateLeaderboard, leaderboardDailyChart } from '../src/leaderboard/aggregate'
import type { LeaderboardRepoCommits } from '../src/leaderboard/types'

function commit(
  email: string,
  name: string,
  insertions: number,
  deletions: number,
  unix: number,
): LeaderboardRepoCommits['commits'][number] {
  return {
    hash: `${email}-${unix}`,
    timestampMs: unix * 1000,
    email,
    name,
    insertions,
    deletions,
  }
}

describe('aggregateLeaderboard', () => {
  it('sums across repos and lists only repos that author touched', () => {
    const groups: LeaderboardRepoCommits[] = [
      {
        path: '/work/alpha',
        label: 'alpha',
        commits: [commit('ada@example.com', 'Ada', 3, 1, 1_700_000_000)],
      },
      {
        path: '/work/beta',
        label: 'beta',
        commits: [
          commit('ada@example.com', 'Ada', 11, 9, 1_700_086_400),
          commit('bea@example.com', 'Bea', 100, 0, 1_700_086_400),
        ],
      },
      {
        path: '/work/gamma',
        label: 'gamma',
        commits: [commit('bea@example.com', 'Bea', 2, 0, 1_700_172_800)],
      },
    ]
    const rows = aggregateLeaderboard(groups, [
      'ada@example.com',
      'bea@example.com',
      'cy@example.com',
    ])
    expect(rows.map((row) => row.email)).toEqual([
      'bea@example.com',
      'ada@example.com',
      'cy@example.com',
    ])
    const ada = rows[1]
    expect(ada).toMatchObject({
      linesMerged: 14,
      linesDeleted: 10,
      netLines: 4,
      commits: 2,
      activeDays: 2,
    })
    expect(ada?.repositories).toEqual([
      { label: 'beta', path: '/work/beta', linesMerged: 11 },
      { label: 'alpha', path: '/work/alpha', linesMerged: 3 },
    ])
    expect(rows[2]).toMatchObject({
      linesMerged: 0,
      commits: 0,
      repositories: [],
    })
  })

  it('sums merged emails into one programmer and keeps every address', () => {
    const rows = aggregateLeaderboard(
      [
        {
          path: '/work/alpha',
          label: 'alpha',
          commits: [
            commit('ada@example.com', 'Ada', 10, 1, 1_700_000_000),
            commit('ada.work@example.com', 'Ada', 5, 2, 1_700_086_400),
          ],
        },
      ],
      ['ada@example.com', 'ada.work@example.com', 'bea@example.com'],
      [['ada.work@example.com', 'ada@example.com']],
    )
    expect(rows.map((row) => row.emails)).toEqual([
      ['ada.work@example.com', 'ada@example.com'],
      ['bea@example.com'],
    ])
    expect(rows[0]).toMatchObject({
      name: 'Ada',
      linesMerged: 15,
      linesDeleted: 3,
      commits: 2,
      activeDays: 2,
    })
  })

  it('does not credit a repo the person never committed to', () => {
    const rows = aggregateLeaderboard(
      [
        {
          path: '/work/only-bea',
          label: 'only-bea',
          commits: [commit('bea@example.com', 'Bea', 3, 0, 1_700_000_000)],
        },
      ],
      ['ada@example.com'],
    )
    expect(rows[0]?.repositories).toEqual([])
    expect(rows[0]?.linesMerged).toBe(0)
  })

  it('plots merged lines on every day of the selected range', () => {
    const noon = new Date(2026, 0, 2, 12).getTime() / 1000
    const chart = leaderboardDailyChart(
      [
        {
          path: '/work/alpha',
          label: 'alpha',
          commits: [
            commit('ada@example.com', 'Ada', 10, 0, noon),
            commit('bea@example.com', 'Bea', 4, 0, noon),
          ],
        },
      ],
      ['ada@example.com', 'bea@example.com'],
      [],
      '2026-01-01',
      '2026-01-03',
    )
    expect(chart.dates).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
    expect(chart.series.map((series) => series.lines)).toEqual([
      [0, 10, 0],
      [0, 4, 0],
    ])
  })
})
