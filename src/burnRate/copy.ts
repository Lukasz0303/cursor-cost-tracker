import {
  formatCompactTokens,
  formatDollars,
} from '../format'
import { catalogFor, interpolate } from '../i18n'
import { DEFAULT_LOCALE, type Locale } from '../locale'
import type { UsageQuery } from '../usage/types'
import {
  evaluateBurnRate,
  type BurnRateEpisode,
  type BurnRateLevel,
} from './detect'
import type { BurnRateWindow } from './window'

export type BurnRatePayload = {
  level: BurnRateLevel
  costUsd: number
  tokens: number
  queryCount: number
  windowMinutes: number
  multiplier: number | null
  todayUsd: number | null
  percent: number
  summary: string
  paceLabel: string | null
  mixLabel: string
  todayLabel: string | null
  bannerTitle: string | null
  bannerBody: string | null
}

function durationMinutes(
  oldestMs: number | undefined,
  nowMs: number,
  windowMinutes: number,
  queryCount: number,
): number {
  if (queryCount <= 0 || oldestMs === undefined) {
    return Math.max(1, windowMinutes)
  }
  return Math.max(1, Math.round((nowMs - oldestMs) / 60_000))
}

export function burstMinutes(
  window: BurnRateWindow,
  nowMs: number,
  windowMinutes: number,
): number {
  const oldest = window.queries[window.queries.length - 1]
  return durationMinutes(
    oldest?.timestamp,
    nowMs,
    windowMinutes,
    window.queryCount,
  )
}

export function formatMultiplier(value: number): string {
  if (!Number.isFinite(value)) {
    return '0'
  }
  const tenths = Math.round(value * 10) / 10
  if (Math.abs(tenths - Math.round(tenths)) < 0.05) {
    return String(Math.round(tenths))
  }
  return tenths.toFixed(1)
}

export function formatPaceLabel(
  multiplier: number | null,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  if (multiplier === null) {
    return null
  }
  return interpolate(catalogFor(locale).burnRate.paceLabel, {
    n: formatMultiplier(multiplier),
  })
}

export function formatBurnSummary(
  costUsd: number,
  windowMinutes: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return interpolate(catalogFor(locale).burnRate.summary, {
    cost: formatDollars(costUsd),
    minutes: windowMinutes,
  })
}

export function formatMixLabel(
  queryCount: number,
  tokens: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const copy = catalogFor(locale).burnRate
  const requests =
    queryCount === 1
      ? copy.requestOne
      : interpolate(copy.requestMany, { n: queryCount })
  return interpolate(copy.mix, {
    requests,
    tokens: formatCompactTokens(tokens),
  })
}

export type BurnRateToastCopy = {
  message: string
}

export function formatBurnRateToastCopy(
  episode: BurnRateEpisode,
  nowMs: number,
  windowMinutes: number,
  locale: Locale = DEFAULT_LOCALE,
): BurnRateToastCopy {
  const duration = durationMinutes(
    episode.oldestMs,
    nowMs,
    windowMinutes,
    episode.queryCount,
  )
  const copy = catalogFor(locale).burnRate
  const mix = formatMixLabel(episode.queryCount, episode.tokens, locale)
  const spent = formatDollars(episode.costUsd)
  if (episode.level === 'critical') {
    return {
      message: interpolate(copy.toastCritical, { spent, duration, mix }),
    }
  }
  return {
    message: interpolate(copy.toastWarning, { spent, duration, mix }),
  }
}

export function toBurnRatePayload(input: {
  queries: readonly UsageQuery[]
  enabled: boolean
  windowMinutes: number
  warningUsd: number
  criticalUsd: number
  minQueries: number
  nowMs: number
  todayUsd: number | null
  locale?: Locale
}): BurnRatePayload | null {
  if (!input.enabled) {
    return null
  }
  const evaluated = evaluateBurnRate({
    queries: input.queries,
    enabled: input.enabled,
    windowMinutes: input.windowMinutes,
    warningUsd: input.warningUsd,
    criticalUsd: input.criticalUsd,
    minQueries: input.minQueries,
    nowMs: input.nowMs,
  })
  const locale = input.locale ?? DEFAULT_LOCALE
  const copy = catalogFor(locale)
  const percent = meterPercent(evaluated.window.costUsd, input.criticalUsd)
  const paceLabel = formatPaceLabel(evaluated.multiplier, locale)
  const high =
    evaluated.level === 'warning' || evaluated.level === 'critical'
  const bannerTitle = high
    ? evaluated.level === 'critical'
      ? copy.burnRate.runawayTitle
      : copy.burnRate.highTitle
    : null
  const minutes = burstMinutes(
    evaluated.window,
    input.nowMs,
    input.windowMinutes,
  )
  const mixLabel = formatMixLabel(
    evaluated.window.queryCount,
    evaluated.window.tokens,
    locale,
  )
  const bannerBody = high
    ? interpolate(copy.burnRate.bannerBody, {
        cost: formatDollars(evaluated.window.costUsd),
        minutes,
        mix: mixLabel,
      })
    : null
  return {
    level: evaluated.level,
    costUsd: evaluated.window.costUsd,
    tokens: evaluated.window.tokens,
    queryCount: evaluated.window.queryCount,
    windowMinutes: input.windowMinutes,
    multiplier: evaluated.multiplier,
    todayUsd: input.todayUsd,
    percent,
    summary: formatBurnSummary(evaluated.window.costUsd, input.windowMinutes, locale),
    paceLabel,
    mixLabel,
    todayLabel:
      input.todayUsd === null
        ? null
        : interpolate(copy.burnRate.today, {
            amount: formatDollars(input.todayUsd),
          }),
    bannerTitle,
    bannerBody,
  }
}

function meterPercent(costUsd: number, criticalUsd: number): number {
  if (!(criticalUsd > 0) || !Number.isFinite(costUsd)) {
    return 0
  }
  return Math.min(100, Math.max(0, (costUsd / criticalUsd) * 100))
}
