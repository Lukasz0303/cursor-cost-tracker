export const DEFAULT_SPIKE_TOKEN_THRESHOLD = 1_000_000
export const MIN_SPIKE_TOKEN_THRESHOLD = 1_000
export const SPIKE_TOKEN_KILO = 1_000
export const SPIKE_THRESHOLD_KILO_STEP = 100

export function clampSpikeTokenThreshold(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SPIKE_TOKEN_THRESHOLD
  }
  return Math.max(MIN_SPIKE_TOKEN_THRESHOLD, Math.round(value))
}

export function tokensToKilo(tokens: number): number {
  return Math.max(1, Math.round(clampSpikeTokenThreshold(tokens) / SPIKE_TOKEN_KILO))
}

/** Spinner / Apply: 100k steps from 100k up; 1–99k can still be typed manually. */
export function snapKiloThreshold(kilo: number): number {
  if (!Number.isFinite(kilo)) {
    return tokensToKilo(DEFAULT_SPIKE_TOKEN_THRESHOLD)
  }
  const n = Math.round(kilo)
  if (n < 1) {
    return 1
  }
  if (n < SPIKE_THRESHOLD_KILO_STEP) {
    return n
  }
  return Math.round(n / SPIKE_THRESHOLD_KILO_STEP) * SPIKE_THRESHOLD_KILO_STEP
}

export function kiloToTokens(kilo: number): number {
  if (!Number.isFinite(kilo)) {
    return DEFAULT_SPIKE_TOKEN_THRESHOLD
  }
  return clampSpikeTokenThreshold(Math.round(kilo) * SPIKE_TOKEN_KILO)
}

export function isSpike(tokens: number, threshold: number): boolean {
  if (!Number.isFinite(tokens) || !Number.isFinite(threshold)) {
    return false
  }
  return tokens >= threshold
}
