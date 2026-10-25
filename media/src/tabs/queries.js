/** Queries list. Edit here; media/history.js is generated. */
import { messageType } from '../messages.js'

export function createQueriesView(session) {
  const rowsEl = document.getElementById('rows')
  const emptyEl = document.getElementById('empty')
  const filterSpikesOnlyEl = document.getElementById('filterSpikesOnly')
  const filterOptimizedOnlyEl = document.getElementById('filterOptimizedOnly')
  const groupByConversationEl = document.getElementById('groupByConversation')
  const groupQueriesSettingEl = document.getElementById('groupQueriesByConversation')
  const showCliThreadsEl = document.getElementById('showCliThreads')
  const showCliThreadsSettingEl = document.getElementById('showCliThreadsSetting')
  const codexShowCliThreadsEl = document.getElementById('codexShowCliThreads')
  const groupTitlesHintEl = document.getElementById('groupTitlesHint')

  let tableEvents = []
  let tableWarnOn = true
  let tableBurnLevel = 'ok'
  let spikesOnly = false
  let optimizedOnly = false
  let tableGroups = []
  let groupByConversation = false
  let showCliThreads = true
  /** Expanded conversation keys. Session-only; a refresh keeps keys that still exist. */
  const expandedGroups = Object.create(null)
  /** Open request detail. One row; survives a table rebuild on refresh. */
  let openQueryKey = ''
  let openQueryRestored = false

  function rowIsSpike(row, warnOn) {
    if (!warnOn || !row) {
      return false
    }
    if (row.spike === true) {
      return true
    }
    return typeof row.tokens === 'string' && row.tokens.indexOf('!') !== -1
  }

  function syncSpikesFilterUi() {
    if (!filterSpikesOnlyEl) {
      return
    }
    filterSpikesOnlyEl.checked = spikesOnly
    filterSpikesOnlyEl.setAttribute('aria-checked', spikesOnly ? 'true' : 'false')
  }

  function syncOptimizedFilterUi() {
    if (!filterOptimizedOnlyEl) {
      return
    }
    filterOptimizedOnlyEl.checked = optimizedOnly
    filterOptimizedOnlyEl.setAttribute(
      'aria-checked',
      optimizedOnly ? 'true' : 'false',
    )
  }

  function rowIsOptimized(row) {
    return !!(row && row.optimized === true)
  }

  function rowIsCli(row) {
    if (!row) {
      return false
    }
    if (row.cli === true) {
      return true
    }
    const id = typeof row.conversationId === 'string' ? row.conversationId.trim() : ''
    const title =
      typeof row.conversationTitle === 'string' ? row.conversationTitle.trim() : ''
    if (id === '') {
      return false
    }
    if (title === '') {
      return true
    }
    if (!title.startsWith('#')) {
      return false
    }
    const body = title.slice(1)
    return body.length > 0 && (id === body || id.startsWith(body))
  }

  function rowPassesFilters(row, warnOn) {
    if (!showCliThreads && rowIsCli(row)) {
      return false
    }
    if (optimizedOnly && !rowIsOptimized(row)) {
      return false
    }
    return !(spikesOnly && !rowIsSpike(row, warnOn))
  }

  function visibleRows(events, warnOn) {
    const list = events || []
    const out = []
    for (let i = 0; i < list.length; i++) {
      const row = list[i]
      if (!rowPassesFilters(row, warnOn)) {
        continue
      }
      out.push(row)
    }
    return out
  }

  function syncGroupSwitchUi() {
    if (groupByConversationEl) {
      groupByConversationEl.checked = groupByConversation
      groupByConversationEl.setAttribute(
        'aria-checked',
        groupByConversation ? 'true' : 'false',
      )
    }
    if (
      groupQueriesSettingEl &&
      document.activeElement !== groupQueriesSettingEl
    ) {
      groupQueriesSettingEl.checked = groupByConversation
    }
  }

  function syncCliSwitchUi() {
    if (showCliThreadsEl) {
      showCliThreadsEl.checked = showCliThreads
      showCliThreadsEl.setAttribute('aria-checked', showCliThreads ? 'true' : 'false')
    }
    if (
      showCliThreadsSettingEl &&
      document.activeElement !== showCliThreadsSettingEl
    ) {
      showCliThreadsSettingEl.checked = showCliThreads
    }
    if (codexShowCliThreadsEl && document.activeElement !== codexShowCliThreadsEl) {
      codexShowCliThreadsEl.checked = showCliThreads
      codexShowCliThreadsEl.setAttribute(
        'aria-checked',
        showCliThreads ? 'true' : 'false',
      )
    }
  }

  function submitShowCliThreads(value) {
    showCliThreads = value === true
    syncCliSwitchUi()
    paintRows(tableEvents, tableWarnOn)
    if (querySource === 'codex-local') {
      paintCodexTable(codexRows, false)
    }
    session.vscode.postMessage({
      type: messageType.setShowCliThreads,
      value: showCliThreads,
    })
  }

  function submitGroupByConversation(value) {
    groupByConversation = value === true
    syncGroupSwitchUi()
    paintRows(tableEvents, tableWarnOn)
    session.vscode.postMessage({
      type: messageType.setGroupQueriesByConversation,
      value: groupByConversation,
    })
  }

  function emptyRowsMessage() {
    if (optimizedOnly && spikesOnly) {
      return session.t('queries.emptyOptimizedSpikes')
    }
    if (optimizedOnly) {
      return session.t('queries.emptyOptimized')
    }
    if (spikesOnly) {
      return session.t('queries.emptySpikes')
    }
    return session.t('queries.empty')
  }

  function playIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('width', '12')
    svg.setAttribute('height', '12')
    svg.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', 'M6.2 3.2v9.6L13.2 8 6.2 3.2z')
    path.setAttribute('fill', 'currentColor')
    svg.appendChild(path)
    return svg
  }

  function repeatIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '3 3 18 18')
    svg.setAttribute('width', '12')
    svg.setAttribute('height', '12')
    svg.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute(
      'd',
      'M17.65 6.35A7.96 7.96 0 0 0 12 4C7.58 4 4.01 7.58 4.01 12S7.57 20 12 20c3.73 0 6.84-2.55 7.73-6h-2.08A6 6 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
    )
    path.setAttribute('fill', 'currentColor')
    svg.appendChild(path)
    return svg
  }

  function openConversationIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('width', '12')
    svg.setAttribute('height', '12')
    svg.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute(
      'd',
      'M3.2 3.4h9.6v6.2H8.4L5.6 12.2V9.6H3.2V3.4z',
    )
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', 'currentColor')
    path.setAttribute('stroke-width', '1.3')
    path.setAttribute('stroke-linejoin', 'round')
    svg.appendChild(path)
    return svg
  }

  function appendOptimizeAction(wrap, options) {
    const rerun = options && options.rerun === true
    const button = session.el('button', rerun ? 'token-rerun' : 'token-play')
    button.type = 'button'
    const labelText = session.t(rerun ? 'sessions.rerun' : 'sessions.optimize')
    button.title = labelText
    button.setAttribute('aria-label', labelText)
    button.setAttribute('aria-haspopup', 'menu')
    button.setAttribute('aria-expanded', 'false')
    const conversationId =
      options && typeof options.conversationId === 'string'
        ? options.conversationId
        : ''
    if (conversationId) {
      button.setAttribute('data-optimize-conversation', conversationId)
    }
    if (
      options &&
      typeof options.timestamp === 'number' &&
      Number.isFinite(options.timestamp)
    ) {
      button.setAttribute('data-optimize-timestamp', String(options.timestamp))
    }
    button.appendChild(rerun ? repeatIcon() : playIcon())
    wrap.appendChild(button)
  }

  let depthMenuEl = null
  let depthMenuAnchor = null
  let depthMenuOutsideBound = false

  function closeDepthMenu() {
    if (depthMenuEl && depthMenuEl.parentNode) {
      depthMenuEl.parentNode.removeChild(depthMenuEl)
    }
    depthMenuEl = null
    if (depthMenuAnchor) {
      depthMenuAnchor.setAttribute('aria-expanded', 'false')
    }
    depthMenuAnchor = null
    if (depthMenuOutsideBound) {
      document.removeEventListener('mousedown', onDepthMenuOutside, true)
      document.removeEventListener('keydown', onDepthMenuKeydown, true)
      depthMenuOutsideBound = false
    }
  }

  function onDepthMenuOutside(event) {
    const target = event.target
    if (!depthMenuEl) {
      return
    }
    if (depthMenuEl.contains(target)) {
      return
    }
    if (depthMenuAnchor && depthMenuAnchor.contains(target)) {
      return
    }
    closeDepthMenu()
  }

  function onDepthMenuKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeDepthMenu()
    }
  }

  function postOptimizeConversation(button, depth) {
    const id = button.getAttribute('data-optimize-conversation') || ''
    const rawTs = button.getAttribute('data-optimize-timestamp')
    const timestamp = rawTs === null ? null : Number(rawTs)
    session.vscode.postMessage({
      type: messageType.optimizeConversation,
      id: id,
      timestamp: Number.isFinite(timestamp) ? timestamp : null,
      depth: depth,
    })
  }

  function depthAnchorKey(button) {
    if (!button) {
      return ''
    }
    return (
      (button.getAttribute('data-optimize-conversation') || '') +
      '\u0001' +
      (button.getAttribute('data-optimize-timestamp') || '')
    )
  }

  function positionDepthMenu(button, menu) {
    const rect = button.getBoundingClientRect()
    const menuWidth = menu.offsetWidth || 160
    let left = rect.right - menuWidth
    if (left < 8) {
      left = 8
    }
    let top = rect.bottom + 4
    const menuHeight = menu.offsetHeight || 120
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - 4)
    }
    menu.style.left = Math.round(left) + 'px'
    menu.style.top = Math.round(top) + 'px'
  }

  function repositionDepthMenu() {
    if (!depthMenuEl || !depthMenuAnchor || !rowsEl) {
      return
    }
    const key = depthAnchorKey(depthMenuAnchor)
    const buttons = rowsEl.querySelectorAll('.token-play, .token-rerun')
    let next = null
    for (let i = 0; i < buttons.length; i++) {
      if (depthAnchorKey(buttons[i]) === key) {
        next = buttons[i]
        break
      }
    }
    if (!next || next.getBoundingClientRect().width === 0) {
      return
    }
    if (depthMenuAnchor !== next) {
      depthMenuAnchor.setAttribute('aria-expanded', 'false')
      depthMenuAnchor = next
      next.setAttribute('aria-expanded', 'true')
    }
    positionDepthMenu(next, depthMenuEl)
  }

  function openDepthMenu(button) {
    if (depthMenuAnchor === button && depthMenuEl) {
      closeDepthMenu()
      return
    }
    closeDepthMenu()
    const menu = session.el('div', 'token-depth-menu')
    menu.setAttribute('role', 'menu')
    menu.setAttribute('aria-label', session.t('sessions.pickDepth'))
    const depths = ['quick', 'balanced', 'deep']
    for (let i = 0; i < depths.length; i++) {
      const depth = depths[i]
      const item = session.el('button', 'token-depth-item')
      if (depth === 'quick') {
        item.classList.add('is-quick')
      } else if (depth === 'deep') {
        item.classList.add('is-deep')
      } else {
        item.classList.add('is-balanced')
      }
      item.type = 'button'
      item.setAttribute('role', 'menuitem')
      item.setAttribute('data-depth', depth)
      const label = session.el('span', 'token-depth-label')
      session.setText(label, session.depthLabel(depth))
      item.appendChild(label)
      if (depth === session.optimizeDepth) {
        item.classList.add('is-default')
        const badge = session.el('span', 'token-depth-default')
        session.setText(badge, session.t('optimize.default'))
        item.appendChild(badge)
      }
      item.addEventListener('click', function (event) {
        event.preventDefault()
        event.stopPropagation()
        closeDepthMenu()
        postOptimizeConversation(button, depth)
      })
      menu.appendChild(item)
    }
    document.body.appendChild(menu)
    depthMenuEl = menu
    depthMenuAnchor = button
    button.setAttribute('aria-expanded', 'true')
    positionDepthMenu(button, menu)
    if (!depthMenuOutsideBound) {
      document.addEventListener('mousedown', onDepthMenuOutside, true)
      document.addEventListener('keydown', onDepthMenuKeydown, true)
      depthMenuOutsideBound = true
    }
  }

  function addTokensCell(tr, row, spike) {
    const td = document.createElement('td')
    td.className = spike ? 'tokens-col tokens-spike' : 'tokens-col'
    const wrap = session.el('span', 'tokens-cell')
    const label = session.el('span', 'tokens-value')
    session.setText(label, row && row.tokens ? row.tokens : '')
    wrap.appendChild(label)
    const conversationId =
      row && typeof row.conversationId === 'string' ? row.conversationId : ''
    const timestamp =
      row && typeof row.timestamp === 'number' && Number.isFinite(row.timestamp)
        ? row.timestamp
        : null
    if (row && row.optimized === true && (conversationId || timestamp !== null)) {
      appendOptimizeAction(wrap, {
        rerun: true,
        conversationId: conversationId,
        timestamp: timestamp,
      })
    } else if (spike) {
      appendOptimizeAction(wrap, {
        rerun: false,
        conversationId: conversationId,
        timestamp: timestamp,
      })
    }
    td.appendChild(wrap)
    tr.appendChild(td)
  }

  function formatListPriceAmount(n) {
    return session.compactCost(n)
  }

  function appendListPricePart(parent, usd, key, tone) {
    if (typeof usd !== 'number' || !Number.isFinite(usd) || usd < 0.005) {
      return false
    }
    if (parent.childNodes.length > 0) {
      parent.appendChild(document.createTextNode(' · '))
    }
    const chip = session.el('span', 'query-price-part is-' + tone)
    session.setText(chip, session.t(key, { amount: formatListPriceAmount(usd) }))
    parent.appendChild(chip)
    return true
  }

  function fillConversationDetail(wrap, row) {
    const line = session.el('p', 'query-detail-conversation')
    const label = session.el('span', 'query-price-label')
    session.setText(label, session.t('queries.conversation'))
    line.appendChild(label)
    line.appendChild(document.createTextNode(' · '))
    const value = session.el('span', 'query-conversation-title')
    const title =
      row && typeof row.conversationTitle === 'string'
        ? row.conversationTitle.trim()
        : ''
    const conversationId =
      row && typeof row.conversationId === 'string' ? row.conversationId.trim() : ''
    if (title) {
      session.setText(value, title)
    } else if (conversationId) {
      session.setText(value, session.t('queries.conversationUntitled'))
      value.classList.add('is-muted')
    } else {
      session.setText(value, session.t('queries.conversationMissing'))
      value.classList.add('is-muted')
    }
    line.appendChild(value)
    wrap.appendChild(line)
  }

  function fillListPriceDetail(wrap, row) {
    const split = row && row.listPrice
    const line = session.el('p', 'query-detail-line')
    const billed = session.el('p', 'query-detail-billed')
    if (split === null || split === undefined) {
      session.setText(line, session.t('queries.listPriceUnavailable'))
      wrap.appendChild(line)
      return
    }
    const label = session.el('span', 'query-price-label')
    session.setText(label, session.t('queries.listPrice'))
    line.appendChild(label)
    const parts = session.el('span', 'query-price-parts')
    let count = 0
    if (appendListPricePart(parts, split.inputUsd, 'queries.listPriceInput', 'input')) {
      count += 1
    }
    if (appendListPricePart(parts, split.outputUsd, 'queries.listPriceOutput', 'output')) {
      count += 1
    }
    if (
      appendListPricePart(
        parts,
        split.cacheWriteUsd,
        'queries.listPriceCacheWrite',
        'cache-write',
      )
    ) {
      count += 1
    }
    if (
      appendListPricePart(
        parts,
        split.cacheReadUsd,
        'queries.listPriceCacheRead',
        'cache-read',
      )
    ) {
      count += 1
    }
    if (count === 0) {
      session.setText(line, session.t('queries.listPriceNone'))
      wrap.appendChild(line)
      return
    }
    line.appendChild(document.createTextNode(' · '))
    line.appendChild(parts)
    const share = split.pricedTokenShare
    if (
      typeof share === 'number' &&
      Number.isFinite(share) &&
      share < 1 &&
      share > 0
    ) {
      line.appendChild(document.createTextNode(' · '))
      const shareEl = session.el('span', 'query-price-share')
      session.setText(
        shareEl,
        session.t('queries.listPriceShare', {
          percent: String(Math.round(share * 100)),
        }),
      )
      line.appendChild(shareEl)
    }
    wrap.appendChild(line)
    session.setText(
      billed,
      session.t('queries.listPriceBilled', {
        amount: row && row.cost ? row.cost : '—',
      }),
    )
    wrap.appendChild(billed)
  }

  function closeOpenQueryRows(exceptTr) {
    const open = rowsEl.querySelectorAll('tr.query-row.is-open')
    for (let i = 0; i < open.length; i++) {
      const tr = open[i]
      if (exceptTr && tr === exceptTr) {
        continue
      }
      tr.classList.remove('is-open')
      tr.setAttribute('aria-expanded', 'false')
      const detail = tr.nextElementSibling
      if (detail && detail.classList.contains('query-detail')) {
        detail.hidden = true
      }
    }
  }

  function queryRowKey(row) {
    if (!row || typeof row.timestamp !== 'number' || !Number.isFinite(row.timestamp)) {
      return ''
    }
    return [
      String(row.timestamp),
      typeof row.conversationId === 'string' ? row.conversationId : '',
      row.model || '',
      row.cost || '',
      row.inputOutput || '',
      row.kind || '',
    ].join('\u0001')
  }

  function toggleQueryRow(tr) {
    if (!tr || !tr.classList.contains('query-row')) {
      return
    }
    const willOpen = !tr.classList.contains('is-open')
    closeOpenQueryRows(willOpen ? null : tr)
    const detail = tr.nextElementSibling
    if (!detail || !detail.classList.contains('query-detail')) {
      return
    }
    if (willOpen) {
      tr.classList.add('is-open')
      tr.setAttribute('aria-expanded', 'true')
      detail.hidden = false
      openQueryKey = tr.getAttribute('data-query-key') || ''
    } else {
      tr.classList.remove('is-open')
      tr.setAttribute('aria-expanded', 'false')
      detail.hidden = true
      openQueryKey = ''
    }
  }

  function contextArrow(level) {
    const arrow = session.el('span', 'context-arrow is-' + level)
    arrow.setAttribute('aria-hidden', 'true')
    return arrow
  }

  function contextShare(fill) {
    const n = Number(fill && fill.percent)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return null
    }
    return Math.round(n)
  }

  function contextTip(fill) {
    const percent = contextShare(fill)
    if (!fill || fill.level === 'unknown' || percent === null) {
      return session.t('queries.contextUnknown', {
        model: fill && fill.model ? fill.model : '—',
      })
    }
    return session.t(
      fill.level === 'full' ? 'queries.contextFull' : 'queries.contextOk',
      {
        percent: String(percent),
        window: fill.windowLabel || '',
        model: fill.model || '—',
      },
    )
  }

  function appendContextCell(tr, fill, conversationId) {
    const td = document.createElement('td')
    td.className = 'context-col'
    const percent = contextShare(fill)
    const level =
      percent === null
        ? 'unknown'
        : fill && fill.level === 'full'
          ? 'full'
          : 'ok'
    const tip = contextTip(fill)
    const id = typeof conversationId === 'string' ? conversationId : ''
    if (level === 'unknown') {
      const empty = session.el('span', 'context-state is-unknown')
      empty.title = tip
      session.setText(empty, '—')
      td.appendChild(empty)
      tr.appendChild(td)
      return
    }
    const body = session.el('span', 'context-state is-' + level)
    const label = session.el('span', 'context-percent')
    session.setText(label, String(percent) + '%')
    body.appendChild(label)
    body.appendChild(contextArrow(level))
    if (level === 'full' && id) {
      const button = session.el('button', 'context-hit is-full')
      button.type = 'button'
      button.title = tip
      button.setAttribute('aria-label', tip)
      button.setAttribute('data-summarize-conversation', id)
      button.appendChild(body)
      td.appendChild(button)
    } else {
      body.title = tip
      td.appendChild(body)
    }
    tr.appendChild(td)
  }

  function addTimeCell(tr, text) {
    const td = document.createElement('td')
    td.className = 'query-time'
    const wrap = session.el('span', 'query-time-cell')
    const chevron = session.el('span', 'query-expand')
    chevron.setAttribute('aria-hidden', 'true')
    wrap.appendChild(chevron)
    const label = session.el('span', 'query-time-value')
    session.setText(label, text || '')
    if (text) {
      label.title = text
    }
    wrap.appendChild(label)
    td.appendChild(wrap)
    tr.appendChild(td)
  }

  function appendQueryRow(row, warnOn, child) {
    const key = queryRowKey(row)
    const open = !openQueryRestored && key !== '' && key === openQueryKey
    if (open) {
      openQueryRestored = true
    }
    const tr = document.createElement('tr')
    tr.className = child ? 'query-row is-child' : 'query-row'
    if (open) {
      tr.classList.add('is-open')
    }
    tr.tabIndex = 0
    tr.title = session.t('queries.listPriceExpand')
    tr.setAttribute('aria-expanded', open ? 'true' : 'false')
    tr.setAttribute('data-query-key', key)
    const optimized = rowIsOptimized(row)
    const burnRow =
      !optimized &&
      warnOn &&
      (tableBurnLevel === 'warning' || tableBurnLevel === 'critical') &&
      row.inBurnWindow === true
    if (burnRow) {
      tr.classList.add('row-burn')
    }
    if (optimized) {
      tr.classList.add('is-optimized')
    }
    addTimeCell(tr, row.time)
    appendModelCell(tr, row.model)
    appendContextCell(tr, row.context, row.conversationId)
    session.addCell(tr, row.cost, burnRow ? 'cost-burn' : undefined)
    addTokensCell(tr, row, !optimized && rowIsSpike(row, warnOn))
    session.addCell(tr, row.inputOutput)
    session.addCell(tr, row.kind)
    rowsEl.appendChild(tr)

    const detail = document.createElement('tr')
    detail.className = child ? 'query-detail is-child' : 'query-detail'
    detail.hidden = !open
    const td = document.createElement('td')
    td.colSpan = 7
    const wrap = session.el('div', 'query-detail-body')
    fillConversationDetail(wrap, row)
    fillListPriceDetail(wrap, row)
    td.appendChild(wrap)
    detail.appendChild(td)
    rowsEl.appendChild(detail)
  }

  function groupChildren(group, events, warnOn) {
    const indexes = group && Array.isArray(group.rowIndexes) ? group.rowIndexes : []
    const out = []
    for (let i = 0; i < indexes.length; i++) {
      const row = events[indexes[i]]
      if (!row || !rowPassesFilters(row, warnOn)) {
        continue
      }
      out.push(row)
    }
    return out
  }

  function groupCountLabel(group, shown) {
    const total =
      group && typeof group.queryCount === 'number' ? group.queryCount : shown
    if (shown !== total) {
      return session.t('queries.groupRequestsFiltered', {
        shown: String(shown),
        count: String(total),
      })
    }
    if (total === 1) {
      return session.t('queries.groupRequestsOne')
    }
    return session.t('queries.groupRequests', { count: String(total) })
  }

  function groupOptimizeId(group) {
    if (group && typeof group.optimizeId === 'string' && group.optimizeId) {
      return group.optimizeId
    }
    if (group && Array.isArray(group.ids)) {
      for (let i = 0; i < group.ids.length; i++) {
        const id = group.ids[i]
        if (typeof id === 'string' && id) {
          return id
        }
      }
    }
    return ''
  }

  function addGroupTokensCell(tr, group, spike) {
    const td = document.createElement('td')
    td.className = spike ? 'tokens-col tokens-spike' : 'tokens-col'
    const wrap = session.el('span', 'tokens-cell')
    const label = session.el('span', 'tokens-value')
    session.setText(label, group.tokens || '')
    wrap.appendChild(label)
    const optimizeId = groupOptimizeId(group)
    // Spike / optimized group rows always get play when a conversation id exists
    // (including merged-title rows — host briefs the dearest id).
    if (optimizeId) {
      if (group.optimized === true) {
        appendOptimizeAction(wrap, {
          rerun: true,
          conversationId: optimizeId,
          timestamp: group.optimizeTimestamp,
        })
      } else if (spike || group.spike === true) {
        appendOptimizeAction(wrap, {
          rerun: false,
          conversationId: optimizeId,
          timestamp: group.optimizeTimestamp,
        })
      }
    }
    td.appendChild(wrap)
    tr.appendChild(td)
  }

  function appendGroupRow(group, shown, warnOn) {
    const open = expandedGroups[group.key] === true
    const tr = document.createElement('tr')
    tr.className = open ? 'conversation-row is-open' : 'conversation-row'
    tr.tabIndex = 0
    tr.setAttribute('aria-label', session.t('queries.groupExpand'))
    tr.setAttribute('aria-expanded', open ? 'true' : 'false')
    tr.setAttribute('data-group-key', group.key)
    if (group.optimized === true) {
      tr.classList.add('is-optimized')
    }
    const td = document.createElement('td')
    td.className = 'query-time'
    const wrap = session.el('span', 'query-time-cell')
    const chevron = session.el('span', 'query-expand')
    chevron.title = session.t('queries.groupExpand')
    const tools = session.el('span', 'conversation-tools')
    tools.appendChild(chevron)
    const openId = groupOptimizeId(group)
    if (openId) {
      const openButton = session.el('button', 'conversation-open')
      openButton.type = 'button'
      const openLabel = session.t('queries.openConversation')
      openButton.title = openLabel
      openButton.setAttribute('aria-label', openLabel)
      openButton.setAttribute('data-open-conversation', openId)
      openButton.appendChild(openConversationIcon())
      tools.appendChild(openButton)
    }
    wrap.appendChild(tools)
    const stack = session.el('span', 'conversation-label')
    const title = session.el('span', 'conversation-title')
    const fullTitle = group.title || ''
    session.setText(title, fullTitle)
    if (fullTitle) {
      title.title = fullTitle
    }
    if (group.named !== true) {
      title.classList.add('is-muted')
    }
    stack.appendChild(title)
    const meta = session.el('span', 'conversation-meta')
    session.setText(meta, groupCountLabel(group, shown))
    stack.appendChild(meta)
    if (open && group.rangeLabel) {
      const range = session.el('span', 'conversation-range')
      session.setText(range, group.rangeLabel)
      stack.appendChild(range)
    }
    wrap.appendChild(stack)
    td.appendChild(wrap)
    tr.appendChild(td)
    appendModelCell(tr, group.model || '—')
    appendContextCell(tr, group.context, group.optimizeId || '')
    session.addCell(tr, group.cost || '')
    addGroupTokensCell(
      tr,
      group,
      warnOn && group.spike === true && group.optimized !== true,
    )
    session.addCell(tr, group.inputOutput || '')
    session.addCell(tr, group.kind || '—')
    rowsEl.appendChild(tr)
  }

  function paintGroupedRows(events, warnOn) {
    const list = events || []
    const groups = Array.isArray(tableGroups) ? tableGroups : []
    let painted = 0
    let named = 0
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]
      if (!showCliThreads && group.cli === true) {
        continue
      }
      const children = groupChildren(group, list, warnOn)
      if (children.length === 0) {
        continue
      }
      painted += 1
      if (group.named === true) {
        named += 1
      }
      appendGroupRow(group, children.length, warnOn)
      if (expandedGroups[group.key] !== true) {
        continue
      }
      for (let j = 0; j < children.length; j++) {
        appendQueryRow(children[j], warnOn, true)
      }
    }
    if (groupTitlesHintEl) {
      groupTitlesHintEl.hidden = painted === 0 || named > 0
    }
    if (painted === 0) {
      emptyEl.hidden = false
      session.setText(emptyEl, emptyRowsMessage())
      return
    }
    emptyEl.hidden = true
    session.setText(emptyEl, session.t('queries.empty'))
  }

  function paintRows(events, warnOn) {
    const scrolling = document.scrollingElement || document.documentElement
    const scrollTop = scrolling ? scrolling.scrollTop : 0
    const wrap = rowsEl.closest('.table-wrap')
    const wrapTop = wrap ? wrap.scrollTop : 0
    openQueryRestored = false
    while (rowsEl.firstChild) {
      rowsEl.removeChild(rowsEl.firstChild)
    }
    if (groupByConversation) {
      paintGroupedRows(events, warnOn)
    } else {
      if (groupTitlesHintEl) {
        groupTitlesHintEl.hidden = true
      }
      const list = visibleRows(events, warnOn)
      if (list.length === 0) {
        emptyEl.hidden = false
        session.setText(emptyEl, emptyRowsMessage())
      } else {
        emptyEl.hidden = true
        session.setText(emptyEl, session.t('queries.empty'))
        for (let i = 0; i < list.length; i++) {
          appendQueryRow(list[i], warnOn, false)
        }
      }
    }
    if (scrolling) {
      scrolling.scrollTop = scrollTop
    }
    if (wrap) {
      wrap.scrollTop = wrapTop
    }
    repositionDepthMenu()
  }

  function focusGroupRow(key) {
    const rows = rowsEl.querySelectorAll('tr.conversation-row')
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].getAttribute('data-group-key') === key) {
        rows[i].focus()
        return
      }
    }
  }

  function toggleGroupRow(tr) {
    const key = tr.getAttribute('data-group-key')
    if (!key) {
      return
    }
    if (expandedGroups[key] === true) {
      delete expandedGroups[key]
    } else {
      expandedGroups[key] = true
    }
    paintRows(tableEvents, tableWarnOn)
    focusGroupRow(key)
  }

  function pruneOpenQuery() {
    if (openQueryKey === '') {
      return
    }
    for (let i = 0; i < tableEvents.length; i++) {
      if (queryRowKey(tableEvents[i]) === openQueryKey) {
        return
      }
    }
    openQueryKey = ''
  }

  function pruneExpandedGroups() {
    const live = Object.create(null)
    for (let i = 0; i < tableGroups.length; i++) {
      const group = tableGroups[i]
      if (group && typeof group.key === 'string') {
        live[group.key] = true
      }
    }
    const keys = Object.keys(expandedGroups)
    for (let i = 0; i < keys.length; i++) {
      if (live[keys[i]] !== true) {
        delete expandedGroups[keys[i]]
      }
    }
  }



  function wire() {
    if (rowsEl) {
      rowsEl.addEventListener('click', function (event) {
        const target = event.target
        if (!target || typeof target.closest !== 'function') {
          return
        }
        const button = target.closest('.token-play, .token-rerun')
        if (button && rowsEl.contains(button)) {
          event.preventDefault()
          event.stopPropagation()
          openDepthMenu(button)
          return
        }
        const summaryButton = target.closest('.context-hit')
        if (summaryButton && rowsEl.contains(summaryButton)) {
          event.preventDefault()
          event.stopPropagation()
          const id = summaryButton.getAttribute('data-summarize-conversation') || ''
          if (id) {
            session.vscode.postMessage({
              type: messageType.summarizeConversation,
              id: id,
            })
          }
          return
        }
        const openButton = target.closest('.conversation-open')
        if (openButton && rowsEl.contains(openButton)) {
          event.preventDefault()
          event.stopPropagation()
          const id = openButton.getAttribute('data-open-conversation') || ''
          if (id) {
            session.vscode.postMessage({
              type: messageType.openConversation,
              id: id,
            })
          }
          return
        }
        const groupRow = target.closest('tr.conversation-row')
        if (groupRow && rowsEl.contains(groupRow)) {
          toggleGroupRow(groupRow)
          return
        }
        const row = target.closest('tr.query-row')
        if (!row || !rowsEl.contains(row)) {
          return
        }
        toggleQueryRow(row)
      })
      rowsEl.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') {
          return
        }
        const target = event.target
        if (!target || typeof target.closest !== 'function') {
          return
        }
        if (target.closest('.token-play, .token-rerun, .conversation-open, .context-hit')) {
          return
        }
        const groupRow = target.closest('tr.conversation-row')
        if (groupRow && rowsEl.contains(groupRow)) {
          event.preventDefault()
          toggleGroupRow(groupRow)
          return
        }
        const row = target.closest('tr.query-row')
        if (!row || !rowsEl.contains(row)) {
          return
        }
        event.preventDefault()
        toggleQueryRow(row)
      })
    }
    if (filterSpikesOnlyEl) {
      filterSpikesOnlyEl.addEventListener('change', function () {
        spikesOnly = filterSpikesOnlyEl.checked === true
        syncSpikesFilterUi()
        paintRows(tableEvents, tableWarnOn)
      })
    }
    if (filterOptimizedOnlyEl) {
      filterOptimizedOnlyEl.addEventListener('change', function () {
        optimizedOnly = filterOptimizedOnlyEl.checked === true
        syncOptimizedFilterUi()
        paintRows(tableEvents, tableWarnOn)
      })
    }
    if (groupByConversationEl) {
      groupByConversationEl.addEventListener('change', function () {
        submitGroupByConversation(groupByConversationEl.checked === true)
      })
    }
    if (groupQueriesSettingEl) {
      groupQueriesSettingEl.addEventListener('change', function () {
        submitGroupByConversation(groupQueriesSettingEl.checked === true)
      })
    }
    if (showCliThreadsEl) {
      showCliThreadsEl.addEventListener('change', function () {
        submitShowCliThreads(showCliThreadsEl.checked === true)
      })
    }
    if (showCliThreadsSettingEl) {
      showCliThreadsSettingEl.addEventListener('change', function () {
        submitShowCliThreads(showCliThreadsSettingEl.checked === true)
      })
    }
    if (codexShowCliThreadsEl) {
      codexShowCliThreadsEl.addEventListener('change', function () {
        submitShowCliThreads(codexShowCliThreadsEl.checked === true)
      })
    }
  }

  function apply(events, settings, warnOn) {
    tableEvents = events || []
    tableWarnOn = warnOn
    tableBurnLevel =
      settings.burnRate && settings.burnRate.level
        ? settings.burnRate.level
        : 'ok'
    tableGroups = Array.isArray(settings.queryGroups) ? settings.queryGroups : []
    if (typeof settings.groupQueriesByConversation === 'boolean') {
      groupByConversation = settings.groupQueriesByConversation
    }
    if (typeof settings.showCliThreads === 'boolean') {
      showCliThreads = settings.showCliThreads
    }
    pruneExpandedGroups()
    pruneOpenQuery()
    syncSpikesFilterUi()
    syncOptimizedFilterUi()
    syncGroupSwitchUi()
    syncCliSwitchUi()
    if (querySource === 'cursor') {
      paintRows(tableEvents, warnOn)
    }
  }

  // --- Codex / OpenAI source switch (phase 3c) ---
  let querySource = 'cursor'
  let filterRevision = 0
  let lastCorrelationId = ''
  let codexQueryInFlight = false
  let codexQueryPending = null
  let nextCursor = null
  let appendNextResult = false
  let codexRows = []
  let codexSpikesOnly = false
  let codexOptimizedOnly = false
  let codexGroupBy = true
  let codexDayFocus = ''
  let appliedRangeKey = ''
  let coverageDismissed = false
  let lastCodexStatus = null
  let drawerFields = null
  const expandedCodex = Object.create(null)
  session.querySource = querySource

  const sourceSwitchEl = document.getElementById('sourceSwitch')
  const sourceCursorEl = document.getElementById('sourceCursor')
  const sourceCodexEl = document.getElementById('sourceCodex')
  const sourceOpenaiEl = document.getElementById('sourceOpenai')
  const coverageEl = document.getElementById('codexCoverage')
  const openaiEmptyEl = document.getElementById('openaiEmpty')
  const openaiModeWebEl = document.getElementById('openaiModeWeb')
  const openaiModeLocalEl = document.getElementById('openaiModeLocal')
  const openaiConnectHintEl = document.getElementById('openaiConnectHint')
  const openaiConnectBtn = document.getElementById('openaiConnectBtn')
  const openaiOpenKeysBtn = document.getElementById('openaiOpenKeysBtn')
  const openaiDisconnectBtn = document.getElementById('openaiDisconnectBtn')
  const openaiConnectStatusEl = document.getElementById('openaiConnectStatus')
  let openaiConnectMode = 'web'
  let lastOpenaiStatus = null
  const cursorChromeEl = document.getElementById('cursorQueriesChrome')
  const codexChromeEl = document.getElementById('codexQueriesChrome')
  const codexRowsEl = document.getElementById('codexRows')
  const codexEmptyEl = document.getElementById('codexEmpty')
  const codexLoadMoreEl = document.getElementById('codexLoadMore')
  const codexDrawerEl = document.getElementById('codexDrawer')
  const codexDrawerBodyEl = document.getElementById('codexDrawerBody')
  const codexFilterSpikesEl = document.getElementById('codexFilterSpikes')
  const codexFilterOptimizedEl = document.getElementById('codexFilterOptimized')
  const codexGroupByEl = document.getElementById('codexGroupBy')
  const codexExportEl = document.getElementById('codexExportCsv')
  const codexDatePresetEl = document.getElementById('codexDatePreset')
  const codexFromEl = document.getElementById('codexFromDate')
  const codexToEl = document.getElementById('codexToDate')
  const codexAccountEl = document.getElementById('codexAccount')
  const codexModelEl = document.getElementById('codexModel')
  const codexStatusEl = document.getElementById('codexStatus')
  const codexSortEl = document.getElementById('codexSort')
  const tabQueriesEl = document.getElementById('tabQueries')
  const tabSupportEl = document.getElementById('tabSupport')
  const tabSettingsEl = document.getElementById('tabSettings')

  function syncSourcePills() {
    const map = [
      [sourceCursorEl, 'cursor'],
      [sourceCodexEl, 'codex-local'],
      [sourceOpenaiEl, 'openai-api'],
    ]
    for (let i = 0; i < map.length; i++) {
      const el = map[i][0]
      const value = map[i][1]
      if (!el) {
        continue
      }
      const on = querySource === value
      el.classList.toggle('is-pressed', on)
      el.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
  }

  function updateTabLabel() {
    const limitEl = session.historyLimitEl
    session.applyHistoryTitle(limitEl ? limitEl.value : 1000)
  }

  function syncSourceVisibility() {
    const supportOn = tabSupportEl && tabSupportEl.classList.contains('is-active')
    const settingsOn =
      tabSettingsEl && tabSettingsEl.classList.contains('is-active')
    const hideChrome = !!(supportOn || settingsOn)
    if (sourceSwitchEl) {
      sourceSwitchEl.hidden = hideChrome
    }
    if (coverageEl && hideChrome) {
      coverageEl.hidden = true
    }
    if (openaiEmptyEl) {
      openaiEmptyEl.hidden =
        hideChrome || querySource !== 'openai-api'
      if (!openaiEmptyEl.hidden && lastOpenaiStatus) {
        paintOpenaiConnect(lastOpenaiStatus)
      }
    }
    if (cursorChromeEl) {
      cursorChromeEl.hidden = querySource !== 'cursor'
    }
    if (codexChromeEl) {
      codexChromeEl.hidden = querySource !== 'codex-local'
    }
    if (!hideChrome && querySource === 'codex-local' && lastCodexStatus) {
      paintCoverage(lastCodexStatus)
    } else if (!hideChrome && querySource !== 'codex-local' && coverageEl) {
      coverageEl.hidden = true
    }
    syncSourcePills()
    updateTabLabel()
  }

  function setQuerySource(value, post) {
    if (value !== 'cursor' && value !== 'codex-local' && value !== 'openai-api') {
      return
    }
    const changed = value !== querySource
    querySource = value
    session.querySource = value
    const sourceSetting = document.getElementById('querySourceSetting')
    if (sourceSetting && document.activeElement !== sourceSetting) {
      sourceSetting.value = value
    }
    syncSourceVisibility()
    if (post !== false && changed) {
      session.beginSourceWait()
    }
    if (post !== false) {
      session.vscode.postMessage({
        type: messageType.setQuerySource,
        value: querySource,
      })
    }
    if (querySource === 'cursor') {
      paintRows(tableEvents, tableWarnOn)
    }
    if (post !== false && querySource === 'codex-local') {
      requestCodexPage(null)
    }
  }

  function setOpenaiConnectMode(mode, post) {
    if (mode !== 'local' && mode !== 'web') {
      return
    }
    openaiConnectMode = mode
    if (openaiModeWebEl) {
      const on = mode === 'web'
      openaiModeWebEl.classList.toggle('is-pressed', on)
      openaiModeWebEl.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
    if (openaiModeLocalEl) {
      const on = mode === 'local'
      openaiModeLocalEl.classList.toggle('is-pressed', on)
      openaiModeLocalEl.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
    if (openaiConnectHintEl) {
      session.setText(
        openaiConnectHintEl,
        session.t(mode === 'web' ? 'source.openaiHintWeb' : 'source.openaiHintLocal'),
      )
    }
    if (openaiOpenKeysBtn) {
      openaiOpenKeysBtn.hidden = mode !== 'web'
    }
    if (post !== false) {
      session.vscode.postMessage({
        type: messageType['openai.setMode'],
        value: mode,
      })
    }
  }

  function paintOpenaiConnect(status) {
    lastOpenaiStatus = status && typeof status === 'object' ? status : null
    if (!openaiEmptyEl || !lastOpenaiStatus) {
      return
    }
    const mode =
      lastOpenaiStatus.mode === 'local' || lastOpenaiStatus.mode === 'web'
        ? lastOpenaiStatus.mode
        : openaiConnectMode
    setOpenaiConnectMode(mode, false)
    const connected = lastOpenaiStatus.state === 'connected'
    openaiEmptyEl.classList.toggle('is-connected', connected)
    if (openaiConnectBtn) {
      openaiConnectBtn.hidden = connected
    }
    if (openaiDisconnectBtn) {
      openaiDisconnectBtn.hidden = !connected
    }
    if (openaiOpenKeysBtn) {
      openaiOpenKeysBtn.hidden = mode !== 'web'
    }
    if (!openaiConnectStatusEl) {
      return
    }
    const detail =
      typeof lastOpenaiStatus.detail === 'string' && lastOpenaiStatus.detail.trim()
        ? lastOpenaiStatus.detail.trim()
        : ''
    let line = detail
    if (!line && connected) {
      line =
        mode === 'web'
          ? session.t('source.openaiConnectedWeb')
          : session.t('source.openaiConnectedLocal')
      if (mode === 'local' && lastOpenaiStatus.sinkPath) {
        line += ' · ' + String(lastOpenaiStatus.sinkPath)
      }
    }
    openaiConnectStatusEl.hidden = !line
    if (line) {
      session.setText(openaiConnectStatusEl, line)
    }
    paintOpenaiUsage(lastOpenaiStatus.usage)
  }

  function paintOpenaiUsage(usage) {
    if (!openaiEmptyEl) {
      return
    }
    let host = document.getElementById('openaiUsageSummary')
    if (!host) {
      host = session.el('div', 'stats-grid')
      host.id = 'openaiUsageSummary'
      openaiEmptyEl.appendChild(host)
    }
    while (host.firstChild) {
      host.removeChild(host.firstChild)
    }
    if (!usage) {
      host.hidden = true
      return
    }
    host.hidden = false
    if (usage.costUsd !== null && usage.costUsd !== undefined) {
      host.appendChild(openaiUsageCard(session.t('codex.statsCosts'), session.compactCost(usage.costUsd)))
    }
    host.appendChild(
      openaiUsageCard(session.t('codex.statsModelRequests'), String(usage.requests || 0)),
    )
    host.appendChild(
      openaiUsageCard(session.t('stats.input'), session.compactTokens(usage.inputTokens || 0)),
    )
    host.appendChild(
      openaiUsageCard(session.t('stats.output'), session.compactTokens(usage.outputTokens || 0)),
    )
    host.appendChild(
      openaiUsageCard(session.t('stats.cacheRead'), session.compactTokens(usage.cachedTokens || 0)),
    )
    const models = Array.isArray(usage.byModel) ? usage.byModel.slice(0, 6) : []
    for (let i = 0; i < models.length; i++) {
      const row = models[i]
      host.appendChild(
        openaiUsageCard(
          row.model || '—',
          session.t('stats.tokensHint', {
            input: session.compactTokens(row.inputTokens || 0),
            output: session.compactTokens(row.outputTokens || 0),
          }),
        ),
      )
    }
  }

  function openaiUsageCard(title, value) {
    const card = session.el('article', 'status-block')
    const heading = session.el('h3', 'status-block-title')
    session.setText(heading, title)
    card.appendChild(heading)
    const amount = session.el('p', 'status-block-value')
    session.setText(amount, value)
    card.appendChild(amount)
    return card
  }

  function paintCoverage(status) {
    if (!coverageEl) {
      return
    }
    lastCodexStatus = status || lastCodexStatus
    if (querySource !== 'codex-local' || !status) {
      coverageEl.hidden = true
      return
    }
    const importOn = status.importEnabled === true
    const rootState = status.rootState
    let line = ''
    let dismissible = false
    if (!importOn) {
      const onDisk = status.rolloutsOnDisk === true || (status.sessionCount || 0) > 0
      if (onDisk && !coverageDismissed) {
        line = session.t('codex.coverageImportOff')
        dismissible = true
      } else {
        coverageEl.hidden = true
        return
      }
    } else if (rootState === 'sessions-folder') {
      line = session.t('settings.codexSessionsFolder')
    } else if (rootState === 'missing' || rootState === 'not-directory') {
      line = session.t('codex.coverageHomeMissing')
    } else if ((status.sessionCount || 0) === 0) {
      line = session.t('codex.coverageEmpty')
    } else if (status.partial === true) {
      coverageEl.hidden = true
      return
    } else {
      const account =
        Array.isArray(status.accounts) && status.accounts.length > 0
          ? status.accounts[0].indexOf('unknown-source:') === 0 ||
            status.accounts[0] === 'unknown' ||
            status.accounts[0] === ''
            ? session.t('codex.coverageAccountUnknown')
            : status.accounts[0]
          : session.t('codex.coverageAccountUnknown')
      const sync =
        typeof status.lastSyncAt === 'string' && status.lastSyncAt.length >= 16
          ? status.lastSyncAt.slice(11, 16)
          : '—'
      line = session.t('codex.coverageNormal', {
        account: account,
        sessions: String(status.sessionCount || 0),
        span: status.dateSpan || '—',
        sync: sync,
      })
      if (status.remoteWindow === true) {
        line = session.t('codex.coverageRemote') + ' · ' + line
      }
    }
    coverageEl.hidden = false
    session.setText(coverageEl, line)
    coverageEl.style.cursor = dismissible ? 'pointer' : ''
    coverageEl.title = dismissible ? session.t('codex.coverageDismiss') : ''
  }

  function fillFilterOptions(selectEl, values, allLabel) {
    if (!selectEl) {
      return
    }
    const current = selectEl.value
    while (selectEl.options.length > 1) {
      selectEl.remove(1)
    }
    selectEl.options[0].textContent = allLabel
    for (let i = 0; i < values.length; i++) {
      const opt = document.createElement('option')
      opt.value = values[i]
      opt.textContent = values[i]
      selectEl.appendChild(opt)
    }
    selectEl.value = current
    if (selectEl.value !== current) {
      selectEl.value = ''
    }
  }

  function nextLocalIso(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
    if (!match) {
      return iso
    }
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return date.getFullYear() + '-' + month + '-' + day
  }

  function dateBounds() {
    if (codexDayFocus) {
      return { from: codexDayFocus, to: nextLocalIso(codexDayFocus) }
    }
    const from = session.historyFromDate || null
    const to = session.historyToDate ? nextLocalIso(session.historyToDate) : null
    return { from: from, to: to }
  }

  function requestCodexPage(cursor, append) {
    if (querySource !== 'codex-local') {
      return
    }
    const next = { cursor: cursor || null, append: append === true }
    if (codexQueryInFlight) {
      codexQueryPending = next
      return
    }
    sendCodexPage(next.cursor, next.append)
  }

  function settleCodexQuery() {
    codexQueryInFlight = false
    const pending = codexQueryPending
    codexQueryPending = null
    if (pending && querySource === 'codex-local') {
      sendCodexPage(pending.cursor, pending.append)
    }
  }

  function sendCodexPage(cursor, append) {
    codexQueryInFlight = true
    filterRevision += 1
    const correlationId = 'q-' + String(filterRevision) + '-' + String(Date.now())
    lastCorrelationId = correlationId
    appendNextResult = append === true
    if (!append) {
      for (const key in expandedCodex) {
        if (Object.prototype.hasOwnProperty.call(expandedCodex, key)) {
          delete expandedCodex[key]
        }
      }
    }
    const bounds = dateBounds()
    session.vscode.postMessage({
      type: messageType['codex.query'],
      correlationId: correlationId,
      filterRevision: filterRevision,
      from: bounds.from,
      to: bounds.to,
      accountScopeKey: codexAccountEl && codexAccountEl.value ? codexAccountEl.value : null,
      model: codexModelEl && codexModelEl.value ? codexModelEl.value : null,
      status: codexStatusEl && codexStatusEl.value ? codexStatusEl.value : null,
      groupBy: codexGroupBy ? 'conversation' : 'none',
      sort: codexSortEl && codexSortEl.value ? codexSortEl.value : 'time-desc',
      costBasis: 'estimated-api',
      cursor: cursor || null,
      limit: 100,
    })
  }

  function visibleCodexRows(rows) {
    const out = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row) {
        continue
      }
      if (!showCliThreads && row.cli === true) {
        continue
      }
      if (codexSpikesOnly && row.spike !== true) {
        continue
      }
      if (codexOptimizedOnly && row.optimized !== true) {
        continue
      }
      out.push(row)
    }
    return out
  }

  function paintCodexTable(rows, append) {
    if (!codexRowsEl) {
      return
    }
    if (!append) {
      codexRowsEl.textContent = ''
      codexRows = rows || []
    } else {
      codexRows = codexRows.concat(rows || [])
    }
    const list = visibleCodexRows(append ? rows || [] : codexRows)
    if (!append && list.length === 0) {
      if (codexEmptyEl) {
        const importOff =
          lastCodexStatus &&
          lastCodexStatus.importEnabled !== true &&
          lastCodexStatus.rolloutsOnDisk === true
        session.setText(
          codexEmptyEl,
          importOff ? session.t('codex.coverageImportOff') : session.t('codex.empty'),
        )
        codexEmptyEl.hidden = false
      }
    } else if (codexEmptyEl) {
      codexEmptyEl.hidden = true
    }
    for (let i = 0; i < list.length; i++) {
      appendCodexRow(list[i])
    }
    if (!append && list.length > 0) {
      appendCodexSum()
    } else if (append) {
      appendCodexSum()
    }
    syncCodexTableChrome(session.codexStats)
    if (codexLoadMoreEl) {
      const page = append ? rows || [] : codexRows
      const fullPage = page.length >= 100
      codexLoadMoreEl.hidden = !(nextCursor && fullPage)
    }
  }

  function codexCostText(row) {
    if (!row || row.costKind === 'missing-rate' || row.costKind === 'empty') {
      return '—'
    }
    return row.costLabel || '—'
  }

  function fullTokens(n) {
    const value = Math.round(Number(n) || 0)
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  function inputShare(row) {
    const mix = session.codexStats && session.codexStats.tokenMix
    const total = mix ? Number(mix.input) : 0
    const n = row && typeof row.inputTokens === 'number' ? row.inputTokens : null
    if (!(total > 0) || n === null) {
      return null
    }
    return (n / total) * 100
  }

  function appendNumberCell(tr, text, share) {
    const td = document.createElement('td')
    td.className = 'codex-num'
    if (typeof share === 'number' && share > 0) {
      const bar = document.createElement('span')
      bar.className = 'codex-share'
      bar.title = text || ''
      const fill = document.createElement('span')
      fill.className = 'codex-share-fill'
      fill.style.width = Math.max(4, Math.min(100, share)) + '%'
      bar.appendChild(fill)
      td.appendChild(bar)
    }
    const label = document.createElement('span')
    session.setText(label, text || '—')
    td.appendChild(label)
    tr.appendChild(td)
    return td
  }

  function appendModelCell(tr, text) {
    const full = text ? String(text) : '—'
    const shown = full.length > 12 ? full.slice(0, 12) + '…' : full
    const td = document.createElement('td')
    td.className = 'model-col'
    session.setText(td, shown)
    if (full !== '—') {
      td.title = full
    }
    tr.appendChild(td)
    return td
  }

  function appendCodexTextCell(tr, text, title) {
    const td = document.createElement('td')
    session.setText(td, text || '—')
    if (title) {
      td.title = title
    }
    tr.appendChild(td)
    return td
  }

  function appendCodexContextCell(tr, row) {
    const td = document.createElement('td')
    td.className = 'context-col'
    const percent =
      row && typeof row.contextPercent === 'number' ? row.contextPercent : null
    const level =
      percent === null
        ? 'unknown'
        : row.contextLevel === 'full'
          ? 'full'
          : 'ok'
    if (level === 'unknown') {
      const empty = session.el('span', 'context-state is-unknown')
      session.setText(empty, '—')
      td.appendChild(empty)
      tr.appendChild(td)
      return td
    }
    const tip = session.t(
      level === 'full' ? 'codex.contextFull' : 'codex.contextRoom',
      {
        percent: String(percent),
        window: row.contextWindowLabel || '',
        model: row.modelLabel || '—',
      },
    )
    const body = session.el('span', 'context-state is-' + level)
    const label = session.el('span', 'context-percent')
    session.setText(label, String(percent) + '%')
    body.appendChild(label)
    body.appendChild(contextArrow(level))
    if (level === 'full') {
      const pill = session.el('span', 'context-hit is-full')
      pill.title = tip
      pill.appendChild(body)
      td.appendChild(pill)
    } else {
      body.title = tip
      td.appendChild(body)
    }
    tr.appendChild(td)
    return td
  }

  function appendCodexTokensCell(tr, row) {
    const td = document.createElement('td')
    td.className = row && row.spike ? 'tokens-col tokens-spike codex-num' : 'tokens-col codex-num'
    const wrap = session.el('span', 'tokens-cell')
    const label = session.el('span', 'tokens-value')
    session.setText(label, (row && row.tokensLabel) || '—')
    wrap.appendChild(label)
    td.appendChild(wrap)
    tr.appendChild(td)
    return td
  }

  function appendCodexCostCell(tr, row) {
    const costTd = appendNumberCell(tr, codexCostText(row), null)
    costTd.classList.add('codex-cost')
    if (row && row.costKind === 'amount') {
      costTd.classList.add('is-money')
    }
    return costTd
  }

  function appendCodexMeasureCells(tr, row) {
    const modelTd = appendModelCell(tr, row.modelLabel)
    if (row.modelTitle) {
      modelTd.title = row.modelLabel
        ? row.modelLabel + ' · ' + row.modelTitle
        : row.modelTitle
    }
    modelTd.classList.add('codex-col-model')
    appendCodexContextCell(tr, row)
    appendCodexCostCell(tr, row)
    appendCodexTokensCell(tr, row)
    appendNumberCell(tr, row.inputLabel, inputShare(row))
    appendNumberCell(tr, row.cachedLabel, null)
    appendNumberCell(tr, row.outputLabel, null)
    appendNumberCell(tr, row.reasoningLabel, null)
    appendCodexTextCell(tr, row.kindLabel || '—')
  }

  function appendCodexRow(row) {
    if (!codexRowsEl || !row) {
      return
    }
    const tr = document.createElement('tr')
    tr.className = row.rowKind === 'group' ? 'codex-group-row' : 'codex-request-row'
    if (row.spike) {
      tr.classList.add('is-spike')
    }
    tr.dataset.id = row.id || ''
    tr.dataset.conversationId = row.conversationId || ''
    tr.dataset.accountScopeKey = row.accountScopeKey || ''
    tr.dataset.rowKind = row.rowKind || 'request'
    tr.tabIndex = 0

    const timeTd = document.createElement('td')
    timeTd.className = 'query-time codex-sticky'
    if (row.rowKind === 'group') {
      const open = expandedCodex[row.id] === true
      if (open) {
        tr.classList.add('is-open')
      }
      tr.setAttribute('aria-label', session.t('queries.groupExpand'))
      tr.setAttribute('aria-expanded', open ? 'true' : 'false')
      const wrap = session.el('span', 'query-time-cell')
      const chevron = session.el('span', 'query-expand')
      chevron.title = session.t('queries.groupExpand')
      wrap.appendChild(chevron)
      const stack = session.el('span', 'conversation-label')
      const title = session.el('span', 'conversation-title')
      session.setText(title, row.timeLabel || '—')
      if (row.timeLabel) {
        title.title =
          row.timeLabel + (row.rangeLabel ? ' · ' + row.rangeLabel : '')
      }
      stack.appendChild(title)
      const meta = session.el('span', 'conversation-meta')
      const count = Number(row.requestCount) || 0
      session.setText(
        meta,
        count === 1
          ? session.t('queries.groupRequestsOne')
          : session.t('queries.groupRequests', { count: String(count) }),
      )
      stack.appendChild(meta)
      wrap.appendChild(stack)
      timeTd.appendChild(wrap)
    } else {
      const timeMain = document.createElement('span')
      timeMain.className = 'query-time-value'
      session.setText(timeMain, row.timeLabel || '—')
      if (row.timeLabel) {
        timeMain.title = row.timeLabel
      }
      timeTd.appendChild(timeMain)
    }
    if (row.rowKind !== 'group' && row.timeTitle) {
      timeTd.title = row.timeTitle + (row.rangeLabel ? ' · ' + row.rangeLabel : '')
    }
    tr.appendChild(timeTd)
    appendCodexMeasureCells(tr, row)

    if (row.rowKind === 'group') {
      tr.addEventListener('click', function () {
        toggleCodexGroup(row, tr)
      })
      tr.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          toggleCodexGroup(row, tr)
        }
      })
    } else if (row.rowKind === 'request') {
      tr.addEventListener('click', function () {
        openCodexDrawer(row.id)
      })
      tr.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault()
          openCodexDrawer(row.id)
        }
      })
    }
    codexRowsEl.appendChild(tr)
  }

  function appendCodexSum() {
    if (!codexRowsEl || !session.codexStats || !session.codexStats.tokenMix) {
      return
    }
    const previous = codexRowsEl.querySelector('tr.codex-sum-row')
    if (previous) {
      previous.remove()
    }
    const mix = session.codexStats.tokenMix
    const tr = document.createElement('tr')
    tr.className = 'codex-sum-row'
    const label = document.createElement('td')
    label.className = 'codex-sticky'
    session.setText(label, session.t('codex.tableTotal'))
    tr.appendChild(label)
    const model = document.createElement('td')
    model.className = 'codex-col-model'
    tr.appendChild(model)
    const context = document.createElement('td')
    context.className = 'context-col'
    tr.appendChild(context)
    const estimate = session.codexStats.estimatedApiCostUsd
    const est =
      estimate === null || estimate === undefined ? '—' : session.compactCost(estimate)
    const sumCost = appendNumberCell(tr, est, null)
    sumCost.classList.add('codex-cost')
    if (estimate !== null && estimate !== undefined) {
      sumCost.classList.add('is-money')
    }
    const tokenTotal = (Number(mix.input) || 0) + (Number(mix.output) || 0)
    const tokens = document.createElement('td')
    tokens.className = 'tokens-col codex-num'
    session.setText(tokens, fullTokens(tokenTotal))
    tr.appendChild(tokens)
    appendNumberCell(tr, fullTokens(mix.input), 100)
    appendNumberCell(tr, fullTokens(mix.cachedInput), null)
    appendNumberCell(tr, fullTokens(mix.output), null)
    appendNumberCell(tr, fullTokens(mix.reasoning), null)
    tr.appendChild(document.createElement('td'))
    codexRowsEl.appendChild(tr)
  }

  function paintRateBanner(stats) {
    const banner = document.getElementById('codexRateBanner')
    if (!banner) {
      return
    }
    const missing = stats && Array.isArray(stats.missingModels) ? stats.missingModels : []
    banner.textContent = ''
    if (missing.length === 0) {
      banner.hidden = true
      return
    }
    banner.hidden = false
    const text = document.createElement('span')
    session.setText(text, missing.join(', '))
    banner.appendChild(text)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'action-btn action-btn-accent'
    session.setText(button, session.t('codex.setRates'))
    button.addEventListener('click', function () {
      if (typeof session.openCodexRates === 'function') {
        session.openCodexRates(missing)
      }
    })
    banner.appendChild(button)
  }

  function syncCodexTableChrome(stats) {
    const grouped = codexGroupBy === true
    const table = codexRowsEl ? codexRowsEl.closest('table') : null
    if (table) {
      table.classList.toggle('is-grouped', grouped)
    }
    const timeHead = document.getElementById('codexColTime')
    if (timeHead) {
      session.setText(
        timeHead,
        grouped ? session.t('codex.colConversation') : session.t('queries.time'),
      )
    }
    const priced =
      stats && stats.pricedShare ? Number(stats.pricedShare.priced) || 0 : 0
    if (codexSortEl) {
      const costOpt = codexSortEl.querySelector('option[value="cost-desc"]')
      if (costOpt) {
        costOpt.hidden = priced <= 0
        costOpt.disabled = priced <= 0
      }
      if (priced <= 0 && codexSortEl.value === 'cost-desc') {
        codexSortEl.value = 'time-desc'
      }
    }
    if (codexStatusEl) {
      codexStatusEl.hidden = true
      codexStatusEl.value = ''
    }
    paintRateBanner(stats)
  }

  function focusCodexDay(iso) {
    if (!iso) {
      return
    }
    codexDayFocus = iso
    setQuerySource('codex-local', false)
    session.setView('queries')
    const title = session.t('queries.fromTitleCodex', {
      date: session.formatFromDateLabel(iso),
    })
    if (tabQueriesEl) {
      session.setText(tabQueriesEl, title)
    }
    document.title = title
    requestCodexPage(null)
  }

  function toggleCodexGroup(row, tr) {
    const key = row.id
    if (expandedCodex[key]) {
      delete expandedCodex[key]
      tr.classList.remove('is-open')
      tr.setAttribute('aria-expanded', 'false')
      let next = tr.nextSibling
      while (next && next.dataset && next.dataset.parentGroup === key) {
        const remove = next
        next = next.nextSibling
        remove.remove()
      }
      return
    }
    expandedCodex[key] = true
    tr.classList.add('is-open')
    tr.setAttribute('aria-expanded', 'true')
    session.vscode.postMessage({
      type: messageType['codex.expand'],
      conversationId: row.conversationId,
      accountScopeKey: row.accountScopeKey,
    })
  }

  function openCodexDrawer(requestId) {
    session.vscode.postMessage({
      type: messageType['codex.details'],
      requestId: requestId,
    })
  }

  function showDrawer(fields) {
    drawerFields = fields
    if (!codexDrawerEl || !codexDrawerBodyEl || !fields) {
      return
    }
    const lines = []
    const keys = Object.keys(fields)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const value = fields[key]
      if (value === null || value === undefined) {
        continue
      }
      lines.push(key + ': ' + String(value))
    }
    codexDrawerBodyEl.textContent = lines.join('\n')
    codexDrawerEl.hidden = false
  }

  function closeDrawer() {
    if (codexDrawerEl) {
      codexDrawerEl.hidden = true
    }
    drawerFields = null
  }

  function onHostMessage(event) {
    const data = event && event.data
    if (!data || typeof data.type !== 'string') {
      return
    }
    if (data.type === 'codex.status') {
      session.codexHostStatus = data
      if (querySource !== 'codex-local') {
        setQuerySource('codex-local', false)
      }
      paintCoverage(data)
      const accounts = Array.isArray(data.accounts) ? data.accounts : []
      const namedAccounts = accounts.filter(function (account) {
        return (
          account &&
          account.indexOf('unknown-source:') !== 0 &&
          account !== 'unknown'
        )
      })
      if (codexAccountEl) {
        codexAccountEl.hidden = namedAccounts.length < 2
      }
      fillFilterOptions(
        codexAccountEl,
        accounts,
        session.t('codex.accountAll'),
      )
      fillFilterOptions(
        codexModelEl,
        Array.isArray(data.models) ? data.models : [],
        session.t('codex.modelAll'),
      )
      if (typeof data.importEnabled === 'boolean' && codexGroupByEl) {
        // keep group switch; import flag is for settings
      }
      requestCodexPage(null)
      return
    }
    if (data.type === 'openai.status') {
      session.setBootWait(false)
      setQuerySource('openai-api', false)
      paintOpenaiConnect(data)
      return
    }
    if (data.type === 'codex.result') {
      if (
        data.correlationId !== lastCorrelationId ||
        data.filterRevision !== filterRevision
      ) {
        return
      }
      session.setBootWait(false)
      nextCursor = data.nextCursor || null
      if (data.stats) {
        session.codexStats = data.stats
      }
      const append = appendNextResult
      appendNextResult = false
      paintCodexTable(Array.isArray(data.rows) ? data.rows : [], append)
      settleCodexQuery()
      return
    }
    if (data.type === 'codex.children') {
      const parentKey =
        'openai\0' + data.accountScopeKey + '\0' + data.conversationId
      // Find group row by conversation + scope
      const groups = codexRowsEl ? codexRowsEl.querySelectorAll('tr.codex-group-row') : []
      let parentTr = null
      for (let i = 0; i < groups.length; i++) {
        if (
          groups[i].dataset.conversationId === data.conversationId &&
          groups[i].dataset.accountScopeKey === data.accountScopeKey
        ) {
          parentTr = groups[i]
          break
        }
      }
      if (!parentTr) {
        return
      }
      const children = Array.isArray(data.rows) ? data.rows : []
      let insertAfter = parentTr
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const tr = document.createElement('tr')
        tr.className = 'codex-request-row codex-child-row'
        if (child.spike) {
          tr.classList.add('is-spike')
        }
        tr.dataset.parentGroup = parentTr.dataset.id || parentKey
        tr.dataset.id = child.id || ''
        tr.dataset.conversationId = child.conversationId || ''
        tr.dataset.accountScopeKey = child.accountScopeKey || ''
        tr.tabIndex = 0
        const timeTd = document.createElement('td')
        timeTd.className = 'query-time codex-sticky'
        const main = document.createElement('span')
        main.className = 'query-time-value'
        session.setText(main, child.timeLabel || '—')
        if (child.timeLabel) {
          main.title = child.timeLabel
        }
        timeTd.appendChild(main)
        tr.appendChild(timeTd)
        appendCodexMeasureCells(tr, child)
        tr.addEventListener('click', function () {
          openCodexDrawer(child.id)
        })
        insertAfter.after(tr)
        insertAfter = tr
      }
      return
    }
    if (data.type === 'codex.detail') {
      showDrawer(data.fields)
      return
    }
    if (data.type === 'operation.error' && data.message) {
      session.setBootWait(false)
      if (data.correlationId && data.correlationId === lastCorrelationId) {
        settleCodexQuery()
      }
      if (coverageEl && querySource === 'codex-local' && lastCodexStatus) {
        const sync =
          typeof lastCodexStatus.lastSyncAt === 'string' &&
          lastCodexStatus.lastSyncAt.length >= 16
            ? lastCodexStatus.lastSyncAt.slice(11, 16)
            : '—'
        session.setText(
          coverageEl,
          session.t('codex.coverageSyncFailed', { time: sync }),
        )
        coverageEl.hidden = false
      }
    }
  }

  function wireCodex() {
    window.addEventListener('message', onHostMessage)
    const pills = [sourceCursorEl, sourceCodexEl, sourceOpenaiEl]
    for (let i = 0; i < pills.length; i++) {
      if (!pills[i]) {
        continue
      }
      pills[i].addEventListener('click', function () {
        setQuerySource(pills[i].getAttribute('data-source'))
      })
    }
    if (openaiModeWebEl) {
      openaiModeWebEl.addEventListener('click', function () {
        setOpenaiConnectMode('web')
      })
    }
    if (openaiModeLocalEl) {
      openaiModeLocalEl.addEventListener('click', function () {
        setOpenaiConnectMode('local')
      })
    }
    if (openaiConnectBtn) {
      openaiConnectBtn.addEventListener('click', function () {
        session.vscode.postMessage({
          type: messageType['openai.connect'],
          mode: openaiConnectMode,
        })
      })
    }
    if (openaiDisconnectBtn) {
      openaiDisconnectBtn.addEventListener('click', function () {
        session.vscode.postMessage({
          type: messageType['openai.disconnect'],
        })
      })
    }
    if (openaiOpenKeysBtn) {
      openaiOpenKeysBtn.addEventListener('click', function () {
        session.vscode.postMessage({
          type: messageType['openai.openAdminKeys'],
        })
      })
    }
    if (coverageEl) {
      coverageEl.addEventListener('click', function () {
        if (lastCodexStatus && lastCodexStatus.importEnabled !== true) {
          coverageDismissed = true
          coverageEl.hidden = true
        }
      })
    }
    if (codexFilterSpikesEl) {
      codexFilterSpikesEl.addEventListener('change', function () {
        codexSpikesOnly = codexFilterSpikesEl.checked === true
        codexFilterSpikesEl.setAttribute(
          'aria-checked',
          codexSpikesOnly ? 'true' : 'false',
        )
        paintCodexTable(codexRows, false)
      })
    }
    if (codexFilterOptimizedEl) {
      codexFilterOptimizedEl.addEventListener('change', function () {
        codexOptimizedOnly = codexFilterOptimizedEl.checked === true
        codexFilterOptimizedEl.setAttribute(
          'aria-checked',
          codexOptimizedOnly ? 'true' : 'false',
        )
        paintCodexTable(codexRows, false)
      })
    }
    session.onHistoryRange = function () {
      const from = session.historyFromDate || ''
      const to = session.historyToDate || ''
      const key = from + '|' + to
      if (key === appliedRangeKey) {
        if (codexDayFocus && querySource === 'codex-local' && tabQueriesEl) {
          const dayTitle = session.t('queries.fromTitleCodex', {
            date: session.formatFromDateLabel(codexDayFocus),
          })
          session.setText(tabQueriesEl, dayTitle)
          document.title = dayTitle
        }
        return
      }
      appliedRangeKey = key
      codexDayFocus = ''
      if (querySource === 'codex-local') {
        requestCodexPage(null)
      }
    }
    if (codexGroupByEl) {
      codexGroupByEl.checked = true
      codexGroupByEl.addEventListener('change', function () {
        codexGroupBy = codexGroupByEl.checked === true
        syncCodexTableChrome(session.codexStats)
        const setting = document.getElementById(
          'codexGroupByConversationSetting',
        )
        if (setting) {
          setting.checked = codexGroupBy
        }
        session.vscode.postMessage({
          type: messageType.setCodexGroupByConversation,
          value: codexGroupBy,
        })
        requestCodexPage(null)
      })
    }
    if (codexExportEl) {
      codexExportEl.addEventListener('click', function () {
        const bounds = dateBounds()
        session.vscode.postMessage({
          type: messageType['codex.exportCsv'],
          correlationId: 'csv-' + String(Date.now()),
          filterRevision: filterRevision,
          from: bounds.from,
          to: bounds.to,
          accountScopeKey:
            codexAccountEl && codexAccountEl.value ? codexAccountEl.value : null,
          model: codexModelEl && codexModelEl.value ? codexModelEl.value : null,
          status: codexStatusEl && codexStatusEl.value ? codexStatusEl.value : null,
          sort: codexSortEl && codexSortEl.value ? codexSortEl.value : 'time-desc',
          costBasis: 'estimated-api',
        })
      })
    }
    if (codexDatePresetEl) {
      codexDatePresetEl.addEventListener('change', function () {
        const custom = codexDatePresetEl.value === 'custom'
        if (codexFromEl) {
          codexFromEl.hidden = !custom
        }
        if (codexToEl) {
          codexToEl.hidden = !custom
        }
        if (!custom) {
          requestCodexPage(null)
        }
      })
    }
    function applyCustomDates() {
      if (codexDatePresetEl && codexDatePresetEl.value === 'custom') {
        requestCodexPage(null)
      }
    }
    if (codexFromEl) {
      codexFromEl.addEventListener('change', applyCustomDates)
      codexFromEl.addEventListener('blur', applyCustomDates)
      codexFromEl.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          applyCustomDates()
        }
      })
    }
    if (codexToEl) {
      codexToEl.addEventListener('change', applyCustomDates)
      codexToEl.addEventListener('blur', applyCustomDates)
      codexToEl.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          applyCustomDates()
        }
      })
    }
    const filterEls = [codexAccountEl, codexModelEl, codexStatusEl, codexSortEl]
    for (let i = 0; i < filterEls.length; i++) {
      if (filterEls[i]) {
        filterEls[i].addEventListener('change', function () {
          requestCodexPage(null)
        })
      }
    }
    if (codexLoadMoreEl) {
      codexLoadMoreEl.addEventListener('click', function () {
        if (nextCursor) {
          requestCodexPage(nextCursor, true)
        }
      })
    }
    const closeBtn = document.getElementById('codexDrawerClose')
    const copyBtn = document.getElementById('codexDrawerCopy')
    if (closeBtn) {
      closeBtn.addEventListener('click', closeDrawer)
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (!drawerFields || !navigator.clipboard) {
          return
        }
        const lines = []
        const keys = Object.keys(drawerFields)
        for (let i = 0; i < keys.length; i++) {
          const value = drawerFields[keys[i]]
          if (value === null || value === undefined) {
            continue
          }
          lines.push(keys[i] + ': ' + String(value))
        }
        void navigator.clipboard.writeText(lines.join('\n'))
      })
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeDrawer()
      }
    })
    // Hide switch on Support / Settings tab clicks
    const tabEls = document.querySelectorAll('.tabs .tab')
    for (let i = 0; i < tabEls.length; i++) {
      tabEls[i].addEventListener('click', function () {
        setTimeout(syncSourceVisibility, 0)
      })
    }
    syncSourceVisibility()
  }

  const originalWire = wire
  function wireAll() {
    originalWire()
    wireCodex()
  }

  function cleanModel(value) {
    if (typeof value !== 'string') {
      return ''
    }
    const model = value.trim()
    if (!model || model === '—') {
      return ''
    }
    return model
  }

  function compactTokenLabel(raw) {
    const digits = String(raw).replace(/[^\d]/g, '')
    if (!digits) {
      return ''
    }
    const n = Number(digits)
    if (!Number.isFinite(n)) {
      return raw
    }
    if (n < 1000) {
      return String(Math.round(n))
    }
    const scaled = n < 1000000 ? n / 1000 : n / 1000000
    const suffix = n < 1000000 ? 'k' : 'M'
    return (Math.round(scaled * 10) / 10).toFixed(1) + suffix
  }

  function conversationFacts(source) {
    const tokensRaw = source && typeof source.tokens === 'string' ? source.tokens : ''
    const spike = rowIsSpike(source, tableWarnOn)
    const tokensFull = tokensRaw.replace(/^!\s*/, '').trim()
    const tokens = compactTokenLabel(tokensFull)
    const fill = source && source.context
    const percent = contextShare(fill)
    const contextHot = percent !== null && fill && fill.level === 'full'
    return {
      model: cleanModel(source && source.model),
      tokens: tokens,
      tokensFull: tokensFull,
      tokenTone: tokens ? (spike ? 'warn' : 'ok') : '',
      context: percent === null ? '' : String(percent) + '%',
      contextTone: percent === null ? '' : contextHot ? 'warn' : 'ok',
    }
  }

  function latestConversation() {
    if (groupByConversation && tableGroups.length > 0) {
      const group = tableGroups[0]
      const title = group && typeof group.title === 'string' ? group.title.trim() : ''
      if (group && title) {
        const facts = conversationFacts(group)
        return {
          title: title,
          grouped: true,
          key: group.key || '',
          model: facts.model,
          tokens: facts.tokens,
          tokensFull: facts.tokensFull,
          tokenTone: facts.tokenTone,
          context: facts.context,
          contextTone: facts.contextTone,
        }
      }
    }
    const row = tableEvents && tableEvents[0]
    if (!row) {
      return null
    }
    const named =
      typeof row.conversationTitle === 'string' ? row.conversationTitle.trim() : ''
    const model = row.model && row.model !== '—' ? row.model : ''
    const title = named || [row.time, model].filter(Boolean).join(' · ')
    if (!title) {
      return null
    }
    const facts = conversationFacts(row)
    return {
      title: title,
      grouped: false,
      key: queryRowKey(row),
      model: facts.model || model,
      tokens: facts.tokens,
      tokensFull: facts.tokensFull,
      tokenTone: facts.tokenTone,
      context: facts.context,
      contextTone: facts.contextTone,
    }
  }

  function revealLatest() {
    const latest = latestConversation()
    if (!latest) {
      return
    }
    window.requestAnimationFrame(function () {
      let row = null
      if (latest.grouped) {
        const groups = rowsEl.querySelectorAll('tr.conversation-row')
        for (let i = 0; i < groups.length; i++) {
          if (groups[i].getAttribute('data-group-key') === latest.key) {
            row = groups[i]
            break
          }
        }
      } else if (latest.key) {
        const queries = rowsEl.querySelectorAll('tr.query-row')
        for (let i = 0; i < queries.length; i++) {
          if (queries[i].getAttribute('data-query-key') === latest.key) {
            row = queries[i]
            break
          }
        }
      }
      if (!row) {
        row = rowsEl.querySelector('tr.conversation-row, tr.query-row')
      }
      if (!row) {
        return
      }
      row.classList.add('is-target')
      row.scrollIntoView({ block: 'center' })
      window.setTimeout(function () {
        row.classList.remove('is-target')
      }, 1600)
    })
  }

  return {
    wire: wireAll,
    close: closeDepthMenu,
    apply,
    latestConversation: latestConversation,
    revealLatest: revealLatest,
    getQuerySource: function () {
      return querySource
    },
    focusCodexDay: focusCodexDay,
  }
}
