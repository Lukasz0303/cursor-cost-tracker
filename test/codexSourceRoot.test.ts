import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  resolveCodexRoot,
  sessionsDirectoryExists,
} from '../src/openaiHistory/codex/sourceRoot'

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

describe('resolveCodexRoot', () => {
  it('prefers the setting over env and home', async () => {
    const dirs = new Set(['/setting/codex', '/env/codex', '/home/.codex'])
    const result = await resolveCodexRoot({
      codexHomeSetting: '/setting/codex',
      codexHomeEnv: '/env/codex',
      homeDir: '/home',
      stat: async (path) => (dirs.has(path) ? 'dir' : 'missing'),
      realpath: async (path) => path,
    })
    expect(result).toEqual({
      ok: true,
      realpath: '/setting/codex',
      sourceInstanceId: sha256('/setting/codex'),
      via: 'setting',
      pointedAtSessions: false,
      scanDirect: false,
    })
  })

  it('resolves the default ~/.codex under the user home on macOS and Windows', async () => {
    const mac = await resolveCodexRoot({
      codexHomeSetting: '~/.codex',
      codexHomeEnv: undefined,
      homeDir: '/Users/ada',
      stat: async (path) => (path === '/Users/ada/.codex' ? 'dir' : 'missing'),
      realpath: async (path) => path,
    })
    const win = await resolveCodexRoot({
      codexHomeSetting: '~/.codex',
      codexHomeEnv: undefined,
      homeDir: 'C:\\Users\\ada',
      stat: async (path) => (path === 'C:\\Users\\ada\\.codex' ? 'dir' : 'missing'),
      realpath: async (path) => path,
    })
    expect(mac).toMatchObject({ ok: true, realpath: '/Users/ada/.codex', via: 'setting' })
    expect(win).toMatchObject({
      ok: true,
      realpath: 'C:\\Users\\ada\\.codex',
      via: 'setting',
    })
  })

  it('expands ~ in the setting', async () => {
    const result = await resolveCodexRoot({
      codexHomeSetting: '~/my-codex',
      codexHomeEnv: undefined,
      homeDir: '/Users/me',
      stat: async (path) => (path === '/Users/me/my-codex' ? 'dir' : 'missing'),
      realpath: async (path) => path,
    })
    expect(result).toMatchObject({
      ok: true,
      realpath: '/Users/me/my-codex',
      via: 'setting',
    })
  })

  it('falls through to an absolute existing CODEX_HOME', async () => {
    const result = await resolveCodexRoot({
      codexHomeSetting: '',
      codexHomeEnv: '/abs/codex',
      homeDir: '/home',
      stat: async (path) => (path === '/abs/codex' ? 'dir' : 'missing'),
      realpath: async (path) => `${path}-real`,
    })
    expect(result).toEqual({
      ok: true,
      realpath: '/abs/codex-real',
      sourceInstanceId: sha256('/abs/codex-real'),
      via: 'env',
      pointedAtSessions: false,
      scanDirect: false,
    })
  })

  it('ignores a relative CODEX_HOME', async () => {
    const result = await resolveCodexRoot({
      codexHomeSetting: '',
      codexHomeEnv: 'relative/codex',
      homeDir: '/home',
      stat: async (path) => (path === '/home/.codex' ? 'dir' : 'missing'),
      realpath: async (path) => path,
    })
    expect(result).toMatchObject({
      ok: true,
      realpath: '/home/.codex',
      via: 'home',
    })
  })

  it('returns missing when no directory exists', async () => {
    const result = await resolveCodexRoot({
      codexHomeSetting: '',
      codexHomeEnv: undefined,
      homeDir: '/home',
      stat: async () => 'missing',
      realpath: async (path) => path,
    })
    expect(result).toEqual({ ok: false, reason: 'missing' })
  })

  it('changes sourceInstanceId when the realpath changes', async () => {
    const a = await resolveCodexRoot({
      codexHomeSetting: '/codex',
      codexHomeEnv: undefined,
      homeDir: '/home',
      stat: async () => 'dir',
      realpath: async () => '/real/a',
    })
    const b = await resolveCodexRoot({
      codexHomeSetting: '/codex',
      codexHomeEnv: undefined,
      homeDir: '/home',
      stat: async () => 'dir',
      realpath: async () => '/real/b',
    })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) {
      return
    }
    expect(a.sourceInstanceId).not.toBe(b.sourceInstanceId)
    expect(a.sourceInstanceId).toBe(sha256('/real/a'))
  })

  it('resolves a relative setting from the home directory', async () => {
    const result = await resolveCodexRoot({
      codexHomeSetting: '.codex',
      codexHomeEnv: undefined,
      homeDir: '/Users/me',
      stat: async (path) => (path === '/Users/me/.codex' ? 'dir' : 'missing'),
      realpath: async (path) => path,
    })
    expect(result).toMatchObject({
      ok: true,
      realpath: '/Users/me/.codex',
      via: 'setting',
      pointedAtSessions: false,
    })
  })

  it('expands %USERPROFILE% in the setting', async () => {
    const result = await resolveCodexRoot({
      codexHomeSetting: '%USERPROFILE%/.codex',
      codexHomeEnv: undefined,
      homeDir: '/Users/me',
      stat: async (path) => (path === '/Users/me/.codex' ? 'dir' : 'missing'),
      realpath: async (path) => path,
    })
    expect(result).toMatchObject({
      ok: true,
      realpath: '/Users/me/.codex',
      via: 'setting',
    })
  })

  it('expands ~ in CODEX_HOME', async () => {
    const result = await resolveCodexRoot({
      codexHomeSetting: '',
      codexHomeEnv: '~/codex-env',
      homeDir: '/Users/me',
      stat: async (path) => (path === '/Users/me/codex-env' ? 'dir' : 'missing'),
      realpath: async (path) => path,
    })
    expect(result).toMatchObject({
      ok: true,
      realpath: '/Users/me/codex-env',
      via: 'env',
    })
  })

  it('lifts a sessions directory to the Codex parent', async () => {
    const dirs = new Set(['/Users/me/.codex', '/Users/me/.codex/sessions'])
    const result = await resolveCodexRoot({
      codexHomeSetting: '~/.codex/sessions',
      codexHomeEnv: undefined,
      homeDir: '/Users/me',
      stat: async (path) => (dirs.has(path) ? 'dir' : 'missing'),
      realpath: async (path) => path,
    })
    expect(result).toMatchObject({
      ok: true,
      realpath: '/Users/me/.codex',
      via: 'setting',
      pointedAtSessions: true,
      scanDirect: false,
    })
  })

  it('reports sessions-folder when the parent is missing', async () => {
    const result = await resolveCodexRoot({
      codexHomeSetting: '/only/sessions',
      codexHomeEnv: '/env/codex',
      homeDir: '/home',
      stat: async (path) => (path === '/only/sessions' ? 'dir' : 'missing'),
      realpath: async (path) => path,
    })
    expect(result).toEqual({
      ok: false,
      reason: 'sessions-folder',
      pointedPath: '/only/sessions',
    })
  })

  it('scans a directory of rollout files directly', async () => {
    const result = await resolveCodexRoot({
      codexHomeSetting: '/tmp/day',
      codexHomeEnv: undefined,
      homeDir: '/home',
      stat: async (path) => (path === '/tmp/day' ? 'dir' : 'missing'),
      realpath: async (path) => path,
      readdir: async () => ['rollout-a.jsonl', 'config.toml'],
    })
    expect(result).toMatchObject({
      ok: true,
      realpath: '/tmp/day',
      pointedAtSessions: true,
      scanDirect: true,
    })
  })

  it('keeps a directory that already contains sessions/', async () => {
    const result = await resolveCodexRoot({
      codexHomeSetting: '/Users/me/.codex',
      codexHomeEnv: undefined,
      homeDir: '/Users/me',
      stat: async (path) => (path === '/Users/me/.codex' ? 'dir' : 'missing'),
      realpath: async (path) => path,
      readdir: async () => ['sessions', 'config.toml', 'history.jsonl'],
    })
    expect(result).toMatchObject({
      ok: true,
      realpath: '/Users/me/.codex',
      pointedAtSessions: false,
      scanDirect: false,
    })
  })

  it('sessionsDirectoryExists only stats sessions/', async () => {
    const seen: string[] = []
    const exists = await sessionsDirectoryExists('/root', async (path) => {
      seen.push(path)
      return path === '/root/sessions' ? 'dir' : 'missing'
    })
    expect(exists).toBe(true)
    expect(seen).toEqual(['/root/sessions'])
  })
})
