import { describe, expect, it } from 'vitest'
import {
  BUY_ME_A_COFFEE_URL,
  GITHUB_SPONSORS_URL,
  REPOSITORY_URL,
  SUPPORT_TIERS,
  WEBSITE_URL,
  resolveSupportUrl,
  supportLinkReady,
} from '../src/supportLinks'

describe('supportLinks', () => {
  it('keeps three sponsor tiers at $2 / $5 / $10', () => {
    expect(SUPPORT_TIERS.map((tier) => tier.usd)).toEqual([2, 5, 10])
    expect(SUPPORT_TIERS.every((tier) => tier.linkId === 'githubSponsors')).toBe(
      true,
    )
  })

  it('enables Buy Me a Coffee and keeps GitHub Sponsors hidden until the URL is set', () => {
    expect(BUY_ME_A_COFFEE_URL).toBe('https://buymeacoffee.com/lzzzielinsn')
    expect(GITHUB_SPONSORS_URL).toBe('')
    expect(supportLinkReady('buyMeACoffee')).toBe(true)
    expect(supportLinkReady('githubSponsors')).toBe(false)
    expect(resolveSupportUrl('buyMeACoffee')).toBe(
      'https://buymeacoffee.com/lzzzielinsn',
    )
    expect(resolveSupportUrl('githubSponsors')).toBeUndefined()
    expect(resolveSupportUrl('nope')).toBeUndefined()
  })

  it('opens the product site and the public repository', () => {
    expect(WEBSITE_URL).toBe('https://cursorcosttracker.com/')
    expect(REPOSITORY_URL).toBe(
      'https://github.com/Lukasz0303/cursor-cost-tracker',
    )
    expect(supportLinkReady('website')).toBe(true)
    expect(supportLinkReady('repository')).toBe(true)
    expect(resolveSupportUrl('website')).toBe(WEBSITE_URL)
    expect(resolveSupportUrl('repository')).toBe(REPOSITORY_URL)
  })
})
