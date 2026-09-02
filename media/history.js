(function () {
  const vscode = acquireVsCodeApi()
  const DEFAULT_OK = '#89D185'
  const DEFAULT_WARN = '#F14C4C'
  const rowsEl = document.getElementById('rows')
  const emptyEl = document.getElementById('empty')
  const statusEl = document.getElementById('status')
  const closeEl = document.getElementById('close')
  const thresholdEl = document.getElementById('threshold')
  const thresholdPreviewEl = document.getElementById('thresholdPreview')
  const applyEl = document.getElementById('applyThreshold')
  const historyLimitEl = document.getElementById('historyLimit')
  const applyHistoryLimitEl = document.getElementById('applyHistoryLimit')
  const showWarningEl = document.getElementById('showWarning')
  const okColorEl = document.getElementById('okColor')
  const warnColorEl = document.getElementById('warnColor')
  const okColorValueEl = document.getElementById('okColorValue')
  const warnColorValueEl = document.getElementById('warnColorValue')
  const resetColorsEl = document.getElementById('resetColors')
  const settingsFormEl = document.getElementById('settingsForm')
  const queriesViewEl = document.getElementById('queriesView')
  const statsViewEl = document.getElementById('statsView')
  const statsEl = document.getElementById('stats')
  const chartsViewEl = document.getElementById('chartsView')
  const chartsEmptyEl = document.getElementById('chartsEmpty')
  const chartTokensEl = document.getElementById('chartTokens')
  const chartCostEl = document.getElementById('chartCost')
  const chartTipEl = document.getElementById('chartTip')
  const periodCardsEl = document.getElementById('periodCards')
  const settingsViewEl = document.getElementById('settingsView')
  const tabQueriesEl = document.getElementById('tabQueries')
  const tabStatsEl = document.getElementById('tabStats')
  const tabChartsEl = document.getElementById('tabCharts')
  const tabSettingsEl = document.getElementById('tabSettings')
  const extensionVersionEl = document.getElementById('extensionVersion')
  const toolbarVersionEl = document.querySelector('.toolbar-version')
  let debounceTimer = 0
  let colorTimer = 0
  let historyTimer = 0
  let chartPoints = []
  let chartResizeTimer = 0
  const MIN_HISTORY = 100
  const MAX_HISTORY = 10000
  const DEFAULT_HISTORY = 1000

  function clampHistoryLimit(value) {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n)) {
      return DEFAULT_HISTORY
    }
    if (n < MIN_HISTORY) {
      return MIN_HISTORY
    }
    if (n > MAX_HISTORY) {
      return MAX_HISTORY
    }
    return n
  }

  function lastHeading(limit) {
    return 'Last ' + clampHistoryLimit(limit)
  }

  function applyHistoryTitle(limit) {
    const title = lastHeading(limit) + ' Cursor queries'
    if (tabQueriesEl) {
      setText(tabQueriesEl, title)
    }
    document.title = title
  }

  function formatVersionLabel(raw) {
    if (typeof raw !== 'string') {
      return ''
    }
    const trimmed = raw.trim()
    if (
      trimmed === '' ||
      trimmed === '__EXTENSION_VERSION__' ||
      trimmed === 'v__EXTENSION_VERSION__' ||
      trimmed.indexOf('{{') !== -1
    ) {
      return ''
    }
    return trimmed.charAt(0) === 'v' ? trimmed : 'v' + trimmed
  }

  function applyVersion(raw) {
    const label = formatVersionLabel(raw)
    if (!label) {
      return
    }
    if (extensionVersionEl) {
      setText(extensionVersionEl, label)
    }
    if (toolbarVersionEl) {
      setText(toolbarVersionEl, label)
    }
  }

  function setText(el, text) {
    el.textContent = text
  }

  function addCell(tr, text, className) {
    const td = document.createElement('td')
    setText(td, text)
    if (className) {
      td.className = className
    }
    tr.appendChild(td)
  }

  function el(tag, className) {
    const node = document.createElement(tag)
    if (className) {
      node.className = className
    }
    return node
  }

  function setView(next) {
    queriesViewEl.hidden = next !== 'queries'
    statsViewEl.hidden = next !== 'stats'
    chartsViewEl.hidden = next !== 'charts'
    settingsViewEl.hidden = next !== 'settings'
    tabQueriesEl.classList.toggle('is-active', next === 'queries')
    tabStatsEl.classList.toggle('is-active', next === 'stats')
    tabChartsEl.classList.toggle('is-active', next === 'charts')
    tabSettingsEl.classList.toggle('is-active', next === 'settings')
    if (next === 'charts') {
      drawAllCharts()
    } else if (chartTipEl) {
      chartTipEl.hidden = true
    }
  }

  function svgNode(name, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name)
    if (attrs) {
      const keys = Object.keys(attrs)
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        node.setAttribute(key, attrs[key])
      }
    }
    return node
  }

  function niceMax(value) {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) {
      return 1
    }
    const exp = Math.pow(10, Math.floor(Math.log10(n)))
    const scaled = n / exp
    let nice = 1
    if (scaled > 5) {
      nice = 10
    } else if (scaled > 2) {
      nice = 5
    } else if (scaled > 1) {
      nice = 2
    }
    return nice * exp
  }

  function compactTokens(n) {
    const value = Math.max(0, Number(n) || 0)
    if (value < 1000) {
      return String(Math.round(value))
    }
    if (value < 1_000_000) {
      return (Math.round((value / 1000) * 10) / 10).toFixed(1).replace(/\.0$/, '') + 'k'
    }
    return (Math.round((value / 1_000_000) * 10) / 10).toFixed(1).replace(/\.0$/, '') + 'M'
  }

  function compactCost(n) {
    const value = Math.max(0, Number(n) || 0)
    return value.toFixed(2) + ' $'
  }

  function pointX(index, count, left, plotW) {
    if (count <= 1) {
      return left + plotW / 2
    }
    return left + (index / (count - 1)) * plotW
  }

  function yAt(value, max, top, plotH) {
    if (max <= 0) {
      return top + plotH
    }
    return top + plotH - (value / max) * plotH
  }

  function hideChartTip() {
    if (chartTipEl) {
      chartTipEl.hidden = true
    }
  }

  function showChartTip(point, kind, cumulative, clientX, clientY) {
    if (!chartTipEl || !chartsViewEl) {
      return
    }
    const per =
      kind === 'tokens'
        ? compactTokens(point.tokens) + ' tokens'
        : compactCost(point.costUsd)
    const total =
      kind === 'tokens'
        ? compactTokens(cumulative) + ' tokens total'
        : compactCost(cumulative) + ' total'
    setText(
      chartTipEl,
      point.time +
        '\n' +
        point.model +
        '\n' +
        per +
        '\n' +
        total,
    )
    chartTipEl.hidden = false
    const wrap = chartsViewEl.getBoundingClientRect()
    const tipW = chartTipEl.offsetWidth
    const tipH = chartTipEl.offsetHeight
    let left = clientX - wrap.left + 12
    let top = clientY - wrap.top + 12
    if (left + tipW > wrap.width - 8) {
      left = clientX - wrap.left - tipW - 12
    }
    if (top + tipH > wrap.height - 8) {
      top = clientY - wrap.top - tipH - 12
    }
    chartTipEl.style.setProperty('--chart-tip-x', Math.max(8, left) + 'px')
    chartTipEl.style.setProperty('--chart-tip-y', Math.max(8, top) + 'px')
  }

  function drawChart(svg, points, kind) {
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild)
    }
    const width = 800
    const height = 280
    const left = 52
    const right = 56
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

    const per = []
    const cum = []
    let running = 0
    for (let i = 0; i < points.length; i++) {
      const value = kind === 'tokens' ? points[i].tokens : points[i].costUsd
      const safe = Number.isFinite(value) ? Math.max(0, value) : 0
      per.push(safe)
      running += safe
      cum.push(running)
    }
    const maxPer = niceMax(Math.max.apply(null, per))
    const maxCum = niceMax(running)
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
      setText(leftLabel, format(maxPer * frac))
      svg.appendChild(leftLabel)
      const rightLabel = svgNode('text', {
        class: 'chart-label',
        x: String(left + plotW + 6),
        y: String(y + 3),
        'text-anchor': 'start',
      })
      setText(rightLabel, format(maxCum * frac))
      svg.appendChild(rightLabel)
    }

    const labelAt = [0, Math.floor((points.length - 1) / 2), points.length - 1]
    const seen = {}
    for (let i = 0; i < labelAt.length; i++) {
      const idx = labelAt[i]
      if (idx < 0 || seen[idx]) {
        continue
      }
      seen[idx] = true
      const x = pointX(idx, points.length, left, plotW)
      const label = svgNode('text', {
        class: 'chart-label',
        x: String(x),
        y: String(top + plotH + 16),
        'text-anchor': 'middle',
      })
      setText(label, points[idx].time)
      svg.appendChild(label)
    }

    const showBars = points.length <= 400
    if (showBars) {
      const gap = points.length <= 1 ? plotW : plotW / (points.length - 1)
      const barW = Math.max(1, Math.min(10, gap * 0.55))
      for (let i = 0; i < points.length; i++) {
        const x = pointX(i, points.length, left, plotW)
        const y = yAt(per[i], maxPer, top, plotH)
        const h = top + plotH - y
        if (h <= 0) {
          continue
        }
        svg.appendChild(
          svgNode('rect', {
            class: 'chart-bar',
            x: String(x - barW / 2),
            y: String(y),
            width: String(barW),
            height: String(Math.max(0.5, h)),
          }),
        )
      }
    }

    const linePts = []
    const areaPts = [left + ',' + (top + plotH)]
    for (let i = 0; i < points.length; i++) {
      const x = pointX(i, points.length, left, plotW)
      const y = yAt(cum[i], maxCum, top, plotH)
      linePts.push(x + ',' + y)
      areaPts.push(x + ',' + y)
    }
    areaPts.push(left + plotW + ',' + (top + plotH))
    svg.appendChild(
      svgNode('polygon', {
        class: 'chart-area',
        points: areaPts.join(' '),
      }),
    )
    svg.appendChild(
      svgNode('polyline', {
        class: 'chart-line',
        points: linePts.join(' '),
      }),
    )

    if (points.length <= 80) {
      for (let i = 0; i < points.length; i++) {
        const x = pointX(i, points.length, left, plotW)
        const y = yAt(cum[i], maxCum, top, plotH)
        svg.appendChild(
          svgNode('circle', {
            class: 'chart-dot',
            cx: String(x),
            cy: String(y),
            r: '2.5',
          }),
        )
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
      showChartTip(
        points[best],
        kind,
        cum[best],
        event.clientX,
        event.clientY,
      )
    }
    hit.addEventListener('mousemove', onMove)
    hit.addEventListener('mouseleave', hideChartTip)
    svg.appendChild(hit)
  }

  function drawAllCharts() {
    const empty = !chartPoints || chartPoints.length === 0
    if (chartsEmptyEl) {
      chartsEmptyEl.hidden = !empty
    }
    if (empty) {
      if (chartTokensEl) {
        while (chartTokensEl.firstChild) {
          chartTokensEl.removeChild(chartTokensEl.firstChild)
        }
      }
      if (chartCostEl) {
        while (chartCostEl.firstChild) {
          chartCostEl.removeChild(chartCostEl.firstChild)
        }
      }
      hideChartTip()
      return
    }
    if (chartTokensEl) {
      drawChart(chartTokensEl, chartPoints, 'tokens')
    }
    if (chartCostEl) {
      drawChart(chartCostEl, chartPoints, 'cost')
    }
  }

  function periodCardEl(card) {
    const article = el('article', 'period-card')
    const title = el('h2', 'period-card-title')
    setText(title, card.title)
    article.appendChild(title)
    const cost = el('p', 'period-card-cost')
    setText(cost, card.cost)
    article.appendChild(cost)
    const hint = el('p', 'period-card-hint')
    setText(hint, card.costHint)
    article.appendChild(hint)
    const summary = el('p', 'period-card-summary')
    setText(summary, card.summary)
    article.appendChild(summary)

    const rows = el('dl', 'period-card-rows')
    const list = card.rows || []
    for (let i = 0; i < list.length; i++) {
      const row = list[i]
      const dt = el('dt', row.total ? 'is-total' : undefined)
      setText(dt, row.label)
      const dd = el('dd', row.total ? 'is-total' : undefined)
      setText(dd, row.value)
      rows.appendChild(dt)
      rows.appendChild(dd)
    }
    article.appendChild(rows)

    const mix = el('div', 'period-mix')
    const shares = card.shares || []
    for (let i = 0; i < shares.length; i++) {
      const share = shares[i]
      const pct = Math.max(0, Number(share.percent) || 0)
      if (pct <= 0) {
        continue
      }
      const seg = el('span', 'period-mix-seg is-' + share.key)
      seg.style.width = pct + '%'
      mix.appendChild(seg)
    }
    article.appendChild(mix)

    const legend = el('div', 'period-legend')
    for (let i = 0; i < shares.length; i++) {
      const share = shares[i]
      const item = el('span', 'period-legend-item is-' + share.key)
      setText(item, share.label + ' ' + (Number(share.percent) || 0) + '%')
      legend.appendChild(item)
    }
    article.appendChild(legend)
    return article
  }

  function renderPeriodCards(cards) {
    if (!periodCardsEl) {
      return
    }
    while (periodCardsEl.firstChild) {
      periodCardsEl.removeChild(periodCardsEl.firstChild)
    }
    if (!cards || cards.length === 0) {
      return
    }
    for (let i = 0; i < cards.length; i++) {
      periodCardsEl.appendChild(periodCardEl(cards[i]))
    }
  }

  function meterRow(label, value, percent, variant) {
    const pct = Number(percent)
    const fillPct = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0))
    const row = el('div', 'meter-row')
    const head = el('div', 'meter-head')
    const name = el('span', 'meter-label')
    setText(name, label)
    const amount = el('span', 'meter-value')
    setText(amount, value)
    head.appendChild(name)
    head.appendChild(amount)
    const track = el('div', 'meter-track')
    const fill = el('div', 'meter-fill')
    fill.style.width = fillPct + '%'
    const neutral =
      variant === 'neutral' ||
      (variant !== 'share' && typeof value === 'string' && value.includes('/ —'))
    if (variant === 'share') {
      fill.classList.add('is-share')
    } else if (neutral) {
      fill.classList.add('is-neutral')
    } else if (fillPct >= 100) {
      fill.classList.add('is-warn')
    }
    track.appendChild(fill)
    row.appendChild(head)
    row.appendChild(track)
    return row
  }

  function glossaryCard(item) {
    const card = el('article', 'status-block')
    const title = el('h3')
    setText(title, item.title)
    card.appendChild(title)
    const value = el('p', 'stats-value stats-value-hero')
    setText(value, item.value)
    card.appendChild(value)
    const bars = item.bars || []
    if (bars.length > 0) {
      const meters = el('div', 'meter-list meter-list-tight')
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        meters.appendChild(meterRow(bar.label, bar.value, bar.percent, 'usage'))
      }
      card.appendChild(meters)
    }
    if (item.body) {
      const body = el('p', 'stats-hint')
      setText(body, item.body)
      card.appendChild(body)
    }
    return card
  }

  function breakdownChart(rows, title) {
    const panel = el('div', 'breakdown-panel')
    if (title) {
      const heading = el('h3', 'breakdown-title')
      setText(heading, title)
      panel.appendChild(heading)
    }
    const wrap = el('div', 'meter-list')
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const detail = row.share ? row.value + ' · ' + row.share : row.value
      wrap.appendChild(meterRow(row.label, detail, row.percent, 'share'))
    }
    panel.appendChild(wrap)
    return panel
  }

  function metricCard(item, options) {
    const card = el('article', 'stats-card')
    if (options && options.primary) {
      card.classList.add('is-primary')
    }
    if (options && options.highlight) {
      card.classList.add('is-highlight')
    }
    if (options && options.wide) {
      card.classList.add('is-wide')
    }
    const title = el('h3')
    setText(title, item.label || item.title)
    card.appendChild(title)
    const value = el('p', 'stats-value')
    setText(value, item.value)
    card.appendChild(value)
    if (item.hint) {
      const hint = el('p', 'stats-hint')
      setText(hint, item.hint)
      card.appendChild(hint)
    }
    return card
  }

  function metricGrid(items, className) {
    const grid = el('div', 'stats-grid ' + (className || ''))
    for (let i = 0; i < items.length; i++) {
      grid.appendChild(items[i])
    }
    return grid
  }

  function cycleStrip(items) {
    const wrap = el('div', 'cycle-strip')
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const chip = el('div', 'cycle-chip')
      const label = el('span', 'cycle-chip-label')
      setText(label, item.label)
      const value = el('span', 'cycle-chip-value')
      setText(value, item.value)
      chip.appendChild(label)
      chip.appendChild(value)
      wrap.appendChild(chip)
    }
    return wrap
  }

  function appendSampleMetrics(section, sample, spikeCount, historyLimit) {
    if (!sample || sample.length === 0) {
      return
    }
    const byLabel = {}
    for (let i = 0; i < sample.length; i++) {
      const item = sample[i]
      byLabel[item.label] = item
    }
    const heading = lastHeading(historyLimit)
    const totalLabel = heading + ' total'
    const tokensLabel = 'Tokens in ' + heading
    const primaryLabels = [
      totalLabel,
      'Average per query',
      'Queries over token warning',
    ]
    const primary = []
    for (let i = 0; i < primaryLabels.length; i++) {
      const item = byLabel[primaryLabels[i]]
      if (item) {
        primary.push(
          metricCard(item, {
            primary: true,
            highlight:
              item.label === 'Queries over token warning' && spikeCount > 0,
          }),
        )
      }
    }
    if (primary.length > 0) {
      section.appendChild(metricGrid(primary, 'stats-grid-primary'))
    }

    const detailLabels = [
      'Average per query tokens',
      tokensLabel,
      'Most expensive query',
      'Heaviest query',
      'Busiest day',
    ]
    const detail = []
    for (let i = 0; i < detailLabels.length; i++) {
      const item = byLabel[detailLabels[i]]
      if (item) {
        detail.push(metricCard(item, { wide: item.label === tokensLabel }))
      }
    }
    if (detail.length > 0) {
      section.appendChild(metricGrid(detail, 'stats-grid-detail'))
    }
  }

  function spikeCountFromSample(sample) {
    if (!sample) {
      return 0
    }
    for (let i = 0; i < sample.length; i++) {
      const item = sample[i]
      if (item.label === 'Queries over token warning') {
        const n = Number(item.value)
        return Number.isFinite(n) ? n : 0
      }
    }
    return 0
  }

  function section(title) {
    const wrap = el('section', 'stats-section')
    const heading = el('h2')
    setText(heading, title)
    wrap.appendChild(heading)
    return wrap
  }

  function renderStats(stats) {
    while (statsEl.firstChild) {
      statsEl.removeChild(statsEl.firstChild)
    }
    if (!stats) {
      return
    }

    const glossary = section('Status bar')
    const glossaryGrid = el('div', 'status-explain')
    const items = stats.glossary || []
    for (let i = 0; i < items.length; i++) {
      glossaryGrid.appendChild(glossaryCard(items[i]))
    }
    glossary.appendChild(glossaryGrid)
    statsEl.appendChild(glossary)

    if (stats.cycle && stats.cycle.length > 0) {
      const cycle = section('Billing cycle')
      cycle.appendChild(cycleStrip(stats.cycle))
      statsEl.appendChild(cycle)
    }

    const sample = section(lastHeading(stats.historyLimit) + ' summary')
    const note = el('p', 'stats-note')
    setText(note, stats.sampleNote || '')
    sample.appendChild(note)
    appendSampleMetrics(
      sample,
      stats.sample,
      spikeCountFromSample(stats.sample),
      stats.historyLimit,
    )
    statsEl.appendChild(sample)

    if (
      (stats.byModel && stats.byModel.length > 0) ||
      (stats.byKind && stats.byKind.length > 0)
    ) {
      const breakdown = section('Spend breakdown')
      const split = el('div', 'breakdown-split')
      if (stats.byModel && stats.byModel.length > 0) {
        split.appendChild(breakdownChart(stats.byModel, 'By model'))
      }
      if (stats.byKind && stats.byKind.length > 0) {
        split.appendChild(breakdownChart(stats.byKind, 'By kind'))
      }
      breakdown.appendChild(split)
      statsEl.appendChild(breakdown)
    }
  }

  function applyTheme(okColor, warnColor) {
    if (okColor) {
      document.documentElement.style.setProperty('--cost-ok', okColor)
    }
    if (warnColor) {
      document.documentElement.style.setProperty('--cost-warn', warnColor)
    }
  }

  const TOKEN_K = 1000

  const KILO_STEP = 100

  function snapKilo(kilo) {
    const n = Math.round(Number(kilo))
    if (!Number.isFinite(n) || n < 1) {
      return 1
    }
    if (n < KILO_STEP) {
      return n
    }
    return Math.round(n / KILO_STEP) * KILO_STEP
  }

  function tokensFromKilo(kilo) {
    const n = snapKilo(kilo)
    return Math.max(TOKEN_K, n * TOKEN_K)
  }

  function kiloFromTokens(tokens) {
    const n = Math.round(Number(tokens) / TOKEN_K)
    if (!Number.isFinite(n) || n < 1) {
      return 1
    }
    return n
  }

  function tokenPreview(tokens) {
    const n = Math.max(0, Math.round(Number(tokens)))
    const grouped = n.toLocaleString('en-US')
    if (n >= 1_000_000) {
      const millions = n / 1_000_000
      const compact =
        millions >= 10
          ? String(Math.round(millions))
          : millions.toFixed(1).replace(/\.0$/, '')
      return grouped + ' tokens  ·  ' + compact + 'M'
    }
    if (n >= 1000) {
      return grouped + ' tokens  ·  ' + Math.round(n / 1000) + 'k'
    }
    return grouped + ' tokens'
  }

  function updateThresholdPreview() {
    setText(thresholdPreviewEl, tokenPreview(tokensFromKilo(thresholdEl.value)))
  }

  function fillIfIdle(inputEl, value) {
    if (document.activeElement === inputEl) {
      return
    }
    inputEl.value = value
  }

  function renderSettings(data) {
    if (typeof data.spikeTokenThreshold === 'number') {
      fillIfIdle(thresholdEl, String(kiloFromTokens(data.spikeTokenThreshold)))
      if (document.activeElement !== thresholdEl) {
        updateThresholdPreview()
      }
    }
    if (
      typeof data.showSpikeWarning === 'boolean' &&
      document.activeElement !== showWarningEl
    ) {
      showWarningEl.checked = data.showSpikeWarning
    }
    if (typeof data.okColor === 'string') {
      fillIfIdle(okColorEl, data.okColor)
      setText(okColorValueEl, data.okColor)
    }
    if (typeof data.warnColor === 'string') {
      fillIfIdle(warnColorEl, data.warnColor)
      setText(warnColorValueEl, data.warnColor)
    }
    applyTheme(data.okColor, data.warnColor)
    applyVersion(data.extensionVersion)
    if (typeof data.historyLimit === 'number') {
      fillIfIdle(historyLimitEl, String(clampHistoryLimit(data.historyLimit)))
      applyHistoryTitle(data.historyLimit)
    }
  }

  function render(events, message, stats, settings) {
    if (message) {
      statusEl.hidden = false
      setText(statusEl, message)
    } else {
      statusEl.hidden = true
      setText(statusEl, '')
    }

    renderSettings(settings)

    while (rowsEl.firstChild) {
      rowsEl.removeChild(rowsEl.firstChild)
    }

    const warnOn = settings.showSpikeWarning !== false
    if (!events || events.length === 0) {
      emptyEl.hidden = false
    } else {
      emptyEl.hidden = true
      for (let i = 0; i < events.length; i++) {
        const row = events[i]
        const tr = document.createElement('tr')
        addCell(tr, row.time)
        addCell(tr, row.model)
        addCell(tr, row.cost)
        const spike =
          warnOn &&
          typeof row.tokens === 'string' &&
          row.tokens.indexOf('!') !== -1
        addCell(tr, row.tokens, spike ? 'tokens-spike' : undefined)
        addCell(tr, row.inputOutput)
        addCell(tr, row.kind)
        rowsEl.appendChild(tr)
      }
    }

    renderStats(stats)
    chartPoints = Array.isArray(settings.charts) ? settings.charts : []
    renderPeriodCards(settings.periods)
    if (!chartsViewEl.hidden) {
      drawAllCharts()
    }
  }

  function submitThreshold() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = 0
    }
    const kilo = snapKilo(thresholdEl.value)
    thresholdEl.value = String(kilo)
    const value = tokensFromKilo(kilo)
    updateThresholdPreview()
    vscode.postMessage({ type: 'setSpikeThreshold', value: value })
  }

  function scheduleSubmit() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    updateThresholdPreview()
    debounceTimer = setTimeout(submitThreshold, 300)
  }

  function submitColors() {
    vscode.postMessage({ type: 'setOkColor', value: okColorEl.value })
    vscode.postMessage({ type: 'setWarnColor', value: warnColorEl.value })
  }

  function scheduleColors() {
    setText(okColorValueEl, okColorEl.value)
    setText(warnColorValueEl, warnColorEl.value)
    applyTheme(okColorEl.value, warnColorEl.value)
    if (colorTimer) {
      clearTimeout(colorTimer)
    }
    colorTimer = setTimeout(submitColors, 300)
  }

  window.addEventListener('message', function (event) {
    const data = event.data
    if (!data || data.type !== 'data') {
      return
    }
    render(data.events, data.message, data.stats, data)
  })

  thresholdEl.addEventListener('input', scheduleSubmit)
  thresholdEl.addEventListener('change', submitThreshold)
  thresholdEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      submitThreshold()
      thresholdEl.blur()
    }
  })
  applyEl.addEventListener('click', submitThreshold)
  function submitHistoryLimit() {
    if (historyTimer) {
      clearTimeout(historyTimer)
      historyTimer = 0
    }
    const value = clampHistoryLimit(historyLimitEl.value)
    historyLimitEl.value = String(value)
    applyHistoryTitle(value)
    vscode.postMessage({ type: 'setHistoryLimit', value: value })
  }

  function scheduleHistoryLimit() {
    if (historyTimer) {
      clearTimeout(historyTimer)
    }
    historyTimer = setTimeout(submitHistoryLimit, 300)
  }

  historyLimitEl.addEventListener('input', scheduleHistoryLimit)
  historyLimitEl.addEventListener('change', submitHistoryLimit)
  historyLimitEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      submitHistoryLimit()
      historyLimitEl.blur()
    }
  })
  applyHistoryLimitEl.addEventListener('click', submitHistoryLimit)
  showWarningEl.addEventListener('change', function () {
    vscode.postMessage({
      type: 'setShowSpikeWarning',
      value: showWarningEl.checked === true,
    })
  })
  okColorEl.addEventListener('input', scheduleColors)
  warnColorEl.addEventListener('input', scheduleColors)
  resetColorsEl.addEventListener('click', function () {
    okColorEl.value = DEFAULT_OK
    warnColorEl.value = DEFAULT_WARN
    submitColors()
  })
  settingsFormEl.addEventListener('submit', function (event) {
    event.preventDefault()
  })
  tabQueriesEl.addEventListener('click', function () {
    setView('queries')
  })
  tabStatsEl.addEventListener('click', function () {
    setView('stats')
  })
  tabChartsEl.addEventListener('click', function () {
    setView('charts')
  })
  tabSettingsEl.addEventListener('click', function () {
    setView('settings')
  })

  closeEl.addEventListener('click', function () {
    vscode.postMessage({ type: 'close' })
  })

  window.addEventListener('resize', function () {
    if (chartResizeTimer) {
      clearTimeout(chartResizeTimer)
    }
    chartResizeTimer = setTimeout(function () {
      if (!chartsViewEl.hidden) {
        drawAllCharts()
      }
    }, 150)
  })

  vscode.postMessage({ type: 'ready' })
  applyVersion(document.documentElement.getAttribute('data-version'))
})()
