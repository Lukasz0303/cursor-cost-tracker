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
  const width = 800
  const height = 280
  const left = 52
  const right = 16
  const top = 16
  const bottom = 36
  const plotW = width - left - right
  const plotH = height - top - bottom
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)

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

  if (!points || points.length === 0) {
    return
  }

  const daily = chartBarMode === 'daily'
  const cum = []
  const dayValues = []
  let running = 0
  let peak = 0
  for (let i = 0; i < points.length; i++) {
    const value = kind === 'tokens' ? points[i].tokens : points[i].costUsd
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0
    running += safe
    cum.push(running)
    dayValues.push(safe)
    if (safe > peak) {
      peak = safe
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

  const labelAt = [0, Math.floor((points.length - 1) / 2), points.length - 1]
  const seen = {}
  for (let i = 0; i < labelAt.length; i++) {
    const idx = labelAt[i]
    if (idx < 0 || seen[idx]) {
      continue
    }
    seen[idx] = true
    const x = barCenterX(idx, points.length, left, plotW)
    const label = svgNode('text', {
      class: 'chart-label',
      x: String(x),
      y: String(top + plotH + 16),
      'text-anchor': 'middle',
    })
    setText(label, points[idx].time)
    svg.appendChild(label)
  }

  const gap = plotW / points.length
  const barW = Math.max(2, Math.min(36, gap * 0.72))
  for (let i = 0; i < points.length; i++) {
    const x = barCenterX(i, points.length, left, plotW)
    const y = yAt(daily ? dayValues[i] : cum[i], maxY, top, plotH)
    const h = top + plotH - y
    if (h <= 0) {
      continue
    }
    svg.appendChild(chartBarRect(x, y, barW, h, 'chart-bar is-day'))
  }

  const hit = svgNode('rect', {
    class: 'chart-hit',
    x: String(left),
    y: String(top),
    width: String(plotW),
    height: String(plotH),
  })
  function dayIndexAt(event) {
    const rect = svg.getBoundingClientRect()
    const xPx = event.clientX - rect.left
    const xSvg = (xPx / rect.width) * width
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < points.length; i++) {
      const x = barCenterX(i, points.length, left, plotW)
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
      points[best],
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
    h.onDaySelect({
      point: points[best],
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
