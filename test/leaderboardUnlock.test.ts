import { describe, expect, it } from 'vitest'
import {
  isLeaderboardUnlocked,
  normalizeUnlockToken,
  parseUnlockRequest,
  unlockStateFor,
  unlockTokenFor,
  verifyUnlockToken,
} from '../src/unlock/leaderboardUnlock'

const SECRET = 'test-secret'
const EMAIL = 'someone@example.com'

describe('unlockTokenFor', () => {
  it('formats a dashed code with a stable prefix', () => {
    expect(unlockTokenFor(EMAIL, SECRET)).toMatch(
      /^CCT-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
    )
  })

  it('ignores casing and surrounding space in the address', () => {
    expect(unlockTokenFor('  SomeOne@Example.COM ', SECRET)).toBe(
      unlockTokenFor(EMAIL, SECRET),
    )
  })

  it('differs per address and per secret', () => {
    expect(unlockTokenFor('other@example.com', SECRET)).not.toBe(
      unlockTokenFor(EMAIL, SECRET),
    )
    expect(unlockTokenFor(EMAIL, 'another-secret')).not.toBe(
      unlockTokenFor(EMAIL, SECRET),
    )
  })

  /** Guards the wire format shared with .ai/reports/generate-unlock-token.mjs. */
  it('keeps the published derivation stable', () => {
    expect(unlockTokenFor('someone@example.com', 'test-secret')).toBe(
      'CCT-KR50-P15R-TQGT',
    )
  })
})

describe('verifyUnlockToken', () => {
  it('accepts the code issued for that address', () => {
    expect(verifyUnlockToken(EMAIL, unlockTokenFor(EMAIL, SECRET), SECRET)).toBe(
      true,
    )
  })

  it('accepts a code pasted without dashes or in lower case', () => {
    const token = unlockTokenFor(EMAIL, SECRET)
    expect(verifyUnlockToken(EMAIL, token.replace(/-/g, ''), SECRET)).toBe(true)
    expect(verifyUnlockToken(EMAIL, token.toLowerCase(), SECRET)).toBe(true)
  })

  it('rejects a code issued for another address', () => {
    expect(
      verifyUnlockToken(EMAIL, unlockTokenFor('other@example.com', SECRET), SECRET),
    ).toBe(false)
  })

  it('rejects a code from another secret', () => {
    expect(
      verifyUnlockToken(EMAIL, unlockTokenFor(EMAIL, 'another-secret'), SECRET),
    ).toBe(false)
  })

  it('rejects empty, short, and long input', () => {
    expect(verifyUnlockToken(EMAIL, '', SECRET)).toBe(false)
    expect(verifyUnlockToken(EMAIL, 'CCT-1234', SECRET)).toBe(false)
    expect(verifyUnlockToken(EMAIL, `${unlockTokenFor(EMAIL, SECRET)}-EXTRA`, SECRET)).toBe(
      false,
    )
  })

  it('rejects any code when the account address is missing', () => {
    expect(verifyUnlockToken('   ', unlockTokenFor('   ', SECRET), SECRET)).toBe(
      false,
    )
  })
})

describe('parseUnlockRequest', () => {
  it('reads the code out of an unlock message', () => {
    expect(parseUnlockRequest('UNLOCK: CCT-KR50-P15R-TQGT')).toBe(
      'CCTKR50P15RTQGT',
    )
  })

  it('tolerates casing, spacing, and trailing newlines', () => {
    expect(parseUnlockRequest('\n  unlock :  cct kr50 p15r tqgt \n')).toBe(
      'CCTKR50P15RTQGT',
    )
  })

  it('returns null for an ordinary message', () => {
    expect(parseUnlockRequest('Great extension, thanks!')).toBeNull()
    expect(parseUnlockRequest('I want to unlock: please explain how')).toBeNull()
    expect(parseUnlockRequest('')).toBeNull()
    expect(parseUnlockRequest(undefined)).toBeNull()
  })

  it('returns null when the code is the wrong length', () => {
    expect(parseUnlockRequest('UNLOCK: CCT-KR50-P15R')).toBeNull()
    expect(parseUnlockRequest('UNLOCK: CCT-KR50-P15R-TQGT-9999')).toBeNull()
  })
})

describe('normalizeUnlockToken', () => {
  it('drops separators and upper-cases the rest', () => {
    expect(normalizeUnlockToken(' cct-kr50 p15r_tqgt ')).toBe('CCTKR50P15RTQGT')
  })
})

describe('unlock state', () => {
  it('stores a hash instead of the address', () => {
    const state = unlockStateFor(EMAIL, SECRET, 1_700_000_000_000)
    expect(state.unlocked).toBe(true)
    expect(state.at).toBe(1_700_000_000_000)
    expect(state.emailHash).toMatch(/^[0-9a-f]{16}$/)
    expect(state.emailHash).not.toContain('example')
  })

  it('reads back as unlocked and rejects anything else', () => {
    expect(isLeaderboardUnlocked(unlockStateFor(EMAIL, SECRET, 1))).toBe(true)
    expect(isLeaderboardUnlocked({ unlocked: false })).toBe(false)
    expect(isLeaderboardUnlocked({})).toBe(false)
    expect(isLeaderboardUnlocked(true)).toBe(false)
    expect(isLeaderboardUnlocked(null)).toBe(false)
    expect(isLeaderboardUnlocked(undefined)).toBe(false)
  })
})
