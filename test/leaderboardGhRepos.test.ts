import { describe, expect, it } from 'vitest'
import {
  listGhRepoSlugs,
  matchLocalReposToGh,
  parseGhCommitSearch,
  repoSlugFromRemote,
  selectScanRoots,
} from '../src/leaderboard/ghRepos'

describe('repoSlugFromRemote', () => {
  it('reads ssh and https GitHub remotes', () => {
    expect(repoSlugFromRemote('git@github.com:Lukasz0303/cursor-cost-tracker.git')).toBe(
      'lukasz0303/cursor-cost-tracker',
    )
    expect(repoSlugFromRemote('https://github.com/Lukasz0303/tbs')).toBe('lukasz0303/tbs')
    expect(repoSlugFromRemote('git@github.company.com:org/app.git')).toBe('org/app')
    expect(repoSlugFromRemote('not-a-remote')).toBeNull()
  })
})

describe('parseGhCommitSearch', () => {
  it('keeps unique owner/name slugs', () => {
    expect(
      parseGhCommitSearch(
        JSON.stringify([
          { repository: { nameWithOwner: 'Lukasz0303/cursor-cost-tracker' } },
          { repository: { nameWithOwner: 'Lukasz0303/cursor-cost-tracker' } },
          { repository: { fullName: 'Lukasz0303/tbs' } },
        ]),
      ),
    ).toEqual(['lukasz0303/cursor-cost-tracker', 'lukasz0303/tbs'])
  })
})

describe('selectScanRoots', () => {
  it('keeps every local repo when gh only named some of them', () => {
    expect(selectScanRoots(['/a', '/b', '/c'], ['o/a'], ['/a'])).toEqual(['/a', '/b', '/c'])
  })

  it('falls back to folders when gh is missing or nothing matches', () => {
    expect(selectScanRoots(['/a', '/b'], null, [])).toEqual(['/a', '/b'])
    expect(selectScanRoots(['/a', '/b'], [], [])).toEqual(['/a', '/b'])
    expect(selectScanRoots(['/a', '/b'], ['o/missing'], [])).toEqual(['/a', '/b'])
  })
})

describe('listGhRepoSlugs', () => {
  it('returns null when gh fails so the caller scans folders', async () => {
    const slugs = await listGhRepoSlugs('2026-01-01', '2026-09-24', [], async () => {
      throw new Error('spawn gh ENOENT')
    })
    expect(slugs).toBeNull()
  })

  it('asks gh for the signed-in user when no emails are selected', async () => {
    const queries: string[][] = []
    const slugs = await listGhRepoSlugs('2026-08-24', '2026-09-24', [], async (args) => {
      queries.push(args)
      return {
        stdout: JSON.stringify([{ repository: { nameWithOwner: 'me/gear-calculator' } }]),
        stderr: '',
      }
    })
    expect(slugs).toEqual(['me/gear-calculator'])
    expect(queries[0]?.join(' ')).toContain('author:@me')
    expect(queries[0]?.join(' ')).toContain('committer-date:2026-08-24..2026-09-24')
  })
})

describe('matchLocalReposToGh', () => {
  it('keeps local clones whose origin is on the GitHub list', async () => {
    const matched = await matchLocalReposToGh(
      ['/work/cursor-cost', '/work/notes'],
      ['me/cursor-cost-tracker'],
      async (args, cwd) => {
        if (cwd === '/work/notes') {
          throw new Error('no origin')
        }
        expect(args).toEqual(['remote', 'get-url', 'origin'])
        return { stdout: 'git@github.com:me/cursor-cost-tracker.git\n', stderr: '' }
      },
    )
    expect(matched).toEqual(['/work/cursor-cost'])
  })
})
