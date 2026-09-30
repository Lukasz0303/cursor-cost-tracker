import { createHmac, timingSafeEqual } from 'node:crypto'

export const LEADERBOARD_UNLOCK_STATE_KEY = 'cursorCost.leaderboardUnlocked'

const TOKEN_PREFIX = 'CCT'
const TOKEN_GROUPS = 3
const TOKEN_GROUP_LENGTH = 4
const TOKEN_BODY_LENGTH = TOKEN_GROUPS * TOKEN_GROUP_LENGTH

/** Crockford base32: no I, L, O or U, so a hand-copied code cannot be misread. */
const TOKEN_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Bumping this invalidates every code already handed out. */
const TOKEN_DOMAIN = 'cct-leaderboard:v1'

const REQUEST_PATTERN = /^\s*unlock\s*:\s*([0-9a-z\s-]{6,64})\s*$/i

export function normalizeUnlockEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Strips the dashes and casing a user may have changed while copying the code. */
export function normalizeUnlockToken(raw: string): string {
  return raw.replace(/[^0-9a-z]/gi, '').toUpperCase()
}

function tokenBody(email: string, secret: string): string {
  const digest = createHmac('sha256', secret)
    .update(`${TOKEN_DOMAIN}:${normalizeUnlockEmail(email)}`)
    .digest()
  let body = ''
  for (let i = 0; i < TOKEN_BODY_LENGTH; i += 1) {
    const byte = digest[i] ?? 0
    body += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length] ?? '0'
  }
  return body
}

export function unlockTokenFor(email: string, secret: string): string {
  const body = tokenBody(email, secret)
  const groups: string[] = [TOKEN_PREFIX]
  for (let i = 0; i < TOKEN_GROUPS; i += 1) {
    groups.push(body.slice(i * TOKEN_GROUP_LENGTH, (i + 1) * TOKEN_GROUP_LENGTH))
  }
  return groups.join('-')
}

export function verifyUnlockToken(
  email: string,
  token: string,
  secret: string,
): boolean {
  const normalizedEmail = normalizeUnlockEmail(email)
  if (normalizedEmail.length === 0) {
    return false
  }
  const candidate = Buffer.from(normalizeUnlockToken(token), 'utf8')
  const expected = Buffer.from(
    normalizeUnlockToken(unlockTokenFor(normalizedEmail, secret)),
    'utf8',
  )
  if (candidate.length !== expected.length) {
    return false
  }
  return timingSafeEqual(candidate, expected)
}

/** Returns the pasted code when the message body is an unlock request, otherwise null. */
export function parseUnlockRequest(body: unknown): string | null {
  if (typeof body !== 'string') {
    return null
  }
  const match = REQUEST_PATTERN.exec(body)
  if (!match) {
    return null
  }
  const token = normalizeUnlockToken(match[1] ?? '')
  if (token.length !== TOKEN_PREFIX.length + TOKEN_BODY_LENGTH) {
    return null
  }
  return token
}

export type LeaderboardUnlockState = {
  unlocked: true
  /** Short HMAC of the account the code was issued for; never the address itself. */
  emailHash: string
  at: number
}

export function unlockStateFor(
  email: string,
  secret: string,
  at: number,
): LeaderboardUnlockState {
  const emailHash = createHmac('sha256', secret)
    .update(`${TOKEN_DOMAIN}:hash:${normalizeUnlockEmail(email)}`)
    .digest('hex')
    .slice(0, 16)
  return { unlocked: true, emailHash, at }
}

export function isLeaderboardUnlocked(raw: unknown): boolean {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as { unlocked?: unknown }).unlocked === true
  )
}
