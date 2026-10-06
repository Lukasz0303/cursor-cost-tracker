/** Table-style date, e.g. `1.09.2026` (local timezone). */
export function formatDate(ms: number): string {
  const d = new Date(ms)
  if (!Number.isFinite(d.getTime())) {
    return '—'
  }
  const day = d.getDate()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

/** Table-style datetime, e.g. `1.09.2026, 10:05:12` (local timezone). */
export function formatDateTime(ms: number): string {
  const d = new Date(ms)
  if (!Number.isFinite(d.getTime())) {
    return '—'
  }
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${formatDate(ms)}, ${hours}:${minutes}:${seconds}`
}
