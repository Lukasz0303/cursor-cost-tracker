import { describe, expect, it } from 'vitest'
import {
  escapeGitAuthorPattern,
  gitAuthorLogArgs,
  githubLoginFromNoreplyEmail,
  githubLoginFromRemoteUrl,
  parseGitConfigValue,
} from '../src/codeLines/gitAuthor'

describe('gitAuthorLogArgs', () => {
  it('matches email field, GitHub noreply, and exact login name — not a bare login', () => {
    expect(
      gitAuthorLogArgs({ email: 'a.b@x.com', name: 'Ada Lovelace' }, 'AdaHub'),
    ).toEqual([
      '--author=<a\\.b@x\\.com>',
      '--author=AdaHub@users\\.noreply\\.github\\.com',
      '--author=^AdaHub <',
      '--author=^Ada Lovelace <',
    ])
  })

  it('does not emit an unanchored org that would match @acme.com teammates', () => {
    const args = gitAuthorLogArgs(
      { email: 'jane@acme.com', name: 'Jane Doe' },
      'Acme',
    )
    expect(args).toContain('--author=<jane@acme\\.com>')
    expect(args).toContain('--author=Acme@users\\.noreply\\.github\\.com')
    expect(args).toContain('--author=^Acme <')
    expect(args).toContain('--author=^Jane Doe <')
    expect(args.some((arg) => arg === '--author=Acme')).toBe(false)
    expect(args.some((arg) => arg === '--author=Jane Doe')).toBe(false)
  })

  it('anchors name when email is missing', () => {
    expect(gitAuthorLogArgs({ email: null, name: 'Ada Lovelace' })).toEqual([
      '--author=^Ada Lovelace <',
    ])
  })

  it('returns no filter when identity is missing', () => {
    expect(gitAuthorLogArgs({ email: '  ', name: '' })).toEqual([])
  })
})

describe('parseGitConfigValue', () => {
  it('trims and treats blank as null', () => {
    expect(parseGitConfigValue(' me@x.com \n')).toBe('me@x.com')
    expect(parseGitConfigValue('\n')).toBeNull()
  })
})

describe('escapeGitAuthorPattern', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeGitAuthorPattern('a+b@x.com')).toBe('a\\+b@x\\.com')
  })
})

describe('githubLoginFromNoreplyEmail', () => {
  it('parses id+login and login-only noreply addresses', () => {
    expect(
      githubLoginFromNoreplyEmail(
        '123+Lukasz0303@users.noreply.github.com',
      ),
    ).toBe('Lukasz0303')
    expect(
      githubLoginFromNoreplyEmail('Lukasz0303@users.noreply.github.com'),
    ).toBe('Lukasz0303')
  })

  it('returns null for work email', () => {
    expect(githubLoginFromNoreplyEmail('lukasz@acme.com')).toBeNull()
  })
})

describe('githubLoginFromRemoteUrl', () => {
  it('parses ssh and https GitHub remotes', () => {
    expect(
      githubLoginFromRemoteUrl(
        'git@github.com:Lukasz0303/cursor-cost-tracker.git',
      ),
    ).toBe('Lukasz0303')
    expect(
      githubLoginFromRemoteUrl(
        'https://github.com/Lukasz0303/cursor-cost-tracker.git',
      ),
    ).toBe('Lukasz0303')
  })

  it('returns null for non-GitHub remotes', () => {
    expect(githubLoginFromRemoteUrl('git@gitlab.com:g/r.git')).toBeNull()
  })
})
