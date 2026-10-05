/** Model pricing catalog on Statistics. Edit here; media/history.js is generated. */
import { messageType } from '../messages.js'

export function createModelCatalogView(r) {
  function shareLabel(model) {
    const n = Number(model.requestPercent)
    if (!Number.isFinite(n) || n <= 0) {
      return '0%'
    }
    const text = Math.round(n * 10) / 10
    return (Number.isInteger(text) ? String(text) : text.toFixed(1)) + '%'
  }

  function moneyPair(model) {
    return r.t('stats.priceInOut', {
      input: model.input || '—',
      output: model.output || '—',
    })
  }

  function priceAmount(value) {
    if (typeof value !== 'string') {
      return null
    }
    const n = Number(value.replace(/[^0-9.]/g, ''))
    return Number.isFinite(n) ? n : null
  }

  function sortCatalogModels(models) {
    const rows = models.map(function (model, index) {
      return { model: model, index: index }
    })
    if (
      r.catalogSortKey !== 'model' &&
      r.catalogSortKey !== 'cost' &&
      r.catalogSortKey !== 'status' &&
      r.catalogSortKey !== 'requests' &&
      r.catalogSortKey !== 'percent' &&
      r.catalogSortKey !== 'bench'
    ) {
      return rows
    }
    const dir = r.catalogSortDir === 'desc' ? -1 : 1
    rows.sort(function (a, b) {
      let cmp = 0
      if (r.catalogSortKey === 'model') {
        cmp = String(a.model.name || '').localeCompare(String(b.model.name || ''))
      } else if (r.catalogSortKey === 'status') {
        cmp = (a.model.hiddenByDefault ? 1 : 0) - (b.model.hiddenByDefault ? 1 : 0)
      } else if (r.catalogSortKey === 'requests') {
        cmp = (Number(a.model.requests) || 0) - (Number(b.model.requests) || 0)
      } else if (r.catalogSortKey === 'percent') {
        cmp = (Number(a.model.requestPercent) || 0) - (Number(b.model.requestPercent) || 0)
      } else if (r.catalogSortKey === 'bench') {
        const aScore = Number(a.model.benchScore)
        const bScore = Number(b.model.benchScore)
        const aMissing = !Number.isFinite(aScore)
        const bMissing = !Number.isFinite(bScore)
        if (aMissing || bMissing) {
          if (aMissing !== bMissing) {
            return aMissing ? 1 : -1
          }
          return a.index - b.index
        }
        cmp = aScore - bScore
      } else {
        const aIn = priceAmount(a.model.input)
        const bIn = priceAmount(b.model.input)
        const aOut = priceAmount(a.model.output)
        const bOut = priceAmount(b.model.output)
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
      return cmp * dir
    })
    return rows
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
    r.setText(note, r.t('stats.pricingNote'))
    panel.appendChild(note)

    const list = r.el('div', 'model-catalog-list')
    if (!r.modelCatalog) {
      const loading = r.el('p', 'model-catalog-note')
      r.setText(loading, r.t('stats.pricingLoading'))
      list.appendChild(loading)
      panel.appendChild(list)
      return panel
    }
    if (r.modelCatalog.error && (!r.modelCatalog.models || r.modelCatalog.models.length === 0)) {
      const failed = r.el('p', 'model-catalog-note')
      r.setText(failed, r.t('stats.pricingError'))
      list.appendChild(failed)
      panel.appendChild(list)
      return panel
    }

    const defaults = r.el('p', 'model-catalog-defaults')
    r.setText(
      defaults,
      r.t('stats.pricingDefaults', {
        visible: r.modelCatalog.visibleByDefault,
        hidden: r.modelCatalog.hiddenByDefault,
        fast: r.modelCatalog.fast,
      }),
    )
    panel.insertBefore(defaults, note)

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

    const catalogFilters = r.el('div', 'model-catalog-filters')
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
    panel.appendChild(catalogFilters)

    const models = (Array.isArray(r.modelCatalog.models) ? r.modelCatalog.models : []).filter(
      function (model) {
        if (r.catalogActiveOnly && model.hiddenByDefault === true) {
          return false
        }
        return !r.catalogHideFast || model.fast !== true
      },
    )
    const table = document.createElement('table')
    table.className = 'model-catalog-table'
    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    headRow.appendChild(catalogSortHeader('model', r.t('stats.colModel')))
    headRow.appendChild(catalogSortHeader('cost', r.t('stats.colCost')))
    headRow.appendChild(catalogSortHeader('bench', r.t('stats.colBench')))
    headRow.appendChild(catalogSortHeader('requests', r.t('stats.colRequests')))
    headRow.appendChild(catalogSortHeader('percent', r.t('stats.colPercent')))
    headRow.appendChild(catalogSortHeader('status', r.t('stats.colStatus')))
    thead.appendChild(headRow)
    table.appendChild(thead)
    const tbody = document.createElement('tbody')
    const sorted = sortCatalogModels(models)
    for (let i = 0; i < sorted.length; i++) {
      const model = sorted[i].model
      const row = document.createElement('tr')
      if (model.fast) {
        row.classList.add('is-fast')
      }
      const nameCell = document.createElement('td')
      const name = r.el('span', 'model-price-label')
      r.setText(name, model.name || '')
      name.title = model.name || ''
      nameCell.appendChild(name)
      if (model.provider) {
        const provider = r.el('span', 'model-price-provider')
        r.setText(provider, model.provider)
        nameCell.appendChild(provider)
      }
      if (model.fast) {
        const fast = r.el('span', 'model-price-badge is-fast')
        r.setText(fast, r.t('stats.fastBadge'))
        nameCell.appendChild(fast)
      }
      const costCell = document.createElement('td')
      costCell.className = 'is-cost'
      r.setText(costCell, moneyPair(model))
      costCell.title = r.t('stats.pricePerMillion')
      const benchCell = document.createElement('td')
      benchCell.className = 'is-cost'
      const benchScore = Number(model.benchScore)
      if (Number.isFinite(benchScore)) {
        const benchLink = document.createElement('button')
        benchLink.type = 'button'
        benchLink.className = 'model-bench-link'
        r.setText(benchLink, benchScore.toFixed(1).replace(/\.0$/, '') + '%')
        benchLink.title = r.t('stats.benchTitle')
        benchLink.addEventListener('click', function () {
          r.vscode.postMessage({ type: messageType.openCursorBench })
        })
        benchCell.appendChild(benchLink)
      } else {
        r.setText(benchCell, '—')
      }
      const requestsCell = document.createElement('td')
      requestsCell.className = 'is-cost'
      r.setText(requestsCell, String(Number(model.requests) || 0))
      const percentCell = document.createElement('td')
      percentCell.className = 'is-cost'
      r.setText(percentCell, shareLabel(model))
      const statusCell = document.createElement('td')
      const state = r.el(
        'span',
        'model-price-badge' + (model.hiddenByDefault ? ' is-hidden' : ' is-on'),
      )
      r.setText(
        state,
        model.hiddenByDefault ? r.t('stats.defaultHidden') : r.t('stats.defaultOn'),
      )
      state.title = r.t('stats.openModelSettingsTitle')
      statusCell.appendChild(state)
      row.appendChild(nameCell)
      row.appendChild(costCell)
      row.appendChild(benchCell)
      row.appendChild(requestsCell)
      row.appendChild(percentCell)
      row.appendChild(statusCell)
      tbody.appendChild(row)
    }
    table.appendChild(tbody)
    list.appendChild(table)
    panel.appendChild(list)
    return panel
  }

  return { modelCatalogPanel }
}
