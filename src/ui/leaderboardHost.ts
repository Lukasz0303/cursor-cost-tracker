import { homedir } from 'node:os'
import * as vscode from 'vscode'
import { readCursorCostConfig } from '../config'
import { catalogFor } from '../i18n'
import { aggregateLeaderboard, leaderboardDailyChart } from '../leaderboard/aggregate'
import { isValidLeaderboardRange } from '../leaderboard/dates'
import {
  listCatalogGitRepos,
  listLeaderboardAuthors,
  previewLeaderboardRepos,
  scanLeaderboardRepos,
} from '../leaderboard/scan'
import { normalizeLeaderboardMerges } from '../leaderboard/merges'
import {
  appendSavedRepos,
  parseLeaderboardSources,
  setRepoIncluded,
  withExtraPath,
  withoutExtraPath,
  type LeaderboardSources,
} from '../leaderboard/sources'
import { normalizeTeamEmails } from '../leaderboard/team'
import type { LeaderboardPayload, LeaderboardRow } from '../leaderboard/types'
import { readStoredDayRange, type WebviewMessage } from '../webview/messages'
import { buildLeaderboardCsv } from './exportCsv'

const RANGE_KEY = 'cursorCost.leaderboardRange'
const SOURCES_KEY = 'cursorCost.leaderboardSources'
const MY_REPOS_KEY = 'cursorCost.leaderboardMyRepos'
const TEAM_KEY = 'cursorCost.leaderboardTeam'
const MERGES_KEY = 'cursorCost.leaderboardMerges'

type LeaderboardCopy = ReturnType<typeof catalogFor>['leaderboard']

export type LeaderboardHostDeps = {
  globalState: vscode.Memento
  post: (message: object) => void
  workspaceRoot: () => string | null
}

const LEADERBOARD_TYPES = [
  'saveLeaderboardRepos',
  'applyLeaderboardMyRepos',
  'previewLeaderboardMyRepos',
  'pickLeaderboardCatalog',
  'clearLeaderboardCatalog',
  'pickLeaderboardRepo',
  'refreshLeaderboardRepos',
  'saveLeaderboardMerges',
  'saveLeaderboardTeam',
  'loadLeaderboardAuthors',
  'runLeaderboardScan',
  'addLeaderboardRepo',
  'removeLeaderboardRepo',
  'setLeaderboardRepoIncluded',
  'exportLeaderboardCsv',
] as const

type LeaderboardMessage = Extract<
  WebviewMessage,
  { type: (typeof LEADERBOARD_TYPES)[number] }
>

export function isLeaderboardMessage(
  message: WebviewMessage,
): message is LeaderboardMessage {
  return (LEADERBOARD_TYPES as readonly string[]).includes(message.type)
}

function orderLeaderboardRows(
  rows: readonly LeaderboardRow[],
  order: readonly string[],
): LeaderboardRow[] {
  if (order.length === 0) {
    return [...rows]
  }
  const byEmail = new Map(rows.map((row) => [row.email.toLowerCase(), row]))
  const used = new Set<string>()
  const sorted: LeaderboardRow[] = []
  for (const email of order) {
    const row = byEmail.get(email.toLowerCase())
    if (row === undefined || used.has(row.email.toLowerCase())) {
      continue
    }
    used.add(row.email.toLowerCase())
    sorted.push(row)
  }
  for (const row of rows) {
    if (!used.has(row.email.toLowerCase())) {
      sorted.push(row)
    }
  }
  return sorted
}

async function writeLeaderboardCsvFile(
  rows: readonly LeaderboardRow[],
  from: string,
  to: string,
): Promise<void> {
  if (rows.length === 0) {
    return
  }
  const csv = buildLeaderboardCsv(rows)
  const fileName =
    from !== '' && to !== ''
      ? `leaderboard-${from}-to-${to}.csv`
      : 'leaderboard.csv'
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.joinPath(vscode.Uri.file(homedir()), fileName),
    filters: { CSV: ['csv'] },
    saveLabel: catalogFor(
      readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost'))
        .language,
    ).alerts.export,
  })
  if (!uri) {
    return
  }
  await vscode.workspace.fs.writeFile(uri, Buffer.from(csv, 'utf8'))
}

/** Leaderboard tab: repo list, scan, and CSV. The panel only forwards messages. */
export class LeaderboardHost {
  private seq = 0
  private rows: LeaderboardRow[] = []
  private exportFrom = ''
  private exportTo = ''

  constructor(private readonly deps: LeaderboardHostDeps) {}

  /** Range, team, merges, and repo list after the webview is ready or just unlocked. */
  publishChrome(): void {
    this.postRange()
    this.postTeam(null, true)
    this.postMerges()
    void this.postRepos()
  }

  handle(message: LeaderboardMessage): void {
    switch (message.type) {
      case 'saveLeaderboardMerges':
        void this.saveMerges(message.groups)
        return
      case 'saveLeaderboardTeam':
        void this.saveTeam(message.emails)
        return
      case 'loadLeaderboardAuthors':
        void this.loadAuthors(message.from, message.to)
        return
      case 'runLeaderboardScan':
        void this.runScan(message.from, message.to, message.emails)
        return
      case 'refreshLeaderboardRepos':
        void this.mergeCatalogRepos(this.readSources().catalog)
        return
      case 'saveLeaderboardRepos':
        void this.saveRepos()
        return
      case 'applyLeaderboardMyRepos':
        void this.applyMyRepos()
        return
      case 'previewLeaderboardMyRepos':
        void this.previewMyRepos()
        return
      case 'pickLeaderboardCatalog':
        void this.pickCatalog()
        return
      case 'clearLeaderboardCatalog': {
        const sources = this.readSources()
        void this.writeSources({ ...sources, catalog: '' })
        return
      }
      case 'addLeaderboardRepo':
        void this.addRepo(message.path)
        return
      case 'pickLeaderboardRepo':
        void this.pickRepo()
        return
      case 'setLeaderboardRepoIncluded':
        void this.writeSources(
          setRepoIncluded(this.readSources(), message.path, message.included),
        )
        return
      case 'removeLeaderboardRepo':
        void this.writeSources(withoutExtraPath(this.readSources(), message.path))
        return
      case 'exportLeaderboardCsv':
        void this.exportCsv(message.emails)
        return
      default:
        return
    }
  }

  exportCsv(order: readonly string[] = []): Promise<void> {
    if (this.rows.length === 0) {
      return Promise.resolve()
    }
    return writeLeaderboardCsvFile(
      orderLeaderboardRows(this.rows, order),
      this.exportFrom,
      this.exportTo,
    )
  }

  private copy(): LeaderboardCopy {
    return catalogFor(
      readCursorCostConfig(vscode.workspace.getConfiguration('cursorCost')).language,
    ).leaderboard
  }

  private postRange(): void {
    const range = readStoredDayRange(this.deps.globalState.get(RANGE_KEY))
    this.deps.post({ type: 'leaderboardRange', from: range.from, to: range.to })
  }

  private readTeam(): string[] {
    return normalizeTeamEmails(this.deps.globalState.get(TEAM_KEY))
  }

  private postTeam(status: string | null = null, apply = false): void {
    this.deps.post({
      type: 'leaderboardTeam',
      emails: this.readTeam(),
      status,
      apply,
    })
  }

  private async saveTeam(emails: string[]): Promise<void> {
    const clean = normalizeTeamEmails(emails)
    const copy = this.copy()
    if (clean.length === 0) {
      this.postTeam(copy.teamNeedSelection)
      return
    }
    await this.deps.globalState.update(TEAM_KEY, clean)
    this.postTeam(copy.teamSaved.replace('{n}', String(clean.length)))
  }

  private readMerges(): string[][] {
    return normalizeLeaderboardMerges(this.deps.globalState.get(MERGES_KEY))
  }

  private postMerges(): void {
    this.deps.post({ type: 'leaderboardMerges', groups: this.readMerges() })
  }

  private async saveMerges(groups: unknown): Promise<void> {
    await this.deps.globalState.update(MERGES_KEY, normalizeLeaderboardMerges(groups))
    this.postMerges()
  }

  private readSources(): LeaderboardSources {
    return parseLeaderboardSources(this.deps.globalState.get(SOURCES_KEY))
  }

  private async writeSources(
    sources: LeaderboardSources,
    status: string | null = null,
  ): Promise<void> {
    await this.deps.globalState.update(SOURCES_KEY, sources)
    await this.postRepos(status)
  }

  private async saveRepos(): Promise<void> {
    let sources = this.readSources()
    if (
      sources.saved.length === 0 &&
      sources.extra.length === 0 &&
      sources.catalog.trim() !== ''
    ) {
      const found = await listCatalogGitRepos(sources.catalog)
      sources = appendSavedRepos(sources, found).sources
    }
    await this.deps.globalState.update(MY_REPOS_KEY, sources.excluded)
    await this.writeSources(sources, this.copy().savedList)
  }

  private myReposExcluded(): string[] | null {
    const raw = this.deps.globalState.get(MY_REPOS_KEY)
    if (!Array.isArray(raw)) {
      return null
    }
    return raw.filter((item): item is string => typeof item === 'string')
  }

  private async previewMyRepos(): Promise<void> {
    const excluded = this.myReposExcluded()
    const copy = this.copy()
    if (excluded === null) {
      this.deps.post({
        type: 'leaderboardMyReposPreview',
        repos: [],
        error: copy.myReposEmpty,
      })
      return
    }
    const sources = { ...this.readSources(), excluded }
    const preview = await previewLeaderboardRepos(this.deps.workspaceRoot(), sources)
    this.deps.post({
      type: 'leaderboardMyReposPreview',
      repos: preview.repos
        .filter((repo) => repo.included)
        .map((repo) => ({ label: repo.label, path: repo.path })),
      error: null,
    })
  }

  private async applyMyRepos(): Promise<void> {
    const excluded = this.myReposExcluded()
    const copy = this.copy()
    if (excluded === null) {
      await this.postRepos(copy.myReposEmpty)
      return
    }
    const sources = this.readSources()
    await this.writeSources({ ...sources, excluded }, copy.myReposApplied)
  }

  private async mergeCatalogRepos(catalog: string): Promise<void> {
    const trimmed = catalog.trim()
    if (trimmed === '') {
      await this.postRepos()
      return
    }
    let sources = this.readSources()
    if (
      sources.saved.length === 0 &&
      sources.extra.length === 0 &&
      sources.catalog.trim() !== '' &&
      sources.catalog.trim() !== trimmed
    ) {
      const previous = await listCatalogGitRepos(sources.catalog)
      sources = appendSavedRepos(sources, previous).sources
    }
    const found = await listCatalogGitRepos(trimmed)
    const merged = appendSavedRepos({ ...sources, catalog: trimmed }, found)
    const copy = this.copy()
    const status =
      merged.skipped > 0
        ? copy.scanAdded
            .replace('{added}', String(merged.added))
            .replace('{skipped}', String(merged.skipped))
        : null
    await this.writeSources(merged.sources, status)
  }

  private async postRepos(error: string | null = null): Promise<void> {
    const sources = this.readSources()
    const preview = await previewLeaderboardRepos(this.deps.workspaceRoot(), sources)
    this.deps.post({
      type: 'leaderboardRepos',
      catalog: sources.catalog,
      catalogMissing: preview.catalogMissing,
      repos: preview.repos,
      error,
    })
  }

  private async pickFolder(openLabel: string, start: string): Promise<string | null> {
    const root = this.deps.workspaceRoot()
    const defaultUri =
      start.trim() !== ''
        ? vscode.Uri.file(start)
        : root !== null
          ? vscode.Uri.file(root)
          : undefined
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel,
      defaultUri,
    })
    return picked?.[0]?.fsPath ?? null
  }

  private async pickCatalog(): Promise<void> {
    const copy = this.copy()
    const sources = this.readSources()
    const path = await this.pickFolder(copy.browse, sources.catalog)
    if (path === null) {
      return
    }
    await this.mergeCatalogRepos(path)
  }

  private async addRepo(path: string): Promise<void> {
    const copy = this.copy()
    const trimmed = path.trim()
    if (trimmed === '') {
      return
    }
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(trimmed))
      if (stat.type !== vscode.FileType.Directory) {
        await this.postRepos(copy.invalidRepo)
        return
      }
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(vscode.Uri.file(trimmed), '.git'))
    } catch {
      await this.postRepos(copy.invalidRepo)
      return
    }
    const sources = this.readSources()
    const next = withExtraPath(sources, trimmed)
    if (next === sources) {
      await this.postRepos(copy.duplicateRepo)
      return
    }
    await this.writeSources(next)
  }

  private async pickRepo(): Promise<void> {
    const copy = this.copy()
    const path = await this.pickFolder(copy.addRepo, '')
    if (path === null) {
      return
    }
    await this.addRepo(path)
  }

  private async rememberRange(from: string, to: string): Promise<void> {
    await this.deps.globalState.update(RANGE_KEY, { from, to })
  }

  private async loadAuthors(from: string, to: string): Promise<void> {
    const copy = this.copy()
    const sources = this.readSources()
    const root = this.deps.workspaceRoot() ?? (sources.catalog.trim() || null)
    if (root === null && sources.extra.length === 0) {
      this.deps.post({
        type: 'leaderboardAuthors',
        from,
        to,
        authors: [],
        error: copy.noWorkspace,
      })
      return
    }
    if (!isValidLeaderboardRange(from, to)) {
      this.deps.post({
        type: 'leaderboardAuthors',
        from,
        to,
        authors: [],
        error: copy.badRange,
      })
      return
    }
    await this.rememberRange(from, to)
    const seq = ++this.seq
    try {
      const authors = await listLeaderboardAuthors(
        root ?? sources.extra[0] ?? '',
        from,
        to,
        { sources },
      )
      if (seq !== this.seq) {
        return
      }
      this.deps.post({
        type: 'leaderboardAuthors',
        from,
        to,
        authors,
        error: null,
      })
    } catch {
      if (seq !== this.seq) {
        return
      }
      this.deps.post({
        type: 'leaderboardAuthors',
        from,
        to,
        authors: [],
        error: copy.error,
      })
    }
  }

  private async runScan(from: string, to: string, emails: string[]): Promise<void> {
    const copy = this.copy()
    const sources = this.readSources()
    const root =
      this.deps.workspaceRoot() ?? (sources.catalog.trim() || sources.extra[0] || null)
    const empty: LeaderboardPayload = {
      status: 'error',
      from,
      to,
      rows: [],
      chart: null,
      reposScanned: 0,
      reposSkipped: 0,
      error: copy.badRange,
    }
    if (root === null) {
      empty.error = copy.noWorkspace
      this.postResult(empty)
      return
    }
    if (!isValidLeaderboardRange(from, to) || emails.length === 0) {
      this.postResult(empty)
      return
    }
    await this.rememberRange(from, to)
    const seq = ++this.seq
    this.rows = []
    this.postResult({
      status: 'scanning',
      from,
      to,
      rows: [],
      chart: null,
      reposScanned: 0,
      reposSkipped: 0,
      error: null,
    })
    try {
      const piece = await scanLeaderboardRepos(root, from, to, {
        authorEmails: emails,
        sources,
      })
      if (seq !== this.seq) {
        return
      }
      const merges = this.readMerges()
      const rows = aggregateLeaderboard(piece.groups, emails, merges)
      const chart = leaderboardDailyChart(piece.groups, emails, merges, from, to)
      this.rows = rows
      this.exportFrom = from
      this.exportTo = to
      this.postResult({
        status: 'ready',
        from,
        to,
        rows,
        chart,
        reposScanned: piece.reposScanned,
        reposSkipped: piece.reposSkipped,
        error: null,
      })
    } catch {
      if (seq !== this.seq) {
        return
      }
      this.postResult({
        status: 'error',
        from,
        to,
        rows: [],
        chart: null,
        reposScanned: 0,
        reposSkipped: 0,
        error: copy.error,
      })
    }
  }

  private postResult(payload: LeaderboardPayload): void {
    this.deps.post({ type: 'leaderboard', leaderboard: payload })
  }
}
