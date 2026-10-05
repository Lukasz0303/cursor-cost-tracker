import { drawDailyChart } from './daily.js'
import {
  eventsForLocalDay,
  localDayKeyFromMs,
  sliceChartPoints,
} from './zoom.js'

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
  }

  chartBarMode() {
    return this.session.chartBarMode
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
    this.selectChartDay(selection)
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
    const used = line.used ? line.used[index] : null
    const limit = this.mtdTipLimit(point, line, index)
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
    const per =
      kind === 'tokens' ? this.compactTokens(point.tokens) : this.compactCost(point.costUsd)
    const total =
      kind === 'tokens' ? this.compactTokens(cumulative) : this.compactCost(cumulative)
    this.session.chartTipEl.replaceChildren()
    this.session.chartTipEl.appendChild(this.tipTitle(point.time))
    const queries = Number(point.queryCount)
    if (Number.isFinite(queries) && queries > 0) {
      this.session.chartTipEl.appendChild(this.tipSub(this.t('charts.tipQueries', { n: queries })))
    }
    this.session.chartTipEl.appendChild(
      this.tipRow(kind === 'tokens' ? this.t('charts.tipTokens') : this.t('charts.tipCost'), per),
    )
    this.session.chartTipEl.appendChild(this.tipRow(this.t('charts.tipTotal'), total))
    this.placeChartTip(clientX, clientY)
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
    const pts = []
    for (let i = 0; i < values.length; i++) {
      const raw = values[i]
      if (raw === null || raw === undefined) {
        continue
      }
      // Handle reset array [high, low] or single value
      const nums = Array.isArray(raw) ? raw : [raw]
      for (let j = 0; j < nums.length; j++) {
        const n = Number(nums[j])
        if (!Number.isFinite(n)) {
          continue
        }
        const x = this.pointX(i, values.length, left, plotW)
        const y = this.yAt(Math.min(Math.max(0, n), max), max, top, plotH)
        pts.push(x + ',' + y)
      }
    }
    if (pts.length === 0) {
      return
    }
    svg.appendChild(
      this.svgNode('polyline', {
        class: className,
        points: pts.join(' '),
      }),
    )
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

  redrawUsageCharts() {
    const visible = sliceChartPoints(this.session.chartPoints, this.session.chartZoomMode, new Date())
    if (!visible || visible.length === 0) {
      this.clearSvg(this.session.chartTokensEl)
      this.clearSvg(this.session.chartCostEl)
      return
    }
    if (this.session.chartTokensEl) {
      this.drawChart(this.session.chartTokensEl, visible, 'tokens')
    }
    if (this.session.chartCostEl) {
      this.drawChart(this.session.chartCostEl, visible, 'cost')
    }
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
    const emptyQueries = !this.session.chartPoints || this.session.chartPoints.length === 0
    const emptyMtd = !this.session.mtdForecastPoints || this.session.mtdForecastPoints.length === 0
    const hasCodeLinesSummary =
      !!this.session.codeLinesSummary &&
      (typeof this.session.codeLinesSummary.ai === 'number' ||
        typeof this.session.codeLinesSummary.onMaster === 'number' ||
        typeof this.session.codeLinesSummary.allEdited === 'number')
    const emptyCodeLines =
      (!this.session.codeLinesSeries || this.session.codeLinesSeries.length === 0) && !hasCodeLinesSummary
    if (this.session.chartsEmptyEl) {
      this.session.chartsEmptyEl.hidden = !(emptyQueries && emptyMtd && emptyCodeLines)
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
    if (emptyQueries && emptyMtd && emptyCodeLines) {
      this.hideChartTips()
    }
    this.refreshOpenChartDay()
    }
}
