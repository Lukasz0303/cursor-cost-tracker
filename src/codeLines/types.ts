export type CodeLinesSource =
  | 'headers'
  | 'checkpoints'
  | 'edits'
  | 'git-only'
  | 'unavailable'

export type ComposerLineTotals = {
  composerId: string
  workspacePath: string | null
  linesAdded: number
  linesRemoved: number
  filesChanged: number
  /** ms epoch; used to bucket the conversation onto a local calendar day */
  lastUpdatedAt: number | null
  createdAt: number | null
}

export type CodeLinesSummary = {
  added: number
  /**
   * Lines edited in the sample window: composer added + removed
   * (dashboard-style; Tab completions are not in headers).
   */
  ai: number | null
  /** Composer totalLinesRemoved in the same window (churn, not git). */
  removed: number
  /**
   * Account-wide Lines Edited for the window (Cursor dashboard when
   * `dashboard` is true; otherwise the local composer sum).
   */
  allEdited: number | null
  /** True when `allEdited` came from Cursor dashboard analytics. */
  dashboard: boolean
  /** Folder name of the active workspace. */
  currentLabel: string
  /**
   * Git insertions by this user on the default branch in the same window.
   * Independent of `ai` — not AI minus pending.
   */
  onMaster: number | null
  /** Tree insertions on current branch / dirty tree not in default branch. */
  pending: number
  /** onMaster / ai — merge rate (volumes, not line identity). */
  effectiveness: number | null
  /** (onMaster + pending) / ai — merge rate plus current branch. */
  accountedRate: number | null
  /**
   * All git insertions on the default branch in the sample window
   * (same as onMaster when author filter is on; demoted in UI).
   */
  mergedAll: number
  /** @deprecated use onMaster / effectiveness — kept for older payloads */
  merged: number
  /** @deprecated use effectiveness */
  ratio: number | null
  rangeLabel: string
}

export type CodeLinesRepoShare = {
  label: string
  path: string | null
  edited: number
  current: boolean
}

export type DayLineBucket = {
  date: string
  added: number
  ai: number
  /** Author git insertions on the default branch that day. */
  onMaster: number
  merged: number
  ratio: number | null
  effectiveness: number | null
}

export type CodeLinesSnapshot = {
  source: CodeLinesSource
  disclaimer: string
  summary: CodeLinesSummary
  series: DayLineBucket[]
  repos: CodeLinesRepoShare[]
}

export type GitNumstatDay = {
  date: string
  insertions: number
  deletions: number
}
