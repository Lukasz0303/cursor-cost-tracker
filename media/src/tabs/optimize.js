/** Optimize tab. Edit here; media/history.js is generated. */
import { messageType } from '../messages.js'

export function createOptimizeView(session) {
  const optimizeViewEl = document.getElementById('optimizeView')
  const optimizeEmptyEl = document.getElementById('optimizeEmpty')
  const optimizeContentEl = document.getElementById('optimizeContent')
  const optimizeSummaryEl = document.getElementById('optimizeSummary')
  const optimizeBalanceUsdEl = document.getElementById('optimizeBalanceUsd')
  const optimizeBalanceIntEl = document.getElementById('optimizeBalanceInt')
  const optimizeBalanceFracEl = document.getElementById('optimizeBalanceFrac')
  const optimizeBalanceSubEl = document.getElementById('optimizeBalanceSub')
  const optimizeProjectedUsdEl = document.getElementById('optimizeProjectedUsd')
  const optimizeProjectedTokensEl = document.getElementById('optimizeProjectedTokens')
  const optimizeSavingsVizEl = document.getElementById('optimizeSavingsViz')
  const optimizeSavingsSparkEl = document.getElementById('optimizeSavingsSpark')
  const optimizeSparkBarsEl = document.getElementById('optimizeSparkBars')
  const optimizeSparkValuesEl = document.getElementById('optimizeSparkValues')
  const optimizeSparkAxisEl = document.getElementById('optimizeSparkAxis')
  const optimizeSparkTipEl = document.getElementById('optimizeSparkTip')
  let sparkHover = null
  let sparkHoverIndex = -1
  let sparkTipDayEl = null
  let sparkTipValueEl = null
  let sparkTipTotalEl = null
  const optimizeNoteEl = document.getElementById('optimizeNote')
  const optimizeLifetimeHeadingEl = document.getElementById('optimizeLifetimeHeading')
  const optimizeLifetimeEmptyEl = document.getElementById('optimizeLifetimeEmpty')
  const optimizeLifetimeProjectsEl = document.getElementById('optimizeLifetimeProjects')
  const optimizeFindingsEl = document.getElementById('optimizeFindings')
  const optimizeDepthCardsEl = document.getElementById('optimizeDepthCards')
  const runOptimizeToolbarEl = document.getElementById('runOptimizeToolbar')
  const optimizeDepthSettingEl = document.getElementById('optimizeDepthSetting')

  function splitUsdParts(n) {
    const value = Math.max(0, Number(n) || 0)
    const fixed = value.toFixed(2)
    const dot = fixed.indexOf('.')
    return {
      int: fixed.slice(0, dot),
      frac: fixed.slice(dot),
    }
  }

  function formatSparkDay(at) {
    const d = new Date(at)
    if (Number.isNaN(d.getTime())) {
      return ''
    }
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    })
  }

  function localDayStart(at) {
    const d = new Date(at)
    if (Number.isNaN(d.getTime())) {
      return null
    }
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }

  function nextLocalDay(at) {
    const d = new Date(at)
    d.setDate(d.getDate() + 1)
    return d.getTime()
  }

  function clearChildren(el) {
    if (!el) {
      return
    }
    while (el.firstChild) {
      el.removeChild(el.firstChild)
    }
  }

  /** One slot per local calendar day. Bar height is that day's new dollars, not the running total. */
  function dailySavingsBars(points) {
    const usable = []
    for (let i = 0; i < points.length; i++) {
      const row = points[i]
      if (!row || !Number.isFinite(row.usd) || !Number.isFinite(row.at)) {
        continue
      }
      usable.push({ at: row.at, usd: Math.max(0, row.usd) })
    }
    usable.sort(function (a, b) {
      return a.at - b.at
    })
    if (usable.length === 0) {
      return []
    }
    const lastUsdByDay = {}
    for (let i = 0; i < usable.length; i++) {
      const day = localDayStart(usable[i].at)
      if (day === null) {
        continue
      }
      lastUsdByDay[day] = usable[i].usd
    }
    const keys = Object.keys(lastUsdByDay)
    if (keys.length === 0) {
      return []
    }
    let first = Number(keys[0])
    let last = first
    for (let i = 1; i < keys.length; i++) {
      const n = Number(keys[i])
      if (n < first) {
        first = n
      }
      if (n > last) {
        last = n
      }
    }
    const spanDays = Math.round((last - first) / 86400000) + 1
    const stepDays = spanDays > 90 ? Math.ceil(spanDays / 90) : 1
    const days = []
    let cursor = first
    let carried = 0
    let index = 0
    while (cursor <= last && index < 800) {
      if (lastUsdByDay[cursor] !== undefined) {
        carried = lastUsdByDay[cursor]
      }
      const isLast = nextLocalDay(cursor) > last
      if (index % stepDays === 0 || isLast) {
        days.push({ at: cursor, usd: carried })
      }
      cursor = nextLocalDay(cursor)
      index++
    }
    return days
  }

  function sparkAxisIndexes(count) {
    const maxLabels = count <= 5 ? count : 5
    if (count <= maxLabels) {
      const all = []
      for (let i = 0; i < count; i++) {
        all.push(i)
      }
      return all
    }
    const out = []
    const seen = {}
    for (let i = 0; i < maxLabels; i++) {
      const idx = Math.round((i * (count - 1)) / (maxLabels - 1))
      if (seen[idx]) {
        continue
      }
      seen[idx] = true
      out.push(idx)
    }
    return out
  }

  function ensureSparkTipNodes() {
    if (!optimizeSparkTipEl || sparkTipDayEl) {
      return
    }
    sparkTipDayEl = session.el('p', 'optimize-savings-tip-day')
    sparkTipValueEl = session.el('p', 'optimize-savings-tip-value')
    sparkTipTotalEl = session.el('p', 'optimize-savings-tip-total')
    optimizeSparkTipEl.appendChild(sparkTipDayEl)
    optimizeSparkTipEl.appendChild(sparkTipValueEl)
    optimizeSparkTipEl.appendChild(sparkTipTotalEl)
  }

  function clearSparkHover() {
    sparkHoverIndex = -1
    if (optimizeSparkTipEl) {
      optimizeSparkTipEl.hidden = true
    }
    if (!optimizeSparkBarsEl) {
      return
    }
    const band = optimizeSparkBarsEl.querySelector('.optimize-savings-hover-band')
    if (band) {
      band.setAttribute('visibility', 'hidden')
    }
    const bars = optimizeSparkBarsEl.querySelectorAll('.optimize-savings-bar.is-hover')
    for (let i = 0; i < bars.length; i++) {
      bars[i].classList.remove('is-hover')
    }
  }

  function placeSparkTip(clientX, clientY) {
    if (!optimizeSparkTipEl) {
      return
    }
    optimizeSparkTipEl.hidden = false
    const tipW = optimizeSparkTipEl.offsetWidth
    const tipH = optimizeSparkTipEl.offsetHeight
    let left = clientX + 14
    let top = clientY - tipH - 12
    const maxLeft = window.innerWidth - tipW - 8
    if (left > maxLeft) {
      left = clientX - tipW - 14
    }
    if (left < 8) {
      left = 8
    }
    if (top < 8) {
      top = clientY + 16
    }
    optimizeSparkTipEl.style.left = Math.round(left) + 'px'
    optimizeSparkTipEl.style.top = Math.round(top) + 'px'
  }

  function showSparkTip(index, clientX, clientY) {
    if (!sparkHover || !optimizeSparkTipEl || !optimizeSparkBarsEl) {
      return
    }
    if (index < 0 || index >= sparkHover.days.length) {
      clearSparkHover()
      return
    }
    ensureSparkTipNodes()
    if (index !== sparkHoverIndex) {
      sparkHoverIndex = index
      const day = sparkHover.days[index]
      const delta = sparkHover.deltas[index]
      session.setText(sparkTipDayEl, formatSparkDay(day.at))
      session.setText(
        sparkTipValueEl,
        delta > 0 ? '+' + session.compactCost(delta) : session.compactCost(0),
      )
      sparkTipValueEl.classList.toggle('is-quiet', delta <= 0)
      const showTotal = Math.abs(day.usd - delta) >= 0.005
      sparkTipTotalEl.hidden = !showTotal
      if (showTotal) {
        session.setText(
          sparkTipTotalEl,
          session.t('charts.tipTotal') + ' ' + session.compactCost(day.usd),
        )
      }
      const bars = optimizeSparkBarsEl.querySelectorAll('.optimize-savings-bar')
      for (let i = 0; i < bars.length; i++) {
        bars[i].classList.toggle('is-hover', i === index)
      }
      const band = optimizeSparkBarsEl.querySelector('.optimize-savings-hover-band')
      if (band) {
        const x = sparkHover.padL + sparkHover.slot * index
        band.setAttribute('x', x.toFixed(2))
        band.setAttribute('width', sparkHover.slot.toFixed(2))
        band.setAttribute('visibility', 'visible')
      }
    }
    placeSparkTip(clientX, clientY)
  }

  function sparkIndexAt(clientX) {
    if (!sparkHover || !optimizeSavingsSparkEl) {
      return -1
    }
    const rect = optimizeSavingsSparkEl.getBoundingClientRect()
    if (rect.width <= 0) {
      return -1
    }
    const xSvg = ((clientX - rect.left) / rect.width) * sparkHover.width
    let index = Math.floor((xSvg - sparkHover.padL) / sparkHover.slot)
    if (index < 0) {
      index = 0
    }
    if (index >= sparkHover.days.length) {
      index = sparkHover.days.length - 1
    }
    return index
  }

  function pointerOverSpark(event) {
    if (!optimizeSavingsSparkEl) {
      return false
    }
    const svgRect = optimizeSavingsSparkEl.getBoundingClientRect()
    const overSvg =
      event.clientX >= svgRect.left &&
      event.clientX <= svgRect.right &&
      event.clientY >= svgRect.top &&
      event.clientY <= svgRect.bottom
    if (overSvg) {
      return true
    }
    if (!optimizeSparkAxisEl) {
      return false
    }
    const axisRect = optimizeSparkAxisEl.getBoundingClientRect()
    return (
      event.clientX >= axisRect.left &&
      event.clientX <= axisRect.right &&
      event.clientY >= axisRect.top &&
      event.clientY <= axisRect.bottom
    )
  }

  function renderSavingsSparkline(series) {
    clearSparkHover()
    const points = Array.isArray(series) ? series : []
    const days = dailySavingsBars(points)
    sparkHover = null
    if (optimizeSavingsVizEl) {
      if (days.length === 0) {
        optimizeSavingsVizEl.classList.add('is-empty')
      } else {
        optimizeSavingsVizEl.classList.remove('is-empty')
      }
    }
    clearChildren(optimizeSparkBarsEl)
    clearChildren(optimizeSparkValuesEl)
    clearChildren(optimizeSparkAxisEl)
    if (!optimizeSparkBarsEl || days.length === 0) {
      return
    }
    const width = 360
    const height = 84
    const padL = 2
    const padR = 2
    const padT = 3
    const padB = 1
    const deltas = []
    let prevUsd = 0
    let maxDelta = 0
    for (let i = 0; i < days.length; i++) {
      const delta = Math.max(0, days[i].usd - prevUsd)
      prevUsd = days[i].usd
      deltas.push(delta)
      if (delta > maxDelta) {
        maxDelta = delta
      }
    }
    if (maxDelta <= 0) {
      maxDelta = 1
    }
    const plotW = width - padL - padR
    const plotH = height - padT - padB
    const slot = plotW / days.length
    const gap = Math.min(5, slot * 0.28)
    const barW = Math.max(1.5, slot - gap)
    const ns = 'http://www.w3.org/2000/svg'
    sparkHover = {
      days: days,
      deltas: deltas,
      width: width,
      padL: padL,
      slot: slot,
    }
    if (optimizeSparkBarsEl) {
      const band = document.createElementNS(ns, 'rect')
      band.setAttribute('class', 'optimize-savings-hover-band')
      band.setAttribute('y', '0')
      band.setAttribute('height', String(height))
      band.setAttribute('visibility', 'hidden')
      optimizeSparkBarsEl.appendChild(band)
    }
    for (let i = 0; i < days.length; i++) {
      const delta = deltas[i]
      const t = delta / maxDelta
      const barH = delta > 0 ? Math.max(2, t * plotH) : 1.5
      const x = padL + slot * i + (slot - barW) / 2
      const y = padT + plotH - barH
      const rect = document.createElementNS(ns, 'rect')
      rect.setAttribute('x', x.toFixed(2))
      rect.setAttribute('y', y.toFixed(2))
      rect.setAttribute('width', barW.toFixed(2))
      rect.setAttribute('height', barH.toFixed(2))
      let barClass = 'optimize-savings-bar'
      if (delta <= 0) {
        barClass += ' is-quiet'
      } else if (i === days.length - 1) {
        barClass += ' is-end'
      }
      rect.setAttribute('class', barClass)
      optimizeSparkBarsEl.appendChild(rect)
    }
    if (optimizeSparkBarsEl) {
      const hit = document.createElementNS(ns, 'rect')
      hit.setAttribute('class', 'optimize-savings-hit')
      hit.setAttribute('x', '0')
      hit.setAttribute('y', '0')
      hit.setAttribute('width', String(width))
      hit.setAttribute('height', String(height))
      optimizeSparkBarsEl.appendChild(hit)
    }

    if (optimizeSparkValuesEl) {
      const latest = document.createElement('span')
      session.setText(latest, session.compactCost(days[days.length - 1].usd))
      optimizeSparkValuesEl.appendChild(latest)
    }

    if (optimizeSparkAxisEl) {
      const indexes = sparkAxisIndexes(days.length)
      for (let n = 0; n < indexes.length; n++) {
        const idx = indexes[n]
        const center = padL + slot * idx + slot / 2
        const el = document.createElement('span')
        session.setText(el, formatSparkDay(days[idx].at))
        el.style.left = ((center / width) * 100).toFixed(2) + '%'
        if (idx === 0) {
          el.style.transform = 'none'
        } else if (idx === days.length - 1) {
          el.style.transform = 'translateX(-100%)'
        } else {
          el.style.transform = 'translateX(-50%)'
        }
        optimizeSparkAxisEl.appendChild(el)
      }
    }
  }

  function syncOptimizeDefaultUi(depth) {
    const cards = document.querySelectorAll('[data-optimize-card]')
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]
      const value = card.getAttribute('data-optimize-card')
      card.classList.toggle('is-default', value === depth)
    }
    const badges = document.querySelectorAll('[data-default-badge]')
    for (let i = 0; i < badges.length; i++) {
      const badge = badges[i]
      badge.hidden = badge.getAttribute('data-default-badge') !== depth
    }
    const setBtns = document.querySelectorAll('[data-set-default]')
    for (let i = 0; i < setBtns.length; i++) {
      const btn = setBtns[i]
      btn.hidden = btn.getAttribute('data-set-default') === depth
    }
    if (runOptimizeToolbarEl) {
      const label = session.depthLabel(depth)
      session.setText(runOptimizeToolbarEl, session.t('toolbar.runOptimize', { depth: label }))
      runOptimizeToolbarEl.title = session.t('toolbar.runOptimizeTitle', {
        depth: label,
      })
    }
  }

  function promptMetaLabel(depth, text) {
    const depthName = session.depthLabel(depth)
    if (!text) {
      return session.t('optimize.promptEmpty', { depth: depthName })
    }
    const chars = text.length
    const lines = text.split('\n').length
    return session.t('optimize.promptMeta', {
      depth: depthName,
      lines: lines,
      chars: chars.toLocaleString('en-US'),
    })
  }

  function renderOptimizeLifetime(lifetime) {
    const data =
      lifetime && typeof lifetime === 'object'
        ? lifetime
        : { projects: [], empty: true }
    const projects = Array.isArray(data.projects) ? data.projects : []
    const isEmpty = data.empty === true || projects.length === 0
    if (optimizeLifetimeHeadingEl) {
      optimizeLifetimeHeadingEl.hidden = isEmpty
    }
    if (optimizeLifetimeEmptyEl) {
      optimizeLifetimeEmptyEl.hidden = !isEmpty
    }
    if (!optimizeLifetimeProjectsEl) {
      return
    }
    while (optimizeLifetimeProjectsEl.firstChild) {
      optimizeLifetimeProjectsEl.removeChild(
        optimizeLifetimeProjectsEl.firstChild,
      )
    }
    if (isEmpty) {
      return
    }
    for (let i = 0; i < projects.length; i++) {
      const row = projects[i]
      const li = document.createElement('li')
      const label = document.createElement('span')
      label.className = 'project-label'
      session.setText(label, row && row.label ? String(row.label) : 'Project')
      const values = document.createElement('span')
      values.className = 'project-values'
      const tokens =
        row && Number.isFinite(row.tokens) ? session.compactTokens(row.tokens) : '0'
      const usd =
        row && Number.isFinite(row.usd) ? session.compactCost(row.usd) : '0.00 $'
      session.setText(values, '~' + tokens + ' · ~' + usd)
      li.appendChild(label)
      li.appendChild(values)
      optimizeLifetimeProjectsEl.appendChild(li)
    }
  }

  function renderOptimizeSavingsCard(optimize) {
    const lifetime =
      optimize && optimize.lifetime && typeof optimize.lifetime === 'object'
        ? optimize.lifetime
        : { totalUsd: 0, totalTokens: 0, empty: true }
    const balanceUsd = Number.isFinite(lifetime.totalUsd)
      ? lifetime.totalUsd
      : 0
    const balanceTokens = Number.isFinite(lifetime.totalTokens)
      ? lifetime.totalTokens
      : 0
    const projectedUsd = Number.isFinite(optimize && optimize.estUsdSaved)
      ? optimize.estUsdSaved
      : 0
    const projectedTokens = Number.isFinite(optimize && optimize.estTokensSaved)
      ? optimize.estTokensSaved
      : 0
    const hasLifetime =
      lifetime.empty !== true && (balanceUsd > 0 || balanceTokens > 0)
    const parts = splitUsdParts(balanceUsd)
    if (optimizeBalanceIntEl) {
      session.setText(optimizeBalanceIntEl, parts.int)
    }
    if (optimizeBalanceFracEl) {
      session.setText(optimizeBalanceFracEl, parts.frac)
    }
    if (optimizeBalanceUsdEl) {
      if (balanceUsd > 0) {
        optimizeBalanceUsdEl.classList.add('is-positive')
      } else {
        optimizeBalanceUsdEl.classList.remove('is-positive')
      }
    }
    if (optimizeBalanceSubEl) {
      session.setText(
        optimizeBalanceSubEl,
        session.t('optimize.savingsSub', { tokens: session.compactTokens(balanceTokens) }),
      )
      if (balanceTokens > 0 || balanceUsd > 0) {
        optimizeBalanceSubEl.classList.add('is-positive')
      } else {
        optimizeBalanceSubEl.classList.remove('is-positive')
      }
    }
    if (optimizeProjectedUsdEl) {
      session.setText(optimizeProjectedUsdEl, session.compactCost(projectedUsd))
      if (projectedUsd > 0) {
        optimizeProjectedUsdEl.classList.add('is-ok')
      } else {
        optimizeProjectedUsdEl.classList.remove('is-ok')
      }
    }
    if (optimizeProjectedTokensEl) {
      session.setText(optimizeProjectedTokensEl, '~' + session.compactTokens(projectedTokens))
    }
    renderSavingsSparkline(lifetime.series)
    if (optimizeSummaryEl) {
      const aria = hasLifetime
        ? session.t('optimize.savingsAccount') +
          ': ' +
          session.compactCost(balanceUsd) +
          ' · ~' +
          session.compactTokens(balanceTokens)
        : session.t('optimize.savingsAccount')
      optimizeSummaryEl.setAttribute('aria-label', aria)
    }
  }

  function renderOptimize(optimize) {
    if (!optimizeViewEl || !optimizeSummaryEl) {
      return
    }
    const empty = !optimize || optimize.empty === true
    if (optimizeEmptyEl) {
      optimizeEmptyEl.hidden = !empty
    }
    if (optimizeContentEl) {
      optimizeContentEl.hidden = empty
    }
    if (runOptimizeToolbarEl) {
      runOptimizeToolbarEl.disabled = empty
    }
    if (empty) {
      syncOptimizeDefaultUi(session.optimizeDepth)
      return
    }
    const depth =
      optimize.depth === 'quick' || optimize.depth === 'deep'
        ? optimize.depth
        : 'balanced'
    session.optimizeDepth = depth
    syncOptimizeDefaultUi(depth)
    renderOptimizeSavingsCard(optimize)
    if (optimizeNoteEl) {
      session.setText(
        optimizeNoteEl,
        optimize.note || session.t('optimize.savingsNote'),
      )
    }
    renderOptimizeLifetime(optimize.lifetime)
    if (optimizeFindingsEl) {
      while (optimizeFindingsEl.firstChild) {
        optimizeFindingsEl.removeChild(optimizeFindingsEl.firstChild)
      }
      const findings = Array.isArray(optimize.findings) ? optimize.findings : []
      for (let i = 0; i < findings.length; i++) {
        const finding = findings[i]
        const li = document.createElement('li')
        session.setText(
          li,
          (finding.label || 'Finding') +
            (finding.detail ? ' — ' + finding.detail : ''),
        )
        optimizeFindingsEl.appendChild(li)
      }
    }
    const prompts =
      optimize.prompts && typeof optimize.prompts === 'object'
        ? optimize.prompts
        : {}
    const depths = ['quick', 'balanced', 'deep']
    for (let i = 0; i < depths.length; i++) {
      const key = depths[i]
      const text =
        typeof prompts[key] === 'string'
          ? prompts[key]
          : key === depth && typeof optimize.prompt === 'string'
            ? optimize.prompt
            : ''
      const body = document.querySelector(
        '[data-prompt-body="' + key + '"]',
      )
      const summary = document.querySelector(
        '[data-prompt-summary="' + key + '"]',
      )
      if (body) {
        session.setText(body, text)
      }
      if (summary) {
        session.setText(summary, promptMetaLabel(key, text))
      }
      const runBtn = document.querySelector(
        '[data-run-depth="' + key + '"]',
      )
      if (runBtn) {
        runBtn.disabled = !text
      }
    }
  }


  function wire() {
    if (optimizeDepthCardsEl) {
      optimizeDepthCardsEl.addEventListener('click', function (event) {
        const target = event.target
        if (!target || !target.closest) {
          return
        }
        const setBtn = target.closest('[data-set-default]')
        if (setBtn) {
          const raw = setBtn.getAttribute('data-set-default')
          const value = raw === 'quick' || raw === 'deep' ? raw : 'balanced'
          if (value === session.optimizeDepth) {
            return
          }
          session.optimizeDepth = value
          syncOptimizeDefaultUi(value)
          if (optimizeDepthSettingEl) {
            optimizeDepthSettingEl.value = value
          }
          session.vscode.postMessage({ type: messageType.setOptimizeDepth, value: value })
          return
        }
        const runBtn = target.closest('[data-run-depth]')
        if (runBtn) {
          const raw = runBtn.getAttribute('data-run-depth')
          const value = raw === 'quick' || raw === 'deep' ? raw : 'balanced'
          session.vscode.postMessage({ type: messageType.runOptimize, depth: value })
        }
      })
    }
    if (runOptimizeToolbarEl) {
      runOptimizeToolbarEl.addEventListener('click', function () {
        const depth =
          session.optimizeDepth === 'quick' || session.optimizeDepth === 'deep'
            ? session.optimizeDepth
            : 'balanced'
        session.vscode.postMessage({ type: messageType.runOptimize, depth: depth })
      })
    }
    if (optimizeSavingsVizEl) {
      optimizeSavingsVizEl.addEventListener('mousemove', function (event) {
        if (!pointerOverSpark(event)) {
          clearSparkHover()
          return
        }
        showSparkTip(sparkIndexAt(event.clientX), event.clientX, event.clientY)
      })
      optimizeSavingsVizEl.addEventListener('mouseleave', clearSparkHover)
    }
  }

  return {
    render: renderOptimize,
    syncDefault: syncOptimizeDefaultUi,
    wire,
  }
}
