/**
 * Support / funding links for the Support tab.
 * Buy Me a Coffee is live. GitHub Sponsors stays in the payload and HTML
 * but the Support tab hides that section until GITHUB_SPONSORS_URL is set.
 * Empty string → UI shows Coming soon (coffee) or hides the block (sponsors)
 * and skips openExternal.
 */

export type SupportLinkId = 'buyMeACoffee' | 'githubSponsors'

export type SupportTier = {
  id: string
  usd: number
  title: string
  blurb: string
  /** Maps to SupportLinkId; all sponsor tiers share githubSponsors until custom URLs exist. */
  linkId: SupportLinkId
}

/** One-time tip page (Buy Me a Coffee). */
export const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/lzzzielinsn'

/**
 * GitHub Sponsors profile. Hidden in the Support tab until this URL is non-empty.
 * Example: https://github.com/sponsors/Lukasz0303
 */
export const GITHUB_SPONSORS_URL = ''

export const SUPPORT_TIERS: SupportTier[] = [
  {
    id: 'tip',
    usd: 2,
    title: 'Coffee tip',
    blurb: 'A small thank-you when a saved query bought you back a coffee.',
    linkId: 'githubSponsors',
  },
  {
    id: 'supporter',
    usd: 5,
    title: 'Supporter',
    blurb: 'Help cover tooling and keep forecasts + Optimize prompts sharp.',
    linkId: 'githubSponsors',
  },
  {
    id: 'champion',
    usd: 10,
    title: 'Champion',
    blurb: 'Actively fund new features and faster responses to Cursor API changes.',
    linkId: 'githubSponsors',
  },
]

const SUPPORT_URLS: Record<SupportLinkId, string> = {
  buyMeACoffee: BUY_ME_A_COFFEE_URL,
  githubSponsors: GITHUB_SPONSORS_URL,
}

export function resolveSupportUrl(linkId: unknown): string | undefined {
  if (linkId !== 'buyMeACoffee' && linkId !== 'githubSponsors') {
    return undefined
  }
  const url = SUPPORT_URLS[linkId].trim()
  return url.length > 0 ? url : undefined
}

export function supportLinkReady(linkId: SupportLinkId): boolean {
  return Boolean(resolveSupportUrl(linkId))
}
