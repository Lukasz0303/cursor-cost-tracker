/**
 * Codex limit chart, drawn like a billing-cycle forecast. Each window opens
 * at 0% and the solid line follows the samples (linear between them, then
 * held). The dashed line is the straight pace of that window: closed windows
 * run from 0 to their last reading, and the current window runs through the
 * latest reading and on to the reset. A missing host pace is the reading
 * divided by the age of the window, so the dashed line is still drawn. The
 * next window drops and starts again. Days outside every window stay empty.
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
 * @param {object} input
 * @param {object} input.pace
 * @param {object[]} input.series limit series already split by resetsAt
 * @param {{ from: number, to: number } | null} input.dayRange local midnights, inclusive
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
  const windowOrigin = hourly ? hourFloor(startMs) : midnightOf(startMs)
  const windowTotal = slotIndex(endMs, windowOrigin, hourly) + 1
  if (!(windowTotal > 0) || windowTotal > 400) {
    return null
  }
  let origin = windowOrigin
  let total = windowTotal
  if (!hourly && input.dayRange && Number.isFinite(input.dayRange.from)) {
    const rangeTo = Number.isFinite(input.dayRange.to) ? input.dayRange.to : endMs
    const horizon = Math.max(rangeTo, midnightOf(endMs))
    origin = input.dayRange.from
    total = slotIndex(horizon, origin, false) + 1
    if (total > 400) {
      const endDay = new Date(horizon)
      origin = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() - 399).getTime()
      total = 400
    }
  }
  if (!(total > 0)) {
    return null
  }

  const paceRate = finiteNumber(pace.dailyPace)
  const unitMs = hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const currentReset = endMs / 1000
  const windows = collectWindows(input.series, pace, currentReset, startMs, endMs)
  const used = new Array(total).fill(null)
  const day = new Array(total).fill(null)
  const forecast = new Array(total).fill(null)
  const perWindow = []
  const anchors = []

  for (let w = 0; w < windows.length; w++) {
    const slots = new Array(total).fill(null)
    const points = windows[w].points
      .slice()
      .sort(function (left, right) {
        return left.timestamp - right.timestamp
      })
    for (let p = 0; p < points.length; p++) {
      const slot = slotIndex(points[p].timestamp, origin, hourly)
      if (slot < 0 || slot >= total) {
        continue
      }
      slots[slot] = points[p].usedPercent
    }
    perWindow.push(slots)
    anchors.push(windowAnchors(windows[w], asOfMs))
  }

  const owners = new Array(total).fill(null)
  let resetIndex = -1
  let previousOwner = null
  for (let i = 0; i < total; i++) {
    const slotStart = slotStartMs(origin, i, hourly)
    const slotEnd = slotStartMs(origin, i + 1, hourly)
    const owner = ownerForSlot(windows, slotStart, slotEnd)
    owners[i] = owner
    if (owner === null) {
      continue
    }
    if (
      previousOwner !== null &&
      owner !== previousOwner &&
      owner.startMs > previousOwner.startMs
    ) {
      resetIndex = i
    }
    previousOwner = owner
    const ownerIndex = windows.indexOf(owner)
    const curve = ownerIndex >= 0 ? anchors[ownerIndex] : null
    const usedAt = usedReadingTime(slotStart, slotEnd, owner, asOfMs)
    if (curve && usedAt !== null) {
      used[i] = valueOnCurve(curve, usedAt)
    }
    forecast[i] = forecastReading(
      owner,
      curve,
      slotStart,
      slotEnd,
      asOfMs,
      usedNow,
      paceRate,
      unitMs,
    )
  }

  if (resetIndex > 0) {
    const prev = forecast[resetIndex - 1]
    const prevN = Array.isArray(prev) ? prev[prev.length - 1] : prev
    const next = forecast[resetIndex]
    const nextN = Array.isArray(next) ? next[next.length - 1] : next
    if (
      typeof prevN === 'number' &&
      typeof nextN === 'number' &&
      nextN + 0.5 < prevN
    ) {
      forecast[resetIndex] = [prevN, nextN]
    }
  }

  for (let i = 0; i < total; i++) {
    day[i] = stepFrom(used, i)
  }

  let resetMidday = false
  if (resetIndex >= 0 && owners[resetIndex]) {
    const start = new Date(owners[resetIndex].startMs)
    resetMidday =
      start.getHours() !== 0 ||
      start.getMinutes() !== 0 ||
      start.getSeconds() !== 0
  }

  const points = []
  const originDate = new Date(origin)
  let runOutDate = null
  const current = windows.find(function (window) {
    return window.current
  })
  for (let i = 0; i < total; i++) {
    const at = new Date(slotStartMs(originDate.getTime(), i, hourly))
    const slotStart = at.getTime()
    const slotEnd = slotStartMs(origin, i + 1, hourly)
    points.push({
      date: slotStamp(at, hourly),
      weekday: at.getDay() !== 0 && at.getDay() !== 6,
      workingDayIndex: i,
      allowanceUsd: allowanceAt(slotStart, slotEnd, windows, perWindow, i),
      dayAllowanceUsd: null,
    })
    if (runOutDate !== null || owners[i] !== current || current === null) {
      continue
    }
    const raw = forecast[i]
    const continuing = Array.isArray(raw) ? raw[raw.length - 1] : raw
    if (continuing === null || continuing === undefined || !(continuing >= 100)) {
      continue
    }
    const hitAt = forecastTime(slotStart, slotEnd, current, asOfMs)
    if (hitAt !== null && hitAt < current.endMs - unitMs) {
      runOutDate = points[i].date
    }
  }

  return {
    points: points,
    day: day,
    used: used,
    forecast: forecast,
    ideal: new Array(total).fill(null),
    runOutDate: runOutDate,
    resetDate: resetIndex >= 0 && points[resetIndex] ? points[resetIndex].date : null,
    resetMidday: resetMidday,
  }
}

function collectWindows(series, pace, currentReset, fallbackStart, fallbackEnd) {
  const list = []
  const source = Array.isArray(series) ? series : []
  for (let i = 0; i < source.length; i++) {
    const item = source[i]
    if (!item || item.kind !== pace.kind) {
      continue
    }
    const resetsAt = finiteNumber(item.resetsAt)
    const minutes = finiteNumber(item.windowMinutes)
    if (resetsAt === null || minutes === null || !(minutes > 0)) {
      continue
    }
    const windowMs = minutes * 60 * 1000
    const end = resetsAt * 1000
    list.push({
      startMs: end - windowMs,
      endMs: end,
      windowMs: windowMs,
      current: Math.abs(resetsAt - currentReset) <= 60,
      points: readPoints(item.points),
    })
  }
  let current = null
  for (let i = 0; i < list.length; i++) {
    if (list[i].current) {
      current = list[i]
      break
    }
  }
  if (current === null) {
    current = {
      startMs: fallbackStart,
      endMs: fallbackEnd,
      windowMs: fallbackEnd - fallbackStart,
      current: true,
      points: [],
    }
    list.push(current)
  }
  const asOfMs = finiteNumber(pace.asOfMs)
  const usedNow = finiteNumber(pace.used)
  if (asOfMs !== null && usedNow !== null) {
    const already = current.points.some(function (point) {
      return Math.abs(point.timestamp - asOfMs) < 1000
    })
    if (!already) {
      current.points.push({ timestamp: asOfMs, usedPercent: usedNow })
    }
  }
  list.sort(function (left, right) {
    return left.endMs - right.endMs
  })
  return list
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

function slotsHaveSample(slots) {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] !== null && slots[i] !== undefined) {
      return true
    }
  }
  return false
}

function ownerForSlot(windows, slotStart, slotEnd) {
  let best = null
  for (let i = 0; i < windows.length; i++) {
    const window = windows[i]
    if (!window.points || window.points.length === 0) {
      continue
    }
    if (!(slotEnd > window.startMs && slotStart < window.endMs)) {
      continue
    }
    if (best === null || window.startMs >= best.startMs) {
      best = window
    }
  }
  return best
}

/** 0% at the open, then each sample. A sample on the open replaces the zero. */
function windowAnchors(window, asOfMs) {
  const anchors = [{ t: window.startMs, v: 0 }]
  let hasSample = false
  const points = window.points
    .slice()
    .sort(function (left, right) {
      return left.timestamp - right.timestamp
    })
  for (let i = 0; i < points.length; i++) {
    const ts = points[i].timestamp
    if (ts < window.startMs || ts > window.endMs) {
      continue
    }
    if (window.current && ts > asOfMs) {
      continue
    }
    hasSample = true
    const prev = anchors[anchors.length - 1]
    if (Math.abs(prev.t - ts) < 1000) {
      prev.v = points[i].usedPercent
      prev.t = ts
      continue
    }
    anchors.push({ t: ts, v: points[i].usedPercent })
  }
  return hasSample ? anchors : null
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

/** Cumulative reading through this slot, and nothing after the live sample. */
function usedReadingTime(slotStart, slotEnd, window, asOfMs) {
  if (slotStart > asOfMs) {
    return null
  }
  const end = window.current ? Math.min(window.endMs, asOfMs) : window.endMs
  if (!(slotEnd > window.startMs && slotStart < end)) {
    return null
  }
  if (window.current && asOfMs >= slotStart && asOfMs < slotEnd) {
    return asOfMs
  }
  return Math.min(slotEnd, end)
}

function forecastTime(slotStart, slotEnd, window, asOfMs) {
  if (!(slotEnd > window.startMs && slotStart < window.endMs)) {
    return null
  }
  if (window.current && asOfMs >= slotStart && asOfMs < slotEnd) {
    return asOfMs
  }
  if (window.current && slotStart > asOfMs) {
    return Math.min(slotEnd, window.endMs)
  }
  if (window.current && slotEnd <= asOfMs) {
    return Math.min(slotEnd, asOfMs)
  }
  return Math.min(slotEnd, window.endMs)
}

function forecastReading(window, curve, slotStart, slotEnd, asOfMs, usedNow, paceRate, unitMs) {
  const t = forecastTime(slotStart, slotEnd, window, asOfMs)
  if (t === null) {
    return null
  }
  if (!window.current) {
    if (!curve) {
      return null
    }
    const closing = curve[curve.length - 1].v
    const span = window.endMs - window.startMs
    if (!(span > 0)) {
      return null
    }
    return (closing * (t - window.startMs)) / span
  }
  let rate = paceRate
  if (rate === null) {
    const ageUnits = (asOfMs - window.startMs) / unitMs
    rate = ageUnits > 0 ? Math.max(0, usedNow) / ageUnits : null
  }
  if (t <= asOfMs) {
    const age = asOfMs - window.startMs
    if (!(age > 0)) {
      return Math.max(0, usedNow)
    }
    return Math.max(0, usedNow * ((t - window.startMs) / age))
  }
  if (rate === null) {
    return Math.max(0, usedNow)
  }
  return Math.max(0, usedNow) + rate * ((t - asOfMs) / unitMs)
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

function allowanceAt(slotStart, slotEnd, windows, perWindow, index) {
  let latest = null
  let sampleOwner = null
  for (let w = 0; w < windows.length; w++) {
    const window = windows[w]
    if (!slotsHaveSample(perWindow[w])) {
      continue
    }
    if (!(slotEnd > window.startMs && slotStart < window.endMs)) {
      continue
    }
    if (latest === null || window.endMs >= latest.endMs) {
      latest = window
    }
    const sample = perWindow[w][index]
    if (sample !== null && sample !== undefined) {
      if (sampleOwner === null || window.endMs >= sampleOwner.endMs) {
        sampleOwner = window
      }
    }
  }
  const owner = sampleOwner || latest
  if (owner === null || !(owner.windowMs > 0)) {
    return null
  }
  const raw = ((slotEnd - owner.startMs) / owner.windowMs) * 100
  if (!Number.isFinite(raw) || raw <= 0) {
    return null
  }
  return Math.min(100, raw)
}
