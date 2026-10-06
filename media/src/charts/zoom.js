/** Chart sample zoom + local-day helpers (no DOM). */

export function localDayKeyFromMs(ms) {
  const d = new Date(ms)
  if (!Number.isFinite(d.getTime())) {
    return ''
  }
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * Slice daily chart points for the zoom control.
 * @param {'sample'|'7'|'month'} mode
 */
export function sliceChartPoints(points, mode, now = new Date()) {
  const list = Array.isArray(points) ? points : []
  if (mode === 'sample' || list.length === 0) {
    return list
  }
  const todayKey = localDayKeyFromMs(now.getTime())
  if (mode === '7') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    const startKey = localDayKeyFromMs(start.getTime())
    return list.filter((p) => {
      const key = localDayKeyFromMs(p.timestamp)
      return key >= startKey && key <= todayKey
    })
  }
  // month: current local calendar month
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return list.filter((p) => localDayKeyFromMs(p.timestamp).startsWith(prefix))
}

export function eventsForLocalDay(events, dayKey) {
  const list = Array.isArray(events) ? events : []
  if (!dayKey) {
    return []
  }
  return list.filter((row) => localDayKeyFromMs(row.timestamp) === dayKey)
}
