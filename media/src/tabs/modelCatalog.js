/** Model pricing catalog on Statistics. Edit here; media/history.js is generated. */
import { messageType } from '../messages.js'

export function createModelCatalogView(r) {
  function shareLabel(percent) {
    const n = Number(percent)
    if (!Number.isFinite(n) || n <= 0) {
      return '0%'
    }
    const text = Math.round(n * 10) / 10
    return (Number.isInteger(text) ? String(text) : text.toFixed(1)) + '%'
  }

  function moneyPair(line) {
    return r.t('stats.priceInOut', {
      input: line.input || '—',
      output: line.output || '—',
    })
  }

  function priceKey(line) {
    if (!line || (!line.input && !line.output)) {
      return ''
    }
    return (line.input || '—') + '\n' + (line.output || '—')
  }

  function mostCommonPrice(lines) {
    const counts = Object.create(null)
    let winner = null
    let winnerCount = 0
    for (let i = 0; i < lines.length; i++) {
      const key = priceKey(lines[i])
      if (!key) {
        continue
      }
      counts[key] = (counts[key] || 0) + 1
      if (counts[key] > winnerCount) {
        winnerCount = counts[key]
        winner = lines[i]
      }
    }
    return winner
  }

  /** Most-used variant when requests differ; otherwise the price that shows up most often. */
  function representativeLine(lines) {
    let bestRequests = 0
    const tied = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!priceKey(line)) {
        continue
      }
      const requests = Number(line.requests) || 0
      if (requests > bestRequests) {
        bestRequests = requests
        tied.length = 0
        tied.push(line)
      } else if (requests === bestRequests && bestRequests > 0) {
        tied.push(line)
      }
    }
    if (bestRequests > 0 && tied.length === 1) {
      return tied[0]
    }
    if (bestRequests > 0 && tied.length > 1) {
      return mostCommonPrice(tied) || tied[0]
    }
    return mostCommonPrice(lines)
  }

  function priceAmount(value) {
    if (typeof value !== 'string') {
      return null
    }
    const n = Number(value.replace(/[^0-9.]/g, ''))
    return Number.isFinite(n) ? n : null
  }

  function plainLabel(value) {
    return String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function variantText(line) {
    const family = plainLabel(line.family)
    const raw = String(line.variantLabel || '')
    const span = raw.match(/<span[^>]*>([^<]*)<\/span>/i)
    const text = span && span[1].trim() ? span[1].trim() : plainLabel(raw)
    if (!text || text.toLowerCase() === family.toLowerCase()) {
      return r.t('stats.variantStandard')
    }
    if (family && text.toLowerCase().indexOf(family.toLowerCase()) === 0) {
      const rest = text.slice(family.length).trim()
      if (rest) {
        return rest
      }
      return r.t('stats.variantStandard')
    }
    return text
  }

  function compareLines(a, b) {
    let cmp = 0
    if (r.catalogSortKey === 'model') {
      cmp = String(a.family || '').localeCompare(String(b.family || ''))
      if (cmp === 0) {
        cmp = variantText(a).localeCompare(variantText(b))
      }
    } else if (r.catalogSortKey === 'provider') {
      cmp = String(a.provider || '').localeCompare(String(b.provider || ''))
    } else if (r.catalogSortKey === 'status') {
      cmp = (a.enabled ? 0 : 1) - (b.enabled ? 0 : 1)
    } else if (r.catalogSortKey === 'requests') {
      cmp = (Number(a.requests) || 0) - (Number(b.requests) || 0)
    } else if (r.catalogSortKey === 'percent') {
      cmp = (Number(a.requestPercent) || 0) - (Number(b.requestPercent) || 0)
    } else if (r.catalogSortKey === 'bench') {
      const aScore = Number(a.benchScore)
      const bScore = Number(b.benchScore)
      const aMissing = !Number.isFinite(aScore)
      const bMissing = !Number.isFinite(bScore)
      if (aMissing || bMissing) {
        if (aMissing !== bMissing) {
          return aMissing ? 1 : -1
        }
        return a.index - b.index
      }
      cmp = aScore - bScore
    } else if (r.catalogSortKey === 'cost') {
      const aIn = priceAmount(a.input)
      const bIn = priceAmount(b.input)
      const aOut = priceAmount(a.output)
      const bOut = priceAmount(b.output)
      const aMissing = aIn === null
      const bMissing = bIn === null
      if (aMissing !== bMissing) {
        cmp = aMissing ? 1 : -1
      } else {
        cmp = (aIn || 0) - (bIn || 0)
        if (cmp === 0) {
          cmp = (aOut || 0) - (bOut || 0)
        }
      }
    }
    if (cmp === 0) {
      cmp = a.index - b.index
    }
    const dir = r.catalogSortDir === 'desc' ? -1 : 1
    return cmp * dir
  }

  function sortable(key) {
    return (
      key === 'model' ||
      key === 'provider' ||
      key === 'cost' ||
      key === 'status' ||
      key === 'requests' ||
      key === 'percent' ||
      key === 'bench'
    )
  }

  function groupLines(lines) {
    const order = []
    const byFamily = new Map()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const key = line.family || ''
      let bucket = byFamily.get(key)
      if (!bucket) {
        bucket = []
        byFamily.set(key, bucket)
        order.push(key)
      }
      bucket.push(line)
    }
    const groups = []
    for (let i = 0; i < order.length; i++) {
      const family = order[i]
      const members = byFamily.get(family).map(function (line, index) {
        return Object.assign({ index: index }, line)
      })
      if (sortable(r.catalogSortKey)) {
        members.sort(compareLines)
      }
      groups.push({ key: family, lines: members })
    }
    if (sortable(r.catalogSortKey)) {
      groups.sort(function (a, b) {
        return compareLines(a.lines[0], b.lines[0])
      })
    }
    return groups
  }

  function groupIsOpen(key) {
    const collapsed = r.catalogCollapsedGroups
    return !collapsed || collapsed[key] !== true
  }

  function groupUsage(lines) {
    const seen = Object.create(null)
    let requests = 0
    let percent = 0
    let bench = null
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const key = line.requestKey || line.family
      if (seen[key] !== true) {
        seen[key] = true
        requests += Number(line.requests) || 0
        percent += Number(line.requestPercent) || 0
      }
      const score = Number(line.benchScore)
      if (Number.isFinite(score) && (bench === null || score > bench)) {
        bench = score
      }
    }
    return { requests: requests, percent: percent, bench: bench }
  }

  function summarize(lines) {
    const enabled = Object.create(null)
    const disabled = Object.create(null)
    let fast = 0
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const family = line.family || ''
      if (line.enabled === true) {
        enabled[family] = true
        delete disabled[family]
      } else if (enabled[family] !== true) {
        disabled[family] = true
      }
      if (line.fast === true) {
        fast += 1
      }
    }
    return {
      visible: Object.keys(enabled).length,
      hidden: Object.keys(disabled).length,
      fast: fast,
    }
  }

  function catalogSortHeader(key, label) {
    const th = document.createElement('th')
    th.scope = 'col'
    const button = document.createElement('button')
    button.type = 'button'
    const active = r.catalogSortKey === key
    const mark = active ? (r.catalogSortDir === 'desc' ? ' ↓' : ' ↑') : ''
    r.setText(button, label + mark)
    th.setAttribute('aria-sort', active ? (r.catalogSortDir === 'desc' ? 'descending' : 'ascending') : 'none')
    button.addEventListener('click', function () {
      if (r.catalogSortKey === key) {
        r.catalogSortDir = r.catalogSortDir === 'asc' ? 'desc' : 'asc'
      } else {
        r.catalogSortKey = key
        r.catalogSortDir = 'asc'
      }
      if (r.lastStatsArgs) {
        r.renderStats.apply(null, r.lastStatsArgs)
      }
    })
    th.appendChild(button)
    return th
  }

  function catalogSwitch(labelPath, titlePath, checked, onChange) {
    const root = r.el('label', 'spike-switch model-catalog-fast')
    root.title = r.t(titlePath)
    const text = r.el('span', 'spike-switch-text')
    r.setText(text, r.t(labelPath))
    const control = r.el('span', 'spike-switch-control')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = checked === true
    input.setAttribute('role', 'switch')
    input.setAttribute('aria-checked', checked === true ? 'true' : 'false')
    input.addEventListener('change', function () {
      onChange(input.checked === true)
      if (r.lastStatsArgs) {
        r.renderStats.apply(null, r.lastStatsArgs)
      }
    })
    const track = r.el('span', 'spike-switch-track')
    track.setAttribute('aria-hidden', 'true')
    track.appendChild(r.el('span', 'spike-switch-thumb'))
    control.appendChild(input)
    control.appendChild(track)
    root.appendChild(text)
    root.appendChild(control)
    return root
  }

  function catalogSelect(value, options, onChange) {
    const select = document.createElement('select')
    for (let i = 0; i < options.length; i++) {
      const option = document.createElement('option')
      option.value = options[i].value
      r.setText(option, options[i].label)
      select.appendChild(option)
    }
    select.value = value
    select.addEventListener('change', function () {
      onChange(select.value)
      if (r.lastStatsArgs) {
        r.renderStats.apply(null, r.lastStatsArgs)
      }
    })
    return select
  }

  function modelCatalogPanel() {
    const panel = r.el('div', 'breakdown-panel model-catalog')
    const head = r.el('div', 'model-catalog-head')
    const title = r.el('h3', 'breakdown-title')
    r.setText(title, r.t('stats.modelPricing'))
    head.appendChild(title)
    const actions = r.el('div', 'model-catalog-actions')
    const settingsBtn = r.el('button', 'action-btn model-catalog-refresh')
    settingsBtn.type = 'button'
    r.setText(settingsBtn, r.t('stats.openModelSettings'))
    settingsBtn.title = r.t('stats.openModelSettingsTitle')
    settingsBtn.addEventListener('click', function () {
      r.vscode.postMessage({ type: messageType.openModelSettings })
    })
    const refresh = r.el('button', 'action-btn model-catalog-refresh')
    refresh.type = 'button'
    r.setText(refresh, r.t('stats.pricingRefresh'))
    refresh.title = r.t('stats.pricingRefresh')
    refresh.addEventListener('click', function () {
      r.setText(refresh, r.t('stats.pricingLoading'))
      refresh.disabled = true
      r.vscode.postMessage({ type: messageType.refreshModelCatalog })
    })
    actions.appendChild(settingsBtn)
    actions.appendChild(refresh)
    head.appendChild(actions)
    panel.appendChild(head)

    const note = r.el('p', 'model-catalog-note')
    panel.appendChild(note)

    const list = r.el('div', 'model-catalog-list')
    if (!r.modelCatalog) {
      r.setText(note, r.t('stats.pricingNote'))
      const loading = r.el('p', 'model-catalog-note')
      r.setText(loading, r.t('stats.pricingLoading'))
      list.appendChild(loading)
      panel.appendChild(list)
      return panel
    }
    if (r.modelCatalog.error && (!r.modelCatalog.lines || r.modelCatalog.lines.length === 0) && (!r.modelCatalog.models || r.modelCatalog.models.length === 0)) {
      r.setText(note, r.t('stats.pricingNote'))
      const failed = r.el('p', 'model-catalog-note')
      r.setText(failed, r.t('stats.pricingError'))
      list.appendChild(failed)
      panel.appendChild(list)
      return panel
    }

    const allLines = Array.isArray(r.modelCatalog.lines) ? r.modelCatalog.lines : []
    const counts = allLines.length > 0
      ? summarize(allLines)
      : {
          visible: r.modelCatalog.visibleByDefault,
          hidden: r.modelCatalog.hiddenByDefault,
          fast: r.modelCatalog.fast,
        }
    if (Number.isFinite(Number(r.modelCatalog.fast))) {
      counts.fast = r.modelCatalog.fast
    }
    const defaults = r.el('p', 'model-catalog-defaults')
    r.setText(
      defaults,
      r.t('stats.pricingDefaults', {
        visible: counts.visible,
        hidden: counts.hidden,
        fast: counts.fast,
      }),
    )
    panel.insertBefore(defaults, note)
    r.setText(
      note,
      r.t(r.modelCatalog.accountKnown ? 'stats.pricingNoteAccount' : 'stats.pricingNote'),
    )

    const filtered = allLines.filter(function (line) {
      if (r.catalogActiveOnly && line.enabled !== true) {
        return false
      }
      return !r.catalogHideFast || line.fast !== true
    })
    const providers = []
    const seenProviders = Object.create(null)
    for (let i = 0; i < filtered.length; i++) {
      const provider = filtered[i].provider || ''
      if (provider === '' || seenProviders[provider] === true) {
        continue
      }
      seenProviders[provider] = true
      providers.push(provider)
    }
    providers.sort(function (a, b) {
      return a.localeCompare(b)
    })
    const providerValue = seenProviders[r.catalogProvider] === true ? r.catalogProvider : ''
    const shown = filtered.filter(function (line) {
      return providerValue === '' || line.provider === providerValue
    })
    const groups = groupLines(shown)
    const multiKeys = []
    for (let g = 0; g < groups.length; g++) {
      if (groups[g].lines.length > 1) {
        multiKeys.push(groups[g].key)
      }
    }
    const allGroupsOpen = multiKeys.every(function (key) {
      return groupIsOpen(key)
    })

    const catalogFilters = r.el('div', 'model-catalog-filters')
    if (multiKeys.length > 0) {
      catalogFilters.appendChild(
        catalogSwitch(
          'stats.expandAll',
          allGroupsOpen ? 'stats.collapseAllTitle' : 'stats.expandAllTitle',
          allGroupsOpen,
          function (open) {
            const next = Object.create(null)
            if (!open) {
              for (let i = 0; i < multiKeys.length; i++) {
                next[multiKeys[i]] = true
              }
            }
            r.catalogCollapsedGroups = next
          },
        ),
      )
    }
    catalogFilters.appendChild(
      catalogSwitch('stats.activeOnly', 'stats.activeOnlyTitle', r.catalogActiveOnly, function (value) {
        r.catalogActiveOnly = value
      }),
    )
    catalogFilters.appendChild(
      catalogSwitch('stats.hideFast', 'stats.hideFastTitle', r.catalogHideFast, function (value) {
        r.catalogHideFast = value
      }),
    )
    const providerOptions = [{ value: '', label: r.t('stats.providerAll') }]
    for (let i = 0; i < providers.length; i++) {
      providerOptions.push({ value: providers[i], label: providers[i] })
    }
    catalogFilters.appendChild(
      catalogSelect(providerValue, providerOptions, function (value) {
        r.catalogProvider = value
      }),
    )
    panel.appendChild(catalogFilters)

    const table = document.createElement('table')
    table.className = 'model-catalog-table'
    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    headRow.appendChild(catalogSortHeader('model', r.t('stats.colModel')))
    headRow.appendChild(catalogSortHeader('provider', r.t('stats.colProvider')))
    headRow.appendChild(catalogSortHeader('cost', r.t('stats.colCost')))
    headRow.appendChild(catalogSortHeader('bench', r.t('stats.colBench')))
    headRow.appendChild(catalogSortHeader('requests', r.t('stats.colRequests')))
    headRow.appendChild(catalogSortHeader('percent', r.t('stats.colPercent')))
    headRow.appendChild(catalogSortHeader('status', r.t('stats.colStatus')))
    thead.appendChild(headRow)
    table.appendChild(thead)
    const tbody = document.createElement('tbody')

    function benchCell(score) {
      const cell = document.createElement('td')
      cell.className = 'is-cost'
      const benchScore = Number(score)
      if (!Number.isFinite(benchScore)) {
        r.setText(cell, '—')
        return cell
      }
      const benchLink = document.createElement('button')
      benchLink.type = 'button'
      benchLink.className = 'model-bench-link'
      r.setText(benchLink, benchScore.toFixed(1).replace(/\.0$/, '') + '%')
      benchLink.title = r.t('stats.benchTitle')
      benchLink.addEventListener('click', function () {
        r.vscode.postMessage({ type: messageType.openCursorBench })
      })
      cell.appendChild(benchLink)
      return cell
    }

    function statusCell(enabled) {
      const cell = document.createElement('td')
      const state = r.el('span', 'model-price-badge' + (enabled ? ' is-on' : ' is-hidden'))
      r.setText(state, enabled ? r.t('stats.defaultOn') : r.t('stats.defaultHidden'))
      state.title = r.t('stats.openModelSettingsTitle')
      cell.appendChild(state)
      return cell
    }

    function textCell(text, cost) {
      const cell = document.createElement('td')
      if (cost) {
        cell.className = 'is-cost'
      }
      r.setText(cell, text)
      return cell
    }

    function nameCell(label, nested, fast) {
      const cell = document.createElement('td')
      const name = r.el('span', 'model-price-label')
      r.setText(name, label)
      name.title = label
      cell.appendChild(name)
      if (fast) {
        const badge = r.el('span', 'model-price-badge is-fast')
        r.setText(badge, r.t('stats.fastBadge'))
        cell.appendChild(badge)
      }
      if (nested) {
        cell.classList.add('is-nested')
      }
      return cell
    }

    function appendSimpleRow(line) {
      const row = document.createElement('tr')
      if (line.fast) {
        row.classList.add('is-fast')
      }
      row.appendChild(nameCell(plainLabel(line.family), false, line.fast === true))
      row.appendChild(textCell(line.provider || ''))
      const cost = textCell(moneyPair(line), true)
      cost.title = r.t('stats.pricePerMillion')
      row.appendChild(cost)
      row.appendChild(benchCell(line.benchScore))
      row.appendChild(textCell(String(Number(line.requests) || 0), true))
      row.appendChild(textCell(shareLabel(line.requestPercent), true))
      row.appendChild(statusCell(line.enabled === true))
      tbody.appendChild(row)
    }

    function appendGroup(group) {
      const open = groupIsOpen(group.key)
      const usage = groupUsage(group.lines)
      const provider = group.lines[0].provider || ''
      const enabled = group.lines.some(function (line) {
        return line.enabled === true
      })
      const row = document.createElement('tr')
      row.className = 'model-catalog-group-row'
      const cell = document.createElement('td')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'model-catalog-group-btn'
      button.setAttribute('aria-expanded', open ? 'true' : 'false')
      const chevron = r.el('span', 'model-catalog-chevron' + (open ? ' is-open' : ''))
      chevron.setAttribute('aria-hidden', 'true')
      const name = r.el('span', 'model-catalog-group-label')
      r.setText(name, plainLabel(group.key))
      const count = r.el('span', 'model-catalog-group-count')
      r.setText(count, String(group.lines.length))
      button.title = r.t(open ? 'stats.collapseGroup' : 'stats.expandGroup', { provider: group.key })
      button.appendChild(chevron)
      button.appendChild(name)
      button.appendChild(count)
      button.addEventListener('click', function () {
        const next = Object.create(null)
        const current = r.catalogCollapsedGroups
        if (current && typeof current === 'object') {
          const keys = Object.keys(current)
          for (let i = 0; i < keys.length; i++) {
            if (current[keys[i]] === true) {
              next[keys[i]] = true
            }
          }
        }
        if (open) {
          next[group.key] = true
        } else {
          delete next[group.key]
        }
        r.catalogCollapsedGroups = next
        if (r.lastStatsArgs) {
          r.renderStats.apply(null, r.lastStatsArgs)
        }
      })
      cell.appendChild(button)
      row.appendChild(cell)
      row.appendChild(textCell(provider))
      const sample = representativeLine(group.lines)
      const cost = textCell(sample ? moneyPair(sample) : '—', true)
      cost.title = r.t('stats.pricePerMillion')
      row.appendChild(cost)
      row.appendChild(benchCell(usage.bench))
      row.appendChild(textCell(String(usage.requests), true))
      row.appendChild(textCell(shareLabel(usage.percent), true))
      row.appendChild(statusCell(enabled))
      tbody.appendChild(row)
      if (!open) {
        return
      }
      for (let i = 0; i < group.lines.length; i++) {
        const line = group.lines[i]
        const child = document.createElement('tr')
        child.className = 'is-in-group'
        if (line.fast) {
          child.classList.add('is-fast')
        }
        child.appendChild(nameCell(variantText(line), true, line.fast === true))
        child.appendChild(textCell(''))
        const cost = textCell(moneyPair(line), true)
        cost.title = r.t('stats.pricePerMillion')
        child.appendChild(cost)
        child.appendChild(benchCell(line.benchScore))
        child.appendChild(textCell('—', true))
        child.appendChild(textCell('—', true))
        child.appendChild(statusCell(line.enabled === true))
        tbody.appendChild(child)
      }
    }

    for (let g = 0; g < groups.length; g++) {
      const group = groups[g]
      if (group.lines.length < 2) {
        appendSimpleRow(group.lines[0])
        continue
      }
      appendGroup(group)
    }
    table.appendChild(tbody)
    list.appendChild(table)
    panel.appendChild(list)
    return panel
  }

  return { modelCatalogPanel }
}
