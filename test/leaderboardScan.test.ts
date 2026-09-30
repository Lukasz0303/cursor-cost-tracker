import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeFsPath } from '../src/codeLines/nestedRepos'
import {
  leaderboardRoots,
  listCatalogGitRepos,
  listNearbyGitRepos,
  listSiblingGitRepos,
  previewLeaderboardRepos,
  scanLeaderboardRepos,
} from '../src/leaderboard/scan'
import { appendSavedRepos, parseLeaderboardSources, setRepoIncluded, withExtraPath } from '../src/leaderboard/sources'

describe('listSiblingGitRepos', () => {
  it('returns sibling git checkouts and skips the open repo and node_modules', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'cct-lb-sib-'))
    const here = join(parent, 'cursor-cost')
    const other = join(parent, 'gear-calculator')
    const third = join(parent, 'tbs')
    await mkdir(join(here, '.git'), { recursive: true })
    await mkdir(join(other, '.git'), { recursive: true })
    await mkdir(join(third, '.git'), { recursive: true })
    await mkdir(join(parent, 'node_modules', 'lib', '.git'), { recursive: true })
    await mkdir(join(parent, 'notes'), { recursive: true })

    const found = (await listSiblingGitRepos(here)).map(normalizeFsPath).sort()
    expect(found).toEqual([other, third].map(normalizeFsPath).sort())
  })
})

describe('listNearbyGitRepos', () => {
  it('includes cousin git repos in sibling team folders', async () => {
    const grand = await mkdtemp(join(tmpdir(), 'cct-lb-near-'))
    const here = join(grand, 'team-a', 'cursor-cost')
    const cousin = join(grand, 'team-b', 'gear')
    await mkdir(join(here, '.git'), { recursive: true })
    await mkdir(join(cousin, '.git'), { recursive: true })
    await mkdir(join(grand, 'team-a', 'node_modules', 'lib', '.git'), { recursive: true })

    const found = (await listNearbyGitRepos(here)).map(normalizeFsPath).sort()
    expect(found).toEqual([cousin].map(normalizeFsPath))
  })
})

describe('leaderboardRoots', () => {
  it('includes the open repo and sibling git repos when there is no nested stack', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'cct-lb-roots-'))
    const here = join(parent, 'cursor-cost')
    const other = join(parent, 'gear-calculator')
    await mkdir(join(here, '.git'), { recursive: true })
    await mkdir(join(other, '.git'), { recursive: true })

    const roots = await leaderboardRoots(
      here,
      async () => [],
      async () => {
        throw new Error('git should not run')
      },
      listSiblingGitRepos,
    )
    expect(roots.map(normalizeFsPath).sort()).toEqual(
      [here, other].map(normalizeFsPath).sort(),
    )
  })
})

describe('appendSavedRepos', () => {
  it('grows the list and skips a repository with the same name', () => {
    const first = appendSavedRepos(parseLeaderboardSources({}), ['/work/gear', '/work/api'])
    const second = appendSavedRepos(first.sources, ['/other/gear', '/other/web'])
    expect(first.added).toBe(2)
    expect(second.added).toBe(1)
    expect(second.skipped).toBe(1)
    expect(second.sources.saved).toEqual(['/work/gear', '/work/api', '/other/web'])
  })
})

describe('listCatalogGitRepos', () => {
  it('lists the chosen folder, its git children, and one level of cousins', async () => {
    const catalog = await mkdtemp(join(tmpdir(), 'cct-lb-cat-'))
    const direct = join(catalog, 'gear')
    const cousin = join(catalog, 'teams', 'api')
    await mkdir(join(catalog, '.git'), { recursive: true })
    await mkdir(join(direct, '.git'), { recursive: true })
    await mkdir(join(cousin, '.git'), { recursive: true })
    await mkdir(join(catalog, 'node_modules', 'lib', '.git'), { recursive: true })

    const found = (await listCatalogGitRepos(catalog)).map(normalizeFsPath).sort()
    expect(found).toEqual([catalog, direct, cousin].map(normalizeFsPath).sort())
  })
})

describe('scanLeaderboardRepos', () => {
  it('reads every local and remote branch in each included repo', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'cct-lb-log-'))
    await mkdir(join(repo, '.git'), { recursive: true })
    const calls: string[][] = []
    const piece = await scanLeaderboardRepos(repo, '2026-01-01', '2026-01-31', {
      sources: { catalog: '', saved: [repo], extra: [], excluded: [] },
      execGh: async () => {
        throw new Error('gh unused')
      },
      execGit: async (args) => {
        calls.push(args)
        if (args[0] === 'log') {
          return {
            stdout: [
              'aaa1111\t1767225600\tada@example.com\tAda',
              '10\t2\tsrc/a.ts',
              'bbb2222\t1767312000\tada@example.com\tAda',
              '3\t0\tsrc/b.ts',
            ].join('\n'),
            stderr: '',
          }
        }
        return { stdout: '', stderr: '' }
      },
    })
    const log = calls.find((args) => args[0] === 'log')
    expect(log).toEqual(
      expect.arrayContaining(['--branches', '--remotes', '--no-merges', '--numstat']),
    )
    expect(log?.some((arg) => arg === 'main' || arg.startsWith('origin/'))).toBe(false)
    expect(piece.reposScanned).toBe(1)
    expect(piece.groups[0]?.commits).toHaveLength(2)
  })
})

describe('previewLeaderboardRepos', () => {
  it('uses the catalog when it exists and keeps hand-added git repos', async () => {
    const catalog = await mkdtemp(join(tmpdir(), 'cct-lb-prev-'))
    const inside = join(catalog, 'gear')
    const extra = await mkdtemp(join(tmpdir(), 'cct-lb-extra-'))
    await mkdir(join(inside, '.git'), { recursive: true })
    await mkdir(join(extra, '.git'), { recursive: true })
    const sources = withExtraPath(parseLeaderboardSources({ catalog, extra: [] }), extra)

    const preview = await previewLeaderboardRepos('/unused', sources, {
      listSiblings: async () => {
        throw new Error('siblings should not run')
      },
    })
    expect(preview.catalogMissing).toBe(false)
    expect(preview.repos.map((repo) => normalizeFsPath(repo.path)).sort()).toEqual(
      [inside, extra].map(normalizeFsPath).sort(),
    )
    expect(preview.repos.find((repo) => normalizeFsPath(repo.path) === normalizeFsPath(extra))?.source).toBe(
      'extra',
    )
  })

  it('leaves an excluded path on the list but out of the scan', async () => {
    const catalog = await mkdtemp(join(tmpdir(), 'cct-lb-off-'))
    const keep = join(catalog, 'keep')
    const drop = join(catalog, 'drop')
    await mkdir(join(keep, '.git'), { recursive: true })
    await mkdir(join(drop, '.git'), { recursive: true })
    const sources = setRepoIncluded(parseLeaderboardSources({ catalog, extra: [] }), drop, false)

    const preview = await previewLeaderboardRepos(null, sources, {
      listSiblings: async () => [],
    })
    const off = preview.repos.find((repo) => normalizeFsPath(repo.path) === normalizeFsPath(drop))
    const on = preview.repos.find((repo) => normalizeFsPath(repo.path) === normalizeFsPath(keep))
    expect(off?.included).toBe(false)
    expect(on?.included).toBe(true)
  })
})
