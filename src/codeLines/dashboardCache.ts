import { sumDashboardEdited, type DashboardDayEdited } from './analyticsParse'
import { localDayKey } from './gitMerged'

/**
 * A later get-user-analytics body can be a short 200 (timeout, aborted chunk,
 * default range). It must not replace a full window already fetched this session.
 * Half is enough to catch the rescale seen on refresh (~1/3) and still accept
 * a real day-boundary change.
 */
const SHRINK_GUARD = 0.5

const byWindow = new Map<string, DashboardDayEdited[]>()

export function dashboardWindowKey(sinceMs: number, untilMs: number): string {
  return `${localDayKey(sinceMs)}|${localDayKey(untilMs)}`
}

export function retainDashboardDays(
  previous: readonly DashboardDayEdited[] | null,
  incoming: readonly DashboardDayEdited[] | null,
): DashboardDayEdited[] {
  const prevTotal = previous === null ? 0 : sumDashboardEdited(previous)
  const nextTotal = incoming === null ? 0 : sumDashboardEdited(incoming)
  if (incoming === null || nextTotal <= 0) {
    return prevTotal > 0 && previous !== null ? [...previous] : []
  }
  if (
    previous !== null &&
    prevTotal > 0 &&
    nextTotal < prevTotal * SHRINK_GUARD
  ) {
    return [...previous]
  }
  return [...incoming]
}

/** `incoming` null or empty keeps the stored window. A much smaller body does too. */
export function takeDashboardDays(
  sinceMs: number,
  untilMs: number,
  incoming: readonly DashboardDayEdited[] | null,
): DashboardDayEdited[] {
  const key = dashboardWindowKey(sinceMs, untilMs)
  const previous = byWindow.get(key) ?? null
  const chosen = retainDashboardDays(previous, incoming)
  if (sumDashboardEdited(chosen) > 0) {
    byWindow.set(key, chosen)
  }
  return chosen
}

export function resetDashboardDayCache(): void {
  byWindow.clear()
}
