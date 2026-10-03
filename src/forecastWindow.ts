export type ForecastWindow = 'calendarMonth' | 'billingCycle'

export const DEFAULT_FORECAST_WINDOW: ForecastWindow = 'calendarMonth'

export type BillingCycleRange = {
  start: Date
  end: Date
}

export function parseForecastWindow(value: unknown): ForecastWindow {
  return value === 'billingCycle' ? 'billingCycle' : DEFAULT_FORECAST_WINDOW
}

export function parseBillingCycleRange(
  start: string | null | undefined,
  end: string | null | undefined,
): BillingCycleRange | null {
  if (!start || !end) {
    return null
  }
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (
    !Number.isFinite(startDate.getTime()) ||
    !Number.isFinite(endDate.getTime())
  ) {
    return null
  }
  return { start: startDate, end: endDate }
}

export function isMonthlyBillingCycle(range: BillingCycleRange | null): boolean {
  if (range === null || range.end.getTime() <= range.start.getTime()) {
    return false
  }
  const days =
    (range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000)
  return days >= 26 && days <= 35
}

export function hasUsableBillingCycle(
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  return isMonthlyBillingCycle(parseBillingCycleRange(start, end))
}

export function effectiveForecastWindow(
  requested: unknown,
  start: string | null | undefined,
  end: string | null | undefined,
): ForecastWindow {
  if (parseForecastWindow(requested) !== 'billingCycle') {
    return DEFAULT_FORECAST_WINDOW
  }
  return hasUsableBillingCycle(start, end) ? 'billingCycle' : DEFAULT_FORECAST_WINDOW
}

export function isInBillingCycle(timestamp: number, range: BillingCycleRange): boolean {
  return timestamp >= range.start.getTime() && timestamp < range.end.getTime()
}

export function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function billingCycleRenewalIsMidday(
  end: string | null | undefined,
): boolean {
  const date = end ? new Date(end) : null
  if (date === null || !Number.isFinite(date.getTime())) {
    return false
  }
  return (
    date.getHours() !== 0 ||
    date.getMinutes() !== 0 ||
    date.getSeconds() !== 0 ||
    date.getMilliseconds() !== 0
  )
}
