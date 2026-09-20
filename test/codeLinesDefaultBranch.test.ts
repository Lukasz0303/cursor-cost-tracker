import { describe, expect, it } from 'vitest'
import { pickDefaultBranch } from '../src/codeLines/defaultBranch'

describe('pickDefaultBranch', () => {
  it('prefers main over master', () => {
    expect(pickDefaultBranch(['master', 'main', 'develop'])).toBe('main')
  })

  it('falls back to master', () => {
    expect(pickDefaultBranch(['feature', 'master'])).toBe('master')
  })

  it('uses origin HEAD short name when main/master missing', () => {
    expect(pickDefaultBranch(['develop', 'trunk'], 'refs/heads/develop')).toBe(
      'develop',
    )
  })

  it('returns null when nothing matches', () => {
    expect(pickDefaultBranch([])).toBeNull()
  })
})
