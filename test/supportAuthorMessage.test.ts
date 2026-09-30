import { describe, expect, it } from 'vitest'
import {
  AUTHOR_MAILBOX,
  AUTHOR_MESSAGE_ORIGIN,
  authorMessageFields,
  authorMessageSentStamp,
  authorMessageSubject,
  parseAuthorMessage,
  postAuthorMessage,
} from '../src/support/authorMessage'
import { nicknameFromCursorEmail } from '../src/support/nickname'

describe('nicknameFromCursorEmail', () => {
  it('uses the mailbox local-part', () => {
    expect(nicknameFromCursorEmail('l.zzzielinski@gmail.com')).toBe(
      'l.zzzielinski',
    )
  })

  it('keeps the GitHub login from a noreply address', () => {
    expect(
      nicknameFromCursorEmail(
        '60180635+Lukasz0303@users.noreply.github.com',
      ),
    ).toBe('Lukasz0303')
  })

  it('returns empty when Cursor has no email', () => {
    expect(nicknameFromCursorEmail(null)).toBe('')
    expect(nicknameFromCursorEmail('not-an-email')).toBe('')
  })
})

describe('parseAuthorMessage', () => {
  it('requires publish consent only for a comment', () => {
    expect(
      parseAuthorMessage({
        topic: 'comment',
        nickname: 'ada',
        body: 'Thanks',
        consent: false,
      }),
    ).toBeUndefined()
    expect(
      parseAuthorMessage({
        topic: 'bug',
        nickname: 'ada',
        body: 'The meter stuck',
        consent: false,
      })?.topic,
    ).toBe('bug')
  })

  it('rejects a missing topic or an empty body', () => {
    expect(
      parseAuthorMessage({
        topic: 'other',
        nickname: 'ada',
        body: '   ',
        consent: false,
      }),
    ).toBeUndefined()
    expect(
      parseAuthorMessage({
        nickname: 'ada',
        body: 'Hi',
        consent: true,
      }),
    ).toBeUndefined()
  })
})

describe('postAuthorMessage', () => {
  it('posts to the author with subject Cursor Cost Tracker - the chosen type', async () => {
    const draft = parseAuthorMessage({
      topic: 'comment',
      nickname: 'ada',
      body: 'Clear status bar',
      consent: true,
    })
    expect(draft).toBeDefined()
    if (!draft) {
      return
    }
    const sentAt = new Date(2026, 8, 26, 18, 53)
    let requestedUrl = ''
    let requestedBody = ''
    let origin = ''
    const result = await postAuthorMessage(
      draft,
      sentAt,
      'Comment',
      (async (url, init) => {
        requestedUrl = String(url)
        requestedBody = String(init?.body ?? '')
        origin = new Headers(init?.headers).get('Origin') ?? ''
        return new Response(JSON.stringify({ success: 'true' }), { status: 200 })
      }) as typeof fetch,
    )
    expect(result).toEqual({ ok: true, activation: false })
    expect(requestedUrl).toBe(`https://formsubmit.co/ajax/${AUTHOR_MAILBOX}`)
    expect(origin).toBe(AUTHOR_MESSAGE_ORIGIN)
    const fields = JSON.parse(requestedBody) as { _subject: string; message: string; sent: string }
    expect(fields._subject).toBe(authorMessageSubject('Comment'))
    expect(fields._subject).toBe('Cursor Cost Tracker - Comment')
    expect(fields.sent).toBe(authorMessageSentStamp(sentAt))
    expect(fields.message).toContain('Clear status bar')
    expect(fields.message).toContain('next extension version')
    expect(fields.message).not.toContain('@')
  })

  it('requires an email only when a reply is expected', () => {
    expect(
      parseAuthorMessage({
        topic: 'bug',
        nickname: 'ada',
        body: 'Meter stuck',
        consent: false,
        expectsReply: true,
        email: 'not-an-email',
      }),
    ).toBeUndefined()
    const draft = parseAuthorMessage({
      topic: 'bug',
      nickname: 'ada',
      body: 'Meter stuck',
      consent: false,
      expectsReply: false,
      email: 'ada@example.com',
    })
    expect(draft?.email).toBe('ada@example.com')
    expect(draft?.expectsReply).toBe(false)
    if (!draft) {
      return
    }
    const fields = authorMessageFields(draft, new Date(2026, 8, 26, 18, 53), 'Bug report')
    expect(fields.sender_email).toBe('ada@example.com')
    expect(fields.expects_reply).toBe('no')
    expect(fields._replyto).toBeUndefined()
  })

  it('sets Reply-To when the sender expects an answer', () => {
    const draft = parseAuthorMessage({
      topic: 'feature',
      nickname: 'ada',
      body: 'A meter',
      consent: false,
      expectsReply: true,
      email: 'ada@example.com',
    })
    expect(draft).toBeDefined()
    if (!draft) {
      return
    }
    const fields = authorMessageFields(draft, new Date(2026, 8, 26, 18, 53), 'New feature')
    expect(fields._replyto).toBe('ada@example.com')
    expect(fields.expects_reply).toBe('yes')
  })

  it('adds the publish note only when consent is checked', () => {
    const sentAt = new Date(2026, 8, 26, 18, 53)
    const withConsent = parseAuthorMessage({
      topic: 'feature',
      nickname: 'ada',
      body: 'A meter',
      consent: true,
    })
    const without = parseAuthorMessage({
      topic: 'bug',
      nickname: 'ada',
      body: 'Stuck',
      consent: false,
    })
    expect(withConsent).toBeDefined()
    expect(without).toBeDefined()
    if (!withConsent || !without) {
      return
    }
    expect(authorMessageFields(withConsent, sentAt, 'New feature').message).toContain(
      'next extension version',
    )
    expect(authorMessageFields(without, sentAt, 'Bug report').message).toBe('Stuck')
  })

  it('reports the one-time inbox activation', async () => {
    const draft = parseAuthorMessage({
      topic: 'bug',
      nickname: 'ada',
      body: 'Meter stuck',
      consent: false,
    })
    expect(draft).toBeDefined()
    if (!draft) {
      return
    }
    const result = await postAuthorMessage(
      draft,
      new Date(),
      'Bug report',
      (async () =>
        new Response(
          JSON.stringify({
            success: 'false',
            message: "This form needs Activation. We've sent you an email.",
          }),
          { status: 200 },
        )) as typeof fetch,
    )
    expect(result.ok).toBe(false)
    expect(result.activation).toBe(true)
    expect(authorMessageSubject('Bug report')).toBe(
      'Cursor Cost Tracker - Bug report',
    )
  })
})
