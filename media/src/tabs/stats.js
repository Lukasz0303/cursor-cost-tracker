/** Statistics tab body. Edit here; media/history.js is generated. */
export function createStatsView(session) {
  const statsEl = document.getElementById('stats')
  const periodCardsEl = document.getElementById('periodCards')
  let lastStatsArgs = null

  function lastHeading(limit) {
    if (session.historyFromDate) {
      const todayIso = session.isoFromLocal(new Date())
      if (session.historyToDate && session.historyToDate !== todayIso) {
        return session.t('queries.rangeHeading', {
          from: session.formatFromDateLabel(session.historyFromDate),
          to: session.formatFromDateLabel(session.historyToDate),
        })
      }
      return session.t('queries.fromHeading', {
        date: session.formatFromDateLabel(session.historyFromDate),
      })
    }
    return session.t('queries.lastHeading', { n: session.clampHistoryLimit(limit) })
  }

  function mixBar(shares) {
    const mix = session.el('div', 'period-mix')
    const list = shares || []
    for (let i = 0; i < list.length; i++) {
      const share = list[i]
      const pct = Math.max(0, Number(share.percent) || 0)
      if (pct <= 0) {
        continue
      }
      const seg = session.el('span', 'period-mix-seg is-' + share.key)
      seg.style.width = pct + '%'
      mix.appendChild(seg)
    }
    return mix
  }

  function mixLegend(shares) {
    const legend = session.el('div', 'period-legend')
    const list = shares || []
    for (let i = 0; i < list.length; i++) {
      const share = list[i]
      const item = session.el('span', 'period-legend-item is-' + share.key)
      session.setText(item, share.label + ' ' + (Number(share.percent) || 0) + '%')
      legend.appendChild(item)
    }
    return legend
  }

  function periodCardEl(card) {
    const article = session.el('article', 'period-card')
    const title = session.el('h2', 'period-card-title')
    session.setText(title, card.title)
    article.appendChild(title)
    const cost = session.el('p', 'period-card-cost')
    session.setText(cost, card.cost)
    article.appendChild(cost)
    const hint = session.el('p', 'period-card-hint')
    session.setText(hint, card.costHint)
    article.appendChild(hint)
    const summary = session.el('p', 'period-card-summary')
    session.setText(summary, card.summary)
    article.appendChild(summary)

    const rows = session.el('dl', 'period-card-rows')
    const list = card.rows || []
    for (let i = 0; i < list.length; i++) {
      const row = list[i]
      const dt = session.el('dt', row.total ? 'is-total' : undefined)
      session.setText(dt, row.label)
      const dd = session.el('dd', row.total ? 'is-total' : undefined)
      session.setText(dd, row.value)
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
    const row = session.el('div', 'meter-row')
    const head = session.el('div', 'meter-head')
    const name = session.el('span', 'meter-label')
    session.setText(name, label)
    const amount = session.el('span', 'meter-value')
    session.setText(amount, value)
    head.appendChild(name)
    head.appendChild(amount)
    const track = session.el('div', 'meter-track')
    const fill = session.el('div', 'meter-fill')
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
    } else if (variant === 'warn') {
      fill.classList.add('is-warn')
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
    const card = session.el('article', 'status-block')
    if (item.id) {
      card.classList.add('is-' + item.id)
    }
    const title = session.el('h3')
    session.setText(title, item.title)
    card.appendChild(title)
    const value = session.el('p', 'stats-value stats-value-hero')
    session.setText(value, item.value)
    card.appendChild(value)
    const bars = item.bars || []
    if (bars.length > 0) {
      const meters = session.el('div', 'meter-list meter-list-tight')
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        meters.appendChild(meterRow(bar.label, bar.value, bar.percent, 'usage'))
      }
      card.appendChild(meters)
    }
    if (item.body) {
      const body = session.el('p', 'stats-hint')
      session.setText(body, item.body)
      card.appendChild(body)
    }
    return card
  }

  function burnBanner(burnRate, warnOn) {
    const banner = session.el(
      'article',
      'burn-banner' +
        (warnOn ? ' is-' + burnRate.level : ''),
    )
    const title = session.el('h3')
    session.setText(title, burnRate.bannerTitle || session.t('burnRate.highTitle'))
    banner.appendChild(title)
    const body = session.el('p')
    session.setText(body, burnRate.bannerBody || '')
    banner.appendChild(body)
    return banner
  }

  function burnRateCard(burnRate, warnOn) {
    const card = session.el('article', 'status-block is-burn')
    if (
      warnOn &&
      (burnRate.level === 'warning' || burnRate.level === 'critical')
    ) {
      card.classList.add('is-over')
    }
    const title = session.el('h3')
    session.setText(title, session.t('burnRate.cardTitle'))
    card.appendChild(title)
    const value = session.el('p', 'stats-value stats-value-hero')
    if (
      warnOn &&
      (burnRate.level === 'warning' || burnRate.level === 'critical')
    ) {
      value.classList.add('is-warn')
    }
    session.setText(value, burnRate.summary || '')
    card.appendChild(value)
    if (burnRate.paceLabel) {
      const pace = session.el('p', 'stats-hint')
      session.setText(pace, '↑ ' + burnRate.paceLabel)
      card.appendChild(pace)
    }
    const meters = session.el('div', 'meter-list meter-list-tight')
    const high =
      warnOn &&
      (burnRate.level === 'warning' || burnRate.level === 'critical')
    meters.appendChild(
      meterRow(
        session.t('burnRate.windowVsCritical'),
        burnRate.summary || '',
        burnRate.percent || 0,
        high ? 'warn' : 'usage',
      ),
    )
    card.appendChild(meters)
    const parts = []
    if (burnRate.mixLabel) {
      parts.push(burnRate.mixLabel)
    }
    if (burnRate.todayLabel) {
      parts.push(burnRate.todayLabel)
    }
    if (parts.length > 0) {
      const body = session.el('p', 'stats-hint')
      session.setText(body, parts.join(' · '))
      card.appendChild(body)
    }
    return card
  }

  function shareTone(index) {
    return 'is-tone-' + (index % 6)
  }

  function breakdownMix(rows) {
    const mix = session.el('div', 'period-mix breakdown-mix')
    for (let i = 0; i < rows.length; i++) {
      const pct = Math.max(0, Number(rows[i].percent) || 0)
      if (pct <= 0) {
        continue
      }
      const seg = session.el('span', 'period-mix-seg ' + shareTone(i))
      seg.style.width = pct + '%'
      mix.appendChild(seg)
    }
    return mix
  }

  function breakdownChart(rows, title) {
    const panel = session.el('div', 'breakdown-panel')
    if (title) {
      const heading = session.el('h3', 'breakdown-title')
      session.setText(heading, title)
      panel.appendChild(heading)
    }
    panel.appendChild(breakdownMix(rows))
    const wrap = session.el('div', 'meter-list')
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
    const card = session.el('article', 'stats-card')
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
    const title = session.el('h3')
    session.setText(title, item.label || item.title)
    card.appendChild(title)
    const value = session.el('p', 'stats-value')
    session.setText(value, item.value)
    card.appendChild(value)
    if (item.detail) {
      const detail = session.el('p', 'stats-detail')
      session.setText(detail, item.detail)
      card.appendChild(detail)
    }
    if (item.shares && item.shares.length > 0) {
      card.appendChild(mixBar(item.shares))
      card.appendChild(mixLegend(item.shares))
    }
    if (item.hint) {
      const hint = session.el('p', 'stats-hint')
      session.setText(hint, item.hint)
      card.appendChild(hint)
    }
    return card
  }

  function metricGrid(items, className) {
    const grid = session.el('div', 'stats-grid ' + (className || ''))
    for (let i = 0; i < items.length; i++) {
      grid.appendChild(items[i])
    }
    return grid
  }

  function cycleStrip(items) {
    const wrap = session.el('div', 'cycle-strip')
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const chip = session.el('div', 'cycle-chip')
      if (item.id) {
        chip.classList.add('is-' + item.id)
      }
      if (item.tone === 'ok' || item.tone === 'over') {
        chip.classList.add('is-' + item.tone)
      }
      const label = session.el('span', 'cycle-chip-label')
      session.setText(label, item.label)
      const value = session.el('span', 'cycle-chip-value')
      session.setText(value, item.value)
      chip.appendChild(label)
      chip.appendChild(value)
      if (item.hint) {
        const hint = session.el('span', 'cycle-chip-hint')
        session.setText(hint, item.hint)
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
    const wrap = session.el('section', 'stats-section')
    const head = session.el('div', 'stats-section-head')
    const heading = session.el('h2')
    session.setText(heading, title)
    head.appendChild(heading)
    if (meta) {
      const badge = session.el('span', 'stats-section-meta')
      session.setText(badge, meta)
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
    return n === 1 ? session.t('stats.queryOne') : session.t('stats.queryMany', { n: n.toLocaleString('en-US') })
  }

  function applyMtdPayload(mtd) {
    session.mtdForecastSvgs = []
    session.mtdUnit = 'usd'
    session.mtdMax = null
    session.mtdForecastPoints = []
    session.mtdForecastSeries = []
    session.mtdResetDate = null
    session.mtdResetMidday = false
    if (!mtd) {
      return
    }
    session.mtdUnit = mtd.unit === 'percent' ? 'percent' : 'usd'
    session.mtdMax = Number.isFinite(Number(mtd.max)) ? Number(mtd.max) : null
    session.mtdForecastPoints = Array.isArray(mtd.forecast) ? mtd.forecast : []
    session.mtdForecastSeries = Array.isArray(mtd.series) ? mtd.series : []
    session.mtdResetDate = typeof mtd.resetDate === 'string' ? mtd.resetDate : null
    session.mtdResetMidday = mtd.resetMidday === true
    session.forecastWindow =
      mtd.forecastWindow === 'billingCycle' ? 'billingCycle' : 'calendarMonth'
    if (session.forecastWindowEl) {
      const billingOption = session.forecastWindowEl.querySelector(
        'option[value="billingCycle"]',
      )
      if (billingOption) {
        billingOption.hidden = mtd.billingCycleAvailable !== true
      }
      if (document.activeElement !== session.forecastWindowEl) {
        session.forecastWindowEl.value = session.forecastWindow
      }
    }
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
    const card = session.el('article', 'status-block is-mtd')
    const title = session.el('h3')
    session.setText(title, mtd.title || 'Monthly cost forecast')
    card.appendChild(title)
    const bars = mtd.bars || []
    if (bars.length > 0) {
      const meters = session.el('div', 'meter-list meter-list-tight')
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        meters.appendChild(
          meterRow(bar.label, bar.value, bar.percent, 'usage'),
        )
      }
      card.appendChild(meters)
    }
    if (mtd.body) {
      const body = session.el('p', 'stats-hint')
      session.setText(body, mtd.body)
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
    const hint = session.el('p', 'chart-hint')
    session.setText(
      hint,
      session.mtdUnit === 'percent' ? session.t('mtd.hintPercent') : session.t('mtd.hintUsd'),
    )
    card.appendChild(hint)
    const legend = session.el('div', 'chart-legend')
    const barItem = session.el('span', 'chart-legend-item is-bar is-pace')
    session.setText(barItem, session.t('mtd.cumulative'))
    legend.appendChild(barItem)
    for (let i = 0; i < series.length; i++) {
      const tone = ' is-s' + (i % 4)
      const label = String(series[i].label || session.t('mtd.used'))
      const usedItem = session.el('span', 'chart-legend-item' + tone)
      session.setText(usedItem, label)
      const forecastItem = session.el('span', 'chart-legend-item is-forecast' + tone)
      session.setText(forecastItem, session.t('mtd.forecastSuffix', { label: label }))
      legend.appendChild(usedItem)
      legend.appendChild(forecastItem)
    }
    const tools = session.el('div', 'mtd-chart-tools')
    tools.appendChild(legend)
    tools.appendChild(session.mtdRangeToggle())
    card.appendChild(tools)
    const frame = session.el('div', 'chart-frame mtd-forecast-frame')
    const svg = session.svgNode('svg', {
      class: 'chart-svg',
      viewBox: '0 0 800 280',
      preserveAspectRatio: 'none',
      role: 'img',
      'aria-label':
        session.mtdUnit === 'percent' ? session.t('mtd.ariaPercent') : session.t('mtd.ariaUsd'),
    })
    frame.appendChild(svg)
    card.appendChild(frame)
    session.mtdForecastSvgs.push(svg)
    return card
  }

  function mtdForecastSection(mtd) {
    const pace = section(mtd.title || session.t('mtd.title'))
    pace.appendChild(mtdForecastCard(mtd))
    const chips = mtdMetricsStrip(mtd.metrics)
    if (chips) {
      pace.appendChild(chips)
    }
    return pace
  }

  function renderStats(stats, mtd, burnRate, warnOn, codeLines) {
    lastStatsArgs = [stats, mtd, burnRate, warnOn, codeLines]
    const scrolling = document.scrollingElement || document.documentElement
    const scrollTop = scrolling ? scrolling.scrollTop : 0
    session.codeLinesInfoRebuilding = true
    try {
    while (statsEl.firstChild) {
      statsEl.removeChild(statsEl.firstChild)
    }
    if (!stats) {
      if (scrolling) {
        scrolling.scrollTop = scrollTop
      }
      return
    }

    if (burnRate && (burnRate.level === 'warning' || burnRate.level === 'critical')) {
      statsEl.appendChild(burnBanner(burnRate, warnOn !== false))
    }

    const glossary = section(session.t('stats.statusBar'))
    const glossaryGrid = session.el('div', 'status-explain')
    if (burnRate) {
      glossaryGrid.appendChild(burnRateCard(burnRate, warnOn !== false))
    }
    const items = stats.glossary || []
    for (let i = 0; i < items.length; i++) {
      glossaryGrid.appendChild(glossaryCard(items[i]))
    }
    if (codeLines) {
      glossaryGrid.appendChild(session.codeLinesCard(codeLines))
    }
    glossary.appendChild(glossaryGrid)
    statsEl.appendChild(glossary)

    if (mtd) {
      statsEl.appendChild(mtdForecastSection(mtd))
    }

    if (stats.cycle && stats.cycle.length > 0) {
      const cycle = section(session.t('stats.billingCycle'))
      cycle.appendChild(cycleStrip(stats.cycle))
      statsEl.appendChild(cycle)
    }

    const sample = section(
      session.t('stats.sampleSummary', { heading: lastHeading(stats.historyLimit) }),
      queryCountMeta(stats),
    )
    const note = session.el('p', 'stats-note')
    session.setText(note, stats.sampleNote || '')
    sample.appendChild(note)
    appendSampleMetrics(
      sample,
      stats.sample,
      spikeCountFromSample(stats.sample),
      stats.historyLimit,
    )
    statsEl.appendChild(sample)

    const hasBreakdown =
      (stats.byModel && stats.byModel.length > 0) ||
      (stats.byKind && stats.byKind.length > 0)
    const breakdown = section(
      hasBreakdown ? session.t('stats.spendBreakdown') : session.t('stats.modelPricing'),
    )
    const layout = session.el('div', 'breakdown-with-catalog')
    if (hasBreakdown) {
      const split = session.el('div', 'breakdown-split')
      if (stats.byModel && stats.byModel.length > 0) {
        split.appendChild(breakdownChart(stats.byModel, session.t('stats.byModel')))
      }
      if (stats.byKind && stats.byKind.length > 0) {
        split.appendChild(breakdownChart(stats.byKind, session.t('stats.byKind')))
      }
      layout.appendChild(split)
    }
    layout.appendChild(session.modelCatalogPanel())
    breakdown.appendChild(layout)
    statsEl.appendChild(breakdown)
    if (scrolling) {
      scrolling.scrollTop = scrollTop
    }
    session.restoreCodeLinesInfo(statsEl)
    } finally {
      session.codeLinesInfoRebuilding = false
    }
  }


  return {
    render: renderStats,
    renderPeriods: renderPeriodCards,
    applyMtd: applyMtdPayload,
    meterRow,
    get args() {
      return lastStatsArgs
    },
  }
}
