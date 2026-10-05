/** Edit here; media/history.js is generated. */
import { messageType } from '../messages.js'
import { bindBurnNumber as bindBurnNumberImpl } from './burnNumber.js'

function renderSettings(data, r) {
  if (
    r.isSupportedLanguage(data.language) &&
    r.languageSettingEl &&
    document.activeElement !== r.languageSettingEl
  ) {
    r.languageSettingEl.value = data.language
    r.uiLanguage = data.language
  }
  if (data.i18n && typeof data.i18n === 'object') {
    r.ui = data.i18n
  }
  if (typeof data.spikeTokenThreshold === 'number' && !r.thresholdDirty) {
    r.fillIfIdle(r.thresholdEl, String(r.kiloFromTokens(data.spikeTokenThreshold)))
    if (document.activeElement !== r.thresholdEl) {
      r.updateThresholdPreview()
    }
  }
  if (
    typeof data.showSpikeWarning === 'boolean' &&
    document.activeElement !== r.showWarningEl
  ) {
    r.showWarningEl.checked = data.showSpikeWarning
  }
  if (
    typeof data.showCriticalAlert === 'boolean' &&
    r.showCriticalAlertEl &&
    document.activeElement !== r.showCriticalAlertEl
  ) {
    r.showCriticalAlertEl.checked = data.showCriticalAlert
  }
  if (typeof data.criticalTokenThreshold === 'number' && r.criticalTokenEl) {
    if (!r.criticalTokenDirty) {
      r.fillIfIdle(
        r.criticalTokenEl,
        String(r.kiloFromTokens(data.criticalTokenThreshold)),
      )
    }
    if (document.activeElement !== r.criticalTokenEl) {
      r.updateCriticalTokenPreview()
    }
  }
  if (
    typeof data.criticalCostUsdThreshold === 'number' &&
    r.criticalCostEl &&
    !r.criticalCostDirty
  ) {
    r.fillIfIdle(r.criticalCostEl, String(data.criticalCostUsdThreshold))
  }
  r.syncCriticalAlertState()
  if (
    typeof data.burnRateGuard === 'boolean' &&
    r.burnRateGuardEl &&
    document.activeElement !== r.burnRateGuardEl
  ) {
    r.burnRateGuardEl.checked = data.burnRateGuard
  }
  if (
    typeof data.burnRateWindowMinutes === 'number' &&
    r.burnRateWindowEl &&
    !r.burnWindowDirty
  ) {
    r.fillIfIdle(r.burnRateWindowEl, String(data.burnRateWindowMinutes))
  }
  if (
    typeof data.burnRateWarningUsd === 'number' &&
    r.burnRateWarningUsdEl &&
    !r.burnWarningDirty
  ) {
    r.fillIfIdle(r.burnRateWarningUsdEl, String(data.burnRateWarningUsd))
  }
  if (
    typeof data.burnRateCriticalUsd === 'number' &&
    r.burnRateCriticalUsdEl &&
    !r.burnCriticalDirty
  ) {
    r.fillIfIdle(r.burnRateCriticalUsdEl, String(data.burnRateCriticalUsd))
  }
  if (
    typeof data.burnRateMinQueries === 'number' &&
    r.burnRateMinQueriesEl &&
    !r.burnMinQueriesDirty
  ) {
    r.fillIfIdle(r.burnRateMinQueriesEl, String(data.burnRateMinQueries))
  }
  if (
    typeof data.burnRateWarningToast === 'boolean' &&
    r.burnRateWarningToastEl &&
    document.activeElement !== r.burnRateWarningToastEl
  ) {
    r.burnRateWarningToastEl.checked = data.burnRateWarningToast
  }
  if (
    typeof data.burnRateCriticalToast === 'boolean' &&
    r.burnRateCriticalToastEl &&
    document.activeElement !== r.burnRateCriticalToastEl
  ) {
    r.burnRateCriticalToastEl.checked = data.burnRateCriticalToast
  }
  r.syncBurnRateGuardState()
  if (
    typeof data.codeLinesInsight === 'boolean' &&
    r.codeLinesInsightEl &&
    document.activeElement !== r.codeLinesInsightEl
  ) {
    r.codeLinesInsightEl.checked = data.codeLinesInsight
  }
  if (
    typeof data.showStatusBar === 'boolean' &&
    r.showStatusBarEl &&
    document.activeElement !== r.showStatusBarEl
  ) {
    r.showStatusBarEl.checked = data.showStatusBar
  }
  if (
    typeof data.showToday === 'boolean' &&
    r.showTodayEl &&
    document.activeElement !== r.showTodayEl
  ) {
    r.showTodayEl.checked = data.showToday
  }
  if (
    typeof data.minimalMode === 'boolean' &&
    r.minimalModeEl &&
    document.activeElement !== r.minimalModeEl
  ) {
    r.minimalModeEl.checked = data.minimalMode
  }
  if (
    typeof data.recentQueryCount === 'number' &&
    r.recentQueryCountEl &&
    document.activeElement !== r.recentQueryCountEl
  ) {
    r.recentQueryCountEl.value = String(
      r.clampRecentQueryCount(data.recentQueryCount),
    )
  }
  if (
    (data.budgetDayBasis === 'workingDays' ||
      data.budgetDayBasis === 'calendarDays') &&
    r.budgetDayBasisEl &&
    document.activeElement !== r.budgetDayBasisEl
  ) {
    r.budgetDayBasisEl.value = data.budgetDayBasis
  }
  if (
    (data.forecastWindow === 'calendarMonth' ||
      data.forecastWindow === 'billingCycle') &&
    r.forecastWindowEl &&
    document.activeElement !== r.forecastWindowEl &&
    (!data.mtd || data.mtd.billingCycleAvailable === true ||
      data.forecastWindow === 'calendarMonth')
  ) {
    r.forecastWindowEl.value = data.forecastWindow
  }
  if (
    (data.optimizeDepth === 'quick' ||
      data.optimizeDepth === 'balanced' ||
      data.optimizeDepth === 'deep') &&
    r.optimizeDepthSettingEl &&
    document.activeElement !== r.optimizeDepthSettingEl
  ) {
    r.optimizeDepthSettingEl.value = data.optimizeDepth
  }
  if (
    typeof data.pollIntervalMinutes === 'number' &&
    r.pollIntervalEl &&
    !r.pollIntervalDirty
  ) {
    r.fillIfIdle(r.pollIntervalEl, String(r.clampPollInterval(data.pollIntervalMinutes)))
  }
  if (typeof data.okColor === 'string') {
    r.fillIfIdle(r.okColorEl, data.okColor)
    r.setText(r.okColorValueEl, data.okColor)
  }
  if (typeof data.warnColor === 'string') {
    r.fillIfIdle(r.warnColorEl, data.warnColor)
    r.setText(r.warnColorValueEl, data.warnColor)
  }
  r.applyTheme(data.okColor, data.warnColor)
  r.applyVersion(data.extensionVersion)
  r.renderStatusBarPreview(data.statusBarPreview)
  r.syncBarEditorState()
  if (typeof data.historyLimit === 'number' && !r.historyLimitDirty) {
    const text = String(r.clampHistoryLimit(data.historyLimit))
    for (let i = 0; i < r.historyLimitEls.length; i++) {
      r.fillIfIdle(r.historyLimitEls[i], text)
    }
  }
  if (!r.historyFromDateDirty) {
    const nextDate =
      typeof data.historyFromDate === 'string'
        ? r.parseFromDate(data.historyFromDate)
        : ''
    r.historyFromDate = nextDate
    const todayIso = r.isoFromLocal(new Date())
    for (let i = 0; i < r.historyFromDateEls.length; i++) {
      r.historyFromDateEls[i].max = todayIso
      r.fillIfIdle(r.historyFromDateEls[i], nextDate)
    }
  }
  if (!r.historyToDateDirty) {
    const nextTo =
      typeof data.historyToDate === 'string'
        ? r.parseFromDate(data.historyToDate)
        : ''
    r.historyToDate = nextTo
    const todayIso = r.isoFromLocal(new Date())
    for (let i = 0; i < r.historyToDateEls.length; i++) {
      r.historyToDateEls[i].max = todayIso
      r.fillIfIdle(r.historyToDateEls[i], nextTo)
    }
  }
  r.billingCycleStart =
    typeof data.billingCycleStart === 'string'
      ? r.parseFromDate(data.billingCycleStart)
      : ''
  if (r.fromBillingCycleSettingEl) {
    r.fromBillingCycleSettingEl.disabled = r.billingCycleStart === ''
  }
  if (typeof data.historyLimit === 'number') {
    r.applyHistoryTitle(data.historyLimit)
  }
  r.syncHistoryRangeUi()
}

export function createSettingsView(session) {
  const DEFAULT_OK = '#89D185'
  const DEFAULT_WARN = '#F14C4C'
  const DEFAULT_BURN_WARNING_USD = 2
  const DEFAULT_BURN_CRITICAL_USD = 5
  const thresholdPreviewEl = document.getElementById('thresholdPreview')
  const criticalTokenPreviewEl = document.getElementById('criticalTokenPreview')
  const fromMonthSettingEl = document.getElementById('fromMonthSetting')
  const fromTodaySettingEl = document.getElementById('fromTodaySetting')
  const fromLast7SettingEl = document.getElementById('fromLast7Setting')
  const fromLast30SettingEl = document.getElementById('fromLast30Setting')
  const clearFromDateSettingEl = document.getElementById('clearFromDateSetting')
  const refreshQueriesEl = document.getElementById('refreshQueries')
  const resetColorsEl = document.getElementById('resetColors')
  const settingsFormEl = document.getElementById('settingsForm')
  let debounceTimer = 0
  let colorTimer = 0

  function updateThresholdPreview() {
    session.setText(thresholdPreviewEl, session.tokenPreview(session.tokensFromKilo(session.thresholdEl.value)))
  }

  function updateCriticalTokenPreview() {
    if (!criticalTokenPreviewEl || !session.criticalTokenEl) {
      return
    }
    session.setText(
      criticalTokenPreviewEl,
      session.tokenPreview(session.tokensFromKilo(session.criticalTokenEl.value)),
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
    const on = !session.showCriticalAlertEl || session.showCriticalAlertEl.checked === true
    if (session.criticalTokenEl) {
      session.criticalTokenEl.disabled = !on
    }
    if (session.criticalCostEl) {
      session.criticalCostEl.disabled = !on
    }
    syncNumberStepperState(session.criticalTokenEl)
    syncNumberStepperState(session.criticalCostEl)
  }

  function syncBurnRateGuardState() {
    const on = !session.burnRateGuardEl || session.burnRateGuardEl.checked === true
    const fields = [
      session.burnRateWindowEl,
      session.burnRateWarningUsdEl,
      session.burnRateCriticalUsdEl,
      session.burnRateMinQueriesEl,
      session.burnRateWarningToastEl,
      session.burnRateCriticalToastEl,
    ]
    for (let i = 0; i < fields.length; i++) {
      if (fields[i]) {
        fields[i].disabled = !on
      }
    }
    syncNumberStepperState(session.burnRateWindowEl)
    syncNumberStepperState(session.burnRateWarningUsdEl)
    syncNumberStepperState(session.burnRateCriticalUsdEl)
    syncNumberStepperState(session.burnRateMinQueriesEl)
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
    if (inputEl === session.thresholdEl || inputEl === session.criticalTokenEl) {
      next = session.snapKilo(next)
    } else if (inputEl === session.criticalCostEl) {
      next = clampCriticalCost(next)
    } else if (inputEl === session.burnRateWindowEl) {
      next = session.clampBurnWindow(next)
    } else if (inputEl === session.burnRateWarningUsdEl) {
      next = session.clampBurnUsd(next, DEFAULT_BURN_WARNING_USD)
    } else if (inputEl === session.burnRateCriticalUsdEl) {
      next = session.clampBurnUsd(next, DEFAULT_BURN_CRITICAL_USD)
    } else if (inputEl === session.burnRateMinQueriesEl) {
      next = session.clampBurnMinQueries(next)
    } else if (inputEl === session.pollIntervalEl) {
      next = session.clampPollInterval(next)
    } else if (step < 1) {
      const decimals = String(step).includes('.')
        ? String(step).split('.')[1].length
        : 2
      next = Math.round(next * Math.pow(10, decimals)) / Math.pow(10, decimals)
    } else {
      next = Math.round(next)
    }
    inputEl.value = String(next)
    inputEl.dispatchEvent(new window.Event('input', { bubbles: true }))
    inputEl.dispatchEvent(new window.Event('change', { bubbles: true }))
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

  function submitThreshold() {
    if (debounceTimer) {
      window.clearTimeout(debounceTimer)
      debounceTimer = 0
    }
    const kilo = session.snapKilo(session.thresholdEl.value)
    session.thresholdDirty = false
    session.thresholdEl.value = String(kilo)
    const value = session.tokensFromKilo(kilo)
    updateThresholdPreview()
    session.vscode.postMessage({ type: messageType.setSpikeThreshold, value: value })
  }

  function scheduleSubmit() {
    session.thresholdDirty = true
    if (debounceTimer) {
      window.clearTimeout(debounceTimer)
    }
    updateThresholdPreview()
    debounceTimer = window.setTimeout(submitThreshold, 300)
  }

  function submitColors() {
    session.vscode.postMessage({ type: messageType.setOkColor, value: session.okColorEl.value })
    session.vscode.postMessage({ type: messageType.setWarnColor, value: session.warnColorEl.value })
  }

  function scheduleColors() {
    session.setText(session.okColorValueEl, session.okColorEl.value)
    session.setText(session.warnColorValueEl, session.warnColorEl.value)
    session.applyTheme(session.okColorEl.value, session.warnColorEl.value)
    if (colorTimer) {
      window.clearTimeout(colorTimer)
    }
    colorTimer = window.setTimeout(submitColors, 300)
  }

  function syncHistoryRangeUi() {
    const hasDate = session.historyFromDate !== ''
    for (let i = 0; i < session.historyLimitEls.length; i++) {
      session.historyLimitEls[i].disabled = hasDate
    }
    for (let i = 0; i < session.historyToDateEls.length; i++) {
      session.historyToDateEls[i].disabled = !hasDate
    }
  }

  function wire() {
    session.thresholdEl.addEventListener('input', scheduleSubmit)
    session.thresholdEl.addEventListener('change', submitThreshold)
    session.thresholdEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault()
        submitThreshold()
        session.thresholdEl.blur()
      }
    })
    function submitHistoryLimit(fromEl) {
      const source =
        fromEl ||
        (session.historyLimitEls.indexOf(document.activeElement) !== -1
          ? document.activeElement
          : session.historyLimitEls[0])
      if (!source) {
        return
      }
      const value = session.clampHistoryLimit(source.value)
      session.historyLimitDirty = false
      session.historyFromDateDirty = false
      session.historyToDateDirty = false
      session.historyFromDate = ''
      session.historyToDate = ''
      for (let i = 0; i < session.historyLimitEls.length; i++) {
        session.historyLimitEls[i].value = String(value)
      }
      for (let i = 0; i < session.historyFromDateEls.length; i++) {
        session.historyFromDateEls[i].value = ''
      }
      for (let i = 0; i < session.historyToDateEls.length; i++) {
        session.historyToDateEls[i].value = ''
      }
      session.applyHistoryTitle(value)
      syncHistoryRangeUi()
      session.vscode.postMessage({ type: messageType.setHistoryLimit, value: value })
    }

    function markHistoryLimitDirty() {
      session.historyLimitDirty = true
    }

    function submitHistorySample(fromValue, toValue) {
      const from = session.parseFromDate(fromValue)
      const to = session.parseFromDate(toValue)
      session.historyFromDateDirty = false
      session.historyToDateDirty = false
      session.historyFromDate = from
      session.historyToDate = from ? to : ''
      const todayIso = session.isoFromLocal(new Date())
      for (let i = 0; i < session.historyFromDateEls.length; i++) {
        session.historyFromDateEls[i].max = todayIso
        session.historyFromDateEls[i].value = from
      }
      for (let i = 0; i < session.historyToDateEls.length; i++) {
        session.historyToDateEls[i].max = todayIso
        session.historyToDateEls[i].value = session.historyToDate
      }
      const limitSource = session.historyLimitEls[0]
      const limit = limitSource
        ? session.clampHistoryLimit(limitSource.value)
        : 1000
      session.applyHistoryTitle(limit)
      syncHistoryRangeUi()
      if (!from) {
        session.vscode.postMessage({ type: messageType.setHistorySample, mode: 'lastN', limit: limit })
        return
      }
      session.vscode.postMessage({
        type: messageType.setHistorySample,
        mode: 'calendar',
        fromDate: from,
        toDate: session.historyToDate,
      })
    }

    function submitHistoryFromDate(value) {
      submitHistorySample(value, session.historyToDate)
    }

    function submitHistoryToDate(value) {
      if (!session.historyFromDate) {
        return
      }
      submitHistorySample(session.historyFromDate, value)
    }

    for (let i = 0; i < session.historyLimitEls.length; i++) {
      const inputEl = session.historyLimitEls[i]
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
    for (let i = 0; i < session.historyFromDateEls.length; i++) {
      const inputEl = session.historyFromDateEls[i]
      inputEl.addEventListener('input', function () {
        session.historyFromDateDirty = true
      })
      inputEl.addEventListener('change', function () {
        submitHistoryFromDate(inputEl.value)
      })
    }
    for (let i = 0; i < session.historyToDateEls.length; i++) {
      const inputEl = session.historyToDateEls[i]
      inputEl.addEventListener('input', function () {
        session.historyToDateDirty = true
      })
      inputEl.addEventListener('change', function () {
        submitHistoryToDate(inputEl.value)
      })
    }
    if (fromMonthSettingEl) {
      fromMonthSettingEl.addEventListener('click', function () {
        submitHistorySample(session.startOfMonthIso(), '')
      })
    }
    if (fromTodaySettingEl) {
      fromTodaySettingEl.addEventListener('click', function () {
        const today = session.isoFromLocal(new Date())
        submitHistorySample(today, today)
      })
    }
    if (fromLast7SettingEl) {
      fromLast7SettingEl.addEventListener('click', function () {
        submitHistorySample(session.daysAgoIso(6), '')
      })
    }
    if (fromLast30SettingEl) {
      fromLast30SettingEl.addEventListener('click', function () {
        submitHistorySample(session.daysAgoIso(29), '')
      })
    }
    if (session.fromBillingCycleSettingEl) {
      session.fromBillingCycleSettingEl.addEventListener('click', function () {
        if (!session.billingCycleStart) {
          return
        }
        submitHistorySample(session.billingCycleStart, '')
      })
    }
    if (clearFromDateSettingEl) {
      clearFromDateSettingEl.addEventListener('click', function () {
        submitHistorySample('', '')
      })
    }
    if (refreshQueriesEl) {
      refreshQueriesEl.addEventListener('click', function () {
        if (refreshQueriesEl.disabled) {
          return
        }
        session.vscode.postMessage({ type: messageType.refresh })
      })
    }
    session.showWarningEl.addEventListener('change', function () {
      session.vscode.postMessage({
        type: messageType.setShowSpikeWarning,
        value: session.showWarningEl.checked === true,
      })
    })
    function submitCriticalToken() {
      if (!session.criticalTokenEl || session.criticalTokenEl.disabled) {
        return
      }
      const kilo = session.snapKilo(session.criticalTokenEl.value)
      session.criticalTokenDirty = false
      session.criticalTokenEl.value = String(kilo)
      updateCriticalTokenPreview()
      session.vscode.postMessage({
        type: messageType.setCriticalTokenThreshold,
        value: session.tokensFromKilo(kilo),
      })
    }
    function submitCriticalCost() {
      if (!session.criticalCostEl || session.criticalCostEl.disabled) {
        return
      }
      const value = clampCriticalCost(session.criticalCostEl.value)
      session.criticalCostDirty = false
      session.criticalCostEl.value = String(value)
      session.vscode.postMessage({ type: messageType.setCriticalCostUsdThreshold, value: value })
    }
    if (session.showCriticalAlertEl) {
      session.showCriticalAlertEl.addEventListener('change', function () {
        syncCriticalAlertState()
        session.vscode.postMessage({
          type: messageType.setShowCriticalAlert,
          value: session.showCriticalAlertEl.checked === true,
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
      session.criticalTokenEl,
      function () {
        session.criticalTokenDirty = true
        updateCriticalTokenPreview()
      },
      submitCriticalToken,
    )
    bindCriticalNumber(
      session.criticalCostEl,
      function () {
        session.criticalCostDirty = true
      },
      submitCriticalCost,
    )
    function submitBurnWindow() {
      if (!session.burnRateWindowEl || session.burnRateWindowEl.disabled) {
        return
      }
      const value = session.clampBurnWindow(session.burnRateWindowEl.value)
      session.burnWindowDirty = false
      session.burnRateWindowEl.value = String(value)
      session.vscode.postMessage({ type: messageType.setBurnRateWindowMinutes, value: value })
    }
    function submitBurnWarningUsd() {
      if (!session.burnRateWarningUsdEl || session.burnRateWarningUsdEl.disabled) {
        return
      }
      const value = session.clampBurnUsd(session.burnRateWarningUsdEl.value, DEFAULT_BURN_WARNING_USD)
      session.burnWarningDirty = false
      session.burnRateWarningUsdEl.value = String(value)
      session.vscode.postMessage({ type: messageType.setBurnRateWarningUsd, value: value })
    }
    function submitBurnCriticalUsd() {
      if (!session.burnRateCriticalUsdEl || session.burnRateCriticalUsdEl.disabled) {
        return
      }
      const value = session.clampBurnUsd(
        session.burnRateCriticalUsdEl.value,
        DEFAULT_BURN_CRITICAL_USD,
      )
      session.burnCriticalDirty = false
      session.burnRateCriticalUsdEl.value = String(value)
      session.vscode.postMessage({ type: messageType.setBurnRateCriticalUsd, value: value })
    }
    function submitBurnMinQueries() {
      if (!session.burnRateMinQueriesEl || session.burnRateMinQueriesEl.disabled) {
        return
      }
      const value = session.clampBurnMinQueries(session.burnRateMinQueriesEl.value)
      session.burnMinQueriesDirty = false
      session.burnRateMinQueriesEl.value = String(value)
      session.vscode.postMessage({ type: messageType.setBurnRateMinQueries, value: value })
    }
    function bindBurnNumber(inputEl, markDirty, submit) {
      bindBurnNumberImpl(inputEl, markDirty, submit)
    }
    if (session.burnRateGuardEl) {
      session.burnRateGuardEl.addEventListener('change', function () {
        syncBurnRateGuardState()
        session.vscode.postMessage({
          type: messageType.setBurnRateGuard,
          value: session.burnRateGuardEl.checked === true,
        })
      })
    }
    if (session.codeLinesInsightEl) {
      session.codeLinesInsightEl.addEventListener('change', function () {
        session.vscode.postMessage({
          type: messageType.setCodeLinesInsight,
          value: session.codeLinesInsightEl.checked === true,
        })
      })
    }
    bindBurnNumber(
      session.burnRateWindowEl,
      function () {
        session.burnWindowDirty = true
      },
      submitBurnWindow,
    )
    bindBurnNumber(
      session.burnRateWarningUsdEl,
      function () {
        session.burnWarningDirty = true
      },
      submitBurnWarningUsd,
    )
    bindBurnNumber(
      session.burnRateCriticalUsdEl,
      function () {
        session.burnCriticalDirty = true
      },
      submitBurnCriticalUsd,
    )
    bindBurnNumber(
      session.burnRateMinQueriesEl,
      function () {
        session.burnMinQueriesDirty = true
      },
      submitBurnMinQueries,
    )
    if (session.burnRateWarningToastEl) {
      session.burnRateWarningToastEl.addEventListener('change', function () {
        session.vscode.postMessage({
          type: messageType.setBurnRateWarningToast,
          value: session.burnRateWarningToastEl.checked === true,
        })
      })
    }
    if (session.burnRateCriticalToastEl) {
      session.burnRateCriticalToastEl.addEventListener('change', function () {
        session.vscode.postMessage({
          type: messageType.setBurnRateCriticalToast,
          value: session.burnRateCriticalToastEl.checked === true,
        })
      })
    }
    if (session.showStatusBarEl) {
      session.showStatusBarEl.addEventListener('change', function () {
        session.syncBarEditorState()
        session.vscode.postMessage({
          type: messageType.setShowStatusBar,
          value: session.showStatusBarEl.checked === true,
        })
      })
    }
    if (session.showTodayEl) {
      session.showTodayEl.addEventListener('change', function () {
        session.vscode.postMessage({
          type: messageType.setShowToday,
          value: session.showTodayEl.checked === true,
        })
      })
    }
    if (session.minimalModeEl) {
      session.minimalModeEl.addEventListener('change', function () {
        session.syncBarEditorState()
        session.vscode.postMessage({
          type: messageType.setMinimalMode,
          value: session.minimalModeEl.checked === true,
        })
      })
    }
    if (session.recentQueryCountEl) {
      session.recentQueryCountEl.addEventListener('change', function () {
        const value = session.clampRecentQueryCount(session.recentQueryCountEl.value)
        session.recentQueryCountEl.value = String(value)
        session.renderStatusBarPreview(session.lastStatusBarPreview)
        session.vscode.postMessage({ type: messageType.setRecentQueryCount, value: value })
      })
    }
    if (session.budgetDayBasisEl) {
      session.budgetDayBasisEl.addEventListener('change', function () {
        const value =
          session.budgetDayBasisEl.value === 'calendarDays'
            ? 'calendarDays'
            : 'workingDays'
        session.budgetDayBasisEl.value = value
        session.budgetDayBasis = value
        session.vscode.postMessage({ type: messageType.setBudgetDayBasis, value: value })
      })
    }
    if (session.forecastWindowEl) {
      session.forecastWindowEl.addEventListener('change', function () {
        const value =
          session.forecastWindowEl.value === 'billingCycle'
            ? 'billingCycle'
            : 'calendarMonth'
        session.forecastWindowEl.value = value
        session.forecastWindow = value
        session.vscode.postMessage({ type: messageType.setForecastWindow, value: value })
      })
    }
    if (session.optimizeDepthSettingEl) {
      session.optimizeDepthSettingEl.addEventListener('change', function () {
        const raw = session.optimizeDepthSettingEl.value
        const value =
          raw === 'quick' || raw === 'deep' ? raw : 'balanced'
        session.optimizeDepthSettingEl.value = value
        session.optimizeDepth = value
        session.syncOptimizeDefault(value)
        session.vscode.postMessage({ type: messageType.setOptimizeDepth, value: value })
      })
    }
    if (session.languageSettingEl) {
      session.languageSettingEl.addEventListener('change', function () {
        const value = session.isSupportedLanguage(session.languageSettingEl.value)
          ? session.languageSettingEl.value
          : 'en'
        session.languageSettingEl.value = value
        session.uiLanguage = value
        session.vscode.postMessage({ type: messageType.setLanguage, value: value })
      })
    }
    function submitPollInterval() {
      if (!session.pollIntervalEl) {
        return
      }
      const value = session.clampPollInterval(session.pollIntervalEl.value)
      session.pollIntervalDirty = false
      session.pollIntervalEl.value = String(value)
      session.vscode.postMessage({ type: messageType.setPollIntervalMinutes, value: value })
    }
    if (session.pollIntervalEl) {
      session.pollIntervalEl.addEventListener('input', function () {
        session.pollIntervalDirty = true
      })
      session.pollIntervalEl.addEventListener('change', submitPollInterval)
      session.pollIntervalEl.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault()
          submitPollInterval()
          session.pollIntervalEl.blur()
        }
      })
    }
    session.okColorEl.addEventListener('input', scheduleColors)
    session.warnColorEl.addEventListener('input', scheduleColors)
    resetColorsEl.addEventListener('click', function () {
      session.okColorEl.value = DEFAULT_OK
      session.warnColorEl.value = DEFAULT_WARN
      submitColors()
    })
    settingsFormEl.addEventListener('submit', function (event) {
      event.preventDefault()
    })
    wireNumberSteppers()
  }

  return {
    render(data) {
      renderSettings(data, session)
    },
    wire,
    clampCriticalCost,
    syncHistoryRangeUi,
    updateThresholdPreview,
    updateCriticalTokenPreview,
    syncCriticalAlertState,
    syncBurnRateGuardState,
    syncNumberStepperState,
  }
}
