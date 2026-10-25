/** Monthly cost forecast SVG (MTD). */
export function drawMtdForecastChart(svg, points, series, max, resetDate, resetMidday, windowKind, h) {
  const clearSvg = h.clearSvg
  const svgNode = h.svgNode
  const setText = h.setText
  const t = h.t
  const yAt = h.yAt
  const pointX = h.pointX
  const numericMax = h.numericMax
  const niceMax = h.niceMax
  const numbersOrNull = h.numbersOrNull
  const appendLine = h.appendLine
  const showMtdForecastTip = h.showMtdForecastTip
  const hideChartTip = h.hideChartTip
  const formatMtdAmount = h.formatMtdAmount
  const compactPercent = h.compactPercent
  const compactCost = h.compactCost
  const daily = h.mtdBarMode() === 'daily'
  clearSvg(svg)
  const width = 800
  const height = 280
  const left = 52
  const right = 20
  const top = 16
  const count = points && points.length ? points.length : 0
  const axisGap =
    count <= 1 ? width - left - right : (width - left - right) / (count - 1)
  const stagger = count > 3 && axisGap < 46
  const bottom = stagger ? 48 : 36
  const plotW = width - left - right
  const plotH = height - top - bottom
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)

  svg.appendChild(
    svgNode('line', {
      class: 'chart-axis',
      x1: String(left),
      y1: String(top),
      x2: String(left),
      y2: String(top + plotH),
    }),
  )
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

  const lines = []
  const rawSeries = Array.isArray(series) ? series : []
  for (let i = 0; i < rawSeries.length; i++) {
    lines.push({
      label: String(rawSeries[i].label || t('mtd.used')),
      tone:
        'is-s' +
        ((Number.isFinite(Number(rawSeries[i].toneIndex))
          ? Number(rawSeries[i].toneIndex)
          : i) %
          4),
      day: numbersOrNull(rawSeries[i].day),
      used: numbersOrNull(rawSeries[i].used),
      forecast: numbersOrNull(rawSeries[i].forecast),
      forecastDay: numbersOrNull(rawSeries[i].forecastDay),
      ideal: numbersOrNull(rawSeries[i].ideal),
      runOutDate:
        rawSeries[i].runOutDate === null ||
        rawSeries[i].runOutDate === undefined
          ? null
          : String(rawSeries[i].runOutDate),
    })
  }
  const primary = lines[0]
  if (!primary) {
    return
  }

  let todayIdx = -1
  for (let i = 0; i < primary.used.length; i++) {
    if (primary.used[i] !== null) {
      todayIdx = i
    }
  }

  let dataMax = 0
  for (let i = 0; i < lines.length; i++) {
    if (daily) {
      dataMax = Math.max(
        dataMax,
        numericMax(lines[i].day),
        numericMax(lines[i].forecastDay),
      )
    } else {
      dataMax = Math.max(
        dataMax,
        numericMax(lines[i].used),
        numericMax(lines[i].forecast),
      )
    }
  }
  if (daily) {
    for (let i = 0; i < points.length; i++) {
      const allowance = points[i] && points[i].dayAllowanceUsd
      if (
        allowance !== null &&
        allowance !== undefined &&
        Number.isFinite(Number(allowance))
      ) {
        dataMax = Math.max(dataMax, Number(allowance))
      }
    }
  }
  const capped =
    !daily && typeof max === 'number' && Number.isFinite(max) && max > 0
  const maxCum = capped ? max : niceMax(dataMax)
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
    setText(leftLabel, formatMtdAmount(maxCum * frac))
    svg.appendChild(leftLabel)
  }

  h.appendMtdDayAxis(svg, points, left, plotW, top + plotH, width)

  const gap = points.length <= 1 ? plotW : plotW / (points.length - 1)
  const groupW = Math.max(3, Math.min(22, gap * 0.64))
  const barW = Math.max(2.4, groupW / Math.max(1, lines.length))
  const inner = Math.max(2, barW * 0.74)
  for (let i = 0; i < points.length; i++) {
    const cx = pointX(i, points.length, left, plotW)
    const allowanceKey = daily ? 'dayAllowanceUsd' : 'allowanceUsd'
    const rawPlan = points[i] && points[i][allowanceKey]
    const plan =
      rawPlan !== null && rawPlan !== undefined && Number.isFinite(Number(rawPlan))
        ? Number(rawPlan)
        : null
    for (let s = 0; s < lines.length; s++) {
      const usedVal = daily ? lines[s].day[i] : lines[s].used[i]
      if (usedVal === null || usedVal === undefined || !(usedVal > 0)) {
        continue
      }
      const offset = (s - (lines.length - 1) / 2) * barW
      h.appendPaceSections(
        svg,
        cx + offset,
        inner,
        usedVal,
        plan,
        maxCum,
        top,
        plotH,
        lines[s].tone,
      )
    }
  }

  if (windowKind === 'calendarMonth' && resetDate) {
    let resetIdx = -1
    for (let i = 0; i < points.length; i++) {
      if (points[i] && points[i].date === resetDate) {
        resetIdx = i
        break
      }
    }
    if (resetIdx >= 0) {
      const resetX = pointX(resetIdx, points.length, left, plotW)
      svg.appendChild(
        svgNode('line', {
          class: 'chart-reset',
          x1: String(resetX),
          y1: String(top),
          x2: String(resetX),
          y2: String(top + plotH),
        }),
      )
      if (resetMidday) {
        const hashWidth = Math.max(4, Math.min(18, groupW))
        const hashGroup = svgNode('g', { class: 'chart-reset-hash' })
        for (let x = resetX - hashWidth / 2; x < resetX + hashWidth / 2; x += 4) {
          hashGroup.appendChild(
            svgNode('line', {
              x1: String(x),
              y1: String(top + plotH),
              x2: String(x + 7),
              y2: String(top + plotH - 7),
            }),
          )
        }
        svg.appendChild(hashGroup)
      }
    }
  }

  if (daily) {
    for (let i = 0; i < lines.length; i++) {
      appendLine(
        svg,
        lines[i].forecastDay,
        maxCum,
        left,
        plotW,
        top,
        plotH,
        'chart-line is-forecast ' + lines[i].tone,
      )
    }
  } else {
    for (let i = 0; i < lines.length; i++) {
      appendLine(
        svg,
        lines[i].forecast,
        maxCum,
        left,
        plotW,
        top,
        plotH,
        'chart-line is-forecast ' + lines[i].tone,
      )
    }
    for (let i = 0; i < lines.length; i++) {
      appendLine(
        svg,
        lines[i].used,
        maxCum,
        left,
        plotW,
        top,
        plotH,
        'chart-line ' + lines[i].tone,
      )
    }
  }

  if (todayIdx >= 0) {
    const x = pointX(todayIdx, points.length, left, plotW)
    svg.appendChild(
      svgNode('line', {
        class: 'chart-today',
        x1: String(x),
        y1: String(top),
        x2: String(x),
        y2: String(top + plotH),
      }),
    )
  }

  const lastIdx = points.length - 1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const todayValue = daily ? line.day[todayIdx] : line.used[todayIdx]
    if (todayIdx >= 0 && todayValue !== null && todayValue !== undefined) {
      svg.appendChild(
        svgNode('circle', {
          class: 'chart-dot ' + line.tone,
          cx: String(pointX(todayIdx, points.length, left, plotW)),
          cy: String(
            yAt(Math.min(todayValue, maxCum), maxCum, top, plotH),
          ),
          r: '3',
        }),
      )
    }
    if (!daily && line.runOutDate) {
      let runIdx = -1
      for (let p = 0; p < points.length; p++) {
        if (points[p].date === line.runOutDate) {
          runIdx = p
          break
        }
      }
      if (runIdx >= 0) {
        const x = pointX(runIdx, points.length, left, plotW)
        const y = yAt(maxCum, maxCum, top, plotH)
        svg.appendChild(
          svgNode('line', {
            class: 'chart-runout ' + line.tone,
            x1: String(x),
            y1: String(top),
            x2: String(x),
            y2: String(top + plotH),
          }),
        )
        svg.appendChild(
          svgNode('circle', {
            class: 'chart-dot is-runout ' + line.tone,
            cx: String(x),
            cy: String(y),
            r: '4',
          }),
        )
        const label = svgNode('text', {
          class: 'chart-label chart-runout-label',
          x: String(x + 4),
          y: String(top + 12 + i * 12),
          'text-anchor': 'start',
        })
        setText(label, t('charts.out', { date: line.runOutDate }))
        svg.appendChild(label)
      }
    } else if (!daily) {
      const raw = line.forecast[lastIdx]
      // Handle reset array [high, low] - use the low value
      const end = Array.isArray(raw) ? raw[1] : raw
      if (end !== null && end !== undefined && end <= maxCum) {
        svg.appendChild(
          svgNode('circle', {
            class: 'chart-dot is-forecast ' + line.tone,
            cx: String(pointX(lastIdx, points.length, left, plotW)),
            cy: String(yAt(end, maxCum, top, plotH)),
            r: '3',
          }),
        )
      }
    }
  }

  if (!daily) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const values = line.used
      for (let p = 0; p < values.length; p++) {
        const sample = values[p]
        if (sample === null || sample === undefined || !Number.isFinite(Number(sample))) {
          continue
        }
        const prev = p > 0 ? values[p - 1] : null
        const next = p + 1 < values.length ? values[p + 1] : null
        const joined =
          (prev !== null && prev !== undefined && Number.isFinite(Number(prev))) ||
          (next !== null && next !== undefined && Number.isFinite(Number(next)))
        if (joined || p === todayIdx) {
          continue
        }
        svg.appendChild(
          svgNode('circle', {
            class: 'chart-dot ' + line.tone,
            cx: String(pointX(p, points.length, left, plotW)),
            cy: String(yAt(Math.min(Number(sample), maxCum), maxCum, top, plotH)),
            r: '3',
          }),
        )
      }
    }
  }

  const hit = svgNode('rect', {
    class: 'chart-hit',
    x: String(left),
    y: String(top),
    width: String(plotW),
    height: String(plotH),
  })
  function onMove(event) {
    const rect = svg.getBoundingClientRect()
    const xPx = event.clientX - rect.left
    const xSvg = (xPx / rect.width) * width
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < points.length; i++) {
      const x = pointX(i, points.length, left, plotW)
      const dist = Math.abs(x - xSvg)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    // Pick the nearest series bar for that day (each bar gets its own tip).
    let bestSeries = 0
    let bestSeriesDist = Infinity
    for (let s = 0; s < lines.length; s++) {
      const offset = (s - (lines.length - 1) / 2) * barW
      const barX = pointX(best, points.length, left, plotW) + offset
      const dist = Math.abs(barX - xSvg)
      if (dist < bestSeriesDist) {
        bestSeriesDist = dist
        bestSeries = s
      }
    }
    showMtdForecastTip(
      points[best],
      lines[bestSeries],
      best,
      event.clientX,
      event.clientY,
      svg,
    )
  }
  hit.addEventListener('mousemove', onMove)
  hit.addEventListener('mouseleave', hideChartTip)
  svg.appendChild(hit)
}
