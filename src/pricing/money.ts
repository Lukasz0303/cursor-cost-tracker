/**
 * "$2" / "$0.20" / "2" → dollars per million tokens.
 * Null if the cell is not a plain price.
 */
export function pricePerMillion(cell: string | null): number | null {
  if (cell === null) {
    return null
  }
  const trimmed = cell.trim()
  if (trimmed === '' || trimmed === '-' || trimmed === '—') {
    return null
  }
  if (/[a-zA-Z]/.test(trimmed.replace(/^\$/, ''))) {
    return null
  }
  const numeric = trimmed.replace(/^\$/, '').replace(/,/g, '')
  if (numeric === '' || !/^\d+(\.\d+)?$/.test(numeric)) {
    return null
  }
  const value = Number(numeric)
  if (!Number.isFinite(value)) {
    return null
  }
  return value
}
