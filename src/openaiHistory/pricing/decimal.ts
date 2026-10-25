/** Fixed-scale money: 6 decimal places, no binary float on the stored value. */
export const MONEY_SCALE = 6
const SCALE_FACTOR = 1_000_000n

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

/** Parse a non-negative decimal string into a scale-6 bigint. */
export function parseDecimal(value: string): bigint {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed === '.') {
    throw new Error('invalid decimal')
  }
  let sign = 1n
  let body = trimmed
  if (body[0] === '+') {
    body = body.slice(1)
  } else if (body[0] === '-') {
    sign = -1n
    body = body.slice(1)
  }
  const dot = body.indexOf('.')
  const whole = dot === -1 ? body : body.slice(0, dot)
  const frac = dot === -1 ? '' : body.slice(dot + 1)
  if (whole === '' && frac === '') {
    throw new Error('invalid decimal')
  }
  for (const ch of whole) {
    if (!isDigit(ch)) {
      throw new Error('invalid decimal')
    }
  }
  for (const ch of frac) {
    if (!isDigit(ch)) {
      throw new Error('invalid decimal')
    }
  }
  const wholePart = whole === '' ? 0n : BigInt(whole)
  const padded = (frac + '000000').slice(0, MONEY_SCALE)
  const fracPart = padded === '' ? 0n : BigInt(padded)
  return sign * (wholePart * SCALE_FACTOR + fracPart)
}

/** Canonical scale-6 decimal string (always 6 fractional digits). */
export function formatDecimal(scaled: bigint): string {
  const sign = scaled < 0n ? '-' : ''
  const abs = scaled < 0n ? -scaled : scaled
  const whole = abs / SCALE_FACTOR
  const frac = abs % SCALE_FACTOR
  return `${sign}${whole.toString()}.${frac.toString().padStart(MONEY_SCALE, '0')}`
}

/**
 * `tokens × ratePerMillion / 1_000_000` as a scale-6 decimal string.
 * Rate is dollars per million tokens (e.g. `"2"` or `"0.5"`).
 */
export function multiplyRate(tokens: number, ratePerMillion: string): string {
  if (!Number.isFinite(tokens) || tokens < 0 || !Number.isInteger(tokens)) {
    throw new Error('tokens must be a non-negative integer')
  }
  const rateScaled = parseDecimal(ratePerMillion)
  // cost_micro = tokens * rate / 1e6, with rate already scale-6:
  // tokens * rateScaled / 1e6
  const micro = (BigInt(tokens) * rateScaled) / SCALE_FACTOR
  return formatDecimal(micro)
}

export function addDecimal(a: string, b: string): string {
  return formatDecimal(parseDecimal(a) + parseDecimal(b))
}

/**
 * Display rounding for table cells only. Null → `—`.
 * Non-zero amounts that round to 0.00 → `< $0.01`.
 */
export function formatCostCell(value: string | null): string {
  if (value === null || value.trim() === '') {
    return '—'
  }
  let scaled: bigint
  try {
    scaled = parseDecimal(value)
  } catch {
    return '—'
  }
  if (scaled === 0n) {
    return '$0.00'
  }
  // Round half-away-from-zero to 2 decimal places (scale 2 from scale 6).
  const sign = scaled < 0n ? -1n : 1n
  const abs = scaled < 0n ? -scaled : scaled
  const roundUnit = 10_000n // 0.01 in scale 6
  const half = 5_000n
  const rounded = ((abs + half) / roundUnit) * roundUnit
  if (rounded === 0n) {
    return '< $0.01'
  }
  const asScale2 = rounded / roundUnit
  const whole = asScale2 / 100n
  const frac = asScale2 % 100n
  const body = `${whole.toString()}.${frac.toString().padStart(2, '0')}`
  return sign < 0n ? `-$${body}` : `$${body}`
}
