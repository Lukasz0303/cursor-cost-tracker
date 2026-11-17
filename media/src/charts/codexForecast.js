/**
 * Codex limit chart for one window, drawn like the Cursor month forecast.
 * The axis is that window. The solid line follows samples from 0 at the
 * open. Older cycles of the same limit are drawn from their own samples and
 * the line breaks between resets. The dashed forecast is only the current
 * cycle's pace (used so far ÷ days open × days in the window). The pace
 * needed to finish the leftover quota stays on the To last card.
 */

function slotIndex(ts, originMs, hourly) {
  const from = new Date(originMs)
  const to = new Date(ts)
  const start = Date.UTC(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
    hourly ? from.getHours() : 0,
  )
  const end = Date.UTC(
    to.getFullYear(),
    to.getMonth(),
    to.getDate(),
    hourly ? to.getHours() : 0,
  )
  return Math.round((end - start) / (hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000))
}

function slotStartMs(originMs, index, hourly) {
  const origin = new Date(originMs)
  if (hourly) {
    return new Date(
      origin.getFullYear(),
      origin.getMonth(),
      origin.getDate(),
      origin.getHours() + index,
    ).getTime()
  }
  return new Date(origin.getFullYear(), origin.getMonth(), origin.getDate() + index).getTime()
}

function slotStamp(date, withHour) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  if (!withHour) {
    return day + '.' + month
  }
  return day + '.' + month + ' ' + String(date.getHours()).padStart(2, '0') + ':00'
}

function hourFloor(ms) {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime()
}

function midnightOf(ms) {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Whole days (or hours) already open in the window. The current unit counts
 * as one, so a reading a few hours after the open is not divided into a
 * fraction of a day.
 * @param {object} pace
 */
export function codexWindowReadout(pace) {
  const startMs = finiteNumber(pace && pace.windowStartMs)
  const endMs = finiteNumber(pace && pace.resetsAtMs)
  const asOfMs = finiteNumber(pace && pace.asOfMs)
  const used = Math.max(0, finiteNumber(pace && pace.used) || 0)
  if (startMs === null || endMs === null || asOfMs === null || !(endMs > startMs)) {
    return null
  }
  const unitMs = pace.unit === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const elapsedUnits = Math.max(1, Math.floor(Math.max(0, asOfMs - startMs) / unitMs) + 1)
  const totalUnits = Math.max(elapsedUnits, Math.ceil((endMs - startMs) / unitMs - 1e-6))
  const paceRate = used / elapsedUnits
  const forecastEnd = paceRate * totalUnits
  const allowanceNow = (elapsedUnits / totalUnits) * 100
  const dailyBudget = 100 / totalUnits
  let runOutMs = null
  if (used >= 100 - 0.005) {
    runOutMs = asOfMs
  } else if (paceRate > 0 && forecastEnd >= 100 - 0.005) {
    const hit = asOfMs + ((100 - used) / paceRate) * unitMs
    if (hit < endMs - unitMs) {
      runOutMs = hit
    }
  }
  return {
    used: used,
    allowanceNow: allowanceNow,
    dailyBudget: dailyBudget,
    elapsedUnits: elapsedUnits,
    totalUnits: totalUnits,
    paceRate: paceRate,
    forecastEnd: forecastEnd,
    over: used > allowanceNow + 0.05,
    runOutMs: runOutMs,
  }
}

/**
 * @param {object} input
 * @param {object} input.pace
 * @param {object[]} input.series limit samples for this reset
 * @param {{ from: number, to: number } | null} [input.dayRange] settings From–To
 */
export function buildCodexWindowChart(input) {
  const pace = input.pace
  const startMs = finiteNumber(pace && pace.windowStartMs)
  const endMs = finiteNumber(pace && pace.resetsAtMs)
  const asOfMs = finiteNumber(pace && pace.asOfMs)
  const usedNow = finiteNumber(pace && pace.used)
  if (
    startMs === null ||
    endMs === null ||
    endMs <= startMs ||
    usedNow === null ||
    asOfMs === null
  ) {
    return null
  }
  const hourly = pace.unit === 'hour'
  const bounds = chartBounds(startMs, endMs, hourly, input.dayRange)
  if (bounds === null) {
    return null
  }
  const origin = bounds.origin
  const total = bounds.total

  const unitMs = hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const readout = codexWindowReadout(pace)
  const elapsed = readout ? readout.elapsedUnits : 1
  const totalUnits = readout ? readout.totalUnits : elapsed
  const live = Math.max(0, usedNow)
  const paceRate = readout ? readout.paceRate : null
  const paceEnd = readout ? readout.forecastEnd : live
  const cycles = cyclesForKind(input.series, pace, endMs - startMs)

  const used = new Array(total).fill(null)
  const forecast = new Array(total).fill(null)
  const points = []
  let runOutDate = null
  for (let i = 0; i < total; i++) {
    const slotStart = slotStartMs(origin, i, hourly)
    const slotEnd = slotStartMs(origin, i + 1, hourly)
    const at = new Date(slotStart)
    points.push({
      date: slotStamp(at, hourly),
      weekday: at.getDay() !== 0 && at.getDay() !== 6,
      workingDayIndex: i,
      allowanceUsd: allowanceForSlot(
        slotStart,
        slotEnd,
        startMs,
        endMs,
        cycles,
      ),
      dayAllowanceUsd: null,
    })
    used[i] = usedOnSlot(cycles, slotStart, slotEnd, asOfMs, endMs, live)
    const units = paceUnitsThrough(slotEnd, startMs, endMs, unitMs, totalUnits)
    if (units <= 0) {
      continue
    }
    const onSample = slotStart <= asOfMs && asOfMs < slotEnd
    if (!onSample && slotStart <= asOfMs && used[i] === null) {
      continue
    }
    const projected = onSample ? live : forecastAt(units, elapsed, live, paceRate)
    forecast[i] = projected
    if (
      runOutDate === null &&
      units > elapsed &&
      units < totalUnits &&
      projected >= 100 - 0.005
    ) {
      runOutDate = points[i].date
    }
  }

  const day = new Array(total).fill(null)
  for (let i = 0; i < total; i++) {
    day[i] = stepFrom(used, i)
  }

  const resetSlot = hourly ? hourFloor(endMs) : midnightOf(endMs)
  const resetDate = slotStamp(new Date(resetSlot), hourly)
  const resetClock = new Date(endMs)
  const hasReset = points.some(function (point) {
    return point.date === resetDate
  })
  return {
    points: points,
    day: day,
    used: used,
    forecast: forecast,
    ideal: new Array(total).fill(null),
    runOutDate: runOutDate,
    forecastEnd: paceEnd,
    resetDate: hasReset ? resetDate : null,
    resetMidday:
      hasReset &&
      (resetClock.getHours() !== 0 ||
        resetClock.getMinutes() !== 0 ||
        resetClock.getSeconds() !== 0 ||
        resetClock.getMilliseconds() !== 0),
  }
}

function chartBounds(startMs, endMs, hourly, dayRange) {
  // Same shape as Cursor's billing cycle: Settings From is the first day,
  // and the axis always runs through the period reset. Settings To never
  // cuts that reset off.
  let origin = hourly ? hourFloor(startMs) : midnightOf(startMs)
  const horizon = endMs
  if (dayRange && Number.isFinite(dayRange.from)) {
    const from = hourly ? hourFloor(dayRange.from) : dayRange.from
    if (from < horizon) {
      origin = from
    }
  }
  if (!(horizon >= origin)) {
    return null
  }
  let total = slotIndex(horizon, origin, hourly) + 1
  if (!(total > 0)) {
    return null
  }
  if (total > 400) {
    const endSlot = slotStartMs(origin, total - 1, hourly)
    origin = slotStartMs(endSlot, -(400 - 1), hourly)
    total = 400
  }
  return { origin: origin, total: total }
}

function cyclesForKind(series, pace, windowMs) {
  const out = []
  const source = Array.isArray(series) ? series : []
  for (let i = 0; i < source.length; i++) {
    const item = source[i]
    if (!item) {
      continue
    }
    if (pace.kind && item.kind && item.kind !== pace.kind) {
      continue
    }
    const resetsAt = finiteNumber(item.resetsAt)
    if (resetsAt === null) {
      continue
    }
    const minutes = finiteNumber(item.windowMinutes)
    const cycleMs = minutes !== null && minutes > 0 ? minutes * 60 * 1000 : windowMs
    if (!(cycleMs > 0)) {
      continue
    }
    const end = resetsAt * 1000
    const points = readPoints(item.points)
    if (points.length === 0) {
      continue
    }
    out.push({ startMs: end - cycleMs, endMs: end, points: points })
  }
  return out
}

function readPoints(points) {
  const out = []
  const source = Array.isArray(points) ? points : []
  for (let i = 0; i < source.length; i++) {
    const point = source[i]
    const timestamp = finiteNumber(point && point.timestamp)
    const usedPercent = finiteNumber(point && point.usedPercent)
    if (timestamp === null || usedPercent === null) {
      continue
    }
    out.push({ timestamp: timestamp, usedPercent: usedPercent })
  }
  return out
}

function readingAnchors(startMs, endMs, asOfMs, usedNow, samples) {
  const anchors = [{ t: startMs, v: 0 }]
  const points = samples.slice().sort(function (left, right) {
    return left.timestamp - right.timestamp
  })
  for (let i = 0; i < points.length; i++) {
    const ts = points[i].timestamp
    if (ts < startMs || ts > endMs || ts > asOfMs) {
      continue
    }
    placeAnchor(anchors, ts, points[i].usedPercent)
  }
  const liveAt = Math.min(Math.max(asOfMs, startMs), endMs)
  placeAnchor(anchors, liveAt, usedNow)
  return anchors
}

function placeAnchor(anchors, ts, value) {
  const prev = anchors[anchors.length - 1]
  if (Math.abs(prev.t - ts) < 1000) {
    prev.v = value
    prev.t = ts
    return
  }
  anchors.push({ t: ts, v: value })
}

function valueOnCurve(anchors, t) {
  if (t < anchors[0].t) {
    return null
  }
  const last = anchors[anchors.length - 1]
  if (t >= last.t) {
    return last.v
  }
  for (let i = 0; i + 1 < anchors.length; i++) {
    const left = anchors[i]
    const right = anchors[i + 1]
    if (t > right.t) {
      continue
    }
    if (!(right.t > left.t)) {
      return right.v
    }
    return left.v + ((right.v - left.v) * (t - left.t)) / (right.t - left.t)
  }
  return last.v
}

function usedAt(anchors, slotStart, slotEnd, startMs, endMs, asOfMs) {
  if (slotStart > asOfMs) {
    return null
  }
  const t = asOfMs < slotEnd ? asOfMs : Math.min(slotEnd, endMs)
  if (t < startMs) {
    return null
  }
  return valueOnCurve(anchors, t)
}

function paceUnitsThrough(slotEnd, startMs, endMs, unitMs, totalUnits) {
  const covered = Math.min(slotEnd, endMs) - startMs
  if (!(covered > 0) || !(unitMs > 0)) {
    return 0
  }
  const count = Math.max(1, Math.ceil(covered / unitMs - 1e-6))
  return Math.min(totalUnits, count)
}

function sameCycle(endMs, cycleEndMs) {
  return Math.abs(endMs - cycleEndMs) <= 60 * 1000
}

function usedOnSlot(cycles, slotStart, slotEnd, asOfMs, currentEndMs, live) {
  let best = null
  for (let c = 0; c < cycles.length; c++) {
    const cycle = cycles[c]
    const points = cycle.points
    for (let p = 0; p < points.length; p++) {
      const point = points[p]
      if (point.timestamp < cycle.startMs || point.timestamp > cycle.endMs) {
        continue
      }
      if (point.timestamp < slotStart || point.timestamp >= slotEnd || point.timestamp > asOfMs) {
        continue
      }
      if (best === null || point.timestamp >= best.timestamp) {
        best = point
      }
    }
  }
  if (slotStart <= asOfMs && asOfMs < slotEnd) {
    for (let c = 0; c < cycles.length; c++) {
      if (sameCycle(currentEndMs, cycles[c].endMs)) {
        return live
      }
    }
    return live
  }
  return best === null ? null : best.usedPercent
}

function allowanceForSlot(slotStart, slotEnd, currentStart, currentEnd, cycles) {
  if (slotEnd > currentStart && slotStart < currentEnd) {
    return evenPlan(currentStart, currentEnd, slotStart, slotEnd)
  }
  for (let c = cycles.length - 1; c >= 0; c--) {
    const cycle = cycles[c]
    if (slotEnd > cycle.startMs && slotStart < cycle.endMs) {
      return evenPlan(cycle.startMs, cycle.endMs, slotStart, slotEnd)
    }
  }
  return null
}

function forecastAt(units, elapsed, used, paceRate) {
  const done = Math.max(1, elapsed)
  if (units <= done) {
    return used * (units / done)
  }
  if (paceRate === null) {
    return used
  }
  return Math.max(0, used + paceRate * (units - done))
}

function evenPlan(startMs, endMs, slotStart, slotEnd) {
  if (!(slotEnd > startMs && slotStart < endMs)) {
    return null
  }
  const span = endMs - startMs
  if (!(span > 0)) {
    return null
  }
  const raw = ((Math.min(slotEnd, endMs) - startMs) / span) * 100
  if (!Number.isFinite(raw) || raw <= 0) {
    return null
  }
  return Math.min(100, raw)
}

function stepFrom(values, index) {
  const raw = values[index]
  if (raw === null || raw === undefined) {
    return null
  }
  const n = Array.isArray(raw) ? Number(raw[raw.length - 1]) : Number(raw)
  if (!Number.isFinite(n)) {
    return null
  }
  const prevRaw = index > 0 ? values[index - 1] : null
  const prev =
    prevRaw === null || prevRaw === undefined
      ? null
      : Array.isArray(prevRaw)
        ? Number(prevRaw[prevRaw.length - 1])
        : Number(prevRaw)
  if (prev === null || !Number.isFinite(prev) || n + 0.0001 < prev) {
    return Math.max(0, n)
  }
  return Math.max(0, n - prev)
}
