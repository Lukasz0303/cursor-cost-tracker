const TEAM_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeTeamEmails(value: unknown): string[] {
  const list = Array.isArray(value) ? value : []
  const seen = new Set<string>()
  const emails: string[] = []
  for (const item of list) {
    if (typeof item !== 'string') {
      continue
    }
    const email = item.trim()
    const key = email.toLowerCase()
    if (!TEAM_EMAIL.test(email) || seen.has(key)) {
      continue
    }
    seen.add(key)
    emails.push(email)
  }
  return emails
}
