import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectMergedLineDays } from '../src/codeLines/runGitMerged'

function mockRepo(authorsStdout: string) {
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
      const ts = Math.floor(Date.UTC(2026, 8, 10, 12, 0, 0) / 1000)
      return { stdout: `${ts}\n4\t0\tsrc/a.ts\n`, stderr: '' }
    }
    return { stdout: '', stderr: '' }
  }
  return { logArgs, execGit }
}

describe('collectMergedLineDays', () => {
  it('defaults to the Cursor email and does not OR the GitHub org', async () => {
    const { logArgs, execGit } = mockRepo(
      [
        'Jane\tjane@acme.com',
        'Bob\tbob@acme.com',
        'Acme Bot\tbot@acme.com',
      ].join('\n'),
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
    const mergedLog = logArgs.find((args) => args.includes('--format=%ct'))
    expect(mergedLog).toContain('--first-parent')
    expect(mergedLog).toContain('--author=<jane@acme\\.com>')
    expect(mergedLog?.some((arg) => arg === '--author=Acme')).toBe(false)
    expect(mergedLog?.join('\n')).not.toContain('bob@acme')
  })

  it('sums checked identities when sumMultiple is on', async () => {
    const { logArgs, execGit } = mockRepo(
      [
        'Jane\tjane@acme.com',
        'JaneHub\t8+JaneHub@users.noreply.github.com',
      ].join('\n'),
    )
    await collectMergedLineDays({
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
    const mergedLog = logArgs.find((args) => args.includes('--format=%ct'))
    expect(mergedLog).toContain('--author=<jane@acme\\.com>')
    expect(mergedLog).toContain(
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
    expect(logCalls.some((args) => args.includes('--format=%ct'))).toBe(false)
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
          const lines = cwd.endsWith('payments') ? 10 : 7
          return { stdout: `${ts}\n${lines}\t0\tsrc/a.ts\n`, stderr: '' }
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
          if (args.includes('--format=%ct')) {
            logCwds.push(cwd)
          }
          const lines = cwd.endsWith('rhino-api-provider-service')
            ? 10
            : cwd.endsWith('rhino-gateway')
              ? 7
              : 1
          return { stdout: `${ts}\n${lines}\t0\tsrc/a.ts\n`, stderr: '' }
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
