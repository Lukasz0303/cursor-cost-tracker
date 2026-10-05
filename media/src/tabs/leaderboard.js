/** Leaderboard view. Edit here; media/history.js is generated. */
import { messageType } from '../messages.js'

export function createLeaderboardView(session) {
  let lbRows = []
  /** Email keys whose name and addresses are replaced in the results. */
  const lbAnon = new Set()
  let lbSortKey = 'linesMerged'
  let lbSortDir = 'desc'
  let lbScanning = false
  let lbAuthorsOpen = true
  let lbReposOpen = true
  let lbManualAuthors = []
  let lbGitAuthors = []
  let lbTeamEmails = []
  let lbMerges = []
  let lbRepoPayload = null

  function lbIso(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return y + '-' + m + '-' + d
  }

  function lbRange() {
    const fromEl = document.getElementById('lbFrom')
    const toEl = document.getElementById('lbTo')
    return {
      from: fromEl ? fromEl.value : '',
      to: toEl ? toEl.value : '',
    }
  }

  function lbRangeOk(range) {
    return Boolean(range.from) && Boolean(range.to) && range.from <= range.to
  }

  function lbEmailKey(email) {
    return String(email || '').trim().toLowerCase()
  }

  function lbEmailOk(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  function leaderboardAnonIndex(email) {
    const key = lbEmailKey(email)
    for (let i = 0; i < lbRows.length; i++) {
      if (lbEmailKey(lbRows[i].email) === key) {
        return i + 1
      }
    }
    return 1
  }

  /** Table and chart label. Anonymized rows never keep the git name or any address. */
  function leaderboardPublicName(email, name) {
    if (!lbAnon.has(lbEmailKey(email))) {
      return name || ''
    }
    return session.t('leaderboard.anonName', {
      n: String(leaderboardAnonIndex(email)),
    })
  }

  function boxEmails(box) {
    const raw = box.getAttribute('data-emails') || box.value || ''
    const emails = []
    const seen = {}
    const parts = String(raw).split('\n')
    for (let i = 0; i < parts.length; i++) {
      const email = parts[i].trim()
      const key = lbEmailKey(email)
      if (!key || seen[key]) {
        continue
      }
      seen[key] = true
      emails.push(email)
    }
    return emails
  }

  function selectedLeaderboardEmails() {
    const boxes = document.querySelectorAll('#lbAuthors input[type="checkbox"]')
    const emails = []
    const seen = {}
    for (let i = 0; i < boxes.length; i++) {
      if (!boxes[i].checked) {
        continue
      }
      const row = boxEmails(boxes[i])
      for (let j = 0; j < row.length; j++) {
        const key = lbEmailKey(row[j])
        if (seen[key]) {
          continue
        }
        seen[key] = true
        emails.push(row[j])
      }
    }
    return emails
  }

  function authorCheckState() {
    const boxes = document.querySelectorAll('#lbAuthors input[type="checkbox"]')
    const state = {}
    for (let i = 0; i < boxes.length; i++) {
      const row = boxEmails(boxes[i])
      for (let j = 0; j < row.length; j++) {
        state[lbEmailKey(row[j])] = boxes[i].checked
      }
    }
    return state
  }

  function syncAuthorTools() {
    const tools = document.getElementById('lbAuthorTools')
    const authors = document.getElementById('lbAuthors')
    const toggle = document.getElementById('lbToggleAuthors')
    const selectAll = document.getElementById('lbSelectAll')
    const manual = document.getElementById('lbManualEmail')
    const count = authors ? authors.querySelectorAll('.lb-author').length : 0
    if (tools) {
      tools.hidden = count === 0
    }
    if (authors) {
      authors.hidden = count === 0 || !lbAuthorsOpen
    }
    if (toggle) {
      toggle.setAttribute('aria-expanded', lbAuthorsOpen ? 'true' : 'false')
      session.setText(toggle, lbAuthorsOpen ? session.t('leaderboard.collapse') : session.t('leaderboard.expand'))
    }
    if (selectAll) {
      const boxes = authors ? authors.querySelectorAll('input[type="checkbox"]') : []
      let allOn = boxes.length > 0
      let checkedRows = 0
      for (let i = 0; i < boxes.length; i++) {
        if (!boxes[i].checked) {
          allOn = false
        } else {
          checkedRows += 1
        }
      }
      session.setText(selectAll, allOn ? session.t('leaderboard.clearAll') : session.t('leaderboard.selectAll'))
      const merge = document.getElementById('lbMerge')
      if (merge) {
        merge.disabled = lbScanning || checkedRows < 2
      }
    }
    if (manual) {
      manual.placeholder = session.t('leaderboard.manualPlaceholder')
    }
  }

  function syncLeaderboardButtons() {
    const scan = document.getElementById('lbScan')
    const load = document.getElementById('lbLoad')
    const myTeam = document.getElementById('lbMyTeam')
    const saveTeam = document.getElementById('lbSaveTeam')
    const exp = document.getElementById('lbExport')
    const range = lbRange()
    const ok = lbRangeOk(range)
    if (load) {
      load.disabled = lbScanning || !ok
    }
    if (myTeam) {
      myTeam.disabled = lbScanning
    }
    const myRepos = document.getElementById('lbMyRepos')
    if (myRepos) {
      myRepos.disabled = lbScanning
    }
    if (saveTeam) {
      saveTeam.disabled = lbScanning || selectedLeaderboardEmails().length === 0
    }
    if (scan) {
      scan.disabled =
        lbScanning || !ok || selectedLeaderboardEmails().length === 0
      session.setText(scan, lbScanning ? session.t('leaderboard.scanning') : session.t('leaderboard.scan'))
    }
    if (exp) {
      exp.disabled = lbScanning || lbRows.length === 0
    }
    const add = document.getElementById('lbAddEmail')
    const manual = document.getElementById('lbManualEmail')
    const selectAll = document.getElementById('lbSelectAll')
    const toggle = document.getElementById('lbToggleAuthors')
    if (add) {
      add.disabled = lbScanning
    }
    if (manual) {
      manual.disabled = lbScanning
    }
    if (selectAll) {
      selectAll.disabled = lbScanning
    }
    if (toggle) {
      toggle.disabled = lbScanning
    }
  }

  function clearLeaderboardResult() {
    lbRows = []
    const body = document.getElementById('lbBody')
    const wrap = document.getElementById('lbTableWrap')
    const empty = document.getElementById('lbEmpty')
    const meta = document.getElementById('lbMeta')
    if (body) {
      body.textContent = ''
    }
    if (wrap) {
      wrap.hidden = true
    }
    if (empty) {
      empty.hidden = false
    }
    if (meta) {
      session.setText(meta, '')
    }
    paintLeaderboardChart(null)
    syncLeaderboardReposToggle()
    syncLeaderboardResultBar()
    syncLeaderboardButtons()
  }

  function onLeaderboardDatesChanged() {
    lbGitAuthors = []
    paintLeaderboardAuthors(null)
    clearLeaderboardResult()
  }

  function applyLeaderboardRange(from, to) {
    const fromEl = document.getElementById('lbFrom')
    const toEl = document.getElementById('lbTo')
    if (fromEl && !fromEl.value && typeof from === 'string') {
      fromEl.value = from
    }
    if (toEl && !toEl.value && typeof to === 'string') {
      toEl.value = to
    }
    syncLeaderboardButtons()
  }

  function markLbSort() {
    const buttons = document.querySelectorAll('[data-lb-sort]')
    for (let i = 0; i < buttons.length; i++) {
      const key = buttons[i].getAttribute('data-lb-sort')
      const i18nKey = buttons[i].getAttribute('data-i18n')
      const label = i18nKey ? session.lookupPath(session.ui, i18nKey) : ''
      const base = typeof label === 'string' ? label : ''
      const arrow = key === lbSortKey ? (lbSortDir === 'asc' ? ' ↑' : ' ↓') : ''
      session.setText(buttons[i], base + arrow)
    }
  }

  function compareLbRows(left, right) {
    if (lbSortKey === 'name') {
      const byName = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      return lbSortDir === 'asc' ? byName : -byName
    }
    if (lbSortKey === 'repositories') {
      const delta = left.repositories.length - right.repositories.length
      if (delta !== 0) {
        return lbSortDir === 'asc' ? delta : -delta
      }
      const a = left.repositories[0] ? left.repositories[0].label : ''
      const b = right.repositories[0] ? right.repositories[0].label : ''
      return a.localeCompare(b, undefined, { sensitivity: 'base' })
    }
    const delta = Number(left[lbSortKey]) - Number(right[lbSortKey])
    if (delta !== 0) {
      return lbSortDir === 'asc' ? delta : -delta
    }
    if (right.commits !== left.commits) {
      return right.commits - left.commits
    }
    return left.email.localeCompare(right.email, undefined, { sensitivity: 'base' })
  }

  function formatLeaderboardCount(n) {
    const value = Math.trunc(Number(n))
    if (!Number.isFinite(value)) {
      return '0'
    }
    const sign = value < 0 ? '-' : ''
    const digits = String(Math.abs(value))
    return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
  }

  let lbChartPayload = null
  let lbChartMonthly = false
  let lbChartBars = false
  const lbChartHidden = new Set()

  const LB_CHART_COLORS = [
    '#6ea8fe',
    '#f0a36a',
    '#7dcea0',
    '#e07a9a',
    '#c4b15a',
    '#8e7cc3',
    '#5ec8d8',
    '#e07a5f',
    '#81b29a',
    '#3d5a80',
  ]

  function leaderboardAxisLabel(iso) {
    if (iso.indexOf('.') !== -1) {
      return iso
    }
    return iso.slice(8) + '.' + iso.slice(5, 7)
  }

  function monthlyLeaderboardChart(dates, series) {
    const keys = []
    const indexOf = {}
    for (let i = 0; i < dates.length; i++) {
      const key = String(dates[i]).slice(0, 7)
      if (indexOf[key] === undefined) {
        indexOf[key] = keys.length
        keys.push(key)
      }
    }
    const labels = keys.map(function (key) {
      return key.slice(5) + '.' + key.slice(0, 4)
    })
    const next = []
    for (let s = 0; s < series.length; s++) {
      const lines = new Array(keys.length)
      for (let m = 0; m < keys.length; m++) {
        lines[m] = 0
      }
      const src = series[s].lines || []
      for (let i = 0; i < dates.length; i++) {
        const idx = indexOf[String(dates[i]).slice(0, 7)]
        lines[idx] += Number(src[i]) || 0
      }
      next.push({
        name: series[s].name,
        email: series[s].email,
        lines: lines,
      })
    }
    return { dates: labels, series: next }
  }

  function leaderboardLineColor(email) {
    const series =
      lbChartPayload && Array.isArray(lbChartPayload.series) ? lbChartPayload.series : []
    const key = String(email || '').toLowerCase()
    for (let i = 0; i < series.length; i++) {
      if (String(series[i].email || '').toLowerCase() === key) {
        return LB_CHART_COLORS[i % LB_CHART_COLORS.length]
      }
    }
    return LB_CHART_COLORS[0]
  }

  function paintLeaderboardChart(chart) {
    const host = document.getElementById('lbChart')
    if (!host) {
      return
    }
    const dates = chart && Array.isArray(chart.dates) ? chart.dates : []
    const series = chart && Array.isArray(chart.series) ? chart.series : []
    lbChartPayload = chart && dates.length > 0 ? chart : null
    if (dates.length === 0 || series.length === 0) {
      host.hidden = true
      host.textContent = ''
      return
    }
    host.hidden = false
    host.textContent = ''
    const plot = lbChartMonthly ? monthlyLeaderboardChart(dates, series) : { dates: dates, series: series }
    const plotDates = plot.dates
    const plotSeries = plot.series
    const head = session.el('div', 'lb-chart-head')
    const title = session.el('h3', 'lb-chart-title')
    session.setText(title, session.t('leaderboard.chartTitle'))
    const controls = session.el('div', 'lb-chart-controls')
    const mode = session.el('label', 'lb-chart-mode')
    const daily = session.el('span')
    session.setText(daily, session.t('leaderboard.chartDaily'))
    const monthly = session.el('span')
    session.setText(monthly, session.t('leaderboard.chartMonthly'))
    const toggle = document.createElement('input')
    toggle.type = 'checkbox'
    toggle.className = 'settings-switch'
    toggle.checked = lbChartMonthly
    toggle.setAttribute('aria-label', session.t('leaderboard.chartMonthly'))
    toggle.addEventListener('change', function () {
      lbChartMonthly = toggle.checked
      paintLeaderboardChart(lbChartPayload)
    })
    mode.appendChild(daily)
    mode.appendChild(toggle)
    mode.appendChild(monthly)
    const style = session.el('label', 'lb-chart-mode')
    const lineLabel = session.el('span')
    session.setText(lineLabel, session.t('leaderboard.chartLine'))
    const barLabel = session.el('span')
    session.setText(barLabel, session.t('leaderboard.chartBar'))
    const styleToggle = document.createElement('input')
    styleToggle.type = 'checkbox'
    styleToggle.className = 'settings-switch'
    styleToggle.checked = lbChartBars
    styleToggle.setAttribute('aria-label', session.t('leaderboard.chartBar'))
    styleToggle.addEventListener('change', function () {
      lbChartBars = styleToggle.checked
      paintLeaderboardChart(lbChartPayload)
    })
    style.appendChild(lineLabel)
    style.appendChild(styleToggle)
    style.appendChild(barLabel)
    controls.appendChild(mode)
    controls.appendChild(style)
    head.appendChild(title)
    head.appendChild(controls)
    host.appendChild(head)
    let max = 1
    const drawn = []
    for (let s = 0; s < plotSeries.length; s++) {
      const hidden = lbChartHidden.has(String(plotSeries[s].email || '').toLowerCase())
      const lines = plotSeries[s].lines || []
      const running = []
      let sum = 0
      for (let i = 0; i < plotDates.length; i++) {
        sum += Number(lines[i]) || 0
        running.push(sum)
        if (!hidden && sum > max) {
          max = sum
        }
      }
      if (!hidden) {
        drawn.push({
          name: leaderboardPublicName(
            plotSeries[s].email,
            plotSeries[s].name || plotSeries[s].email,
          ),
          color: LB_CHART_COLORS[s % LB_CHART_COLORS.length],
          running: running,
        })
      }
    }
    const width = 720
    const height = 248
    const left = 78
    const right = 16
    const top = 14
    const bottom = 28
    const plotW = width - left - right
    const plotH = height - top - bottom
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
    svg.setAttribute('class', 'lb-chart-svg')
    svg.setAttribute('role', 'img')
    function xAt(index) {
      if (plotDates.length === 1) {
        return left + plotW / 2
      }
      return left + (plotW * index) / (plotDates.length - 1)
    }
    function barCenterX(index, seriesIndex) {
      const gap = plotW / Math.max(1, plotDates.length)
      const cluster = Math.max(2, gap * 0.82)
      const count = Math.max(1, drawn.length)
      const barW = Math.max(1.5, Math.min(28, cluster / count))
      const clusterLeft = left + gap * index + (gap - cluster) / 2
      return clusterLeft + barW * seriesIndex + barW / 2
    }
    function barWidth() {
      const gap = plotW / Math.max(1, plotDates.length)
      const cluster = Math.max(2, gap * 0.82)
      const count = Math.max(1, drawn.length)
      return Math.max(1.5, Math.min(28, cluster / count))
    }
    function yAt(value) {
      return top + plotH - (plotH * value) / max
    }
    const ticks = []
    const seenTick = {}
    for (let step = 0; step < 5; step++) {
      const value = step === 4 ? 0 : Math.round((max * (4 - step)) / 4)
      if (seenTick[value]) {
        continue
      }
      seenTick[value] = true
      ticks.push(value)
    }
    for (let tIndex = 0; tIndex < ticks.length; tIndex++) {
      const value = ticks[tIndex]
      const y = yAt(value)
      const grid = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      grid.setAttribute('x1', String(left))
      grid.setAttribute('x2', String(width - right))
      grid.setAttribute('y1', String(y))
      grid.setAttribute('y2', String(y))
      grid.setAttribute('class', 'lb-chart-grid')
      svg.appendChild(grid)
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      label.setAttribute('x', String(left - 6))
      label.setAttribute('y', String(y + 3))
      label.setAttribute('class', 'lb-chart-label')
      label.setAttribute('text-anchor', 'end')
      label.textContent = formatLeaderboardCount(value)
      svg.appendChild(label)
    }
    const labelAt = []
    if (plotDates.length <= 12) {
      for (let i = 0; i < plotDates.length; i++) {
        labelAt.push(i)
      }
    } else {
      const slots = 8
      const seenSlot = {}
      for (let i = 0; i < slots; i++) {
        const index = Math.round((i * (plotDates.length - 1)) / (slots - 1))
        if (seenSlot[index]) {
          continue
        }
        seenSlot[index] = true
        labelAt.push(index)
      }
    }
    for (let i = 0; i < labelAt.length; i++) {
      const index = labelAt[i]
      const x = lbChartBars ? barCenterX(index, Math.floor(drawn.length / 2)) : xAt(index)
      const guide = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      guide.setAttribute('x1', String(x))
      guide.setAttribute('x2', String(x))
      guide.setAttribute('y1', String(top))
      guide.setAttribute('y2', String(top + plotH))
      guide.setAttribute('class', 'lb-chart-grid')
      svg.appendChild(guide)
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      label.setAttribute('x', String(x))
      label.setAttribute('y', String(height - 8))
      label.setAttribute('class', 'lb-chart-label')
      label.setAttribute('text-anchor', index === plotDates.length - 1 ? 'end' : 'middle')
      label.textContent = leaderboardAxisLabel(plotDates[index])
      svg.appendChild(label)
    }
    const tip = session.el('div', 'chart-tip lb-chart-tip')
    tip.hidden = true
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    hit.setAttribute('x', String(left))
    hit.setAttribute('y', String(top))
    hit.setAttribute('width', String(plotW))
    hit.setAttribute('height', String(plotH))
    hit.setAttribute('fill', 'transparent')
    hit.setAttribute('class', 'lb-chart-hit')

    if (lbChartBars) {
      const barW = barWidth()
      const barNodes = []
      for (let s = 0; s < drawn.length; s++) {
        const nodes = []
        for (let i = 0; i < plotDates.length; i++) {
          const value = drawn[s].running[i] || 0
          const y = yAt(value)
          const h = top + plotH - y
          if (h <= 0) {
            nodes.push(null)
            continue
          }
          const cx = barCenterX(i, s)
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          rect.setAttribute('x', String(cx - barW / 2))
          rect.setAttribute('y', String(y))
          rect.setAttribute('width', String(barW))
          rect.setAttribute('height', String(Math.max(1, h)))
          rect.setAttribute('fill', drawn[s].color)
          rect.setAttribute('class', 'lb-chart-bar')
          rect.setAttribute('pointer-events', 'none')
          svg.appendChild(rect)
          nodes.push(rect)
        }
        barNodes.push(nodes)
      }
      function hideBarTip() {
        tip.hidden = true
        for (let s = 0; s < barNodes.length; s++) {
          for (let i = 0; i < barNodes[s].length; i++) {
            const node = barNodes[s][i]
            if (node) {
              node.classList.remove('is-hot')
            }
          }
        }
      }
      hit.addEventListener('mousemove', function (event) {
        const ctm = svg.getScreenCTM()
        if (!ctm || drawn.length === 0) {
          hideBarTip()
          return
        }
        const point = svg.createSVGPoint()
        point.x = event.clientX
        point.y = event.clientY
        const local = point.matrixTransform(ctm.inverse())
        const gap = plotW / Math.max(1, plotDates.length)
        let index = Math.floor((local.x - left) / gap)
        if (index < 0) {
          index = 0
        }
        if (index > plotDates.length - 1) {
          index = plotDates.length - 1
        }
        let chosen = 0
        let bestDist = Infinity
        for (let s = 0; s < drawn.length; s++) {
          const dist = Math.abs(barCenterX(index, s) - local.x)
          if (dist < bestDist) {
            bestDist = dist
            chosen = s
          }
        }
        hideBarTip()
        const series = drawn[chosen]
        const node = barNodes[chosen][index]
        if (node) {
          node.classList.add('is-hot')
        }
        tip.replaceChildren()
        tip.style.setProperty('--lb-tip-color', series.color)
        tip.appendChild(session.tipTitle(series.name))
        tip.appendChild(session.tipSub(leaderboardAxisLabel(plotDates[index])))
        const value = session.el('p', 'chart-tip-title')
        session.setText(value, formatLeaderboardCount(series.running[index] || 0))
        tip.appendChild(value)
        session.placeTip(tip, host, event.clientX, event.clientY)
      })
      hit.addEventListener('mouseleave', hideBarTip)
    } else {
      const lineNodes = []
      for (let s = 0; s < drawn.length; s++) {
        const points = []
        for (let i = 0; i < plotDates.length; i++) {
          points.push(xAt(i) + ',' + yAt(drawn[s].running[i]))
        }
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
        line.setAttribute('points', points.join(' '))
        line.setAttribute('fill', 'none')
        line.setAttribute('stroke', drawn[s].color)
        line.setAttribute('stroke-width', '2.25')
        line.setAttribute('stroke-linejoin', 'round')
        line.setAttribute('stroke-linecap', 'round')
        line.setAttribute('pointer-events', 'none')
        svg.appendChild(line)
        lineNodes.push(line)
      }
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      marker.setAttribute('r', '3.5')
      marker.setAttribute('class', 'lb-chart-dot')
      marker.setAttribute('pointer-events', 'none')
      marker.setAttribute('visibility', 'hidden')
      svg.appendChild(marker)
      function hideLineTip() {
        tip.hidden = true
        marker.setAttribute('visibility', 'hidden')
        for (let s = 0; s < lineNodes.length; s++) {
          lineNodes[s].setAttribute('stroke-width', '2.25')
        }
      }
      hit.addEventListener('mousemove', function (event) {
        const ctm = svg.getScreenCTM()
        if (!ctm || drawn.length === 0) {
          hideLineTip()
          return
        }
        const point = svg.createSVGPoint()
        point.x = event.clientX
        point.y = event.clientY
        const local = point.matrixTransform(ctm.inverse())
        let index = 0
        let bestX = Infinity
        for (let i = 0; i < plotDates.length; i++) {
          const dist = Math.abs(xAt(i) - local.x)
          if (dist < bestX) {
            bestX = dist
            index = i
          }
        }
        const threshold = 18 / Math.abs(ctm.a || 1)
        let chosen = -1
        let bestY = Infinity
        for (let s = 0; s < drawn.length; s++) {
          const dy = Math.abs(yAt(drawn[s].running[index]) - local.y)
          if (dy < bestY) {
            bestY = dy
            chosen = s
          }
        }
        if (chosen < 0 || bestY > threshold) {
          hideLineTip()
          return
        }
        const series = drawn[chosen]
        const y = yAt(series.running[index])
        marker.setAttribute('cx', String(xAt(index)))
        marker.setAttribute('cy', String(y))
        marker.setAttribute('fill', series.color)
        marker.setAttribute('visibility', 'visible')
        for (let s = 0; s < lineNodes.length; s++) {
          lineNodes[s].setAttribute('stroke-width', s === chosen ? '3.25' : '2.25')
        }
        tip.replaceChildren()
        tip.style.setProperty('--lb-tip-color', series.color)
        tip.appendChild(session.tipTitle(series.name))
        tip.appendChild(session.tipSub(leaderboardAxisLabel(plotDates[index])))
        const value = session.el('p', 'chart-tip-title')
        session.setText(value, formatLeaderboardCount(series.running[index] || 0))
        tip.appendChild(value)
        session.placeTip(tip, host, event.clientX, event.clientY)
      })
      hit.addEventListener('mouseleave', hideLineTip)
    }
    svg.appendChild(hit)
    host.appendChild(svg)
    host.appendChild(tip)
    const legend = session.el('div', 'lb-chart-legend')
    for (let s = 0; s < drawn.length; s++) {
      const item = session.el('span', 'lb-chart-key')
      const swatch = session.el('i')
      swatch.style.background = drawn[s].color
      item.appendChild(swatch)
      item.appendChild(document.createTextNode(drawn[s].name))
      legend.appendChild(item)
    }
    host.appendChild(legend)
  }

  function paintLeaderboardRows() {
    const body = document.getElementById('lbBody')
    const wrap = document.getElementById('lbTableWrap')
    const empty = document.getElementById('lbEmpty')
    if (!body) {
      return
    }
    body.textContent = ''
    const sorted = lbRows.slice().sort(compareLbRows)
    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i]
      const tr = document.createElement('tr')
      const who = document.createElement('td')
      const lineKey = String(row.email || '').toLowerCase()
      const anonKey = lbEmailKey(row.email)
      const pick = document.createElement('label')
      pick.className = 'lb-line-pick'
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.checked = !lbChartHidden.has(lineKey)
      const shown = leaderboardPublicName(row.email, row.name)
      const hiddenName = lbAnon.has(anonKey)
      box.setAttribute('aria-label', shown)
      const swatch = session.el('i', 'lb-line-swatch')
      swatch.style.background = leaderboardLineColor(row.email)
      pick.appendChild(box)
      pick.appendChild(swatch)
      if (!box.checked) {
        tr.classList.add('is-off')
      }
      box.addEventListener('change', function () {
        if (box.checked) {
          lbChartHidden.delete(lineKey)
          tr.classList.remove('is-off')
        } else {
          lbChartHidden.add(lineKey)
          tr.classList.add('is-off')
        }
        paintLeaderboardChart(lbChartPayload)
      })
      const nameRow = session.el('div', 'lb-name-row')
      const name = session.el('div', 'lb-name')
      session.setText(name, shown)
      const anon = document.createElement('button')
      anon.type = 'button'
      anon.className = 'action-btn lb-anon'
      session.setText(
        anon,
        session.t(hiddenName ? 'leaderboard.showName' : 'leaderboard.anonymize'),
      )
      anon.addEventListener('click', function () {
        if (lbAnon.has(anonKey)) {
          lbAnon.delete(anonKey)
        } else {
          lbAnon.add(anonKey)
        }
        paintLeaderboardRows()
        paintLeaderboardChart(lbChartPayload)
        const status = document.getElementById('lbAuthorStatus')
        paintLeaderboardAuthors(status && !status.hidden ? status.textContent : null)
      })
      nameRow.appendChild(name)
      nameRow.appendChild(anon)
      who.appendChild(pick)
      who.appendChild(nameRow)
      if (!hiddenName) {
        const mail = session.el('div', 'lb-email')
        const addresses =
          row.emails && row.emails.length ? row.emails : [row.email]
        session.setText(mail, addresses.join('\n'))
        who.appendChild(mail)
      }
      tr.appendChild(who)
      session.addCell(tr, formatLeaderboardCount(row.linesMerged), 'lb-added')
      session.addCell(tr, formatLeaderboardCount(row.commits), 'lb-num')
      session.addCell(tr, formatLeaderboardCount(row.linesDeleted), 'lb-deleted')
      session.addCell(tr, formatLeaderboardCount(row.netLines), 'lb-num')
      session.addCell(tr, formatLeaderboardCount(row.activeDays), 'lb-num')
      const repos = document.createElement('td')
      if (!row.repositories || row.repositories.length === 0) {
        session.setText(repos, session.t('leaderboard.none'))
      } else {
        const extra = row.repositories.length > 1
        const chips = session.el('div', 'lb-repos' + (extra && !lbReposOpen ? ' is-collapsed' : ''))
        for (let r = 0; r < row.repositories.length; r++) {
          const repo = row.repositories[r]
          const chip = session.el('span', r === 0 ? 'lb-repo' : 'lb-repo lb-repo-extra')
          const name = session.el('span', 'lb-repo-name')
          session.setText(name, repo.label)
          const lines = session.el('span', 'lb-repo-lines')
          session.setText(lines, '(' + formatLeaderboardCount(repo.linesMerged) + ')')
          chip.appendChild(name)
          chip.appendChild(lines)
          chip.title = repo.path
          chips.appendChild(chip)
        }
        if (extra) {
          const more = session.el('span', 'lb-repo lb-repo-more')
          session.setText(more, '+' + String(row.repositories.length - 1))
          more.title = row.repositories
            .slice(1)
            .map(function (repo) {
              return repo.label + ' (' + formatLeaderboardCount(repo.linesMerged) + ')'
            })
            .join(', ')
          chips.appendChild(more)
        }
        repos.appendChild(chips)
      }
      tr.appendChild(repos)
      body.appendChild(tr)
    }
    if (wrap) {
      wrap.hidden = sorted.length === 0
    }
    if (empty) {
      empty.hidden = sorted.length !== 0
    }
    markLbSort()
    syncLeaderboardReposToggle()
    syncLeaderboardResultBar()
    syncLeaderboardButtons()
  }

  function syncLeaderboardResultBar() {
    const bar = document.getElementById('lbResultBar')
    if (bar) {
      bar.hidden = lbRows.length === 0
    }
  }

  function syncLeaderboardReposToggle() {
    const btn = document.getElementById('lbToggleRepos')
    if (!btn) {
      return
    }
    let extra = false
    for (let i = 0; i < lbRows.length; i++) {
      if (lbRows[i].repositories && lbRows[i].repositories.length > 1) {
        extra = true
        break
      }
    }
    btn.hidden = !extra
    btn.setAttribute('aria-expanded', lbReposOpen ? 'true' : 'false')
    session.setText(btn, lbReposOpen ? session.t('leaderboard.collapseRepos') : session.t('leaderboard.expandRepos'))
  }

  function appendLeaderboardAuthor(authors, person, checked, manual) {
    const emails = person.emails && person.emails.length ? person.emails : [person.email]
    const label = session.el('label', 'lb-author')
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.value = emails[0]
    box.setAttribute('data-emails', emails.join('\n'))
    box.checked = checked
    box.addEventListener('change', function () {
      syncLeaderboardButtons()
      syncAuthorTools()
    })
    const text = session.el('span')
    const mailLine = emails.join(', ')
    const same = lbEmailKey(person.name) === lbEmailKey(emails[0])
    const hidden = emails.some(function (email) {
      return lbAnon.has(lbEmailKey(email))
    })
    session.setText(
      text,
      hidden
        ? leaderboardPublicName(emails[0], person.name)
        : same || !person.name
          ? mailLine
          : person.name + ' · ' + mailLine,
    )
    label.appendChild(box)
    label.appendChild(text)
    if (person.merged) {
      const split = document.createElement('button')
      split.type = 'button'
      split.className = 'action-btn lb-author-remove'
      session.setText(split, session.t('leaderboard.unmergeEmails'))
      split.addEventListener('click', function (event) {
        event.preventDefault()
        event.stopPropagation()
        unmergeLeaderboardEmails(emails)
      })
      label.appendChild(split)
    } else if (manual) {
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'action-btn lb-author-remove'
      session.setText(remove, session.t('leaderboard.removeEmail'))
      remove.addEventListener('click', function (event) {
        event.preventDefault()
        event.stopPropagation()
        const key = lbEmailKey(person.email)
        lbManualAuthors = lbManualAuthors.filter(function (row) {
          return lbEmailKey(row.email) !== key
        })
        paintLeaderboardAuthors(null)
      })
      label.appendChild(remove)
    }
    authors.appendChild(label)
  }

  function paintLeaderboardAuthors(errorText) {
    const status = document.getElementById('lbAuthorStatus')
    const authors = document.getElementById('lbAuthors')
    if (!authors) {
      return
    }
    const checked = authorCheckState()
    authors.textContent = ''
    const known = {}
    for (let i = 0; i < lbGitAuthors.length; i++) {
      const person = lbGitAuthors[i]
      const key = lbEmailKey(person.email)
      if (key && !known[key]) {
        known[key] = { email: person.email, name: person.name, manual: false }
      }
    }
    for (let i = 0; i < lbManualAuthors.length; i++) {
      const person = lbManualAuthors[i]
      const key = lbEmailKey(person.email)
      if (key && !known[key]) {
        known[key] = { email: person.email, name: person.name, manual: true }
      }
    }
    const mergeOf = {}
    for (let g = 0; g < lbMerges.length; g++) {
      for (let i = 0; i < lbMerges[g].length; i++) {
        const key = lbEmailKey(lbMerges[g][i])
        if (key && mergeOf[key] === undefined) {
          mergeOf[key] = g
        }
      }
    }
    const used = {}
    const list = []
    function pushEmail(email) {
      const key = lbEmailKey(email)
      if (!key || used[key]) {
        return
      }
      const groupIndex = mergeOf[key]
      if (groupIndex === undefined) {
        const person = known[key]
        if (!person) {
          return
        }
        used[key] = true
        list.push({
          person: {
            email: person.email,
            emails: [person.email],
            name: person.name,
            merged: false,
          },
          manual: person.manual,
        })
        return
      }
      const emails = []
      let name = ''
      let manual = true
      const group = lbMerges[groupIndex]
      for (let i = 0; i < group.length; i++) {
        const addr = group[i]
        const addrKey = lbEmailKey(addr)
        if (!addrKey || used[addrKey]) {
          continue
        }
        used[addrKey] = true
        emails.push(addr)
        const person = known[addrKey]
        if (person && !name && lbEmailKey(person.name) !== addrKey) {
          name = person.name
        }
        if (person && !person.manual) {
          manual = false
        }
      }
      if (emails.length === 0) {
        return
      }
      list.push({
        person: {
          email: emails[0],
          emails: emails,
          name: name || emails[0],
          merged: emails.length > 1,
        },
        manual: manual,
      })
    }
    for (let g = 0; g < lbMerges.length; g++) {
      if (lbMerges[g].length > 0) {
        pushEmail(lbMerges[g][0])
      }
    }
    const knownKeys = Object.keys(known)
    for (let i = 0; i < knownKeys.length; i++) {
      pushEmail(known[knownKeys[i]].email)
    }
    if (status) {
      status.hidden = !errorText
      session.setText(status, errorText || '')
    }
    for (let i = 0; i < list.length; i++) {
      const row = list[i]
      const emails = row.person.emails
      let isOn = false
      let anyState = false
      for (let e = 0; e < emails.length; e++) {
        const key = lbEmailKey(emails[e])
        if (checked[key] === true) {
          isOn = true
        }
        if (checked[key] !== undefined) {
          anyState = true
        }
      }
      if (!anyState) {
        isOn = row.manual
      }
      appendLeaderboardAuthor(authors, row.person, isOn, row.manual && !row.person.merged)
    }
    syncAuthorTools()
    syncLeaderboardButtons()
  }

  function saveLeaderboardMerges(groups) {
    session.vscode.postMessage({ type: messageType.saveLeaderboardMerges, groups: groups })
  }

  function mergeCheckedAuthors() {
    const boxes = document.querySelectorAll('#lbAuthors input[type="checkbox"]')
    const picked = []
    const pickedSet = {}
    let rows = 0
    for (let i = 0; i < boxes.length; i++) {
      if (!boxes[i].checked) {
        continue
      }
      rows += 1
      const emails = boxEmails(boxes[i])
      for (let j = 0; j < emails.length; j++) {
        const key = lbEmailKey(emails[j])
        if (pickedSet[key]) {
          continue
        }
        pickedSet[key] = true
        picked.push(emails[j])
      }
    }
    if (rows < 2 || picked.length < 2) {
      return
    }
    const next = []
    for (let g = 0; g < lbMerges.length; g++) {
      const rest = []
      for (let i = 0; i < lbMerges[g].length; i++) {
        if (!pickedSet[lbEmailKey(lbMerges[g][i])]) {
          rest.push(lbMerges[g][i])
        }
      }
      if (rest.length >= 2) {
        next.push(rest)
      }
    }
    next.push(picked)
    lbAuthorsOpen = true
    saveLeaderboardMerges(next)
  }

  function unmergeLeaderboardEmails(emails) {
    const drop = {}
    for (let i = 0; i < emails.length; i++) {
      drop[lbEmailKey(emails[i])] = true
    }
    const next = []
    for (let g = 0; g < lbMerges.length; g++) {
      let hit = false
      for (let i = 0; i < lbMerges[g].length; i++) {
        if (drop[lbEmailKey(lbMerges[g][i])]) {
          hit = true
          break
        }
      }
      if (!hit) {
        next.push(lbMerges[g])
      }
    }
    saveLeaderboardMerges(next)
  }

  function renderLeaderboardMerges(data) {
    const raw = data && Array.isArray(data.groups) ? data.groups : []
    lbMerges = []
    for (let g = 0; g < raw.length; g++) {
      if (!Array.isArray(raw[g]) || raw[g].length < 2) {
        continue
      }
      const emails = []
      for (let i = 0; i < raw[g].length; i++) {
        const email = String(raw[g][i] || '').trim()
        if (lbEmailOk(email)) {
          emails.push(email)
        }
      }
      if (emails.length >= 2) {
        lbMerges.push(emails)
      }
    }
    paintLeaderboardAuthors(null)
  }

  function renderLeaderboardAuthors(data) {
    lbGitAuthors = data && Array.isArray(data.authors) ? data.authors : []
    paintLeaderboardAuthors(data && data.error ? data.error : null)
  }

  function addManualLeaderboardEmail(raw) {
    const email = String(raw || '').trim()
    const status = document.getElementById('lbAuthorStatus')
    if (!lbEmailOk(email)) {
      if (status) {
        status.hidden = false
        session.setText(status, session.t('leaderboard.invalidEmail'))
      }
      return
    }
    if (status) {
      status.hidden = true
      session.setText(status, '')
    }
    const key = lbEmailKey(email)
    const boxes = document.querySelectorAll('#lbAuthors input[type="checkbox"]')
    for (let i = 0; i < boxes.length; i++) {
      const row = boxEmails(boxes[i])
      for (let j = 0; j < row.length; j++) {
        if (lbEmailKey(row[j]) === key) {
          boxes[i].checked = true
          syncAuthorTools()
          syncLeaderboardButtons()
          return
        }
      }
    }
    lbManualAuthors.push({ email: email, name: email })
    lbAuthorsOpen = true
    paintLeaderboardAuthors(null)
  }

  function applyLeaderboardTeam() {
    const status = document.getElementById('lbAuthorStatus')
    if (lbTeamEmails.length === 0) {
      if (status) {
        status.hidden = false
        session.setText(status, session.t('leaderboard.teamEmpty'))
      }
      syncLeaderboardButtons()
      return
    }
    const wanted = {}
    for (let i = 0; i < lbTeamEmails.length; i++) {
      wanted[lbEmailKey(lbTeamEmails[i])] = lbTeamEmails[i]
    }
    const present = {}
    for (let i = 0; i < lbManualAuthors.length; i++) {
      present[lbEmailKey(lbManualAuthors[i].email)] = true
    }
    const keys = Object.keys(wanted)
    for (let i = 0; i < keys.length; i++) {
      if (!present[keys[i]]) {
        lbManualAuthors.push({ email: wanted[keys[i]], name: wanted[keys[i]] })
      }
    }
    lbAuthorsOpen = true
    paintLeaderboardAuthors(null)
    const boxes = document.querySelectorAll('#lbAuthors input[type="checkbox"]')
    for (let i = 0; i < boxes.length; i++) {
      const row = boxEmails(boxes[i])
      let on = false
      for (let j = 0; j < row.length; j++) {
        if (wanted[lbEmailKey(row[j])]) {
          on = true
          break
        }
      }
      boxes[i].checked = on
    }
    syncAuthorTools()
    syncLeaderboardButtons()
  }

  function renderLeaderboardTeam(data) {
    const raw = data && Array.isArray(data.emails) ? data.emails : []
    const seen = {}
    lbTeamEmails = []
    for (let i = 0; i < raw.length; i++) {
      const email = String(raw[i] || '').trim()
      const key = lbEmailKey(email)
      if (!lbEmailOk(email) || seen[key]) {
        continue
      }
      seen[key] = true
      lbTeamEmails.push(email)
    }
    const status = document.getElementById('lbAuthorStatus')
    if (status && data && data.status) {
      status.hidden = false
      session.setText(status, data.status)
    }
    if (data && data.apply && lbTeamEmails.length > 0) {
      applyLeaderboardTeam()
      return
    }
    syncLeaderboardButtons()
  }

  function renderLeaderboard(payload) {
    if (!payload) {
      return
    }
    lbScanning = payload.status === 'scanning'
    if (payload.status === 'ready') {
      lbReposOpen = true
      lbChartHidden.clear()
      lbRows = Array.isArray(payload.rows) ? payload.rows : []
      const meta = document.getElementById('lbMeta')
      if (meta) {
        session.setText(
          meta,
          session.t('leaderboard.meta', {
            scanned: String(payload.reposScanned),
            skipped: String(payload.reposSkipped),
            from: payload.from,
            to: payload.to,
          }),
        )
      }
      paintLeaderboardChart(payload.chart)
      paintLeaderboardRows()
      return
    }
    if (payload.status === 'error') {
      lbChartHidden.clear()
      lbRows = []
      const meta = document.getElementById('lbMeta')
      if (meta) {
        session.setText(meta, payload.error || session.t('leaderboard.error'))
      }
      paintLeaderboardChart(null)
      paintLeaderboardRows()
      return
    }
    syncLeaderboardButtons()
  }

  function renderLeaderboardRepos(data) {
    lbRepoPayload = data || null
    const catalog = document.getElementById('lbCatalog')
    const status = document.getElementById('lbRepoStatus')
    const count = document.getElementById('lbRepoCount')
    const list = document.getElementById('lbRepoList')
    if (catalog) {
      catalog.value = data && typeof data.catalog === 'string' ? data.catalog : ''
    }
    const repos = data && Array.isArray(data.repos) ? data.repos : []
    let errorText = data && data.error ? data.error : ''
    if (!errorText && data && data.catalogMissing) {
      errorText = session.t('leaderboard.catalogMissing')
    }
    if (status) {
      status.hidden = !errorText
      session.setText(status, errorText || '')
    }
    if (count) {
      let selected = 0
      for (let i = 0; i < repos.length; i++) {
        if (repos[i].included !== false) {
          selected++
        }
      }
      session.setText(
        count,
        repos.length === 0
          ? session.t('leaderboard.reposEmpty')
          : session.t('leaderboard.repoSelected', { n: String(selected), total: String(repos.length) }),
      )
    }
    if (!list) {
      return
    }
    list.textContent = ''
    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i]
      const row = document.createElement('li')
      const included = repo.included !== false
      row.className = included ? 'lb-repo-row' : 'lb-repo-row is-off'
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.checked = included
      box.setAttribute('aria-label', session.t('leaderboard.includeRepo'))
      box.addEventListener('change', function () {
        session.vscode.postMessage({
          type: messageType.setLeaderboardRepoIncluded,
          path: repo.path,
          included: box.checked,
        })
      })
      row.appendChild(box)
      const path = session.el('span', 'lb-repo-path')
      session.setText(path, repo.label + '  ' + repo.path)
      path.title = repo.path
      const tag = session.el('span', 'lb-repo-tag')
      session.setText(tag, repo.source === 'extra' ? session.t('leaderboard.extraRepo') : session.t('leaderboard.discoveredRepo'))
      row.appendChild(path)
      row.appendChild(tag)
      if (repo.source === 'extra') {
        const remove = document.createElement('button')
        remove.type = 'button'
        remove.className = 'action-btn lb-author-remove'
        session.setText(remove, session.t('leaderboard.removeRepo'))
        remove.addEventListener('click', function () {
          session.vscode.postMessage({ type: messageType.removeLeaderboardRepo, path: repo.path })
        })
        row.appendChild(remove)
      }
      list.appendChild(row)
    }
  }

  function fillLeaderboardPreset(which) {
    const today = new Date()
    const toEl = document.getElementById('lbTo')
    const fromEl = document.getElementById('lbFrom')
    if (!toEl || !fromEl) {
      return
    }
    toEl.value = lbIso(today)
    if (which === 'month') {
      fromEl.value = lbIso(new Date(today.getFullYear(), today.getMonth(), 1))
    } else if (which === 'year') {
      fromEl.value = lbIso(new Date(today.getFullYear(), 0, 1))
    } else {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      start.setDate(start.getDate() - 29)
      fromEl.value = lbIso(start)
    }
    onLeaderboardDatesChanged()
  }

  let lbConfirmAction = null

  function closeLbConfirm() {
    const dialog = document.getElementById('lbConfirm')
    if (dialog) {
      dialog.hidden = true
    }
    lbConfirmAction = null
  }

  function openLbConfirm(title, items, note, onOk) {
    const dialog = document.getElementById('lbConfirm')
    const titleEl = document.getElementById('lbConfirmTitle')
    const noteEl = document.getElementById('lbConfirmNote')
    const list = document.getElementById('lbConfirmList')
    const ok = document.getElementById('lbConfirmOk')
    if (!dialog || !list) {
      return
    }
    if (titleEl) {
      session.setText(titleEl, title)
    }
    if (noteEl) {
      noteEl.hidden = !note
      session.setText(noteEl, note || '')
    }
    list.textContent = ''
    const rows = Array.isArray(items) ? items : []
    for (let i = 0; i < rows.length; i++) {
      const item = rows[i]
      const li = document.createElement('li')
      session.setText(li, item.path ? item.label + '  ' + item.path : item.label)
      if (item.path) {
        li.title = item.path
      }
      list.appendChild(li)
    }
    if (ok) {
      ok.disabled = rows.length === 0
    }
    lbConfirmAction = rows.length === 0 ? null : onOk
    dialog.hidden = false
  }

  function wire() {
  const lock = document.getElementById('lbLock')
  if (lock) {
    lock.addEventListener('click', function () {
      session.vscode.postMessage({ type: messageType.lockLeaderboard })
    })
  }
  const fromEl = document.getElementById('lbFrom')
  const toEl = document.getElementById('lbTo')
  const load = document.getElementById('lbLoad')
  const scan = document.getElementById('lbScan')
  const exp = document.getElementById('lbExport')
  if (fromEl) {
    fromEl.addEventListener('change', onLeaderboardDatesChanged)
  }
  if (toEl) {
    toEl.addEventListener('change', onLeaderboardDatesChanged)
  }
  const last30 = document.getElementById('lbLast30')
  const month = document.getElementById('lbThisMonth')
  const year = document.getElementById('lbThisYear')
  if (last30) {
    last30.addEventListener('click', function () {
      fillLeaderboardPreset('30')
    })
  }
  if (month) {
    month.addEventListener('click', function () {
      fillLeaderboardPreset('month')
    })
  }
  if (year) {
    year.addEventListener('click', function () {
      fillLeaderboardPreset('year')
    })
  }
  const myTeam = document.getElementById('lbMyTeam')
  if (myTeam) {
    myTeam.addEventListener('click', function () {
      if (lbScanning) {
        return
      }
      openLbConfirm(
        session.t('leaderboard.confirmTeam'),
        lbTeamEmails.map(function (email) {
          return { label: email, path: '' }
        }),
        lbTeamEmails.length === 0 ? session.t('leaderboard.teamEmpty') : '',
        function () {
          applyLeaderboardTeam()
        },
      )
    })
  }
  const myRepos = document.getElementById('lbMyRepos')
  if (myRepos) {
    myRepos.addEventListener('click', function () {
      if (lbScanning) {
        return
      }
      session.vscode.postMessage({ type: messageType.previewLeaderboardMyRepos })
    })
  }
  const confirmCancel = document.getElementById('lbConfirmCancel')
  const confirmOk = document.getElementById('lbConfirmOk')
  const confirm = document.getElementById('lbConfirm')
  if (confirmCancel) {
    confirmCancel.addEventListener('click', closeLbConfirm)
  }
  if (confirmOk) {
    confirmOk.addEventListener('click', function () {
      const action = lbConfirmAction
      closeLbConfirm()
      if (action) {
        action()
      }
    })
  }
  if (confirm) {
    confirm.addEventListener('click', function (event) {
      if (event.target === confirm) {
        closeLbConfirm()
      }
    })
  }
  const saveTeam = document.getElementById('lbSaveTeam')
  if (saveTeam) {
    saveTeam.addEventListener('click', function () {
      const emails = selectedLeaderboardEmails()
      if (lbScanning || emails.length === 0) {
        return
      }
      session.vscode.postMessage({ type: messageType.saveLeaderboardTeam, emails: emails })
    })
  }
  const merge = document.getElementById('lbMerge')
  if (merge) {
    merge.addEventListener('click', function () {
      if (lbScanning) {
        return
      }
      mergeCheckedAuthors()
    })
  }
  if (load) {
    load.addEventListener('click', function () {
      const range = lbRange()
      if (!lbRangeOk(range)) {
        return
      }
      session.vscode.postMessage({
        type: messageType.loadLeaderboardAuthors,
        from: range.from,
        to: range.to,
      })
    })
  }
  if (scan) {
    scan.addEventListener('click', function () {
      const range = lbRange()
      const emails = selectedLeaderboardEmails()
      if (!lbRangeOk(range) || emails.length === 0 || lbScanning) {
        return
      }
      lbScanning = true
      syncLeaderboardButtons()
      session.vscode.postMessage({
        type: messageType.runLeaderboardScan,
        from: range.from,
        to: range.to,
        emails: emails,
      })
    })
  }
  if (exp) {
    exp.addEventListener('click', function () {
      session.vscode.postMessage({
        type: messageType.exportLeaderboardCsv,
        emails: lbRows.slice().sort(compareLbRows).map(function (row) {
          return row.email
        }),
      })
    })
  }
  const sorts = document.querySelectorAll('[data-lb-sort]')
  for (let i = 0; i < sorts.length; i++) {
    sorts[i].addEventListener('click', function () {
      const key = sorts[i].getAttribute('data-lb-sort')
      if (key === lbSortKey) {
        lbSortDir = lbSortDir === 'asc' ? 'desc' : 'asc'
      } else {
        lbSortKey = key
        lbSortDir = key === 'name' ? 'asc' : 'desc'
      }
      paintLeaderboardRows()
    })
  }
  const toggleAuthors = document.getElementById('lbToggleAuthors')
  if (toggleAuthors) {
    toggleAuthors.addEventListener('click', function () {
      lbAuthorsOpen = !lbAuthorsOpen
      syncAuthorTools()
    })
  }
  const selectAll = document.getElementById('lbSelectAll')
  if (selectAll) {
    selectAll.addEventListener('click', function () {
      const boxes = document.querySelectorAll('#lbAuthors input[type="checkbox"]')
      let allOn = boxes.length > 0
      for (let i = 0; i < boxes.length; i++) {
        if (!boxes[i].checked) {
          allOn = false
          break
        }
      }
      for (let i = 0; i < boxes.length; i++) {
        boxes[i].checked = !allOn
      }
      syncAuthorTools()
      syncLeaderboardButtons()
    })
  }
  const manualForm = document.getElementById('lbManualForm')
  if (manualForm) {
    manualForm.addEventListener('submit', function (event) {
      event.preventDefault()
      if (lbScanning) {
        return
      }
      const input = document.getElementById('lbManualEmail')
      addManualLeaderboardEmail(input ? input.value : '')
      if (input && lbEmailOk(String(input.value || '').trim())) {
        input.value = ''
      }
    })
  }
  const toggleRepos = document.getElementById('lbToggleRepos')
  if (toggleRepos) {
    toggleRepos.addEventListener('click', function () {
      lbReposOpen = !lbReposOpen
      paintLeaderboardRows()
    })
  }
  const pickCatalog = document.getElementById('lbPickCatalog')
  const scanRepos = document.getElementById('lbScanRepos')
  const saveRepos = document.getElementById('lbSaveRepos')
  const clearCatalog = document.getElementById('lbClearCatalog')
  const pickRepo = document.getElementById('lbPickRepo')
  const repoForm = document.getElementById('lbRepoForm')
  if (pickCatalog) {
    pickCatalog.addEventListener('click', function () {
      session.vscode.postMessage({ type: messageType.pickLeaderboardCatalog })
    })
  }
  if (scanRepos) {
    scanRepos.addEventListener('click', function () {
      session.vscode.postMessage({ type: messageType.refreshLeaderboardRepos })
    })
  }
  if (saveRepos) {
    saveRepos.addEventListener('click', function () {
      session.vscode.postMessage({ type: messageType.saveLeaderboardRepos })
    })
  }
  if (clearCatalog) {
    clearCatalog.addEventListener('click', function () {
      session.vscode.postMessage({ type: messageType.clearLeaderboardCatalog })
    })
  }
  if (pickRepo) {
    pickRepo.addEventListener('click', function () {
      session.vscode.postMessage({ type: messageType.pickLeaderboardRepo })
    })
  }
  if (repoForm) {
    repoForm.addEventListener('submit', function (event) {
      event.preventDefault()
      const input = document.getElementById('lbRepoPath')
      const path = input ? String(input.value || '').trim() : ''
      if (!path) {
        return
      }
      session.vscode.postMessage({ type: messageType.addLeaderboardRepo, path: path })
      if (input) {
        input.value = ''
      }
    })
  }
  const info = document.querySelector('.lb-info')
  if (info) {
    document.addEventListener('click', function (event) {
      if (!info.open || info.contains(event.target)) {
        return
      }
      info.open = false
    })
  }
  syncAuthorTools()
  syncLeaderboardButtons()
  }

  return {
    wire,
    render: renderLeaderboard,
    renderRepos: renderLeaderboardRepos,
    applyRange: applyLeaderboardRange,
    renderAuthors: renderLeaderboardAuthors,
    renderTeam: renderLeaderboardTeam,
    renderMerges: renderLeaderboardMerges,
    openConfirm: openLbConfirm,
    refreshStatic() {
      markLbSort()
      syncAuthorTools()
      syncLeaderboardReposToggle()
      if (lbRepoPayload) {
        renderLeaderboardRepos(lbRepoPayload)
      }
    },
  }
}
