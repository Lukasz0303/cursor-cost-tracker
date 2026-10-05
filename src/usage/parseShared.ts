import type { UsagePool } from './types'

const DOLLAR_STRING = /[^0-9.+-]/g

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null
    }
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

export function centsToUsd(cents: number): number {
  if (!Number.isFinite(cents)) {
    return 0
  }
  return cents / 100
}

export function readEnabled(raw: Record<string, unknown>): boolean {
  return raw.enabled !== false
}

export function poolUsedCents(raw: Record<string, unknown>): number | null {
  return asFiniteNumber(raw.usedCents) ?? asFiniteNumber(raw.used)
}

export function poolLimitCents(raw: Record<string, unknown>): number | null {
  return asFiniteNumber(raw.limitCents) ?? asFiniteNumber(raw.limit)
}

export function readMoneyPool(
  raw: unknown,
  source: UsagePool['source'],
): UsagePool | null {
  if (!isRecord(raw) || !readEnabled(raw)) {
    return null
  }

  const used = poolUsedCents(raw)
  const limit = poolLimitCents(raw)
  if (used === null && limit === null) {
    return null
  }

  const remaining =
    asFiniteNumber(raw.remainingCents) ?? asFiniteNumber(raw.remaining)

  return {
    usedCents: used ?? 0,
    limitCents: limit,
    remainingCents: remaining,
    source,
  }
}

export function parseDollarString(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  const numeric = Number(trimmed.replace(DOLLAR_STRING, ''))
  if (!Number.isFinite(numeric)) {
    return null
  }
  return numeric
}
