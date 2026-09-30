export type LeaderboardRepo = {
  label: string
  path: string
  linesMerged: number
}

export type LeaderboardRow = {
  email: string
  emails: string[]
  name: string
  linesMerged: number
  commits: number
  linesDeleted: number
  netLines: number
  activeDays: number
  repositories: LeaderboardRepo[]
}

export type LeaderboardChartSeries = {
  email: string
  name: string
  lines: number[]
}

export type LeaderboardChart = {
  dates: string[]
  series: LeaderboardChartSeries[]
}

export type ParsedLeaderboardCommit = {
  hash: string
  timestampMs: number
  email: string
  name: string
  insertions: number
  deletions: number
}

export type LeaderboardRepoCommits = {
  path: string
  label: string
  commits: ParsedLeaderboardCommit[]
}

export type LeaderboardScanStatus = 'idle' | 'scanning' | 'ready' | 'error'

export type LeaderboardPayload = {
  status: LeaderboardScanStatus
  from: string
  to: string
  rows: LeaderboardRow[]
  chart: LeaderboardChart | null
  reposScanned: number
  reposSkipped: number
  error: string | null
}
