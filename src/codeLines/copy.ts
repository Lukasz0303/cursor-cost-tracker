import type { CodeLinesSource } from './types'
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
