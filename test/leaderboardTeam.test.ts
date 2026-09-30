import { describe, expect, it } from 'vitest'
import { normalizeTeamEmails } from '../src/leaderboard/team'

describe('normalizeTeamEmails', () => {
  it('keeps unique valid addresses and drops the rest', () => {
    expect(
      normalizeTeamEmails([
        ' Ada@Example.com ',
        'ada@example.com',
        'not-an-email',
        '',
        12,
        'bob@studio.dev',
      ]),
    ).toEqual(['Ada@Example.com', 'bob@studio.dev'])
  })

  it('returns an empty list for anything that is not an array', () => {
    expect(normalizeTeamEmails(null)).toEqual([])
    expect(normalizeTeamEmails('ada@example.com')).toEqual([])
  })
})
