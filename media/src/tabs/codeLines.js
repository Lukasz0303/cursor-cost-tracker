/** Generated-lines card + chart. Edit here; media/history.js is generated. */
import { messageType } from '../messages.js'

export function createCodeLinesView(r) {
  function drawCodeLinesChart(svg, series, summary) {
    r.clearSvg(svg)
    const raw = summary || {}
    let ai = typeof raw.ai === 'number' ? raw.ai : null
    let onMaster = typeof raw.onMaster === 'number' ? raw.onMaster : null
    if ((ai === null || onMaster === null) && series && series.length) {
      let aiCum = 0
      let landedCum = 0
      for (let i = 0; i < series.length; i++) {
        aiCum += Number(series[i].ai) || 0
        landedCum += Number(series[i].onMaster) || Number(series[i].merged) || 0
      }
      if (ai === null) {
        ai = aiCum
      }
      if (onMaster === null) {
        onMaster = landedCum
      }
    }
    const headline = codeLinesHeadline({
      ai: ai,
      allEdited: raw.allEdited,
      onMaster: onMaster,
      pending: raw.pending,
      merged: raw.merged,
      rangeLabel: raw.rangeLabel,
    })
    const rows = [
      {
        value: headline.onMaster,
        fillClass: 'chart-code-fill is-landed',
        label: r.t('codeLines.onBranch', { branch: r.codeLinesDefaultBranch }),
      },
    ]
    if (headline.pending > 0) {
      rows.push({
        value: headline.pending,
        fillClass: 'chart-code-fill is-pending',
        label: r.t('codeLines.stillAhead', { branch: r.codeLinesDefaultBranch }),
      })
    }
    rows.push({
      value: headline.ai,
      fillClass: 'chart-code-fill is-ai-total',
      label: r.t('charts.aiGenerated'),
    })
    if (headline.allEdited > 0) {
      rows.push({
        value: headline.allEdited,
        fillClass: 'chart-code-fill is-all',
        label: r.t('codeLines.allProjects'),
      })
    }

    const width = 800
    const padL = 210
    const padR = 110
    const padT = 20
    const padB = 16
    const barH = 32
    const gap = 18
    const height =
      padT + rows.length * barH + Math.max(0, rows.length - 1) * gap + padB
    const innerW = width - padL - padR
    const maxV = Math.max(
      headline.ai,
      headline.onMaster,
      headline.pending,
      headline.allEdited,
      1,
    )
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)

    function bar(y, value, fillClass, label, countLabel) {
      const w = Math.max(value > 0 ? 2 : 0, (innerW * value) / maxV)
      svg.appendChild(
        r.svgNode('text', {
          x: padL - 12,
          y: y + barH / 2 + 5,
          class: 'chart-code-label',
          'text-anchor': 'end',
        }),
      )
      svg.lastChild.textContent = label
      svg.appendChild(
        r.svgNode('rect', {
          x: padL,
          y: y,
          width: innerW,
          height: barH,
          rx: 6,
          class: 'chart-code-track',
        }),
      )
      if (w > 0) {
        svg.appendChild(
          r.svgNode('rect', {
            x: padL,
            y: y,
            width: w,
            height: barH,
            rx: 6,
            class: fillClass,
          }),
        )
      }
      svg.appendChild(
        r.svgNode('text', {
          x: padL + innerW + 10,
          y: y + barH / 2 + 5,
          class: 'chart-code-value',
          'text-anchor': 'start',
        }),
      )
      svg.lastChild.textContent = countLabel
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      bar(
        padT + i * (barH + gap),
        row.value,
        row.fillClass,
        row.label,
        formatCodeLinesCount(row.value),
      )
    }
    return headline
  }

  function renderCodeLinesChartRatio(headline) {
    if (!r.codeLinesChartRatioEl) {
      return
    }
    while (r.codeLinesChartRatioEl.firstChild) {
      r.codeLinesChartRatioEl.removeChild(r.codeLinesChartRatioEl.firstChild)
    }
    if (!headline) {
      return
    }
    if (headline.rangeText) {
      const rangeEl = r.el('p', 'code-lines-chart-range')
      r.setText(rangeEl, headline.rangeText)
      r.codeLinesChartRatioEl.appendChild(rangeEl)
    }
    const chartFormulas = codeLinesFormulas([
      {
        formula: headline.rateFormula,
        caption: r.t('codeLines.yourRate'),
        hero: true,
      },
    ])
    if (chartFormulas) {
      r.codeLinesChartRatioEl.appendChild(chartFormulas)
    }
    const chartLanded = codeLinesCollapsedFormula(
      headline.landedFormula,
      r.t('codeLines.ifLanded', { branch: r.codeLinesDefaultBranch }),
    )
    if (chartLanded) {
      r.codeLinesChartRatioEl.appendChild(chartLanded)
    }
  }

  function syncCodeLinesChartLegend(headline) {
    if (r.codeLinesLegendPendingEl) {
      const showPending = !!(headline && headline.pending > 0)
      r.codeLinesLegendPendingEl.hidden = !showPending
      if (showPending) {
        r.setText(
          r.codeLinesLegendPendingEl,
          r.t('codeLines.stillAhead', { branch: r.codeLinesDefaultBranch }),
        )
      }
    }
    if (r.codeLinesLegendAllEl) {
      const showAll = !!(headline && headline.allEdited > 0)
      r.codeLinesLegendAllEl.hidden = !showAll
      if (showAll) {
        r.setText(r.codeLinesLegendAllEl, r.t('codeLines.allProjects'))
      }
    }
  }



  function formatCodeLinesCount(n) {
    if (n === null || n === undefined || !isFinite(n)) {
      return '—'
    }
    return Math.trunc(n).toLocaleString('en-US')
  }

  function formatCodeLinesRange(label) {
    if (!label) {
      return ''
    }
    function nice(raw) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw).trim())
      if (!match) {
        return String(raw).trim()
      }
      return Number(match[3]) + '.' + match[2] + '.' + match[1]
    }
    const parts = String(label).split(' → ')
    if (parts.length === 2) {
      return nice(parts[0]) + ' – ' + nice(parts[1])
    }
    return nice(label)
  }

  function formatEffectiveness(ratio) {
    if (ratio === null || ratio === undefined || !isFinite(ratio)) {
      return '—'
    }
    return r.t('codeLines.landed', { n: Math.round(ratio * 100) })
  }

  function formatShareFormula(parts, denom) {
    const numer = parts.reduce(function (sum, n) {
      return sum + n
    }, 0)
    const pct = denom > 0 ? Math.round((numer / denom) * 100) : 0
    const left = parts.map(formatCodeLinesCount).join(' + ')
    const wrapped = parts.length > 1 ? '(' + left + ')' : left
    const denomText = formatCodeLinesCount(denom)
    const pctText = pct + '%'
    return {
      left: wrapped,
      denom: denomText,
      pct: pctText,
      text: wrapped + ' / ' + denomText + ' = ' + pctText,
    }
  }

  function codeLinesHeadline(summary) {
    const raw = summary || {}
    const ai = typeof raw.ai === 'number' ? raw.ai : null
    const allEdited =
      typeof raw.allEdited === 'number' && isFinite(raw.allEdited)
        ? raw.allEdited
        : ai
    const onMaster =
      typeof raw.onMaster === 'number' && isFinite(raw.onMaster)
        ? raw.onMaster
        : typeof raw.merged === 'number'
          ? raw.merged
          : null
    const pending =
      typeof raw.pending === 'number' && isFinite(raw.pending) ? raw.pending : 0
    const aiN = ai === null ? 0 : ai
    const onMasterN = onMaster === null ? 0 : onMaster
    return {
      ai: aiN,
      allEdited: allEdited === null ? 0 : allEdited,
      onMaster: onMasterN,
      pending: pending,
      rangeText: formatCodeLinesRange(raw.rangeLabel),
      rateFormula:
        aiN > 0 && onMasterN > 0 ? formatShareFormula([onMasterN], aiN) : null,
      landedFormula:
        aiN > 0 && pending > 0
          ? formatShareFormula([onMasterN, pending], aiN)
          : null,
    }
  }

  function shareFormulaText(formula) {
    if (!formula) {
      return ''
    }
    if (typeof formula === 'string') {
      return formula
    }
    return formula.text || ''
  }

  function appendCodeLinesFormulaCells(grid, formula, caption, hero) {
    if (!formula || !formula.left) {
      return
    }
    const heroClass = hero ? ' is-hero' : ''
    const left = r.el('span', 'code-lines-formula-left' + heroClass)
    r.setText(left, formula.left)
    grid.appendChild(left)
    const slash = r.el('span', 'code-lines-formula-op' + heroClass)
    r.setText(slash, '/')
    grid.appendChild(slash)
    const den = r.el('span', 'code-lines-formula-den' + heroClass)
    r.setText(den, formula.denom || '')
    grid.appendChild(den)
    const eq = r.el('span', 'code-lines-formula-op' + heroClass)
    r.setText(eq, '=')
    grid.appendChild(eq)
    const pct = r.el('span', 'code-lines-formula-pct' + heroClass)
    r.setText(pct, formula.pct || '')
    grid.appendChild(pct)
    const note = r.el('span', 'code-lines-formula-caption')
    if (caption) {
      r.setText(note, caption)
    }
    grid.appendChild(note)
  }

  function codeLinesFormulas(rows) {
    const grid = r.el('div', 'code-lines-formulas')
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row.formula) {
        continue
      }
      appendCodeLinesFormulaCells(grid, row.formula, row.caption, row.hero)
    }
    return grid.childNodes.length > 0 ? grid : null
  }

  function codeLinesCollapsedFormula(formula, caption) {
    if (!formula) {
      return null
    }
    const details = r.el('details', 'code-lines-repos code-lines-landed')
    details.open = r.codeLinesLandedOpen === true
    const summaryEl = r.el('summary', 'code-lines-repos-summary')
    r.setText(summaryEl, caption)
    details.appendChild(summaryEl)
    const formulas = codeLinesFormulas([
      { formula: formula, caption: '', hero: false },
    ])
    if (formulas) {
      details.appendChild(formulas)
    }
    details.addEventListener('toggle', function () {
      r.codeLinesLandedOpen = details.open === true
    })
    return details
  }

  function codeLinesFormulaRow(formula, caption, hero) {
    if (formula && typeof formula === 'object') {
      return codeLinesFormulas([
        { formula: formula, caption: caption, hero: hero },
      ])
    }
    const row = r.el(
      'p',
      'code-lines-formula-row' + (hero ? ' is-hero' : ''),
    )
    const value = r.el('span', 'code-lines-formula')
    r.setText(value, formula)
    row.appendChild(value)
    if (caption) {
      const note = r.el('span', 'code-lines-formula-caption')
      r.setText(note, caption)
      row.appendChild(note)
    }
    return row
  }

  function codeLinesInfoBlock(title, formula, body) {
    const block = r.el('article', 'code-lines-info-block')
    const heading = r.el('h4')
    r.setText(heading, title)
    block.appendChild(heading)
    if (formula) {
      const formulaEl = r.el('p', 'code-lines-info-formula')
      r.setText(formulaEl, formula)
      block.appendChild(formulaEl)
    }
    const text = r.el('p')
    r.setText(text, body)
    block.appendChild(text)
    return block
  }

  function withAuthorsDraft(choice) {
    const draft = r.codeLinesAuthorsDraft
    if (!draft || !choice || !Array.isArray(choice.accounts)) {
      return choice
    }
    const picked = Object.create(null)
    const emails = Array.isArray(draft.emails) ? draft.emails : []
    for (let i = 0; i < emails.length; i++) {
      picked[emails[i]] = true
    }
    const accounts = []
    for (let i = 0; i < choice.accounts.length; i++) {
      const account = choice.accounts[i]
      if (!account) {
        continue
      }
      accounts.push({
        email: account.email,
        name: account.name,
        selected: picked[account.email] === true,
        cursorAccount: account.cursorAccount === true,
      })
    }
    return {
      sumMultiple: draft.sumMultiple === true,
      accounts: accounts,
    }
  }

  function codeLinesAuthorsBlock(choice) {
    const accounts =
      choice && Array.isArray(choice.accounts) ? choice.accounts : []
    const block = r.el('article', 'code-lines-info-block is-authors')
    const heading = r.el('h4')
    r.setText(heading, r.t('codeLines.infoAuthorsTitle'))
    block.appendChild(heading)
    const text = r.el('p')
    r.setText(text, r.t('codeLines.infoAuthorsBody'))
    block.appendChild(text)
    if (accounts.length === 0) {
      const empty = r.el('p', 'code-lines-authors-empty')
      r.setText(empty, r.t('codeLines.noAuthors'))
      block.appendChild(empty)
      return block
    }
    let sumMultiple = choice.sumMultiple === true
    const sumRow = r.el('label', 'code-lines-author-sum')
    const sumBox = r.el('input')
    sumBox.type = 'checkbox'
    sumBox.checked = sumMultiple
    const sumCopy = r.el('span')
    const sumTitle = r.el('span', 'code-lines-author-sum-title')
    r.setText(sumTitle, r.t('codeLines.sumAccounts'))
    const sumHint = r.el('span', 'code-lines-author-sum-hint')
    r.setText(sumHint, r.t('codeLines.sumAccountsHint'))
    sumCopy.appendChild(sumTitle)
    sumCopy.appendChild(sumHint)
    sumRow.appendChild(sumBox)
    sumRow.appendChild(sumCopy)
    block.appendChild(sumRow)
    const list = r.el('div', 'code-lines-author-list')
    const boxes = []
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i]
      const row = r.el('label', 'code-lines-author-row')
      const box = r.el('input')
      box.type = 'checkbox'
      box.value = account.email
      box.checked = account.selected === true
      boxes.push(box)
      const meta = r.el('span', 'code-lines-author-meta')
      const name = r.el('span', 'code-lines-author-name')
      r.setText(name, account.name || account.email)
      const email = r.el('span', 'code-lines-author-email')
      r.setText(email, account.email)
      meta.appendChild(name)
      meta.appendChild(email)
      row.appendChild(box)
      row.appendChild(meta)
      if (account.cursorAccount === true) {
        const badge = r.el('span', 'code-lines-author-badge')
        r.setText(badge, r.t('codeLines.cursorAccount'))
        row.appendChild(badge)
      }
      list.appendChild(row)
    }
    block.appendChild(list)
    function selectedEmails() {
      const emails = []
      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].checked) {
          emails.push(boxes[i].value)
        }
      }
      return emails
    }
    function enforceSingle() {
      if (sumMultiple) {
        return
      }
      let kept = false
      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].checked && !kept) {
          kept = true
          continue
        }
        boxes[i].checked = false
      }
      if (!kept && boxes[0]) {
        boxes[0].checked = true
      }
    }
    function saveAuthorsDraft() {
      r.codeLinesAuthorsDraft = {
        sumMultiple: sumMultiple,
        emails: selectedEmails(),
      }
    }
    sumBox.addEventListener('change', function () {
      sumMultiple = sumBox.checked === true
      enforceSingle()
      saveAuthorsDraft()
    })
    for (let i = 0; i < boxes.length; i++) {
      boxes[i].addEventListener('change', function (event) {
        if (sumMultiple) {
          saveAuthorsDraft()
          return
        }
        const target = event.target
        for (let j = 0; j < boxes.length; j++) {
          boxes[j].checked = boxes[j] === target
        }
        target.checked = true
        saveAuthorsDraft()
      })
    }
    const apply = r.el('button', 'code-lines-authors-apply')
    apply.type = 'button'
    r.setText(apply, r.t('codeLines.applyAuthors'))
    apply.addEventListener('click', function () {
      const emails = selectedEmails()
      if (emails.length === 0) {
        return
      }
      r.vscode.postMessage({
        type: messageType.setCodeLinesAuthors,
        emails: emails,
        sumMultiple: sumMultiple,
      })
    })
    block.appendChild(apply)
    return block
  }

  function dismissCodeLinesInfo() {
    if (r.codeLinesInfoRebuilding === true) {
      return
    }
    r.codeLinesInfoOpen = false
    r.codeLinesInfoScroll = 0
    r.codeLinesInfoFocus = ''
    r.codeLinesAuthorsDraft = null
  }

  function openCodeLinesInfoDialog(dialog) {
    r.codeLinesInfoOpen = true
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) {
        dialog.showModal()
      }
      return
    }
    dialog.setAttribute('open', '')
  }

  function closeCodeLinesInfoDialog(dialog) {
    dismissCodeLinesInfo()
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close()
      return
    }
    dialog.removeAttribute('open')
  }

  function codeLinesInfoFocusKey(node, dialog) {
    if (!node || typeof node.closest !== 'function' || !dialog.contains(node)) {
      return ''
    }
    if (node.classList && node.classList.contains('code-lines-info-close')) {
      return 'close'
    }
    if (node.classList && node.classList.contains('code-lines-authors-apply')) {
      return 'apply'
    }
    if (node.closest('.code-lines-author-sum')) {
      return 'sum'
    }
    const row = node.closest('.code-lines-author-row')
    if (!row) {
      return ''
    }
    const box = row.querySelector('input')
    return box && box.value ? 'email:' + box.value : ''
  }

  function restoreCodeLinesInfoFocus(dialog) {
    const key = r.codeLinesInfoFocus || ''
    let target = null
    if (key === 'close') {
      target = dialog.querySelector('.code-lines-info-close')
    } else if (key === 'apply') {
      target = dialog.querySelector('.code-lines-authors-apply')
    } else if (key === 'sum') {
      target = dialog.querySelector('.code-lines-author-sum input')
    } else if (key.indexOf('email:') === 0) {
      const email = key.slice('email:'.length)
      const boxes = dialog.querySelectorAll('.code-lines-author-row input')
      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].value === email) {
          target = boxes[i]
          break
        }
      }
    }
    if (target && typeof target.focus === 'function') {
      target.focus()
    }
  }

  function codeLinesInfoDialog(input) {
    const dialog = r.el('dialog', 'code-lines-info-dialog')
    const panel = r.el('div', 'code-lines-info-panel')
    const head = r.el('div', 'code-lines-info-head')
    const heading = r.el('h4', 'code-lines-info-title')
    r.setText(heading, r.t('codeLines.infoTitle'))
    const closeBtn = r.el('button', 'code-lines-info-close')
    closeBtn.type = 'button'
    r.setText(closeBtn, r.t('codeLines.infoClose'))
    closeBtn.addEventListener('click', function () {
      closeCodeLinesInfoDialog(dialog)
    })
    head.appendChild(heading)
    head.appendChild(closeBtn)
    panel.appendChild(head)
    panel.appendChild(codeLinesAuthorsBlock(withAuthorsDraft(input.authors)))
    panel.appendChild(
      codeLinesInfoBlock(
        r.t('codeLines.infoWindowTitle'),
        input.rangeText || null,
        r.t('codeLines.infoWindowBody'),
      ),
    )
    panel.appendChild(
      codeLinesInfoBlock(
        r.t('codeLines.yourRate'),
        shareFormulaText(input.rateFormula) || null,
        r.t('codeLines.infoRateBody', { branch: input.branch }),
      ),
    )
    panel.appendChild(
      codeLinesInfoBlock(
        r.t('codeLines.ifLanded', { branch: input.branch }),
        shareFormulaText(input.landedFormula) || null,
        r.t('codeLines.infoLandedBody', { branch: input.branch }),
      ),
    )
    if (input.dollarsSummary) {
      panel.appendChild(
        codeLinesInfoBlock(
          r.t('codeLines.infoDollarsTitle'),
          input.dollarsSummary,
          r.t('codeLines.infoDollarsBody'),
        ),
      )
    }
    panel.appendChild(
      codeLinesInfoBlock(
        r.t('codeLines.allProjects'),
        input.allLabel,
        r.t('codeLines.infoAllBody'),
      ),
    )
    panel.appendChild(
      codeLinesInfoBlock(
        r.t('codeLines.reposToggle', { n: input.repoCount }),
        null,
        r.t('codeLines.infoReposBody'),
      ),
    )
    dialog.appendChild(panel)
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) {
        closeCodeLinesInfoDialog(dialog)
      }
    })
    dialog.addEventListener('cancel', function () {
      dismissCodeLinesInfo()
    })
    dialog.addEventListener('close', function () {
      if (r.codeLinesInfoRebuilding === true || !dialog.isConnected) {
        return
      }
      dismissCodeLinesInfo()
    })
    dialog.addEventListener('scroll', function () {
      r.codeLinesInfoScroll = dialog.scrollTop
    })
    dialog.addEventListener('focusin', function () {
      const key = codeLinesInfoFocusKey(document.activeElement, dialog)
      if (key) {
        r.codeLinesInfoFocus = key
      }
    })
    return dialog
  }

  function restoreCodeLinesInfo(root) {
    if (r.codeLinesInfoOpen !== true || !root || typeof root.querySelector !== 'function') {
      return
    }
    const dialog = root.querySelector('dialog.code-lines-info-dialog')
    if (!dialog) {
      return
    }
    openCodeLinesInfoDialog(dialog)
    const scroll = r.codeLinesInfoScroll || 0
    dialog.scrollTop = scroll
    restoreCodeLinesInfoFocus(dialog)
    dialog.scrollTop = scroll
    requestAnimationFrame(function () {
      if (dialog.isConnected && r.codeLinesInfoOpen === true) {
        dialog.scrollTop = scroll
      }
    })
  }

  function codeLinesCard(codeLines) {
    const summary = codeLines.summary || {}
    const headline = codeLinesHeadline(summary)
    const allEdited = headline.allEdited
    const allScale = Math.max(allEdited, 1)
    const branch = codeLines.defaultBranch || 'main'
    const rangeText = headline.rangeText
    const rateFormula = headline.rateFormula
    const landedFormula = headline.landedFormula
    const repos = Array.isArray(codeLines.repos) ? codeLines.repos : []
    const visibleRepos = []
    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i]
      if (!repo) {
        continue
      }
      const edited =
        typeof repo.edited === 'number' && isFinite(repo.edited) ? repo.edited : 0
      if (edited <= 0) {
        continue
      }
      visibleRepos.push({
        label: repo.label || r.t('codeLines.otherRepos'),
        edited: edited,
        current: repo.current === true,
      })
    }
    const dollars = codeLines.dollars || null
    const dollarsSummary =
      dollars && typeof dollars.summary === 'string' && dollars.summary
        ? dollars.summary
        : ''
    const card = r.el('article', 'status-block is-code-lines')
    const head = r.el('div', 'code-lines-head')
    const title = r.el('h3')
    title.appendChild(document.createTextNode(r.t('codeLines.cardTitle')))
    if (rangeText) {
      const rangeEl = r.el('span', 'code-lines-title-range')
      r.setText(rangeEl, ' (' + rangeText + ')')
      title.appendChild(rangeEl)
    }
    head.appendChild(title)
    const dialog = codeLinesInfoDialog({
      rangeText: rangeText,
      branch: branch,
      rateFormula: rateFormula,
      landedFormula: landedFormula,
      dollarsSummary: dollarsSummary || null,
      authors: codeLines.authors || null,
      allLabel:
        allEdited !== null && allEdited > 0
          ? formatCodeLinesCount(allEdited)
          : null,
      repoCount: visibleRepos.length,
    })
    const infoBtn = r.el('button', 'code-lines-info-btn')
    infoBtn.type = 'button'
    infoBtn.setAttribute('aria-label', r.t('codeLines.infoAria'))
    infoBtn.title = r.t('codeLines.infoAria')
    const infoMark = r.el('span', 'code-lines-info-mark')
    infoMark.appendChild(document.createTextNode('?'))
    infoBtn.appendChild(infoMark)
    infoBtn.addEventListener('click', function (event) {
      event.preventDefault()
      event.stopPropagation()
      openCodeLinesInfoDialog(dialog)
    })
    head.appendChild(infoBtn)
    card.appendChild(head)
    card.appendChild(dialog)
    const formulas = codeLinesFormulas([
      {
        formula: rateFormula,
        caption: r.t('codeLines.yourRate'),
        hero: true,
      },
    ])
    if (formulas) {
      card.appendChild(formulas)
    }
    if (dollarsSummary) {
      const dollarsEl = r.el('p', 'code-lines-dollars')
      r.setText(dollarsEl, dollarsSummary)
      card.appendChild(dollarsEl)
    }
    const landed = codeLinesCollapsedFormula(
      landedFormula,
      r.t('codeLines.ifLanded', { branch: branch }),
    )
    if (landed) {
      card.appendChild(landed)
    }
    const meters = r.el('div', 'meter-list meter-list-tight')
    if (allEdited !== null && allEdited > 0) {
      meters.appendChild(
        r.meterRow(
          r.t('codeLines.allProjects'),
          formatCodeLinesCount(allEdited),
          100,
          'share',
        ),
      )
    }
    if (visibleRepos.length > 0) {
      const details = r.el('details', 'code-lines-repos')
      details.open = r.codeLinesReposOpen === true
      const summaryEl = r.el('summary', 'code-lines-repos-summary')
      r.setText(
        summaryEl,
        r.t('codeLines.reposToggle', { n: visibleRepos.length }),
      )
      details.appendChild(summaryEl)
      const repoMeters = r.el('div', 'meter-list meter-list-tight')
      for (let i = 0; i < visibleRepos.length; i++) {
        const repo = visibleRepos[i]
        repoMeters.appendChild(
          r.meterRow(
            repo.label,
            formatCodeLinesCount(repo.edited),
            Math.round((repo.edited / allScale) * 100),
            repo.current ? 'share' : 'neutral',
          ),
        )
      }
      details.appendChild(repoMeters)
      details.addEventListener('toggle', function () {
        r.codeLinesReposOpen = details.open === true
      })
      meters.appendChild(details)
    }
    if (meters.childNodes.length > 0) {
      card.appendChild(meters)
    }
    return card
  }

  return {
    drawCodeLinesChart,
    renderCodeLinesChartRatio,
    syncCodeLinesChartLegend,
    codeLinesCard,
    restoreCodeLinesInfo,
  }
}
