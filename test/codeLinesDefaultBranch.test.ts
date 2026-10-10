import { describe, expect, it } from 'vitest'
import {
  originTrackingRefspec,
  pickDefaultBranch,
} from '../src/codeLines/defaultBranch'

describe('pickDefaultBranch', () => {
  it('prefers main over master when origin HEAD is unknown', () => {
    expect(pickDefaultBranch(['master', 'main', 'develop'])).toBe('main')
  })

  it('falls back to master', () => {
    expect(pickDefaultBranch(['feature', 'master'])).toBe('master')
  })

  it('follows origin HEAD when the default is master, not a local main', () => {
    expect(pickDefaultBranch(['main', 'master', 'develop'], 'origin/master')).toBe(
      'master',
    )
  })

  it('follows origin HEAD for a default other than main or master', () => {
    expect(pickDefaultBranch(['main'], 'refs/heads/develop')).toBe('develop')
  })

  it('returns null when nothing matches', () => {
    expect(pickDefaultBranch([])).toBeNull()
  })
})

describe('originTrackingRefspec', () => {
  it('maps main, master, and other defaults onto the origin tracking ref', () => {
    expect(originTrackingRefspec('main')).toBe(
      'refs/heads/main:refs/remotes/origin/main',
    )
    expect(originTrackingRefspec('origin/master')).toBe(
      'refs/heads/master:refs/remotes/origin/master',
    )
    expect(originTrackingRefspec('refs/heads/develop')).toBe(
      'refs/heads/develop:refs/remotes/origin/develop',
    )
  })

  it('drops a name that would rewrite the refspec', () => {
    expect(originTrackingRefspec('main:refs/heads/other')).toBeNull()
    expect(originTrackingRefspec('')).toBeNull()
  })
})
