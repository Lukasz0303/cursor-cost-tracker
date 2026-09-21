import { describe, expect, it } from 'vitest'
import {
  defaultSelectedEmails,
  gitAuthorLogArgsForEmails,
  parseGitAuthorPorcelain,
  parseStoredAuthorChoice,
  resolveAuthorChoice,
} from '../src/codeLines/authorChoice'

describe('parseGitAuthorPorcelain', () => {
  it('dedupes by email and skips junk', () => {
    expect(
      parseGitAuthorPorcelain(
        [
          'Ada\ta@x.com',
          'Ada Lovelace\ta@x.com',
          'Bob\tb@acme.com',
          'not-an-author-line',
          '',
        ].join('\n'),
      ),
    ).toEqual([
      { name: 'Ada', email: 'a@x.com' },
      { name: 'Bob', email: 'b@acme.com' },
    ])
  })
})

describe('defaultSelectedEmails', () => {
  it('picks the Cursor account email only', () => {
    expect(
      defaultSelectedEmails(
        [
          { name: 'Jane', email: 'jane@acme.com' },
          { name: 'Bob', email: 'bob@acme.com' },
        ],
        'Jane@acme.com',
      ),
    ).toEqual(['jane@acme.com'])
  })

  it('keeps the Cursor email even when it is not in git log yet', () => {
    expect(defaultSelectedEmails([], 'me@cursor.com')).toEqual([
      'me@cursor.com',
    ])
  })
})

describe('resolveAuthorChoice', () => {
  const authors = [
    { name: 'Jane', email: 'jane@acme.com' },
    { name: 'Bob', email: 'bob@acme.com' },
    { name: 'JaneHub', email: '1+JaneHub@users.noreply.github.com' },
  ]

  it('defaults to the Cursor email and not teammates', () => {
    const choice = resolveAuthorChoice({
      authors,
      cursorEmail: 'jane@acme.com',
      saved: null,
    })
    expect(choice.sumMultiple).toBe(false)
    expect(
      choice.accounts.filter((row) => row.selected).map((row) => row.email),
    ).toEqual(['jane@acme.com'])
    expect(
      choice.accounts.find((row) => row.email === 'jane@acme.com')?.cursorAccount,
    ).toBe(true)
  })

  it('sums only saved emails when sumMultiple is on', () => {
    const choice = resolveAuthorChoice({
      authors,
      cursorEmail: 'jane@acme.com',
      saved: {
        emails: ['jane@acme.com', '1+JaneHub@users.noreply.github.com', 'eve@x.com'],
        sumMultiple: true,
      },
    })
    expect(choice.sumMultiple).toBe(true)
    expect(
      choice.accounts.filter((row) => row.selected).map((row) => row.email),
    ).toEqual(['jane@acme.com', '1+JaneHub@users.noreply.github.com'])
  })

  it('collapses to one account when sumMultiple is off', () => {
    const choice = resolveAuthorChoice({
      authors,
      cursorEmail: 'jane@acme.com',
      saved: {
        emails: ['bob@acme.com', 'jane@acme.com'],
        sumMultiple: false,
      },
    })
    expect(
      choice.accounts.filter((row) => row.selected).map((row) => row.email),
    ).toEqual(['jane@acme.com'])
  })
})

describe('parseStoredAuthorChoice', () => {
  it('returns null for garbage', () => {
    expect(parseStoredAuthorChoice(null)).toBeNull()
    expect(parseStoredAuthorChoice({ emails: 'jane' })).toBeNull()
  })
})

describe('gitAuthorLogArgsForEmails', () => {
  it('uses the email field and noreply login, never a bare org', () => {
    expect(
      gitAuthorLogArgsForEmails([
        'jane@acme.com',
        '9+JaneHub@users.noreply.github.com',
      ]),
    ).toEqual([
      '--author=<jane@acme\\.com>',
      '--author=<9\\+JaneHub@users\\.noreply\\.github\\.com>',
      '--author=JaneHub@users\\.noreply\\.github\\.com',
      '--author=^JaneHub <',
    ])
    expect(
      gitAuthorLogArgsForEmails(['jane@acme.com']).some(
        (arg) => arg === '--author=Acme' || arg === '--author=jane@acme.com',
      ),
    ).toBe(false)
  })
})
