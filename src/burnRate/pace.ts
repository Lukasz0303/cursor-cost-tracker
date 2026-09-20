import type { UsageQuery } from '../usage/types'

export const MAX_PACE_BUCKETS = 24
export const MIN_PACE_BUCKETS = 3
export const MIN_NORMAL_USD = 0.01

export function medianUsd(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  const right = sorted[mid]
  if (right === undefined) {
    return null
  }
  if (sorted.length % 2 === 1) {
    return right
  }
  const left = sorted[mid - 1]
  if (left === undefined) {
    return right
  }
  return Math.round(((left + right) / 2) * 100) / 100
}

export function normalWindowUsd(
  queries: readonly UsageQuery[],
  windowMs: number,
  liveStartMs: number,
  minQueries: number,
): number | null {
  if (windowMs <= 0) {
    return null
  }
  const historic = queries.filter((query) => query.timestamp < liveStartMs)
  const bucketCosts: number[] = []
  for (let index = 0; index < MAX_PACE_BUCKETS; index += 1) {
    const bucketEnd = liveStartMs - index * windowMs
    const bucketStart = bucketEnd - windowMs
    let count = 0
    let costUsd = 0
    for (const query of historic) {
      if (query.timestamp < bucketStart || query.timestamp >= bucketEnd) {
        continue
      }
      count += 1
      costUsd += query.costUsd
    }
    if (count >= minQueries) {
      bucketCosts.push(costUsd)
    }
  }
  if (bucketCosts.length < MIN_PACE_BUCKETS) {
    return null
  }
  return medianUsd(bucketCosts)
}

export function burnMultiplier(
  liveCostUsd: number,
  normalUsd: number | null,
): number | null {
  if (normalUsd === null || normalUsd < MIN_NORMAL_USD) {
    return null
  }
  if (!Number.isFinite(liveCostUsd)) {
    return null
  }
  return liveCostUsd / normalUsd
}
