import { messageType } from './messages.js'
import { drawMtdForecastChart as drawMtdForecastChartImpl } from './charts/forecast.js'
import { ChartHost } from './charts/host.js'
import { createSettingsView } from './tabs/settings.js'
import { createQueriesView } from './tabs/queries.js'
import { createStatsView } from './tabs/stats.js'
import { createOptimizeView } from './tabs/optimize.js'
import { createSupportView } from './tabs/support.js'
import { createCodeLinesView } from './tabs/codeLines.js'
import { createModelCatalogView } from './tabs/modelCatalog.js'

/**
 * Webview state for the history panel.
 * `boot()` constructs this, listens for host messages, then `start()` posts ready.
 */
export class PanelSession {
  constructor() {
    const self = this

    let leaderboardView
    let queriesView
    let statsView
    let optimizeView
    let supportView
    let settingsView
    let charts
    const vscode = acquireVsCodeApi()
    const limits = globalThis.__cctLimits
    if (!limits) {
      throw new Error('Cursor Cost Tracker: limits.js did not load')
    }
    const SUPPORTED_LANGUAGES = {
      en: true,
      pl: true,
      'zh-cn': true,
      fr: true,
      de: true,
      ja: true,
      ko: true,
      'pt-br': true,
      ru: true,
      es: true,
      uk: true,
    }
    function isSupportedLanguage(value) {
      return typeof value === 'string' && SUPPORTED_LANGUAGES[value] === true
    }
    const DOCUMENT_LANG = {
      en: 'en',
      pl: 'pl',
      'zh-cn': 'zh-CN',
      fr: 'fr',
      de: 'de',
      ja: 'ja',
      ko: 'ko',
      'pt-br': 'pt-BR',
      ru: 'ru',
      es: 'es',
      uk: 'uk',
    }
    function documentLangFor(value) {
      return DOCUMENT_LANG[value] || 'en'
    }
    const statusEl = document.getElementById('status')
    const closeEl = document.getElementById('close')
    const thresholdEl = document.getElementById('threshold')
    const historyLimitEl = document.getElementById('historyLimit')
    const historyFromDateEl = document.getElementById('historyFromDate')
    const historyToDateEl = document.getElementById('historyToDate')
    const fromBillingCycleSettingEl = document.getElementById('fromBillingCycleSetting')
    const refreshQueriesEl = document.getElementById('refreshQueries')
    const showWarningEl = document.getElementById('showWarning')
    const showCriticalAlertEl = document.getElementById('showCriticalAlert')
    const criticalTokenEl = document.getElementById('criticalTokenThreshold')
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
    const queriesViewEl = document.getElementById('queriesView')
    const statsViewEl = document.getElementById('statsView')
    const statsChartTipEl = document.getElementById('statsChartTip')
    const chartsViewEl = document.getElementById('chartsView')
    const chartsEmptyEl = document.getElementById('chartsEmpty')
    const chartTokensEl = document.getElementById('chartTokens')
    const chartCostEl = document.getElementById('chartCost')
    const chartTipEl = document.getElementById('chartTip')
    const optimizeViewEl = document.getElementById('optimizeView')
    const leaderboardViewEl = document.getElementById('leaderboardView')
    const supportViewEl = document.getElementById('supportView')
    let leaderboardUnlocked = false
    let currentView = 'queries'
    let pendingLeaderboardTab = false
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
    let historyLimitDirty = false
    let historyFromDateDirty = false
    let historyToDateDirty = false
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
    const historyToDateEls = [historyToDateEl].filter(Boolean)
    let historyFromDate = ''
    let historyToDate = ''
    let billingCycleStart = ''
    let chartPoints = []
    let codeLinesSeries = []
    let codeLinesSummary = null
    let codeLinesDefaultBranch = 'master'
    /** Session-only; keep Projects / if-landed <details> open across poll re-renders. */
    let codeLinesReposOpen = false
    let codeLinesLandedOpen = false
    /** Keep the Coding stats info dialog open across the same poll re-render. */
    let codeLinesInfoOpen = false
    let codeLinesInfoScroll = 0
    let codeLinesInfoFocus = ''
    let codeLinesAuthorsDraft = null
    let codeLinesInfoRebuilding = false
    let mtdForecastPoints = []
    let mtdForecastSeries = []
    let mtdUnit = 'usd'
    let mtdMax = null
    let mtdChartRange = 'month'
    let chartBarMode = 'cumulative'
    let chartZoomMode = 'sample'
    let chartEvents = []
    let selectedChartDayKey = ''
    let mtdForecastSvgs = []
    let budgetDayBasis = 'workingDays'
    let forecastWindow = 'calendarMonth'
    let mtdResetDate = null
    let mtdResetMidday = false
    let optimizeDepth = 'balanced'
    let uiLanguage = 'en'
    let ui = null
    let chartResizeTimer = 0
    const DEFAULT_HISTORY = 1000
    const DEFAULT_RECENT_QUERY_COUNT = 3

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
      return limits.clampHistoryLimit(value)
    }

    function clampPollInterval(value) {
      return limits.clampPollInterval(value)
    }

    function clampRecentQueryCount(value) {
      return limits.clampRecentQueryCount(value)
    }

    function clampBurnWindow(value) {
      return limits.clampBurnWindow(value)
    }

    function clampBurnUsd(value, fallback) {
      return limits.clampBurnUsd(value, fallback)
    }

    function clampBurnMinQueries(value) {
      return limits.clampBurnMinQueries(value)
    }

    function isoFromLocal(date) {
      return limits.isoFromLocal(date)
    }

    function startOfMonthIso() {
      return limits.startOfMonthIso()
    }

    function parseFromDate(value) {
      return limits.parseFromDate(value)
    }

    function formatFromDateLabel(iso) {
      return limits.formatFromDateLabel(iso)
    }

    function daysAgoIso(days) {
      return limits.daysAgoIso(days)
    }

    function applyHistoryTitle(limit) {
      let title
      if (historyFromDate) {
        const todayIso = isoFromLocal(new Date())
        if (historyToDate && historyToDate !== todayIso) {
          title = t('queries.rangeTitle', {
            from: formatFromDateLabel(historyFromDate),
            to: formatFromDateLabel(historyToDate),
          })
        } else {
          title = t('queries.fromTitle', {
            date: formatFromDateLabel(historyFromDate),
          })
        }
      } else {
        title = t('queries.lastTitle', { n: clampHistoryLimit(limit) })
      }
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

    function setCatalogHtml(el, value) {
      const template = document.createElement('template')
      template.innerHTML = value
      const allowed = { STRONG: true, EM: true, CODE: true, BR: true }
      function sanitize(node) {
        const copy = []
        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i]
          if (child.nodeType === 3) {
            copy.push(document.createTextNode(child.textContent))
            continue
          }
          if (child.nodeType !== 1) {
            continue
          }
          if (allowed[child.tagName] !== true) {
            copy.push.apply(copy, sanitize(child))
            continue
          }
          const next = document.createElement(child.tagName.toLowerCase())
          const inner = sanitize(child)
          for (let j = 0; j < inner.length; j++) {
            next.appendChild(inner[j])
          }
          copy.push(next)
        }
        return copy
      }
      el.replaceChildren()
      const nodes = sanitize(template.content)
      for (let i = 0; i < nodes.length; i++) {
        el.appendChild(nodes[i])
      }
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
            setCatalogHtml(el, value)
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
      if (leaderboardView) {
        leaderboardView.refreshStatic()
      }
      syncDailyChartMode()
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

    const source = {
        get vscode() { return vscode },
        get t() { return t },
        get isSupportedLanguage() { return isSupportedLanguage },
        get languageSettingEl() { return languageSettingEl },
        get uiLanguage() { return uiLanguage },
        set uiLanguage(v) { uiLanguage = v },
        get ui() { return ui },
        set ui(v) { ui = v },
        get thresholdDirty() { return thresholdDirty },
        set thresholdDirty(v) { thresholdDirty = v },
        get thresholdEl() { return thresholdEl },
        get showWarningEl() { return showWarningEl },
        get showCriticalAlertEl() { return showCriticalAlertEl },
        get criticalTokenEl() { return criticalTokenEl },
        get criticalTokenDirty() { return criticalTokenDirty },
        set criticalTokenDirty(v) { criticalTokenDirty = v },
        get criticalCostEl() { return criticalCostEl },
        get criticalCostDirty() { return criticalCostDirty },
        set criticalCostDirty(v) { criticalCostDirty = v },
        get burnRateGuardEl() { return burnRateGuardEl },
        get burnWindowEl() { return burnRateWindowEl },
        get burnWindowDirty() { return burnWindowDirty },
        set burnWindowDirty(v) { burnWindowDirty = v },
        get burnWarningUsdEl() { return burnRateWarningUsdEl },
        get burnWarningDirty() { return burnWarningDirty },
        set burnWarningDirty(v) { burnWarningDirty = v },
        get burnCriticalUsdEl() { return burnRateCriticalUsdEl },
        get burnCriticalDirty() { return burnCriticalDirty },
        set burnCriticalDirty(v) { burnCriticalDirty = v },
        get burnMinQueriesEl() { return burnRateMinQueriesEl },
        get burnMinQueriesDirty() { return burnMinQueriesDirty },
        set burnMinQueriesDirty(v) { burnMinQueriesDirty = v },
        get burnWarningToastEl() { return burnRateWarningToastEl },
        get burnCriticalToastEl() { return burnRateCriticalToastEl },
        get codeLinesInsightEl() { return codeLinesInsightEl },
        get showStatusBarEl() { return showStatusBarEl },
        get showTodayEl() { return showTodayEl },
        get minimalModeEl() { return minimalModeEl },
        get recentQueryCountEl() { return recentQueryCountEl },
        get okColorEl() { return okColorEl },
        get warnColorEl() { return warnColorEl },
        get okColorValueEl() { return okColorValueEl },
        get warnColorValueEl() { return warnColorValueEl },
        get historyLimitEl() { return historyLimitEl },
        get historyFromDateEl() { return historyFromDateEl },
        get historyToDateEl() { return historyToDateEl },
        get historyLimitDirty() { return historyLimitDirty },
        set historyLimitDirty(v) { historyLimitDirty = v },
        get historyFromDateDirty() { return historyFromDateDirty },
        set historyFromDateDirty(v) { historyFromDateDirty = v },
        get historyToDateDirty() { return historyToDateDirty },
        set historyToDateDirty(v) { historyToDateDirty = v },
        get pollIntervalEl() { return pollIntervalEl },
        get pollIntervalDirty() { return pollIntervalDirty },
        set pollIntervalDirty(v) { pollIntervalDirty = v },
        get budgetDayBasisEl() { return budgetDayBasisEl },
        get forecastWindowEl() { return forecastWindowEl },
        get historyFromDate() { return historyFromDate },
        set historyFromDate(v) { historyFromDate = v },
        get historyToDate() { return historyToDate },
        set historyToDate(v) { historyToDate = v },
        get billingCycleStart() { return billingCycleStart },
        set billingCycleStart(v) { billingCycleStart = v },
        get budgetDayBasis() { return budgetDayBasis },
        set budgetDayBasis(v) { budgetDayBasis = v },
        get forecastWindow() { return forecastWindow },
        set forecastWindow(v) { forecastWindow = v },
        get mtdForecastSvgs() { return mtdForecastSvgs },
        set mtdForecastSvgs(v) { mtdForecastSvgs = v },
        get mtdForecastPoints() { return mtdForecastPoints },
        set mtdForecastPoints(v) { mtdForecastPoints = v },
        get mtdForecastSeries() { return mtdForecastSeries },
        set mtdForecastSeries(v) { mtdForecastSeries = v },
        get mtdUnit() { return mtdUnit },
        set mtdUnit(v) { mtdUnit = v },
        get chartBarMode() { return chartBarMode },
        set chartBarMode(v) { chartBarMode = v },
        get chartZoomMode() { return chartZoomMode },
        set chartZoomMode(v) { chartZoomMode = v },
        get chartPoints() { return chartPoints },
        set chartPoints(v) { chartPoints = v },
        get chartEvents() { return chartEvents },
        set chartEvents(v) { chartEvents = v },
        get selectedChartDayKey() { return selectedChartDayKey },
        set selectedChartDayKey(v) { selectedChartDayKey = v },
        get codeLinesSeries() { return codeLinesSeries },
        set codeLinesSeries(v) { codeLinesSeries = v },
        get codeLinesSummary() { return codeLinesSummary },
        set codeLinesSummary(v) { codeLinesSummary = v },
        get chartTipEl() { return chartTipEl },
        get statsChartTipEl() { return statsChartTipEl },
        get chartsViewEl() { return chartsViewEl },
        get statsViewEl() { return statsViewEl },
        get chartsEmptyEl() { return chartsEmptyEl },
        get chartTokensEl() { return chartTokensEl },
        get chartCostEl() { return chartCostEl },
        get chartCodeLinesEl() { return chartCodeLinesEl },
        get codeLinesChartCardEl() { return codeLinesChartCardEl },
        get syncDailyChartMode() { return syncDailyChartMode },
        get redrawMtdForecastChart() { return redrawMtdForecastChart },
        get drawCodeLinesChart() { return drawCodeLinesChart },
        get renderCodeLinesChartRatio() { return renderCodeLinesChartRatio },
        get syncCodeLinesChartLegend() { return syncCodeLinesChartLegend },
        get mtdMax() { return mtdMax },
        set mtdMax(v) { mtdMax = v },
        get mtdResetDate() { return mtdResetDate },
        set mtdResetDate(v) { mtdResetDate = v },
        get mtdResetMidday() { return mtdResetMidday },
        set mtdResetMidday(v) { mtdResetMidday = v },
        get mtdRangeToggle() { return mtdRangeToggle },
        get svgNode() { return charts.svgNode },
        get codeLinesCard() {
          return function (codeLines) {
            return codeLinesView.codeLinesCard(codeLines)
          }
        },
        get codeLinesInfoRebuilding() { return codeLinesInfoRebuilding },
        set codeLinesInfoRebuilding(v) { codeLinesInfoRebuilding = v },
        get restoreCodeLinesInfo() {
          return function (root) {
            codeLinesView.restoreCodeLinesInfo(root)
          }
        },
        get modelCatalogPanel() {
          return function () {
            return modelCatalogView.modelCatalogPanel()
          }
        },
        get optimizeDepth() { return optimizeDepth },
        set optimizeDepth(v) { optimizeDepth = v },
        get lastStatusBarPreview() { return lastStatusBarPreview },
        get fillIfIdle() { return fillIfIdle },
        get setText() { return setText },
        get el() { return el },
        get lookupPath() { return lookupPath },
        get addCell() { return addCell },
        get compactCost() { return compactCost },
        get compactTokens() { return compactTokens },
        get applyLeaderboardUnlock() { return applyLeaderboardUnlock },
        get tipTitle() { return charts.tipTitle },
        get tipSub() { return charts.tipSub },
        get placeTip() { return charts.placeTip },
        get updateThresholdPreview() { return settingsView.updateThresholdPreview },
        get updateCriticalTokenPreview() { return settingsView.updateCriticalTokenPreview },
        get syncCriticalAlertState() { return settingsView.syncCriticalAlertState },
        get syncBurnRateGuardState() { return settingsView.syncBurnRateGuardState },
        get syncNumberStepperState() { return settingsView.syncNumberStepperState },
        get syncHistoryRangeUi() { return settingsView.syncHistoryRangeUi },
        get syncBarEditorState() { return syncBarEditorState },
        get renderStatusBarPreview() { return renderStatusBarPreview },
        get applyHistoryTitle() { return applyHistoryTitle },
        get formatFromDateLabel() { return formatFromDateLabel },
        get clampHistoryLimit() { return clampHistoryLimit },
        get clampPollInterval() { return clampPollInterval },
        get clampRecentQueryCount() { return clampRecentQueryCount },
        get clampBurnWindow() { return clampBurnWindow },
        get clampBurnUsd() { return clampBurnUsd },
        get clampBurnMinQueries() { return clampBurnMinQueries },
        get clampCriticalCost() { return settingsView.clampCriticalCost },
        get kiloFromTokens() { return kiloFromTokens },
        get snapKilo() { return snapKilo },
        get tokensFromKilo() { return tokensFromKilo },
        get syncOptimizeDefault() {
          return function (value) {
            optimizeView.syncDefault(value)
          }
        },
        get tokenPreview() { return tokenPreview },
        get depthLabel() { return depthLabel },
        get parseFromDate() { return parseFromDate },
        get isoFromLocal() { return isoFromLocal },
        get startOfMonthIso() { return startOfMonthIso },
        get daysAgoIso() { return daysAgoIso },
        get applyStaticI18n() { return applyStaticI18n },
        get applyVersion() { return applyVersion },
        get applyRefreshing() { return applyRefreshing },
        get applyTheme() { return applyTheme },
        get burnRateCriticalToastEl() { return burnRateCriticalToastEl },
        get burnRateCriticalUsdEl() { return burnRateCriticalUsdEl },
        get burnRateMinQueriesEl() { return burnRateMinQueriesEl },
        get burnRateWarningToastEl() { return burnRateWarningToastEl },
        get burnRateWarningUsdEl() { return burnRateWarningUsdEl },
        get burnRateWindowEl() { return burnRateWindowEl },
        get fromBillingCycleSettingEl() { return fromBillingCycleSettingEl },
        get historyFromDateEls() { return historyFromDateEls },
        get historyLimitEls() { return historyLimitEls },
        get historyToDateEls() { return historyToDateEls },
        get optimizeDepthSettingEl() { return optimizeDepthSettingEl },
    }
    const sourceNames = Object.keys(source)
    for (let i = 0; i < sourceNames.length; i++) {
      const key = sourceNames[i]
      const desc = Object.getOwnPropertyDescriptor(source, key)
      if (!desc) {
        continue
      }
      Object.defineProperty(this, key, desc)
    }


    charts = new ChartHost(this)
    queriesView = createQueriesView(this)
    statsView = createStatsView(this)
    optimizeView = createOptimizeView(this)
    supportView = createSupportView(this)
    settingsView = createSettingsView(this)

    let leaderboardWired = false
    const leaderboardQueue = []

    function mountLeaderboard() {
      if (leaderboardView) {
        return leaderboardView
      }
      const factory = globalThis.__cctCreateLeaderboardView
      if (typeof factory !== 'function') {
        return null
      }
      leaderboardView = factory(self)
      return leaderboardView
    }

    function flushLeaderboard() {
      const view = mountLeaderboard()
      if (!view) {
        return
      }
      if (!leaderboardWired) {
        leaderboardWired = true
        view.wire()
        view.refreshStatic()
      }
      const pending = leaderboardQueue.splice(0)
      for (let i = 0; i < pending.length; i++) {
        pending[i](view)
      }
    }

    function withLeaderboard(run) {
      const view = mountLeaderboard()
      if (!view || !leaderboardWired) {
        leaderboardQueue.push(run)
        return
      }
      run(view)
    }

    function loadLeaderboardScript(uri) {
      if (globalThis.__cctCreateLeaderboardView) {
        flushLeaderboard()
        return
      }
      if (typeof uri !== 'string' || uri === '') {
        return
      }
      const current = document.querySelector('script')
      const nonce = current && current.nonce
      const script = document.createElement('script')
      if (nonce) {
        script.nonce = nonce
      }
      script.src = uri
      document.body.appendChild(script)
    }

    document.addEventListener('cct-leaderboard-ready', flushLeaderboard)

    function barIcon(name, spin) {
      const wrap = el('span', 'bar-icon' + (spin ? ' is-spin' : ''))
      const pathD = BAR_ICON_PATHS[name]
      if (!pathD) {
        return wrap
      }
      const svg = charts.svgNode('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' })
      const path = charts.svgNode('path', { d: pathD })
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

    function applyLeaderboardUnlock(unlocked) {
      leaderboardUnlocked = unlocked === true
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
        charts.drawAllCharts()
      } else {
        charts.hideChartTips()
      }
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

    function closeChartDayDetail() {
      selectedChartDayKey = ''
      const detail = document.getElementById('chartDayDetail')
      if (detail) {
        detail.hidden = true
      }
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

    function drawMtdForecastChart(svg, points, series, max, resetDate, resetMidday, windowKind) {
      drawMtdForecastChartImpl(svg, points, series, max, resetDate, resetMidday, windowKind, charts)
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

    const codeLinesView = createCodeLinesView({
      get t() { return t },
      get setText() { return setText },
      get el() { return el },
      get clearSvg() { return charts.clearSvg },
      get svgNode() { return charts.svgNode },
      get vscode() { return vscode },
      get meterRow() { return statsView.meterRow },
      get codeLinesChartRatioEl() { return codeLinesChartRatioEl },
      get codeLinesLegendAllEl() { return codeLinesLegendAllEl },
      get codeLinesLegendPendingEl() { return codeLinesLegendPendingEl },
      get codeLinesDefaultBranch() { return codeLinesDefaultBranch },
      get codeLinesReposOpen() { return codeLinesReposOpen },
      set codeLinesReposOpen(v) { codeLinesReposOpen = v },
      get codeLinesLandedOpen() { return codeLinesLandedOpen },
      set codeLinesLandedOpen(v) { codeLinesLandedOpen = v },
      get codeLinesInfoOpen() { return codeLinesInfoOpen },
      set codeLinesInfoOpen(v) { codeLinesInfoOpen = v },
      get codeLinesInfoScroll() { return codeLinesInfoScroll },
      set codeLinesInfoScroll(v) { codeLinesInfoScroll = v },
      get codeLinesInfoFocus() { return codeLinesInfoFocus },
      set codeLinesInfoFocus(v) { codeLinesInfoFocus = v },
      get codeLinesAuthorsDraft() { return codeLinesAuthorsDraft },
      set codeLinesAuthorsDraft(v) { codeLinesAuthorsDraft = v },
      get codeLinesInfoRebuilding() { return codeLinesInfoRebuilding },
    })
    function drawCodeLinesChart(svg, series, summary) {
      return codeLinesView.drawCodeLinesChart(svg, series, summary)
    }
    function renderCodeLinesChartRatio(headline) {
      return codeLinesView.renderCodeLinesChartRatio(headline)
    }
    function syncCodeLinesChartLegend(headline) {
      return codeLinesView.syncCodeLinesChartLegend(headline)
    }
    let modelCatalog = null
    let catalogSortKey = 'cost'
    let catalogSortDir = 'asc'
    let catalogActiveOnly = true
    let catalogHideFast = true

    const modelCatalogView = createModelCatalogView({
      get t() { return t },
      get setText() { return setText },
      get el() { return el },
      get vscode() { return vscode },
      get modelCatalog() { return modelCatalog },
      get catalogSortKey() { return catalogSortKey },
      set catalogSortKey(v) { catalogSortKey = v },
      get catalogSortDir() { return catalogSortDir },
      set catalogSortDir(v) { catalogSortDir = v },
      get catalogActiveOnly() { return catalogActiveOnly },
      set catalogActiveOnly(v) { catalogActiveOnly = v },
      get catalogHideFast() { return catalogHideFast },
      set catalogHideFast(v) { catalogHideFast = v },
      get lastStatsArgs() { return statsView.args },
      get renderStats() { return statsView.render },
    })
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

    function fillIfIdle(inputEl, value) {
      if (document.activeElement === inputEl) {
        return
      }
      inputEl.value = value
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

      settingsView.render(settings)
      applyHistoryTitle(
        typeof settings.historyLimit === 'number'
          ? settings.historyLimit
          : DEFAULT_HISTORY,
      )
      applyRefreshing(settings.refreshing === true)

      const warnOn = settings.showSpikeWarning !== false
      queriesView.apply(events, settings, warnOn)

      statsView.applyMtd(settings.mtd)
      if (settings.modelCatalog && Array.isArray(settings.modelCatalog.models)) {
        modelCatalog = settings.modelCatalog
      }
      statsView.render(
        stats,
        settings.mtd,
        settings.burnRate,
        warnOn,
        settings.codeLinesInsight === false ? null : settings.codeLines,
      )
      chartPoints = Array.isArray(settings.charts) ? settings.charts : []
      chartEvents = Array.isArray(events) ? events : []
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
      statsView.renderPeriods(settings.periods)
      optimizeView.render(settings.optimize)
      supportView.render(settings.support)
      if (
        (chartsViewEl && !chartsViewEl.hidden) ||
        (statsViewEl && !statsViewEl.hidden)
      ) {
        charts.drawAllCharts()
      }
    }


    this.onMessage = function (data) {
      if (!data) {
        return
      }
      if (data.type === 'openTab') {
        setView(data.tab)
        return
      }
      if (data.type === 'leaderboardScript') {
        loadLeaderboardScript(data.uri)
        return
      }
      if (data.type === 'leaderboardRepos') {
        withLeaderboard(function (view) {
          view.renderRepos(data)
        })
        return
      }
      if (data.type === 'leaderboardRange') {
        withLeaderboard(function (view) {
          view.applyRange(data.from, data.to)
        })
        return
      }
      if (data.type === 'leaderboardAuthors') {
        withLeaderboard(function (view) {
          view.renderAuthors(data)
        })
        return
      }
      if (data.type === 'leaderboardTeam') {
        withLeaderboard(function (view) {
          view.renderTeam(data)
        })
        return
      }
      if (data.type === 'leaderboardMerges') {
        withLeaderboard(function (view) {
          view.renderMerges(data)
        })
        return
      }
      if (data.type === 'leaderboardMyReposPreview') {
        withLeaderboard(function (view) {
          const repos = data && Array.isArray(data.repos) ? data.repos : []
          view.openConfirm(
            t('leaderboard.confirmRepos'),
            repos,
            data && data.error ? data.error : '',
            function () {
              vscode.postMessage({ type: messageType.applyLeaderboardMyRepos })
            },
          )
        })
        return
      }
      if (data.type === 'leaderboard') {
        withLeaderboard(function (view) {
          view.render(data.leaderboard)
        })
        return
      }
      if (data.type === 'modelCatalog') {
        modelCatalog = data.modelCatalog || null
        if (statsView.args) {
          statsView.render.apply(null, statsView.args)
          if (
            (chartsViewEl && !chartsViewEl.hidden) ||
            (statsViewEl && !statsViewEl.hidden)
          ) {
            charts.drawAllCharts()
          }
        }
        return
      }
      if (data.type === 'authorMessageResult') {
        supportView.onResult(data)
        return
      }
      if (data.type !== 'data') {
        return
      }
      render(data.events, data.message, data.stats, data)

    }
    this.start = function () {

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

    closeEl.addEventListener('click', function () {
      vscode.postMessage({ type: messageType.close })
    })

    window.addEventListener('resize', function () {
      if (chartResizeTimer) {
        window.clearTimeout(chartResizeTimer)
      }
      chartResizeTimer = window.setTimeout(function () {
        const chartsOpen = chartsViewEl && !chartsViewEl.hidden
        const statsOpen = statsViewEl && !statsViewEl.hidden
        if (chartsOpen || statsOpen) {
          charts.drawAllCharts()
        }
      }, 150)
    })

    settingsView.wire()
    flushLeaderboard()
    queriesView.wire()
    optimizeView.wire()
    supportView.wire()
    const dailyChartModeButtons = document.querySelectorAll(
      '#dailyChartTools [data-chart-mode]',
    )
    for (let i = 0; i < dailyChartModeButtons.length; i++) {
      dailyChartModeButtons[i].addEventListener('click', function () {
        charts.setChartBarMode(dailyChartModeButtons[i].getAttribute('data-chart-mode'))
      })
    }
    const dailyChartZoomButtons = document.querySelectorAll(
      '#dailyChartZoom [data-chart-zoom]',
    )
    for (let i = 0; i < dailyChartZoomButtons.length; i++) {
      dailyChartZoomButtons[i].addEventListener('click', function () {
        charts.setChartZoomMode(dailyChartZoomButtons[i].getAttribute('data-chart-zoom'))
      })
    }
    charts.syncChartZoomUi()
    const chartDayDetailCloseEl = document.getElementById('chartDayDetailClose')
    if (chartDayDetailCloseEl) {
      chartDayDetailCloseEl.addEventListener('click', closeChartDayDetail)
    }
    self.post(messageType.ready)
    applyVersion(document.documentElement.getAttribute('data-version'))
    }
  }

  /**
   * @param {string} type
   * @param {Record<string, unknown>=} extra
   */
  post(type, extra) {
    const body = extra && typeof extra === 'object' ? extra : {}
    this.vscode.postMessage({ type, ...body })
  }
}
