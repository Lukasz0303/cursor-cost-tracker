import { describe, expect, it } from 'vitest'
import {
  parseFirstParentMerges,
  parseLeaderboardAuthors,
  parseLeaderboardLog,
  parseRangeAuthors,
} from '../src/leaderboard/parse'

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

describe('parseFirstParentMerges', () => {
  it('keeps the default-branch parent and the branch that landed', () => {
    const merges = parseFirstParentMerges(
      [
        'abc1234\t1700000000\tnot-a-hash',
        'fff9999\t1700086400\t1111111111111111111111111111111111111111 2222222222222222222222222222222222222222',
        'not-a-merge',
      ].join('\n'),
    )
    expect(merges).toEqual([
      {
        hash: 'fff9999',
        timestampMs: 1700086400 * 1000,
        firstParent: '1111111111111111111111111111111111111111',
        secondParent: '2222222222222222222222222222222222222222',
      },
    ])
  })
})

describe('parseRangeAuthors', () => {
  it('keeps the first name for one email', () => {
    const authors = parseRangeAuthors('ada@example.com\tAda\nada@example.com\tAda Lovelace\n')
    expect(authors).toEqual([{ email: 'ada@example.com', name: 'Ada' }])
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
