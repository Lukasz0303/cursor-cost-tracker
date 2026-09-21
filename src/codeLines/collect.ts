import { toCodeLinesSnapshot } from './aggregate'
import { readComposerLineTotals } from './readComposerHeaders'
import { collectMergedLineDays } from './runGitMerged'
import { applyRepoSplit } from './repoSplit'
import {
  parseUserAnalyticsDays,
  type DashboardDayEdited,
} from './analyticsParse'
import type { CodeLinesSnapshot } from './types'
import { codeLinesDisclaimer } from './copy'
import { catalogFor } from '../i18n'
import { DEFAULT_LOCALE, type Locale } from '../locale'
import { fetchUserAnalytics } from '../usage/api'
import type { CodeLinesAuthorChoice, StoredAuthorChoice } from './authorChoice'

export type CollectCodeLinesOptions = {
  enabled: boolean
  activeWorkspacePath: string | null
  dbPath?: string
  sinceDays?: number
  sinceMs?: number
  untilMs?: number
  locale?: Locale
  cookie?: string | null
  cursorEmail?: string | null
  savedAuthors?: StoredAuthorChoice | null
  signal?: AbortSignal
  dashboardDays?: readonly DashboardDayEdited[]
}

export type CodeLinesPayload = CodeLinesSnapshot & {
  enabled: boolean
  defaultBranch: string | null
  workspacePath: string | null
  authorFiltered: boolean
  authors: CodeLinesAuthorChoice
}

function emptyPayload(
  partial: Partial<CodeLinesPayload> & Pick<CodeLinesPayload, 'source'>,
  locale: Locale = DEFAULT_LOCALE,
): CodeLinesPayload {
  return {
    enabled: partial.enabled ?? true,
    source: partial.source,
    disclaimer: codeLinesDisclaimer(partial.source, locale),
    summary: {
      added: 0,
      ai: partial.source === 'git-only' || partial.source === 'unavailable' ? null : 0,
      removed: 0,
      onMaster: 0,
      pending: 0,
      allEdited: 0,
      dashboard: false,
      currentLabel: '',
      effectiveness: null,
      accountedRate: null,
      mergedAll: 0,
      merged: 0,
      ratio: null,
      rangeLabel: catalogFor(locale).codeLines.noData,
    },
    series: [],
    repos: [],
    defaultBranch: partial.defaultBranch ?? null,
    workspacePath: partial.workspacePath ?? null,
    authorFiltered: partial.authorFiltered ?? false,
    authors: partial.authors ?? { accounts: [], sumMultiple: false },
  }
}

export async function collectCodeLinesPayload(
  options: CollectCodeLinesOptions,
): Promise<CodeLinesPayload | null> {
  const locale = options.locale ?? DEFAULT_LOCALE
  if (!options.enabled) {
    return null
  }
  const workspacePath = options.activeWorkspacePath?.trim() || null
  if (workspacePath === null) {
    return emptyPayload(
      {
        enabled: true,
        source: 'unavailable',
        workspacePath: null,
      },
      locale,
    )
  }

  const [composers, merged] = await Promise.all([
    readComposerLineTotals({
      dbPath: options.dbPath,
    }),
    collectMergedLineDays({
      cwd: workspacePath,
      sinceDays: options.sinceDays,
      sinceMs: options.sinceMs,
      untilMs: options.untilMs,
      cursorEmail: options.cursorEmail,
      savedAuthors: options.savedAuthors,
    }),
  ])

  let dashboardDays: DashboardDayEdited[] =
    options.dashboardDays !== undefined ? [...options.dashboardDays] : []
  if (
    dashboardDays.length === 0 &&
    options.cookie &&
    options.sinceMs !== undefined &&
    options.untilMs !== undefined &&
    options.signal?.aborted !== true
  ) {
    const analytics = await fetchUserAnalytics(
      options.cookie,
      options.signal ?? new AbortController().signal,
      { startMs: options.sinceMs, endMs: options.untilMs },
    )
    if (analytics.ok) {
      dashboardDays = parseUserAnalyticsDays(analytics.raw)
    }
  }

  const hasAi = composers.some((row) => row.linesAdded > 0 || row.linesRemoved > 0)
  const source = hasAi
    ? 'headers'
    : merged.days.length > 0 || merged.pendingInsertions > 0
      ? 'git-only'
      : 'unavailable'

  const snap = toCodeLinesSnapshot({
    source,
    composers: source === 'headers' ? composers : [],
    mergedDays: merged.days,
    pendingInsertions: merged.pendingInsertions,
    locale,
    sinceMs: options.sinceMs,
    untilMs: options.untilMs,
  })
  const split = applyRepoSplit({
    snapshot: snap,
    composers: source === 'headers' ? composers : [],
    dashboardDays,
    activeWorkspacePath: workspacePath,
    otherLabel: catalogFor(locale).codeLines.otherRepos,
    bundleRoot: merged.bundleRoot,
    sinceMs: options.sinceMs,
    untilMs: options.untilMs,
  })

  return {
    ...split,
    enabled: true,
    defaultBranch: merged.branch,
    workspacePath,
    authorFiltered: merged.authorFiltered,
    authors: merged.authors,
  }
}
