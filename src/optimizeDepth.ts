/** Depth of the Optimize prompt (Quick / Balanced / Deep). */
export type OptimizeDepth = 'quick' | 'balanced' | 'deep'

export const DEFAULT_OPTIMIZE_DEPTH: OptimizeDepth = 'balanced'

export const OPTIMIZE_DEPTHS: OptimizeDepth[] = ['quick', 'balanced', 'deep']

export function parseOptimizeDepth(value: unknown): OptimizeDepth {
  if (value === 'quick' || value === 'deep' || value === 'balanced') {
    return value
  }
  return DEFAULT_OPTIMIZE_DEPTH
}

export function optimizeDepthLabel(depth: OptimizeDepth): string {
  if (depth === 'quick') {
    return 'Quick'
  }
  if (depth === 'deep') {
    return 'Deep'
  }
  return 'Balanced'
}
