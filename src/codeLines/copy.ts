import type { CodeLinesSource } from './types'
import type { LineDollarRates } from './dollarsPerLine'
import { formatDollars } from '../format'
import { catalogFor, interpolate } from '../i18n'
import { DEFAULT_LOCALE, localeBcp47, type Locale } from '../locale'

export function codeLinesDisclaimer(
  source: CodeLinesSource,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const copy = catalogFor(locale).codeLines
  switch (source) {
    case 'headers':
      return copy.headers
    case 'checkpoints':
      return copy.checkpoints
    case 'edits':
      return copy.edits
    case 'git-only':
      return copy.gitOnly
    case 'unavailable':
      return copy.unavailable
  }
}

/**
 * One localized line for the coding-stats card.
 * Empty when neither rate is available — caller omits the row (no "— / —").
 */
export function lineDollarsSummary(
  rates: LineDollarRates,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const copy = catalogFor(locale).codeLines
  const parts: string[] = []
  if (rates.usdPerLandedLine !== null) {
    parts.push(
      interpolate(copy.perLandedLine, {
        amount: formatDollars(rates.usdPerLandedLine),
      }),
    )
  }
  if (rates.usdPerAiLine !== null) {
    parts.push(
      interpolate(copy.perAiLine, {
        amount: formatDollars(rates.usdPerAiLine),
      }),
    )
  }
  if (parts.length === 0) {
    return ''
  }
  return parts.join(copy.rateJoin)
}

export function formatLineCount(
  n: number | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (n === null || !Number.isFinite(n)) {
    return '—'
  }
  return Math.trunc(n).toLocaleString(localeBcp47(locale))
}

export function formatPercentRate(
  ratio: number | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (ratio === null || !Number.isFinite(ratio)) {
    return '—'
  }
  return interpolate(catalogFor(locale).codeLines.landed, {
    n: Math.round(ratio * 100),
  })
}

export function formatEffectiveness(
  ratio: number | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return formatPercentRate(ratio, locale)
}
