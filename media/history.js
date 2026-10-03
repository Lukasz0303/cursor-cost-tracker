(function () {
  const vscode = acquireVsCodeApi()
  const SUPPORTED_LANGUAGES = {
    en: true,
    pl: true,
    'zh-cn': true,
    ja: true,
    es: true,
    'pt-br': true,
    ru: true,
    ko: true,
    fr: true,
    de: true,
  }
  function isSupportedLanguage(value) {
    return typeof value === 'string' && SUPPORTED_LANGUAGES[value] === true
  }
  const DOCUMENT_LANG = {
    en: 'en',
    pl: 'pl',
    'zh-cn': 'zh-CN',
    ja: 'ja',
    es: 'es',
    'pt-br': 'pt-BR',
    ru: 'ru',
    ko: 'ko',
    fr: 'fr',
    de: 'de',
  }
  function documentLangFor(value) {
    return DOCUMENT_LANG[value] || 'en'
  }
  const DEFAULT_OK = '#89D185'
  const DEFAULT_WARN = '#F14C4C'
  const rowsEl = document.getElementById('rows')
  const emptyEl = document.getElementById('empty')
  const statusEl = document.getElementById('status')
  const closeEl = document.getElementById('close')
  const thresholdEl = document.getElementById('threshold')
  const thresholdPreviewEl = document.getElementById('thresholdPreview')
  const historyLimitEl = document.getElementById('historyLimit')
  const historyFromDateEl = document.getElementById('historyFromDate')
  const fromMonthSettingEl = document.getElementById('fromMonthSetting')
  const fromTodaySettingEl = document.getElementById('fromTodaySetting')
  const clearFromDateSettingEl = document.getElementById('clearFromDateSetting')
  const filterSpikesOnlyEl = document.getElementById('filterSpikesOnly')
  const refreshQueriesEl = document.getElementById('refreshQueries')
  const showWarningEl = document.getElementById('showWarning')
  const showCriticalAlertEl = document.getElementById('showCriticalAlert')
  const criticalTokenEl = document.getElementById('criticalTokenThreshold')
  const criticalTokenPreviewEl = document.getElementById('criticalTokenPreview')
  const criticalCostEl = document.getElementById('criticalCostThreshold')
  const burnRateGuardEl = document.getElementById('burnRateGuard')
  const burnRateWindowEl = document.getElementById('burnRateWindowMinutes')
  const burnRateWarningUsdEl = document.getElementById('burnRateWarningUsd')
  const burnRateCriticalUsdEl = document.getElementById('burnRateCriticalUsd')
  const burnRateMinQueriesEl = document.getElementById('burnRateMinQueries')
  const burnRateWarningToastEl = document.getElementById('burnRateWarningToast')
  const burnRateCriticalToastEl = document.getElementById('burnRateCriticalToast')
  const codeLinesInsightEl = document.getElementById('codeLinesInsight')
  const chartCodeLinesEl = document.getElementById('chartCodeLines')
  const codeLinesChartCardEl = document.getElementById('codeLinesChartCard')
  const codeLinesChartRatioEl = document.getElementById('codeLinesChartRatio')
  const codeLinesLegendPendingEl = document.getElementById('codeLinesLegendPending')
  const codeLinesLegendAllEl = document.getElementById('codeLinesLegendAll')
  const showStatusBarEl = document.getElementById('showStatusBar')
  const showTodayEl = document.getElementById('showToday')
  const minimalModeEl = document.getElementById('minimalMode')
  const recentQueryCountEl = document.getElementById('recentQueryCount')
  const budgetDayBasisEl = document.getElementById('budgetDayBasis')
  const forecastWindowEl = document.getElementById('forecastWindow')
  const optimizeDepthSettingEl = document.getElementById('optimizeDepthSetting')
  const languageSettingEl = document.getElementById('languageSetting')
  const pollIntervalEl = document.getElementById('pollInterval')
  const statusBarPreviewEl = document.getElementById('statusBarPreview')
  const statusBarPreviewEmptyEl = document.getElementById('statusBarPreviewEmpty')
  const okColorEl = document.getElementById('okColor')
  const warnColorEl = document.getElementById('warnColor')
  const okColorValueEl = document.getElementById('okColorValue')
  const warnColorValueEl = document.getElementById('warnColorValue')
  const resetColorsEl = document.getElementById('resetColors')
  const settingsFormEl = document.getElementById('settingsForm')
  const queriesViewEl = document.getElementById('queriesView')
  const statsViewEl = document.getElementById('statsView')
  const statsEl = document.getElementById('stats')
  const statsChartTipEl = document.getElementById('statsChartTip')
  const chartsViewEl = document.getElementById('chartsView')
  const chartsEmptyEl = document.getElementById('chartsEmpty')
  const chartTokensEl = document.getElementById('chartTokens')
  const chartCostEl = document.getElementById('chartCost')
  const chartTipEl = document.getElementById('chartTip')
  const periodCardsEl = document.getElementById('periodCards')
  const optimizeViewEl = document.getElementById('optimizeView')
  const leaderboardViewEl = document.getElementById('leaderboardView')
  const optimizeEmptyEl = document.getElementById('optimizeEmpty')
  const optimizeContentEl = document.getElementById('optimizeContent')
  const optimizeSummaryEl = document.getElementById('optimizeSummary')
  const optimizeNoteEl = document.getElementById('optimizeNote')
  const optimizeLifetimeHeadingEl = document.getElementById(
    'optimizeLifetimeHeading',
  )
  const optimizeLifetimeEmptyEl = document.getElementById(
    'optimizeLifetimeEmpty',
  )
  const optimizeLifetimeProjectsEl = document.getElementById(
    'optimizeLifetimeProjects',
  )
  const optimizeFindingsEl = document.getElementById('optimizeFindings')
  const optimizeDepthCardsEl = document.getElementById('optimizeDepthCards')
  const runOptimizeToolbarEl = document.getElementById('runOptimizeToolbar')
  const supportViewEl = document.getElementById('supportView')
  const supportCommentsEl = document.getElementById('supportComments')
  const supportCommentsEmptyEl = document.getElementById('supportCommentsEmpty')
  const supportMessageFormEl = document.getElementById('supportMessageForm')
  const supportNicknameEl = document.getElementById('supportNickname')
  const supportEmailEl = document.getElementById('supportEmail')
  const supportReplyValueEl = document.getElementById('supportReplyValue')
  const supportConsentEl = document.getElementById('supportConsent')
  const supportCommentNoticeEl = document.getElementById('supportCommentNotice')
  const supportBodyEl = document.getElementById('supportBody')
  const supportSendEl = document.getElementById('supportSend')
  const supportMessageStatusEl = document.getElementById('supportMessageStatus')
  let supportNicknameDirty = false
  let supportEmailDirty = false
  let supportSending = false
  let leaderboardUnlocked = false
  let currentView = 'queries'
  let pendingLeaderboardTab = false
  /** Mirrors parseUnlockRequest in src/unlock/leaderboardUnlock.ts; the host still decides. */
  const UNLOCK_BODY = /^\s*unlock\s*:\s*[0-9a-z\s-]{6,64}\s*$/i
  const settingsViewEl = document.getElementById('settingsView')
  const tabQueriesEl = document.getElementById('tabQueries')
  const tabStatsEl = document.getElementById('tabStats')
  const tabChartsEl = document.getElementById('tabCharts')
  const tabOptimizeEl = document.getElementById('tabOptimize')
  const tabLeaderboardEl = document.getElementById('tabLeaderboard')
  const tabSupportEl = document.getElementById('tabSupport')
  const tabSettingsEl = document.getElementById('tabSettings')
  const extensionVersionEl = document.getElementById('extensionVersion')
  const toolbarVersionEl = document.querySelector('.toolbar-version')
  let debounceTimer = 0
  let colorTimer = 0
  let historyLimitDirty = false
  let historyFromDateDirty = false
  let pollIntervalDirty = false
  let thresholdDirty = false
  let criticalTokenDirty = false
  let criticalCostDirty = false
  let burnWindowDirty = false
  let burnWarningDirty = false
  let burnCriticalDirty = false
  let burnMinQueriesDirty = false
  const historyLimitEls = [historyLimitEl].filter(Boolean)
  const historyFromDateEls = [historyFromDateEl].filter(Boolean)
  let historyFromDate = ''
  let chartPoints = []
  let codeLinesSeries = []
  let codeLinesSummary = null
  let codeLinesDefaultBranch = 'master'
  let mtdForecastPoints = []
  let mtdForecastSeries = []
  let mtdUnit = 'usd'
  let mtdMax = null
  let mtdChartRange = 'month'
  let chartBarMode = 'cumulative'
  let mtdForecastSvgs = []
  let budgetDayBasis = 'workingDays'
  let forecastWindow = 'calendarMonth'
  let mtdResetDate = null
  let mtdResetMidday = false
  let optimizeDepth = 'balanced'
  let uiLanguage = 'en'
  let ui = null
  let chartResizeTimer = 0
  let tableEvents = []
  let tableWarnOn = true
  let tableBurnLevel = 'ok'
  let spikesOnly = false
  const MIN_HISTORY = 100
  const MAX_HISTORY = 10000
  const DEFAULT_HISTORY = 1000
  const MIN_POLL = 1
  const MAX_POLL = 60
  const DEFAULT_POLL = 1
  const MIN_RECENT_QUERY_COUNT = 1
  const MAX_RECENT_QUERY_COUNT = 10
  const DEFAULT_RECENT_QUERY_COUNT = 3
  const MIN_BURN_WINDOW = 2
  const MAX_BURN_WINDOW = 60
  const DEFAULT_BURN_WINDOW = 10
  const MIN_BURN_USD = 0.01
  const MAX_BURN_USD = 10000
  const DEFAULT_BURN_WARNING_USD = 2
  const DEFAULT_BURN_CRITICAL_USD = 5
  const MIN_BURN_QUERIES = 1
  const MAX_BURN_QUERIES = 50
  const DEFAULT_BURN_QUERIES = 2

  const BAR_ICON_PATHS = {
    'credit-card':
      'M2.5 3A1.5 1.5 0 0 0 1 4.5v7A1.5 1.5 0 0 0 2.5 13h11A1.5 1.5 0 0 0 15 11.5v-7A1.5 1.5 0 0 0 13.5 3h-11zm0 1h11a.5.5 0 0 1 .5.5V6H2V4.5a.5.5 0 0 1 .5-.5zM2 7.5h12v4a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-4z',
    calendar:
      'M5.75 1a.75.75 0 0 1 .75.75V3h3.5V1.75a.75.75 0 0 1 1.5 0V3H13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h1.5V1.75A.75.75 0 0 1 5.75 1zM3 4.5a.5.5 0 0 0-.5.5v1h11V5a.5.5 0 0 0-.5-.5H3zM2.5 7v6a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V7h-11z',
    // Codicon `sync` — same glyph as status-bar `$(sync)`.
    sync: 'M14 3.5v3c0 .28-.22.5-.5.5h-3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h2.08c-.8-1.83-2.57-3-4.58-3c-2.22 0-4.2 1.5-4.81 3.64c-.06.22-.26.36-.48.36c-.05 0-.09 0-.14-.02a.493.493 0 0 1-.34-.62C2.96 3.79 5.33 2 8 2c2.05 0 3.91 1.02 5 2.69V3.5c0-.28.22-.5.5-.5s.5.22.5.5m-.58 5.52a.51.51 0 0 0-.62.35a5.02 5.02 0 0 1-4.81 3.64c-2.01 0-3.78-1.17-4.58-3h2.08c.28 0 .5-.22.5-.5s-.22-.5-.5-.5h-3c-.28 0-.5.22-.5.5v3c0 .28.22.5.5.5s.5-.22.5-.5v-1.19a5.97 5.97 0 0 0 5 2.69c2.67 0 5.04-1.79 5.77-4.36a.5.5 0 0 0-.35-.62z',
    warning:
      'M8.86 2.49a1 1 0 0 0-1.72 0L1.2 12.26A1 1 0 0 0 2.06 13.8h11.88a1 1 0 0 0 .86-1.54L8.86 2.49zM8 6.25a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0V7A.75.75 0 0 1 8 6.25zM8.8 11.6a.8.8 0 1 1-1.6 0 .8.8 0 0 1 1.6 0z',
    loading:
      'M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm0 1.5a5 5 0 1 0 .01 10.01A5 5 0 0 0 8 3z',
  }

  function clampHistoryLimit(value) {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n)) {
      return DEFAULT_HISTORY
    }
    if (n < MIN_HISTORY) {
      return MIN_HISTORY
    }
    if (n > MAX_HISTORY) {
      return MAX_HISTORY
    }
    return n
  }

  function clampPollInterval(value) {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n)) {
      return DEFAULT_POLL
    }
    if (n < MIN_POLL) {
      return MIN_POLL
    }
    if (n > MAX_POLL) {
      return MAX_POLL
    }
    return n
  }

  function clampRecentQueryCount(value) {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n)) {
      return DEFAULT_RECENT_QUERY_COUNT
    }
    if (n < MIN_RECENT_QUERY_COUNT) {
      return MIN_RECENT_QUERY_COUNT
    }
    if (n > MAX_RECENT_QUERY_COUNT) {
      return MAX_RECENT_QUERY_COUNT
    }
    return n
  }

  function clampBurnWindow(value) {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n)) {
      return DEFAULT_BURN_WINDOW
    }
    if (n < MIN_BURN_WINDOW) {
      return MIN_BURN_WINDOW
    }
    if (n > MAX_BURN_WINDOW) {
      return MAX_BURN_WINDOW
    }
    return n
  }

  function clampBurnUsd(value, fallback) {
    const n = Math.round(Number(value) * 100) / 100
    if (!Number.isFinite(n)) {
      return fallback
    }
    if (n < MIN_BURN_USD) {
      return MIN_BURN_USD
    }
    if (n > MAX_BURN_USD) {
      return MAX_BURN_USD
    }
    return n
  }

  function clampBurnMinQueries(value) {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n)) {
      return DEFAULT_BURN_QUERIES
    }
    if (n < MIN_BURN_QUERIES) {
      return MIN_BURN_QUERIES
    }
    if (n > MAX_BURN_QUERIES) {
      return MAX_BURN_QUERIES
    }
    return n
  }

  function pad2(n) {
    return n < 10 ? '0' + String(n) : String(n)
  }

  function isoFromLocal(date) {
    return (
      date.getFullYear() +
      '-' +
      pad2(date.getMonth() + 1) +
      '-' +
      pad2(date.getDate())
    )
  }

  function startOfMonthIso() {
    const now = new Date()
    return now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-01'
  }

  function parseFromDate(value) {
    if (typeof value !== 'string') {
      return ''
    }
    const trimmed = value.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return ''
    }
    const parts = trimmed.split('-')
    const year = Number(parts[0])
    const month = Number(parts[1])
    const day = Number(parts[2])
    const date = new Date(year, month - 1, day)
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return ''
    }
    return trimmed
  }

  function formatFromDateLabel(iso) {
    const parsed = parseFromDate(iso)
    if (!parsed) {
      return ''
    }
    const parts = parsed.split('-')
    return Number(parts[2]) + '.' + parts[1] + '.' + parts[0]
  }

  function lastHeading(limit) {
    if (historyFromDate) {
      return t('queries.fromHeading', {
        date: formatFromDateLabel(historyFromDate),
      })
    }
    return t('queries.lastHeading', { n: clampHistoryLimit(limit) })
  }

  function applyHistoryTitle(limit) {
    const title = historyFromDate
      ? t('queries.fromTitle', {
          date: formatFromDateLabel(historyFromDate),
        })
      : t('queries.lastTitle', { n: clampHistoryLimit(limit) })
    if (tabQueriesEl) {
      setText(tabQueriesEl, title)
    }
    document.title = title
  }

  function formatVersionLabel(raw) {
    if (typeof raw !== 'string') {
      return ''
    }
    const trimmed = raw.trim()
    if (
      trimmed === '' ||
      trimmed === '__EXTENSION_VERSION__' ||
      trimmed === 'v__EXTENSION_VERSION__' ||
      trimmed.indexOf('{{') !== -1
    ) {
      return ''
    }
    return trimmed.charAt(0) === 'v' ? trimmed : 'v' + trimmed
  }

  function applyVersion(raw) {
    const label = formatVersionLabel(raw)
    if (!label) {
      return
    }
    if (extensionVersionEl) {
      setText(extensionVersionEl, label)
    }
    if (toolbarVersionEl) {
      setText(toolbarVersionEl, label)
    }
  }

  function applyRefreshing(refreshing) {
    if (!refreshQueriesEl) {
      return
    }
    const busy = refreshing === true
    refreshQueriesEl.disabled = busy
    refreshQueriesEl.setAttribute('aria-busy', busy ? 'true' : 'false')
    const label = busy ? t('toolbar.refreshing') : t('toolbar.refresh')
    if (label) {
      refreshQueriesEl.title = label
      refreshQueriesEl.setAttribute('aria-label', label)
    }
    const icon = refreshQueriesEl.querySelector('.bar-icon')
    if (icon) {
      if (busy) {
        icon.classList.add('is-spin')
      } else {
        icon.classList.remove('is-spin')
      }
    }
  }

  function setText(el, text) {
    el.textContent = text
  }

  function interpolate(template, vars) {
    if (typeof template !== 'string') {
      return ''
    }
    const map = vars && typeof vars === 'object' ? vars : {}
    return template.replace(/\{(\w+)\}/g, function (match, key) {
      if (!Object.prototype.hasOwnProperty.call(map, key)) {
        return match
      }
      return String(map[key])
    })
  }

  function lookupPath(root, path) {
    if (!root || typeof path !== 'string') {
      return undefined
    }
    const parts = path.split('.')
    let cur = root
    for (let i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined || typeof cur !== 'object') {
        return undefined
      }
      cur = cur[parts[i]]
    }
    return cur
  }

  function t(path, vars) {
    const value = lookupPath(ui, path)
    if (typeof value !== 'string') {
      return path
    }
    return vars ? interpolate(value, vars) : value
  }

  function depthLabel(depth) {
    if (depth === 'quick') {
      return t('depth.quick')
    }
    if (depth === 'deep') {
      return t('depth.deep')
    }
    return t('depth.balanced')
  }

  function applyStaticI18n() {
    if (!ui) {
      return
    }
    document.documentElement.lang = documentLangFor(uiLanguage)
    const textNodes = document.querySelectorAll('[data-i18n]')
    for (let i = 0; i < textNodes.length; i++) {
      const el = textNodes[i]
      const key = el.getAttribute('data-i18n')
      const value = lookupPath(ui, key)
      if (typeof value === 'string') {
        if (el.getAttribute('data-i18n-html') === 'true') {
          el.innerHTML = value
        } else {
          setText(el, value)
        }
      }
    }
    const titleNodes = document.querySelectorAll('[data-i18n-title]')
    for (let i = 0; i < titleNodes.length; i++) {
      const el = titleNodes[i]
      const value = lookupPath(ui, el.getAttribute('data-i18n-title'))
      if (typeof value === 'string') {
        el.title = value
      }
    }
    const placeholderNodes = document.querySelectorAll('[data-i18n-placeholder]')
    for (let i = 0; i < placeholderNodes.length; i++) {
      const el = placeholderNodes[i]
      const value = lookupPath(ui, el.getAttribute('data-i18n-placeholder'))
      if (typeof value === 'string') {
        el.placeholder = value
      }
    }
    const ariaNodes = document.querySelectorAll('[data-i18n-aria]')
    for (let i = 0; i < ariaNodes.length; i++) {
      const el = ariaNodes[i]
      const value = lookupPath(ui, el.getAttribute('data-i18n-aria'))
      if (typeof value === 'string') {
        el.setAttribute('aria-label', value)
      }
    }
    markLbSort()
    syncAuthorTools()
    syncLeaderboardReposToggle()
    syncDailyChartMode()
    if (lbRepoPayload) {
      renderLeaderboardRepos(lbRepoPayload)
    }
  }

  function addCell(tr, text, className) {
    const td = document.createElement('td')
    setText(td, text)
    if (className) {
      td.className = className
    }
    tr.appendChild(td)
  }

  function el(tag, className) {
    const node = document.createElement(tag)
    if (className) {
      node.className = className
    }
    return node
  }

  let lbRows = []
  let lbSortKey = 'linesMerged'
  let lbSortDir = 'desc'
  let lbScanning = false
  let lbAuthorsOpen = true
  let lbReposOpen = false
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
      setText(toggle, lbAuthorsOpen ? t('leaderboard.collapse') : t('leaderboard.expand'))
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
      setText(selectAll, allOn ? t('leaderboard.clearAll') : t('leaderboard.selectAll'))
      const merge = document.getElementById('lbMerge')
      if (merge) {
        merge.disabled = lbScanning || checkedRows < 2
      }
    }
    if (manual) {
      manual.placeholder = t('leaderboard.manualPlaceholder')
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
      setText(scan, lbScanning ? t('leaderboard.scanning') : t('leaderboard.scan'))
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
      setText(meta, '')
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
      const label = i18nKey ? lookupPath(ui, i18nKey) : ''
      const base = typeof label === 'string' ? label : ''
      const arrow = key === lbSortKey ? (lbSortDir === 'asc' ? ' ↑' : ' ↓') : ''
      setText(buttons[i], base + arrow)
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
    const head = el('div', 'lb-chart-head')
    const title = el('h3', 'lb-chart-title')
    setText(title, t('leaderboard.chartTitle'))
    const mode = el('label', 'lb-chart-mode')
    const daily = el('span')
    setText(daily, t('leaderboard.chartDaily'))
    const monthly = el('span')
    setText(monthly, t('leaderboard.chartMonthly'))
    const toggle = document.createElement('input')
    toggle.type = 'checkbox'
    toggle.className = 'settings-switch'
    toggle.checked = lbChartMonthly
    toggle.setAttribute('aria-label', t('leaderboard.chartMonthly'))
    toggle.addEventListener('change', function () {
      lbChartMonthly = toggle.checked
      paintLeaderboardChart(lbChartPayload)
    })
    mode.appendChild(daily)
    mode.appendChild(toggle)
    mode.appendChild(monthly)
    head.appendChild(title)
    head.appendChild(mode)
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
          name: plotSeries[s].name || plotSeries[s].email,
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
      const x = xAt(index)
      const guide = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      guide.setAttribute('x1', String(x))
      guide.setAttribute('x2', String(x))
      guide.setAttribute('y1', String(top))
      guide.setAttribute('y2', String(top + plotH))
      guide.setAttribute('class', 'lb-chart-grid')
      svg.appendChild(guide)
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      label.setAttribute('x', String(xAt(index)))
      label.setAttribute('y', String(height - 8))
      label.setAttribute('class', 'lb-chart-label')
      label.setAttribute('text-anchor', index === plotDates.length - 1 ? 'end' : 'middle')
      label.textContent = leaderboardAxisLabel(plotDates[index])
      svg.appendChild(label)
    }
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
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    hit.setAttribute('x', String(left))
    hit.setAttribute('y', String(top))
    hit.setAttribute('width', String(plotW))
    hit.setAttribute('height', String(plotH))
    hit.setAttribute('fill', 'transparent')
    hit.setAttribute('class', 'lb-chart-hit')
    const tip = el('div', 'chart-tip lb-chart-tip')
    tip.hidden = true
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
      tip.appendChild(tipTitle(series.name))
      tip.appendChild(tipSub(leaderboardAxisLabel(plotDates[index])))
      const value = el('p', 'chart-tip-title')
      setText(value, formatLeaderboardCount(series.running[index] || 0))
      tip.appendChild(value)
      placeTip(tip, host, event.clientX, event.clientY)
    })
    hit.addEventListener('mouseleave', hideLineTip)
    svg.appendChild(hit)
    host.appendChild(svg)
    host.appendChild(tip)
    const legend = el('div', 'lb-chart-legend')
    for (let s = 0; s < drawn.length; s++) {
      const item = el('span', 'lb-chart-key')
      const swatch = el('i')
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
      const pick = document.createElement('label')
      pick.className = 'lb-line-pick'
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.checked = !lbChartHidden.has(lineKey)
      box.setAttribute('aria-label', row.name || row.email || '')
      const swatch = el('i', 'lb-line-swatch')
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
      const name = el('div', 'lb-name')
      setText(name, row.name)
      const mail = el('div', 'lb-email')
      const addresses =
        row.emails && row.emails.length ? row.emails : [row.email]
      setText(mail, addresses.join('\n'))
      who.appendChild(pick)
      who.appendChild(name)
      who.appendChild(mail)
      tr.appendChild(who)
      addCell(tr, formatLeaderboardCount(row.linesMerged), 'lb-added')
      addCell(tr, formatLeaderboardCount(row.commits), 'lb-num')
      addCell(tr, formatLeaderboardCount(row.linesDeleted), 'lb-deleted')
      addCell(tr, formatLeaderboardCount(row.netLines), 'lb-num')
      addCell(tr, formatLeaderboardCount(row.activeDays), 'lb-num')
      const repos = document.createElement('td')
      if (!row.repositories || row.repositories.length === 0) {
        setText(repos, t('leaderboard.none'))
      } else {
        const extra = row.repositories.length > 1
        const chips = el('div', 'lb-repos' + (extra && !lbReposOpen ? ' is-collapsed' : ''))
        for (let r = 0; r < row.repositories.length; r++) {
          const repo = row.repositories[r]
          const chip = el('span', r === 0 ? 'lb-repo' : 'lb-repo lb-repo-extra')
          const name = el('span', 'lb-repo-name')
          setText(name, repo.label)
          const lines = el('span', 'lb-repo-lines')
          setText(lines, '(' + formatLeaderboardCount(repo.linesMerged) + ')')
          chip.appendChild(name)
          chip.appendChild(lines)
          chip.title = repo.path
          chips.appendChild(chip)
        }
        if (extra) {
          const more = el('span', 'lb-repo lb-repo-more')
          setText(more, '+' + String(row.repositories.length - 1))
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
    setText(btn, lbReposOpen ? t('leaderboard.collapseRepos') : t('leaderboard.expandRepos'))
  }

  function appendLeaderboardAuthor(authors, person, checked, manual) {
    const emails = person.emails && person.emails.length ? person.emails : [person.email]
    const label = el('label', 'lb-author')
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.value = emails[0]
    box.setAttribute('data-emails', emails.join('\n'))
    box.checked = checked
    box.addEventListener('change', function () {
      syncLeaderboardButtons()
      syncAuthorTools()
    })
    const text = el('span')
    const mailLine = emails.join(', ')
    const same = lbEmailKey(person.name) === lbEmailKey(emails[0])
    setText(text, same || !person.name ? mailLine : person.name + ' · ' + mailLine)
    label.appendChild(box)
    label.appendChild(text)
    if (person.merged) {
      const split = document.createElement('button')
      split.type = 'button'
      split.className = 'action-btn lb-author-remove'
      setText(split, t('leaderboard.unmergeEmails'))
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
      setText(remove, t('leaderboard.removeEmail'))
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
      setText(status, errorText || '')
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
    vscode.postMessage({ type: 'saveLeaderboardMerges', groups: groups })
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
        setText(status, t('leaderboard.invalidEmail'))
      }
      return
    }
    if (status) {
      status.hidden = true
      setText(status, '')
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
        setText(status, t('leaderboard.teamEmpty'))
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
      setText(status, data.status)
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
      lbReposOpen = false
      lbChartHidden.clear()
      lbRows = Array.isArray(payload.rows) ? payload.rows : []
      const meta = document.getElementById('lbMeta')
      if (meta) {
        setText(
          meta,
          t('leaderboard.meta', {
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
        setText(meta, payload.error || t('leaderboard.error'))
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
      errorText = t('leaderboard.catalogMissing')
    }
    if (status) {
      status.hidden = !errorText
      setText(status, errorText || '')
    }
    if (count) {
      let selected = 0
      for (let i = 0; i < repos.length; i++) {
        if (repos[i].included !== false) {
          selected++
        }
      }
      setText(
        count,
        repos.length === 0
          ? t('leaderboard.reposEmpty')
          : t('leaderboard.repoSelected', { n: String(selected), total: String(repos.length) }),
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
      box.setAttribute('aria-label', t('leaderboard.includeRepo'))
      box.addEventListener('change', function () {
        vscode.postMessage({
          type: 'setLeaderboardRepoIncluded',
          path: repo.path,
          included: box.checked,
        })
      })
      row.appendChild(box)
      const path = el('span', 'lb-repo-path')
      setText(path, repo.label + '  ' + repo.path)
      path.title = repo.path
      const tag = el('span', 'lb-repo-tag')
      setText(tag, repo.source === 'extra' ? t('leaderboard.extraRepo') : t('leaderboard.discoveredRepo'))
      row.appendChild(path)
      row.appendChild(tag)
      if (repo.source === 'extra') {
        const remove = document.createElement('button')
        remove.type = 'button'
        remove.className = 'action-btn lb-author-remove'
        setText(remove, t('leaderboard.removeRepo'))
        remove.addEventListener('click', function () {
          vscode.postMessage({ type: 'removeLeaderboardRepo', path: repo.path })
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
      setText(titleEl, title)
    }
    if (noteEl) {
      noteEl.hidden = !note
      setText(noteEl, note || '')
    }
    list.textContent = ''
    const rows = Array.isArray(items) ? items : []
    for (let i = 0; i < rows.length; i++) {
      const item = rows[i]
      const li = document.createElement('li')
      setText(li, item.path ? item.label + '  ' + item.path : item.label)
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

  function wireLeaderboard() {
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
          t('leaderboard.confirmTeam'),
          lbTeamEmails.map(function (email) {
            return { label: email, path: '' }
          }),
          lbTeamEmails.length === 0 ? t('leaderboard.teamEmpty') : '',
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
        vscode.postMessage({ type: 'previewLeaderboardMyRepos' })
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
        vscode.postMessage({ type: 'saveLeaderboardTeam', emails: emails })
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
        vscode.postMessage({
          type: 'loadLeaderboardAuthors',
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
        vscode.postMessage({
          type: 'runLeaderboardScan',
          from: range.from,
          to: range.to,
          emails: emails,
        })
      })
    }
    if (exp) {
      exp.addEventListener('click', function () {
        vscode.postMessage({
          type: 'exportLeaderboardCsv',
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
        vscode.postMessage({ type: 'pickLeaderboardCatalog' })
      })
    }
    if (scanRepos) {
      scanRepos.addEventListener('click', function () {
        vscode.postMessage({ type: 'refreshLeaderboardRepos' })
      })
    }
    if (saveRepos) {
      saveRepos.addEventListener('click', function () {
        vscode.postMessage({ type: 'saveLeaderboardRepos' })
      })
    }
    if (clearCatalog) {
      clearCatalog.addEventListener('click', function () {
        vscode.postMessage({ type: 'clearLeaderboardCatalog' })
      })
    }
    if (pickRepo) {
      pickRepo.addEventListener('click', function () {
        vscode.postMessage({ type: 'pickLeaderboardRepo' })
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
        vscode.postMessage({ type: 'addLeaderboardRepo', path: path })
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


  function barIcon(name, spin) {
    const wrap = el('span', 'bar-icon' + (spin ? ' is-spin' : ''))
    const pathD = BAR_ICON_PATHS[name]
    if (!pathD) {
      return wrap
    }
    const svg = svgNode('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' })
    const path = svgNode('path', { d: pathD })
    svg.appendChild(path)
    wrap.appendChild(svg)
    return wrap
  }

  let lastStatusBarPreview = null

  function previewRecentLimit() {
    if (minimalModeEl && minimalModeEl.checked) {
      return 0
    }
    if (showStatusBarEl && showStatusBarEl.checked === false) {
      return 0
    }
    if (!recentQueryCountEl) {
      return DEFAULT_RECENT_QUERY_COUNT
    }
    return clampRecentQueryCount(recentQueryCountEl.value)
  }

  function renderStatusBarPreview(chips) {
    if (!statusBarPreviewEl) {
      return
    }
    if (Array.isArray(chips)) {
      lastStatusBarPreview = chips
    }
    const list = Array.isArray(lastStatusBarPreview) ? lastStatusBarPreview : []
    const barOn = !showStatusBarEl || showStatusBarEl.checked !== false
    const recentLimit = previewRecentLimit()
    while (statusBarPreviewEl.firstChild) {
      statusBarPreviewEl.removeChild(statusBarPreviewEl.firstChild)
    }
    const visible = []
    if (barOn) {
      for (let i = 0; i < list.length; i++) {
        const chip = list[i]
        if (!chip) {
          continue
        }
        if (typeof chip.id === 'string' && chip.id.indexOf('recent-') === 0) {
          const index = Number(chip.id.slice('recent-'.length))
          if (!Number.isFinite(index) || index >= recentLimit) {
            continue
          }
          visible.push(chip)
          continue
        }
        if (chip.visible) {
          visible.push(chip)
        }
      }
    }
    const hidden = visible.length === 0
    statusBarPreviewEl.classList.toggle('is-hidden', hidden)
    if (statusBarPreviewEmptyEl) {
      statusBarPreviewEmptyEl.hidden = !hidden
    }
    if (hidden) {
      return
    }
    for (let i = 0; i < visible.length; i++) {
      const chip = visible[i]
      const node = el('span', 'bar-chip')
      if (chip.tone === 'green') {
        node.classList.add('is-green')
      } else if (chip.tone === 'red') {
        node.classList.add('is-red')
      }
      const segs = chip.segments || []
      for (let s = 0; s < segs.length; s++) {
        const seg = segs[s]
        const part = el('span', 'bar-seg')
        if (seg.icon && BAR_ICON_PATHS[seg.icon]) {
          part.appendChild(barIcon(seg.icon, seg.spin === true))
        }
        if (seg.body) {
          const body = el('span')
          setText(body, seg.body)
          part.appendChild(body)
        }
        node.appendChild(part)
      }
      statusBarPreviewEl.appendChild(node)
    }
  }

  function syncBarEditorState() {
    const minimal = minimalModeEl && minimalModeEl.checked
    if (showTodayEl) {
      showTodayEl.disabled = Boolean(minimal)
    }
    if (recentQueryCountEl) {
      recentQueryCountEl.disabled = Boolean(minimal)
    }
    renderStatusBarPreview(lastStatusBarPreview)
  }

  function setView(next) {
    let tab =
      next === 'stats' ||
      next === 'charts' ||
      next === 'optimize' ||
      next === 'leaderboard' ||
      next === 'support' ||
      next === 'settings' ||
      next === 'queries'
        ? next
        : 'queries'
    if (tab === 'leaderboard' && !leaderboardUnlocked) {
      // The host posts openTab before the first data payload, so the flag may not be in yet.
      pendingLeaderboardTab = true
      tab = 'queries'
    }
    currentView = tab
    queriesViewEl.hidden = tab !== 'queries'
    statsViewEl.hidden = tab !== 'stats'
    if (chartsViewEl) {
      chartsViewEl.hidden = tab !== 'charts'
    }
    if (optimizeViewEl) {
      optimizeViewEl.hidden = tab !== 'optimize'
    }
    if (leaderboardViewEl) {
      leaderboardViewEl.hidden = tab !== 'leaderboard'
    }
    if (supportViewEl) {
      supportViewEl.hidden = tab !== 'support'
    }
    settingsViewEl.hidden = tab !== 'settings'
    tabQueriesEl.classList.toggle('is-active', tab === 'queries')
    tabStatsEl.classList.toggle('is-active', tab === 'stats')
    if (tabChartsEl) {
      tabChartsEl.classList.toggle('is-active', tab === 'charts')
    }
    if (tabOptimizeEl) {
      tabOptimizeEl.classList.toggle('is-active', tab === 'optimize')
    }
    if (tabLeaderboardEl) {
      tabLeaderboardEl.classList.toggle('is-active', tab === 'leaderboard')
    }
    if (tabSupportEl) {
      tabSupportEl.classList.toggle('is-active', tab === 'support')
    }
    tabSettingsEl.classList.toggle('is-active', tab === 'settings')
    if (tab === 'charts' || tab === 'stats') {
      drawAllCharts()
    } else {
      hideChartTips()
    }
  }

  function svgNode(name, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name)
    if (attrs) {
      const keys = Object.keys(attrs)
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        node.setAttribute(key, attrs[key])
      }
    }
    return node
  }

  function chartBarRect(x, y, barW, h, className, flatTop) {
    const radius = flatTop ? 0 : Math.min(2.2, barW / 2)
    return svgNode('rect', {
      class: className || 'chart-bar',
      x: String(x - barW / 2),
      y: String(y),
      width: String(barW),
      height: String(Math.max(0.5, h)),
      rx: String(radius),
      ry: String(radius),
    })
  }

  // Plan is that day's allowance. The column stays green up to the plan
  // and turns red only on the part above it. No allowance → series color.
  function appendPaceSections(svg, x, width, used, plan, maxCum, top, plotH, tone) {
    const capped = Math.min(Math.max(0, Number(used) || 0), maxCum)
    if (!(capped > 0)) {
      return
    }
    const toneClass = tone || 'is-s0'
    const planNum = Number(plan)
    if (plan === null || plan === undefined || !Number.isFinite(planNum)) {
      const y = yAt(capped, maxCum, top, plotH)
      const h = top + plotH - y
      if (h > 0) {
        svg.appendChild(chartBarRect(x, y, width, h, 'chart-bar ' + toneClass))
      }
      return
    }
    const ceiling = Math.max(0, planNum)
    const over = capped > ceiling + 0.005 ? capped - ceiling : 0
    const under = capped - over
    if (under > 0) {
      const y = yAt(under, maxCum, top, plotH)
      const h = top + plotH - y
      if (h > 0) {
        svg.appendChild(
          chartBarRect(
            x,
            y,
            width,
            h,
            'chart-bar is-pace is-under ' + toneClass,
            over > 0,
          ),
        )
      }
    }
    if (over > 0) {
      const yTop = yAt(capped, maxCum, top, plotH)
      const yJoin = yAt(Math.min(under, maxCum), maxCum, top, plotH)
      const h = yJoin - yTop
      if (h > 0) {
        svg.appendChild(
          chartBarRect(
            x,
            yTop,
            width,
            h + 0.4,
            'chart-bar is-pace is-over ' + toneClass,
          ),
        )
      }
    }
  }

  function niceMax(value) {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) {
      return 1
    }
    const ticks = 4
    const padded = n * 1.08
    const rawStep = padded / ticks
    const exp = Math.pow(10, Math.floor(Math.log10(rawStep)))
    const scaled = rawStep / exp
    const steps = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10]
    let nice = 10
    for (let i = 0; i < steps.length; i++) {
      if (scaled <= steps[i]) {
        nice = steps[i]
        break
      }
    }
    return nice * exp * ticks
  }

  function compactTokens(n) {
    const value = Math.max(0, Number(n) || 0)
    if (value < 1000) {
      return String(Math.round(value))
    }
    if (value < 1_000_000) {
      return (Math.round((value / 1000) * 10) / 10).toFixed(1).replace(/\.0$/, '') + 'k'
    }
    return (Math.round((value / 1_000_000) * 10) / 10).toFixed(1).replace(/\.0$/, '') + 'M'
  }

  function compactCost(n) {
    const value = Math.max(0, Number(n) || 0)
    return value.toFixed(2) + ' $'
  }

  function compactPercent(n) {
    const value = Math.max(0, Number(n) || 0)
    const tenths = Math.round(value * 10) / 10
    if (Math.abs(tenths - Math.round(tenths)) < 0.05) {
      return Math.round(tenths) + '%'
    }
    return tenths.toFixed(1) + '%'
  }

  function formatMtdAmount(n) {
    if (mtdUnit === 'percent') {
      return compactPercent(n)
    }
    return compactCost(n)
  }

  function pointX(index, count, left, plotW) {
    if (count <= 1) {
      return left + plotW / 2
    }
    return left + (index / (count - 1)) * plotW
  }

  function yAt(value, max, top, plotH) {
    if (max <= 0) {
      return top + plotH
    }
    return top + plotH - (value / max) * plotH
  }

  function hideChartTip() {
    hideChartTips()
  }

  function hideChartTips() {
    if (chartTipEl) {
      chartTipEl.hidden = true
    }
    if (statsChartTipEl) {
      statsChartTipEl.hidden = true
    }
  }

  function placeTip(tipEl, wrapEl, clientX, clientY) {
    if (!tipEl || !wrapEl) {
      return
    }
    tipEl.hidden = false
    const wrap = wrapEl.getBoundingClientRect()
    const tipW = tipEl.offsetWidth
    const tipH = tipEl.offsetHeight
    let left = clientX - wrap.left + 12
    let top = clientY - wrap.top + 12
    if (left + tipW > wrap.width - 8) {
      left = clientX - wrap.left - tipW - 12
    }
    if (top + tipH > wrap.height - 8) {
      top = clientY - wrap.top - tipH - 12
    }
    tipEl.style.setProperty('--chart-tip-x', Math.max(8, left) + 'px')
    tipEl.style.setProperty('--chart-tip-y', Math.max(8, top) + 'px')
  }

  function tipTitle(text) {
    const node = el('p', 'chart-tip-title')
    setText(node, text)
    return node
  }

  function tipSub(text) {
    const node = el('p', 'chart-tip-sub')
    setText(node, text)
    return node
  }

  function tipRow(label, value, swatchClass, valueClass) {
    const row = el('div', 'chart-tip-row')
    if (swatchClass) {
      row.className = 'chart-tip-row ' + swatchClass
    }
    const labelWrap = el('span', 'chart-tip-label-wrap')
    const swatch = el('span', 'chart-tip-swatch')
    swatch.setAttribute('aria-hidden', 'true')
    const labelEl = el('span', 'chart-tip-label')
    const valueEl = el('span', 'chart-tip-value')
    if (valueClass) {
      valueEl.className = 'chart-tip-value ' + valueClass
    }
    setText(labelEl, label)
    setText(valueEl, value)
    labelWrap.appendChild(swatch)
    labelWrap.appendChild(labelEl)
    row.appendChild(labelWrap)
    row.appendChild(valueEl)
    return row
  }

  function placeChartTip(clientX, clientY) {
    placeTip(chartTipEl, chartsViewEl, clientX, clientY)
  }

  function costOrDash(n) {
    if (n === null || n === undefined || n === '') {
      return '—'
    }
    const value = Number(n)
    if (!Number.isFinite(value)) {
      return '—'
    }
    return formatMtdAmount(value)
  }

  function mtdTipHost(svg) {
    if (statsViewEl && svg && statsViewEl.contains(svg)) {
      return { tip: statsChartTipEl, wrap: statsViewEl }
    }
    return { tip: chartTipEl, wrap: chartsViewEl }
  }

  function mtdTipLimit(point, line, index) {
    if (
      point &&
      point.allowanceUsd !== null &&
      point.allowanceUsd !== undefined
    ) {
      const allowance = Number(point.allowanceUsd)
      if (Number.isFinite(allowance)) {
        return allowance
      }
    }
    if (!line || !line.forecast) {
      return null
    }
    return line.forecast[index]
  }

  function mtdTipValueClass(used, limit) {
    const usedNum = Number(used)
    const limitNum = Number(limit)
    if (!Number.isFinite(usedNum) || !Number.isFinite(limitNum)) {
      return ''
    }
    return usedNum > limitNum + 0.005 ? 'is-over' : 'is-ok'
  }

  function showMtdForecastTip(point, line, index, clientX, clientY, svg) {
    const host = mtdTipHost(svg)
    if (!host.tip || !host.wrap || !point || !line) {
      return
    }
    const label = line.label || t('mtd.used')
    const tone = line.tone || 'is-s0'
    const used = line.used ? line.used[index] : null
    const limit = mtdTipLimit(point, line, index)
    host.tip.replaceChildren()
    host.tip.appendChild(
      tipRow(
        point.date + ' ' + label,
        costOrDash(used) + ' / ' + costOrDash(limit),
        'is-used ' + tone,
        mtdTipValueClass(used, limit),
      ),
    )
    placeTip(host.tip, host.wrap, clientX, clientY)
  }

  function barCenterX(index, count, left, plotW) {
    if (count <= 0) {
      return left
    }
    const gap = plotW / count
    return left + gap * (index + 0.5)
  }

  function showChartTip(point, kind, cumulative, clientX, clientY) {
    if (!chartTipEl || !chartsViewEl) {
      return
    }
    const per =
      kind === 'tokens' ? compactTokens(point.tokens) : compactCost(point.costUsd)
    const total =
      kind === 'tokens' ? compactTokens(cumulative) : compactCost(cumulative)
    chartTipEl.replaceChildren()
    chartTipEl.appendChild(tipTitle(point.time))
    const queries = Number(point.queryCount)
    if (Number.isFinite(queries) && queries > 0) {
      chartTipEl.appendChild(tipSub(t('charts.tipQueries', { n: queries })))
    }
    chartTipEl.appendChild(
      tipRow(kind === 'tokens' ? t('charts.tipTokens') : t('charts.tipCost'), per),
    )
    chartTipEl.appendChild(tipRow(t('charts.tipTotal'), total))
    placeChartTip(clientX, clientY)
  }

  function drawChart(svg, points, kind) {
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild)
    }
    const width = 800
    const height = 280
    const left = 52
    const right = 16
    const top = 16
    const bottom = 36
    const plotW = width - left - right
    const plotH = height - top - bottom
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)

    const axis = svgNode('line', {
      class: 'chart-axis',
      x1: String(left),
      y1: String(top),
      x2: String(left),
      y2: String(top + plotH),
    })
    svg.appendChild(axis)
    svg.appendChild(
      svgNode('line', {
        class: 'chart-axis',
        x1: String(left),
        y1: String(top + plotH),
        x2: String(left + plotW),
        y2: String(top + plotH),
      }),
    )

    if (!points || points.length === 0) {
      return
    }

    const daily = chartBarMode === 'daily'
    const cum = []
    const dayValues = []
    let running = 0
    let peak = 0
    for (let i = 0; i < points.length; i++) {
      const value = kind === 'tokens' ? points[i].tokens : points[i].costUsd
      const safe = Number.isFinite(value) ? Math.max(0, value) : 0
      running += safe
      cum.push(running)
      dayValues.push(safe)
      if (safe > peak) {
        peak = safe
      }
    }
    const maxY = niceMax(daily ? peak : running)
    const format = kind === 'tokens' ? compactTokens : compactCost
    const ticks = 4
    for (let t = 0; t <= ticks; t++) {
      const frac = t / ticks
      const y = top + plotH - frac * plotH
      svg.appendChild(
        svgNode('line', {
          class: 'chart-grid',
          x1: String(left),
          y1: String(y),
          x2: String(left + plotW),
          y2: String(y),
        }),
      )
      const leftLabel = svgNode('text', {
        class: 'chart-label',
        x: String(left - 6),
        y: String(y + 3),
        'text-anchor': 'end',
      })
      setText(leftLabel, format(maxY * frac))
      svg.appendChild(leftLabel)
    }

    const labelAt = [0, Math.floor((points.length - 1) / 2), points.length - 1]
    const seen = {}
    for (let i = 0; i < labelAt.length; i++) {
      const idx = labelAt[i]
      if (idx < 0 || seen[idx]) {
        continue
      }
      seen[idx] = true
      const x = barCenterX(idx, points.length, left, plotW)
      const label = svgNode('text', {
        class: 'chart-label',
        x: String(x),
        y: String(top + plotH + 16),
        'text-anchor': 'middle',
      })
      setText(label, points[idx].time)
      svg.appendChild(label)
    }

    const gap = plotW / points.length
    const barW = Math.max(2, Math.min(36, gap * 0.72))
    for (let i = 0; i < points.length; i++) {
      const x = barCenterX(i, points.length, left, plotW)
      const y = yAt(daily ? dayValues[i] : cum[i], maxY, top, plotH)
      const h = top + plotH - y
      if (h <= 0) {
        continue
      }
      svg.appendChild(chartBarRect(x, y, barW, h, 'chart-bar is-day'))
    }

    const hit = svgNode('rect', {
      class: 'chart-hit',
      x: String(left),
      y: String(top),
      width: String(plotW),
      height: String(plotH),
    })
    function onMove(event) {
      const rect = svg.getBoundingClientRect()
      const xPx = event.clientX - rect.left
      const xSvg = (xPx / rect.width) * width
      let best = 0
      let bestDist = Infinity
      for (let i = 0; i < points.length; i++) {
        const x = barCenterX(i, points.length, left, plotW)
        const dist = Math.abs(x - xSvg)
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      }
      showChartTip(
        points[best],
        kind,
        cum[best],
        event.clientX,
        event.clientY,
      )
    }
    hit.addEventListener('mousemove', onMove)
    hit.addEventListener('mouseleave', hideChartTip)
    svg.appendChild(hit)
  }

  function clearSvg(svg) {
    if (!svg) {
      return
    }
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild)
    }
  }

  function numericMax(values) {
    let max = 0
    for (let i = 0; i < values.length; i++) {
      const n = Number(values[i])
      if (Number.isFinite(n) && n > max) {
        max = n
      }
    }
    return max
  }

  function numbersOrNull(list) {
    const out = []
    const source = Array.isArray(list) ? list : []
    for (let i = 0; i < source.length; i++) {
      const raw = source[i]
      if (raw === null || raw === undefined) {
        out.push(null)
        continue
      }
      const n = Number(raw)
      out.push(Number.isFinite(n) ? Math.max(0, n) : 0)
    }
    return out
  }

  function appendLine(svg, values, max, left, plotW, top, plotH, className) {
    const pts = []
    for (let i = 0; i < values.length; i++) {
      const raw = values[i]
      if (raw === null || raw === undefined) {
        continue
      }
      const n = Number(raw)
      if (!Number.isFinite(n)) {
        continue
      }
      const x = pointX(i, values.length, left, plotW)
      const y = yAt(Math.min(Math.max(0, n), max), max, top, plotH)
      pts.push(x + ',' + y)
    }
    if (pts.length === 0) {
      return
    }
    svg.appendChild(
      svgNode('polyline', {
        class: className,
        points: pts.join(' '),
      }),
    )
  }

  function todayIndexFromSeries(series) {
    const primary = Array.isArray(series) && series[0] ? series[0] : null
    const used = primary && Array.isArray(primary.used) ? primary.used : []
    let todayIdx = -1
    for (let i = 0; i < used.length; i++) {
      if (used[i] !== null && used[i] !== undefined) {
        todayIdx = i
      }
    }
    return todayIdx
  }

  function mtdRangeWindow(count, todayIdx, range) {
    if (count <= 0) {
      return { start: 0, end: -1 }
    }
    if (range === 'month' || todayIdx < 0) {
      return { start: 0, end: count - 1 }
    }
    if (range === 'today') {
      return {
        start: Math.max(0, todayIdx - 1),
        end: Math.min(count - 1, todayIdx + 1),
      }
    }
    // 7 days: prefer today near the middle, clamp to the month.
    let start = Math.max(0, todayIdx - 3)
    let end = Math.min(count - 1, start + 6)
    start = Math.max(0, end - 6)
    return { start, end }
  }

  function sliceSeriesArrays(series, start, end) {
    const out = []
    for (let i = 0; i < series.length; i++) {
      const row = series[i]
      const sliceArr = function (list) {
        if (!Array.isArray(list)) {
          return []
        }
        return list.slice(start, end + 1)
      }
      out.push({
        id: row.id,
        label: row.label,
        day: sliceArr(row.day),
        used: sliceArr(row.used),
        forecast: sliceArr(row.forecast),
        ideal: sliceArr(row.ideal),
        runOutDate: row.runOutDate,
        runOutLabel: row.runOutLabel,
      })
    }
    return out
  }

  function visibleMtdChart(points, series, range) {
    const sourcePoints = Array.isArray(points) ? points : []
    const sourceSeries = Array.isArray(series) ? series : []
    const todayIdx = todayIndexFromSeries(sourceSeries)
    const win = mtdRangeWindow(sourcePoints.length, todayIdx, range)
    if (win.end < win.start) {
      return { points: [], series: [] }
    }
    return {
      points: sourcePoints.slice(win.start, win.end + 1),
      series: sliceSeriesArrays(sourceSeries, win.start, win.end),
    }
  }

  function redrawMtdForecastChart() {
    if (!mtdForecastSvgs.length) {
      return
    }
    const visible = visibleMtdChart(
      mtdForecastPoints,
      mtdForecastSeries,
      mtdChartRange,
    )
    for (let i = 0; i < mtdForecastSvgs.length; i++) {
      drawMtdForecastChart(
        mtdForecastSvgs[i],
        visible.points,
        visible.series,
        mtdMax,
        mtdResetDate,
        mtdResetMidday,
        forecastWindow,
      )
    }
  }

  function syncMtdRangeButtons() {
    const buttons = document.querySelectorAll('.mtd-range-btn')
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle(
        'is-active',
        buttons[i].getAttribute('data-range') === mtdChartRange,
      )
    }
  }

  function setMtdChartRange(id) {
    if (mtdChartRange === id) {
      return
    }
    mtdChartRange = id
    syncMtdRangeButtons()
    redrawMtdForecastChart()
  }

  function mtdRangeToggle() {
    const wrap = el('div', 'mtd-range')
    wrap.setAttribute('role', 'group')
    wrap.setAttribute('aria-label', t('mtd.rangeAria'))
    const options = [
      { id: 'today', label: t('mtd.rangeToday') },
      { id: '7d', label: t('mtd.range7d') },
      { id: 'month', label: t('mtd.rangeMonth') },
    ]
    for (let i = 0; i < options.length; i++) {
      const opt = options[i]
      const btn = el('button', 'mtd-range-btn')
      btn.type = 'button'
      btn.setAttribute('data-range', opt.id)
      if (mtdChartRange === opt.id) {
        btn.classList.add('is-active')
      }
      setText(btn, opt.label)
      btn.addEventListener('click', function () {
        setMtdChartRange(opt.id)
      })
      wrap.appendChild(btn)
    }
    return wrap
  }

  function appendMtdDayAxis(svg, points, left, plotW, axisY, width) {
    const count = points.length
    const gap = count <= 1 ? plotW : plotW / (count - 1)
    // Full "30.09" labels collide when each day is only ~25px apart.
    const stagger = count > 3 && gap < 46
    const rowRight = [-1000, -1000]
    for (let i = 0; i < count; i++) {
      const x = pointX(i, count, left, plotW)
      const row = stagger && i % 2 === 1 ? 1 : 0
      svg.appendChild(
        svgNode('line', {
          class: 'chart-tick',
          x1: String(x),
          y1: String(axisY),
          x2: String(x),
          y2: String(axisY + 3),
        }),
      )
      const text = String((points[i] && points[i].date) || '')
      if (!text) {
        continue
      }
      const half = Math.max(8, text.length * 2.7)
      const isLast = i === count - 1
      let anchor = 'middle'
      let xText = x
      if (isLast && x + half > width - 3) {
        anchor = 'end'
        xText = width - 3
      } else if (i === 0 && x - half < 3) {
        anchor = 'start'
        xText = 3
      }
      const leftEdge = anchor === 'start' ? xText : anchor === 'end' ? xText - half * 2 : xText - half
      if (leftEdge < rowRight[row] + 4 && !isLast) {
        continue
      }
      rowRight[row] = anchor === 'end' ? xText : anchor === 'start' ? xText + half * 2 : xText + half
      const label = svgNode('text', {
        class: stagger ? 'chart-label is-day' : 'chart-label',
        x: String(Math.round(xText * 10) / 10),
        y: String(axisY + 13 + row * 12),
        'text-anchor': anchor,
      })
      setText(label, text)
      svg.appendChild(label)
    }
  }

  function drawMtdForecastChart(
    svg,
    points,
    series,
    max,
    resetDate,
    resetMidday,
    windowKind,
  ) {
    clearSvg(svg)
    const width = 800
    const height = 280
    const left = 52
    const right = 20
    const top = 16
    const count = points && points.length ? points.length : 0
    const axisGap =
      count <= 1 ? width - left - right : (width - left - right) / (count - 1)
    const stagger = count > 3 && axisGap < 46
    const bottom = stagger ? 48 : 36
    const plotW = width - left - right
    const plotH = height - top - bottom
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)

    svg.appendChild(
      svgNode('line', {
        class: 'chart-axis',
        x1: String(left),
        y1: String(top),
        x2: String(left),
        y2: String(top + plotH),
      }),
    )
    svg.appendChild(
      svgNode('line', {
        class: 'chart-axis',
        x1: String(left),
        y1: String(top + plotH),
        x2: String(left + plotW),
        y2: String(top + plotH),
      }),
    )

    if (!points || points.length === 0) {
      return
    }

    const lines = []
    const rawSeries = Array.isArray(series) ? series : []
    for (let i = 0; i < rawSeries.length; i++) {
      lines.push({
        label: String(rawSeries[i].label || t('mtd.used')),
        tone: 'is-s' + (i % 4),
        day: numbersOrNull(rawSeries[i].day),
        used: numbersOrNull(rawSeries[i].used),
        forecast: numbersOrNull(rawSeries[i].forecast),
        ideal: numbersOrNull(rawSeries[i].ideal),
        runOutDate:
          rawSeries[i].runOutDate === null ||
          rawSeries[i].runOutDate === undefined
            ? null
            : String(rawSeries[i].runOutDate),
      })
    }
    const primary = lines[0]
    if (!primary) {
      return
    }

    let todayIdx = -1
    for (let i = 0; i < primary.used.length; i++) {
      if (primary.used[i] !== null) {
        todayIdx = i
      }
    }

    let dataMax = 0
    for (let i = 0; i < lines.length; i++) {
      dataMax = Math.max(
        dataMax,
        numericMax(lines[i].used),
        numericMax(lines[i].forecast),
      )
    }
    const capped = typeof max === 'number' && Number.isFinite(max) && max > 0
    const maxCum = capped ? max : niceMax(dataMax)
    const ticks = 4
    for (let t = 0; t <= ticks; t++) {
      const frac = t / ticks
      const y = top + plotH - frac * plotH
      svg.appendChild(
        svgNode('line', {
          class: 'chart-grid',
          x1: String(left),
          y1: String(y),
          x2: String(left + plotW),
          y2: String(y),
        }),
      )
      const leftLabel = svgNode('text', {
        class: 'chart-label',
        x: String(left - 6),
        y: String(y + 3),
        'text-anchor': 'end',
      })
      setText(leftLabel, formatMtdAmount(maxCum * frac))
      svg.appendChild(leftLabel)
    }

    appendMtdDayAxis(svg, points, left, plotW, top + plotH, width)

    const gap = points.length <= 1 ? plotW : plotW / (points.length - 1)
    const groupW = Math.max(3, Math.min(22, gap * 0.64))
    const barW = Math.max(2.4, groupW / Math.max(1, lines.length))
    const inner = Math.max(2, barW * 0.74)
    for (let i = 0; i < points.length; i++) {
      const cx = pointX(i, points.length, left, plotW)
      const plan =
        points[i] && points[i].allowanceUsd !== null && points[i].allowanceUsd !== undefined
          ? Number(points[i].allowanceUsd)
          : null
      for (let s = 0; s < lines.length; s++) {
        const usedVal = lines[s].used[i]
        if (usedVal === null || usedVal === undefined || !(usedVal > 0)) {
          continue
        }
        const offset = (s - (lines.length - 1) / 2) * barW
        appendPaceSections(
          svg,
          cx + offset,
          inner,
          usedVal,
          plan,
          maxCum,
          top,
          plotH,
          lines[s].tone,
        )
      }
    }

    if (windowKind === 'calendarMonth' && resetDate) {
      let resetIdx = -1
      for (let i = 0; i < points.length; i++) {
        if (points[i] && points[i].date === resetDate) {
          resetIdx = i
          break
        }
      }
      if (resetIdx >= 0) {
        const resetX = pointX(resetIdx, points.length, left, plotW)
        svg.appendChild(
          svgNode('line', {
            class: 'chart-reset',
            x1: String(resetX),
            y1: String(top),
            x2: String(resetX),
            y2: String(top + plotH),
          }),
        )
        if (resetMidday) {
          const hashWidth = Math.max(4, Math.min(18, groupW))
          const hashGroup = svgNode('g', { class: 'chart-reset-hash' })
          for (let x = resetX - hashWidth / 2; x < resetX + hashWidth / 2; x += 4) {
            hashGroup.appendChild(
              svgNode('line', {
                x1: String(x),
                y1: String(top + plotH),
                x2: String(x + 7),
                y2: String(top + plotH - 7),
              }),
            )
          }
          svg.appendChild(hashGroup)
        }
      }
    }

    for (let i = 0; i < lines.length; i++) {
      appendLine(
        svg,
        lines[i].forecast,
        maxCum,
        left,
        plotW,
        top,
        plotH,
        'chart-line is-forecast ' + lines[i].tone,
      )
    }
    for (let i = 0; i < lines.length; i++) {
      appendLine(
        svg,
        lines[i].used,
        maxCum,
        left,
        plotW,
        top,
        plotH,
        'chart-line ' + lines[i].tone,
      )
    }

    if (todayIdx >= 0) {
      const x = pointX(todayIdx, points.length, left, plotW)
      svg.appendChild(
        svgNode('line', {
          class: 'chart-today',
          x1: String(x),
          y1: String(top),
          x2: String(x),
          y2: String(top + plotH),
        }),
      )
    }

    const lastIdx = points.length - 1
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (todayIdx >= 0 && line.used[todayIdx] !== null) {
        svg.appendChild(
          svgNode('circle', {
            class: 'chart-dot ' + line.tone,
            cx: String(pointX(todayIdx, points.length, left, plotW)),
            cy: String(
              yAt(Math.min(line.used[todayIdx], maxCum), maxCum, top, plotH),
            ),
            r: '3',
          }),
        )
      }
      if (line.runOutDate) {
        let runIdx = -1
        for (let p = 0; p < points.length; p++) {
          if (points[p].date === line.runOutDate) {
            runIdx = p
            break
          }
        }
        if (runIdx >= 0) {
          const x = pointX(runIdx, points.length, left, plotW)
          const y = yAt(maxCum, maxCum, top, plotH)
          svg.appendChild(
            svgNode('line', {
              class: 'chart-runout ' + line.tone,
              x1: String(x),
              y1: String(top),
              x2: String(x),
              y2: String(top + plotH),
            }),
          )
          svg.appendChild(
            svgNode('circle', {
              class: 'chart-dot is-runout ' + line.tone,
              cx: String(x),
              cy: String(y),
              r: '4',
            }),
          )
          const label = svgNode('text', {
            class: 'chart-label chart-runout-label',
            x: String(x + 4),
            y: String(top + 12 + i * 12),
            'text-anchor': 'start',
          })
          setText(label, t('charts.out', { date: line.runOutDate }))
          svg.appendChild(label)
        }
      } else {
        const end = line.forecast[lastIdx]
        if (end !== null && end !== undefined && end <= maxCum) {
          svg.appendChild(
            svgNode('circle', {
              class: 'chart-dot is-forecast ' + line.tone,
              cx: String(pointX(lastIdx, points.length, left, plotW)),
              cy: String(yAt(end, maxCum, top, plotH)),
              r: '3',
            }),
          )
        }
      }
    }

    const hit = svgNode('rect', {
      class: 'chart-hit',
      x: String(left),
      y: String(top),
      width: String(plotW),
      height: String(plotH),
    })
    function onMove(event) {
      const rect = svg.getBoundingClientRect()
      const xPx = event.clientX - rect.left
      const xSvg = (xPx / rect.width) * width
      let best = 0
      let bestDist = Infinity
      for (let i = 0; i < points.length; i++) {
        const x = pointX(i, points.length, left, plotW)
        const dist = Math.abs(x - xSvg)
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      }
      // Pick the nearest series bar for that day (each bar gets its own tip).
      let bestSeries = 0
      let bestSeriesDist = Infinity
      for (let s = 0; s < lines.length; s++) {
        const offset = (s - (lines.length - 1) / 2) * barW
        const barX = pointX(best, points.length, left, plotW) + offset
        const dist = Math.abs(barX - xSvg)
        if (dist < bestSeriesDist) {
          bestSeriesDist = dist
          bestSeries = s
        }
      }
      showMtdForecastTip(
        points[best],
        lines[bestSeries],
        best,
        event.clientX,
        event.clientY,
        svg,
      )
    }
    hit.addEventListener('mousemove', onMove)
    hit.addEventListener('mouseleave', hideChartTip)
    svg.appendChild(hit)
  }

  function syncDailyChartMode() {
    const buttons = document.querySelectorAll('#dailyChartTools [data-chart-mode]')
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle(
        'is-active',
        buttons[i].getAttribute('data-chart-mode') === chartBarMode,
      )
    }
    const hints = document.querySelectorAll('[data-chart-mode-hint]')
    for (let i = 0; i < hints.length; i++) {
      hints[i].hidden = hints[i].getAttribute('data-chart-mode-hint') !== chartBarMode
    }
    const daily = chartBarMode === 'daily'
    if (chartTokensEl) {
      chartTokensEl.setAttribute(
        'aria-label',
        t(daily ? 'charts.tokensAriaDaily' : 'charts.tokensAria'),
      )
    }
    if (chartCostEl) {
      chartCostEl.setAttribute(
        'aria-label',
        t(daily ? 'charts.costAriaDaily' : 'charts.costAria'),
      )
    }
  }

  function redrawUsageCharts() {
    if (!chartPoints || chartPoints.length === 0) {
      clearSvg(chartTokensEl)
      clearSvg(chartCostEl)
      return
    }
    if (chartTokensEl) {
      drawChart(chartTokensEl, chartPoints, 'tokens')
    }
    if (chartCostEl) {
      drawChart(chartCostEl, chartPoints, 'cost')
    }
  }

  function setChartBarMode(mode) {
    if (mode !== 'cumulative' && mode !== 'daily') {
      return
    }
    if (chartBarMode === mode) {
      return
    }
    chartBarMode = mode
    hideChartTip()
    syncDailyChartMode()
    redrawUsageCharts()
  }

  function drawAllCharts() {
    const emptyQueries = !chartPoints || chartPoints.length === 0
    const emptyMtd = !mtdForecastPoints || mtdForecastPoints.length === 0
    const hasCodeLinesSummary =
      !!codeLinesSummary &&
      (typeof codeLinesSummary.ai === 'number' ||
        typeof codeLinesSummary.onMaster === 'number' ||
        typeof codeLinesSummary.allEdited === 'number')
    const emptyCodeLines =
      (!codeLinesSeries || codeLinesSeries.length === 0) && !hasCodeLinesSummary
    if (chartsEmptyEl) {
      chartsEmptyEl.hidden = !(emptyQueries && emptyMtd && emptyCodeLines)
    }
    redrawUsageCharts()
    const hasCodeLines = !emptyCodeLines
    if (codeLinesChartCardEl) {
      codeLinesChartCardEl.hidden = !hasCodeLines
    }
    if (!hasCodeLines) {
      clearSvg(chartCodeLinesEl)
      renderCodeLinesChartRatio(null)
      syncCodeLinesChartLegend(null)
    } else if (chartCodeLinesEl) {
      const headline = drawCodeLinesChart(
        chartCodeLinesEl,
        codeLinesSeries,
        codeLinesSummary,
      )
      renderCodeLinesChartRatio(headline)
      syncCodeLinesChartLegend(headline)
    }
    if (emptyMtd) {
      for (let i = 0; i < mtdForecastSvgs.length; i++) {
        clearSvg(mtdForecastSvgs[i])
      }
    } else {
      redrawMtdForecastChart()
    }
    if (emptyQueries && emptyMtd && emptyCodeLines) {
      hideChartTips()
    }
  }

  function drawCodeLinesChart(svg, series, summary) {
    clearSvg(svg)
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
        label: t('codeLines.onBranch', { branch: codeLinesDefaultBranch }),
      },
    ]
    if (headline.pending > 0) {
      rows.push({
        value: headline.pending,
        fillClass: 'chart-code-fill is-pending',
        label: t('codeLines.stillAhead', { branch: codeLinesDefaultBranch }),
      })
    }
    rows.push({
      value: headline.ai,
      fillClass: 'chart-code-fill is-ai-total',
      label: t('charts.aiGenerated'),
    })
    if (headline.allEdited > 0) {
      rows.push({
        value: headline.allEdited,
        fillClass: 'chart-code-fill is-all',
        label: t('codeLines.allProjects'),
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
        svgNode('text', {
          x: padL - 12,
          y: y + barH / 2 + 5,
          class: 'chart-code-label',
          'text-anchor': 'end',
        }),
      )
      svg.lastChild.textContent = label
      svg.appendChild(
        svgNode('rect', {
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
          svgNode('rect', {
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
        svgNode('text', {
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
    if (!codeLinesChartRatioEl) {
      return
    }
    while (codeLinesChartRatioEl.firstChild) {
      codeLinesChartRatioEl.removeChild(codeLinesChartRatioEl.firstChild)
    }
    if (!headline) {
      return
    }
    if (headline.rangeText) {
      const rangeEl = el('p', 'code-lines-chart-range')
      setText(rangeEl, headline.rangeText)
      codeLinesChartRatioEl.appendChild(rangeEl)
    }
    const chartFormulas = codeLinesFormulas([
      {
        formula: headline.rateFormula,
        caption: t('codeLines.yourRate'),
        hero: true,
      },
    ])
    if (chartFormulas) {
      codeLinesChartRatioEl.appendChild(chartFormulas)
    }
    const chartLanded = codeLinesCollapsedFormula(
      headline.landedFormula,
      t('codeLines.ifLanded', { branch: codeLinesDefaultBranch }),
    )
    if (chartLanded) {
      codeLinesChartRatioEl.appendChild(chartLanded)
    }
  }

  function syncCodeLinesChartLegend(headline) {
    if (codeLinesLegendPendingEl) {
      const showPending = !!(headline && headline.pending > 0)
      codeLinesLegendPendingEl.hidden = !showPending
      if (showPending) {
        setText(
          codeLinesLegendPendingEl,
          t('codeLines.stillAhead', { branch: codeLinesDefaultBranch }),
        )
      }
    }
    if (codeLinesLegendAllEl) {
      const showAll = !!(headline && headline.allEdited > 0)
      codeLinesLegendAllEl.hidden = !showAll
      if (showAll) {
        setText(codeLinesLegendAllEl, t('codeLines.allProjects'))
      }
    }
  }


  function mixBar(shares) {
    const mix = el('div', 'period-mix')
    const list = shares || []
    for (let i = 0; i < list.length; i++) {
      const share = list[i]
      const pct = Math.max(0, Number(share.percent) || 0)
      if (pct <= 0) {
        continue
      }
      const seg = el('span', 'period-mix-seg is-' + share.key)
      seg.style.width = pct + '%'
      mix.appendChild(seg)
    }
    return mix
  }

  function mixLegend(shares) {
    const legend = el('div', 'period-legend')
    const list = shares || []
    for (let i = 0; i < list.length; i++) {
      const share = list[i]
      const item = el('span', 'period-legend-item is-' + share.key)
      setText(item, share.label + ' ' + (Number(share.percent) || 0) + '%')
      legend.appendChild(item)
    }
    return legend
  }

  function periodCardEl(card) {
    const article = el('article', 'period-card')
    const title = el('h2', 'period-card-title')
    setText(title, card.title)
    article.appendChild(title)
    const cost = el('p', 'period-card-cost')
    setText(cost, card.cost)
    article.appendChild(cost)
    const hint = el('p', 'period-card-hint')
    setText(hint, card.costHint)
    article.appendChild(hint)
    const summary = el('p', 'period-card-summary')
    setText(summary, card.summary)
    article.appendChild(summary)

    const rows = el('dl', 'period-card-rows')
    const list = card.rows || []
    for (let i = 0; i < list.length; i++) {
      const row = list[i]
      const dt = el('dt', row.total ? 'is-total' : undefined)
      setText(dt, row.label)
      const dd = el('dd', row.total ? 'is-total' : undefined)
      setText(dd, row.value)
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
    const row = el('div', 'meter-row')
    const head = el('div', 'meter-head')
    const name = el('span', 'meter-label')
    setText(name, label)
    const amount = el('span', 'meter-value')
    setText(amount, value)
    head.appendChild(name)
    head.appendChild(amount)
    const track = el('div', 'meter-track')
    const fill = el('div', 'meter-fill')
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
    return t('codeLines.landed', { n: Math.round(ratio * 100) })
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
    const left = el('span', 'code-lines-formula-left' + heroClass)
    setText(left, formula.left)
    grid.appendChild(left)
    const slash = el('span', 'code-lines-formula-op' + heroClass)
    setText(slash, '/')
    grid.appendChild(slash)
    const den = el('span', 'code-lines-formula-den' + heroClass)
    setText(den, formula.denom || '')
    grid.appendChild(den)
    const eq = el('span', 'code-lines-formula-op' + heroClass)
    setText(eq, '=')
    grid.appendChild(eq)
    const pct = el('span', 'code-lines-formula-pct' + heroClass)
    setText(pct, formula.pct || '')
    grid.appendChild(pct)
    const note = el('span', 'code-lines-formula-caption')
    if (caption) {
      setText(note, caption)
    }
    grid.appendChild(note)
  }

  function codeLinesFormulas(rows) {
    const grid = el('div', 'code-lines-formulas')
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
    const details = el('details', 'code-lines-repos code-lines-landed')
    const summaryEl = el('summary', 'code-lines-repos-summary')
    setText(summaryEl, caption)
    details.appendChild(summaryEl)
    const formulas = codeLinesFormulas([
      { formula: formula, caption: '', hero: false },
    ])
    if (formulas) {
      details.appendChild(formulas)
    }
    return details
  }

  function codeLinesFormulaRow(formula, caption, hero) {
    if (formula && typeof formula === 'object') {
      return codeLinesFormulas([
        { formula: formula, caption: caption, hero: hero },
      ])
    }
    const row = el(
      'p',
      'code-lines-formula-row' + (hero ? ' is-hero' : ''),
    )
    const value = el('span', 'code-lines-formula')
    setText(value, formula)
    row.appendChild(value)
    if (caption) {
      const note = el('span', 'code-lines-formula-caption')
      setText(note, caption)
      row.appendChild(note)
    }
    return row
  }

  function codeLinesInfoBlock(title, formula, body) {
    const block = el('article', 'code-lines-info-block')
    const heading = el('h4')
    setText(heading, title)
    block.appendChild(heading)
    if (formula) {
      const formulaEl = el('p', 'code-lines-info-formula')
      setText(formulaEl, formula)
      block.appendChild(formulaEl)
    }
    const text = el('p')
    setText(text, body)
    block.appendChild(text)
    return block
  }

  function codeLinesAuthorsBlock(choice) {
    const accounts =
      choice && Array.isArray(choice.accounts) ? choice.accounts : []
    const block = el('article', 'code-lines-info-block is-authors')
    const heading = el('h4')
    setText(heading, t('codeLines.infoAuthorsTitle'))
    block.appendChild(heading)
    const text = el('p')
    setText(text, t('codeLines.infoAuthorsBody'))
    block.appendChild(text)
    if (accounts.length === 0) {
      const empty = el('p', 'code-lines-authors-empty')
      setText(empty, t('codeLines.noAuthors'))
      block.appendChild(empty)
      return block
    }
    let sumMultiple = choice.sumMultiple === true
    const sumRow = el('label', 'code-lines-author-sum')
    const sumBox = el('input')
    sumBox.type = 'checkbox'
    sumBox.checked = sumMultiple
    const sumCopy = el('span')
    const sumTitle = el('span', 'code-lines-author-sum-title')
    setText(sumTitle, t('codeLines.sumAccounts'))
    const sumHint = el('span', 'code-lines-author-sum-hint')
    setText(sumHint, t('codeLines.sumAccountsHint'))
    sumCopy.appendChild(sumTitle)
    sumCopy.appendChild(sumHint)
    sumRow.appendChild(sumBox)
    sumRow.appendChild(sumCopy)
    block.appendChild(sumRow)
    const list = el('div', 'code-lines-author-list')
    const boxes = []
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i]
      const row = el('label', 'code-lines-author-row')
      const box = el('input')
      box.type = 'checkbox'
      box.value = account.email
      box.checked = account.selected === true
      boxes.push(box)
      const meta = el('span', 'code-lines-author-meta')
      const name = el('span', 'code-lines-author-name')
      setText(name, account.name || account.email)
      const email = el('span', 'code-lines-author-email')
      setText(email, account.email)
      meta.appendChild(name)
      meta.appendChild(email)
      row.appendChild(box)
      row.appendChild(meta)
      if (account.cursorAccount === true) {
        const badge = el('span', 'code-lines-author-badge')
        setText(badge, t('codeLines.cursorAccount'))
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
    sumBox.addEventListener('change', function () {
      sumMultiple = sumBox.checked === true
      enforceSingle()
    })
    for (let i = 0; i < boxes.length; i++) {
      boxes[i].addEventListener('change', function (event) {
        if (sumMultiple) {
          return
        }
        const target = event.target
        for (let j = 0; j < boxes.length; j++) {
          boxes[j].checked = boxes[j] === target
        }
        target.checked = true
      })
    }
    const apply = el('button', 'code-lines-authors-apply')
    apply.type = 'button'
    setText(apply, t('codeLines.applyAuthors'))
    apply.addEventListener('click', function () {
      const emails = selectedEmails()
      if (emails.length === 0) {
        return
      }
      vscode.postMessage({
        type: 'setCodeLinesAuthors',
        emails: emails,
        sumMultiple: sumMultiple,
      })
    })
    block.appendChild(apply)
    return block
  }

  function openCodeLinesInfoDialog(dialog) {
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) {
        dialog.showModal()
      }
      return
    }
    dialog.setAttribute('open', '')
  }

  function closeCodeLinesInfoDialog(dialog) {
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close()
      return
    }
    dialog.removeAttribute('open')
  }

  function codeLinesInfoDialog(input) {
    const dialog = el('dialog', 'code-lines-info-dialog')
    const panel = el('div', 'code-lines-info-panel')
    const head = el('div', 'code-lines-info-head')
    const heading = el('h4', 'code-lines-info-title')
    setText(heading, t('codeLines.infoTitle'))
    const closeBtn = el('button', 'code-lines-info-close')
    closeBtn.type = 'button'
    setText(closeBtn, t('codeLines.infoClose'))
    closeBtn.addEventListener('click', function () {
      closeCodeLinesInfoDialog(dialog)
    })
    head.appendChild(heading)
    head.appendChild(closeBtn)
    panel.appendChild(head)
    panel.appendChild(codeLinesAuthorsBlock(input.authors))
    panel.appendChild(
      codeLinesInfoBlock(
        t('codeLines.infoWindowTitle'),
        input.rangeText || null,
        t('codeLines.infoWindowBody'),
      ),
    )
    panel.appendChild(
      codeLinesInfoBlock(
        t('codeLines.yourRate'),
        shareFormulaText(input.rateFormula) || null,
        t('codeLines.infoRateBody', { branch: input.branch }),
      ),
    )
    panel.appendChild(
      codeLinesInfoBlock(
        t('codeLines.ifLanded', { branch: input.branch }),
        shareFormulaText(input.landedFormula) || null,
        t('codeLines.infoLandedBody', { branch: input.branch }),
      ),
    )
    panel.appendChild(
      codeLinesInfoBlock(
        t('codeLines.allProjects'),
        input.allLabel,
        t('codeLines.infoAllBody'),
      ),
    )
    panel.appendChild(
      codeLinesInfoBlock(
        t('codeLines.reposToggle', { n: input.repoCount }),
        null,
        t('codeLines.infoReposBody'),
      ),
    )
    dialog.appendChild(panel)
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) {
        closeCodeLinesInfoDialog(dialog)
      }
    })
    return dialog
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
        label: repo.label || t('codeLines.otherRepos'),
        edited: edited,
        current: repo.current === true,
      })
    }
    const card = el('article', 'status-block is-code-lines')
    const head = el('div', 'code-lines-head')
    const title = el('h3')
    title.appendChild(document.createTextNode(t('codeLines.cardTitle')))
    if (rangeText) {
      const rangeEl = el('span', 'code-lines-title-range')
      setText(rangeEl, ' (' + rangeText + ')')
      title.appendChild(rangeEl)
    }
    head.appendChild(title)
    const dialog = codeLinesInfoDialog({
      rangeText: rangeText,
      branch: branch,
      rateFormula: rateFormula,
      landedFormula: landedFormula,
      authors: codeLines.authors || null,
      allLabel:
        allEdited !== null && allEdited > 0
          ? formatCodeLinesCount(allEdited)
          : null,
      repoCount: visibleRepos.length,
    })
    const infoBtn = el('button', 'code-lines-info-btn')
    infoBtn.type = 'button'
    infoBtn.setAttribute('aria-label', t('codeLines.infoAria'))
    infoBtn.title = t('codeLines.infoAria')
    const infoMark = el('span', 'code-lines-info-mark')
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
        caption: t('codeLines.yourRate'),
        hero: true,
      },
    ])
    if (formulas) {
      card.appendChild(formulas)
    }
    const landed = codeLinesCollapsedFormula(
      landedFormula,
      t('codeLines.ifLanded', { branch: branch }),
    )
    if (landed) {
      card.appendChild(landed)
    }
    const meters = el('div', 'meter-list meter-list-tight')
    if (allEdited !== null && allEdited > 0) {
      meters.appendChild(
        meterRow(
          t('codeLines.allProjects'),
          formatCodeLinesCount(allEdited),
          100,
          'share',
        ),
      )
    }
    if (visibleRepos.length > 0) {
      const details = el('details', 'code-lines-repos')
      const summaryEl = el('summary', 'code-lines-repos-summary')
      setText(
        summaryEl,
        t('codeLines.reposToggle', { n: visibleRepos.length }),
      )
      details.appendChild(summaryEl)
      const repoMeters = el('div', 'meter-list meter-list-tight')
      for (let i = 0; i < visibleRepos.length; i++) {
        const repo = visibleRepos[i]
        repoMeters.appendChild(
          meterRow(
            repo.label,
            formatCodeLinesCount(repo.edited),
            Math.round((repo.edited / allScale) * 100),
            repo.current ? 'share' : 'neutral',
          ),
        )
      }
      details.appendChild(repoMeters)
      meters.appendChild(details)
    }
    if (meters.childNodes.length > 0) {
      card.appendChild(meters)
    }
    return card
  }

  function glossaryCard(item) {
    const card = el('article', 'status-block')
    if (item.id) {
      card.classList.add('is-' + item.id)
    }
    const title = el('h3')
    setText(title, item.title)
    card.appendChild(title)
    const value = el('p', 'stats-value stats-value-hero')
    setText(value, item.value)
    card.appendChild(value)
    const bars = item.bars || []
    if (bars.length > 0) {
      const meters = el('div', 'meter-list meter-list-tight')
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        meters.appendChild(meterRow(bar.label, bar.value, bar.percent, 'usage'))
      }
      card.appendChild(meters)
    }
    if (item.body) {
      const body = el('p', 'stats-hint')
      setText(body, item.body)
      card.appendChild(body)
    }
    return card
  }

  function burnBanner(burnRate, warnOn) {
    const banner = el(
      'article',
      'burn-banner' +
        (warnOn ? ' is-' + burnRate.level : ''),
    )
    const title = el('h3')
    setText(title, burnRate.bannerTitle || t('burnRate.highTitle'))
    banner.appendChild(title)
    const body = el('p')
    setText(body, burnRate.bannerBody || '')
    banner.appendChild(body)
    return banner
  }

  function burnRateCard(burnRate, warnOn) {
    const card = el('article', 'status-block is-burn')
    if (
      warnOn &&
      (burnRate.level === 'warning' || burnRate.level === 'critical')
    ) {
      card.classList.add('is-over')
    }
    const title = el('h3')
    setText(title, t('burnRate.cardTitle'))
    card.appendChild(title)
    const value = el('p', 'stats-value stats-value-hero')
    if (
      warnOn &&
      (burnRate.level === 'warning' || burnRate.level === 'critical')
    ) {
      value.classList.add('is-warn')
    }
    setText(value, burnRate.summary || '')
    card.appendChild(value)
    if (burnRate.paceLabel) {
      const pace = el('p', 'stats-hint')
      setText(pace, '↑ ' + burnRate.paceLabel)
      card.appendChild(pace)
    }
    const meters = el('div', 'meter-list meter-list-tight')
    const high =
      warnOn &&
      (burnRate.level === 'warning' || burnRate.level === 'critical')
    meters.appendChild(
      meterRow(
        t('burnRate.windowVsCritical'),
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
      const body = el('p', 'stats-hint')
      setText(body, parts.join(' · '))
      card.appendChild(body)
    }
    return card
  }

  function shareTone(index) {
    return 'is-tone-' + (index % 6)
  }

  function breakdownMix(rows) {
    const mix = el('div', 'period-mix breakdown-mix')
    for (let i = 0; i < rows.length; i++) {
      const pct = Math.max(0, Number(rows[i].percent) || 0)
      if (pct <= 0) {
        continue
      }
      const seg = el('span', 'period-mix-seg ' + shareTone(i))
      seg.style.width = pct + '%'
      mix.appendChild(seg)
    }
    return mix
  }

  function breakdownChart(rows, title) {
    const panel = el('div', 'breakdown-panel')
    if (title) {
      const heading = el('h3', 'breakdown-title')
      setText(heading, title)
      panel.appendChild(heading)
    }
    panel.appendChild(breakdownMix(rows))
    const wrap = el('div', 'meter-list')
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
    const card = el('article', 'stats-card')
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
    const title = el('h3')
    setText(title, item.label || item.title)
    card.appendChild(title)
    const value = el('p', 'stats-value')
    setText(value, item.value)
    card.appendChild(value)
    if (item.detail) {
      const detail = el('p', 'stats-detail')
      setText(detail, item.detail)
      card.appendChild(detail)
    }
    if (item.shares && item.shares.length > 0) {
      card.appendChild(mixBar(item.shares))
      card.appendChild(mixLegend(item.shares))
    }
    if (item.hint) {
      const hint = el('p', 'stats-hint')
      setText(hint, item.hint)
      card.appendChild(hint)
    }
    return card
  }

  function metricGrid(items, className) {
    const grid = el('div', 'stats-grid ' + (className || ''))
    for (let i = 0; i < items.length; i++) {
      grid.appendChild(items[i])
    }
    return grid
  }

  function cycleStrip(items) {
    const wrap = el('div', 'cycle-strip')
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const chip = el('div', 'cycle-chip')
      if (item.id) {
        chip.classList.add('is-' + item.id)
      }
      if (item.tone === 'ok' || item.tone === 'over') {
        chip.classList.add('is-' + item.tone)
      }
      const label = el('span', 'cycle-chip-label')
      setText(label, item.label)
      const value = el('span', 'cycle-chip-value')
      setText(value, item.value)
      chip.appendChild(label)
      chip.appendChild(value)
      if (item.hint) {
        const hint = el('span', 'cycle-chip-hint')
        setText(hint, item.hint)
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
    const wrap = el('section', 'stats-section')
    const head = el('div', 'stats-section-head')
    const heading = el('h2')
    setText(heading, title)
    head.appendChild(heading)
    if (meta) {
      const badge = el('span', 'stats-section-meta')
      setText(badge, meta)
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
    return n === 1 ? t('stats.queryOne') : t('stats.queryMany', { n: n.toLocaleString('en-US') })
  }

  function applyMtdPayload(mtd) {
    mtdForecastSvgs = []
    mtdUnit = 'usd'
    mtdMax = null
    mtdForecastPoints = []
    mtdForecastSeries = []
    mtdResetDate = null
    mtdResetMidday = false
    if (!mtd) {
      return
    }
    mtdUnit = mtd.unit === 'percent' ? 'percent' : 'usd'
    mtdMax = Number.isFinite(Number(mtd.max)) ? Number(mtd.max) : null
    mtdForecastPoints = Array.isArray(mtd.forecast) ? mtd.forecast : []
    mtdForecastSeries = Array.isArray(mtd.series) ? mtd.series : []
    mtdResetDate = typeof mtd.resetDate === 'string' ? mtd.resetDate : null
    mtdResetMidday = mtd.resetMidday === true
    forecastWindow =
      mtd.forecastWindow === 'billingCycle' ? 'billingCycle' : 'calendarMonth'
    if (forecastWindowEl) {
      const billingOption = forecastWindowEl.querySelector(
        'option[value="billingCycle"]',
      )
      if (billingOption) {
        billingOption.hidden = mtd.billingCycleAvailable !== true
      }
      if (document.activeElement !== forecastWindowEl) {
        forecastWindowEl.value = forecastWindow
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
    const card = el('article', 'status-block is-mtd')
    const title = el('h3')
    setText(title, mtd.title || 'Monthly cost forecast')
    card.appendChild(title)
    const bars = mtd.bars || []
    if (bars.length > 0) {
      const meters = el('div', 'meter-list meter-list-tight')
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        meters.appendChild(
          meterRow(bar.label, bar.value, bar.percent, 'usage'),
        )
      }
      card.appendChild(meters)
    }
    if (mtd.body) {
      const body = el('p', 'stats-hint')
      setText(body, mtd.body)
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
    const hint = el('p', 'chart-hint')
    setText(
      hint,
      mtdUnit === 'percent' ? t('mtd.hintPercent') : t('mtd.hintUsd'),
    )
    card.appendChild(hint)
    const legend = el('div', 'chart-legend')
    const barItem = el('span', 'chart-legend-item is-bar is-pace')
    setText(barItem, t('mtd.cumulative'))
    legend.appendChild(barItem)
    for (let i = 0; i < series.length; i++) {
      const tone = ' is-s' + (i % 4)
      const label = String(series[i].label || t('mtd.used'))
      const usedItem = el('span', 'chart-legend-item' + tone)
      setText(usedItem, label)
      const forecastItem = el('span', 'chart-legend-item is-forecast' + tone)
      setText(forecastItem, t('mtd.forecastSuffix', { label: label }))
      legend.appendChild(usedItem)
      legend.appendChild(forecastItem)
    }
    const tools = el('div', 'mtd-chart-tools')
    tools.appendChild(legend)
    tools.appendChild(mtdRangeToggle())
    card.appendChild(tools)
    const frame = el('div', 'chart-frame mtd-forecast-frame')
    const svg = svgNode('svg', {
      class: 'chart-svg',
      viewBox: '0 0 800 280',
      preserveAspectRatio: 'none',
      role: 'img',
      'aria-label':
        mtdUnit === 'percent' ? t('mtd.ariaPercent') : t('mtd.ariaUsd'),
    })
    frame.appendChild(svg)
    card.appendChild(frame)
    mtdForecastSvgs.push(svg)
    return card
  }

  function mtdForecastSection(mtd) {
    const pace = section(mtd.title || t('mtd.title'))
    pace.appendChild(mtdForecastCard(mtd))
    const chips = mtdMetricsStrip(mtd.metrics)
    if (chips) {
      pace.appendChild(chips)
    }
    return pace
  }

  let modelCatalog = null
  let lastStatsArgs = null
  let catalogSortKey = 'cost'
  let catalogSortDir = 'asc'
  let catalogActiveOnly = true
  let catalogHideFast = true

  function shareLabel(model) {
    const n = Number(model.requestPercent)
    if (!Number.isFinite(n) || n <= 0) {
      return '0%'
    }
    const text = Math.round(n * 10) / 10
    return (Number.isInteger(text) ? String(text) : text.toFixed(1)) + '%'
  }

  function moneyPair(model) {
    return t('stats.priceInOut', {
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
      catalogSortKey !== 'model' &&
      catalogSortKey !== 'cost' &&
      catalogSortKey !== 'status' &&
      catalogSortKey !== 'requests' &&
      catalogSortKey !== 'percent' &&
      catalogSortKey !== 'bench'
    ) {
      return rows
    }
    const dir = catalogSortDir === 'desc' ? -1 : 1
    rows.sort(function (a, b) {
      let cmp = 0
      if (catalogSortKey === 'model') {
        cmp = String(a.model.name || '').localeCompare(String(b.model.name || ''))
      } else if (catalogSortKey === 'status') {
        cmp = (a.model.hiddenByDefault ? 1 : 0) - (b.model.hiddenByDefault ? 1 : 0)
      } else if (catalogSortKey === 'requests') {
        cmp = (Number(a.model.requests) || 0) - (Number(b.model.requests) || 0)
      } else if (catalogSortKey === 'percent') {
        cmp = (Number(a.model.requestPercent) || 0) - (Number(b.model.requestPercent) || 0)
      } else if (catalogSortKey === 'bench') {
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
    const active = catalogSortKey === key
    const mark = active ? (catalogSortDir === 'desc' ? ' ↓' : ' ↑') : ''
    setText(button, label + mark)
    th.setAttribute('aria-sort', active ? (catalogSortDir === 'desc' ? 'descending' : 'ascending') : 'none')
    button.addEventListener('click', function () {
      if (catalogSortKey === key) {
        catalogSortDir = catalogSortDir === 'asc' ? 'desc' : 'asc'
      } else {
        catalogSortKey = key
        catalogSortDir = 'asc'
      }
      if (lastStatsArgs) {
        renderStats.apply(null, lastStatsArgs)
      }
    })
    th.appendChild(button)
    return th
  }

  function modelCatalogPanel() {
    const panel = el('div', 'breakdown-panel model-catalog')
    const head = el('div', 'model-catalog-head')
    const title = el('h3', 'breakdown-title')
    setText(title, t('stats.modelPricing'))
    head.appendChild(title)
    const actions = el('div', 'model-catalog-actions')
    const settingsBtn = el('button', 'action-btn model-catalog-refresh')
    settingsBtn.type = 'button'
    setText(settingsBtn, t('stats.openModelSettings'))
    settingsBtn.title = t('stats.openModelSettingsTitle')
    settingsBtn.addEventListener('click', function () {
      vscode.postMessage({ type: 'openModelSettings' })
    })
    const refresh = el('button', 'action-btn model-catalog-refresh')
    refresh.type = 'button'
    setText(refresh, t('stats.pricingRefresh'))
    refresh.title = t('stats.pricingRefresh')
    refresh.addEventListener('click', function () {
      setText(refresh, t('stats.pricingLoading'))
      refresh.disabled = true
      vscode.postMessage({ type: 'refreshModelCatalog' })
    })
    actions.appendChild(settingsBtn)
    actions.appendChild(refresh)
    head.appendChild(actions)
    panel.appendChild(head)

    const note = el('p', 'model-catalog-note')
    setText(note, t('stats.pricingNote'))
    panel.appendChild(note)

    const list = el('div', 'model-catalog-list')
    if (!modelCatalog) {
      const loading = el('p', 'model-catalog-note')
      setText(loading, t('stats.pricingLoading'))
      list.appendChild(loading)
      panel.appendChild(list)
      return panel
    }
    if (modelCatalog.error && (!modelCatalog.models || modelCatalog.models.length === 0)) {
      const failed = el('p', 'model-catalog-note')
      setText(failed, t('stats.pricingError'))
      list.appendChild(failed)
      panel.appendChild(list)
      return panel
    }

    const defaults = el('p', 'model-catalog-defaults')
    setText(
      defaults,
      t('stats.pricingDefaults', {
        visible: modelCatalog.visibleByDefault,
        hidden: modelCatalog.hiddenByDefault,
        fast: modelCatalog.fast,
      }),
    )
    panel.insertBefore(defaults, note)

    function catalogSwitch(labelPath, titlePath, checked, onChange) {
      const root = el('label', 'spike-switch model-catalog-fast')
      root.title = t(titlePath)
      const text = el('span', 'spike-switch-text')
      setText(text, t(labelPath))
      const control = el('span', 'spike-switch-control')
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.checked = checked === true
      input.setAttribute('role', 'switch')
      input.setAttribute('aria-checked', checked === true ? 'true' : 'false')
      input.addEventListener('change', function () {
        onChange(input.checked === true)
        if (lastStatsArgs) {
          renderStats.apply(null, lastStatsArgs)
        }
      })
      const track = el('span', 'spike-switch-track')
      track.setAttribute('aria-hidden', 'true')
      track.appendChild(el('span', 'spike-switch-thumb'))
      control.appendChild(input)
      control.appendChild(track)
      root.appendChild(text)
      root.appendChild(control)
      return root
    }

    const catalogFilters = el('div', 'model-catalog-filters')
    catalogFilters.appendChild(
      catalogSwitch('stats.activeOnly', 'stats.activeOnlyTitle', catalogActiveOnly, function (value) {
        catalogActiveOnly = value
      }),
    )
    catalogFilters.appendChild(
      catalogSwitch('stats.hideFast', 'stats.hideFastTitle', catalogHideFast, function (value) {
        catalogHideFast = value
      }),
    )
    panel.appendChild(catalogFilters)

    const models = (Array.isArray(modelCatalog.models) ? modelCatalog.models : []).filter(
      function (model) {
        if (catalogActiveOnly && model.hiddenByDefault === true) {
          return false
        }
        return !catalogHideFast || model.fast !== true
      },
    )
    const table = document.createElement('table')
    table.className = 'model-catalog-table'
    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    headRow.appendChild(catalogSortHeader('model', t('stats.colModel')))
    headRow.appendChild(catalogSortHeader('cost', t('stats.colCost')))
    headRow.appendChild(catalogSortHeader('bench', t('stats.colBench')))
    headRow.appendChild(catalogSortHeader('requests', t('stats.colRequests')))
    headRow.appendChild(catalogSortHeader('percent', t('stats.colPercent')))
    headRow.appendChild(catalogSortHeader('status', t('stats.colStatus')))
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
      const name = el('span', 'model-price-label')
      setText(name, model.name || '')
      name.title = model.name || ''
      nameCell.appendChild(name)
      if (model.provider) {
        const provider = el('span', 'model-price-provider')
        setText(provider, model.provider)
        nameCell.appendChild(provider)
      }
      if (model.fast) {
        const fast = el('span', 'model-price-badge is-fast')
        setText(fast, t('stats.fastBadge'))
        nameCell.appendChild(fast)
      }
      const costCell = document.createElement('td')
      costCell.className = 'is-cost'
      setText(costCell, moneyPair(model))
      costCell.title = t('stats.pricePerMillion')
      const benchCell = document.createElement('td')
      benchCell.className = 'is-cost'
      const benchScore = Number(model.benchScore)
      if (Number.isFinite(benchScore)) {
        const benchLink = document.createElement('button')
        benchLink.type = 'button'
        benchLink.className = 'model-bench-link'
        setText(benchLink, benchScore.toFixed(1).replace(/\.0$/, '') + '%')
        benchLink.title = t('stats.benchTitle')
        benchLink.addEventListener('click', function () {
          vscode.postMessage({ type: 'openCursorBench' })
        })
        benchCell.appendChild(benchLink)
      } else {
        setText(benchCell, '—')
      }
      const requestsCell = document.createElement('td')
      requestsCell.className = 'is-cost'
      setText(requestsCell, String(Number(model.requests) || 0))
      const percentCell = document.createElement('td')
      percentCell.className = 'is-cost'
      setText(percentCell, shareLabel(model))
      const statusCell = document.createElement('td')
      const state = el(
        'span',
        'model-price-badge' + (model.hiddenByDefault ? ' is-hidden' : ' is-on'),
      )
      setText(
        state,
        model.hiddenByDefault ? t('stats.defaultHidden') : t('stats.defaultOn'),
      )
      state.title = t('stats.openModelSettingsTitle')
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

  function renderStats(stats, mtd, burnRate, warnOn, codeLines) {
    lastStatsArgs = [stats, mtd, burnRate, warnOn, codeLines]
    while (statsEl.firstChild) {
      statsEl.removeChild(statsEl.firstChild)
    }
    if (!stats) {
      return
    }

    if (burnRate && (burnRate.level === 'warning' || burnRate.level === 'critical')) {
      statsEl.appendChild(burnBanner(burnRate, warnOn !== false))
    }

    const glossary = section(t('stats.statusBar'))
    const glossaryGrid = el('div', 'status-explain')
    if (burnRate) {
      glossaryGrid.appendChild(burnRateCard(burnRate, warnOn !== false))
    }
    const items = stats.glossary || []
    for (let i = 0; i < items.length; i++) {
      glossaryGrid.appendChild(glossaryCard(items[i]))
    }
    if (codeLines) {
      glossaryGrid.appendChild(codeLinesCard(codeLines))
    }
    glossary.appendChild(glossaryGrid)
    statsEl.appendChild(glossary)

    if (mtd) {
      statsEl.appendChild(mtdForecastSection(mtd))
    }

    if (stats.cycle && stats.cycle.length > 0) {
      const cycle = section(t('stats.billingCycle'))
      cycle.appendChild(cycleStrip(stats.cycle))
      statsEl.appendChild(cycle)
    }

    const sample = section(
      t('stats.sampleSummary', { heading: lastHeading(stats.historyLimit) }),
      queryCountMeta(stats),
    )
    const note = el('p', 'stats-note')
    setText(note, stats.sampleNote || '')
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
      hasBreakdown ? t('stats.spendBreakdown') : t('stats.modelPricing'),
    )
    const layout = el('div', 'breakdown-with-catalog')
    if (hasBreakdown) {
      const split = el('div', 'breakdown-split')
      if (stats.byModel && stats.byModel.length > 0) {
        split.appendChild(breakdownChart(stats.byModel, t('stats.byModel')))
      }
      if (stats.byKind && stats.byKind.length > 0) {
        split.appendChild(breakdownChart(stats.byKind, t('stats.byKind')))
      }
      layout.appendChild(split)
    }
    layout.appendChild(modelCatalogPanel())
    breakdown.appendChild(layout)
    statsEl.appendChild(breakdown)
  }

  function applyTheme(okColor, warnColor) {
    if (okColor) {
      document.documentElement.style.setProperty('--cost-ok', okColor)
    }
    if (warnColor) {
      document.documentElement.style.setProperty('--cost-warn', warnColor)
    }
  }

  const TOKEN_K = 1000

  const KILO_STEP = 100

  function snapKilo(kilo) {
    const n = Math.round(Number(kilo))
    if (!Number.isFinite(n) || n < 1) {
      return 1
    }
    if (n < KILO_STEP) {
      return n
    }
    return Math.round(n / KILO_STEP) * KILO_STEP
  }

  function tokensFromKilo(kilo) {
    const n = snapKilo(kilo)
    return Math.max(TOKEN_K, n * TOKEN_K)
  }

  function kiloFromTokens(tokens) {
    const n = Math.round(Number(tokens) / TOKEN_K)
    if (!Number.isFinite(n) || n < 1) {
      return 1
    }
    return n
  }

  function tokenPreview(tokens) {
    const n = Math.max(0, Math.round(Number(tokens)))
    const grouped = n.toLocaleString('en-US')
    if (n >= 1_000_000) {
      const millions = n / 1_000_000
      const compact =
        millions >= 10
          ? String(Math.round(millions))
          : millions.toFixed(1).replace(/\.0$/, '')
      return t('settings.tokenPreviewM', { grouped: grouped, compact: compact })
    }
    if (n >= 1000) {
      return t('settings.tokenPreviewK', {
        grouped: grouped,
        compact: Math.round(n / 1000),
      })
    }
    return t('settings.tokenPreview', { grouped: grouped })
  }

  function updateThresholdPreview() {
    setText(thresholdPreviewEl, tokenPreview(tokensFromKilo(thresholdEl.value)))
  }

  function updateCriticalTokenPreview() {
    if (!criticalTokenPreviewEl || !criticalTokenEl) {
      return
    }
    setText(
      criticalTokenPreviewEl,
      tokenPreview(tokensFromKilo(criticalTokenEl.value)),
    )
  }

  function clampCriticalCost(value) {
    const n = Math.round(Number(value) * 100) / 100
    if (!Number.isFinite(n)) {
      return 5
    }
    if (n < 0.01) {
      return 0.01
    }
    return n
  }

  function syncCriticalAlertState() {
    const on = !showCriticalAlertEl || showCriticalAlertEl.checked === true
    if (criticalTokenEl) {
      criticalTokenEl.disabled = !on
    }
    if (criticalCostEl) {
      criticalCostEl.disabled = !on
    }
    syncNumberStepperState(criticalTokenEl)
    syncNumberStepperState(criticalCostEl)
  }

  function syncBurnRateGuardState() {
    const on = !burnRateGuardEl || burnRateGuardEl.checked === true
    const fields = [
      burnRateWindowEl,
      burnRateWarningUsdEl,
      burnRateCriticalUsdEl,
      burnRateMinQueriesEl,
      burnRateWarningToastEl,
      burnRateCriticalToastEl,
    ]
    for (let i = 0; i < fields.length; i++) {
      if (fields[i]) {
        fields[i].disabled = !on
      }
    }
    syncNumberStepperState(burnRateWindowEl)
    syncNumberStepperState(burnRateWarningUsdEl)
    syncNumberStepperState(burnRateCriticalUsdEl)
    syncNumberStepperState(burnRateMinQueriesEl)
  }

  function syncNumberStepperState(inputEl) {
    if (!inputEl) {
      return
    }
    const stepper = inputEl.closest('.number-stepper')
    if (!stepper) {
      return
    }
    const disabled = inputEl.disabled === true
    const buttons = stepper.querySelectorAll('.number-step')
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].disabled = disabled
    }
  }

  function stepNumberInput(inputEl, direction) {
    if (!inputEl || inputEl.disabled) {
      return
    }
    const stepRaw = Number(inputEl.step)
    const step = Number.isFinite(stepRaw) && stepRaw > 0 ? stepRaw : 1
    const min =
      inputEl.min !== '' && Number.isFinite(Number(inputEl.min))
        ? Number(inputEl.min)
        : null
    const max =
      inputEl.max !== '' && Number.isFinite(Number(inputEl.max))
        ? Number(inputEl.max)
        : null
    let current = Number(inputEl.value)
    if (!Number.isFinite(current)) {
      current = min !== null ? min : 0
    }
    let next = current + direction * step
    if (min !== null && next < min) {
      next = min
    }
    if (max !== null && next > max) {
      next = max
    }
    if (inputEl === thresholdEl || inputEl === criticalTokenEl) {
      next = snapKilo(next)
    } else if (inputEl === criticalCostEl) {
      next = clampCriticalCost(next)
    } else if (inputEl === burnRateWindowEl) {
      next = clampBurnWindow(next)
    } else if (inputEl === burnRateWarningUsdEl) {
      next = clampBurnUsd(next, DEFAULT_BURN_WARNING_USD)
    } else if (inputEl === burnRateCriticalUsdEl) {
      next = clampBurnUsd(next, DEFAULT_BURN_CRITICAL_USD)
    } else if (inputEl === burnRateMinQueriesEl) {
      next = clampBurnMinQueries(next)
    } else if (inputEl === pollIntervalEl) {
      next = clampPollInterval(next)
    } else if (step < 1) {
      const decimals = String(step).includes('.')
        ? String(step).split('.')[1].length
        : 2
      next = Math.round(next * Math.pow(10, decimals)) / Math.pow(10, decimals)
    } else {
      next = Math.round(next)
    }
    inputEl.value = String(next)
    inputEl.dispatchEvent(new Event('input', { bubbles: true }))
    inputEl.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function wireNumberSteppers() {
    const steppers = document.querySelectorAll('.number-stepper')
    for (let i = 0; i < steppers.length; i++) {
      const stepper = steppers[i]
      const inputEl = stepper.querySelector('input[type="number"]')
      if (!inputEl) {
        continue
      }
      const buttons = stepper.querySelectorAll('[data-number-dir]')
      for (let b = 0; b < buttons.length; b++) {
        const btn = buttons[b]
        btn.addEventListener('click', function (event) {
          event.preventDefault()
          const dir = Number(btn.getAttribute('data-number-dir'))
          if (!Number.isFinite(dir) || dir === 0) {
            return
          }
          stepNumberInput(inputEl, dir > 0 ? 1 : -1)
        })
      }
      syncNumberStepperState(inputEl)
    }
  }

  function fillIfIdle(inputEl, value) {
    if (document.activeElement === inputEl) {
      return
    }
    inputEl.value = value
  }

  function renderSettings(data) {
    if (
      isSupportedLanguage(data.language) &&
      languageSettingEl &&
      document.activeElement !== languageSettingEl
    ) {
      languageSettingEl.value = data.language
      uiLanguage = data.language
    }
    if (data.i18n && typeof data.i18n === 'object') {
      ui = data.i18n
    }
    if (typeof data.spikeTokenThreshold === 'number' && !thresholdDirty) {
      fillIfIdle(thresholdEl, String(kiloFromTokens(data.spikeTokenThreshold)))
      if (document.activeElement !== thresholdEl) {
        updateThresholdPreview()
      }
    }
    if (
      typeof data.showSpikeWarning === 'boolean' &&
      document.activeElement !== showWarningEl
    ) {
      showWarningEl.checked = data.showSpikeWarning
    }
    if (
      typeof data.showCriticalAlert === 'boolean' &&
      showCriticalAlertEl &&
      document.activeElement !== showCriticalAlertEl
    ) {
      showCriticalAlertEl.checked = data.showCriticalAlert
    }
    if (typeof data.criticalTokenThreshold === 'number' && criticalTokenEl) {
      if (!criticalTokenDirty) {
        fillIfIdle(
          criticalTokenEl,
          String(kiloFromTokens(data.criticalTokenThreshold)),
        )
      }
      if (document.activeElement !== criticalTokenEl) {
        updateCriticalTokenPreview()
      }
    }
    if (
      typeof data.criticalCostUsdThreshold === 'number' &&
      criticalCostEl &&
      !criticalCostDirty
    ) {
      fillIfIdle(criticalCostEl, String(data.criticalCostUsdThreshold))
    }
    syncCriticalAlertState()
    if (
      typeof data.burnRateGuard === 'boolean' &&
      burnRateGuardEl &&
      document.activeElement !== burnRateGuardEl
    ) {
      burnRateGuardEl.checked = data.burnRateGuard
    }
    if (
      typeof data.burnRateWindowMinutes === 'number' &&
      burnRateWindowEl &&
      !burnWindowDirty
    ) {
      fillIfIdle(burnRateWindowEl, String(data.burnRateWindowMinutes))
    }
    if (
      typeof data.burnRateWarningUsd === 'number' &&
      burnRateWarningUsdEl &&
      !burnWarningDirty
    ) {
      fillIfIdle(burnRateWarningUsdEl, String(data.burnRateWarningUsd))
    }
    if (
      typeof data.burnRateCriticalUsd === 'number' &&
      burnRateCriticalUsdEl &&
      !burnCriticalDirty
    ) {
      fillIfIdle(burnRateCriticalUsdEl, String(data.burnRateCriticalUsd))
    }
    if (
      typeof data.burnRateMinQueries === 'number' &&
      burnRateMinQueriesEl &&
      !burnMinQueriesDirty
    ) {
      fillIfIdle(burnRateMinQueriesEl, String(data.burnRateMinQueries))
    }
    if (
      typeof data.burnRateWarningToast === 'boolean' &&
      burnRateWarningToastEl &&
      document.activeElement !== burnRateWarningToastEl
    ) {
      burnRateWarningToastEl.checked = data.burnRateWarningToast
    }
    if (
      typeof data.burnRateCriticalToast === 'boolean' &&
      burnRateCriticalToastEl &&
      document.activeElement !== burnRateCriticalToastEl
    ) {
      burnRateCriticalToastEl.checked = data.burnRateCriticalToast
    }
    syncBurnRateGuardState()
    if (
      typeof data.codeLinesInsight === 'boolean' &&
      codeLinesInsightEl &&
      document.activeElement !== codeLinesInsightEl
    ) {
      codeLinesInsightEl.checked = data.codeLinesInsight
    }
    if (
      typeof data.showStatusBar === 'boolean' &&
      showStatusBarEl &&
      document.activeElement !== showStatusBarEl
    ) {
      showStatusBarEl.checked = data.showStatusBar
    }
    if (
      typeof data.showToday === 'boolean' &&
      showTodayEl &&
      document.activeElement !== showTodayEl
    ) {
      showTodayEl.checked = data.showToday
    }
    if (
      typeof data.minimalMode === 'boolean' &&
      minimalModeEl &&
      document.activeElement !== minimalModeEl
    ) {
      minimalModeEl.checked = data.minimalMode
    }
    if (
      typeof data.recentQueryCount === 'number' &&
      recentQueryCountEl &&
      document.activeElement !== recentQueryCountEl
    ) {
      recentQueryCountEl.value = String(
        clampRecentQueryCount(data.recentQueryCount),
      )
    }
    if (
      (data.budgetDayBasis === 'workingDays' ||
        data.budgetDayBasis === 'calendarDays') &&
      budgetDayBasisEl &&
      document.activeElement !== budgetDayBasisEl
    ) {
      budgetDayBasisEl.value = data.budgetDayBasis
    }
    if (
      (data.forecastWindow === 'calendarMonth' ||
        data.forecastWindow === 'billingCycle') &&
      forecastWindowEl &&
      document.activeElement !== forecastWindowEl &&
      (!data.mtd || data.mtd.billingCycleAvailable === true ||
        data.forecastWindow === 'calendarMonth')
    ) {
      forecastWindowEl.value = data.forecastWindow
    }
    if (
      (data.optimizeDepth === 'quick' ||
        data.optimizeDepth === 'balanced' ||
        data.optimizeDepth === 'deep') &&
      optimizeDepthSettingEl &&
      document.activeElement !== optimizeDepthSettingEl
    ) {
      optimizeDepthSettingEl.value = data.optimizeDepth
    }
    if (
      typeof data.pollIntervalMinutes === 'number' &&
      pollIntervalEl &&
      !pollIntervalDirty
    ) {
      fillIfIdle(pollIntervalEl, String(clampPollInterval(data.pollIntervalMinutes)))
    }
    if (typeof data.okColor === 'string') {
      fillIfIdle(okColorEl, data.okColor)
      setText(okColorValueEl, data.okColor)
    }
    if (typeof data.warnColor === 'string') {
      fillIfIdle(warnColorEl, data.warnColor)
      setText(warnColorValueEl, data.warnColor)
    }
    applyTheme(data.okColor, data.warnColor)
    applyVersion(data.extensionVersion)
    renderStatusBarPreview(data.statusBarPreview)
    syncBarEditorState()
    if (typeof data.historyLimit === 'number' && !historyLimitDirty) {
      const text = String(clampHistoryLimit(data.historyLimit))
      for (let i = 0; i < historyLimitEls.length; i++) {
        fillIfIdle(historyLimitEls[i], text)
      }
    }
    if (!historyFromDateDirty) {
      const nextDate =
        typeof data.historyFromDate === 'string'
          ? parseFromDate(data.historyFromDate)
          : ''
      historyFromDate = nextDate
      const todayIso = isoFromLocal(new Date())
      for (let i = 0; i < historyFromDateEls.length; i++) {
        historyFromDateEls[i].max = todayIso
        fillIfIdle(historyFromDateEls[i], nextDate)
      }
    }
    if (typeof data.historyLimit === 'number') {
      applyHistoryTitle(data.historyLimit)
    }
    syncHistoryRangeUi()
  }

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

  function visibleRows(events, warnOn) {
    const list = events || []
    if (!spikesOnly) {
      return list
    }
    const out = []
    for (let i = 0; i < list.length; i++) {
      if (rowIsSpike(list[i], warnOn)) {
        out.push(list[i])
      }
    }
    return out
  }

  function paintRows(events, warnOn) {
    while (rowsEl.firstChild) {
      rowsEl.removeChild(rowsEl.firstChild)
    }
    const list = visibleRows(events, warnOn)
    if (list.length === 0) {
      emptyEl.hidden = false
      setText(
        emptyEl,
        spikesOnly ? t('queries.emptySpikes') : t('queries.empty'),
      )
      return
    }
    emptyEl.hidden = true
    setText(emptyEl, t('queries.empty'))
    for (let i = 0; i < list.length; i++) {
      const row = list[i]
      const tr = document.createElement('tr')
      const burnRow =
        warnOn &&
        (tableBurnLevel === 'warning' || tableBurnLevel === 'critical') &&
        row.inBurnWindow === true
      if (burnRow) {
        tr.classList.add('row-burn')
      }
      addCell(tr, row.time)
      addCell(tr, row.model)
      addCell(tr, row.cost, burnRow ? 'cost-burn' : undefined)
      const spike = rowIsSpike(row, warnOn)
      addCell(tr, row.tokens, spike ? 'tokens-spike' : undefined)
      addCell(tr, row.inputOutput)
      addCell(tr, row.kind)
      rowsEl.appendChild(tr)
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
      const label = depthLabel(depth)
      setText(runOptimizeToolbarEl, t('toolbar.runOptimize', { depth: label }))
      runOptimizeToolbarEl.title = t('toolbar.runOptimizeTitle', {
        depth: label,
      })
    }
  }

  function promptMetaLabel(depth, text) {
    const depthName = depthLabel(depth)
    if (!text) {
      return t('optimize.promptEmpty', { depth: depthName })
    }
    const chars = text.length
    const lines = text.split('\n').length
    return t('optimize.promptMeta', {
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
      setText(label, row && row.label ? String(row.label) : 'Project')
      const values = document.createElement('span')
      values.className = 'project-values'
      const tokens =
        row && Number.isFinite(row.tokens) ? compactTokens(row.tokens) : '0'
      const usd =
        row && Number.isFinite(row.usd) ? compactCost(row.usd) : '0.00 $'
      setText(values, '~' + tokens + ' · ~' + usd)
      li.appendChild(label)
      li.appendChild(values)
      optimizeLifetimeProjectsEl.appendChild(li)
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
      syncOptimizeDefaultUi(optimizeDepth)
      return
    }
    const depth =
      optimize.depth === 'quick' || optimize.depth === 'deep'
        ? optimize.depth
        : 'balanced'
    optimizeDepth = depth
    syncOptimizeDefaultUi(depth)
    setText(
      optimizeSummaryEl,
      optimize.summary || t('optimize.savingsSummary'),
    )
    if (optimizeNoteEl) {
      setText(
        optimizeNoteEl,
        optimize.note || t('optimize.savingsNote'),
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
        setText(
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
        setText(body, text)
      }
      if (summary) {
        setText(summary, promptMetaLabel(key, text))
      }
      const runBtn = document.querySelector(
        '[data-run-depth="' + key + '"]',
      )
      if (runBtn) {
        runBtn.disabled = !text
      }
    }
  }

  function selectedSupportTopic() {
    const picked = document.querySelector('input[name="supportTopic"]:checked')
    return picked ? picked.value : ''
  }

  function supportExpectsReply() {
    const picked = document.querySelector('input[name="supportReply"]:checked')
    return !picked || picked.value !== 'no'
  }

  function supportEmailOk(email, expectsReply) {
    if (/[\r\n]/.test(email) || email.length > 254) {
      return false
    }
    if (!expectsReply) {
      return true
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  function syncSupportComposer() {
    const topic = selectedSupportTopic()
    const isComment = topic === 'comment'
    if (supportCommentNoticeEl) {
      supportCommentNoticeEl.hidden = !isComment
    }
    const expectsReply = supportExpectsReply()
    if (supportEmailEl) {
      supportEmailEl.disabled = !expectsReply
    }
    if (supportReplyValueEl) {
      setText(
        supportReplyValueEl,
        expectsReply ? t('support.replyYes') : t('support.replyNo'),
      )
    }
    const nick = supportNicknameEl ? supportNicknameEl.value.trim() : ''
    const email = supportEmailEl ? supportEmailEl.value.trim() : ''
    const body = supportBodyEl ? supportBodyEl.value.trim() : ''
    const topicOk =
      topic === 'comment' ||
      topic === 'feature' ||
      topic === 'bug' ||
      topic === 'other'
    const consentOk =
      !isComment || (supportConsentEl !== null && supportConsentEl.checked)
    const ready =
      nick.length > 0 &&
      nick.length <= 40 &&
      !/[\r\n]/.test(nick) &&
      supportEmailOk(email, expectsReply) &&
      body.length > 0 &&
      body.length <= 2000 &&
      topicOk &&
      consentOk
    if (supportSendEl) {
      supportSendEl.disabled =
        supportSending || !(ready || UNLOCK_BODY.test(body))
    }
  }

  function renderSupportComments(comments) {
    if (!supportCommentsEl) {
      return
    }
    while (supportCommentsEl.firstChild) {
      supportCommentsEl.removeChild(supportCommentsEl.firstChild)
    }
    const rows = Array.isArray(comments) ? comments : []
    let shown = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row || typeof row !== 'object') {
        continue
      }
      const nickname = typeof row.nickname === 'string' ? row.nickname : ''
      const body = typeof row.body === 'string' ? row.body : ''
      const sentOn = typeof row.sentOn === 'string' ? row.sentOn : ''
      if (!nickname || !body) {
        continue
      }
      const item = document.createElement('li')
      item.className = 'support-comment'
      const head = document.createElement('p')
      head.className = 'support-comment-head'
      const name = document.createElement('span')
      name.className = 'support-comment-name'
      setText(name, nickname)
      const date = document.createElement('span')
      date.className = 'support-comment-date'
      setText(date, t('support.commentSentOn', { date: sentOn }))
      head.appendChild(name)
      head.appendChild(date)
      const text = document.createElement('p')
      text.className = 'support-comment-body'
      setText(text, body)
      item.appendChild(head)
      item.appendChild(text)
      supportCommentsEl.appendChild(item)
      shown += 1
    }
    supportCommentsEl.hidden = shown === 0
    if (supportCommentsEmptyEl) {
      supportCommentsEmptyEl.hidden = shown > 0
    }
  }

  function renderSupport(support) {
    if (!supportViewEl) {
      return
    }
    const ready = support && typeof support === 'object' ? support : {}
    const buttons = supportViewEl.querySelectorAll('[data-support-link]')
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i]
      const linkId = btn.getAttribute('data-support-link')
      const isReady = ready[linkId] === true
      btn.disabled = !isReady
      btn.title = isReady
        ? t('support.opensInBrowser')
        : t('support.comingSoonTitle')
      const card = btn.closest('.support-coffee-card, .support-tier')
      if (card) {
        card.classList.toggle('is-ready', isReady)
      }
    }
    const nick = typeof ready.nickname === 'string' ? ready.nickname : ''
    if (
      supportNicknameEl &&
      !supportNicknameDirty &&
      supportNicknameEl.value.trim() === '' &&
      nick
    ) {
      supportNicknameEl.value = nick
    }
    const email = typeof ready.email === 'string' ? ready.email : ''
    if (
      supportEmailEl &&
      !supportEmailDirty &&
      supportEmailEl.value.trim() === '' &&
      email
    ) {
      supportEmailEl.value = email
    }
    leaderboardUnlocked = ready.leaderboardUnlocked === true
    if (tabLeaderboardEl) {
      tabLeaderboardEl.hidden = !leaderboardUnlocked
    }
    if (!leaderboardUnlocked && currentView === 'leaderboard') {
      setView('queries')
    }
    if (leaderboardUnlocked && pendingLeaderboardTab) {
      pendingLeaderboardTab = false
      setView('leaderboard')
    }
    renderSupportComments(ready.comments)
    syncSupportComposer()
  }

  function render(events, message, stats, settings) {
    if (isSupportedLanguage(settings.language)) {
      uiLanguage = settings.language
    }
    if (settings.i18n && typeof settings.i18n === 'object') {
      ui = settings.i18n
    }
    applyStaticI18n()

    if (message) {
      statusEl.hidden = false
      setText(statusEl, message)
    } else {
      statusEl.hidden = true
      setText(statusEl, '')
    }

    if (
      settings.budgetDayBasis === 'workingDays' ||
      settings.budgetDayBasis === 'calendarDays'
    ) {
      budgetDayBasis = settings.budgetDayBasis
    }
    if (
      settings.optimizeDepth === 'quick' ||
      settings.optimizeDepth === 'balanced' ||
      settings.optimizeDepth === 'deep'
    ) {
      optimizeDepth = settings.optimizeDepth
    }

    renderSettings(settings)
    applyHistoryTitle(
      typeof settings.historyLimit === 'number'
        ? settings.historyLimit
        : DEFAULT_HISTORY,
    )
    applyRefreshing(settings.refreshing === true)

    const warnOn = settings.showSpikeWarning !== false
    tableEvents = events || []
    tableWarnOn = warnOn
    tableBurnLevel =
      settings.burnRate && settings.burnRate.level
        ? settings.burnRate.level
        : 'ok'
    syncSpikesFilterUi()
    paintRows(tableEvents, warnOn)

    applyMtdPayload(settings.mtd)
    if (settings.modelCatalog && Array.isArray(settings.modelCatalog.models)) {
      modelCatalog = settings.modelCatalog
    }
    renderStats(
      stats,
      settings.mtd,
      settings.burnRate,
      warnOn,
      settings.codeLinesInsight === false ? null : settings.codeLines,
    )
    chartPoints = Array.isArray(settings.charts) ? settings.charts : []
    if (settings.codeLinesInsight === false || !settings.codeLines) {
      codeLinesSeries = []
      codeLinesSummary = null
      codeLinesDefaultBranch = 'master'
      if (codeLinesChartCardEl) {
        codeLinesChartCardEl.hidden = true
      }
    } else {
      codeLinesSeries = Array.isArray(settings.codeLines.series)
        ? settings.codeLines.series
        : []
      codeLinesSummary = settings.codeLines.summary || null
      codeLinesDefaultBranch =
        typeof settings.codeLines.defaultBranch === 'string' &&
        settings.codeLines.defaultBranch
          ? settings.codeLines.defaultBranch
          : 'master'
      if (codeLinesChartCardEl) {
        codeLinesChartCardEl.hidden = false
      }
    }
    renderPeriodCards(settings.periods)
    renderOptimize(settings.optimize)
    renderSupport(settings.support)
    if (
      (chartsViewEl && !chartsViewEl.hidden) ||
      (statsViewEl && !statsViewEl.hidden)
    ) {
      drawAllCharts()
    }
  }

  function submitThreshold() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = 0
    }
    const kilo = snapKilo(thresholdEl.value)
    thresholdDirty = false
    thresholdEl.value = String(kilo)
    const value = tokensFromKilo(kilo)
    updateThresholdPreview()
    vscode.postMessage({ type: 'setSpikeThreshold', value: value })
  }

  function scheduleSubmit() {
    thresholdDirty = true
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    updateThresholdPreview()
    debounceTimer = setTimeout(submitThreshold, 300)
  }

  function submitColors() {
    vscode.postMessage({ type: 'setOkColor', value: okColorEl.value })
    vscode.postMessage({ type: 'setWarnColor', value: warnColorEl.value })
  }

  function scheduleColors() {
    setText(okColorValueEl, okColorEl.value)
    setText(warnColorValueEl, warnColorEl.value)
    applyTheme(okColorEl.value, warnColorEl.value)
    if (colorTimer) {
      clearTimeout(colorTimer)
    }
    colorTimer = setTimeout(submitColors, 300)
  }

  window.addEventListener('message', function (event) {
    const data = event.data
    if (!data) {
      return
    }
    if (data.type === 'openTab') {
      setView(data.tab)
      return
    }
    if (data.type === 'leaderboardRepos') {
      renderLeaderboardRepos(data)
      return
    }
    if (data.type === 'leaderboardRange') {
      applyLeaderboardRange(data.from, data.to)
      return
    }
    if (data.type === 'leaderboardAuthors') {
      renderLeaderboardAuthors(data)
      return
    }
    if (data.type === 'leaderboardTeam') {
      renderLeaderboardTeam(data)
      return
    }
    if (data.type === 'leaderboardMerges') {
      renderLeaderboardMerges(data)
      return
    }
    if (data.type === 'leaderboardMyReposPreview') {
      const repos = data && Array.isArray(data.repos) ? data.repos : []
      openLbConfirm(
        t('leaderboard.confirmRepos'),
        repos,
        data && data.error ? data.error : '',
        function () {
          vscode.postMessage({ type: 'applyLeaderboardMyRepos' })
        },
      )
      return
    }
    if (data.type === 'leaderboard') {
      renderLeaderboard(data.leaderboard)
      return
    }
    if (data.type === 'modelCatalog') {
      modelCatalog = data.modelCatalog || null
      if (lastStatsArgs) {
        renderStats.apply(null, lastStatsArgs)
      }
      return
    }
    if (data.type === 'authorMessageResult') {
      supportSending = false
      const sendLabel = supportSendEl ? supportSendEl.querySelector('span') : null
      if (sendLabel) {
        setText(sendLabel, t('support.send'))
      }
      if (data.ok && supportBodyEl) {
        supportBodyEl.value = ''
      }
      if (supportMessageStatusEl) {
        supportMessageStatusEl.hidden = false
        supportMessageStatusEl.classList.toggle('is-error', data.ok !== true)
        setText(
          supportMessageStatusEl,
          typeof data.detail === 'string' && data.detail
            ? data.detail
            : data.ok
              ? t('support.sent')
              : t('support.mailFailed'),
        )
      }
      syncSupportComposer()
      return
    }
    if (data.type !== 'data') {
      return
    }
    render(data.events, data.message, data.stats, data)
  })

  thresholdEl.addEventListener('input', scheduleSubmit)
  thresholdEl.addEventListener('change', submitThreshold)
  thresholdEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      submitThreshold()
      thresholdEl.blur()
    }
  })
  function submitHistoryLimit(fromEl) {
    const source =
      fromEl ||
      (historyLimitEls.indexOf(document.activeElement) !== -1
        ? document.activeElement
        : historyLimitEls[0])
    if (!source) {
      return
    }
    const value = clampHistoryLimit(source.value)
    historyLimitDirty = false
    historyFromDateDirty = false
    historyFromDate = ''
    for (let i = 0; i < historyLimitEls.length; i++) {
      historyLimitEls[i].value = String(value)
    }
    for (let i = 0; i < historyFromDateEls.length; i++) {
      historyFromDateEls[i].value = ''
    }
    applyHistoryTitle(value)
    syncHistoryRangeUi()
    vscode.postMessage({ type: 'setHistoryLimit', value: value })
  }

  function markHistoryLimitDirty() {
    historyLimitDirty = true
  }

  function syncHistoryRangeUi() {
    const hasDate = historyFromDate !== ''
    for (let i = 0; i < historyLimitEls.length; i++) {
      historyLimitEls[i].disabled = hasDate
    }
  }

  function submitHistoryFromDate(value) {
    const parsed = parseFromDate(value)
    historyFromDateDirty = false
    historyFromDate = parsed
    const todayIso = isoFromLocal(new Date())
    for (let i = 0; i < historyFromDateEls.length; i++) {
      historyFromDateEls[i].max = todayIso
      historyFromDateEls[i].value = parsed
    }
    const limitSource = historyLimitEls[0]
    const limit = limitSource
      ? clampHistoryLimit(limitSource.value)
      : 1000
    applyHistoryTitle(limit)
    syncHistoryRangeUi()
    vscode.postMessage({ type: 'setHistoryFromDate', value: parsed })
  }

  for (let i = 0; i < historyLimitEls.length; i++) {
    const inputEl = historyLimitEls[i]
    inputEl.addEventListener('input', markHistoryLimitDirty)
    inputEl.addEventListener('change', function () {
      submitHistoryLimit(inputEl)
    })
    inputEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault()
        submitHistoryLimit(inputEl)
        inputEl.blur()
      }
    })
  }
  for (let i = 0; i < historyFromDateEls.length; i++) {
    const inputEl = historyFromDateEls[i]
    inputEl.addEventListener('input', function () {
      historyFromDateDirty = true
    })
    inputEl.addEventListener('change', function () {
      submitHistoryFromDate(inputEl.value)
    })
  }
  if (fromMonthSettingEl) {
    fromMonthSettingEl.addEventListener('click', function () {
      submitHistoryFromDate(startOfMonthIso())
    })
  }
  if (fromTodaySettingEl) {
    fromTodaySettingEl.addEventListener('click', function () {
      submitHistoryFromDate(isoFromLocal(new Date()))
    })
  }
  if (clearFromDateSettingEl) {
    clearFromDateSettingEl.addEventListener('click', function () {
      submitHistoryFromDate('')
    })
  }
  if (filterSpikesOnlyEl) {
    filterSpikesOnlyEl.addEventListener('change', function () {
      spikesOnly = filterSpikesOnlyEl.checked === true
      syncSpikesFilterUi()
      paintRows(tableEvents, tableWarnOn)
    })
  }
  if (refreshQueriesEl) {
    refreshQueriesEl.addEventListener('click', function () {
      if (refreshQueriesEl.disabled) {
        return
      }
      vscode.postMessage({ type: 'refresh' })
    })
  }
  showWarningEl.addEventListener('change', function () {
    vscode.postMessage({
      type: 'setShowSpikeWarning',
      value: showWarningEl.checked === true,
    })
  })
  function submitCriticalToken() {
    if (!criticalTokenEl || criticalTokenEl.disabled) {
      return
    }
    const kilo = snapKilo(criticalTokenEl.value)
    criticalTokenDirty = false
    criticalTokenEl.value = String(kilo)
    updateCriticalTokenPreview()
    vscode.postMessage({
      type: 'setCriticalTokenThreshold',
      value: tokensFromKilo(kilo),
    })
  }
  function submitCriticalCost() {
    if (!criticalCostEl || criticalCostEl.disabled) {
      return
    }
    const value = clampCriticalCost(criticalCostEl.value)
    criticalCostDirty = false
    criticalCostEl.value = String(value)
    vscode.postMessage({ type: 'setCriticalCostUsdThreshold', value: value })
  }
  if (showCriticalAlertEl) {
    showCriticalAlertEl.addEventListener('change', function () {
      syncCriticalAlertState()
      vscode.postMessage({
        type: 'setShowCriticalAlert',
        value: showCriticalAlertEl.checked === true,
      })
    })
  }
  function bindCriticalNumber(inputEl, markDirty, submit) {
    if (!inputEl) {
      return
    }
    inputEl.addEventListener('input', function () {
      markDirty()
    })
    inputEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault()
        submit()
        inputEl.blur()
      }
    })
    inputEl.addEventListener('change', submit)
    inputEl.addEventListener('blur', submit)
  }
  bindCriticalNumber(
    criticalTokenEl,
    function () {
      criticalTokenDirty = true
      updateCriticalTokenPreview()
    },
    submitCriticalToken,
  )
  bindCriticalNumber(
    criticalCostEl,
    function () {
      criticalCostDirty = true
    },
    submitCriticalCost,
  )
  function submitBurnWindow() {
    if (!burnRateWindowEl || burnRateWindowEl.disabled) {
      return
    }
    const value = clampBurnWindow(burnRateWindowEl.value)
    burnWindowDirty = false
    burnRateWindowEl.value = String(value)
    vscode.postMessage({ type: 'setBurnRateWindowMinutes', value: value })
  }
  function submitBurnWarningUsd() {
    if (!burnRateWarningUsdEl || burnRateWarningUsdEl.disabled) {
      return
    }
    const value = clampBurnUsd(burnRateWarningUsdEl.value, DEFAULT_BURN_WARNING_USD)
    burnWarningDirty = false
    burnRateWarningUsdEl.value = String(value)
    vscode.postMessage({ type: 'setBurnRateWarningUsd', value: value })
  }
  function submitBurnCriticalUsd() {
    if (!burnRateCriticalUsdEl || burnRateCriticalUsdEl.disabled) {
      return
    }
    const value = clampBurnUsd(
      burnRateCriticalUsdEl.value,
      DEFAULT_BURN_CRITICAL_USD,
    )
    burnCriticalDirty = false
    burnRateCriticalUsdEl.value = String(value)
    vscode.postMessage({ type: 'setBurnRateCriticalUsd', value: value })
  }
  function submitBurnMinQueries() {
    if (!burnRateMinQueriesEl || burnRateMinQueriesEl.disabled) {
      return
    }
    const value = clampBurnMinQueries(burnRateMinQueriesEl.value)
    burnMinQueriesDirty = false
    burnRateMinQueriesEl.value = String(value)
    vscode.postMessage({ type: 'setBurnRateMinQueries', value: value })
  }
  function bindBurnNumber(inputEl, markDirty, submit) {
    if (!inputEl) {
      return
    }
    inputEl.addEventListener('input', function () {
      markDirty()
    })
    inputEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault()
        submit()
        inputEl.blur()
      }
    })
    inputEl.addEventListener('change', submit)
    inputEl.addEventListener('blur', submit)
  }
  if (burnRateGuardEl) {
    burnRateGuardEl.addEventListener('change', function () {
      syncBurnRateGuardState()
      vscode.postMessage({
        type: 'setBurnRateGuard',
        value: burnRateGuardEl.checked === true,
      })
    })
  }
  if (codeLinesInsightEl) {
    codeLinesInsightEl.addEventListener('change', function () {
      vscode.postMessage({
        type: 'setCodeLinesInsight',
        value: codeLinesInsightEl.checked === true,
      })
    })
  }
  bindBurnNumber(
    burnRateWindowEl,
    function () {
      burnWindowDirty = true
    },
    submitBurnWindow,
  )
  bindBurnNumber(
    burnRateWarningUsdEl,
    function () {
      burnWarningDirty = true
    },
    submitBurnWarningUsd,
  )
  bindBurnNumber(
    burnRateCriticalUsdEl,
    function () {
      burnCriticalDirty = true
    },
    submitBurnCriticalUsd,
  )
  bindBurnNumber(
    burnRateMinQueriesEl,
    function () {
      burnMinQueriesDirty = true
    },
    submitBurnMinQueries,
  )
  if (burnRateWarningToastEl) {
    burnRateWarningToastEl.addEventListener('change', function () {
      vscode.postMessage({
        type: 'setBurnRateWarningToast',
        value: burnRateWarningToastEl.checked === true,
      })
    })
  }
  if (burnRateCriticalToastEl) {
    burnRateCriticalToastEl.addEventListener('change', function () {
      vscode.postMessage({
        type: 'setBurnRateCriticalToast',
        value: burnRateCriticalToastEl.checked === true,
      })
    })
  }
  if (showStatusBarEl) {
    showStatusBarEl.addEventListener('change', function () {
      syncBarEditorState()
      vscode.postMessage({
        type: 'setShowStatusBar',
        value: showStatusBarEl.checked === true,
      })
    })
  }
  if (showTodayEl) {
    showTodayEl.addEventListener('change', function () {
      vscode.postMessage({
        type: 'setShowToday',
        value: showTodayEl.checked === true,
      })
    })
  }
  if (minimalModeEl) {
    minimalModeEl.addEventListener('change', function () {
      syncBarEditorState()
      vscode.postMessage({
        type: 'setMinimalMode',
        value: minimalModeEl.checked === true,
      })
    })
  }
  if (recentQueryCountEl) {
    recentQueryCountEl.addEventListener('change', function () {
      const value = clampRecentQueryCount(recentQueryCountEl.value)
      recentQueryCountEl.value = String(value)
      renderStatusBarPreview(lastStatusBarPreview)
      vscode.postMessage({ type: 'setRecentQueryCount', value: value })
    })
  }
  if (budgetDayBasisEl) {
    budgetDayBasisEl.addEventListener('change', function () {
      const value =
        budgetDayBasisEl.value === 'calendarDays'
          ? 'calendarDays'
          : 'workingDays'
      budgetDayBasisEl.value = value
      budgetDayBasis = value
      vscode.postMessage({ type: 'setBudgetDayBasis', value: value })
    })
  }
  if (forecastWindowEl) {
    forecastWindowEl.addEventListener('change', function () {
      const value =
        forecastWindowEl.value === 'billingCycle'
          ? 'billingCycle'
          : 'calendarMonth'
      forecastWindowEl.value = value
      forecastWindow = value
      vscode.postMessage({ type: 'setForecastWindow', value: value })
    })
  }
  if (optimizeDepthSettingEl) {
    optimizeDepthSettingEl.addEventListener('change', function () {
      const raw = optimizeDepthSettingEl.value
      const value =
        raw === 'quick' || raw === 'deep' ? raw : 'balanced'
      optimizeDepthSettingEl.value = value
      optimizeDepth = value
      syncOptimizeDefaultUi(value)
      vscode.postMessage({ type: 'setOptimizeDepth', value: value })
    })
  }
  if (languageSettingEl) {
    languageSettingEl.addEventListener('change', function () {
      const value = isSupportedLanguage(languageSettingEl.value)
        ? languageSettingEl.value
        : 'en'
      languageSettingEl.value = value
      uiLanguage = value
      vscode.postMessage({ type: 'setLanguage', value: value })
    })
  }
  if (optimizeDepthCardsEl) {
    optimizeDepthCardsEl.addEventListener('click', function (event) {
      const target = event.target
      if (!target || !target.closest) {
        return
      }
      const setBtn = target.closest('[data-set-default]')
      if (setBtn) {
        const raw = setBtn.getAttribute('data-set-default')
        const value =
          raw === 'quick' || raw === 'deep' ? raw : 'balanced'
        if (value === optimizeDepth) {
          return
        }
        optimizeDepth = value
        syncOptimizeDefaultUi(value)
        if (optimizeDepthSettingEl) {
          optimizeDepthSettingEl.value = value
        }
        vscode.postMessage({ type: 'setOptimizeDepth', value: value })
        return
      }
      const runBtn = target.closest('[data-run-depth]')
      if (runBtn) {
        const raw = runBtn.getAttribute('data-run-depth')
        const value =
          raw === 'quick' || raw === 'deep' ? raw : 'balanced'
        vscode.postMessage({ type: 'runOptimize', depth: value })
      }
    })
  }
  if (runOptimizeToolbarEl) {
    runOptimizeToolbarEl.addEventListener('click', function () {
      const depth =
        optimizeDepth === 'quick' || optimizeDepth === 'deep'
          ? optimizeDepth
          : 'balanced'
      vscode.postMessage({ type: 'runOptimize', depth: depth })
    })
  }
  function submitPollInterval() {
    if (!pollIntervalEl) {
      return
    }
    const value = clampPollInterval(pollIntervalEl.value)
    pollIntervalDirty = false
    pollIntervalEl.value = String(value)
    vscode.postMessage({ type: 'setPollIntervalMinutes', value: value })
  }
  if (pollIntervalEl) {
    pollIntervalEl.addEventListener('input', function () {
      pollIntervalDirty = true
    })
    pollIntervalEl.addEventListener('change', submitPollInterval)
    pollIntervalEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault()
        submitPollInterval()
        pollIntervalEl.blur()
      }
    })
  }
  okColorEl.addEventListener('input', scheduleColors)
  warnColorEl.addEventListener('input', scheduleColors)
  resetColorsEl.addEventListener('click', function () {
    okColorEl.value = DEFAULT_OK
    warnColorEl.value = DEFAULT_WARN
    submitColors()
  })
  settingsFormEl.addEventListener('submit', function (event) {
    event.preventDefault()
  })
  tabQueriesEl.addEventListener('click', function () {
    setView('queries')
  })
  tabStatsEl.addEventListener('click', function () {
    setView('stats')
  })
  if (tabChartsEl) {
    tabChartsEl.addEventListener('click', function () {
      setView('charts')
    })
  }
  if (tabOptimizeEl) {
    tabOptimizeEl.addEventListener('click', function () {
      setView('optimize')
    })
  }
  if (tabLeaderboardEl) {
    tabLeaderboardEl.addEventListener('click', function () {
      setView('leaderboard')
    })
  }
  if (tabSupportEl) {
    tabSupportEl.addEventListener('click', function () {
      setView('support')
    })
  }
  tabSettingsEl.addEventListener('click', function () {
    setView('settings')
  })

  if (supportViewEl) {
    supportViewEl.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-support-link]')
      if (!btn || btn.disabled) {
        return
      }
      const linkId = btn.getAttribute('data-support-link')
      if (!linkId) {
        return
      }
      vscode.postMessage({ type: 'openSupportLink', id: linkId })
    })
  }
  if (supportNicknameEl) {
    supportNicknameEl.addEventListener('input', function () {
      supportNicknameDirty = true
      if (supportMessageStatusEl) {
        supportMessageStatusEl.hidden = true
      }
      syncSupportComposer()
    })
  }
  if (supportEmailEl) {
    supportEmailEl.addEventListener('input', function () {
      supportEmailDirty = true
      if (supportMessageStatusEl) {
        supportMessageStatusEl.hidden = true
      }
      syncSupportComposer()
    })
  }
  if (supportBodyEl) {
    supportBodyEl.addEventListener('input', function () {
      if (supportMessageStatusEl) {
        supportMessageStatusEl.hidden = true
      }
      syncSupportComposer()
    })
  }
  if (supportConsentEl) {
    supportConsentEl.addEventListener('change', function () {
      syncSupportComposer()
    })
  }
  if (supportMessageFormEl) {
    supportMessageFormEl.addEventListener('change', function () {
      syncSupportComposer()
    })
    supportMessageFormEl.addEventListener('submit', function (event) {
      event.preventDefault()
      syncSupportComposer()
      if (!supportSendEl || supportSendEl.disabled || supportSending || !supportNicknameEl || !supportBodyEl) {
        return
      }
      supportSending = true
      syncSupportComposer()
      const sendLabel = supportSendEl.querySelector('span')
      if (sendLabel) {
        setText(sendLabel, t('support.sending'))
      }
      if (supportMessageStatusEl) {
        supportMessageStatusEl.hidden = false
        supportMessageStatusEl.classList.remove('is-error')
        setText(supportMessageStatusEl, t('support.sending'))
      }
      vscode.postMessage({
        type: 'sendAuthorMessage',
        topic: selectedSupportTopic(),
        nickname: supportNicknameEl.value.trim(),
        body: supportBodyEl.value.trim(),
        consent: supportConsentEl ? supportConsentEl.checked === true : false,
        email: supportEmailEl ? supportEmailEl.value.trim() : '',
        expectsReply: supportExpectsReply(),
      })
    })
  }

  closeEl.addEventListener('click', function () {
    vscode.postMessage({ type: 'close' })
  })

  window.addEventListener('resize', function () {
    if (chartResizeTimer) {
      clearTimeout(chartResizeTimer)
    }
    chartResizeTimer = setTimeout(function () {
      const chartsOpen = chartsViewEl && !chartsViewEl.hidden
      const statsOpen = statsViewEl && !statsViewEl.hidden
      if (chartsOpen || statsOpen) {
        drawAllCharts()
      }
    }, 150)
  })

  wireNumberSteppers()
  wireLeaderboard()
  const dailyChartModeButtons = document.querySelectorAll(
    '#dailyChartTools [data-chart-mode]',
  )
  for (let i = 0; i < dailyChartModeButtons.length; i++) {
    dailyChartModeButtons[i].addEventListener('click', function () {
      setChartBarMode(dailyChartModeButtons[i].getAttribute('data-chart-mode'))
    })
  }
  vscode.postMessage({ type: 'ready' })
  applyVersion(document.documentElement.getAttribute('data-version'))
})()
