import { formatCompactTokens, formatDollars } from '../format'

export const LIFETIME_SAVINGS_STATE_KEY = 'cursorCost.optimizeLifetimeSavings'

/** Cap stored growth samples so globalState stays small. */
export const LIFETIME_HISTORY_MAX = 40

export type ProjectSavings = {
  key: string
  label: string
  tokens: number
  usd: number
  lastRun: number
  lastTokensMid: number
  lastUsdMid: number
  updatedAt: number
}

export type LifetimeHistoryPoint = {
  at: number
  totalUsd: number
  totalTokens: number
}

export type LifetimeSavings = {
  version: 1
  totalTokens: number
  totalUsd: number
  projects: Record<string, ProjectSavings>
  /** Credited totals over time (one point per credit that grew the totals). */
  history: LifetimeHistoryPoint[]
}

export type OptimizeCreditInput = {
  run: number | null
  tokensMid: number | null
  usdMid: number | null
  label: string
}

export type ApplyOptimizeCreditResult = {
  state: LifetimeSavings
  changed: boolean
  creditedTokens: number
  creditedUsd: number
}

export type LifetimeProjectRow = {
  label: string
  tokens: number
  usd: number
}

export type LifetimeSeriesPoint = {
  at: number
  usd: number
  tokens: number
}

export type LifetimePayload = {
  totalTokens: number
  totalUsd: number
  summary: string
  projects: LifetimeProjectRow[]
  /** USD growth over time for the Optimize savings sparkline. */
  series: LifetimeSeriesPoint[]
  empty: boolean
}

export function emptyLifetimeSavings(): LifetimeSavings {
  return {
    version: 1,
    totalTokens: 0,
    totalUsd: 0,
    projects: {},
    history: [],
  }
}

/** Parse stored globalState value; never throws. */
export function parseLifetimeSavings(raw: unknown): LifetimeSavings {
  if (typeof raw !== 'object' || raw === null) {
    return emptyLifetimeSavings()
  }
  const record = raw as Record<string, unknown>
  if (record.version !== 1) {
    return emptyLifetimeSavings()
  }
  const projectsRaw = record.projects
  if (typeof projectsRaw !== 'object' || projectsRaw === null) {
    return emptyLifetimeSavings()
  }
  const projects: Record<string, ProjectSavings> = {}
  for (const [key, value] of Object.entries(projectsRaw)) {
    const project = parseProject(key, value)
    if (project !== null) {
      projects[key] = project
    }
  }
  let totalTokens = 0
  let totalUsd = 0
  for (const project of Object.values(projects)) {
    totalTokens += project.tokens
    totalUsd += project.usd
  }
  const history = parseHistory(record.history)
  const seeded =
    history.length > 0
      ? history
      : seedHistoryFromProjects(Object.values(projects))
  return {
    version: 1,
    totalTokens: Math.max(0, Math.round(totalTokens)),
    totalUsd: roundUsd(totalUsd),
    projects,
    history: seeded,
  }
}

/**
 * Credit mid projection growth for one project when Optimize run advances.
 * Credits max(0, newMid − lastAppliedMid) so cumulative mids are not double-counted.
 */
export function applyOptimizeCredit(
  state: LifetimeSavings,
  projectKey: string,
  credit: OptimizeCreditInput,
  nowMs: number = Date.now(),
): ApplyOptimizeCreditResult {
  const key = projectKey.trim()
  if (key === '') {
    return {
      state,
      changed: false,
      creditedTokens: 0,
      creditedUsd: 0,
    }
  }

  const tokensMid =
    credit.tokensMid !== null && Number.isFinite(credit.tokensMid)
      ? Math.max(0, Math.round(credit.tokensMid))
      : null
  const usdMid =
    credit.usdMid !== null && Number.isFinite(credit.usdMid)
      ? roundUsd(Math.max(0, credit.usdMid))
      : null
  if (tokensMid === null && usdMid === null) {
    return {
      state,
      changed: false,
      creditedTokens: 0,
      creditedUsd: 0,
    }
  }

  const run =
    credit.run !== null && Number.isFinite(credit.run) && credit.run >= 1
      ? Math.round(credit.run)
      : null

  const existing = state.projects[key]
  const lastRun = existing?.lastRun ?? 0
  if (run !== null && run <= lastRun) {
    return {
      state,
      changed: false,
      creditedTokens: 0,
      creditedUsd: 0,
    }
  }
  // Without run, only credit once (first write) for this project.
  if (run === null && existing !== undefined) {
    return {
      state,
      changed: false,
      creditedTokens: 0,
      creditedUsd: 0,
    }
  }

  const lastTokens = existing?.lastTokensMid ?? 0
  const lastUsd = existing?.lastUsdMid ?? 0
  const creditedTokens =
    tokensMid !== null ? Math.max(0, tokensMid - lastTokens) : 0
  const creditedUsd = usdMid !== null ? Math.max(0, roundUsd(usdMid - lastUsd)) : 0

  if (creditedTokens === 0 && creditedUsd === 0 && existing !== undefined) {
    // Mid did not grow; still advance lastRun / lastMid so we do not retry.
    const label = normalizeLabel(credit.label, existing.label, key)
    const advanced: ProjectSavings = {
      ...existing,
      label,
      lastRun: run ?? existing.lastRun,
      lastTokensMid: tokensMid ?? existing.lastTokensMid,
      lastUsdMid: usdMid ?? existing.lastUsdMid,
      updatedAt: nowMs,
    }
    const projects = { ...state.projects, [key]: advanced }
    return {
      state: {
        version: 1,
        totalTokens: state.totalTokens,
        totalUsd: state.totalUsd,
        projects,
        history: state.history ?? [],
      },
      changed: true,
      creditedTokens: 0,
      creditedUsd: 0,
    }
  }

  const label = normalizeLabel(credit.label, existing?.label ?? '', key)
  const nextProject: ProjectSavings = {
    key,
    label,
    tokens: (existing?.tokens ?? 0) + creditedTokens,
    usd: roundUsd((existing?.usd ?? 0) + creditedUsd),
    lastRun: run ?? 1,
    lastTokensMid: tokensMid ?? lastTokens,
    lastUsdMid: usdMid ?? lastUsd,
    updatedAt: nowMs,
  }

  const projects = { ...state.projects, [key]: nextProject }
  let totalTokens = 0
  let totalUsd = 0
  for (const project of Object.values(projects)) {
    totalTokens += project.tokens
    totalUsd += project.usd
  }
  const nextTotals = {
    totalTokens: Math.max(0, Math.round(totalTokens)),
    totalUsd: roundUsd(totalUsd),
  }
  const history =
    creditedTokens > 0 || creditedUsd > 0
      ? appendHistory(state.history ?? [], {
          at: nowMs,
          totalUsd: nextTotals.totalUsd,
          totalTokens: nextTotals.totalTokens,
        })
      : state.history ?? []

  return {
    state: {
      version: 1,
      ...nextTotals,
      projects,
      history,
    },
    changed: true,
    creditedTokens,
    creditedUsd,
  }
}

export function toLifetimePayload(state: LifetimeSavings): LifetimePayload {
  const projects = Object.values(state.projects)
    .map((p) => ({
      label: p.label,
      tokens: p.tokens,
      usd: p.usd,
    }))
    .sort((a, b) => b.tokens - a.tokens || a.label.localeCompare(b.label))

  const empty = projects.length === 0
  const summaryParts: string[] = [
    `~${formatCompactTokens(state.totalTokens)}`,
    `~${formatDollars(state.totalUsd)}`,
  ]

  return {
    totalTokens: state.totalTokens,
    totalUsd: state.totalUsd,
    summary: `Saved so far: ${summaryParts.join(' · ')}`,
    projects,
    series: seriesForSparkline(state),
    empty,
  }
}

function seriesForSparkline(state: LifetimeSavings): LifetimeSeriesPoint[] {
  let points = Array.isArray(state.history) ? state.history.slice() : []
  if (points.length === 0 && (state.totalUsd > 0 || state.totalTokens > 0)) {
    points = [
      {
        at: Date.now(),
        totalUsd: state.totalUsd,
        totalTokens: state.totalTokens,
      },
    ]
  }
  if (points.length === 1) {
    const only = points[0]!
    points = [
      {
        at: Math.max(0, only.at - 86_400_000),
        totalUsd: 0,
        totalTokens: 0,
      },
      only,
    ]
  }
  return points.map((p) => ({
    at: p.at,
    usd: p.totalUsd,
    tokens: p.totalTokens,
  }))
}

function appendHistory(
  history: LifetimeHistoryPoint[],
  point: LifetimeHistoryPoint,
): LifetimeHistoryPoint[] {
  const next = history.concat([point])
  if (next.length <= LIFETIME_HISTORY_MAX) {
    return next
  }
  return next.slice(next.length - LIFETIME_HISTORY_MAX)
}

function parseHistory(raw: unknown): LifetimeHistoryPoint[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: LifetimeHistoryPoint[] = []
  for (const row of raw) {
    if (typeof row !== 'object' || row === null) {
      continue
    }
    const rec = row as Record<string, unknown>
    const at = asNonNegInt(rec.at)
    const totalUsd = asNonNegUsd(rec.totalUsd)
    const totalTokens = asNonNegInt(rec.totalTokens)
    if (at === null || totalUsd === null || totalTokens === null) {
      continue
    }
    out.push({ at, totalUsd, totalTokens })
  }
  return out.slice(-LIFETIME_HISTORY_MAX)
}

/** Approximate growth curve from project last-update order (legacy installs). */
function seedHistoryFromProjects(
  projects: ProjectSavings[],
): LifetimeHistoryPoint[] {
  if (projects.length === 0) {
    return []
  }
  const ordered = projects.slice().sort((a, b) => a.updatedAt - b.updatedAt)
  let totalUsd = 0
  let totalTokens = 0
  const out: LifetimeHistoryPoint[] = []
  for (const project of ordered) {
    totalUsd = roundUsd(totalUsd + project.usd)
    totalTokens += project.tokens
    out.push({
      at: project.updatedAt > 0 ? project.updatedAt : Date.now(),
      totalUsd,
      totalTokens: Math.max(0, Math.round(totalTokens)),
    })
  }
  return out.slice(-LIFETIME_HISTORY_MAX)
}

function parseProject(key: string, value: unknown): ProjectSavings | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const row = value as Record<string, unknown>
  const label =
    typeof row.label === 'string' && row.label.trim() !== ''
      ? row.label.trim()
      : basenameLabel(key)
  const tokens = asNonNegInt(row.tokens) ?? 0
  const usd = asNonNegUsd(row.usd) ?? 0
  const lastRun = asNonNegInt(row.lastRun) ?? 0
  const lastTokensMid = asNonNegInt(row.lastTokensMid) ?? 0
  const lastUsdMid = asNonNegUsd(row.lastUsdMid) ?? 0
  const updatedAt = asNonNegInt(row.updatedAt) ?? 0
  return {
    key,
    label,
    tokens,
    usd,
    lastRun,
    lastTokensMid,
    lastUsdMid,
    updatedAt,
  }
}

function normalizeLabel(
  creditLabel: string,
  existingLabel: string,
  key: string,
): string {
  const fromCredit = creditLabel.trim()
  if (fromCredit !== '') {
    return fromCredit
  }
  if (existingLabel.trim() !== '') {
    return existingLabel.trim()
  }
  return basenameLabel(key)
}

export function basenameLabel(fsPath: string): string {
  const normalized = fsPath.replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = normalized.split('/')
  const last = parts[parts.length - 1]
  return last && last.trim() !== '' ? last.trim() : fsPath
}

function asNonNegInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return Math.max(0, Math.round(value))
}

function asNonNegUsd(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return roundUsd(Math.max(0, value))
}

function roundUsd(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100
}
