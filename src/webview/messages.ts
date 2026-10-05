export type WebviewDepth = 'quick' | 'balanced' | 'deep'

export type WebviewFlag =
  | 'setShowSpikeWarning'
  | 'setShowCriticalAlert'
  | 'setBurnRateGuard'
  | 'setBurnRateWarningToast'
  | 'setBurnRateCriticalToast'
  | 'setCodeLinesInsight'
  | 'setGroupQueriesByConversation'
  | 'setShowStatusBar'
  | 'setShowToday'
  | 'setMinimalMode'

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'close' }
  | { type: 'refresh' }
  | { type: 'refreshModelCatalog' }
  | { type: 'openModelSettings' }
  | { type: 'openCursorBench' }
  | { type: 'exportCsv' }
  | { type: 'openDashboard' }
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
  | { type: 'runOptimize'; depth?: WebviewDepth }
  | { type: 'copyOptimizePrompt'; depth?: WebviewDepth }
  | {
      type: 'optimizeConversation'
      id: string
      timestamp?: number
      depth?: WebviewDepth
    }
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
