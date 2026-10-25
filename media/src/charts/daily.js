import { localDayKeyFromMs } from './zoom.js'

/** Daily tokens/cost bar chart (local sample). */
export function drawDailyChart(svg, points, kind, h) {
  const chartBarMode = h.chartBarMode()
  const niceMax = h.niceMax
  const compactTokens = h.compactTokens
  const compactCost = h.compactCost
  const svgNode = h.svgNode
  const setText = h.setText
  const barCenterX = h.barCenterX
  const chartBarRect = h.chartBarRect
  const yAt = h.yAt
  const showChartTip = h.showChartTip
  const hideChartTip = h.hideChartTip
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild)
  }
  const calendar = typeof h.useCalendarAxis === 'function' && h.useCalendarAxis() === true
  const bounds = calendar && typeof h.settingsAxisBounds === 'function' ? h.settingsAxisBounds() : null
  const slots = calendar ? calendarSlots(points, bounds) : (points || []).map(function (point) {
    return { point: point, gap: false }
  })
  const compact = calendar && slots.length > 0 && slots.length < 7
  const height = 280
  const left = 52
  const right = 16
  const top = 16
  const bottom = 36
  const width = compact ? Math.max(320, left + right + slots.length * 72) : 800
  const plotW = width - left - right
  const plotH = height - top - bottom
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  svg.style.width = compact ? width + 'px' : '100%'
  svg.style.maxWidth = '100%'
  svg.style.marginLeft = compact ? 'auto' : ''
  svg.style.marginRight = compact ? 'auto' : ''
  const frame = svg.parentElement
  if (frame && frame.classList) {
    frame.classList.toggle('is-compact', compact)
  }

  const axis = svgNode('line', {
    class: 'chart-axis',
    x1: String(left),
    y1: String(top),
    x2: String(left),
    y2: String(top + plotH),
  })
  svg.appendChild(axis)
  svg.appendChild(
    svgNode('line', {
      class: 'chart-axis',
      x1: String(left),
      y1: String(top + plotH),
      x2: String(left + plotW),
      y2: String(top + plotH),
    }),
  )

  if (!slots || slots.length === 0) {
    return
  }

  const daily = chartBarMode === 'daily'
  const stacked = kind === 'tokens' && slots.some(function (slot) {
    return slot.point && slot.point.inputTokens !== undefined && slot.point.inputTokens !== null
  })
  const parts = []
  const cum = []
  const dayValues = []
  let running = 0
  let runUncached = 0
  let runCached = 0
  let runOutput = 0
  let peak = 0
  for (let i = 0; i < slots.length; i++) {
    const point = slots[i].point
    const split = tokenSplit(point)
    if (stacked) {
      runUncached += split.uncached
      runCached += split.cached
      runOutput += split.output
      const dayTotal = split.uncached + split.cached + split.output
      const total = runUncached + runCached + runOutput
      running = total
      parts.push({
        uncached: daily ? split.uncached : runUncached,
        cached: daily ? split.cached : runCached,
        output: daily ? split.output : runOutput,
      })
      dayValues.push(daily ? dayTotal : total)
      cum.push(total)
      if ((daily ? dayTotal : total) > peak) {
        peak = daily ? dayTotal : total
      }
      continue
    }
    const value = kind === 'tokens' ? point.tokens : point.costUsd
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0
    running += safe
    cum.push(running)
    dayValues.push(safe)
    if ((daily ? safe : running) > peak) {
      peak = daily ? safe : running
    }
  }
  const maxY = niceMax(daily ? peak : running)
  const format = kind === 'tokens' ? compactTokens : compactCost
  const ticks = 4
  for (let t = 0; t <= ticks; t++) {
    const frac = t / ticks
    const y = top + plotH - frac * plotH
    svg.appendChild(
      svgNode('line', {
        class: 'chart-grid',
        x1: String(left),
        y1: String(y),
        x2: String(left + plotW),
        y2: String(y),
      }),
    )
    const leftLabel = svgNode('text', {
      class: 'chart-label',
      x: String(left - 6),
      y: String(y + 3),
      'text-anchor': 'end',
    })
    setText(leftLabel, format(maxY * frac))
    svg.appendChild(leftLabel)
  }

  const labelAt = [0, Math.floor((slots.length - 1) / 2), slots.length - 1]
  const seen = {}
  for (let i = 0; i < labelAt.length; i++) {
    const idx = labelAt[i]
    if (idx < 0 || seen[idx]) {
      continue
    }
    seen[idx] = true
    const x = barCenterX(idx, slots.length, left, plotW)
    const label = svgNode('text', {
      class: 'chart-label',
      x: String(x),
      y: String(top + plotH + 16),
      'text-anchor': 'middle',
    })
    setText(label, slots[idx].point.time)
    svg.appendChild(label)
  }

  const gap = plotW / slots.length
  const barW = Math.max(2, Math.min(36, gap * 0.72))
  for (let i = 0; i < slots.length; i++) {
    const x = barCenterX(i, slots.length, left, plotW)
    if (slots[i].gap && daily) {
      svg.appendChild(
        svgNode('line', {
          class: 'chart-tick',
          x1: String(x),
          y1: String(top + plotH),
          x2: String(x),
          y2: String(top + plotH - 6),
        }),
      )
      continue
    }
    if (stacked) {
      drawStack(svg, chartBarRect, yAt, x, barW, parts[i], maxY, top, plotH)
      continue
    }
    const y = yAt(daily ? dayValues[i] : cum[i], maxY, top, plotH)
    const barH = top + plotH - y
    if (barH <= 0) {
      continue
    }
    svg.appendChild(chartBarRect(x, y, barW, barH, 'chart-bar is-day'))
  }

  const hit = svgNode('rect', {
    class: 'chart-hit',
    x: String(left),
    y: String(top),
    width: String(plotW),
    height: String(plotH),
  })
  function dayIndexAt(event) {
    const xSvg = viewBoxX(svg, event, width)
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < slots.length; i++) {
      const x = barCenterX(i, slots.length, left, plotW)
      const dist = Math.abs(x - xSvg)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    return best
  }
  function onMove(event) {
    const best = dayIndexAt(event)
    showChartTip(
      slots[best].point,
      kind,
      cum[best],
      event.clientX,
      event.clientY,
    )
  }
  function onClick(event) {
    if (typeof h.onDaySelect !== 'function') {
      return
    }
    const best = dayIndexAt(event)
    if (slots[best].gap) {
      return
    }
    h.onDaySelect({
      point: slots[best].point,
      kind: kind,
      cumulative: cum[best],
      index: best,
    })
  }
  hit.addEventListener('mousemove', onMove)
  hit.addEventListener('mouseleave', hideChartTip)
  hit.addEventListener('click', onClick)
  hit.style.cursor = typeof h.onDaySelect === 'function' ? 'pointer' : ''
  svg.appendChild(hit)
}

function tokenSplit(point) {
  const input = Math.max(0, Number(point && point.inputTokens) || 0)
  const cachedRaw = Math.max(0, Number(point && point.cachedInputTokens) || 0)
  const cached = Math.min(input, cachedRaw)
  return {
    uncached: Math.max(0, input - cached),
    cached: cached,
    output: Math.max(0, Number(point && point.outputTokens) || 0),
  }
}

function drawStack(svg, chartBarRect, yAt, x, barW, part, maxY, top, plotH) {
  const bands = [
    { value: part.uncached, className: 'chart-bar is-uncached' },
    { value: part.cached, className: 'chart-bar is-cached' },
    { value: part.output, className: 'chart-bar is-output' },
  ].filter(function (band) {
    return band.value > 0
  })
  let base = 0
  for (let i = 0; i < bands.length; i++) {
    const value = bands[i].value
    const y = yAt(base + value, maxY, top, plotH)
    const next = yAt(base, maxY, top, plotH)
    const barH = next - y
    base += value
    if (barH <= 0) {
      continue
    }
    svg.appendChild(
      chartBarRect(x, y, barW, barH, bands[i].className, i < bands.length - 1),
    )
  }
}

function viewBoxX(svg, event, fallbackWidth) {
  const rect = svg.getBoundingClientRect()
  const vb = svg.viewBox && svg.viewBox.baseVal
  const w = vb && vb.width ? vb.width : fallbackWidth
  const h = vb && vb.height ? vb.height : 280
  if (!(rect.width > 0) || !(rect.height > 0)) {
    return 0
  }
  const scale = Math.min(rect.width / w, rect.height / h)
  const offsetX = (rect.width - w * scale) / 2
  return (event.clientX - rect.left - offsetX) / scale
}

function calendarSlots(points, bounds) {
  const list = Array.isArray(points) ? points : []
  const rangeFrom = bounds && Number.isFinite(bounds.from) ? bounds.from : null
  const rangeTo = bounds && Number.isFinite(bounds.to) ? bounds.to : null
  if (list.length === 0 && rangeFrom === null) {
    return []
  }
  const byDay = Object.create(null)
  let minMs = rangeFrom === null ? Infinity : rangeFrom
  let maxMs = rangeTo === null ? -Infinity : rangeTo
  for (let i = 0; i < list.length; i++) {
    const point = list[i]
    const ms = Number(point && point.timestamp)
    if (!Number.isFinite(ms)) {
      continue
    }
    if (rangeFrom !== null && ms < rangeFrom) {
      continue
    }
    if (rangeTo !== null && ms > rangeTo) {
      continue
    }
    if (rangeFrom === null && ms < minMs) {
      minMs = ms
    }
    if (rangeTo === null && ms > maxMs) {
      maxMs = ms
    }
    byDay[localDayKeyFromMs(ms)] = point
  }
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs < minMs) {
    return list.map(function (point) {
      return { point: point, gap: false }
    })
  }
  const slots = []
  let cursor = startOfLocalDay(minMs)
  const end = startOfLocalDay(maxMs)
  let guard = 0
  while (cursor <= end && guard < 400) {
    const key = localDayKeyFromMs(cursor)
    const found = byDay[key]
    if (found) {
      slots.push({ point: found, gap: false })
    } else {
      slots.push({
        point: {
          timestamp: cursor,
          time: shortDay(cursor),
          tokens: 0,
          costUsd: 0,
          queryCount: 0,
          inputTokens: 0,
          cachedInputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          pricedCount: 0,
        },
        gap: true,
      })
    }
    cursor = addLocalDays(cursor, 1)
    guard += 1
  }
  return slots
}

function startOfLocalDay(ms) {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function addLocalDays(ms, days) {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime()
}

function shortDay(ms) {
  const d = new Date(ms)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return d.getDate() + '.' + month + '.' + d.getFullYear()
}
