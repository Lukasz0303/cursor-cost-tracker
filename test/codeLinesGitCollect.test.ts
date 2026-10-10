import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectMergedLineDays } from '../src/codeLines/runGitMerged'
import { daysForAuthorEmails } from '../src/codeLines/landedCommits'
import type { ParsedLeaderboardCommit } from '../src/leaderboard/types'

function mockRepo(authorsStdout: string, commitsByAuthor: Record<string, number>) {
  const logArgs: string[][] = []
  const execGit = async (args: string[]) => {
    if (args[0] === 'branch') {
      return { stdout: 'main\n', stderr: '' }
    }
    if (args[0] === 'symbolic-ref') {
      return { stdout: 'origin/main\n', stderr: '' }
    }
    if (args[0] === 'config' && args[1] === 'user.email') {
      return { stdout: 'jane@acme.com\n', stderr: '' }
    }
    if (args[0] === 'config' && args[1] === 'user.name') {
      return { stdout: 'Jane\n', stderr: '' }
    }
    if (args[0] === 'rev-parse') {
      return { stdout: 'abc\n', stderr: '' }
    }
    if (args[0] === 'diff') {
      return { stdout: '', stderr: '' }
    }
    if (args[0] === 'log') {
      logArgs.push(args)
      if (args.includes('--format=%an%x09%ae')) {
        return { stdout: authorsStdout, stderr: '' }
      }
      if (args.includes('--pretty=tformat:')) {
        return { stdout: '', stderr: '' }
      }
      if (args.includes('--merges')) {
        return { stdout: '', stderr: '' }
      }
      if (args.includes('--format=%H%x09%ct%x09%ae%x09%an')) {
        const ts = Math.floor(Date.UTC(2026, 8, 10, 12, 0, 0) / 1000)
        const lines: string[] = []
        let hash = 1
        for (const [email, insertions] of Object.entries(commitsByAuthor)) {
          const name = email.split('@')[0] ?? email
          lines.push(`${'a'.repeat(7)}${hash}\t${ts}\t${email}\t${name}`)
          lines.push(`${insertions}\t0\tsrc/a.ts`)
          hash += 1
        }
        return { stdout: `${lines.join('\n')}\n`, stderr: '' }
      }
      return { stdout: '', stderr: '' }
    }
    return { stdout: '', stderr: '' }
  }
  return { logArgs, execGit }
}

describe('daysForAuthorEmails', () => {
  it('keeps only selected emails', () => {
    const commits: ParsedLeaderboardCommit[] = [
      {
        hash: 'aaaaaaa',
        timestampMs: Date.UTC(2026, 8, 10),
        email: 'jane@acme.com',
        name: 'Jane',
        insertions: 40,
        deletions: 1,
      },
      {
        hash: 'bbbbbbb',
        timestampMs: Date.UTC(2026, 8, 10),
        email: 'bob@acme.com',
        name: 'Bob',
        insertions: 9,
        deletions: 0,
      },
    ]
    expect(daysForAuthorEmails(commits, ['jane@acme.com'])).toEqual([
      {
        date: expect.any(String),
        insertions: 40,
        deletions: 1,
      },
    ])
  })
})

describe('collectMergedLineDays', () => {
  it('fetches origin before counting and still counts when fetch fails', async () => {
    const calls: string[][] = []
    const { execGit: repoGit } = mockRepo('Jane\tjane@acme.com', {
      'jane@acme.com': 4,
    })
    const result = await collectMergedLineDays({
      cwd: '/tmp/acme',
      sinceMs: Date.UTC(2026, 8, 1),
      untilMs: Date.UTC(2026, 8, 19),
      cursorEmail: 'jane@acme.com',
      async execGit(args, cwd) {
        calls.push(args)
        if (args[0] === 'fetch') {
          throw new Error('offline')
        }
        return repoGit(args, cwd)
      },
    })
    const fetchAt = calls.findIndex((args) => args[0] === 'fetch')
    const landedAt = calls.findIndex(
      (args) =>
        args[0] === 'log' &&
        args.includes('--first-parent') &&
        args.includes('--format=%H%x09%ct%x09%ae%x09%an'),
    )
    expect(calls[fetchAt]).toEqual([
      'fetch',
      '--no-tags',
      '--quiet',
      'origin',
      'refs/heads/main:refs/remotes/origin/main',
    ])
    expect(fetchAt).toBeGreaterThanOrEqual(0)
    expect(landedAt).toBeGreaterThan(fetchAt)
    expect(result.days[0]?.insertions).toBe(4)
  })

  it('fetches the remote default when that branch is master', async () => {
    const calls: string[][] = []
    await collectMergedLineDays({
      cwd: '/tmp/acme',
      sinceMs: Date.UTC(2026, 8, 1),
      untilMs: Date.UTC(2026, 8, 19),
      cursorEmail: 'jane@acme.com',
      async execGit(args) {
        calls.push(args)
        if (args[0] === 'branch') {
          return { stdout: 'main\nmaster\n', stderr: '' }
        }
        if (args[0] === 'symbolic-ref') {
          return { stdout: 'origin/master\n', stderr: '' }
        }
        if (args[0] === 'config') {
          return { stdout: 'jane@acme.com\n', stderr: '' }
        }
        if (args[0] === 'rev-parse') {
          return { stdout: 'abc\n', stderr: '' }
        }
        if (args[0] === 'log' && args.includes('--merges')) {
          return { stdout: '', stderr: '' }
        }
        if (args[0] === 'log' && args.includes('--format=%an%x09%ae')) {
          return { stdout: 'Jane\tjane@acme.com\n', stderr: '' }
        }
        if (args[0] === 'log' && args.includes('--format=%H%x09%ct%x09%ae%x09%an')) {
          return { stdout: '', stderr: '' }
        }
        return { stdout: '', stderr: '' }
      },
    })
    const fetch = calls.find((args) => args[0] === 'fetch')
    const landed = calls.find(
      (args) =>
        args[0] === 'log' &&
        args.includes('--format=%H%x09%ct%x09%ae%x09%an'),
    )
    expect(fetch).toEqual([
      'fetch',
      '--no-tags',
      '--quiet',
      'origin',
      'refs/heads/master:refs/remotes/origin/master',
    ])
    expect(landed?.[landed.length - 1]).toBe('origin/master')
  })

  it('defaults to the Cursor email and does not count teammates', async () => {
    const { logArgs, execGit } = mockRepo(
      [
        'Jane\tjane@acme.com',
        'Bob\tbob@acme.com',
        'Acme Bot\tbot@acme.com',
      ].join('\n'),
      {
        'jane@acme.com': 4,
        'bob@acme.com': 90,
      },
    )
    const result = await collectMergedLineDays({
      cwd: '/tmp/acme',
      sinceMs: Date.UTC(2026, 8, 1),
      untilMs: Date.UTC(2026, 8, 19),
      cursorEmail: 'jane@acme.com',
      execGit,
    })
    expect(result.authorFiltered).toBe(true)
    expect(result.days[0]?.insertions).toBe(4)
    expect(
      result.authors.accounts.filter((row) => row.selected).map((row) => row.email),
    ).toEqual(['jane@acme.com'])
    const directLog = logArgs.find(
      (args) =>
        args.includes('--no-merges') &&
        args.includes('--format=%H%x09%ct%x09%ae%x09%an'),
    )
    expect(directLog).toContain('--first-parent')
    expect(directLog?.some((arg) => arg.startsWith('--author='))).toBe(false)
  })

  it('does not credit a merged PR to the person who clicked Merge', async () => {
    const ts = Math.floor(Date.UTC(2026, 8, 12, 12, 0, 0) / 1000)
    const result = await collectMergedLineDays({
      cwd: '/tmp/acme',
      sinceMs: Date.UTC(2026, 8, 1),
      untilMs: Date.UTC(2026, 8, 19),
      cursorEmail: 'jane@acme.com',
      async execGit(args) {
        if (args[0] === 'branch') {
          return { stdout: 'main\n', stderr: '' }
        }
        if (args[0] === 'symbolic-ref') {
          return { stdout: 'origin/main\n', stderr: '' }
        }
        if (args[0] === 'config' && args[1] === 'user.email') {
          return { stdout: 'jane@acme.com\n', stderr: '' }
        }
        if (args[0] === 'config' && args[1] === 'user.name') {
          return { stdout: 'Jane\n', stderr: '' }
        }
        if (args[0] === 'rev-parse') {
          return { stdout: 'abc\n', stderr: '' }
        }
        if (args[0] === 'diff' && args.includes('--numstat')) {
          // Full PR diff as seen from main..merge.
          return { stdout: '2392\t10\tsrc/feature.ts\n', stderr: '' }
        }
        if (args[0] === 'log') {
          if (args.includes('--format=%an%x09%ae')) {
            return {
              stdout: [
                'Jane\tjane@acme.com',
                'Bob\tbob@acme.com',
              ].join('\n'),
              stderr: '',
            }
          }
          if (args.includes('--pretty=tformat:')) {
            return { stdout: '', stderr: '' }
          }
          if (args.includes('--merges')) {
            return {
              stdout: `deadbeef\t${ts}\tabc1234 def5678\n`,
              stderr: '',
            }
          }
          if (
            args.includes('--no-merges') &&
            args.includes('--format=%ae%x09%an')
          ) {
            // Branch that landed belongs to Bob.
            return { stdout: 'bob@acme.com\tBob\n', stderr: '' }
          }
          if (args.includes('--format=%H%x09%ct%x09%ae%x09%an')) {
            // Jane's own direct commit on main.
            return {
              stdout: `aaaaaaa\t${ts}\tjane@acme.com\tJane\n10\t0\tsrc/own.ts\n`,
              stderr: '',
            }
          }
        }
        return { stdout: '', stderr: '' }
      },
    })
    // Only Jane's direct 10 lines — not Bob's 2392 from the merge she clicked.
    expect(result.days.reduce((sum, day) => sum + day.insertions, 0)).toBe(10)
  })

  it('sums checked identities when sumMultiple is on', async () => {
    const { logArgs, execGit } = mockRepo(
      [
        'Jane\tjane@acme.com',
        'JaneHub\t8+JaneHub@users.noreply.github.com',
      ].join('\n'),
      {
        'jane@acme.com': 4,
        '8+JaneHub@users.noreply.github.com': 6,
      },
    )
    const result = await collectMergedLineDays({
      cwd: '/tmp/acme',
      sinceMs: Date.UTC(2026, 8, 1),
      untilMs: Date.UTC(2026, 8, 19),
      cursorEmail: 'jane@acme.com',
      savedAuthors: {
        emails: ['jane@acme.com', '8+JaneHub@users.noreply.github.com'],
        sumMultiple: true,
      },
      execGit,
    })
    expect(result.days[0]?.insertions).toBe(10)
    const pendingLog = logArgs.find((args) => args.includes('--pretty=tformat:'))
    expect(pendingLog).toContain('--author=<jane@acme\\.com>')
    expect(pendingLog).toContain(
      '--author=<8\\+JaneHub@users\\.noreply\\.github\\.com>',
    )
  })

  it('does not count the whole team when no Cursor email is known', async () => {
    const logCalls: string[][] = []
    const result = await collectMergedLineDays({
      cwd: '/tmp/empty',
      sinceMs: Date.UTC(2026, 8, 1),
      untilMs: Date.UTC(2026, 8, 19),
      cursorEmail: null,
      async execGit(args) {
        if (args[0] === 'branch') {
          return { stdout: 'main\n', stderr: '' }
        }
        if (args[0] === 'symbolic-ref') {
          return { stdout: 'origin/main\n', stderr: '' }
        }
        if (args[0] === 'config') {
          return { stdout: '', stderr: '' }
        }
        if (args[0] === 'rev-parse') {
          return { stdout: 'abc\n', stderr: '' }
        }
        if (args[0] === 'log') {
          logCalls.push(args)
          if (args.includes('--format=%an%x09%ae')) {
            return { stdout: 'Bob\tbob@acme.com\n', stderr: '' }
          }
          return { stdout: '1\t0\tsrc/team.ts\n', stderr: '' }
        }
        return { stdout: '', stderr: '' }
      },
    })
    expect(result.authorFiltered).toBe(false)
    expect(result.days).toEqual([])
    expect(
      logCalls.some((args) =>
        args.includes('--format=%H%x09%ct%x09%ae%x09%an'),
      ),
    ).toBe(false)
  })

  it('sums nested microservice repos when the open folder is a stack', async () => {
    const ts = Math.floor(Date.UTC(2026, 8, 10, 12, 0, 0) / 1000)
    const result = await collectMergedLineDays({
      cwd: '/work/rhino-rage',
      sinceMs: Date.UTC(2026, 8, 1),
      untilMs: Date.UTC(2026, 8, 19),
      cursorEmail: 'jane@acme.com',
      listNestedGitRepos: async (cwd) => {
        if (cwd === '/work/rhino-rage') {
          return ['/work/rhino-rage/payments', '/work/rhino-rage/gateway']
        }
        return []
      },
      async execGit(args, cwd) {
        if (cwd === '/work/rhino-rage') {
          if (args[0] === 'branch' || args[0] === 'symbolic-ref') {
            return { stdout: '', stderr: '' }
          }
        }
        if (args[0] === 'branch') {
          return { stdout: 'main\n', stderr: '' }
        }
        if (args[0] === 'symbolic-ref') {
          return { stdout: 'origin/main\n', stderr: '' }
        }
        if (args[0] === 'config' && args[1] === 'user.email') {
          return { stdout: 'jane@acme.com\n', stderr: '' }
        }
        if (args[0] === 'config' && args[1] === 'user.name') {
          return { stdout: 'Jane\n', stderr: '' }
        }
        if (args[0] === 'rev-parse') {
          return { stdout: 'abc\n', stderr: '' }
        }
        if (args[0] === 'diff') {
          return { stdout: '', stderr: '' }
        }
        if (args[0] === 'log') {
          if (args.includes('--format=%an%x09%ae')) {
            return { stdout: 'Jane\tjane@acme.com\n', stderr: '' }
          }
          if (args.includes('--pretty=tformat:')) {
            return { stdout: '', stderr: '' }
          }
          if (args.includes('--merges')) {
            return { stdout: '', stderr: '' }
          }
          if (args.includes('--format=%H%x09%ct%x09%ae%x09%an')) {
            const lines = cwd.endsWith('payments') ? 10 : 7
            return {
              stdout: `aaaaaaa\t${ts}\tjane@acme.com\tJane\n${lines}\t0\tsrc/a.ts\n`,
              stderr: '',
            }
          }
        }
        return { stdout: '', stderr: '' }
      },
    })
    expect(result.bundleRoot).toBe('/work/rhino-rage')
    expect(result.days).toEqual([
      { date: expect.any(String), insertions: 17, deletions: 0 },
    ])
    expect(result.days[0]?.insertions).toBe(17)
  })

  it('discovers servers/* submodule .git files on disk and sums their logs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cct-rhino-'))
    await mkdir(join(root, '.git'), { recursive: true })
    await mkdir(join(root, 'servers', 'rhino-api-provider-service'), {
      recursive: true,
    })
    await mkdir(join(root, 'servers', 'rhino-gateway'), { recursive: true })
    await writeFile(
      join(root, '.gitmodules'),
      [
        '[submodule "servers/rhino-api-provider-service"]',
        '\tpath = servers/rhino-api-provider-service',
        '[submodule "servers/rhino-gateway"]',
        '\tpath = servers/rhino-gateway',
        '',
      ].join('\n'),
    )
    await writeFile(
      join(root, 'servers', 'rhino-api-provider-service', '.git'),
      'gitdir: ../../.git/modules/servers/rhino-api-provider-service\n',
    )
    await writeFile(
      join(root, 'servers', 'rhino-gateway', '.git'),
      'gitdir: ../../.git/modules/servers/rhino-gateway\n',
    )
    const ts = Math.floor(Date.UTC(2026, 8, 10, 12, 0, 0) / 1000)
    const logCwds: string[] = []
    const result = await collectMergedLineDays({
      cwd: root,
      sinceMs: Date.UTC(2026, 8, 1),
      untilMs: Date.UTC(2026, 8, 19),
      cursorEmail: 'jane@acme.com',
      async execGit(args, cwd) {
        if (args[0] === 'branch') {
          return { stdout: 'main\n', stderr: '' }
        }
        if (args[0] === 'symbolic-ref') {
          return { stdout: 'origin/main\n', stderr: '' }
        }
        if (args[0] === 'config' && args[1] === 'user.email') {
          return { stdout: 'jane@acme.com\n', stderr: '' }
        }
        if (args[0] === 'config' && args[1] === 'user.name') {
          return { stdout: 'Jane\n', stderr: '' }
        }
        if (args[0] === 'rev-parse') {
          return { stdout: 'abc\n', stderr: '' }
        }
        if (args[0] === 'diff') {
          return { stdout: '', stderr: '' }
        }
        if (args[0] === 'log') {
          if (args.includes('--format=%an%x09%ae')) {
            return { stdout: 'Jane\tjane@acme.com\n', stderr: '' }
          }
          if (args.includes('--pretty=tformat:')) {
            return { stdout: '', stderr: '' }
          }
          if (args.includes('--merges')) {
            return { stdout: '', stderr: '' }
          }
          if (args.includes('--format=%H%x09%ct%x09%ae%x09%an')) {
            logCwds.push(cwd)
            const lines = cwd.endsWith('rhino-api-provider-service')
              ? 10
              : cwd.endsWith('rhino-gateway')
                ? 7
                : 1
            return {
              stdout: `aaaaaaa\t${ts}\tjane@acme.com\tJane\n${lines}\t0\tsrc/a.ts\n`,
              stderr: '',
            }
          }
        }
        return { stdout: '', stderr: '' }
      },
    })
    expect(result.bundleRoot).toBe(root)
    expect(logCwds.some((cwd) => cwd.endsWith('rhino-api-provider-service'))).toBe(
      true,
    )
    expect(logCwds.some((cwd) => cwd.endsWith('rhino-gateway'))).toBe(true)
    expect(result.days[0]?.insertions).toBe(18)
  })
})
