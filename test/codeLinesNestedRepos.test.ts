import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  listNestedIndependentGitRepos,
  mergeGitNumstatDays,
  parseGitmodulesPaths,
  pathInsideBundle,
} from '../src/codeLines/nestedRepos'

describe('pathInsideBundle', () => {
  it('matches the stack root and nested services, not a sibling repo', () => {
    const root = '/work/rhino-rage'
    expect(pathInsideBundle(root, root)).toBe(true)
    expect(pathInsideBundle('/work/rhino-rage/payments', root)).toBe(true)
    expect(
      pathInsideBundle(
        '/work/rhino-rage/servers/rhino-api-provider-service',
        root,
      ),
    ).toBe(true)
    expect(pathInsideBundle('/work/pc-toolsets', root)).toBe(false)
  })
})

describe('mergeGitNumstatDays', () => {
  it('adds insertions from each microservice on the same day', () => {
    expect(
      mergeGitNumstatDays([
        [{ date: '2026-09-10', insertions: 10, deletions: 1 }],
        [{ date: '2026-09-10', insertions: 7, deletions: 0 }],
        [{ date: '2026-09-11', insertions: 2, deletions: 0 }],
      ]),
    ).toEqual([
      { date: '2026-09-10', insertions: 17, deletions: 1 },
      { date: '2026-09-11', insertions: 2, deletions: 0 },
    ])
  })
})

describe('parseGitmodulesPaths', () => {
  it('reads any submodule path, not only servers/', () => {
    expect(
      parseGitmodulesPaths(`
[submodule "servers/rhino-api-provider-service"]
	path = servers/rhino-api-provider-service
	url = git@github.com:org/rhino-api-provider-service.git
[submodule "clients/web"]
	path = clients/web
	url = git@github.com:org/web.git
[submodule "packages/ui"]
	path = packages/ui
`),
    ).toEqual([
      'servers/rhino-api-provider-service',
      'clients/web',
      'packages/ui',
    ])
  })
})

describe('listNestedIndependentGitRepos', () => {
  it('finds child .git directories and skips node_modules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cct-poly-'))
    await mkdir(join(root, 'svc-a', '.git'), { recursive: true })
    await mkdir(join(root, 'svc-b', '.git'), { recursive: true })
    await mkdir(join(root, 'node_modules', 'lib', '.git'), { recursive: true })
    await mkdir(join(root, 'docs'), { recursive: true })
    const found = await listNestedIndependentGitRepos(root)
    expect(found.sort()).toEqual(
      [join(root, 'svc-a'), join(root, 'svc-b')].sort(),
    )
  })

  it('finds git submodules two levels down (servers/service) via .gitmodules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cct-sub-'))
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
    await mkdir(join(root, 'servers', 'rhino-api-provider-service'), {
      recursive: true,
    })
    await mkdir(join(root, 'servers', 'rhino-gateway'), { recursive: true })
    await writeFile(
      join(root, 'servers', 'rhino-api-provider-service', '.git'),
      'gitdir: ../../.git/modules/servers/rhino-api-provider-service\n',
    )
    await writeFile(
      join(root, 'servers', 'rhino-gateway', '.git'),
      'gitdir: ../../.git/modules/servers/rhino-gateway\n',
    )
    await mkdir(join(root, 'docs'), { recursive: true })
    const found = (await listNestedIndependentGitRepos(root)).sort()
    expect(found).toEqual(
      [
        join(root, 'servers', 'rhino-api-provider-service'),
        join(root, 'servers', 'rhino-gateway'),
      ].sort(),
    )
  })

  it('finds two-level submodule checkouts without .gitmodules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cct-walk-'))
    await mkdir(join(root, 'clients', 'web'), { recursive: true })
    await mkdir(join(root, 'packages', 'ui'), { recursive: true })
    await writeFile(
      join(root, 'clients', 'web', '.git'),
      'gitdir: ../../.git/modules/clients/web\n',
    )
    await writeFile(
      join(root, 'packages', 'ui', '.git'),
      'gitdir: ../../.git/modules/packages/ui\n',
    )
    const found = (await listNestedIndependentGitRepos(root)).sort()
    expect(found).toEqual(
      [join(root, 'clients', 'web'), join(root, 'packages', 'ui')].sort(),
    )
  })
})
