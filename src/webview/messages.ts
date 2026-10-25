import { parseCodexQuery } from '../openaiHistory/historyQuery'

export type WebviewDepth = 'quick' | 'balanced' | 'deep'

export type WebviewFlag =
  | 'setShowSpikeWarning'
  | 'setShowCriticalAlert'
  | 'setBurnRateGuard'
  | 'setBurnRateWarningToast'
  | 'setBurnRateCriticalToast'
  | 'setCodeLinesInsight'
  | 'setGroupQueriesByConversation'
  | 'setShowCliThreads'
  | 'setShowStatusBar'
  | 'setShowToday'
  | 'setMinimalMode'

export type CodexQuerySource = 'cursor' | 'codex-local' | 'openai-api'

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'close' }
  | { type: 'refresh' }
  | { type: 'refreshModelCatalog' }
  | { type: 'openModelSettings' }
  | { type: 'openCursorBench' }
  | { type: 'exportCsv' }
  | { type: 'openDashboard' }
  | { type: 'setQuerySource'; value: unknown }
  | { type: 'setCodexImportEnabled'; value: unknown }
  | { type: 'setCodexHome'; value: unknown }
  | { type: 'setCodexGroupByConversation'; value: unknown }
  | { type: 'codex.refresh' }
  | {
      type: 'codex.query'
      correlationId: string
      filterRevision: number
      from: string | null
      to: string | null
      accountScopeKey: string | null
      model: string | null
      status: string | null
      groupBy: 'conversation' | 'none'
      sort: 'time-desc' | 'cost-desc' | 'tokens-desc' | 'input-desc'
      costBasis: 'estimated-api' | 'reported' | 'api-equivalent'
      cursor: string | null
      limit: number
    }
  | {
      type: 'codex.expand'
      conversationId: string
      accountScopeKey: string
    }
  | { type: 'codex.details'; requestId: string }
  | {
      type: 'codex.exportCsv'
      correlationId: string
      filterRevision: number
      from: string | null
      to: string | null
      accountScopeKey: string | null
      model: string | null
      status: string | null
      sort: 'time-desc' | 'cost-desc' | 'tokens-desc' | 'input-desc'
      costBasis: 'estimated-api' | 'reported' | 'api-equivalent'
    }
  | { type: 'codex.forget' }
  | {
      type: 'codex.setRates'
      rates: {
        model: string
        inputRate: string
        cachedInputRate: string
        outputRate: string
        cacheWriteRate: string | null
        reasoningRate: string | null
      }[]
    }
  | { type: 'openai.refresh' }
  | { type: 'openai.setMode'; value: 'local' | 'web' }
  | { type: 'openai.connect'; mode: 'local' | 'web' }
  | { type: 'openai.disconnect' }
  | { type: 'openai.openAdminKeys' }
  | {
      type: 'codex.analyze'
      requestId?: string
      conversationId?: string
      depth?: WebviewDepth
    }
  | { type: 'saveLeaderboardRepos' }
  | { type: 'applyLeaderboardMyRepos' }
  | { type: 'previewLeaderboardMyRepos' }
  | { type: 'pickLeaderboardCatalog' }
  | { type: 'clearLeaderboardCatalog' }
  | { type: 'pickLeaderboardRepo' }
  | { type: 'refreshLeaderboardRepos' }
  | { type: 'saveLeaderboardMerges'; groups: unknown }
  | { type: 'saveLeaderboardTeam'; emails: string[] }
  | { type: 'loadLeaderboardAuthors'; from: string; to: string }
  | { type: 'runLeaderboardScan'; from: string; to: string; emails: string[] }
  | { type: 'addLeaderboardRepo'; path: string }
  | { type: 'removeLeaderboardRepo'; path: string }
  | { type: 'setLeaderboardRepoIncluded'; path: string; included: boolean }
  | { type: 'exportLeaderboardCsv'; emails: string[] }
  | { type: 'lockLeaderboard' }
  | { type: 'openSupportLink'; id: unknown }
  | {
      type: 'sendAuthorMessage'
      body: unknown
      email: unknown
      raw: unknown
    }
  | { type: 'setSpikeThreshold'; value: number }
  | { type: 'setCriticalTokenThreshold'; value: number }
  | { type: 'setCriticalCostUsdThreshold'; value: number }
  | { type: 'setBurnRateWindowMinutes'; value: number }
  | { type: 'setBurnRateWarningUsd'; value: unknown }
  | { type: 'setBurnRateCriticalUsd'; value: unknown }
  | { type: 'setBurnRateMinQueries'; value: number }
  | { type: 'setCodeLinesAuthors'; emails: unknown; sumMultiple: unknown }
  | { type: 'setRecentQueryCount'; value: number }
  | { type: 'setPollIntervalMinutes'; value: number }
  | { type: 'setBudgetDayBasis'; value: unknown }
  | { type: 'setForecastWindow'; value: unknown }
  | { type: 'setOptimizeDepth'; value: unknown }
  | { type: 'setLanguage'; value: unknown }
  | { type: 'setForecastSeries'; value: 'cursor' | 'other' | 'all' }
  | { type: 'runOptimize'; depth?: WebviewDepth }
  | { type: 'copyOptimizePrompt'; depth?: WebviewDepth }
  | {
      type: 'optimizeConversation'
      id: string
      timestamp?: number
      depth?: WebviewDepth
    }
  | { type: 'openConversation'; id: string }
  | { type: 'summarizeConversation'; id: string }
  | { type: 'setOkColor'; value: unknown }
  | { type: 'setWarnColor'; value: unknown }
  | { type: 'setHistoryLimit'; value: number }
  | { type: 'setHistoryFromDate'; value: unknown }
  | { type: 'setHistoryToDate'; value: unknown }
  | {
      type: 'setHistorySample'
      mode: 'lastN' | 'calendar'
      limit: unknown
      fromDate: unknown
      toDate: unknown
    }
  | { type: WebviewFlag; value: boolean }

const EMPTY_TYPES = [
  'ready',
  'close',
  'refresh',
  'refreshModelCatalog',
  'openModelSettings',
  'openCursorBench',
  'exportCsv',
  'openDashboard',
  'codex.refresh',
  'codex.forget',
  'openai.refresh',
  'openai.disconnect',
  'openai.openAdminKeys',
  'saveLeaderboardRepos',
  'applyLeaderboardMyRepos',
  'previewLeaderboardMyRepos',
  'pickLeaderboardCatalog',
  'clearLeaderboardCatalog',
  'pickLeaderboardRepo',
  'refreshLeaderboardRepos',
  'lockLeaderboard',
] as const

const FLAG_TYPES = [
  'setShowSpikeWarning',
  'setShowCriticalAlert',
  'setBurnRateGuard',
  'setBurnRateWarningToast',
  'setBurnRateCriticalToast',
  'setCodeLinesInsight',
  'setGroupQueriesByConversation',
  'setShowCliThreads',
  'setShowStatusBar',
  'setShowToday',
  'setMinimalMode',
] as const

type EmptyType = (typeof EMPTY_TYPES)[number]
type FlagType = (typeof FLAG_TYPES)[number]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function coercedNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value)
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value.trim() : ''
}

function stringListField(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    return []
  }
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string' && item.trim() !== '') {
      out.push(item.trim())
    }
  }
  return out
}

const RATE_TEXT = /^\d+(\.\d+)?$/

function parseRateText(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  if (!RATE_TEXT.test(trimmed) || trimmed.length > 16) {
    return undefined
  }
  return trimmed
}

function parseModelRates(value: unknown): {
  model: string
  inputRate: string
  cachedInputRate: string
  outputRate: string
  cacheWriteRate: string | null
  reasoningRate: string | null
}[] {
  if (!Array.isArray(value)) {
    return []
  }
  const out: {
    model: string
    inputRate: string
    cachedInputRate: string
    outputRate: string
    cacheWriteRate: string | null
    reasoningRate: string | null
  }[] = []
  for (const item of value.slice(0, 40)) {
    if (!isRecord(item) || typeof item.model !== 'string') {
      continue
    }
    const model = item.model.trim()
    if (model === '' || model.length > 80 || /[^a-zA-Z0-9._-]/.test(model)) {
      continue
    }
    const inputRate = parseRateText(item.inputRate)
    const cachedInputRate = parseRateText(item.cachedInputRate)
    const outputRate = parseRateText(item.outputRate)
    const cacheWriteRate = parseRateText(item.cacheWriteRate)
    const reasoningRate = parseRateText(item.reasoningRate)
    if (
      inputRate === undefined ||
      cachedInputRate === undefined ||
      outputRate === undefined ||
      cacheWriteRate === undefined ||
      reasoningRate === undefined
    ) {
      continue
    }
    const required = [inputRate, cachedInputRate, outputRate]
    const anyRequired = required.some((rate) => rate !== null)
    const allRequired = required.every((rate) => rate !== null)
    if (anyRequired && !allRequired) {
      continue
    }
    out.push({
      model,
      inputRate: inputRate ?? '',
      cachedInputRate: cachedInputRate ?? '',
      outputRate: outputRate ?? '',
      cacheWriteRate,
      reasoningRate,
    })
  }
  return out
}

function depthField(value: unknown): WebviewDepth | undefined {
  if (value === 'quick' || value === 'balanced' || value === 'deep') {
    return value
  }
  return undefined
}

function timestampField(value: unknown): number | undefined {
  const timestamp =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function isEmptyType(type: string): type is EmptyType {
  return (EMPTY_TYPES as readonly string[]).includes(type)
}

function isFlagType(type: string): type is FlagType {
  return (FLAG_TYPES as readonly string[]).includes(type)
}

/** Local From/To stored in globalState. Missing fields stay empty strings. */
export function readStoredDayRange(raw: unknown): { from: string; to: string } {
  if (!isRecord(raw)) {
    return { from: '', to: '' }
  }
  return {
    from: typeof raw.from === 'string' ? raw.from : '',
    to: typeof raw.to === 'string' ? raw.to : '',
  }
}

export type CodexHostMessage =
  | {
      type: 'codex.status'
      importEnabled: boolean
      rootState: string
      partial: boolean
      unrecognizedCount: number
      ignoredCount: number
      rates: {
        model: string
        inputRate: string
        cachedInputRate: string
        outputRate: string
        cacheWriteRate: string | null
        reasoningRate: string | null
      }[]
      listRates?: {
        model: string
        inputRate: string
        cachedInputRate: string
        outputRate: string
        cacheWriteRate: string | null
        reasoningRate: string | null
      }[]
      sessionCount: number
      dateSpan: string | null
      lastSyncAt: string | null
      parserVersion: string | null
      accounts: string[]
      models: string[]
      remoteWindow: boolean
      resolvedHome: string | null
      sessionsPath: string | null
      archivedSessionsPath: string | null
      pointedAtSessions: boolean
      rolloutsOnDisk: boolean
    }
  | {
      type: 'codex.result'
      correlationId: string
      filterRevision: number
      rows: unknown[]
      nextCursor: string | null
      totals: unknown
      coverage: unknown
      lastSyncAt: string | null
    }
  | {
      type: 'codex.children'
      conversationId: string
      accountScopeKey: string
      rows: unknown[]
    }
  | { type: 'codex.detail'; fields: unknown }
  | { type: 'codex.exportReady'; correlationId: string; ok: boolean }
  | {
      type: 'openai.status'
      state: 'not-connected' | 'connected'
      mode: 'local' | 'web'
      detail: string | null
      sinkPath: string | null
      hasAdminKey: boolean
      usage: {
        inputTokens: number
        outputTokens: number
        cachedTokens: number
        requests: number
        costUsd: number | null
        byModel: {
          model: string
          requests: number
          inputTokens: number
          outputTokens: number
        }[]
      } | null
    }
  | { type: 'operation.error'; correlationId?: string; message: string }

/**
 * Narrow a webview postMessage into one host command.
 * Unknown shapes are dropped. Boolean flags stay strict (`true` only).
 */
export function parseWebviewMessage(raw: unknown): WebviewMessage | undefined {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return undefined
  }
  const type = raw.type
  if (isEmptyType(type)) {
    return { type }
  }
  if (isFlagType(type)) {
    return { type, value: raw.value === true }
  }
  switch (type) {
    case 'setQuerySource':
    case 'setCodexImportEnabled':
    case 'setCodexHome':
    case 'setCodexGroupByConversation':
      return { type, value: raw.value }
    case 'codex.query': {
      const parsed = parseCodexQuery(raw)
      if ('error' in parsed) {
        return undefined
      }
      return { type: 'codex.query', ...parsed }
    }
    case 'codex.expand':
      return {
        type,
        conversationId: stringField(raw, 'conversationId'),
        accountScopeKey: stringField(raw, 'accountScopeKey'),
      }
    case 'codex.details':
      return { type, requestId: stringField(raw, 'requestId') }
    case 'codex.exportCsv': {
      const parsed = parseCodexQuery({
        ...raw,
        groupBy: 'none',
        cursor: null,
        limit: 1,
      })
      if ('error' in parsed) {
        return undefined
      }
      return {
        type: 'codex.exportCsv',
        correlationId: parsed.correlationId,
        filterRevision: parsed.filterRevision,
        from: parsed.from,
        to: parsed.to,
        accountScopeKey: parsed.accountScopeKey,
        model: parsed.model,
        status: parsed.status,
        sort: parsed.sort,
        costBasis: parsed.costBasis,
      }
    }
    case 'codex.setRates':
      return { type, rates: parseModelRates(raw.rates) }
    case 'openai.setMode':
      if (raw.value !== 'local' && raw.value !== 'web') {
        return undefined
      }
      return { type, value: raw.value }
    case 'openai.connect':
      if (raw.mode !== 'local' && raw.mode !== 'web') {
        return undefined
      }
      return { type, mode: raw.mode }
    case 'codex.analyze':
      return {
        type,
        requestId:
          typeof raw.requestId === 'string' ? raw.requestId.trim() : undefined,
        conversationId:
          typeof raw.conversationId === 'string'
            ? raw.conversationId.trim()
            : undefined,
        depth: depthField(raw.depth),
      }
    case 'saveLeaderboardMerges':
      return { type, groups: raw.groups }
    case 'saveLeaderboardTeam':
      return { type, emails: stringListField(raw, 'emails') }
    case 'loadLeaderboardAuthors':
      return {
        type,
        from: stringField(raw, 'from'),
        to: stringField(raw, 'to'),
      }
    case 'runLeaderboardScan':
      return {
        type,
        from: stringField(raw, 'from'),
        to: stringField(raw, 'to'),
        emails: stringListField(raw, 'emails'),
      }
    case 'addLeaderboardRepo':
    case 'removeLeaderboardRepo':
      return { type, path: stringField(raw, 'path') }
    case 'setLeaderboardRepoIncluded':
      return {
        type,
        path: stringField(raw, 'path'),
        included: raw.included === true,
      }
    case 'exportLeaderboardCsv':
      return { type, emails: stringListField(raw, 'emails') }
    case 'openSupportLink':
      return { type, id: raw.id }
    case 'sendAuthorMessage':
      return { type, body: raw.body, email: raw.email, raw }
    case 'setSpikeThreshold':
    case 'setCriticalTokenThreshold':
    case 'setCriticalCostUsdThreshold':
    case 'setBurnRateWindowMinutes':
    case 'setBurnRateMinQueries':
    case 'setRecentQueryCount':
    case 'setPollIntervalMinutes':
    case 'setHistoryLimit':
      return { type, value: coercedNumber(raw.value) }
    case 'setBurnRateWarningUsd':
    case 'setBurnRateCriticalUsd':
    case 'setBudgetDayBasis':
    case 'setForecastWindow':
    case 'setOptimizeDepth':
    case 'setForecastSeries':
      if (
        raw.value !== 'cursor' &&
        raw.value !== 'other' &&
        raw.value !== 'all'
      ) {
        return undefined
      }
      return { type, value: raw.value }
    case 'setLanguage':
    case 'setOkColor':
    case 'setWarnColor':
    case 'setHistoryFromDate':
    case 'setHistoryToDate':
      return { type, value: raw.value }
    case 'setCodeLinesAuthors':
      return { type, emails: raw.emails, sumMultiple: raw.sumMultiple }
    case 'runOptimize':
    case 'copyOptimizePrompt':
      return { type, depth: depthField(raw.depth) }
    case 'optimizeConversation':
      return {
        type,
        id: stringField(raw, 'id'),
        timestamp: timestampField(raw.timestamp),
        depth: depthField(raw.depth),
      }
    case 'openConversation':
    case 'summarizeConversation':
      return { type, id: stringField(raw, 'id') }
    case 'setHistorySample':
      return {
        type,
        mode: raw.mode === 'calendar' ? 'calendar' : 'lastN',
        limit: raw.limit,
        fromDate: raw.fromDate,
        toDate: raw.toDate,
      }
    default:
      return undefined
  }
}
