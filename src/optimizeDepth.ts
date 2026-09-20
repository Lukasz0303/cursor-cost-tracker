/** Depth of the Optimize prompt (Quick / Balanced / Deep). */
import { catalogFor } from './i18n'
import { DEFAULT_LOCALE, type Locale } from './locale'

export type OptimizeDepth = 'quick' | 'balanced' | 'deep'

export const DEFAULT_OPTIMIZE_DEPTH: OptimizeDepth = 'balanced'

export const OPTIMIZE_DEPTHS: OptimizeDepth[] = ['quick', 'balanced', 'deep']

export function parseOptimizeDepth(value: unknown): OptimizeDepth {
  if (value === 'quick' || value === 'deep' || value === 'balanced') {
    return value
  }
  return DEFAULT_OPTIMIZE_DEPTH
}

export function optimizeDepthLabel(
  depth: OptimizeDepth,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const copy = catalogFor(locale).depth
  if (depth === 'quick') {
    return copy.quick
  }
  if (depth === 'deep') {
    return copy.deep
  }
  return copy.balanced
}
