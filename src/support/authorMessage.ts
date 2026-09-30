/** Inbox for Support → Write a message. Delivered by POST; the user’s mail app stays closed. */
export const AUTHOR_MAILBOX = 'l.zzzielinski@gmail.com'

/**
 * FormSubmit rejects a POST with an empty Origin (it treats that like a file:// page).
 * The public repo URL is a stable https origin for that check.
 */
export const AUTHOR_MESSAGE_ORIGIN =
  'https://github.com/Lukasz0303/cursor-cost-tracker'

export function authorMessageEndpoint(): string {
  return `https://formsubmit.co/ajax/${AUTHOR_MAILBOX}`
}

export const AUTHOR_NICKNAME_MAX = 40
export const AUTHOR_BODY_MAX = 2000
export const AUTHOR_EMAIL_MAX = 254

export const AUTHOR_MESSAGE_TOPICS = [
  'comment',
  'feature',
  'bug',
  'other',
] as const

export type AuthorMessageTopic = (typeof AUTHOR_MESSAGE_TOPICS)[number]

export type AuthorMessageDraft = {
  topic: AuthorMessageTopic
  nickname: string
  body: string
  /** Required only for `comment` — permission to publish the note in a later release. */
  consent: boolean
  /** Cursor account address, still sent when the sender does not want a reply. */
  email: string
  /** When false the address is informational and Reply-To is omitted. */
  expectsReply: boolean
}

export function isAuthorSenderEmail(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= AUTHOR_EMAIL_MAX &&
    !/[\r\n]/.test(value) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  )
}

function isTopic(value: unknown): value is AuthorMessageTopic {
  return (
    value === 'comment' ||
    value === 'feature' ||
    value === 'bug' ||
    value === 'other'
  )
}

export function parseAuthorMessage(raw: unknown): AuthorMessageDraft | undefined {
  if (typeof raw !== 'object' || raw === null) {
    return undefined
  }
  const record = raw as {
    topic?: unknown
    nickname?: unknown
    body?: unknown
    consent?: unknown
    email?: unknown
    expectsReply?: unknown
  }
  if (!isTopic(record.topic)) {
    return undefined
  }
  if (typeof record.nickname !== 'string' || typeof record.body !== 'string') {
    return undefined
  }
  const nickname = record.nickname.trim()
  const body = record.body.trim()
  if (
    nickname.length < 1 ||
    nickname.length > AUTHOR_NICKNAME_MAX ||
    /[\r\n]/.test(nickname)
  ) {
    return undefined
  }
  if (body.length < 1 || body.length > AUTHOR_BODY_MAX) {
    return undefined
  }
  const consent = record.consent === true
  if (record.topic === 'comment' && !consent) {
    return undefined
  }
  const email = typeof record.email === 'string' ? record.email.trim() : ''
  if (/[\r\n]/.test(email) || email.length > AUTHOR_EMAIL_MAX) {
    return undefined
  }
  const expectsReply = record.expectsReply === true
  if (expectsReply && !isAuthorSenderEmail(email)) {
    return undefined
  }
  return { topic: record.topic, nickname, body, consent, email, expectsReply }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Local time of the send, included in the mail so the author can copy it onto a published comment. */
export function authorMessageSentStamp(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}` +
    ` ${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
  )
}

/** `Cursor Cost Tracker - Comment` and the same pattern for the other topics. */
export function authorMessageSubject(topicLabel: string): string {
  const label = topicLabel.replace(/[\r\n]/g, ' ').trim()
  return `Cursor Cost Tracker - ${label || 'Message'}`
}

export type AuthorMessageSendResult = {
  ok: boolean
  /** Inbox owner must click FormSubmit’s Activate Form link once. */
  activation: boolean
}

export function authorMessageFields(
  draft: AuthorMessageDraft,
  sentAt: Date,
  topicLabel: string,
): Record<string, string> {
  const message = draft.consent
    ? `${draft.body}\n\nThe sender agreed this comment may appear for everyone in the next extension version after you accept it.`
    : draft.body
  const fields: Record<string, string> = {
    _subject: authorMessageSubject(topicLabel),
    _template: 'box',
    _captcha: 'false',
    nickname: draft.nickname,
    topic: topicLabel,
    sent: authorMessageSentStamp(sentAt),
    publish_consent: draft.consent ? 'yes' : 'no',
    sender_email: draft.email,
    expects_reply: draft.expectsReply ? 'yes' : 'no',
    message,
  }
  if (draft.expectsReply && draft.email) {
    fields._replyto = draft.email
  }
  return fields
}

export async function postAuthorMessage(
  draft: AuthorMessageDraft,
  sentAt: Date,
  topicLabel: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthorMessageSendResult> {
  const response = await fetchImpl(authorMessageEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: AUTHOR_MESSAGE_ORIGIN,
      Referer: `${AUTHOR_MESSAGE_ORIGIN}/`,
    },
    body: JSON.stringify(authorMessageFields(draft, sentAt, topicLabel)),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    return { ok: false, activation: false }
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return { ok: false, activation: false }
  }
  if (typeof payload !== 'object' || payload === null) {
    return { ok: false, activation: false }
  }
  const record = payload as { success?: unknown; message?: unknown }
  const note = typeof record.message === 'string' ? record.message : ''
  if (/activat/i.test(note)) {
    return { ok: false, activation: true }
  }
  const ok = record.success === true || record.success === 'true'
  return { ok, activation: false }
}
