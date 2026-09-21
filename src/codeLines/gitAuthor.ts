/** Local git identity used as `--author` (regex). Never send to the webview. */
export type GitAuthorIdentity = {
  email: string | null
  name: string | null
}

export function parseGitConfigValue(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed === '' ? null : trimmed
}

/** Escape a git `--author` regex so `user@x.com` does not match `user@xXcom`. */
export function escapeGitAuthorPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Login from `123+Login@users.noreply.github.com` or
 * `Login@users.noreply.github.com`.
 */
export function githubLoginFromNoreplyEmail(email: string | null): string | null {
  const trimmed = email?.trim() ?? ''
  if (trimmed === '') {
    return null
  }
  const match =
    /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i.exec(trimmed)
  const login = match?.[1]?.trim() ?? ''
  return login === '' ? null : login
}

/** Owner from `git@github.com:Login/repo.git` or `https://github.com/Login/repo.git`. */
export function githubLoginFromRemoteUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return null
  }
  const match = /github\.com[:/]([^/]+)\/[^/]+/i.exec(trimmed)
  const login = match?.[1]?.trim() ?? ''
  if (login === '' || login === 'git') {
    return null
  }
  return login
}

function uniqueLogins(
  githubLogin: string | readonly string[] | null | undefined,
): string[] {
  const raw =
    githubLogin == null
      ? []
      : typeof githubLogin === 'string'
        ? [githubLogin]
        : [...githubLogin]
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const value = item?.trim() ?? ''
    if (value === '') {
      continue
    }
    const key = value.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(value)
  }
  return out
}

/**
 * `--author` patterns for this git user. Git ORs multiple flags.
 *
 * Use `<email>` (the email field) and GitHub login only as noreply /
 * exact author name (`^Login <`). Never emit a bare `--author=Org` —
 * that matches every teammate `@org.com`. GitHub merge commits on a
 * personal repo are `Login <id+Login@users.noreply.github.com>`.
 */
export function gitAuthorLogArgs(
  identity: GitAuthorIdentity,
  githubLogin: string | readonly string[] | null = null,
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

  const email = identity.email?.trim() || null
  if (email !== null) {
    addPattern(`<${escapeGitAuthorPattern(email)}>`)
  }

  const logins = uniqueLogins([
    ...uniqueLogins(githubLogin),
    githubLoginFromNoreplyEmail(email) ?? '',
  ])
  for (const login of logins) {
    const escaped = escapeGitAuthorPattern(login)
    addPattern(`${escaped}@users\\.noreply\\.github\\.com`)
    addPattern(`^${escaped} <`)
  }

  const name = identity.name?.trim() ?? ''
  if (name !== '') {
    const escaped = escapeGitAuthorPattern(name)
    addPattern(`^${escaped} <`)
  }
  return args
}
