import {
  escapeGitAuthorPattern,
  githubLoginFromNoreplyEmail,
} from './gitAuthor'

export const CODE_LINES_AUTHORS_STATE_KEY = 'cursorCost.codeLinesAuthors'

export type GitBranchAuthor = {
  email: string
  name: string
}

export type CodeLinesAuthorAccount = {
  email: string
  name: string
  selected: boolean
  cursorAccount: boolean
}

export type CodeLinesAuthorChoice = {
  accounts: CodeLinesAuthorAccount[]
  sumMultiple: boolean
}

export type StoredAuthorChoice = {
  emails: string[]
  sumMultiple: boolean
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function emailsMatch(left: string, right: string): boolean {
  const a = normalizeEmail(left)
  const b = normalizeEmail(right)
  return a !== '' && a === b
}

/** `Name<TAB>email` lines from `git log --format=%an%x09%ae`. */
export function parseGitAuthorPorcelain(raw: string): GitBranchAuthor[] {
  const byEmail = new Map<string, GitBranchAuthor>()
  for (const line of raw.split(/\r?\n/)) {
    const tab = line.indexOf('\t')
    if (tab <= 0) {
      continue
    }
    const name = line.slice(0, tab).trim()
    const email = line.slice(tab + 1).trim()
    if (email === '' || !email.includes('@')) {
      continue
    }
    const key = normalizeEmail(email)
    if (byEmail.has(key)) {
      continue
    }
    byEmail.set(key, { name: name === '' ? email : name, email })
  }
  return [...byEmail.values()].sort((a, b) =>
    a.email.localeCompare(b.email, undefined, { sensitivity: 'base' }),
  )
}

export function parseStoredAuthorChoice(raw: unknown): StoredAuthorChoice | null {
  if (typeof raw !== 'object' || raw === null) {
    return null
  }
  const emailsRaw = (raw as { emails?: unknown }).emails
  if (!Array.isArray(emailsRaw)) {
    return null
  }
  const emails: string[] = []
  const seen = new Set<string>()
  for (const item of emailsRaw) {
    if (typeof item !== 'string') {
      continue
    }
    const email = item.trim()
    const key = normalizeEmail(email)
    if (email === '' || !email.includes('@') || seen.has(key)) {
      continue
    }
    seen.add(key)
    emails.push(email)
  }
  return {
    emails,
    sumMultiple: (raw as { sumMultiple?: unknown }).sumMultiple === true,
  }
}

function withCursorAuthor(
  authors: readonly GitBranchAuthor[],
  cursorEmail: string | null,
): GitBranchAuthor[] {
  const email = cursorEmail?.trim() ?? ''
  if (email === '' || !email.includes('@')) {
    return [...authors]
  }
  if (authors.some((row) => emailsMatch(row.email, email))) {
    return [...authors]
  }
  return [{ name: email, email }, ...authors]
}

export function defaultSelectedEmails(
  authors: readonly GitBranchAuthor[],
  cursorEmail: string | null,
): string[] {
  const email = cursorEmail?.trim() ?? ''
  if (email === '' || !email.includes('@')) {
    return []
  }
  const hit = authors.find((row) => emailsMatch(row.email, email))
  return [hit?.email ?? email]
}

export function resolveAuthorChoice(input: {
  authors: readonly GitBranchAuthor[]
  cursorEmail: string | null
  saved: StoredAuthorChoice | null
}): CodeLinesAuthorChoice {
  const authors = withCursorAuthor(input.authors, input.cursorEmail)
  const cursorEmail = input.cursorEmail?.trim() || null
  const allowed = new Set(authors.map((row) => normalizeEmail(row.email)))
  const fallback = defaultSelectedEmails(authors, cursorEmail)
  const sumMultiple = input.saved?.sumMultiple === true
  const savedEmails = (input.saved?.emails ?? []).filter((email) =>
    allowed.has(normalizeEmail(email)),
  )
  let selected = savedEmails.length > 0 ? savedEmails : fallback
  if (!sumMultiple && selected.length > 1) {
    const cursorHit = selected.find(
      (email) => cursorEmail !== null && emailsMatch(email, cursorEmail),
    )
    selected = [cursorHit ?? selected[0] ?? '']
    selected = selected.filter((email) => email !== '')
  }
  if (selected.length === 0) {
    selected = fallback
  }
  const selectedKeys = new Set(selected.map(normalizeEmail))
  return {
    sumMultiple,
    accounts: authors.map((row) => ({
      email: row.email,
      name: row.name,
      selected: selectedKeys.has(normalizeEmail(row.email)),
      cursorAccount:
        cursorEmail !== null && emailsMatch(row.email, cursorEmail),
    })),
  }
}

export function selectedAuthorEmails(
  choice: CodeLinesAuthorChoice,
): string[] {
  return choice.accounts.filter((row) => row.selected).map((row) => row.email)
}

/** `--author` for the emails the user (or Cursor default) picked. No org remote. */
export function gitAuthorLogArgsForEmails(
  emails: readonly string[],
): string[] {
  const seen = new Set<string>()
  const args: string[] = []
  const addPattern = (pattern: string): void => {
    if (pattern === '' || seen.has(pattern)) {
      return
    }
    seen.add(pattern)
    args.push(`--author=${pattern}`)
  }
  for (const raw of emails) {
    const email = raw.trim()
    if (email === '' || !email.includes('@')) {
      continue
    }
    addPattern(`<${escapeGitAuthorPattern(email)}>`)
    const login = githubLoginFromNoreplyEmail(email)
    if (login === null) {
      continue
    }
    const escaped = escapeGitAuthorPattern(login)
    addPattern(`${escaped}@users\\.noreply\\.github\\.com`)
    addPattern(`^${escaped} <`)
  }
  return args
}

export function mergeAuthorChoices(
  parts: readonly CodeLinesAuthorChoice[],
): CodeLinesAuthorChoice {
  const byEmail = new Map<string, CodeLinesAuthorAccount>()
  let sumMultiple = false
  for (const part of parts) {
    if (part.sumMultiple) {
      sumMultiple = true
    }
    for (const row of part.accounts) {
      const key = normalizeEmail(row.email)
      const prev = byEmail.get(key)
      if (prev === undefined) {
        byEmail.set(key, { ...row })
        continue
      }
      prev.selected = prev.selected || row.selected
      prev.cursorAccount = prev.cursorAccount || row.cursorAccount
    }
  }
  return {
    sumMultiple,
    accounts: [...byEmail.values()],
  }
}
