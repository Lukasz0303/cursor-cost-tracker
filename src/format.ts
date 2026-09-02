const KIND_PREFIX = /^USAGE_EVENT_KIND_/i

const TOKEN_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

const DOLLAR_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatDollars(n: number): string {
  const value = Number.isFinite(n) ? n : 0
  return `${DOLLAR_FORMAT.format(value)} $`
}

export function formatPercentUsed(percent: number): string {
  const value = Number.isFinite(percent) ? Math.max(0, Math.round(percent)) : 0
  return `${value}%`
}

export function formatTokens(n: number): string {
  const value = Number.isFinite(n) ? Math.round(n) : 0
  return TOKEN_FORMAT.format(value)
}

/** Compact status-bar tokens: 64.8k / 1.2M, matching the dashboard chips. */
export function formatCompactTokens(n: number): string {
  const value = Number.isFinite(n) ? Math.max(0, n) : 0
  if (value < 1000) {
    return String(Math.round(value))
  }
  if (value < 1_000_000) {
    return `${oneDecimal(value / 1000)}k`
  }
  return `${oneDecimal(value / 1_000_000)}M`
}

function oneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1)
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms)
  if (!Number.isFinite(d.getTime())) {
    return '—'
  }
  const day = d.getDate()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`
}

export function formatKind(kind: string | null): string {
  if (kind === null || kind.trim() === '') {
    return '—'
  }
  const stripped = kind.trim().replace(KIND_PREFIX, '')
  const humanized = stripped
    .split(/[_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
  return humanized === '' ? '—' : humanized
}

export function isoDayLabel(iso: string | null): string | null {
  if (iso === null || iso === '') {
    return null
  }
  const day = iso.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : iso
}

export function cycleResetLabel(endIso: string | null, now: Date): string | null {
  if (endIso === null || endIso === '') {
    return null
  }
  const end = new Date(endIso)
  if (!Number.isFinite(end.getTime())) {
    return null
  }
  const dateLabel = isoDayLabel(endIso)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const days = Math.round(
    (startOfEnd.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000),
  )
  if (days < 0) {
    return dateLabel ? `Cycle ended ${dateLabel}` : 'Cycle ended'
  }
  if (days === 0) {
    return dateLabel ? `Resets today (${dateLabel})` : 'Resets today'
  }
  if (days === 1) {
    return dateLabel ? `Resets in 1 day (${dateLabel})` : 'Resets in 1 day'
  }
  return dateLabel
    ? `Resets in ${days} days (${dateLabel})`
    : `Resets in ${days} days`
}
