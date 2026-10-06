/** Queries list. Edit here; media/history.js is generated. */
import { messageType } from '../messages.js'

export function createQueriesView(session) {
  const rowsEl = document.getElementById('rows')
  const emptyEl = document.getElementById('empty')
  const filterSpikesOnlyEl = document.getElementById('filterSpikesOnly')
  const filterOptimizedOnlyEl = document.getElementById('filterOptimizedOnly')
  const groupByConversationEl = document.getElementById('groupByConversation')
  const groupQueriesSettingEl = document.getElementById('groupQueriesByConversation')
  const groupTitlesHintEl = document.getElementById('groupTitlesHint')

  let tableEvents = []
  let tableWarnOn = true
  let tableBurnLevel = 'ok'
  let spikesOnly = false
  let optimizedOnly = false
  let tableGroups = []
  let groupByConversation = false
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

  function rowPassesFilters(row, warnOn) {
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
    svg.setAttribute('viewBox', '0 0 12 12')
    svg.setAttribute('width', '12')
    svg.setAttribute('height', '12')
    svg.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', 'M3.2 1.6v8.8L10.4 6 3.2 1.6z')
    path.setAttribute('fill', 'currentColor')
    svg.appendChild(path)
    return svg
  }

  function repeatIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('width', '12')
    svg.setAttribute('height', '12')
    svg.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    // Classic refresh: curved arrow + arrowhead (Codicons-style).
    path.setAttribute(
      'd',
      'M12.9 4.1A6 6 0 1 0 14 9h-1.5a4.5 4.5 0 1 1-1.4-3.7L9.5 7H14V2.5L12.9 4.1z',
    )
    path.setAttribute('fill', 'currentColor')
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
    if (spike) {
      td.className = 'tokens-spike'
    }
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

  function addTimeCell(tr, text) {
    const td = document.createElement('td')
    td.className = 'query-time'
    const wrap = session.el('span', 'query-time-cell')
    const chevron = session.el('span', 'query-expand')
    chevron.setAttribute('aria-hidden', 'true')
    wrap.appendChild(chevron)
    const label = session.el('span', 'query-time-value')
    session.setText(label, text || '')
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
    session.addCell(tr, row.model)
    session.addCell(tr, row.cost, burnRow ? 'cost-burn' : undefined)
    addTokensCell(tr, row, !optimized && rowIsSpike(row, warnOn))
    session.addCell(tr, row.inputOutput)
    session.addCell(tr, row.kind)
    rowsEl.appendChild(tr)

    const detail = document.createElement('tr')
    detail.className = child ? 'query-detail is-child' : 'query-detail'
    detail.hidden = !open
    const td = document.createElement('td')
    td.colSpan = 6
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
    if (spike) {
      td.className = 'tokens-spike'
    }
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
    tr.title = session.t('queries.groupExpand')
    tr.setAttribute('aria-expanded', open ? 'true' : 'false')
    tr.setAttribute('data-group-key', group.key)
    if (group.optimized === true) {
      tr.classList.add('is-optimized')
    }
    const td = document.createElement('td')
    td.className = 'query-time'
    const wrap = session.el('span', 'query-time-cell')
    const chevron = session.el('span', 'query-expand')
    chevron.setAttribute('aria-hidden', 'true')
    wrap.appendChild(chevron)
    const stack = session.el('span', 'conversation-label')
    const title = session.el('span', 'conversation-title')
    session.setText(title, group.title || '')
    if (group.named !== true) {
      title.classList.add('is-muted')
    }
    stack.appendChild(title)
    const meta = session.el('span', 'conversation-meta')
    session.setText(
      meta,
      groupCountLabel(group, shown) + ' · ' + (group.rangeLabel || ''),
    )
    stack.appendChild(meta)
    wrap.appendChild(stack)
    td.appendChild(wrap)
    tr.appendChild(td)
    session.addCell(tr, group.model || '—')
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
        if (target.closest('.token-play, .token-rerun')) {
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
    pruneExpandedGroups()
    pruneOpenQuery()
    syncSpikesFilterUi()
    syncOptimizedFilterUi()
    syncGroupSwitchUi()
    paintRows(tableEvents, warnOn)
  }

  return {
    wire,
    close: closeDepthMenu,
    apply,
  }
}
