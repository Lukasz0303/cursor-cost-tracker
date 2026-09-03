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
  const historyLimitBarEl = document.getElementById('historyLimitBar')
  const applyHistoryLimitBarEl = document.getElementById('applyHistoryLimitBar')
  const spikesOnlyEl = document.getElementById('spikesOnly')
  const refreshQueriesEl = document.getElementById('refreshQueries')
  const showWarningEl = document.getElementById('showWarning')
  const showCriticalAlertEl = document.getElementById('showCriticalAlert')
  const criticalTokenEl = document.getElementById('criticalTokenThreshold')
  const criticalTokenPreviewEl = document.getElementById('criticalTokenPreview')
  const criticalCostEl = document.getElementById('criticalCostThreshold')
  const applyCriticalAlertEl = document.getElementById('applyCriticalAlert')
  const showStatusBarEl = document.getElementById('showStatusBar')
  const showTodayEl = document.getElementById('showToday')
  const minimalModeEl = document.getElementById('minimalMode')
  const recentQueryCountEl = document.getElementById('recentQueryCount')
  const pollIntervalEl = document.getElementById('pollInterval')
  const applyPollIntervalEl = document.getElementById('applyPollInterval')
  const statusBarPreviewEl = document.getElementById('statusBarPreview')
  const statusBarPreviewEmptyEl = document.getElementById('statusBarPreviewEmpty')
  const okColorEl = document.getElementById('okColor')
  const warnColorEl = document.getElementById('warnColor')
  const okColorValueEl = document.getElementById('okColorValue')
  const warnColorValueEl = document.getElementById('warnColorValue')
  const resetColorsEl = document.getElementById('resetColors')
  const settingsFormEl = document.getElementById('settingsForm')
  const queriesViewEl = document.getElementById('queriesView')
  const statsViewEl = document.getElementById('statsView')
  const statsEl = document.getElementById('stats')
  const statsChartTipEl = document.getElementById('statsChartTip')
  const chartsViewEl = document.getElementById('chartsView')
  const chartsEmptyEl = document.getElementById('chartsEmpty')
  const chartTokensEl = document.getElementById('chartTokens')
  const chartCostEl = document.getElementById('chartCost')
  const chartsMtdEl = document.getElementById('chartsMtd')
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
  let historyLimitDirty = false
  let pollIntervalDirty = false
  let thresholdDirty = false
  let criticalTokenDirty = false
  let criticalCostDirty = false
  const historyLimitEls = [historyLimitEl, historyLimitBarEl].filter(Boolean)
  let chartPoints = []
  let mtdForecastPoints = []
  let mtdForecastSeries = []
  let mtdUnit = 'usd'
  let mtdMax = null
  let mtdChartRange = 'month'
  let mtdForecastSvgs = []
  let chartResizeTimer = 0
  let tableEvents = []
  let tableWarnOn = true
  let spikesOnly = false
  const MIN_HISTORY = 100
  const MAX_HISTORY = 10000
  const DEFAULT_HISTORY = 1000
  const MIN_POLL = 1
  const MAX_POLL = 60
  const DEFAULT_POLL = 1
  const MIN_RECENT_QUERY_COUNT = 1
  const MAX_RECENT_QUERY_COUNT = 10
  const DEFAULT_RECENT_QUERY_COUNT = 3

  const BAR_ICON_PATHS = {
    'credit-card':
      'M2.5 3A1.5 1.5 0 0 0 1 4.5v7A1.5 1.5 0 0 0 2.5 13h11A1.5 1.5 0 0 0 15 11.5v-7A1.5 1.5 0 0 0 13.5 3h-11zm0 1h11a.5.5 0 0 1 .5.5V6H2V4.5a.5.5 0 0 1 .5-.5zM2 7.5h12v4a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-4z',
    calendar:
      'M5.75 1a.75.75 0 0 1 .75.75V3h3.5V1.75a.75.75 0 0 1 1.5 0V3H13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h1.5V1.75A.75.75 0 0 1 5.75 1zM3 4.5a.5.5 0 0 0-.5.5v1h11V5a.5.5 0 0 0-.5-.5H3zM2.5 7v6a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V7h-11z',
    // Codicon `sync` — same glyph as status-bar `$(sync)`.
    sync: 'M14 3.5v3c0 .28-.22.5-.5.5h-3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h2.08c-.8-1.83-2.57-3-4.58-3c-2.22 0-4.2 1.5-4.81 3.64c-.06.22-.26.36-.48.36c-.05 0-.09 0-.14-.02a.493.493 0 0 1-.34-.62C2.96 3.79 5.33 2 8 2c2.05 0 3.91 1.02 5 2.69V3.5c0-.28.22-.5.5-.5s.5.22.5.5m-.58 5.52a.51.51 0 0 0-.62.35a5.02 5.02 0 0 1-4.81 3.64c-2.01 0-3.78-1.17-4.58-3h2.08c.28 0 .5-.22.5-.5s-.22-.5-.5-.5h-3c-.28 0-.5.22-.5.5v3c0 .28.22.5.5.5s.5-.22.5-.5v-1.19a5.97 5.97 0 0 0 5 2.69c2.67 0 5.04-1.79 5.77-4.36a.5.5 0 0 0-.35-.62z',
    warning:
      'M8.86 2.49a1 1 0 0 0-1.72 0L1.2 12.26A1 1 0 0 0 2.06 13.8h11.88a1 1 0 0 0 .86-1.54L8.86 2.49zM8 6.25a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0V7A.75.75 0 0 1 8 6.25zM8.8 11.6a.8.8 0 1 1-1.6 0 .8.8 0 0 1 1.6 0z',
    loading:
      'M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm0 1.5a5 5 0 1 0 .01 10.01A5 5 0 0 0 8 3z',
  }

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

  function clampPollInterval(value) {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n)) {
      return DEFAULT_POLL
    }
    if (n < MIN_POLL) {
      return MIN_POLL
    }
    if (n > MAX_POLL) {
      return MAX_POLL
    }
    return n
  }

  function clampRecentQueryCount(value) {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n)) {
      return DEFAULT_RECENT_QUERY_COUNT
    }
    if (n < MIN_RECENT_QUERY_COUNT) {
      return MIN_RECENT_QUERY_COUNT
    }
    if (n > MAX_RECENT_QUERY_COUNT) {
      return MAX_RECENT_QUERY_COUNT
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

  function applyRefreshing(refreshing) {
    if (!refreshQueriesEl) {
      return
    }
    const busy = refreshing === true
    refreshQueriesEl.disabled = busy
    refreshQueriesEl.setAttribute('aria-busy', busy ? 'true' : 'false')
    setText(refreshQueriesEl, busy ? 'Refreshing…' : 'Refresh')
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

  function barIcon(name, spin) {
    const wrap = el('span', 'bar-icon' + (spin ? ' is-spin' : ''))
    const pathD = BAR_ICON_PATHS[name]
    if (!pathD) {
      return wrap
    }
    const svg = svgNode('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' })
    const path = svgNode('path', { d: pathD })
    svg.appendChild(path)
    wrap.appendChild(svg)
    return wrap
  }

  let lastStatusBarPreview = null

  function previewRecentLimit() {
    if (minimalModeEl && minimalModeEl.checked) {
      return 0
    }
    if (showStatusBarEl && showStatusBarEl.checked === false) {
      return 0
    }
    if (!recentQueryCountEl) {
      return DEFAULT_RECENT_QUERY_COUNT
    }
    return clampRecentQueryCount(recentQueryCountEl.value)
  }

  function renderStatusBarPreview(chips) {
    if (!statusBarPreviewEl) {
      return
    }
    if (Array.isArray(chips)) {
      lastStatusBarPreview = chips
    }
    const list = Array.isArray(lastStatusBarPreview) ? lastStatusBarPreview : []
    const barOn = !showStatusBarEl || showStatusBarEl.checked !== false
    const recentLimit = previewRecentLimit()
    while (statusBarPreviewEl.firstChild) {
      statusBarPreviewEl.removeChild(statusBarPreviewEl.firstChild)
    }
    const visible = []
    if (barOn) {
      for (let i = 0; i < list.length; i++) {
        const chip = list[i]
        if (!chip) {
          continue
        }
        if (typeof chip.id === 'string' && chip.id.indexOf('recent-') === 0) {
          const index = Number(chip.id.slice('recent-'.length))
          if (!Number.isFinite(index) || index >= recentLimit) {
            continue
          }
          visible.push(chip)
          continue
        }
        if (chip.visible) {
          visible.push(chip)
        }
      }
    }
    const hidden = visible.length === 0
    statusBarPreviewEl.classList.toggle('is-hidden', hidden)
    if (statusBarPreviewEmptyEl) {
      statusBarPreviewEmptyEl.hidden = !hidden
    }
    if (hidden) {
      return
    }
    for (let i = 0; i < visible.length; i++) {
      const chip = visible[i]
      const node = el('span', 'bar-chip')
      if (chip.tone === 'green') {
        node.classList.add('is-green')
      } else if (chip.tone === 'red') {
        node.classList.add('is-red')
      }
      const segs = chip.segments || []
      for (let s = 0; s < segs.length; s++) {
        const seg = segs[s]
        const part = el('span', 'bar-seg')
        if (seg.icon && BAR_ICON_PATHS[seg.icon]) {
          part.appendChild(barIcon(seg.icon, seg.spin === true))
        }
        if (seg.body) {
          const body = el('span')
          setText(body, seg.body)
          part.appendChild(body)
        }
        node.appendChild(part)
      }
      statusBarPreviewEl.appendChild(node)
    }
  }

  function syncBarEditorState() {
    const minimal = minimalModeEl && minimalModeEl.checked
    if (showTodayEl) {
      showTodayEl.disabled = Boolean(minimal)
    }
    if (recentQueryCountEl) {
      recentQueryCountEl.disabled = Boolean(minimal)
    }
    renderStatusBarPreview(lastStatusBarPreview)
  }

  function setView(next) {
    const tab =
      next === 'stats' ||
      next === 'charts' ||
      next === 'settings' ||
      next === 'queries'
        ? next
        : 'queries'
    queriesViewEl.hidden = tab !== 'queries'
    statsViewEl.hidden = tab !== 'stats'
    if (chartsViewEl) {
      chartsViewEl.hidden = tab !== 'charts'
    }
    settingsViewEl.hidden = tab !== 'settings'
    tabQueriesEl.classList.toggle('is-active', tab === 'queries')
    tabStatsEl.classList.toggle('is-active', tab === 'stats')
    if (tabChartsEl) {
      tabChartsEl.classList.toggle('is-active', tab === 'charts')
    }
    tabSettingsEl.classList.toggle('is-active', tab === 'settings')
    if (tab === 'charts' || tab === 'stats') {
      drawAllCharts()
    } else {
      hideChartTips()
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

  function chartBarRect(x, y, barW, h, className) {
    const radius = Math.min(2.2, barW / 2)
    return svgNode('rect', {
      class: className || 'chart-bar',
      x: String(x - barW / 2),
      y: String(y),
      width: String(barW),
      height: String(Math.max(0.5, h)),
      rx: String(radius),
      ry: String(radius),
    })
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

  function compactPercent(n) {
    const value = Math.max(0, Number(n) || 0)
    const tenths = Math.round(value * 10) / 10
    if (Math.abs(tenths - Math.round(tenths)) < 0.05) {
      return Math.round(tenths) + '%'
    }
    return tenths.toFixed(1) + '%'
  }

  function formatMtdAmount(n) {
    if (mtdUnit === 'percent') {
      return compactPercent(n)
    }
    return compactCost(n)
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
    hideChartTips()
  }

  function hideChartTips() {
    if (chartTipEl) {
      chartTipEl.hidden = true
    }
    if (statsChartTipEl) {
      statsChartTipEl.hidden = true
    }
  }

  function placeTip(tipEl, wrapEl, clientX, clientY) {
    if (!tipEl || !wrapEl) {
      return
    }
    tipEl.hidden = false
    const wrap = wrapEl.getBoundingClientRect()
    const tipW = tipEl.offsetWidth
    const tipH = tipEl.offsetHeight
    let left = clientX - wrap.left + 12
    let top = clientY - wrap.top + 12
    if (left + tipW > wrap.width - 8) {
      left = clientX - wrap.left - tipW - 12
    }
    if (top + tipH > wrap.height - 8) {
      top = clientY - wrap.top - tipH - 12
    }
    tipEl.style.setProperty('--chart-tip-x', Math.max(8, left) + 'px')
    tipEl.style.setProperty('--chart-tip-y', Math.max(8, top) + 'px')
  }

  function tipTitle(text) {
    const node = el('p', 'chart-tip-title')
    setText(node, text)
    return node
  }

  function tipSub(text) {
    const node = el('p', 'chart-tip-sub')
    setText(node, text)
    return node
  }

  function tipRow(label, value) {
    const row = el('div', 'chart-tip-row')
    const labelEl = el('span', 'chart-tip-label')
    const valueEl = el('span', 'chart-tip-value')
    setText(labelEl, label)
    setText(valueEl, value)
    row.appendChild(labelEl)
    row.appendChild(valueEl)
    return row
  }

  function placeChartTip(clientX, clientY) {
    placeTip(chartTipEl, chartsViewEl, clientX, clientY)
  }

  function costOrDash(n) {
    if (n === null || n === undefined || n === '') {
      return '—'
    }
    const value = Number(n)
    if (!Number.isFinite(value)) {
      return '—'
    }
    return formatMtdAmount(value)
  }

  function mtdTipHost(svg) {
    if (statsViewEl && svg && statsViewEl.contains(svg)) {
      return { tip: statsChartTipEl, wrap: statsViewEl }
    }
    return { tip: chartTipEl, wrap: chartsViewEl }
  }

  function showMtdForecastTip(point, lines, index, clientX, clientY, svg) {
    const host = mtdTipHost(svg)
    if (!host.tip || !host.wrap || !point) {
      return
    }
    host.tip.replaceChildren()
    host.tip.appendChild(tipTitle(point.date))
    host.tip.appendChild(
      tipSub(
        point.weekday && point.workingDayIndex
          ? 'Working day ' + point.workingDayIndex
          : 'Weekend',
      ),
    )
    const list = lines || []
    for (let i = 0; i < list.length; i++) {
      const line = list[i]
      const label = line.label || 'Used'
      if (line.day && line.day[index] !== null && line.day[index] !== undefined) {
        host.tip.appendChild(
          tipRow(label + ' that day', costOrDash(line.day[index])),
        )
      }
      if (line.used && line.used[index] !== null && line.used[index] !== undefined) {
        host.tip.appendChild(tipRow(label, costOrDash(line.used[index])))
      }
      if (
        line.forecast &&
        line.forecast[index] !== null &&
        line.forecast[index] !== undefined
      ) {
        host.tip.appendChild(
          tipRow(label + ' forecast', costOrDash(line.forecast[index])),
        )
      }
      if (
        line.ideal &&
        line.ideal[index] !== null &&
        line.ideal[index] !== undefined
      ) {
        host.tip.appendChild(
          tipRow(label + ' ideal', costOrDash(line.ideal[index])),
        )
      }
    }
    placeTip(host.tip, host.wrap, clientX, clientY)
  }

  function showChartTip(point, kind, cumulative, clientX, clientY) {
    if (!chartTipEl || !chartsViewEl) {
      return
    }
    const per =
      kind === 'tokens' ? compactTokens(point.tokens) : compactCost(point.costUsd)
    const total =
      kind === 'tokens' ? compactTokens(cumulative) : compactCost(cumulative)
    chartTipEl.replaceChildren()
    chartTipEl.appendChild(tipTitle(point.time))
    chartTipEl.appendChild(tipSub(point.model))
    chartTipEl.appendChild(tipRow(kind === 'tokens' ? 'Tokens' : 'Cost', per))
    chartTipEl.appendChild(tipRow('Total', total))
    placeChartTip(clientX, clientY)
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
        svg.appendChild(chartBarRect(x, y, barW, h))
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

  function clearSvg(svg) {
    if (!svg) {
      return
    }
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild)
    }
  }

  function numericMax(values) {
    let max = 0
    for (let i = 0; i < values.length; i++) {
      const n = Number(values[i])
      if (Number.isFinite(n) && n > max) {
        max = n
      }
    }
    return max
  }

  function numbersOrNull(list) {
    const out = []
    const source = Array.isArray(list) ? list : []
    for (let i = 0; i < source.length; i++) {
      const raw = source[i]
      if (raw === null || raw === undefined) {
        out.push(null)
        continue
      }
      const n = Number(raw)
      out.push(Number.isFinite(n) ? Math.max(0, n) : 0)
    }
    return out
  }

  function appendLine(svg, values, max, left, plotW, top, plotH, className) {
    const pts = []
    for (let i = 0; i < values.length; i++) {
      const raw = values[i]
      if (raw === null || raw === undefined) {
        continue
      }
      const n = Number(raw)
      if (!Number.isFinite(n)) {
        continue
      }
      const x = pointX(i, values.length, left, plotW)
      const y = yAt(Math.min(Math.max(0, n), max), max, top, plotH)
      pts.push(x + ',' + y)
    }
    if (pts.length === 0) {
      return
    }
    svg.appendChild(
      svgNode('polyline', {
        class: className,
        points: pts.join(' '),
      }),
    )
  }

  function todayIndexFromSeries(series) {
    const primary = Array.isArray(series) && series[0] ? series[0] : null
    const used = primary && Array.isArray(primary.used) ? primary.used : []
    let todayIdx = -1
    for (let i = 0; i < used.length; i++) {
      if (used[i] !== null && used[i] !== undefined) {
        todayIdx = i
      }
    }
    return todayIdx
  }

  function mtdRangeWindow(count, todayIdx, range) {
    if (count <= 0) {
      return { start: 0, end: -1 }
    }
    if (range === 'month' || todayIdx < 0) {
      return { start: 0, end: count - 1 }
    }
    if (range === 'today') {
      return {
        start: Math.max(0, todayIdx - 1),
        end: Math.min(count - 1, todayIdx + 1),
      }
    }
    // 7 days: prefer today near the middle, clamp to the month.
    let start = Math.max(0, todayIdx - 3)
    let end = Math.min(count - 1, start + 6)
    start = Math.max(0, end - 6)
    return { start, end }
  }

  function sliceSeriesArrays(series, start, end) {
    const out = []
    for (let i = 0; i < series.length; i++) {
      const row = series[i]
      const sliceArr = function (list) {
        if (!Array.isArray(list)) {
          return []
        }
        return list.slice(start, end + 1)
      }
      out.push({
        id: row.id,
        label: row.label,
        day: sliceArr(row.day),
        used: sliceArr(row.used),
        forecast: sliceArr(row.forecast),
        ideal: sliceArr(row.ideal),
        runOutDate: row.runOutDate,
        runOutLabel: row.runOutLabel,
      })
    }
    return out
  }

  function visibleMtdChart(points, series, range) {
    const sourcePoints = Array.isArray(points) ? points : []
    const sourceSeries = Array.isArray(series) ? series : []
    const todayIdx = todayIndexFromSeries(sourceSeries)
    const win = mtdRangeWindow(sourcePoints.length, todayIdx, range)
    if (win.end < win.start) {
      return { points: [], series: [] }
    }
    return {
      points: sourcePoints.slice(win.start, win.end + 1),
      series: sliceSeriesArrays(sourceSeries, win.start, win.end),
    }
  }

  function redrawMtdForecastChart() {
    if (!mtdForecastSvgs.length) {
      return
    }
    const visible = visibleMtdChart(
      mtdForecastPoints,
      mtdForecastSeries,
      mtdChartRange,
    )
    for (let i = 0; i < mtdForecastSvgs.length; i++) {
      drawMtdForecastChart(
        mtdForecastSvgs[i],
        visible.points,
        visible.series,
        mtdMax,
      )
    }
  }

  function syncMtdRangeButtons() {
    const buttons = document.querySelectorAll('.mtd-range-btn')
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle(
        'is-active',
        buttons[i].getAttribute('data-range') === mtdChartRange,
      )
    }
  }

  function setMtdChartRange(id) {
    if (mtdChartRange === id) {
      return
    }
    mtdChartRange = id
    syncMtdRangeButtons()
    redrawMtdForecastChart()
  }

  function mtdRangeToggle() {
    const wrap = el('div', 'mtd-range')
    wrap.setAttribute('role', 'group')
    wrap.setAttribute('aria-label', 'Chart range')
    const options = [
      { id: 'today', label: 'Today' },
      { id: '7d', label: '7 days' },
      { id: 'month', label: 'Month' },
    ]
    for (let i = 0; i < options.length; i++) {
      const opt = options[i]
      const btn = el('button', 'mtd-range-btn')
      btn.type = 'button'
      btn.setAttribute('data-range', opt.id)
      if (mtdChartRange === opt.id) {
        btn.classList.add('is-active')
      }
      setText(btn, opt.label)
      btn.addEventListener('click', function () {
        setMtdChartRange(opt.id)
      })
      wrap.appendChild(btn)
    }
    return wrap
  }

  function drawMtdForecastChart(svg, points, series, max) {
    clearSvg(svg)
    const width = 800
    const height = 280
    const left = 52
    const right = 56
    const top = 16
    const bottom = 36
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
    svg.appendChild(
      svgNode('line', {
        class: 'chart-axis',
        x1: String(left + plotW),
        y1: String(top),
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
        label: String(rawSeries[i].label || 'Used'),
        tone: 'is-s' + (i % 4),
        day: numbersOrNull(rawSeries[i].day),
        used: numbersOrNull(rawSeries[i].used),
        forecast: numbersOrNull(rawSeries[i].forecast),
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

    let maxDay = 0
    let dataMax = 0
    let hasIdeal = false
    for (let i = 0; i < lines.length; i++) {
      maxDay = Math.max(maxDay, numericMax(lines[i].day))
      dataMax = Math.max(
        dataMax,
        numericMax(lines[i].used),
        numericMax(lines[i].forecast),
        numericMax(lines[i].ideal),
      )
      if (numericMax(lines[i].ideal) > 0) {
        hasIdeal = true
      }
    }
    const maxPer = niceMax(maxDay)
    const capped = typeof max === 'number' && Number.isFinite(max) && max > 0
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
      setText(leftLabel, formatMtdAmount(maxPer * frac))
      svg.appendChild(leftLabel)
      const rightLabel = svgNode('text', {
        class: 'chart-label',
        x: String(left + plotW + 6),
        y: String(y + 3),
        'text-anchor': 'start',
      })
      setText(rightLabel, formatMtdAmount(maxCum * frac))
      svg.appendChild(rightLabel)
    }

    const labelAt = [0, Math.floor((points.length - 1) / 2), points.length - 1]
    if (todayIdx > 0 && todayIdx < points.length - 1) {
      labelAt.push(todayIdx)
    }
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
      setText(label, points[idx].date)
      svg.appendChild(label)
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

    const gap = points.length <= 1 ? plotW : plotW / (points.length - 1)
    const groupW = Math.max(2, Math.min(18, gap * 0.6))
    const barW = Math.max(2, groupW / Math.max(1, lines.length))
    for (let i = 0; i < points.length; i++) {
      const cx = pointX(i, points.length, left, plotW)
      for (let s = 0; s < lines.length; s++) {
        const dayVal = lines[s].day[i]
        if (dayVal === null || dayVal === undefined || !(dayVal > 0)) {
          continue
        }
        const offset = (s - (lines.length - 1) / 2) * barW
        const y = yAt(dayVal, maxPer, top, plotH)
        const h = top + plotH - y
        if (h <= 0) {
          continue
        }
        svg.appendChild(
          chartBarRect(cx + offset, y, barW * 0.9, h, 'chart-bar ' + lines[s].tone),
        )
      }
    }

    // Area under primary cumulative used.
    if (lines.length >= 1) {
      const areaPts = [left + ',' + (top + plotH)]
      let lastUsedX = left
      for (let i = 0; i < primary.used.length; i++) {
        if (primary.used[i] === null) {
          continue
        }
        const x = pointX(i, primary.used.length, left, plotW)
        const y = yAt(Math.min(primary.used[i], maxCum), maxCum, top, plotH)
        areaPts.push(x + ',' + y)
        lastUsedX = x
      }
      if (areaPts.length > 1) {
        areaPts.push(lastUsedX + ',' + (top + plotH))
        svg.appendChild(
          svgNode('polygon', {
            class: 'chart-area',
            points: areaPts.join(' '),
          }),
        )
      }
    }

    if (hasIdeal) {
      for (let i = 0; i < lines.length; i++) {
        appendLine(
          svg,
          lines[i].ideal,
          maxCum,
          left,
          plotW,
          top,
          plotH,
          'chart-line is-ideal ' + lines[i].tone,
        )
      }
    }
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

    const lastIdx = points.length - 1
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (todayIdx >= 0 && line.used[todayIdx] !== null) {
        svg.appendChild(
          svgNode('circle', {
            class: 'chart-dot ' + line.tone,
            cx: String(pointX(todayIdx, points.length, left, plotW)),
            cy: String(
              yAt(Math.min(line.used[todayIdx], maxCum), maxCum, top, plotH),
            ),
            r: '3',
          }),
        )
      }
      if (line.runOutDate) {
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
          setText(label, 'Out ' + line.runOutDate)
          svg.appendChild(label)
        }
      } else {
        const end = line.forecast[lastIdx]
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
      showMtdForecastTip(
        points[best],
        lines,
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

  function drawAllCharts() {
    const emptyQueries = !chartPoints || chartPoints.length === 0
    const emptyMtd = !mtdForecastPoints || mtdForecastPoints.length === 0
    if (chartsEmptyEl) {
      chartsEmptyEl.hidden = !(emptyQueries && emptyMtd)
    }
    if (emptyQueries) {
      clearSvg(chartTokensEl)
      clearSvg(chartCostEl)
    } else {
      if (chartTokensEl) {
        drawChart(chartTokensEl, chartPoints, 'tokens')
      }
      if (chartCostEl) {
        drawChart(chartCostEl, chartPoints, 'cost')
      }
    }
    if (emptyMtd) {
      for (let i = 0; i < mtdForecastSvgs.length; i++) {
        clearSvg(mtdForecastSvgs[i])
      }
    } else {
      redrawMtdForecastChart()
    }
    if (emptyQueries && emptyMtd) {
      hideChartTips()
    }
  }

  function mixBar(shares) {
    const mix = el('div', 'period-mix')
    const list = shares || []
    for (let i = 0; i < list.length; i++) {
      const share = list[i]
      const pct = Math.max(0, Number(share.percent) || 0)
      if (pct <= 0) {
        continue
      }
      const seg = el('span', 'period-mix-seg is-' + share.key)
      seg.style.width = pct + '%'
      mix.appendChild(seg)
    }
    return mix
  }

  function mixLegend(shares) {
    const legend = el('div', 'period-legend')
    const list = shares || []
    for (let i = 0; i < list.length; i++) {
      const share = list[i]
      const item = el('span', 'period-legend-item is-' + share.key)
      setText(item, share.label + ' ' + (Number(share.percent) || 0) + '%')
      legend.appendChild(item)
    }
    return legend
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
    article.appendChild(mixBar(card.shares))
    article.appendChild(mixLegend(card.shares))
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
      (variant !== 'share' &&
        variant !== 'cycle' &&
        typeof value === 'string' &&
        value.includes('/ —'))
    if (variant === 'share') {
      fill.classList.add('is-share')
    } else if (neutral) {
      fill.classList.add('is-neutral')
    } else if (variant !== 'cycle' && fillPct >= 100) {
      fill.classList.add('is-warn')
    } else if (variant === 'usage' || variant === 'cycle') {
      fill.classList.add('is-usage')
    }
    track.appendChild(fill)
    row.appendChild(head)
    row.appendChild(track)
    return row
  }

  function glossaryCard(item) {
    const card = el('article', 'status-block')
    if (item.id) {
      card.classList.add('is-' + item.id)
    }
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

  function shareTone(index) {
    return 'is-tone-' + (index % 6)
  }

  function breakdownMix(rows) {
    const mix = el('div', 'period-mix breakdown-mix')
    for (let i = 0; i < rows.length; i++) {
      const pct = Math.max(0, Number(rows[i].percent) || 0)
      if (pct <= 0) {
        continue
      }
      const seg = el('span', 'period-mix-seg ' + shareTone(i))
      seg.style.width = pct + '%'
      mix.appendChild(seg)
    }
    return mix
  }

  function breakdownChart(rows, title) {
    const panel = el('div', 'breakdown-panel')
    if (title) {
      const heading = el('h3', 'breakdown-title')
      setText(heading, title)
      panel.appendChild(heading)
    }
    panel.appendChild(breakdownMix(rows))
    const wrap = el('div', 'meter-list')
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const detail = row.share ? row.value + ' · ' + row.share : row.value
      const meter = meterRow(row.label, detail, row.percent, 'share')
      const fill = meter.querySelector('.meter-fill')
      if (fill) {
        fill.classList.add(shareTone(i))
      }
      const labelEl = meter.querySelector('.meter-label')
      if (labelEl) {
        labelEl.setAttribute('title', row.label)
      }
      wrap.appendChild(meter)
    }
    panel.appendChild(wrap)
    return panel
  }

  function metricCard(item, options) {
    const card = el('article', 'stats-card')
    if (item && item.id) {
      card.classList.add('is-' + item.id)
    }
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
    if (item.detail) {
      const detail = el('p', 'stats-detail')
      setText(detail, item.detail)
      card.appendChild(detail)
    }
    if (item.shares && item.shares.length > 0) {
      card.appendChild(mixBar(item.shares))
      card.appendChild(mixLegend(item.shares))
    }
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
      if (item.id) {
        chip.classList.add('is-' + item.id)
      }
      const label = el('span', 'cycle-chip-label')
      setText(label, item.label)
      const value = el('span', 'cycle-chip-value')
      setText(value, item.value)
      chip.appendChild(label)
      chip.appendChild(value)
      if (item.hint) {
        const hint = el('span', 'cycle-chip-hint')
        setText(hint, item.hint)
        chip.appendChild(hint)
      }
      if (typeof item.percent === 'number' && Number.isFinite(item.percent)) {
        chip.appendChild(
          meterRow('Elapsed', item.percent + '%', item.percent, 'cycle'),
        )
      }
      wrap.appendChild(chip)
    }
    return wrap
  }

  function pickSample(byId, byLabel, id, label) {
    return byId[id] || byLabel[label]
  }

  function appendSampleMetrics(section, sample, spikeCount, historyLimit) {
    if (!sample || sample.length === 0) {
      return
    }
    const byLabel = {}
    const byId = {}
    for (let i = 0; i < sample.length; i++) {
      const item = sample[i]
      byLabel[item.label] = item
      if (item.id) {
        byId[item.id] = item
      }
    }
    const heading = lastHeading(historyLimit)
    const groups = [
      {
        className: 'stats-grid-primary',
        items: [
          {
            item: pickSample(byId, byLabel, 'total', heading + ' total'),
            options: { primary: true },
          },
          {
            item: pickSample(byId, byLabel, 'avgCost', 'Average per query'),
            options: { primary: true },
          },
          {
            item: pickSample(
              byId,
              byLabel,
              'spikes',
              'Queries over token warning',
            ),
            options: {
              primary: true,
              highlight: spikeCount > 0,
            },
          },
        ],
      },
      {
        className: 'stats-grid-detail',
        items: [
          {
            item: pickSample(byId, byLabel, 'medianCost', 'Median per query'),
          },
          {
            item: pickSample(byId, byLabel, 'cacheHit', 'Cache hit'),
          },
          {
            item: pickSample(
              byId,
              byLabel,
              'costPerMillion',
              'Cost per 1M tokens',
            ),
          },
        ],
      },
      {
        className: 'stats-grid-detail',
        items: [
          {
            item: pickSample(
              byId,
              byLabel,
              'avgTokens',
              'Average per query tokens',
            ),
          },
          {
            item: pickSample(
              byId,
              byLabel,
              'priciest',
              'Most expensive query',
            ),
          },
          {
            item: pickSample(byId, byLabel, 'heaviest', 'Heaviest query'),
          },
        ],
      },
      {
        className: 'stats-grid-detail',
        items: [
          {
            item: pickSample(byId, byLabel, 'busiest', 'Busiest day'),
          },
          {
            item: pickSample(byId, byLabel, 'tokens', 'Tokens in ' + heading),
            options: { wide: true },
          },
        ],
      },
    ]
    for (let g = 0; g < groups.length; g++) {
      const group = groups[g]
      const cards = []
      for (let i = 0; i < group.items.length; i++) {
        const entry = group.items[i]
        if (entry.item) {
          cards.push(metricCard(entry.item, entry.options))
        }
      }
      if (cards.length > 0) {
        section.appendChild(metricGrid(cards, group.className))
      }
    }
  }

  function spikeCountFromSample(sample) {
    if (!sample) {
      return 0
    }
    for (let i = 0; i < sample.length; i++) {
      const item = sample[i]
      if (item.id === 'spikes' || item.label === 'Queries over token warning') {
        const n = Number(item.value)
        return Number.isFinite(n) ? n : 0
      }
    }
    return 0
  }

  function section(title, meta) {
    const wrap = el('section', 'stats-section')
    const head = el('div', 'stats-section-head')
    const heading = el('h2')
    setText(heading, title)
    head.appendChild(heading)
    if (meta) {
      const badge = el('span', 'stats-section-meta')
      setText(badge, meta)
      head.appendChild(badge)
    }
    wrap.appendChild(head)
    return wrap
  }

  function queryCountMeta(stats) {
    const n = Number(stats && stats.queryCount)
    if (!Number.isFinite(n) || n <= 0) {
      return ''
    }
    return n === 1 ? '1 query' : n.toLocaleString('en-US') + ' queries'
  }

  function applyMtdPayload(mtd) {
    mtdForecastSvgs = []
    mtdUnit = 'usd'
    mtdMax = null
    mtdForecastPoints = []
    mtdForecastSeries = []
    if (!mtd) {
      return
    }
    mtdUnit = mtd.unit === 'percent' ? 'percent' : 'usd'
    mtdMax = Number.isFinite(Number(mtd.max)) ? Number(mtd.max) : null
    mtdForecastPoints = Array.isArray(mtd.forecast) ? mtd.forecast : []
    mtdForecastSeries = Array.isArray(mtd.series) ? mtd.series : []
  }

  function mtdMetricsStrip(metrics) {
    if (!metrics || metrics.length === 0) {
      return null
    }
    const chips = cycleStrip(metrics)
    if (metrics.length >= 5) {
      chips.classList.add('is-five')
    } else if (metrics.length >= 4) {
      chips.classList.add('is-four')
    } else if (metrics.length >= 3) {
      chips.classList.add('is-three')
    }
    return chips
  }

  function mtdForecastCard(mtd) {
    const card = el('article', 'status-block is-mtd')
    const title = el('h3')
    setText(title, mtd.title || 'Monthly cost forecast')
    card.appendChild(title)
    const bars = mtd.bars || []
    if (bars.length > 0) {
      const meters = el('div', 'meter-list meter-list-tight')
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        meters.appendChild(
          meterRow(bar.label, bar.value, bar.percent, 'usage'),
        )
      }
      card.appendChild(meters)
    }
    if (mtd.body) {
      const body = el('p', 'stats-hint')
      setText(body, mtd.body)
      card.appendChild(body)
    }
    if (mtd.overPace || mtd.verdict === 'over' || mtd.verdict === 'tight') {
      card.classList.add('is-over')
    }
    const forecast = Array.isArray(mtd.forecast) ? mtd.forecast : []
    const series = Array.isArray(mtd.series) ? mtd.series : []
    if (forecast.length === 0 || series.length === 0) {
      return card
    }
    const hint = el('p', 'chart-hint')
    setText(
      hint,
      mtdUnit === 'percent'
        ? 'Bars are that day’s included burn. Solid lines are cumulative used. Dashed lines are the forecast; dotted green lines are leftover budget to month end (Good color).'
        : 'Bars are that day’s spend. Solid lines are cumulative used. Dashed lines are the forecast; dotted green lines are leftover budget to month end (Good color).',
    )
    card.appendChild(hint)
    const legend = el('div', 'chart-legend')
    const barItem = el('span', 'chart-legend-item is-bar')
    setText(barItem, 'That day')
    legend.appendChild(barItem)
    for (let i = 0; i < series.length; i++) {
      const tone = ' is-s' + (i % 4)
      const label = String(series[i].label || 'Used')
      const usedItem = el('span', 'chart-legend-item' + tone)
      setText(usedItem, label)
      const forecastItem = el('span', 'chart-legend-item is-forecast' + tone)
      setText(forecastItem, label + ' forecast')
      legend.appendChild(usedItem)
      legend.appendChild(forecastItem)
      const hasIdeal = Array.isArray(series[i].ideal)
        ? series[i].ideal.some(function (value) {
            return value !== null && value !== undefined
          })
        : false
      if (hasIdeal) {
        const idealItem = el('span', 'chart-legend-item is-ideal' + tone)
        setText(idealItem, label + ' ideal')
        legend.appendChild(idealItem)
      }
    }
    const tools = el('div', 'mtd-chart-tools')
    tools.appendChild(legend)
    tools.appendChild(mtdRangeToggle())
    card.appendChild(tools)
    const frame = el('div', 'chart-frame mtd-forecast-frame')
    const svg = svgNode('svg', {
      class: 'chart-svg',
      viewBox: '0 0 800 280',
      preserveAspectRatio: 'none',
      role: 'img',
      'aria-label':
        mtdUnit === 'percent'
          ? 'That day burn, cumulative used, ideal budget, and month-end forecast'
          : 'That day spend, cumulative used, ideal budget, and month-end forecast',
    })
    frame.appendChild(svg)
    card.appendChild(frame)
    mtdForecastSvgs.push(svg)
    return card
  }

  function mtdForecastSection(mtd) {
    const pace = section('Monthly cost forecast')
    pace.appendChild(mtdForecastCard(mtd))
    const chips = mtdMetricsStrip(mtd.metrics)
    if (chips) {
      pace.appendChild(chips)
    }
    return pace
  }

  function renderChartsMtd(mtd) {
    if (!chartsMtdEl) {
      return
    }
    while (chartsMtdEl.firstChild) {
      chartsMtdEl.removeChild(chartsMtdEl.firstChild)
    }
    if (!mtd) {
      return
    }
    chartsMtdEl.appendChild(mtdForecastSection(mtd))
  }

  function renderStats(stats, mtd) {
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

    if (mtd) {
      statsEl.appendChild(mtdForecastSection(mtd))
    }

    if (stats.cycle && stats.cycle.length > 0) {
      const cycle = section('Billing cycle')
      cycle.appendChild(cycleStrip(stats.cycle))
      statsEl.appendChild(cycle)
    }

    const sample = section(
      lastHeading(stats.historyLimit) + ' summary',
      queryCountMeta(stats),
    )
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

  function updateCriticalTokenPreview() {
    if (!criticalTokenPreviewEl || !criticalTokenEl) {
      return
    }
    setText(
      criticalTokenPreviewEl,
      tokenPreview(tokensFromKilo(criticalTokenEl.value)),
    )
  }

  function clampCriticalCost(value) {
    const n = Math.round(Number(value) * 100) / 100
    if (!Number.isFinite(n)) {
      return 5
    }
    if (n < 0.01) {
      return 0.01
    }
    return n
  }

  function syncCriticalAlertState() {
    const on = !showCriticalAlertEl || showCriticalAlertEl.checked === true
    if (criticalTokenEl) {
      criticalTokenEl.disabled = !on
    }
    if (criticalCostEl) {
      criticalCostEl.disabled = !on
    }
    if (applyCriticalAlertEl) {
      applyCriticalAlertEl.disabled = !on
    }
    syncNumberStepperState(criticalTokenEl)
    syncNumberStepperState(criticalCostEl)
  }

  function syncNumberStepperState(inputEl) {
    if (!inputEl) {
      return
    }
    const stepper = inputEl.closest('.number-stepper')
    if (!stepper) {
      return
    }
    const disabled = inputEl.disabled === true
    const buttons = stepper.querySelectorAll('.number-step')
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].disabled = disabled
    }
  }

  function stepNumberInput(inputEl, direction) {
    if (!inputEl || inputEl.disabled) {
      return
    }
    const stepRaw = Number(inputEl.step)
    const step = Number.isFinite(stepRaw) && stepRaw > 0 ? stepRaw : 1
    const min =
      inputEl.min !== '' && Number.isFinite(Number(inputEl.min))
        ? Number(inputEl.min)
        : null
    const max =
      inputEl.max !== '' && Number.isFinite(Number(inputEl.max))
        ? Number(inputEl.max)
        : null
    let current = Number(inputEl.value)
    if (!Number.isFinite(current)) {
      current = min !== null ? min : 0
    }
    let next = current + direction * step
    if (min !== null && next < min) {
      next = min
    }
    if (max !== null && next > max) {
      next = max
    }
    if (inputEl === thresholdEl || inputEl === criticalTokenEl) {
      next = snapKilo(next)
    } else if (inputEl === criticalCostEl) {
      next = clampCriticalCost(next)
    } else if (inputEl === pollIntervalEl) {
      next = clampPollInterval(next)
    } else if (step < 1) {
      const decimals = String(step).includes('.')
        ? String(step).split('.')[1].length
        : 2
      next = Math.round(next * Math.pow(10, decimals)) / Math.pow(10, decimals)
    } else {
      next = Math.round(next)
    }
    inputEl.value = String(next)
    // Always update the local preview. Critical alert fields save only on
    // Apply / Enter — not on −/+, so do not fire `change` for those.
    inputEl.dispatchEvent(new Event('input', { bubbles: true }))
    const applyGated =
      inputEl === criticalTokenEl || inputEl === criticalCostEl
    if (!applyGated) {
      inputEl.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  function wireNumberSteppers() {
    const steppers = document.querySelectorAll('.number-stepper')
    for (let i = 0; i < steppers.length; i++) {
      const stepper = steppers[i]
      const inputEl = stepper.querySelector('input[type="number"]')
      if (!inputEl) {
        continue
      }
      const buttons = stepper.querySelectorAll('[data-number-dir]')
      for (let b = 0; b < buttons.length; b++) {
        const btn = buttons[b]
        btn.addEventListener('click', function (event) {
          event.preventDefault()
          const dir = Number(btn.getAttribute('data-number-dir'))
          if (!Number.isFinite(dir) || dir === 0) {
            return
          }
          stepNumberInput(inputEl, dir > 0 ? 1 : -1)
        })
      }
      syncNumberStepperState(inputEl)
    }
  }

  function fillIfIdle(inputEl, value) {
    if (document.activeElement === inputEl) {
      return
    }
    inputEl.value = value
  }

  function renderSettings(data) {
    if (typeof data.spikeTokenThreshold === 'number' && !thresholdDirty) {
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
    if (
      typeof data.showCriticalAlert === 'boolean' &&
      showCriticalAlertEl &&
      document.activeElement !== showCriticalAlertEl
    ) {
      showCriticalAlertEl.checked = data.showCriticalAlert
    }
    if (typeof data.criticalTokenThreshold === 'number' && criticalTokenEl) {
      if (!criticalTokenDirty) {
        fillIfIdle(
          criticalTokenEl,
          String(kiloFromTokens(data.criticalTokenThreshold)),
        )
      }
      if (document.activeElement !== criticalTokenEl) {
        updateCriticalTokenPreview()
      }
    }
    if (
      typeof data.criticalCostUsdThreshold === 'number' &&
      criticalCostEl &&
      !criticalCostDirty
    ) {
      fillIfIdle(criticalCostEl, String(data.criticalCostUsdThreshold))
    }
    syncCriticalAlertState()
    if (
      typeof data.showStatusBar === 'boolean' &&
      showStatusBarEl &&
      document.activeElement !== showStatusBarEl
    ) {
      showStatusBarEl.checked = data.showStatusBar
    }
    if (
      typeof data.showToday === 'boolean' &&
      showTodayEl &&
      document.activeElement !== showTodayEl
    ) {
      showTodayEl.checked = data.showToday
    }
    if (
      typeof data.minimalMode === 'boolean' &&
      minimalModeEl &&
      document.activeElement !== minimalModeEl
    ) {
      minimalModeEl.checked = data.minimalMode
    }
    if (
      typeof data.recentQueryCount === 'number' &&
      recentQueryCountEl &&
      document.activeElement !== recentQueryCountEl
    ) {
      recentQueryCountEl.value = String(
        clampRecentQueryCount(data.recentQueryCount),
      )
    }
    if (
      typeof data.pollIntervalMinutes === 'number' &&
      pollIntervalEl &&
      !pollIntervalDirty
    ) {
      fillIfIdle(pollIntervalEl, String(clampPollInterval(data.pollIntervalMinutes)))
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
    renderStatusBarPreview(data.statusBarPreview)
    syncBarEditorState()
    if (typeof data.historyLimit === 'number' && !historyLimitDirty) {
      const text = String(clampHistoryLimit(data.historyLimit))
      for (let i = 0; i < historyLimitEls.length; i++) {
        fillIfIdle(historyLimitEls[i], text)
      }
      applyHistoryTitle(data.historyLimit)
    }
  }

  function rowIsSpike(row, warnOn) {
    if (!warnOn || !row) {
      return false
    }
    if (row.spike === true) {
      return true
    }
    return typeof row.tokens === 'string' && row.tokens.indexOf('!') !== -1
  }

  function visibleTableEvents(events, warnOn) {
    const list = events || []
    if (!spikesOnly || !warnOn) {
      return list
    }
    const out = []
    for (let i = 0; i < list.length; i++) {
      if (rowIsSpike(list[i], warnOn)) {
        out.push(list[i])
      }
    }
    return out
  }

  function syncSpikesOnlyControl(warnOn) {
    if (!spikesOnlyEl) {
      return
    }
    spikesOnlyEl.disabled = !warnOn
    spikesOnlyEl.checked = warnOn && spikesOnly
  }

  function paintRows(events, warnOn) {
    while (rowsEl.firstChild) {
      rowsEl.removeChild(rowsEl.firstChild)
    }
    const list = events || []
    const shown = visibleTableEvents(list, warnOn)
    if (list.length === 0) {
      emptyEl.hidden = false
      setText(emptyEl, 'No queries yet')
      return
    }
    if (shown.length === 0) {
      emptyEl.hidden = false
      setText(emptyEl, 'No queries over the token warning')
      return
    }
    emptyEl.hidden = true
    setText(emptyEl, 'No queries yet')
    for (let i = 0; i < shown.length; i++) {
      const row = shown[i]
      const tr = document.createElement('tr')
      addCell(tr, row.time)
      addCell(tr, row.model)
      addCell(tr, row.cost)
      const spike = rowIsSpike(row, warnOn)
      addCell(tr, row.tokens, spike ? 'tokens-spike' : undefined)
      addCell(tr, row.inputOutput)
      addCell(tr, row.kind)
      rowsEl.appendChild(tr)
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
    applyRefreshing(settings.refreshing === true)

    const warnOn = settings.showSpikeWarning !== false
    tableEvents = events || []
    tableWarnOn = warnOn
    syncSpikesOnlyControl(warnOn)
    paintRows(tableEvents, warnOn)

    applyMtdPayload(settings.mtd)
    renderStats(stats, settings.mtd)
    renderChartsMtd(settings.mtd)
    chartPoints = Array.isArray(settings.charts) ? settings.charts : []
    renderPeriodCards(settings.periods)
    if (
      (chartsViewEl && !chartsViewEl.hidden) ||
      (statsViewEl && !statsViewEl.hidden)
    ) {
      drawAllCharts()
    }
  }

  function submitThreshold() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = 0
    }
    const kilo = snapKilo(thresholdEl.value)
    thresholdDirty = false
    thresholdEl.value = String(kilo)
    const value = tokensFromKilo(kilo)
    updateThresholdPreview()
    vscode.postMessage({ type: 'setSpikeThreshold', value: value })
  }

  function scheduleSubmit() {
    thresholdDirty = true
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
    if (!data) {
      return
    }
    if (data.type === 'openTab') {
      setView(data.tab)
      return
    }
    if (data.type !== 'data') {
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
  function submitHistoryLimit(fromEl) {
    const source =
      fromEl ||
      (historyLimitEls.indexOf(document.activeElement) !== -1
        ? document.activeElement
        : historyLimitEls[0])
    if (!source) {
      return
    }
    const value = clampHistoryLimit(source.value)
    historyLimitDirty = false
    for (let i = 0; i < historyLimitEls.length; i++) {
      historyLimitEls[i].value = String(value)
    }
    applyHistoryTitle(value)
    vscode.postMessage({ type: 'setHistoryLimit', value: value })
  }

  function markHistoryLimitDirty() {
    historyLimitDirty = true
  }

  for (let i = 0; i < historyLimitEls.length; i++) {
    const inputEl = historyLimitEls[i]
    inputEl.addEventListener('input', markHistoryLimitDirty)
    inputEl.addEventListener('change', function () {
      submitHistoryLimit(inputEl)
    })
    inputEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault()
        submitHistoryLimit(inputEl)
        inputEl.blur()
      }
    })
  }
  if (applyHistoryLimitEl) {
    applyHistoryLimitEl.addEventListener('click', function () {
      submitHistoryLimit(historyLimitEl)
    })
  }
  if (applyHistoryLimitBarEl) {
    applyHistoryLimitBarEl.addEventListener('click', function () {
      submitHistoryLimit(historyLimitBarEl)
    })
  }
  if (spikesOnlyEl) {
    spikesOnlyEl.addEventListener('change', function () {
      if (spikesOnlyEl.disabled) {
        return
      }
      spikesOnly = spikesOnlyEl.checked === true
      paintRows(tableEvents, tableWarnOn)
    })
  }
  if (refreshQueriesEl) {
    refreshQueriesEl.addEventListener('click', function () {
      if (refreshQueriesEl.disabled) {
        return
      }
      vscode.postMessage({ type: 'refresh' })
    })
  }
  showWarningEl.addEventListener('change', function () {
    vscode.postMessage({
      type: 'setShowSpikeWarning',
      value: showWarningEl.checked === true,
    })
  })
  function submitCriticalToken() {
    if (!criticalTokenEl || criticalTokenEl.disabled) {
      return
    }
    const kilo = snapKilo(criticalTokenEl.value)
    criticalTokenDirty = false
    criticalTokenEl.value = String(kilo)
    updateCriticalTokenPreview()
    vscode.postMessage({
      type: 'setCriticalTokenThreshold',
      value: tokensFromKilo(kilo),
    })
  }
  function submitCriticalCost() {
    if (!criticalCostEl || criticalCostEl.disabled) {
      return
    }
    const value = clampCriticalCost(criticalCostEl.value)
    criticalCostDirty = false
    criticalCostEl.value = String(value)
    vscode.postMessage({ type: 'setCriticalCostUsdThreshold', value: value })
  }
  function submitCriticalAlert() {
    submitCriticalToken()
    submitCriticalCost()
  }
  if (showCriticalAlertEl) {
    showCriticalAlertEl.addEventListener('change', function () {
      syncCriticalAlertState()
      vscode.postMessage({
        type: 'setShowCriticalAlert',
        value: showCriticalAlertEl.checked === true,
      })
    })
  }
  if (criticalTokenEl) {
    criticalTokenEl.addEventListener('input', function () {
      criticalTokenDirty = true
      updateCriticalTokenPreview()
    })
    // Save only on Apply / Enter — not on blur or −/+ (see stepNumberInput).
    criticalTokenEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault()
        submitCriticalToken()
        criticalTokenEl.blur()
      }
    })
  }
  if (criticalCostEl) {
    criticalCostEl.addEventListener('input', function () {
      criticalCostDirty = true
    })
    criticalCostEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault()
        submitCriticalCost()
        criticalCostEl.blur()
      }
    })
  }
  if (applyCriticalAlertEl) {
    applyCriticalAlertEl.addEventListener('click', submitCriticalAlert)
  }
  if (showStatusBarEl) {
    showStatusBarEl.addEventListener('change', function () {
      syncBarEditorState()
      vscode.postMessage({
        type: 'setShowStatusBar',
        value: showStatusBarEl.checked === true,
      })
    })
  }
  if (showTodayEl) {
    showTodayEl.addEventListener('change', function () {
      vscode.postMessage({
        type: 'setShowToday',
        value: showTodayEl.checked === true,
      })
    })
  }
  if (minimalModeEl) {
    minimalModeEl.addEventListener('change', function () {
      syncBarEditorState()
      vscode.postMessage({
        type: 'setMinimalMode',
        value: minimalModeEl.checked === true,
      })
    })
  }
  if (recentQueryCountEl) {
    recentQueryCountEl.addEventListener('change', function () {
      const value = clampRecentQueryCount(recentQueryCountEl.value)
      recentQueryCountEl.value = String(value)
      renderStatusBarPreview(lastStatusBarPreview)
      vscode.postMessage({ type: 'setRecentQueryCount', value: value })
    })
  }
  function submitPollInterval() {
    if (!pollIntervalEl) {
      return
    }
    const value = clampPollInterval(pollIntervalEl.value)
    pollIntervalDirty = false
    pollIntervalEl.value = String(value)
    vscode.postMessage({ type: 'setPollIntervalMinutes', value: value })
  }
  if (pollIntervalEl) {
    pollIntervalEl.addEventListener('input', function () {
      pollIntervalDirty = true
    })
    pollIntervalEl.addEventListener('change', submitPollInterval)
    pollIntervalEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault()
        submitPollInterval()
        pollIntervalEl.blur()
      }
    })
  }
  if (applyPollIntervalEl) {
    applyPollIntervalEl.addEventListener('click', submitPollInterval)
  }
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
  if (tabChartsEl) {
    tabChartsEl.addEventListener('click', function () {
      setView('charts')
    })
  }
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
      const chartsOpen = chartsViewEl && !chartsViewEl.hidden
      const statsOpen = statsViewEl && !statsViewEl.hidden
      if (chartsOpen || statsOpen) {
        drawAllCharts()
      }
    }, 150)
  })

  wireNumberSteppers()
  vscode.postMessage({ type: 'ready' })
  applyVersion(document.documentElement.getAttribute('data-version'))
})()
