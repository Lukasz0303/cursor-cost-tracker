import { buildDaySeries, composersInWindow } from './aggregate'
import { lineVolumeRates } from './effectiveness'
import type {
  CodeLinesRepoShare,
  CodeLinesSnapshot,
  ComposerLineTotals,
} from './types'
import {
  sumDashboardEdited,
  type DashboardDayEdited,
} from './analyticsParse'
import { localDayKey } from './gitMerged'
import { pathInsideBundle } from './nestedRepos'

export type RepoWeight = {
  id: string
  label: string
  weight: number
}

export function repoIdFromPath(path: string | null): string {
  if (path === null || path.trim() === '') {
    return ''
  }
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function repoLabelFromPath(
  path: string | null,
  otherLabel: string,
): string {
  const id = repoIdFromPath(path)
  if (id === '') {
    return otherLabel
  }
  let normalized = id
  if (/^file:/i.test(normalized)) {
    normalized = normalized.replace(/^file:\/\//i, '')
    try {
      normalized = decodeURIComponent(normalized)
    } catch {
      // keep the stripped URI path
    }
  }
  const parts = normalized.split('/').filter((part) => part !== '')
  return parts[parts.length - 1] || otherLabel
}

/**
 * Same git repo cloned to different folders (task worktrees) shares a
 * folder name. Group by that name so clones are one project row.
 */
export function repoGroupKeyFromPath(
  path: string | null,
  otherLabel: string,
  bundleRoot: string | null = null,
): string {
  if (pathInsideBundle(path, bundleRoot)) {
    return repoLabelFromPath(bundleRoot, otherLabel).trim().toLowerCase()
  }
  if (repoIdFromPath(path) === '') {
    return ''
  }
  return repoLabelFromPath(path, otherLabel).trim().toLowerCase()
}

export function weightsByRepo(
  composers: readonly ComposerLineTotals[],
  otherLabel: string,
  bundleRoot: string | null = null,
): RepoWeight[] {
  const byId = new Map<string, RepoWeight>()
  for (const row of composers) {
    const id = repoGroupKeyFromPath(row.workspacePath, otherLabel, bundleRoot)
    const weight = row.linesAdded + row.linesRemoved
    const prev = byId.get(id)
    if (prev) {
      prev.weight += weight
      continue
    }
    const label =
      id === ''
        ? otherLabel
        : pathInsideBundle(row.workspacePath, bundleRoot)
          ? repoLabelFromPath(bundleRoot, otherLabel)
          : repoLabelFromPath(row.workspacePath, otherLabel)
    byId.set(id, {
      id,
      label,
      weight,
    })
  }
  return [...byId.values()]
}

/** Largest-remainder so allocated integers sum to `total`. */
export function allocateByWeight(
  total: number,
  rows: readonly RepoWeight[],
): { id: string; label: string; edited: number }[] {
  const safeTotal = Math.max(0, Math.trunc(total))
  if (rows.length === 0) {
    return [{ id: '', label: '', edited: safeTotal }]
  }
  const weightSum = rows.reduce(
    (sum, row) => sum + Math.max(0, row.weight),
    0,
  )
  if (weightSum <= 0) {
    return rows.map((row, index) => ({
      id: row.id,
      label: row.label,
      edited: index === 0 ? safeTotal : 0,
    }))
  }
  const parts = rows.map((row) => {
    const share = (Math.max(0, row.weight) / weightSum) * safeTotal
    const floor = Math.floor(share)
    return {
      id: row.id,
      label: row.label,
      edited: floor,
      remainder: share - floor,
    }
  })
  let leftover = safeTotal - parts.reduce((sum, row) => sum + row.edited, 0)
  const order = [...parts.keys()].sort(
    (left, right) =>
      (parts[right]?.remainder ?? 0) - (parts[left]?.remainder ?? 0),
  )
  for (const index of order) {
    if (leftover <= 0) {
      break
    }
    const row = parts[index]
    if (row === undefined) {
      continue
    }
    row.edited += 1
    leftover -= 1
  }
  return parts.map(({ id, label, edited }) => ({ id, label, edited }))
}

function isCurrentRepo(
  id: string,
  activeWorkspacePath: string | null,
  otherLabel: string,
  bundleRoot: string | null,
): boolean {
  if (activeWorkspacePath === null || activeWorkspacePath.trim() === '') {
    return false
  }
  if (id === '') {
    return false
  }
  return (
    repoGroupKeyFromPath(
      activeWorkspacePath,
      otherLabel,
      bundleRoot,
    ) === id
  )
}

function dashboardDaysInWindow(
  days: readonly DashboardDayEdited[],
  sinceMs?: number,
  untilMs?: number,
): DashboardDayEdited[] {
  if (sinceMs === undefined && untilMs === undefined) {
    return [...days]
  }
  const startDay = sinceMs === undefined ? null : localDayKey(sinceMs)
  const endDay = untilMs === undefined ? null : localDayKey(untilMs)
  return days.filter((day) => {
    if (day.date === '') {
      return true
    }
    if (startDay !== null && day.date < startDay) {
      return false
    }
    if (endDay !== null && day.date > endDay) {
      return false
    }
    return true
  })
}

export function applyRepoSplit(input: {
  snapshot: CodeLinesSnapshot
  composers: readonly ComposerLineTotals[]
  dashboardDays: readonly DashboardDayEdited[]
  activeWorkspacePath: string | null
  otherLabel: string
  bundleRoot?: string | null
  sinceMs?: number
  untilMs?: number
}): CodeLinesSnapshot {
  const windowed = composersInWindow(
    input.composers,
    input.sinceMs,
    input.untilMs,
  )
  const dashDays = dashboardDaysInWindow(
    input.dashboardDays,
    input.sinceMs,
    input.untilMs,
  )
  const dashboardTotal = sumDashboardEdited(dashDays)
  const useDashboard = dashboardTotal > 0
  const localEdited =
    typeof input.snapshot.summary.ai === 'number' &&
    Number.isFinite(input.snapshot.summary.ai)
      ? Math.max(0, Math.trunc(input.snapshot.summary.ai))
      : 0
  const total = useDashboard ? dashboardTotal : localEdited
  const bundleRoot = input.bundleRoot ?? null
  const weights = weightsByRepo(windowed, input.otherLabel, bundleRoot)
  const allocated = allocateByWeight(total, weights).map((row) => {
    const current = isCurrentRepo(
      row.id,
      input.activeWorkspacePath,
      input.otherLabel,
      bundleRoot,
    )
    const label =
      row.label === '' || (row.id === '' && row.label === '')
        ? input.otherLabel
        : current
          ? repoLabelFromPath(input.activeWorkspacePath, input.otherLabel)
          : row.label
    return {
      path: row.id === '' ? null : row.id,
      label,
      edited: row.edited,
      current,
    } satisfies CodeLinesRepoShare
  })
  allocated.sort((left, right) => {
    if (left.current !== right.current) {
      return left.current ? -1 : 1
    }
    return right.edited - left.edited
  })
  const current = allocated.find((row) => row.current)
  const currentEdited = current?.edited ?? 0
  const currentLabel = current?.label ?? repoLabelFromPath(
    input.activeWorkspacePath,
    input.otherLabel,
  )
  const rates = lineVolumeRates(
    current !== undefined ? currentEdited : null,
    input.snapshot.summary.onMaster ?? 0,
    input.snapshot.summary.pending,
  )
  let series = input.snapshot.series
  if (useDashboard) {
    const byDay = new Map<string, number>()
    for (const day of dashDays) {
      if (day.date === '') {
        continue
      }
      byDay.set(day.date, (byDay.get(day.date) ?? 0) + day.edited)
    }
    const landed = new Map<string, number>()
    for (const point of input.snapshot.series) {
      landed.set(point.date, point.onMaster)
    }
    series = buildDaySeries(byDay, landed)
  }

  return {
    ...input.snapshot,
    summary: {
      ...input.snapshot.summary,
      ai: rates.ai,
      allEdited: total,
      dashboard: useDashboard,
      currentLabel,
      effectiveness: rates.mergeRate,
      accountedRate: rates.accountedRate,
      ratio: rates.mergeRate,
    },
    series,
    repos: allocated,
  }
}
