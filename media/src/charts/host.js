import { drawDailyChart } from './daily.js'
import { drawLimitHistory } from './limits.js'
import {
  eventsForLocalDay,
  localDayKeyFromMs,
  sliceChartPoints,
} from './zoom.js'

function localMidnight(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  if (!match) {
    return null
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
}

/**
 * SVG helpers, tips, and redraws for the daily and forecast charts.
 * Daily and forecast drawers keep their signatures and receive this host.
 */
export class ChartHost {
  /**
   * @param {object} session
   */
  constructor(session) {
    this.session = session
    const names = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
    for (let i = 0; i < names.length; i++) {
      const name = names[i]
      if (name === 'constructor') {
        continue
      }
      this[name] = this[name].bind(this)
    }
    window.addEventListener('message', (event) => {
      const data = event && event.data
      if (!data || typeof data.type !== 'string') {
        return
      }
      if (data.type === 'codex.result' && Array.isArray(data.charts)) {
        this.session.codexCharts = data.charts
        this.session.codexLimitSeries = Array.isArray(data.limitSeries)
          ? data.limitSeries
          : []
        if (data.stats) {
          this.session.codexStats = data.stats
        }
        if (this.session.querySource === 'codex-local') {
          this.drawAllCharts()
        }
      }
      if (data.type === 'openai.status' && this.session.querySource === 'openai-api') {
        this.drawAllCharts()
      }
    })
  }

  chartBarMode() {
    return this.session.chartBarMode
  }

  mtdBarMode() {
    return this.session.mtdBarMode === 'daily' ? 'daily' : 'cumulative'
  }

  compactTokens(n) {
    return this.session.compactTokens(n)
  }

  compactCost(n) {
    return this.session.compactCost(n)
  }

  setText(node, text) {
    this.session.setText(node, text)
  }

  t(key, vars) {
    return this.session.t(key, vars)
  }

  el(tag, className) {
    return this.session.el(tag, className)
  }

  drawChart(svg, points, kind) {
    drawDailyChart(svg, points, kind, this)
  }

  onDaySelect(selection) {
    if (this.session.querySource === 'codex-local') {
      const point = selection && selection.point
      const key = point ? localDayKeyFromMs(point.timestamp) : ''
      if (key && typeof this.session.focusCodexDay === 'function') {
        this.session.focusCodexDay(key)
      }
      return
    }
    this.selectChartDay(selection)
  }

  useCalendarAxis() {
    return this.session.querySource === 'codex-local'
  }

  settingsAxisBounds() {
    if (this.session.querySource !== 'codex-local') {
      return null
    }
    const from = localMidnight(this.session.historyFromDate)
    if (from === null) {
      return null
    }
    const toDay = localMidnight(this.session.historyToDate)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const day = 24 * 60 * 60 * 1000
    let start = from
    let endDay = toDay !== null ? toDay : today
    const zoom = this.session.chartZoomMode
    if (zoom === '7') {
      const week = endDay - 6 * day
      if (week > start) {
        start = week
      }
    } else if (zoom === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime()
      if (monthStart > start) {
        start = monthStart
      }
      if (monthEnd < endDay) {
        endDay = monthEnd
      }
    }
    if (endDay < start) {
      endDay = start
    }
    return { from: start, to: endDay + day - 1 }
  }

  svgNode(name, attrs) {
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

  chartBarRect(x, y, barW, h, className, flatTop) {
    const radius = flatTop ? 0 : Math.min(2.2, barW / 2)
    return this.svgNode('rect', {
      class: className || 'chart-bar',
      x: String(x - barW / 2),
      y: String(y),
      width: String(barW),
      height: String(Math.max(0.5, h)),
      rx: String(radius),
      ry: String(radius),
    })
    }

  // Plan is that day's allowance. The column stays green up to the plan
  // and turns red only on the part above it. No allowance → series color.
  appendPaceSections(svg, x, width, used, plan, maxCum, top, plotH, tone) {
    const capped = Math.min(Math.max(0, Number(used) || 0), maxCum)
    if (!(capped > 0)) {
      return
    }
    const toneClass = tone || 'is-s0'
    const planNum = Number(plan)
    if (plan === null || plan === undefined || !Number.isFinite(planNum)) {
      const y = this.yAt(capped, maxCum, top, plotH)
      const h = top + plotH - y
      if (h > 0) {
        svg.appendChild(this.chartBarRect(x, y, width, h, 'chart-bar ' + toneClass))
      }
      return
    }
    const ceiling = Math.max(0, planNum)
    const over = capped > ceiling + 0.005 ? capped - ceiling : 0
    const under = capped - over
    if (under > 0) {
      const y = this.yAt(under, maxCum, top, plotH)
      const h = top + plotH - y
      if (h > 0) {
        svg.appendChild(
          this.chartBarRect(
            x,
            y,
            width,
            h,
            'chart-bar is-pace is-under ' + toneClass,
            over > 0,
          ),
        )
      }
    }
    if (over > 0) {
      const yTop = this.yAt(capped, maxCum, top, plotH)
      const yJoin = this.yAt(Math.min(under, maxCum), maxCum, top, plotH)
      const h = yJoin - yTop
      if (h > 0) {
        svg.appendChild(
          this.chartBarRect(
            x,
            yTop,
            width,
            h + 0.4,
            'chart-bar is-pace is-over ' + toneClass,
          ),
        )
      }
    }
    }

  niceMax(value) {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) {
      return 1
    }
    const ticks = 4
    const padded = n * 1.08
    const rawStep = padded / ticks
    const exp = Math.pow(10, Math.floor(Math.log10(rawStep)))
    const scaled = rawStep / exp
    const steps = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10]
    let nice = 10
    for (let i = 0; i < steps.length; i++) {
      if (scaled <= steps[i]) {
        nice = steps[i]
        break
      }
    }
    return nice * exp * ticks
    }

  compactPercent(n) {
    const value = Math.max(0, Number(n) || 0)
    const tenths = Math.round(value * 10) / 10
    if (Math.abs(tenths - Math.round(tenths)) < 0.05) {
      return Math.round(tenths) + '%'
    }
    return tenths.toFixed(1) + '%'
    }

  formatMtdAmount(n) {
    if (this.session.mtdUnit === 'percent') {
      return this.compactPercent(n)
    }
    return this.compactCost(n)
    }

  pointX(index, count, left, plotW) {
    if (count <= 1) {
      return left + plotW / 2
    }
    return left + (index / (count - 1)) * plotW
    }

  yAt(value, max, top, plotH) {
    if (max <= 0) {
      return top + plotH
    }
    return top + plotH - (value / max) * plotH
    }

  hideChartTip() {
    this.hideChartTips()
    }

  hideChartTips() {
    if (this.session.chartTipEl) {
      this.session.chartTipEl.hidden = true
    }
    if (this.session.statsChartTipEl) {
      this.session.statsChartTipEl.hidden = true
    }
    }

  placeTip(tipEl, wrapEl, clientX, clientY) {
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

  tipTitle(text) {
    const node = this.el('p', 'chart-tip-title')
    this.setText(node, text)
    return node
    }

  tipSub(text) {
    const node = this.el('p', 'chart-tip-sub')
    this.setText(node, text)
    return node
    }

  tipRow(label, value, swatchClass, valueClass) {
    const row = this.el('div', 'chart-tip-row')
    if (swatchClass) {
      row.className = 'chart-tip-row ' + swatchClass
    }
    const labelWrap = this.el('span', 'chart-tip-label-wrap')
    const swatch = this.el('span', 'chart-tip-swatch')
    swatch.setAttribute('aria-hidden', 'true')
    const labelEl = this.el('span', 'chart-tip-label')
    const valueEl = this.el('span', 'chart-tip-value')
    if (valueClass) {
      valueEl.className = 'chart-tip-value ' + valueClass
    }
    this.setText(labelEl, label)
    this.setText(valueEl, value)
    labelWrap.appendChild(swatch)
    labelWrap.appendChild(labelEl)
    row.appendChild(labelWrap)
    row.appendChild(valueEl)
    return row
    }

  placeChartTip(clientX, clientY) {
    this.placeTip(this.session.chartTipEl, this.session.chartsViewEl, clientX, clientY)
    }

  costOrDash(n) {
    if (n === null || n === undefined || n === '') {
      return '—'
    }
    const value = Number(n)
    if (!Number.isFinite(value)) {
      return '—'
    }
    return this.formatMtdAmount(value)
    }

  mtdTipHost(svg) {
    if (this.session.statsViewEl && svg && this.session.statsViewEl.contains(svg)) {
      return { tip: this.session.statsChartTipEl, wrap: this.session.statsViewEl }
    }
    return { tip: this.session.chartTipEl, wrap: this.session.chartsViewEl }
    }

  mtdTipLimit(point, line, index) {
    if (
      point &&
      point.allowanceUsd !== null &&
      point.allowanceUsd !== undefined
    ) {
      const allowance = Number(point.allowanceUsd)
      if (Number.isFinite(allowance)) {
        return allowance
      }
    }
    if (!line || !line.forecast) {
      return null
    }
    const raw = line.forecast[index]
    // Handle reset array [high, low] - return the low value
    if (Array.isArray(raw)) {
      return raw[1]
    }
    return raw
    }

  mtdTipValueClass(used, limit) {
    const usedNum = Number(used)
    const limitNum = Number(limit)
    if (!Number.isFinite(usedNum) || !Number.isFinite(limitNum)) {
      return ''
    }
    return usedNum > limitNum + 0.005 ? 'is-over' : 'is-ok'
    }

  showMtdForecastTip(point, line, index, clientX, clientY, svg) {
    const host = this.mtdTipHost(svg)
    if (!host.tip || !host.wrap || !point || !line) {
      return
    }
    const label = line.label || this.t('mtd.used')
    const tone = line.tone || 'is-s0'
    const daily = this.mtdBarMode() === 'daily'
    const used = daily
      ? line.day
        ? line.day[index]
        : null
      : line.used
        ? line.used[index]
        : null
    const limit = daily
      ? point.dayAllowanceUsd !== null && point.dayAllowanceUsd !== undefined
        ? point.dayAllowanceUsd
        : null
      : this.mtdTipLimit(point, line, index)
    host.tip.replaceChildren()
    host.tip.appendChild(
      this.tipRow(
        point.date + ' ' + label,
        this.costOrDash(used) + ' / ' + this.costOrDash(limit),
        'is-used ' + tone,
        this.mtdTipValueClass(used, limit),
      ),
    )
    this.placeTip(host.tip, host.wrap, clientX, clientY)
    }

  barCenterX(index, count, left, plotW) {
    if (count <= 0) {
      return left
    }
    const gap = plotW / count
    return left + gap * (index + 0.5)
    }

  showChartTip(point, kind, cumulative, clientX, clientY) {
    if (!this.session.chartTipEl || !this.session.chartsViewEl) {
      return
    }
    const codex = this.session.querySource === 'codex-local'
    const per =
      kind === 'tokens' ? this.compactTokens(point.tokens) : this.compactCost(point.costUsd)
    const total =
      kind === 'tokens' ? this.compactTokens(cumulative) : this.compactCost(cumulative)
    this.session.chartTipEl.replaceChildren()
    this.session.chartTipEl.appendChild(this.tipTitle(point.time))
    const queries = Number(point.queryCount)
    if (Number.isFinite(queries) && queries > 0) {
      const key = codex ? 'charts.tipRequests' : 'charts.tipQueries'
      this.session.chartTipEl.appendChild(this.tipSub(this.t(key, { n: queries })))
    }
    if (codex && point.inputTokens !== undefined && point.inputTokens !== null) {
      this.session.chartTipEl.appendChild(
        this.tipRow(this.t('charts.tipInput'), this.fullTokens(point.inputTokens)),
      )
      this.session.chartTipEl.appendChild(
        this.tipRow(this.t('charts.tipCached'), this.fullTokens(point.cachedInputTokens)),
      )
      this.session.chartTipEl.appendChild(
        this.tipRow(this.t('charts.tipOutput'), this.fullTokens(point.outputTokens)),
      )
      const priced = Number(point.pricedCount) > 0 || Number(point.costUsd) > 0
      this.session.chartTipEl.appendChild(
        this.tipRow(
          this.t('charts.tipCost'),
          priced ? this.compactCost(point.costUsd) : this.t('charts.tipNoRate'),
        ),
      )
      this.placeChartTip(clientX, clientY)
      return
    }
    this.session.chartTipEl.appendChild(
      this.tipRow(kind === 'tokens' ? this.t('charts.tipTokens') : this.t('charts.tipCost'), per),
    )
    this.session.chartTipEl.appendChild(this.tipRow(this.t('charts.tipTotal'), total))
    this.placeChartTip(clientX, clientY)
    }

  showLimitTip(hit, clientX, clientY) {
    if (!this.session.chartTipEl || !hit || !hit.point) {
      return
    }
    const point = hit.point
    this.session.chartTipEl.replaceChildren()
    this.session.chartTipEl.appendChild(this.tipTitle(point.label || ''))
    const kind = hit.kind === '5h' ? this.t('codex.limit5h') : hit.kind === '7d' ? this.t('codex.limit7d') : this.t('codex.limitCustom', { minutes: '' })
    const used = Number(point.usedPercent)
    const text = Number.isFinite(used) ? String(Math.round(used * 10) / 10) + '%' : '—'
    this.session.chartTipEl.appendChild(this.tipRow(kind, text))
    this.placeChartTip(clientX, clientY)
    }

  fullTokens(n) {
    const value = Math.round(Number(n) || 0)
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }

  syncChartZoomUi() {
    const buttons = document.querySelectorAll('#dailyChartZoom [data-chart-zoom]')
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle(
        'is-active',
        buttons[i].getAttribute('data-chart-zoom') === this.session.chartZoomMode,
      )
    }
    }

  setChartZoomMode(mode) {
    if (mode !== 'sample' && mode !== '7' && mode !== 'month') {
      return
    }
    if (this.session.chartZoomMode === mode) {
      return
    }
    this.session.chartZoomMode = mode
    this.syncChartZoomUi()
    this.redrawUsageCharts()
    }

  selectChartDay(selection) {
    const point = selection && selection.point
    if (!point || !Number.isFinite(point.timestamp)) {
      return
    }
    this.session.selectedChartDayKey = localDayKeyFromMs(point.timestamp)
    const detail = document.getElementById('chartDayDetail')
    const titleEl = document.getElementById('chartDayDetailTitle')
    const metaEl = document.getElementById('chartDayDetailMeta')
    const listEl = document.getElementById('chartDayExpandList')
    if (!detail || !titleEl || !metaEl || !listEl) {
      return
    }
    this.setText(titleEl, point.time || this.session.selectedChartDayKey)
    const queries = Number.isFinite(point.queryCount) ? point.queryCount : 0
    const tokens = Number.isFinite(point.tokens) ? point.tokens : 0
    const cost = Number.isFinite(point.costUsd) ? point.costUsd : 0
    const total = selection.cumulative
    this.setText(
      metaEl,
      this.t('charts.dayMeta', {
        queries: String(queries),
        tokens: this.compactTokens(tokens),
        cost: this.compactCost(cost),
        total:
          selection.kind === 'tokens'
            ? this.compactTokens(total)
            : this.compactCost(total),
      }),
    )
    this.fillChartDayQueries(listEl, this.session.selectedChartDayKey)
    detail.hidden = false
    this.hideChartTip()
    }

  fillChartDayQueries(listEl, dayKey) {
    if (!listEl) {
      return
    }
    const dayRows = eventsForLocalDay(this.session.chartEvents, dayKey)
    listEl.replaceChildren()
    for (let i = 0; i < dayRows.length; i++) {
      const row = dayRows[i]
      const li = document.createElement('li')
      const model = row.model || '—'
      const when = typeof row.time === 'string' ? row.time : ''
      this.setText(
        li,
        this.t('charts.dayRow', {
          time: when,
          model: model,
          tokens: this.compactTokens(row.tokens),
          cost: this.compactCost(row.costUsd),
        }),
      )
      listEl.appendChild(li)
    }
    if (dayRows.length === 0) {
      const li = document.createElement('li')
      this.setText(li, this.t('charts.dayEmpty'))
      listEl.appendChild(li)
    }
    }

  refreshOpenChartDay() {
    const detail = document.getElementById('chartDayDetail')
    const listEl = document.getElementById('chartDayExpandList')
    if (!detail || detail.hidden || !this.session.selectedChartDayKey || !listEl) {
      return
    }
    this.fillChartDayQueries(listEl, this.session.selectedChartDayKey)
    }

  clearSvg(svg) {
    if (!svg) {
      return
    }
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild)
    }
    }

  numericMax(values) {
    let max = 0
    for (let i = 0; i < values.length; i++) {
      const n = Number(values[i])
      if (Number.isFinite(n) && n > max) {
        max = n
      }
    }
    return max
    }

  numbersOrNull(list) {
    const out = []
    const source = Array.isArray(list) ? list : []
    for (let i = 0; i < source.length; i++) {
      const raw = source[i]
      if (raw === null || raw === undefined) {
        out.push(null)
        continue
      }
      // Handle reset array [high, low] - keep as-is for this.appendLine to handle
      if (Array.isArray(raw)) {
        out.push(raw)
        continue
      }
      const n = Number(raw)
      out.push(Number.isFinite(n) ? Math.max(0, n) : 0)
    }
    return out
    }

  appendLine(svg, values, max, left, plotW, top, plotH, className) {
    let pts = []
    const flush = () => {
      if (pts.length === 0) {
        return
      }
      svg.appendChild(
        this.svgNode('polyline', {
          class: className,
          points: pts.join(' '),
        }),
      )
      pts = []
    }
    for (let i = 0; i < values.length; i++) {
      const raw = values[i]
      // A missing day is a gap. Skipping it would bridge the previous window
      // to the next one.
      if (raw === null || raw === undefined) {
        flush()
        continue
      }
      const nums = Array.isArray(raw) ? raw : [raw]
      let drew = false
      for (let j = 0; j < nums.length; j++) {
        const n = Number(nums[j])
        if (!Number.isFinite(n)) {
          continue
        }
        const x = this.pointX(i, values.length, left, plotW)
        const y = this.yAt(Math.min(Math.max(0, n), max), max, top, plotH)
        pts.push(x + ',' + y)
        drew = true
      }
      if (!drew) {
        flush()
      }
    }
    flush()
    }

  appendMtdDayAxis(svg, points, left, plotW, axisY, width) {
    const count = points.length
    const gap = count <= 1 ? plotW : plotW / (count - 1)
    // Full "30.09" labels collide when each day is only ~25px apart.
    const stagger = count > 3 && gap < 46
    const rowRight = [-1000, -1000]
    for (let i = 0; i < count; i++) {
      const x = this.pointX(i, count, left, plotW)
      const row = stagger && i % 2 === 1 ? 1 : 0
      svg.appendChild(
        this.svgNode('line', {
          class: 'chart-tick',
          x1: String(x),
          y1: String(axisY),
          x2: String(x),
          y2: String(axisY + 3),
        }),
      )
      const text = String((points[i] && points[i].date) || '')
      if (!text) {
        continue
      }
      const half = Math.max(8, text.length * 2.7)
      const isLast = i === count - 1
      let anchor = 'middle'
      let xText = x
      if (isLast && x + half > width - 3) {
        anchor = 'end'
        xText = width - 3
      } else if (i === 0 && x - half < 3) {
        anchor = 'start'
        xText = 3
      }
      const leftEdge = anchor === 'start' ? xText : anchor === 'end' ? xText - half * 2 : xText - half
      if (leftEdge < rowRight[row] + 4 && !isLast) {
        continue
      }
      rowRight[row] = anchor === 'end' ? xText : anchor === 'start' ? xText + half * 2 : xText + half
      const label = this.svgNode('text', {
        class: stagger ? 'chart-label is-day' : 'chart-label',
        x: String(Math.round(xText * 10) / 10),
        y: String(axisY + 13 + row * 12),
        'text-anchor': anchor,
      })
      this.setText(label, text)
      svg.appendChild(label)
    }
    }

  usageChartPoints() {
    if (this.session.querySource === 'codex-local') {
      return Array.isArray(this.session.codexCharts)
        ? this.session.codexCharts
        : []
    }
    return this.session.chartPoints
  }

  redrawUsageCharts() {
    const sourcePoints = this.usageChartPoints()
    const visible = this.settingsAxisBounds()
      ? sourcePoints
      : sliceChartPoints(
          sourcePoints,
          this.session.chartZoomMode,
          new Date(),
        )
    if (!visible || visible.length === 0) {
      this.clearSvg(this.session.chartTokensEl)
      this.redrawCostChart([])
      return
    }
    if (this.session.chartTokensEl) {
      this.drawChart(this.session.chartTokensEl, visible, 'tokens')
    }
    this.redrawCostChart(visible)
    }

  codexHasRates() {
    const stats = this.session.codexStats
    const priced = stats && stats.pricedShare ? Number(stats.pricedShare.priced) : 0
    return priced > 0
    }

  codexMissingModels() {
    const stats = this.session.codexStats
    const missing = stats && Array.isArray(stats.missingModels) ? stats.missingModels : []
    if (missing.length === 0) {
      return this.t('codex.noRates')
    }
    const join = this.t('codex.modelJoin')
    const names =
      missing.length === 1
        ? missing[0]
        : missing.slice(0, -1).join(', ') + join + missing[missing.length - 1]
    return this.t('codex.noRateForModels', { models: names })
    }

  redrawCostChart(visible) {
    const note = document.getElementById('chartCostEmpty')
    const svg = this.session.chartCostEl
    const codex = this.session.querySource === 'codex-local'
    const blocked = codex && !this.codexHasRates()
    if (note) {
      note.hidden = !blocked
      if (blocked) {
        this.setText(note, this.codexMissingModels())
      }
      const legend = note.previousElementSibling
      if (legend && legend.classList && legend.classList.contains('chart-legend')) {
        legend.hidden = blocked
      }
    }
    if (!svg) {
      return
    }
    const frame = svg.parentElement
    if (frame && frame.classList && frame.classList.contains('chart-frame')) {
      frame.hidden = blocked
    }
    svg.hidden = blocked
    if (blocked) {
      this.clearSvg(svg)
      return
    }
    if (!visible || visible.length === 0) {
      this.clearSvg(svg)
      return
    }
    this.drawChart(svg, visible, 'cost')
    }

  setChartBarMode(mode) {
    if (mode !== 'cumulative' && mode !== 'daily') {
      return
    }
    if (this.session.chartBarMode === mode) {
      return
    }
    this.session.chartBarMode = mode
    this.hideChartTip()
    this.session.syncDailyChartMode()
    this.redrawUsageCharts()
    }

  drawAllCharts() {
    if (this.session.querySource === 'openai-api') {
      this.clearSvg(this.session.chartTokensEl)
      this.clearSvg(this.session.chartCostEl)
      this.clearSvg(this.session.chartCodeLinesEl)
      for (let i = 0; i < this.session.mtdForecastSvgs.length; i++) {
        this.clearSvg(this.session.mtdForecastSvgs[i])
      }
      if (this.session.codeLinesChartCardEl) {
        this.session.codeLinesChartCardEl.hidden = true
      }
      if (this.session.chartsEmptyEl) {
        this.session.chartsEmptyEl.hidden = false
        this.session.setText(
          this.session.chartsEmptyEl,
          this.session.t('source.openaiEmpty'),
        )
      }
      this.hideChartTips()
      return
    }

    const codex = this.session.querySource === 'codex-local'
    const sourcePoints = this.usageChartPoints()
    const emptyQueries = !sourcePoints || sourcePoints.length === 0
    const emptyMtd =
      !this.session.mtdForecastPoints ||
      this.session.mtdForecastPoints.length === 0
    const hasCodeLinesSummary =
      !codex &&
      !!this.session.codeLinesSummary &&
      (typeof this.session.codeLinesSummary.ai === 'number' ||
        typeof this.session.codeLinesSummary.onMaster === 'number' ||
        typeof this.session.codeLinesSummary.allEdited === 'number')
    const emptyCodeLines =
      codex ||
      ((!this.session.codeLinesSeries ||
        this.session.codeLinesSeries.length === 0) &&
        !hasCodeLinesSummary)
    if (this.session.chartsEmptyEl) {
      this.session.chartsEmptyEl.hidden = !(
        emptyQueries &&
        emptyMtd &&
        emptyCodeLines
      )
      if (!this.session.chartsEmptyEl.hidden && !codex) {
        this.session.setText(
          this.session.chartsEmptyEl,
          this.session.t('queries.empty'),
        )
      }
    }
    this.redrawUsageCharts()
    const hasCodeLines = !emptyCodeLines
    if (this.session.codeLinesChartCardEl) {
      this.session.codeLinesChartCardEl.hidden = !hasCodeLines
    }
    if (!hasCodeLines) {
      this.clearSvg(this.session.chartCodeLinesEl)
      this.session.renderCodeLinesChartRatio(null)
      this.session.syncCodeLinesChartLegend(null)
    } else if (this.session.chartCodeLinesEl) {
      const headline = this.session.drawCodeLinesChart(
        this.session.chartCodeLinesEl,
        this.session.codeLinesSeries,
        this.session.codeLinesSummary,
      )
      this.session.renderCodeLinesChartRatio(headline)
      this.session.syncCodeLinesChartLegend(headline)
    }
    if (emptyMtd) {
      for (let i = 0; i < this.session.mtdForecastSvgs.length; i++) {
        this.clearSvg(this.session.mtdForecastSvgs[i])
      }
    } else {
      this.session.redrawMtdForecastChart()
    }
    this.syncCodexChartChrome(codex)
    this.redrawLimitChart(codex)
    if (emptyQueries && emptyMtd && emptyCodeLines) {
      this.hideChartTips()
    }
    this.refreshOpenChartDay()
    }

  syncCodexChartChrome(codex) {
    const generic = document.getElementById('tokenChartLegend')
    const stacked = document.getElementById('codexTokenLegend')
    if (generic) {
      generic.hidden = codex === true
    }
    if (stacked) {
      stacked.hidden = codex !== true
    }
    const note = document.getElementById('chartsPeriodNote')
    if (note) {
      note.hidden = codex === true || this.session.querySource === 'openai-api'
    }
    const card = document.getElementById('codexLimitChartCard')
    if (card) {
      card.hidden = codex !== true
    }
    }

  redrawLimitChart(codex) {
    const svg = document.getElementById('chartCodexLimits')
    const empty = document.getElementById('codexLimitEmpty')
    if (!codex) {
      if (svg) {
        this.clearSvg(svg)
      }
      return
    }
    const series = Array.isArray(this.session.codexLimitSeries)
      ? this.session.codexLimitSeries
      : []
    const drew = svg ? drawLimitHistory(svg, series, this) : false
    if (empty) {
      empty.hidden = drew === true
    }
    }
}
