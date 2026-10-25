/** Statistics spend-mix donut. Chips switch a payload the host already sent. */

const SVG_NS = 'http://www.w3.org/2000/svg'
const SLICE_COLORS = [
  'var(--vscode-charts-blue, #3794ff)',
  'var(--vscode-charts-orange, #d18616)',
  'var(--vscode-charts-yellow, #b89500)',
  'var(--vscode-charts-purple, #b180d7)',
  'var(--vscode-charts-green, #89d185)',
  'var(--vscode-charts-red, #f14c4c)',
]

let dimension = 'model'
let projectId = ''

const DIMENSIONS = [
  ['model', 'stats.spendMixModel'],
  ['vendor', 'stats.spendMixVendor'],
  ['size', 'stats.spendMixSize'],
  ['limit', 'stats.spendMixLimit'],
  ['kind', 'stats.spendMixKind'],
  ['conversation', 'stats.spendMixConversation'],
  ['grade', 'stats.spendMixGrade'],
  ['cache', 'stats.spendMixCache'],
]

const SLICE_LABELS = {
  'cache-read': 'stats.spendMixCacheRead',
  'cache-write': 'stats.spendMixCacheWrite',
  output: 'stats.spendMixOutput',
  input: 'stats.spendMixInput',
  other: 'stats.spendMixOther',
  unknown: 'stats.spendMixUnknown',
  good: 'stats.spendMixGood',
  over: 'stats.spendMixOver',
  optimized: 'stats.spendMixOptimized',
  none: 'stats.spendMixNone',
  untitled: 'stats.spendMixUntitled',
}

function svgEl(name) {
  return document.createElementNS(SVG_NS, name)
}

function shareText(share) {
  const pct = Math.round((Number(share) || 0) * 1000) / 10
  if (Math.abs(pct - Math.round(pct)) < 0.05) {
    return Math.round(pct) + '%'
  }
  return pct.toFixed(1) + '%'
}

function isPayload(spendMix) {
  return (
    spendMix !== null &&
    typeof spendMix === 'object' &&
    Array.isArray(spendMix.vendor) &&
    Array.isArray(spendMix.grade)
  )
}

function donut(slices) {
  const drawn = slices.filter(function (slice) {
    return (Number(slice.share) || 0) > 0
  })
  if (drawn.length === 0) {
    return null
  }
  const svg = svgEl('svg')
  svg.setAttribute('class', 'spend-mix-svg')
  svg.setAttribute('viewBox', '0 0 160 160')
  svg.setAttribute('aria-hidden', 'true')
  const radius = 54
  const circumference = 2 * Math.PI * radius
  if (drawn.length === 1) {
    const ring = svgEl('circle')
    ring.setAttribute('cx', '80')
    ring.setAttribute('cy', '80')
    ring.setAttribute('r', String(radius))
    ring.setAttribute('fill', 'none')
    ring.setAttribute('stroke', SLICE_COLORS[0])
    ring.setAttribute('stroke-width', '22')
    svg.appendChild(ring)
    return svg
  }
  let used = 0
  for (let i = 0; i < drawn.length; i++) {
    const last = i === drawn.length - 1
    const length = last
      ? Math.max(0, circumference - used)
      : Math.max(0, (Number(drawn[i].share) || 0) * circumference)
    used += length
    const ring = svgEl('circle')
    ring.setAttribute('cx', '80')
    ring.setAttribute('cy', '80')
    ring.setAttribute('r', String(radius))
    ring.setAttribute('fill', 'none')
    ring.setAttribute('stroke', SLICE_COLORS[i % SLICE_COLORS.length])
    ring.setAttribute('stroke-width', '22')
    ring.setAttribute('stroke-dasharray', length + ' ' + circumference)
    ring.setAttribute('stroke-dashoffset', String(-1 * (used - length)))
    ring.setAttribute('transform', 'rotate(-90 80 80)')
    svg.appendChild(ring)
  }
  return svg
}

function sliceLabel(session, slice) {
  const key = SLICE_LABELS[slice.id]
  return key ? session.t(key) : slice.label
}

function queryCountText(session, count) {
  const n = Math.max(0, Math.round(Number(count) || 0))
  if (n === 1) {
    return session.t('stats.queryOne')
  }
  return session.t('stats.queryMany', { n: String(n) })
}

function formatDay(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n)) {
    return ''
  }
  const lang = document.documentElement.lang || 'en'
  try {
    return new Date(n).toLocaleDateString(lang, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch (error) {
    return ''
  }
}

function factNote(session, spendMix) {
  const facts = spendMix.facts
  if (facts === null || typeof facts !== 'object') {
    return session.t('stats.spendMixNote')
  }
  const queryCount = Number(facts.queryCount) || 0
  const billed = Number(facts.billedQueryCount) || 0
  const conversations = Number(facts.conversationCount) || 0
  const queries =
    queryCount === 1
      ? session.t('stats.queryOne')
      : session.t('stats.queryMany', { n: String(queryCount) })
  const billedText = session.t('stats.spendMixBilledCount', { n: String(billed) })
  const conversationText =
    conversations === 1
      ? session.t('stats.spendMixConversationOne')
      : session.t('stats.spendMixConversationMany', { n: String(conversations) })
  const from = formatDay(facts.fromMs)
  const to = formatDay(facts.toMs)
  const parts = []
  if (from !== '' && to !== '' && from !== to) {
    parts.push(from + ' – ' + to)
  } else if (from !== '') {
    parts.push(from)
  }
  parts.push(queries, billedText, conversationText)
  return parts.join(' · ')
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n)
}

function dayStamp(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n)) {
    return ''
  }
  const date = new Date(n)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.getDate() + '.' + pad2(date.getMonth() + 1) + '.' + date.getFullYear()
}

function rangeStamp(facts) {
  if (facts === null || typeof facts !== 'object') {
    return ''
  }
  const from = dayStamp(facts.fromMs)
  const to = dayStamp(facts.toMs)
  if (from !== '' && to !== '' && from !== to) {
    return from + ' – ' + to
  }
  return from || to
}

function optionLabel(name, facts) {
  const range = rangeStamp(facts)
  return range === '' ? name : name + ' (' + range + ')'
}

function activeMix(spendMix) {
  if (projectId === '') {
    return spendMix
  }
  const projects = Array.isArray(spendMix.projects) ? spendMix.projects : []
  for (let i = 0; i < projects.length; i++) {
    if (projects[i] && projects[i].id === projectId) {
      return projects[i]
    }
  }
  return spendMix
}

function syncPicker(session, spendMix, picker) {
  const projects = Array.isArray(spendMix.projects) ? spendMix.projects : []
  let known = false
  for (let i = 0; i < projects.length; i++) {
    if (projects[i] && projects[i].id === projectId) {
      known = true
    }
  }
  if (projectId !== '' && !known) {
    projectId = ''
  }
  while (picker.firstChild) {
    picker.removeChild(picker.firstChild)
  }
  const all = session.el('option')
  all.value = ''
  session.setText(all, optionLabel(session.t('stats.spendMixAll'), spendMix.facts))
  picker.appendChild(all)
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i]
    if (!project || typeof project.id !== 'string') {
      continue
    }
    const option = session.el('option')
    option.value = project.id
    session.setText(option, optionLabel(project.label || project.id, project.facts))
    picker.appendChild(option)
  }
  picker.value = projectId
}

function appendSaved(session, spendMix, active, host) {
  if (active !== 'limit') {
    return
  }
  const saved = spendMix.saved
  const usd = saved && typeof saved === 'object' ? Number(saved.usd) || 0 : 0
  const tokens = saved && typeof saved === 'object' ? Number(saved.tokens) || 0 : 0
  const line = session.el('p', 'spend-mix-saved')
  session.setText(
    line,
    session.t('stats.spendMixSaved', {
      usd: session.compactCost(usd),
      tokens: session.compactTokens(tokens),
    }),
  )
  host.appendChild(line)
}

function legend(session, slices) {
  const list = session.el('div', 'meter-list spend-mix-legend')
  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i]
    const row = session.el('div', 'meter-row')
    const head = session.el('div', 'meter-head')
    const name = session.el('span', 'meter-label')
    const label = sliceLabel(session, slice)
    session.setText(name, label)
    name.title = label
    const amount = session.el('span', 'meter-value')
    session.setText(
      amount,
      session.compactCost(slice.costUsd) +
        ' · ' +
        queryCountText(session, slice.queryCount) +
        ' · ' +
        shareText(slice.share),
    )
    head.appendChild(name)
    head.appendChild(amount)
    const track = session.el('div', 'meter-track')
    const fill = session.el('div', 'meter-fill')
    fill.classList.add('is-tone-' + (i % SLICE_COLORS.length))
    const pct = Math.max(0, Math.min(100, (Number(slice.share) || 0) * 100))
    fill.style.width = pct + '%'
    track.appendChild(fill)
    row.appendChild(head)
    row.appendChild(track)
    list.appendChild(row)
  }
  return list
}

export function renderSpendMix(session, spendMix) {
  if (!isPayload(spendMix)) {
    return null
  }
  const root = session.el('div', 'breakdown-panel spend-mix')
  const picker = session.el('select', 'spend-mix-project')
  picker.addEventListener('change', function () {
    projectId = picker.value
    paint()
  })
  root.appendChild(picker)
  const head = session.el('div', 'spend-mix-head')
  const title = session.el('h3', 'breakdown-title')
  session.setText(title, session.t('stats.spendMixTitle'))
  head.appendChild(title)
  const chips = session.el('div', 'spend-mix-chips')
  head.appendChild(chips)
  root.appendChild(head)
  const body = session.el('div', 'spend-mix-body')
  root.appendChild(body)
  const note = session.el('p', 'spend-mix-note')
  function refreshNote() {
    session.setText(note, factNote(session, activeMix(spendMix)))
  }
  session.setText(note, factNote(session, spendMix))
  root.appendChild(note)

  function chip(id, label) {
    const pressed = dimension === id
    const button = session.el('button', 'source-pill' + (pressed ? ' is-pressed' : ''))
    button.type = 'button'
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false')
    session.setText(button, label)
    button.addEventListener('click', function () {
      dimension = id
      paint()
    })
    return button
  }

  function paint() {
    while (chips.firstChild) {
      chips.removeChild(chips.firstChild)
    }
    while (body.firstChild) {
      body.removeChild(body.firstChild)
    }
    syncPicker(session, spendMix, picker)
    const active = activeMix(spendMix)
    refreshNote()
    for (let i = 0; i < DIMENSIONS.length; i++) {
      chips.appendChild(chip(DIMENSIONS[i][0], session.t(DIMENSIONS[i][1])))
    }
    const slices = Array.isArray(active[dimension]) ? active[dimension] : []
    if (slices.length === 0) {
      const empty = session.el('p', 'spend-mix-note')
      session.setText(empty, session.t('stats.spendMixEmpty'))
      body.appendChild(empty)
      appendSaved(session, active, dimension, body)
      return
    }
    const layout = session.el('div', 'spend-mix-layout')
    const chart = donut(slices)
    if (chart) {
      layout.appendChild(chart)
    }
    layout.appendChild(legend(session, slices))
    appendSaved(session, active, dimension, layout)
    body.appendChild(layout)
  }

  paint()
  return root
}
