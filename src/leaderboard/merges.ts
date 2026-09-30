import { normalizeEmail } from '../codeLines/authorChoice'

export function normalizeLeaderboardMerges(value: unknown): string[][] {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const group of value) {
    if (!Array.isArray(group)) {
      continue
    }
    const emails: string[] = []
    for (const item of group) {
      if (typeof item !== 'string') {
        continue
      }
      const email = item.trim()
      const key = normalizeEmail(email)
      if (key === '' || !key.includes('@') || seen.has(key)) {
        continue
      }
      seen.add(key)
      emails.push(email)
    }
    if (emails.length >= 2) {
      groups.push(emails)
    }
  }
  return groups
}
