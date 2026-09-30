import { describe, expect, it } from 'vitest'
import { parseLeaderboardAuthors, parseLeaderboardLog } from '../src/leaderboard/parse'

const LOG = [
  'aaa1111\t1700000000\tAda@Example.com\tAda',
  '10\t2\tsrc/a.ts',
  '-\t-\tbin.dat',
  '3\t0\tsrc/b.ts',
  '',
  'bbb2222\t1700086400\tbea@example.com\tBea',
  '1\t4\tREADME.md',
].join('\n')

describe('parseLeaderboardLog', () => {
  it('sums text lines and skips binary numstat', () => {
    const commits = parseLeaderboardLog(LOG)
    expect(commits).toHaveLength(2)
    expect(commits[0]).toMatchObject({
      email: 'Ada@Example.com',
      name: 'Ada',
      insertions: 13,
      deletions: 2,
    })
    expect(commits[1]).toMatchObject({
      insertions: 1,
      deletions: 4,
    })
  })

  it('keeps a commit that only touches binary files', () => {
    const commits = parseLeaderboardLog('ccc3333\t1700000000\tada@example.com\tAda\n-\t-\tlogo.png')
    expect(commits).toEqual([
      expect.objectContaining({ insertions: 0, deletions: 0, email: 'ada@example.com' }),
    ])
  })
})

describe('parseLeaderboardAuthors', () => {
  it('dedupes by email and sorts', () => {
    const authors = parseLeaderboardAuthors(LOG)
    expect(authors.map((row) => row.email)).toEqual([
      'Ada@Example.com',
      'bea@example.com',
    ])
  })
})
