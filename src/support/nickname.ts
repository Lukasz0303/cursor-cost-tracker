import { AUTHOR_NICKNAME_MAX } from './authorMessage'

/**
 * Cursor stores the account email (`cursorAuth/cachedEmail`), not a display name.
 * The mailbox local-part is the nickname. GitHub noreply addresses keep the login
 * after `+`.
 */
export function nicknameFromCursorEmail(
  email: string | null | undefined,
): string {
  const trimmed = email?.trim() ?? ''
  const at = trimmed.lastIndexOf('@')
  if (at <= 0 || at === trimmed.length - 1) {
    return ''
  }
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1).toLowerCase()
  const raw =
    domain === 'users.noreply.github.com'
      ? local.slice(local.lastIndexOf('+') + 1)
      : local
  const name = raw.trim()
  if (name.length === 0 || /[\r\n\t]/.test(name)) {
    return ''
  }
  return name.slice(0, AUTHOR_NICKNAME_MAX)
}
