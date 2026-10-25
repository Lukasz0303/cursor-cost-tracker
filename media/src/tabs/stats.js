/** Statistics tab body. Edit here; media/history.js is generated. */
import { buildCodexWindowChart } from '../charts/codexForecast.js'
import { renderSpendMix } from '../charts/spendMix.js'

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
    if (
      session.querySource === 'codex-local' ||
      session.querySource === 'openai-api'
    ) {
      return
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
        const shown = Math.round(item.percent * 10) / 10
        chip.appendChild(
          meterRow(item.meterLabel || 'Elapsed', shown + '%', item.percent, 'cycle'),
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
    session.mtdViews = []
    session.mtdMax = null
    session.mtdForecastPoints = []
    session.mtdForecastSeries = []
    session.mtdResetDate = null
    session.mtdResetMidday = false
    if (!mtd) {
      return
    }
    session.mtdUnit = mtd.unit === 'percent' ? 'percent' : 'usd'
    session.mtdViews = Array.isArray(mtd.views) ? mtd.views : []
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

  function activeMtdView(mtd) {
    const views =
      mtd && Array.isArray(mtd.views) ? mtd.views : session.mtdViews
    const unit = mtd && mtd.unit ? mtd.unit : session.mtdUnit
    if (unit !== 'percent' || !views || views.length === 0) {
      return null
    }
    const pool =
      session.mtdSeriesFilter === 'other' || session.mtdSeriesFilter === 'all'
        ? session.mtdSeriesFilter
        : 'cursor'
    for (let i = 0; i < views.length; i++) {
      if (views[i] && views[i].pool === pool) {
        return views[i]
      }
    }
    return null
  }

  function fillMtdMeters(meters, bars) {
    while (meters.firstChild) {
      meters.removeChild(meters.firstChild)
    }
    const list = bars || []
    for (let i = 0; i < list.length; i++) {
      const bar = list[i]
      meters.appendChild(meterRow(bar.label, bar.value, bar.percent, 'usage'))
    }
    meters.hidden = list.length === 0
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
    const view = activeMtdView(mtd)
    const bars = view ? view.bars || [] : mtd.bars || []
    const meters = session.el('div', 'meter-list meter-list-tight')
    meters.id = 'mtdMeters'
    fillMtdMeters(meters, bars)
    card.appendChild(meters)
    const bodyText = view ? view.body : mtd.body
    const body = session.el('p', 'stats-hint')
    body.id = 'mtdBody'
    session.setText(body, bodyText || '')
    body.hidden = !bodyText
    card.appendChild(body)
    const over = view
      ? view.overPace || view.verdict === 'over' || view.verdict === 'tight'
      : mtd.overPace || mtd.verdict === 'over' || mtd.verdict === 'tight'
    if (over) {
      card.classList.add('is-over')
    }
    const forecast = Array.isArray(mtd.forecast) ? mtd.forecast : []
    const series = Array.isArray(mtd.series) ? mtd.series : []
    if (forecast.length === 0 || series.length === 0) {
      return card
    }
    const dailyMode = session.mtdBarMode === 'daily'
    const percent = session.mtdUnit === 'percent'
    const hint = session.el('p', 'chart-hint')
    hint.setAttribute('data-mtd-hint', '')
    session.setText(
      hint,
      mtd.hint ||
        session.t(
          dailyMode
            ? percent
              ? 'mtd.hintPercentDaily'
              : 'mtd.hintUsdDaily'
            : percent
              ? 'mtd.hintPercent'
              : 'mtd.hintUsd',
        ),
    )
    card.appendChild(hint)
    const legend = session.el('div', 'chart-legend')
    const barItem = session.el('span', 'chart-legend-item is-bar is-pace')
    barItem.setAttribute('data-mtd-legend', 'bars')
    session.setText(barItem, session.t(dailyMode ? 'mtd.daily' : 'mtd.cumulative'))
    legend.appendChild(barItem)
    for (let i = 0; i < series.length; i++) {
      const tone = ' is-s' + (i % 4)
      const label = String(series[i].label || session.t('mtd.used'))
      const pool =
        series[i].id === 'cursor-models' || label === 'Cursor Models'
          ? 'cursor'
          : series[i].id === 'other-models' || label === 'Other Models'
            ? 'other'
            : ''
      const inFilter = !percent || pool === '' || pool === session.mtdSeriesFilter
      const usedItem = session.el('span', 'chart-legend-item' + tone)
      usedItem.setAttribute('data-mtd-legend', 'used')
      usedItem.setAttribute('data-series-pool', pool)
      usedItem.hidden = dailyMode || !inFilter
      session.setText(usedItem, label)
      const forecastItem = session.el('span', 'chart-legend-item is-forecast' + tone)
      forecastItem.setAttribute('data-mtd-legend', 'forecast')
      forecastItem.setAttribute('data-series-label', label)
      forecastItem.setAttribute('data-series-pool', pool)
      forecastItem.hidden = !inFilter
      session.setText(
        forecastItem,
        session.t(dailyMode ? 'mtd.dailyPaceSuffix' : 'mtd.forecastSuffix', {
          label: label,
        }),
      )
      legend.appendChild(usedItem)
      legend.appendChild(forecastItem)
    }
    if (percent && series.length > 1) {
      const blendLabel = session.t('mtd.seriesAll')
      const showBlend = session.mtdSeriesFilter === 'all'
      const blendUsed = session.el('span', 'chart-legend-item is-s0')
      blendUsed.setAttribute('data-mtd-legend', 'used')
      blendUsed.setAttribute('data-series-pool', 'all')
      blendUsed.hidden = dailyMode || !showBlend
      session.setText(blendUsed, blendLabel)
      const blendForecast = session.el('span', 'chart-legend-item is-forecast is-s0')
      blendForecast.setAttribute('data-mtd-legend', 'forecast')
      blendForecast.setAttribute('data-series-label', blendLabel)
      blendForecast.setAttribute('data-series-pool', 'all')
      blendForecast.hidden = !showBlend
      session.setText(
        blendForecast,
        session.t(dailyMode ? 'mtd.dailyPaceSuffix' : 'mtd.forecastSuffix', {
          label: blendLabel,
        }),
      )
      legend.appendChild(blendUsed)
      legend.appendChild(blendForecast)
    }
    const tools = session.el('div', 'mtd-chart-tools')
    const toggles = session.el('div', 'mtd-chart-toggles')
    if (percent && series.length > 1) {
      toggles.appendChild(session.mtdSeriesToggle())
    }
    toggles.appendChild(session.mtdBarModeToggle())
    toggles.appendChild(session.mtdRangeToggle())
    tools.appendChild(legend)
    tools.appendChild(toggles)
    card.appendChild(tools)
    const frame = session.el('div', 'chart-frame mtd-forecast-frame')
    const svg = session.svgNode('svg', {
      class: 'chart-svg',
      viewBox: '0 0 800 280',
      preserveAspectRatio: 'none',
      role: 'img',
      'aria-label': session.t(
        dailyMode
          ? percent
            ? 'mtd.ariaPercentDaily'
            : 'mtd.ariaUsdDaily'
          : percent
            ? 'mtd.ariaPercent'
            : 'mtd.ariaUsd',
      ),
    })
    frame.appendChild(svg)
    card.appendChild(frame)
    session.mtdForecastSvgs.push(svg)
    return card
  }

  function mtdForecastSection(mtd) {
    const pace = section(mtd.title || session.t('mtd.title'))
    pace.appendChild(mtdForecastCard(mtd))
    const view = activeMtdView(mtd)
    const chips = mtdMetricsStrip(view ? view.metrics : mtd.metrics)
    if (chips) {
      chips.id = 'mtdMetrics'
      pace.appendChild(chips)
    }
    return pace
  }

  function codexMetricCard(title, value, hint) {
    const card = session.el('article', 'status-block')
    const h = session.el('h3', 'status-block-title')
    session.setText(h, title)
    card.appendChild(h)
    const v = session.el('p', 'status-block-value')
    session.setText(v, value)
    card.appendChild(v)
    if (hint) {
      const p = session.el('p', 'status-block-hint')
      session.setText(p, hint)
      card.appendChild(p)
    }
    return card
  }

  function codexImportBlocked() {
    const status = session.codexHostStatus
    return (
      status &&
      status.importEnabled !== true &&
      status.rolloutsOnDisk === true
    )
  }

  function renderCodexStats(payload) {
    while (statsEl.firstChild) {
      statsEl.removeChild(statsEl.firstChild)
    }
    if (codexImportBlocked()) {
      const blocked = session.el('p', 'stats-note')
      session.setText(blocked, session.t('codex.coverageImportOff'))
      statsEl.appendChild(blocked)
      const requests =
        payload && payload.counts ? payload.counts.modelRequests || 0 : 0
      if (!payload || requests === 0) {
        return
      }
    }
    if (!payload) {
      const empty = session.el('p', 'stats-note')
      session.setText(empty, session.t('codex.statsEmpty'))
      statsEl.appendChild(empty)
      return
    }
    if (payload.mirror) {
      renderCodexMirror(payload)
    } else {
      renderCodexLimits(payload.limits || null)
      renderCodexEstimate(payload)
      renderCodexTokenStack(payload)
    }
    renderCodexConversations(payload.conversations || [])
  }

  function pctPoint(value) {
    const n = Number(value)
    if (!Number.isFinite(n)) {
      return '—'
    }
    const rounded = Math.round(n * 10) / 10
    const text =
      Math.abs(rounded - Math.round(rounded)) < 0.05
        ? String(Math.round(rounded))
        : rounded.toFixed(1)
    return text + '%'
  }

  function spanCount(value) {
    const n = Number(value)
    if (!Number.isFinite(n)) {
      return '—'
    }
    return n.toFixed(Math.abs(n) >= 0.1 ? 1 : 2)
  }

  function paceReady(pace) {
    return (
      pace.dailyPace !== null &&
      pace.dailyPace !== undefined &&
      Number.isFinite(Number(pace.dailyPace))
    )
  }

  function mirrorMoney(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return '—'
    }
    return session.compactCost(value)
  }

  function windowTitle(kind) {
    if (kind === '5h') {
      return session.t('codex.limit5h')
    }
    if (kind === '7d') {
      return session.t('codex.limit7d')
    }
    if (kind === '30d') {
      return session.t('codex.limit30d')
    }
    return session.t('codex.limitCustom')
  }

  function kindLabel(kind, included) {
    if (included) {
      return session.t('codex.includedEstimate')
    }
    if (kind === 'api') {
      return 'API'
    }
    if (kind === 'chatgpt-plan') {
      return session.t('codex.includedPlan')
    }
    return session.t('codex.statsEstimatedApi')
  }

  function shareLabel(key) {
    if (key === 'cacheRead') {
      return session.t('stats.cacheRead')
    }
    if (key === 'output') {
      return session.t('stats.output')
    }
    if (key === 'cacheWrite') {
      return session.t('stats.cacheWrite')
    }
    return session.t('stats.input')
  }

  function isoMidnight(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
    if (!match) {
      return null
    }
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
  }

  /** Recent-queries From–To. Empty To means through today. */
  function codexSettingsDayRange() {
    const from = isoMidnight(session.historyFromDate)
    if (from === null) {
      return null
    }
    const to = isoMidnight(session.historyToDate)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const end = to === null ? today : to
    if (end < from) {
      return null
    }
    return { from: from, to: end }
  }

  function codexForecastPayload(pace) {
    const hourly = pace.unit === 'hour'
    const built = buildCodexWindowChart({
      pace: pace,
      series: session.codexLimitSeries || [],
      dayRange: hourly ? null : codexSettingsDayRange(),
    })
    if (!built) {
      return null
    }
    const hasPace =
      pace.dailyPace !== null &&
      pace.dailyPace !== undefined &&
      Number.isFinite(Number(pace.dailyPace))
    const usedNow = Math.max(0, Number(pace.used) || 0)
    const axis = built.points
    const runOutDate = built.runOutDate
    const label = windowTitle(pace.kind)
    const metrics = []
    if (runOutDate) {
      metrics.push({
        id: 'end',
        label: session.t('mtd.runsOutLabel'),
        value: runOutDate,
      })
    }
    return {
      title: label,
      value: '',
      body: '',
      bars: [
        {
          label: session.t('codex.measuredOn', { when: pace.asOfLabel || '' }),
          value: pctPoint(usedNow),
          percent: Math.max(0, Math.min(100, usedNow)),
        },
      ],
      metrics: metrics,
      overPace: hasPace && pace.over === true,
      verdict: hasPace && pace.over ? 'tight' : 'ok',
      unit: 'percent',
      max: 100,
      chart: axis,
      forecast: axis,
      series: [
        {
          id: 'codex-window',
          label: label,
          day: built.day,
          used: built.used,
          forecast: built.forecast,
          ideal: built.ideal,
          runOutDate: runOutDate,
          runOutLabel: runOutDate
            ? session.t('mtd.runsOut', { date: runOutDate })
            : '',
        },
      ],
      forecastWindow: 'calendarMonth',
      billingCycleAvailable: false,
      resetDate: built.resetDate || null,
      resetMidday: built.resetMidday === true,
    }
  }

  function renderCodexMirror(payload) {
    const mirror = payload.mirror
    const limits = payload.limits
    const windows = []
    if (limits && limits.primary) {
      windows.push(limits.primary)
    }
    if (limits && limits.secondary) {
      windows.push(limits.secondary)
    }
    const glossary = section(session.t('stats.statusBar'))
    const glossaryGrid = session.el('div', 'status-explain')
    const fresh = windows.filter(function (windowView) {
      return windowView && windowView.fresh && windowView.usedPercent !== null && windowView.usedPercent !== undefined
    })
    const notes = []
    for (let i = 0; i < windows.length; i++) {
      const windowView = windows[i]
      if (!windowView || windowView.fresh) {
        continue
      }
      if (windowView.stale) {
        notes.push(
          windowTitle(windowView.kind) +
            ' · ' +
            session.t('codex.limitStaleSince', { reset: windowView.resetsLabel || '—' }),
        )
        continue
      }
      notes.push(
        windowTitle(windowView.kind) +
          ' · ' +
          session.t('codex.limitLastReading', {
            used: pctPoint(windowView.usedPercent).replace(/%$/, ''),
            when: windowView.observedLabel || '—',
            reset: windowView.resetsLabel || '—',
          }) +
          ' ' +
          session.t('codex.limitNotLive'),
      )
    }
    if (fresh.length > 0) {
      const when =
        (limits && limits.observedLabel) || fresh[0].observedLabel || '—'
      notes.unshift(
        session.t('codex.limitMeasuredAt', { when: when }) +
          ' ' +
          session.t('codex.limitNotLive'),
      )
    }
    const currentCard = glossaryCard({
      id: 'current',
      title: session.t('stats.current'),
      value:
        fresh.length === 0
          ? '—'
          : fresh
              .map(function (windowView) {
                return windowTitle(windowView.kind) + ' ' + pctPoint(windowView.usedPercent)
              })
              .join(' · '),
      bars: fresh.map(function (windowView) {
        return {
          label: windowTitle(windowView.kind),
          value: pctPoint(windowView.usedPercent),
          percent: Number(windowView.usedPercent) || 0,
        }
      }),
      body: notes[0] || '',
    })
    for (let n = 1; n < notes.length; n++) {
      const line = session.el('p', 'stats-hint')
      session.setText(line, notes[n])
      currentCard.appendChild(line)
    }
    glossaryGrid.appendChild(currentCard)
    glossaryGrid.appendChild(
      glossaryCard({
        id: 'today',
        title: session.t('stats.todaySum', { amount: mirrorMoney(mirror.todayUsd) }),
        value: mirrorMoney(mirror.todayUsd),
        bars: [
          {
            label: session.t('stats.today'),
            value: mirrorMoney(mirror.todayUsd),
            percent:
              mirror.totalUsd > 0 ? (Number(mirror.todayUsd) / Number(mirror.totalUsd)) * 100 : 0,
          },
        ],
        body: mirror.includedInPlan
          ? session.t('codex.includedEstimate')
          : session.t('codex.estimateBasis'),
      }),
    )
    glossary.appendChild(glossaryGrid)
    statsEl.appendChild(glossary)

    if (mirror.pace) {
      const pace = mirror.pace
      const span = Number(pace.elapsed) + Number(pace.left)
      const byHour = pace.unit === 'hour'
      const ready = paceReady(pace)
      const paceSection = section(windowTitle(pace.kind))
      const paceCards = []
      if (ready) {
        paceCards.push(
          metricCard({
            id: 'mtdAvg',
            label: session.t('mtd.dailyPace'),
            value: pctPoint(pace.dailyPace),
            hint: session.t(byHour ? 'codex.paceWindowLeftHours' : 'codex.paceWindowLeft', {
              n: spanCount(pace.left),
            }),
          }),
        )
      }
      paceCards.push(
        metricCard({
          id: 'mtdDaily',
          label: session.t('stats.dailyBudget'),
          value: pctPoint(pace.dailyBudget),
          hint: session.t(byHour ? 'codex.dailyBudgetSplitHours' : 'codex.dailyBudgetSplit', {
            n: spanCount(span),
          }),
        }),
        metricCard({
          id: 'mtdToLast',
          label: session.t('mtd.toLast'),
          value: pctPoint(pace.toLast),
          hint: session.t(byHour ? 'codex.toLastHintHour' : 'codex.toLastHint'),
        }),
        metricCard({
          id: 'mtdDays',
          label: session.t('codex.elapsedInWindow'),
          value: spanCount(pace.elapsed),
          hint: session.t(byHour ? 'codex.spanHours' : 'codex.spanDays'),
        }),
        metricCard({
          id: 'mtdDaysLeft',
          label: session.t('codex.leftInWindow'),
          value: spanCount(pace.left),
          hint: session.t(byHour ? 'codex.spanHours' : 'codex.spanDays'),
        }),
        metricCard({
          id: 'mtdLeft',
          label: session.t('mtd.quotaLeft'),
          value: pctPoint(pace.remaining),
          hint: windowTitle(pace.kind),
        }),
      )
      paceSection.appendChild(metricGrid(paceCards, 'stats-grid-primary'))
      const forecast = codexForecastPayload(pace)
      if (forecast) {
        applyMtdPayload(forecast)
        paceSection.appendChild(mtdForecastCard(forecast))
        if (typeof session.redrawMtdForecastChart === 'function') {
          session.redrawMtdForecastChart()
        }
      }
      const forecastCards = []
      if (ready) {
        const exceeds = Number(pace.forecast) >= 100
        forecastCards.push(
          metricCard({
            id: 'mtdForecast',
            label: windowTitle(pace.kind),
            value: exceeds
              ? session.t('codex.forecastExceeds')
              : pctPoint(pace.forecast),
            hint: exceeds
              ? pace.runsOutLabel || session.t('codex.forecastExceeds')
              : session.t('codex.forecastHeadroom'),
          }),
          metricCard(
            {
              id: 'mtdPace',
              label: session.t('mtd.pace'),
              value: pace.over ? session.t('mtd.over') : session.t('mtd.under'),
              hint: windowTitle(pace.kind),
            },
            { highlight: pace.over },
          ),
          metricCard({
            id: 'mtdRunOut',
            label: session.t('mtd.runsOutLabel'),
            value: pace.runsOutLabel || session.t('codex.lastsUntilReset'),
            hint: session.t('mtd.ifDailyPace'),
          }),
        )
      }
      if (forecastCards.length > 0) {
        paceSection.appendChild(metricGrid(forecastCards, 'stats-grid-detail'))
      }
      statsEl.appendChild(paceSection)
    }

    const cycle = section(session.t('codex.limitWindow'))
    cycle.appendChild(
      cycleStrip([
        {
          id: 'plan',
          label: session.t('stats.plan'),
          value: mirror.plan || '—',
          hint: mirror.includedInPlan ? session.t('codex.includedEstimate') : '',
        },
        {
          id: 'cycle',
          label: session.t('codex.limitReset'),
          value: mirror.pace ? mirror.pace.resetsLabel || '—' : '—',
          meterLabel: session.t('codex.elapsedInWindow'),
          percent:
            mirror.pace && Number.isFinite(Number(mirror.pace.windowElapsedPercent))
              ? Number(mirror.pace.windowElapsedPercent)
              : undefined,
        },
      ]),
    )
    statsEl.appendChild(cycle)

    const heading = session.t('codex.statsCosts')
    const sample = section(
      session.t('stats.sampleSummary', { heading: heading }),
      queryCountMeta({ queryCount: mirror.requests }),
    )
    const note = session.el('p', 'stats-note')
    session.setText(note, session.t('codex.estimateBasis'))
    sample.appendChild(note)
    const sampleItems = [
      {
        id: 'total',
        label: session.t('stats.sampleTotal', { heading: heading }),
        value: mirrorMoney(mirror.totalUsd),
        hint:
          mirror.requests === 1
            ? session.t('stats.queryOne')
            : session.t('stats.queryMany', { n: String(mirror.requests) }),
      },
      {
        id: 'avgCost',
        label: session.t('stats.avgCost'),
        value: mirrorMoney(mirror.avgUsd),
      },
      {
        id: 'spikes',
        label: session.t('stats.spikes'),
        value: String(mirror.spikes || 0),
        hint: session.t('stats.spikesHint', {
          n: session.compactTokens(mirror.spikeThreshold || 1000000),
        }),
      },
      {
        id: 'medianCost',
        label: session.t('stats.medianCost'),
        value: mirrorMoney(mirror.medianUsd),
      },
      {
        id: 'cacheHit',
        label: session.t('stats.cacheHit'),
        value:
          mirror.cacheHit === null || mirror.cacheHit === undefined
            ? '—'
            : Math.round(mirror.cacheHit * 100) + '%',
      },
      {
        id: 'costPerMillion',
        label: session.t('stats.costPerMillion'),
        value: mirrorMoney(mirror.costPerMillion),
      },
      {
        id: 'avgTokens',
        label: session.t('stats.avgTokens'),
        value:
          mirror.avgTokens === null || mirror.avgTokens === undefined
            ? '—'
            : session.compactTokens(mirror.avgTokens),
      },
      mirror.priciest
        ? {
            id: 'priciest',
            label: session.t('stats.mostExpensive'),
            value: mirrorMoney(mirror.priciest.usd),
            detail: mirror.priciest.model,
            hint: mirror.priciest.when,
          }
        : null,
      mirror.heaviest
        ? {
            id: 'heaviest',
            label: session.t('stats.heaviest'),
            value: session.compactTokens(mirror.heaviest.tokens),
            detail: mirror.heaviest.model,
            hint: mirror.heaviest.when,
          }
        : null,
      mirror.busiest
        ? {
            id: 'busiest',
            label: session.t('stats.busiestDay'),
            value: mirrorMoney(mirror.busiest.usd),
            detail: mirror.busiest.day,
            hint: session.t('stats.queryMany', { n: String(mirror.busiest.requests) }),
          }
        : null,
      {
        id: 'tokens',
        label: session.t('stats.tokensIn', { heading: heading }),
        value: session.compactTokens(mirror.totalTokens || 0),
        hint: session.t('stats.tokensHint', {
          input: session.compactTokens(mirror.inputTokens || 0),
          output: session.compactTokens(mirror.outputTokens || 0),
        }),
        shares: (mirror.shares || []).map(function (share) {
          return {
            key: share.key,
            label: shareLabel(share.key),
            percent: share.percent,
          }
        }),
      },
    ].filter(function (item) {
      return item !== null
    })
    appendSampleMetrics(sample, sampleItems, mirror.spikes || 0, 0)
    statsEl.appendChild(sample)

    const modelRows = (mirror.byModel || []).map(function (row) {
      const pct = mirror.totalUsd > 0 ? Math.round((row.usd / mirror.totalUsd) * 100) : 0
      return {
        label: row.label,
        value: mirrorMoney(row.usd),
        share: pct + '%',
        percent: pct,
      }
    })
    const kindRows = (mirror.byKind || []).map(function (row) {
      const pct = mirror.totalUsd > 0 ? Math.round((row.usd / mirror.totalUsd) * 100) : 0
      return {
        label: kindLabel(row.label, mirror.includedInPlan),
        value: mirrorMoney(row.usd),
        share: pct + '%',
        percent: pct,
      }
    })
    if (modelRows.length > 0 || kindRows.length > 0 || (mirror.rates || []).length > 0) {
      const breakdown = section(session.t('stats.spendBreakdown'))
      const layout = session.el('div', 'breakdown-with-catalog')
      if (modelRows.length > 0 || kindRows.length > 0) {
        const split = session.el('div', 'breakdown-split')
        if (modelRows.length > 0) {
          split.appendChild(breakdownChart(modelRows, session.t('stats.byModel')))
        }
        if (kindRows.length > 0) {
          split.appendChild(breakdownChart(kindRows, session.t('stats.byKind')))
        }
        layout.appendChild(split)
      }
      if (mirror.rates && mirror.rates.length > 0) {
        layout.appendChild(codexRateTable(mirror.rates, mirror.totalUsd))
      }
      breakdown.appendChild(layout)
      statsEl.appendChild(breakdown)
    }
  }

  function codexRateTable(rates, totalUsd) {
    const panel = session.el('div', 'breakdown-panel')
    const heading = session.el('h3', 'breakdown-title')
    session.setText(heading, session.t('stats.modelPricing'))
    panel.appendChild(heading)
    const wrap = session.el('div', 'table-wrap')
    const table = session.el('table')
    const head = session.el('tr')
    const titles = [
      session.t('queries.model'),
      session.t('stats.input') + ' / ' + session.t('stats.cacheRead') + ' / ' + session.t('stats.output'),
      session.t('stats.colRequests'),
      session.t('codex.colEstimate'),
    ]
    for (let i = 0; i < titles.length; i++) {
      const th = session.el('th')
      session.setText(th, titles[i])
      head.appendChild(th)
    }
    const thead = session.el('thead')
    thead.appendChild(head)
    table.appendChild(thead)
    const body = session.el('tbody')
    for (let i = 0; i < rates.length; i++) {
      const rate = rates[i]
      const tr = session.el('tr')
      const cells = [
        rate.model,
        '$' + rate.inputRate + ' / $' + rate.cachedRate + ' / $' + rate.outputRate,
        String(rate.requests),
        mirrorMoney(rate.usd) +
          (totalUsd > 0 ? ' · ' + Math.round((rate.usd / totalUsd) * 100) + '%' : ''),
      ]
      for (let c = 0; c < cells.length; c++) {
        const td = session.el('td')
        session.setText(td, cells[c])
        tr.appendChild(td)
      }
      body.appendChild(tr)
    }
    table.appendChild(body)
    wrap.appendChild(table)
    panel.appendChild(wrap)
    return panel
  }

  function fullTokens(n) {
    const value = Math.round(Number(n) || 0)
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  function joinModels(models) {
    if (!models || models.length === 0) {
      return ''
    }
    if (models.length === 1) {
      return models[0]
    }
    return models.slice(0, -1).join(', ') + session.t('codex.modelJoin') + models[models.length - 1]
  }

  function noRateSentence(models) {
    const names = joinModels(models)
    if (!names) {
      return session.t('codex.noRates')
    }
    return session.t('codex.noRateForModels', { models: names })
  }

  function ratesButton(models) {
    const button = session.el('button', 'action-btn action-btn-accent')
    button.type = 'button'
    session.setText(button, session.t('codex.setRates'))
    button.addEventListener('click', function () {
      if (typeof session.openCodexRates === 'function') {
        session.openCodexRates(models || [])
      }
    })
    return button
  }

  function renderCodexTokenStack(payload) {
    const mix = payload.tokenMix || {}
    const input = Math.max(0, Number(mix.input) || 0)
    const cached = Math.min(input, Math.max(0, Number(mix.cachedInput) || 0))
    const uncached = Math.max(0, input - cached)
    const output = Math.max(0, Number(mix.output) || 0)
    const reasoning = Math.min(output, Math.max(0, Number(mix.reasoning) || 0))
    const hit =
      payload.cacheHit === null || payload.cacheHit === undefined
        ? input > 0
          ? Math.round((cached / input) * 100)
          : 0
        : Math.round(payload.cacheHit * 100)
    const cachePct = input > 0 ? (cached / input) * 100 : 0
    const freshPct = input > 0 ? (uncached / input) * 100 : 0
    const reasonPct = output > 0 ? (reasoning / output) * 100 : 0

    const block = section(session.t('codex.statsTokenMix'))
    const stack = session.el('div', 'codex-mix')

    const inputCol = session.el('div', 'codex-mix-col')
    const inputLabel = session.el('p', 'codex-mix-label')
    session.setText(inputLabel, session.t('codex.statsInput'))
    const inputValue = session.el('p', 'codex-mix-value')
    session.setText(inputValue, session.compactTokens(input))
    inputValue.title = fullTokens(input)
    const inputTrack = session.el('div', 'codex-mix-track')
    inputTrack.title = fullTokens(input)
    const cacheSeg = session.el('span', 'codex-mix-seg is-cached')
    cacheSeg.style.width = cachePct + '%'
    cacheSeg.title = fullTokens(cached)
    const freshSeg = session.el('span', 'codex-mix-seg is-fresh')
    freshSeg.style.width = freshPct + '%'
    freshSeg.title = fullTokens(uncached)
    if (cachePct > 0) {
      inputTrack.appendChild(cacheSeg)
    }
    if (freshPct > 0) {
      inputTrack.appendChild(freshSeg)
    }
    const inputHint = session.el('p', 'codex-mix-hint')
    session.setText(
      inputHint,
      session.t('codex.mixCache', {
        hit: String(hit),
        uncached: fullTokens(uncached),
      }),
    )
    inputCol.appendChild(inputLabel)
    inputCol.appendChild(inputValue)
    inputCol.appendChild(inputTrack)
    inputCol.appendChild(inputHint)

    const outputCol = session.el('div', 'codex-mix-col is-output')
    const outputLabel = session.el('p', 'codex-mix-label')
    session.setText(outputLabel, session.t('codex.statsOutput'))
    const outputValue = session.el('p', 'codex-mix-value')
    session.setText(outputValue, session.compactTokens(output))
    outputValue.title = fullTokens(output)
    const outputTrack = session.el('div', 'codex-mix-track')
    outputTrack.title = fullTokens(output)
    const outSeg = session.el('span', 'codex-mix-seg is-output')
    outSeg.style.width = Math.max(0, 100 - reasonPct) + '%'
    const reasonSeg = session.el('span', 'codex-mix-seg is-reasoning')
    reasonSeg.style.width = reasonPct + '%'
    reasonSeg.title = fullTokens(reasoning)
    if (output > 0) {
      outputTrack.appendChild(outSeg)
      if (reasonPct > 0) {
        outputTrack.appendChild(reasonSeg)
      }
    }
    const outputHint = session.el('p', 'codex-mix-hint')
    session.setText(outputHint, session.t('codex.mixReasoning', { n: fullTokens(reasoning) }))
    outputCol.appendChild(outputLabel)
    outputCol.appendChild(outputValue)
    outputCol.appendChild(outputTrack)
    outputCol.appendChild(outputHint)

    const legend = session.el('div', 'codex-mix-legend')
    const legendItems = [
      ['is-cached', session.t('charts.legendCached')],
      ['is-fresh', session.t('charts.legendUncached')],
      ['is-output', session.t('charts.legendOutput')],
    ]
    for (let i = 0; i < legendItems.length; i++) {
      const item = session.el('span', legendItems[i][0])
      session.setText(item, legendItems[i][1])
      legend.appendChild(item)
    }
    stack.appendChild(inputCol)
    stack.appendChild(outputCol)
    stack.appendChild(legend)
    block.appendChild(stack)

    const counts = payload.counts || {}
    const line = session.el('p', 'codex-counts')
    session.setText(
      line,
      session.t('codex.countsLine', {
        requests: String(counts.modelRequests || 0),
        turns: String(counts.turns || 0),
        conversations: String(counts.conversations || 0),
      }),
    )
    block.appendChild(line)
    statsEl.appendChild(block)
  }

  function formatLimitPercent(value) {
    const n = Number(value)
    if (!Number.isFinite(n)) {
      return '—'
    }
    const rounded = Math.round(n * 10) / 10
    if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
      return String(Math.round(rounded))
    }
    return rounded.toFixed(1)
  }

  function limitWindowTitle(windowView) {
    if (!windowView) {
      return ''
    }
    if (windowView.kind === '5h') {
      return session.t('codex.limit5h')
    }
    if (windowView.kind === '7d') {
      return session.t('codex.limit7d')
    }
    if (windowView.kind === '30d') {
      return session.t('codex.limit30d')
    }
    return session.t('codex.limitCustom', {
      minutes: String(windowView.windowMinutes || 0),
    })
  }

  function limitTone(used) {
    if (!Number.isFinite(used) || used < 70) {
      return 'is-ok'
    }
    if (used < 90) {
      return 'is-amber'
    }
    return 'is-hot'
  }

  function renderLiveLimit(windowView, primary) {
    const used = Number(windowView.usedPercent)
    const width = Number.isFinite(used) ? Math.max(0, Math.min(100, used)) : 0
    const card = session.el(
      'div',
      'codex-limit is-live' + (primary ? ' is-primary' : ''),
    )
    const title = session.el('p', 'codex-limit-title')
    session.setText(title, limitWindowTitle(windowView))
    const head = session.el('p', 'codex-limit-head')
    session.setText(
      head,
      session.t('codex.limitLeft', {
        left: formatLimitPercent(windowView.remainingPercent),
      }),
    )
    const meter = session.el('div', 'codex-limit-meter')
    const track = session.el('div', 'codex-limit-track')
    const fill = session.el('div', 'codex-limit-fill ' + limitTone(used))
    fill.style.width = width + '%'
    track.appendChild(fill)
    const ticks = session.el('div', 'codex-limit-ticks')
    for (let i = 0; i < 3; i++) {
      const tick = session.el('span', 'codex-limit-tick')
      tick.style.left = i * 50 + '%'
      ticks.appendChild(tick)
    }
    meter.appendChild(track)
    meter.appendChild(ticks)
    const scale = session.el('div', 'codex-limit-scale')
    for (let i = 0; i < 3; i++) {
      const mark = session.el('span')
      session.setText(mark, String(i * 50))
      scale.appendChild(mark)
    }
    const axis = session.el('p', 'codex-limit-axis')
    session.setText(
      axis,
      session.t('codex.limitUsedAxis', { used: formatLimitPercent(used) }),
    )
    const when = session.el('p', 'codex-limit-when')
    session.setText(
      when,
      session.t('codex.limitMeasured', {
        when: windowView.observedLabel || '—',
        reset: windowView.resetsLabel || '—',
      }),
    )
    card.appendChild(title)
    card.appendChild(head)
    card.appendChild(meter)
    card.appendChild(scale)
    card.appendChild(axis)
    card.appendChild(when)
    return card
  }

  function renderStaleLimit(windowView) {
    const card = session.el('div', 'codex-limit is-stale')
    const title = session.el('p', 'codex-limit-title')
    const reset = windowView.resetsLabel || '—'
    session.setText(
      title,
      limitWindowTitle(windowView) +
        ' · ' +
        session.t('codex.limitStaleSince', { reset: reset }),
    )
    const details = session.el('details', 'codex-limit-last')
    const summary = session.el('summary')
    session.setText(summary, session.t('codex.limitShowLast'))
    const detail = session.el('p', 'codex-limit-when')
    session.setText(
      detail,
      session.t('codex.limitLastDetail', {
        used: formatLimitPercent(windowView.usedPercent),
        when: windowView.observedLabel || '—',
      }),
    )
    details.appendChild(summary)
    details.appendChild(detail)
    card.appendChild(title)
    card.appendChild(details)
    return card
  }

  function creditsLine(limits) {
    if (!limits) {
      return ''
    }
    if (limits.creditsUnlimited === true) {
      return session.t('codex.creditsUnlimited')
    }
    if (limits.creditsHas === true) {
      if (limits.creditsBalance === null || limits.creditsBalance === undefined || limits.creditsBalance === '') {
        return session.t('codex.creditsUnknown')
      }
      return session.t('codex.creditsBalance', { balance: String(limits.creditsBalance) })
    }
    if (limits.creditsHas === false) {
      return session.t('codex.creditsNone')
    }
    return ''
  }

  function renderCodexLimits(limits) {
    const wrap = session.el('div', 'codex-limits')
    if (!limits || (!limits.primary && !limits.secondary)) {
      const empty = session.el('p', 'stats-note')
      session.setText(empty, session.t('codex.limitsMissing'))
      statsEl.appendChild(empty)
      return
    }
    const windows = [limits.primary, limits.secondary].filter(function (windowView) {
      return !!windowView
    })
    windows.sort(function (a, b) {
      if (a.stale !== b.stale) {
        return a.stale ? 1 : -1
      }
      return (b.windowMinutes || 0) - (a.windowMinutes || 0)
    })
    let liveSeen = false
    for (let i = 0; i < windows.length; i++) {
      if (windows[i].stale) {
        wrap.appendChild(renderStaleLimit(windows[i]))
        continue
      }
      wrap.appendChild(renderLiveLimit(windows[i], !liveSeen))
      liveSeen = true
    }
    statsEl.appendChild(wrap)
    const planName = limits.planType
      ? limits.planType.charAt(0).toUpperCase() + limits.planType.slice(1)
      : '—'
    const credits = creditsLine(limits)
    const plan = session.el('p', 'codex-plan-line')
    session.setText(
      plan,
      credits
        ? session.t('codex.planCredits', { plan: planName, credits: credits })
        : planName,
    )
    statsEl.appendChild(plan)
    if (limits.reachedType) {
      const reached = session.el('p', 'codex-limit-badge')
      session.setText(
        reached,
        session.t('codex.limitReached', { type: String(limits.reachedType) }),
      )
      statsEl.appendChild(reached)
    }
    const live = session.el('p', 'stats-note')
    session.setText(live, session.t('codex.limitNotLive'))
    statsEl.appendChild(live)
  }

  function renderCodexEstimate(payload) {
    const sectionEl = section(session.t('codex.statsCosts'))
    const grid = session.el('div', 'status-explain')
    const priced = payload.pricedShare || { priced: 0, denom: 0 }
    const missing = Array.isArray(payload.missingModels) ? payload.missingModels : []
    const estimate = payload.estimatedApiCostUsd
    const hasEstimate = estimate !== null && estimate !== undefined
    if (!hasEstimate) {
      const card = session.el('div', 'status-block codex-rate-card')
      const label = session.el('h3', 'status-block-title')
      session.setText(label, session.t('codex.statsEstimatedApi'))
      const value = session.el('p', 'status-block-value')
      session.setText(
        value,
        session.t('codex.pricedShareLine', {
          priced: String(priced.priced || 0),
          denom: String(priced.denom || 0),
        }),
      )
      const hint = session.el('p', 'status-block-hint')
      session.setText(hint, noRateSentence(missing))
      card.appendChild(label)
      card.appendChild(value)
      card.appendChild(hint)
      card.appendChild(ratesButton(missing))
      grid.appendChild(card)
    } else {
      const labelText =
        payload.includedInPlan === true
          ? session.t('codex.includedEstimate')
          : session.t('codex.statsEstimatedApi')
      const hint =
        missing.length > 0
          ? noRateSentence(missing)
          : session.t('codex.statsPricedShare') +
            ' ' +
            session.t('codex.statsPricedShareValue', {
              priced: String(priced.priced || 0),
              denom: String(priced.denom || 0),
            })
      const card = codexMetricCard(labelText, session.compactCost(estimate), hint)
      if (missing.length > 0) {
        card.appendChild(ratesButton(missing))
      }
      grid.appendChild(card)
    }
    if (
      payload.reportedCostUsd !== null &&
      payload.reportedCostUsd !== undefined
    ) {
      grid.appendChild(
        codexMetricCard(
          session.t('codex.statsReported'),
          session.compactCost(payload.reportedCostUsd),
        ),
      )
    }
    sectionEl.appendChild(grid)
    statsEl.appendChild(sectionEl)
  }

  function renderCodexConversations(rows) {
    if (!rows || rows.length === 0) {
      return
    }
    const ranked = rows.slice().sort(function (a, b) {
      return (Number(b.inputTokens) || 0) - (Number(a.inputTokens) || 0)
    })
    const top = ranked.slice(0, 3)
    const block = section(session.t('codex.conversationList'))
    const list = session.el('div', 'codex-convo-list')
    for (let i = 0; i < top.length; i++) {
      const row = top[i]
      const card = session.el('div', 'codex-convo')
      const title = session.el('p', 'codex-convo-title')
      session.setText(title, row.title || '—')
      title.title = fullTokens(row.inputTokens || 0)
      card.appendChild(title)
      const meta = session.el('p', 'codex-convo-meta')
      session.setText(
        meta,
        session.t('codex.convoShort', {
          input: session.compactTokens(row.inputTokens || 0),
          n: String(row.requestCount || 0),
        }),
      )
      card.appendChild(meta)
      list.appendChild(card)
    }
    const link = session.el('button', 'action-btn')
    link.type = 'button'
    session.setText(link, session.t('codex.allConversations'))
    link.addEventListener('click', function () {
      session.setView('queries')
    })
    block.appendChild(list)
    block.appendChild(link)
    statsEl.appendChild(block)
  }

  function renderOpenaiEmptyStats() {
    while (statsEl.firstChild) {
      statsEl.removeChild(statsEl.firstChild)
    }
    const usage = session.openaiUsage
    if (!usage) {
      return
    }
    const block = section(session.t('codex.statsCosts'))
    const grid = session.el('div', 'stats-grid')
    if (usage.costUsd !== null && usage.costUsd !== undefined) {
      grid.appendChild(
        codexMetricCard(session.t('codex.statsCosts'), session.compactCost(usage.costUsd)),
      )
    }
    grid.appendChild(
      codexMetricCard(session.t('codex.statsModelRequests'), String(usage.requests || 0)),
    )
    grid.appendChild(
      codexMetricCard(session.t('stats.input'), session.compactTokens(usage.inputTokens || 0)),
    )
    grid.appendChild(
      codexMetricCard(session.t('stats.output'), session.compactTokens(usage.outputTokens || 0)),
    )
    grid.appendChild(
      codexMetricCard(
        session.t('stats.cacheRead'),
        session.compactTokens(usage.cachedTokens || 0),
      ),
    )
    block.appendChild(grid)
    statsEl.appendChild(block)
    const models = Array.isArray(usage.byModel) ? usage.byModel : []
    if (models.length === 0) {
      return
    }
    const listBlock = section(session.t('stats.byModel'))
    const list = session.el('div', 'codex-convo-list')
    const top = models.slice(0, 8)
    for (let i = 0; i < top.length; i++) {
      const row = top[i]
      const card = session.el('div', 'codex-convo')
      const title = session.el('p', 'codex-convo-title')
      session.setText(title, row.model || '—')
      card.appendChild(title)
      const meta = session.el('p', 'codex-convo-meta')
      session.setText(
        meta,
        session.t('stats.tokensHint', {
          input: session.compactTokens(row.inputTokens || 0),
          output: session.compactTokens(row.outputTokens || 0),
        }),
      )
      card.appendChild(meta)
      list.appendChild(card)
    }
    listBlock.appendChild(list)
    statsEl.appendChild(listBlock)
  }

  function formatBoardPercent(value) {
    const n = Number(value)
    if (!Number.isFinite(n)) {
      return '—'
    }
    const tenths = Math.round(Math.max(0, n) * 10) / 10
    if (Math.abs(tenths - Math.round(tenths)) < 0.05) {
      return Math.round(tenths) + '%'
    }
    return tenths.toFixed(1) + '%'
  }

  function formatBoardUnits(value) {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n)) {
      return '—'
    }
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
  }

  function isDollarBoard(board) {
    return Boolean(board && board.amount === 'usd')
  }

  function boardSelection(board) {
    if (isDollarBoard(board)) {
      let percent = board.totalPercent
      if (
        (percent === null || percent === undefined) &&
        board.used !== null &&
        board.used !== undefined &&
        board.limit
      ) {
        percent = (Number(board.used) / Number(board.limit)) * 100
      }
      return {
        filter: 'dollars',
        percent: percent,
        caption: session.t('stats.cyclePool'),
        rows: [],
        showUnits: board.used !== null && board.used !== undefined && board.limit,
      }
    }
    const filter = session.mtdSeriesFilter === 'other' || session.mtdSeriesFilter === 'all'
      ? session.mtdSeriesFilter
      : 'cursor'
    if (filter === 'other') {
      return {
        filter: filter,
        percent: board.apiPercent,
        caption: session.t('quotaBoard.api'),
        rows: [],
        showUnits: false,
      }
    }
    if (filter === 'all') {
      const rows = []
      if (board.autoPercent !== null && board.autoPercent !== undefined) {
        rows.push({ label: session.t('quotaBoard.auto'), percent: board.autoPercent })
      }
      if (board.apiPercent !== null && board.apiPercent !== undefined) {
        rows.push({ label: session.t('quotaBoard.api'), percent: board.apiPercent })
      }
      let percent = null
      if (rows.length > 0) {
        let sum = 0
        for (let i = 0; i < rows.length; i++) {
          sum += Number(rows[i].percent)
        }
        percent = sum / rows.length
      } else if (board.totalPercent !== null && board.totalPercent !== undefined) {
        percent = board.totalPercent
      } else if (board.used !== null && board.limit) {
        percent = (Number(board.used) / Number(board.limit)) * 100
      }
      const showUnits = board.used !== null && board.used !== undefined && board.limit
      return {
        filter: filter,
        percent: percent,
        caption: session.t('mtd.seriesAll'),
        rows: rows,
        showUnits: showUnits,
      }
    }
    return {
      filter: filter,
      percent: board.autoPercent,
      caption: session.t('quotaBoard.auto'),
      rows: [],
      showUnits: false,
    }
  }

  function quotaGauge(percent) {
    const svg = session.svgNode('svg', {
      class: 'quota-gauge',
      viewBox: '0 0 120 72',
      role: 'img',
    })
    const cx = 60
    const cy = 62
    const radius = 46
    function arc(value) {
      const clamped = Math.max(0.001, Math.min(100, Number(value) || 0))
      const angle = Math.PI * (1 - clamped / 100)
      const x = cx + radius * Math.cos(angle)
      const y = cy - radius * Math.sin(angle)
      return (
        'M ' +
        (cx - radius) +
        ' ' +
        cy +
        ' A ' +
        radius +
        ' ' +
        radius +
        ' 0 0 1 ' +
        x.toFixed(2) +
        ' ' +
        y.toFixed(2)
      )
    }
    svg.appendChild(
      session.svgNode('path', {
        class: 'quota-gauge-track',
        d: arc(100),
        fill: 'none',
      }),
    )
    svg.appendChild(
      session.svgNode('path', {
        class: 'quota-gauge-value',
        d: arc(percent),
        fill: 'none',
      }),
    )
    return svg
  }

  function quotaFact(label, value) {
    const row = session.el('div', 'quota-fact')
    const name = session.el('span', 'quota-fact-label')
    session.setText(name, label)
    const amount = session.el('span', 'quota-fact-value')
    session.setText(amount, value)
    row.appendChild(name)
    row.appendChild(amount)
    return row
  }

  function paintMtdFocus() {
    const view = activeMtdView(null)
    if (!view) {
      return
    }
    const meters = document.getElementById('mtdMeters')
    if (meters) {
      fillMtdMeters(meters, view.bars)
    }
    const body = document.getElementById('mtdBody')
    if (body) {
      session.setText(body, view.body || '')
      body.hidden = !view.body
    }
    const card = document.querySelector('.status-block.is-mtd')
    if (card) {
      card.classList.toggle(
        'is-over',
        view.overPace === true || view.verdict === 'over' || view.verdict === 'tight',
      )
    }
    const next = mtdMetricsStrip(view.metrics)
    const metrics = document.getElementById('mtdMetrics')
    if (next) {
      next.id = 'mtdMetrics'
    }
    if (metrics && next) {
      metrics.replaceWith(next)
      return
    }
    if (metrics && !next) {
      metrics.remove()
      return
    }
    if (next && card && card.parentNode) {
      card.parentNode.appendChild(next)
    }
  }

  function linesPayload() {
    const fromStats = lastStatsArgs && lastStatsArgs[4]
    if (fromStats && typeof fromStats === 'object') {
      return fromStats
    }
    if (
      session.codeLinesSummary ||
      (session.codeLinesSeries && session.codeLinesSeries.length > 0)
    ) {
      return {
        series: session.codeLinesSeries,
        summary: session.codeLinesSummary,
      }
    }
    return null
  }

  function inclusiveDayCount(from, to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return null
    }
    const start = new Date(from + 'T00:00:00')
    const end = new Date(to + 'T00:00:00')
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
      return null
    }
    return Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  }

  function formatDaySpan(from, to) {
    if (!from) {
      return session.t('quotaBoard.linesPeriod')
    }
    if (!to || from === to) {
      return session.formatFromDateLabel(from)
    }
    return session.formatFromDateLabel(from) + ' – ' + session.formatFromDateLabel(to)
  }

  function acceptedLinesModel() {
    const payload = linesPayload()
    const summary =
      payload && payload.summary && typeof payload.summary === 'object'
        ? payload.summary
        : null
    const series = payload && Array.isArray(payload.series) ? payload.series : []
    const todayKey = session.isoFromLocal(new Date())
    const bars = []
    let seriesSum = 0
    let today = null
    for (let i = 0; i < series.length; i++) {
      const point = series[i]
      if (!point || typeof point.date !== 'string') {
        continue
      }
      const date = point.date.slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        continue
      }
      const n = Number(point.ai)
      const value = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
      bars.push({ date: date, value: value })
      seriesSum += value
      if (date === todayKey) {
        today = value
      }
    }
    bars.sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    })
    const label = summary && typeof summary.rangeLabel === 'string' ? summary.rangeLabel : ''
    const dates = label.match(/\d{4}-\d{2}-\d{2}/g) || []
    const windowFrom =
      session.historyFromDate || dates[0] || (bars[0] && bars[0].date) || todayKey
    const windowTo = session.historyToDate || todayKey
    const todayInWindow = windowFrom <= todayKey && windowTo >= todayKey
    if (today === null && todayInWindow && bars.length > 0) {
      today = 0
      bars.push({ date: todayKey, value: 0 })
      bars.sort(function (a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0
      })
    }
    const chartFrom = bars.length > 0 ? bars[0].date : windowFrom
    const chartTo = bars.length > 0 ? bars[bars.length - 1].date : windowTo
    const clipped =
      summary && summary.dashboard === true && bars.length > 0 && windowFrom < chartFrom
    const spanFrom = clipped ? chartFrom : windowFrom
    const spanTo = clipped ? chartTo : windowTo
    const periodRaw =
      summary && Number.isFinite(Number(summary.allEdited))
        ? Number(summary.allEdited)
        : seriesSum
    const period = Math.max(0, Math.round(periodRaw))
    const hasData =
      bars.length > 0 || (summary && Number.isFinite(Number(summary.allEdited)))
    if (today === null && todayInWindow && hasData) {
      today = 0
    }
    if (!todayInWindow) {
      today = null
    }
    const dayCount = inclusiveDayCount(spanFrom, spanTo)
    const avg = hasData && dayCount && dayCount > 1 ? Math.round(period / dayCount) : null
    return {
      hasData: hasData,
      bars: bars,
      today: today,
      todayKey: todayKey,
      period: period,
      periodCaption: formatDaySpan(spanFrom, spanTo),
      avg: avg,
      analyticsNote: clipped === true,
    }
  }

  function linesHero(value, caption) {
    const col = session.el('div', 'quota-lines-hero')
    const hero = session.el('p', 'quota-hero')
    session.setText(hero, value)
    const cap = session.el('p', 'quota-caption')
    session.setText(cap, caption)
    col.appendChild(hero)
    col.appendChild(cap)
    return col
  }

  function linesSpark(bars, todayKey) {
    const wrap = session.el('div', 'quota-lines-chart-wrap')
    const svg = session.svgNode('svg', {
      class: 'quota-lines-chart',
      viewBox: '0 0 240 56',
      preserveAspectRatio: 'none',
      role: 'img',
      'aria-label': session.t('quotaBoard.linesAria'),
    })
    let max = 1
    for (let i = 0; i < bars.length; i++) {
      if (bars[i].value > max) {
        max = bars[i].value
      }
    }
    const gap = bars.length > 24 ? 1 : 2
    const slot = 240 / bars.length
    const barW = Math.max(1, slot - gap)
    const height = 56
    const rects = []
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i]
      const bh = bar.value <= 0 ? 1.5 : Math.max(2, (bar.value / max) * (height - 2))
      const rect = session.svgNode('rect', {
        class: bar.date === todayKey ? 'quota-lines-bar is-today' : 'quota-lines-bar',
        x: (i * slot + (slot - barW) / 2).toFixed(2),
        y: (height - bh).toFixed(2),
        width: barW.toFixed(2),
        height: bh.toFixed(2),
        rx: '1',
      })
      rects.push(rect)
      svg.appendChild(rect)
    }
    const tip = session.el('div', 'chart-tip quota-lines-tip')
    tip.hidden = true
    const tipTitle = session.el('p', 'chart-tip-title')
    const tipSub = session.el('p', 'chart-tip-sub')
    tip.appendChild(tipTitle)
    tip.appendChild(tipSub)
    let active = -1
    function mark(index) {
      for (let i = 0; i < rects.length; i++) {
        rects[i].classList.toggle('is-hover', i === index)
      }
    }
    function hideTip() {
      active = -1
      tip.hidden = true
      mark(-1)
    }
    function showTip(index, event) {
      if (index < 0 || index >= bars.length) {
        hideTip()
        return
      }
      const bar = bars[index]
      if (index !== active) {
        active = index
        const dateLabel = session.formatFromDateLabel(bar.date)
        session.setText(
          tipTitle,
          bar.date === todayKey
            ? dateLabel + ' · ' + session.t('quotaBoard.linesToday')
            : dateLabel,
        )
        session.setText(tipSub, formatBoardUnits(bar.value))
        mark(index)
      }
      tip.hidden = false
      const box = wrap.getBoundingClientRect()
      const tipW = tip.offsetWidth
      const tipH = tip.offsetHeight
      let left = event.clientX - box.left + 10
      let top = event.clientY - box.top - tipH - 8
      if (left + tipW > box.width - 4) {
        left = event.clientX - box.left - tipW - 10
      }
      if (top < 4) {
        top = event.clientY - box.top + 12
      }
      tip.style.setProperty('--chart-tip-x', Math.max(4, left) + 'px')
      tip.style.setProperty('--chart-tip-y', top + 'px')
    }
    svg.addEventListener('pointermove', function (event) {
      const box = svg.getBoundingClientRect()
      if (box.width <= 0) {
        return
      }
      const index = Math.min(
        bars.length - 1,
        Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * bars.length)),
      )
      showTip(index, event)
    })
    svg.addEventListener('pointerleave', hideTip)
    wrap.appendChild(svg)
    wrap.appendChild(tip)
    return wrap
  }

  function acceptedLinesCard(model) {
    const card = session.el('article', 'status-block quota-card')
    const title = session.el('h3', 'status-block-title')
    session.setText(title, session.t('quotaBoard.linesTitle'))
    card.appendChild(title)
    if (!model.hasData) {
      const empty = session.el('p', 'quota-caption')
      session.setText(empty, session.t('quotaBoard.linesEmpty'))
      card.appendChild(empty)
      const emptyLink = latestConversationLink()
      if (emptyLink) {
        card.appendChild(emptyLink)
      }
      return card
    }
    const heroes = session.el('div', 'quota-lines-heroes')
    heroes.appendChild(
      linesHero(
        model.today === null ? '—' : formatBoardUnits(model.today),
        session.t('quotaBoard.linesToday'),
      ),
    )
    heroes.appendChild(linesHero(formatBoardUnits(model.period), model.periodCaption))
    card.appendChild(heroes)
    if (model.bars.length > 0) {
      card.appendChild(linesSpark(model.bars, model.todayKey))
    }
    if (model.avg !== null) {
      const foot = session.el('p', 'quota-caption quota-lines-foot')
      session.setText(
        foot,
        session.t('quotaBoard.linesAvg', { n: formatBoardUnits(model.avg) }),
      )
      card.appendChild(foot)
    }
    if (model.analyticsNote) {
      const note = session.el('p', 'quota-caption quota-lines-foot')
      session.setText(note, session.t('quotaBoard.linesAnalytics'))
      card.appendChild(note)
    }
    const latestLink = latestConversationLink()
    if (latestLink) {
      card.appendChild(latestLink)
    }
    return card
  }

  function latestConversationLink() {
    if (!session.queriesView || !session.queriesView.latestConversation) {
      return null
    }
    const latest = session.queriesView.latestConversation()
    if (!latest || !latest.title) {
      return null
    }
    const button = session.el('button', 'quota-lines-link')
    button.type = 'button'
    const label = session.el('span', 'quota-lines-link-label')
    session.setText(label, session.t('quotaBoard.linesLatest'))
    const title = session.el('span', 'quota-lines-link-title')
    session.setText(title, latest.title)
    title.title = latest.title
    button.appendChild(label)
    button.appendChild(title)
    const meta = session.el('span', 'quota-lines-meta')
    if (latest.model) {
      const model = session.el('span', 'quota-lines-model')
      session.setText(model, latest.model)
      model.title = latest.model
      meta.appendChild(model)
    }
    const facts = session.el('span', 'quota-lines-facts')
    if (latest.tokens) {
      const tokens = session.el('span', 'quota-lines-fact is-' + (latest.tokenTone || 'ok'))
      session.setText(tokens, latest.tokens)
      if (latest.tokensFull) {
        tokens.title = latest.tokensFull
      }
      facts.appendChild(tokens)
    }
    if (latest.tokens && latest.context) {
      const dot = session.el('span', 'quota-lines-dot')
      session.setText(dot, '·')
      facts.appendChild(dot)
    }
    if (latest.context) {
      const context = session.el(
        'span',
        'quota-lines-fact is-' + (latest.contextTone || 'ok'),
      )
      session.setText(context, latest.context)
      facts.appendChild(context)
    }
    if (facts.childNodes.length > 0) {
      meta.appendChild(facts)
    }
    if (meta.childNodes.length > 0) {
      button.appendChild(meta)
    }
    button.addEventListener('click', function () {
      if (session.setView) {
        session.setView('queries')
      }
      if (session.queriesView && session.queriesView.revealLatest) {
        session.queriesView.revealLatest()
      }
    })
    return button
  }

  function limitAmount(board, value) {
    if (isDollarBoard(board)) {
      return session.compactCost(value)
    }
    return formatBoardUnits(value) + ' ' + session.t('quotaBoard.units')
  }

  function limitCard(board) {
    const selection = boardSelection(board)
    const dollars = isDollarBoard(board)
    const percent = Number(selection.percent)
    const percentText = formatBoardPercent(selection.percent)
    const card = session.el('article', 'status-block quota-card')
    const head = session.el('div', 'quota-card-head')
    const title = session.el('h3', 'status-block-title')
    session.setText(title, session.t('quotaBoard.quota'))
    head.appendChild(title)
    if (!dollars) {
      head.appendChild(session.mtdSeriesToggle())
    }
    card.appendChild(head)
    const gaugeWrap = session.el('div', 'quota-gauge-wrap')
    gaugeWrap.appendChild(quotaGauge(Number.isFinite(percent) ? percent : 0))
    const gaugeValue = session.el('p', 'quota-gauge-label')
    session.setText(gaugeValue, percentText)
    const gaugeHint = session.el('span', 'quota-caption')
    session.setText(gaugeHint, selection.caption)
    gaugeValue.appendChild(gaugeHint)
    gaugeWrap.appendChild(gaugeValue)
    card.appendChild(gaugeWrap)
    const side = session.el('div', 'quota-facts')
    if (selection.showUnits) {
      const usedText = dollars
        ? session.compactCost(board.used) + ' / ' + session.compactCost(board.limit)
        : formatBoardUnits(board.used) +
          ' / ' +
          formatBoardUnits(board.limit) +
          ' ' +
          session.t('quotaBoard.units')
      side.appendChild(quotaFact(session.t('quotaBoard.used'), usedText))
    }
    if (
      (selection.filter === 'all' || selection.filter === 'dollars') &&
      board.remaining !== null &&
      board.remaining !== undefined
    ) {
      side.appendChild(
        quotaFact(session.t('quotaBoard.remaining'), limitAmount(board, board.remaining)),
      )
    }
    if (board.onDemandEnabled !== null && board.onDemandEnabled !== undefined) {
      side.appendChild(
        quotaFact(
          session.t('quotaBoard.onDemand'),
          session.t(board.onDemandEnabled ? 'quotaBoard.on' : 'quotaBoard.off'),
        ),
      )
    }
    if (board.onDemandCapUsd !== null && board.onDemandCapUsd !== undefined) {
      side.appendChild(
        quotaFact(
          session.t('quotaBoard.cap'),
          session.compactCost(board.onDemandCapUsd),
        ),
      )
      const hint = session.el('p', 'quota-caption')
      session.setText(hint, session.t('quotaBoard.capHint'))
      side.appendChild(hint)
    }
    if (side.childNodes.length > 0) {
      card.appendChild(side)
    }
    return card
  }

  function paintQuotaBoard() {
    const host = document.getElementById('quotaBoard')
    if (!host) {
      return
    }
    host.replaceChildren()
    const board = session.quotaBoard
    const lines = acceptedLinesModel()
    if (!board && !lines.hasData) {
      host.hidden = true
      return
    }
    host.hidden = false
    host.appendChild(acceptedLinesCard(lines))
    if (board) {
      host.appendChild(limitCard(board))
    }
  }

  function renderStats(stats, mtd, burnRate, warnOn, codeLines, spendMix) {
    lastStatsArgs = [stats, mtd, burnRate, warnOn, codeLines, spendMix]
    const scrolling = document.scrollingElement || document.documentElement
    const scrollTop = scrolling ? scrolling.scrollTop : 0
    session.codeLinesInfoRebuilding = true
    try {
    while (statsEl.firstChild) {
      statsEl.removeChild(statsEl.firstChild)
    }

    if (session.querySource === 'openai-api') {
      renderOpenaiEmptyStats()
      if (scrolling) {
        scrolling.scrollTop = scrollTop
      }
      return
    }
    if (session.querySource === 'codex-local') {
      renderCodexStats(session.codexStats)
      if (scrolling) {
        scrolling.scrollTop = scrollTop
      }
      return
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

    const quotaHost = session.el('div', 'quota-board')
    quotaHost.id = 'quotaBoard'
    statsEl.appendChild(quotaHost)
    paintQuotaBoard()

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
    const mix = renderSpendMix(session, spendMix)
    if (mix) {
      layout.appendChild(mix)
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


  window.addEventListener('message', function (event) {
    const data = event && event.data
    if (!data || typeof data.type !== 'string') {
      return
    }
    if (data.type === 'codex.status') {
      session.codexHostStatus = data
      if (session.querySource === 'codex-local' && lastStatsArgs) {
        renderStats.apply(null, lastStatsArgs)
      } else if (session.querySource === 'codex-local') {
        renderCodexStats(session.codexStats)
      }
    }
    if (data.type === 'codex.result' && data.stats) {
      session.codexStats = data.stats
      if (session.querySource === 'codex-local' && lastStatsArgs) {
        renderStats.apply(null, lastStatsArgs)
      } else if (session.querySource === 'codex-local') {
        renderCodexStats(session.codexStats)
      }
    }
    if (data.type === 'openai.status') {
      session.codexStats = null
      session.openaiUsage = data.usage || null
      if (session.querySource === 'openai-api') {
        renderOpenaiEmptyStats()
      }
    }
  })

  return {
    render: renderStats,
    paintQuotaBoard: paintQuotaBoard,
    paintMtdFocus: paintMtdFocus,
    renderPeriods: renderPeriodCards,
    applyMtd: applyMtdPayload,
    meterRow,
    get args() {
      return lastStatsArgs
    },
  }
}
