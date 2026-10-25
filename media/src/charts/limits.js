/** Codex rate-limit history. Each window is its own line and stops at the last sample. */
export function drawLimitHistory(svg, series, h) {
  const svgNode = h.svgNode
  const setText = h.setText
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild)
  }
  const width = 800
  const height = 280
  const left = 46
  const right = 16
  const top = 16
  const bottom = 36
  const plotW = width - left - right
  const plotH = height - top - bottom
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')

  const list = Array.isArray(series) ? series : []
  const flat = []
  for (let s = 0; s < list.length; s++) {
    const points = list[s] && Array.isArray(list[s].points) ? list[s].points : []
    for (let i = 0; i < points.length; i++) {
      flat.push({ series: s, point: points[i], kind: list[s].kind })
    }
  }
  if (flat.length === 0) {
    return false
  }

  const bounds = typeof h.settingsAxisBounds === 'function' ? h.settingsAxisBounds() : null
  const rangeFrom = bounds && Number.isFinite(bounds.from) ? bounds.from : null
  const rangeTo = bounds && Number.isFinite(bounds.to) ? bounds.to : null
  const visible = []
  for (let i = 0; i < flat.length; i++) {
    const ts = Number(flat[i].point.timestamp)
    if (!Number.isFinite(ts)) {
      continue
    }
    if (rangeFrom !== null && ts < rangeFrom) {
      continue
    }
    if (rangeTo !== null && ts > rangeTo) {
      continue
    }
    visible.push(flat[i])
  }
  if (visible.length === 0 && rangeFrom === null) {
    return false
  }

  let minX = rangeFrom === null ? Infinity : rangeFrom
  let maxX = rangeTo === null ? -Infinity : rangeTo
  for (let i = 0; i < visible.length; i++) {
    const ts = Number(visible[i].point.timestamp)
    if (rangeFrom === null && ts < minX) {
      minX = ts
    }
    if (rangeTo === null && ts > maxX) {
      maxX = ts
    }
  }
  if (rangeTo === null) {
    for (let s = 0; s < list.length; s++) {
      const points = list[s].points
      for (let i = 0; i < points.length; i++) {
        const resetMs = resetMsOf(points[i])
        if (resetMs !== null && resetMs > maxX) {
          maxX = resetMs
        }
      }
    }
  }
  if (!(maxX > minX)) {
    maxX = minX + 60 * 60 * 1000
  }

  function xAt(ts) {
    return left + ((ts - minX) / (maxX - minX)) * plotW
  }
  function yAt(percent) {
    const clamped = Math.max(0, Math.min(100, Number(percent) || 0))
    return top + plotH - (clamped / 100) * plotH
  }

  for (let t = 0; t <= 4; t++) {
    const pct = t * 25
    const y = yAt(pct)
    svg.appendChild(
      svgNode('line', {
        class: 'chart-grid',
        x1: String(left),
        y1: String(y),
        x2: String(left + plotW),
        y2: String(y),
      }),
    )
    if (pct !== 0 && pct !== 50 && pct !== 100) {
      continue
    }
    const label = svgNode('text', {
      class: 'chart-label',
      x: String(left - 6),
      y: String(y + 3),
      'text-anchor': 'end',
    })
    setText(label, String(pct) + '%')
    svg.appendChild(label)
  }
  svg.appendChild(
    svgNode('line', {
      class: 'chart-axis',
      x1: String(left),
      y1: String(top + plotH),
      x2: String(left + plotW),
      y2: String(top + plotH),
    }),
  )

  const resetSeen = Object.create(null)
  for (let s = 0; s < list.length; s++) {
    const points = list[s].points
    for (let i = 0; i < points.length; i++) {
      const resetMs = resetMsOf(points[i])
      if (resetMs === null || resetMs < minX || resetMs > maxX || resetSeen[resetMs]) {
        continue
      }
      resetSeen[resetMs] = true
      const x = xAt(resetMs)
      svg.appendChild(
        svgNode('line', {
          class: 'chart-limit-reset',
          x1: String(x),
          y1: String(top + 14),
          x2: String(x),
          y2: String(top + plotH),
        }),
      )
      const resetLabel = svgNode('text', {
        class: 'chart-label',
        x: String(Math.min(x, left + plotW - 4)),
        y: String(top + 10),
        'text-anchor': x > left + plotW - 70 ? 'end' : 'start',
      })
      setText(resetLabel, dayStamp(resetMs))
      svg.appendChild(resetLabel)
    }
  }

  for (let s = 0; s < list.length; s++) {
    const points = list[s].points
    const tone = list[s].kind === '5h' ? 'is-5h' : list[s].kind === '7d' ? 'is-7d' : 'is-other'
    let segment = []
    function flush() {
      const simple = simplifyBurst(segment)
      segment = []
      if (simple.length === 0) {
        return
      }
      const cmds = []
      for (let i = 0; i < simple.length; i++) {
        const p = simple[i]
        cmds.push((i === 0 ? 'M' : 'L') + xAt(p.timestamp) + ' ' + yAt(p.usedPercent))
      }
      svg.appendChild(
        svgNode('path', {
          class: 'chart-limit-line ' + tone,
          d: cmds.join(' '),
        }),
      )
      const peak = simple[simple.length - 1]
      const x = xAt(peak.timestamp)
      const y = yAt(peak.usedPercent)
      svg.appendChild(
        svgNode('circle', {
          class: 'chart-limit-dot ' + tone,
          cx: String(x),
          cy: String(y),
          r: '3.2',
        }),
      )
      const above = y >= top + 16
      const badge = svgNode('text', {
        class: 'chart-label',
        x: String(above ? x : x + 8),
        y: String(above ? y - 6 : y + 4),
        'text-anchor': above ? 'middle' : 'start',
      })
      setText(badge, Math.round(Number(peak.usedPercent) || 0) + '%')
      svg.appendChild(badge)
    }
    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      const ts = Number(point.timestamp)
      if (!Number.isFinite(ts) || ts < minX || ts > maxX) {
        flush()
        continue
      }
      if (segment.length > 0 && segment[segment.length - 1].resetsAt !== point.resetsAt) {
        flush()
      }
      segment.push(point)
    }
    flush()
  }

  if (rangeFrom !== null) {
    const marks = [
      { x: left, text: dayStamp(minX), anchor: 'start' },
      { x: left + plotW / 2, text: dayStamp(minX + (maxX - minX) / 2), anchor: 'middle' },
      { x: left + plotW, text: dayStamp(maxX), anchor: 'end' },
    ]
    for (let i = 0; i < marks.length; i++) {
      const label = svgNode('text', {
        class: 'chart-label',
        x: String(marks[i].x),
        y: String(top + plotH + 16),
        'text-anchor': marks[i].anchor,
      })
      setText(label, marks[i].text)
      svg.appendChild(label)
    }
  }
  const labeled = []
  for (let i = 0; i < visible.length; i++) {
    if (rangeFrom !== null) {
      break
    }
    const point = visible[i].point
    const x = xAt(point.timestamp)
    let crowded = false
    for (let j = 0; j < labeled.length; j++) {
      if (Math.abs(labeled[j] - x) < 72) {
        crowded = true
        break
      }
    }
    if (crowded) {
      continue
    }
    labeled.push(x)
    const label = svgNode('text', {
      class: 'chart-label',
      x: String(x),
      y: String(top + plotH + 16),
      'text-anchor': 'middle',
    })
    setText(label, point.label)
    svg.appendChild(label)
  }

  const hit = svgNode('rect', {
    class: 'chart-hit',
    x: String(left),
    y: String(top),
    width: String(plotW),
    height: String(plotH),
  })
  hit.addEventListener('mousemove', function (event) {
    if (visible.length === 0) {
      return
    }
    const xSvg = viewBoxX(svg, event, width)
    let best = visible[0]
    let bestDist = Infinity
    for (let i = 0; i < visible.length; i++) {
      const dist = Math.abs(xAt(visible[i].point.timestamp) - xSvg)
      if (dist < bestDist) {
        bestDist = dist
        best = visible[i]
      }
    }
    if (typeof h.showLimitTip === 'function') {
      h.showLimitTip(best, event.clientX, event.clientY)
    }
  })
  hit.addEventListener('mouseleave', function () {
    if (typeof h.hideChartTip === 'function') {
      h.hideChartTip()
    }
  })
  svg.appendChild(hit)
  return true
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

function dayStamp(ms) {
  const d = new Date(ms)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return day + '.' + month + '.' + d.getFullYear()
}

/** One session writes many samples in a few minutes. Keep the start and the end of each burst. */
function simplifyBurst(points) {
  if (points.length === 0) {
    return []
  }
  const gapMs = 45 * 60 * 1000
  const clusters = []
  let current = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = current[current.length - 1]
    if (Number(points[i].timestamp) - Number(prev.timestamp) > gapMs) {
      clusters.push(current)
      current = [points[i]]
      continue
    }
    current.push(points[i])
  }
  clusters.push(current)
  const out = []
  for (let c = 0; c < clusters.length; c++) {
    const cluster = clusters[c]
    const first = cluster[0]
    const last = cluster[cluster.length - 1]
    out.push(first)
    if (last !== first && Math.abs(Number(last.usedPercent) - Number(first.usedPercent)) >= 1) {
      out.push(last)
    }
  }
  return out
}

function resetMsOf(point) {
  if (!point || point.resetsAt === null || point.resetsAt === undefined) {
    return null
  }
  const n = Number(point.resetsAt)
  if (!Number.isFinite(n)) {
    return null
  }
  return n * 1000
}
