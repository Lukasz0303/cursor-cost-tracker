import type { ComposerLineTotals } from './types'

type WorkspaceUri = {
  fsPath?: unknown
  path?: unknown
}

type WorkspaceIdentifier = {
  uri?: WorkspaceUri
}

type ComposerHeaderValue = {
  composerId?: unknown
  totalLinesAdded?: unknown
  totalLinesRemoved?: unknown
  filesChangedCount?: unknown
  createdAt?: unknown
  lastUpdatedAt?: unknown
  workspaceIdentifier?: WorkspaceIdentifier
}

function asFiniteInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value))
  }
  return null
}

function asPath(uri: WorkspaceUri | undefined): string | null {
  if (uri === undefined) {
    return null
  }
  if (typeof uri.fsPath === 'string' && uri.fsPath.trim() !== '') {
    return uri.fsPath
  }
  if (typeof uri.path === 'string' && uri.path.trim() !== '') {
    return uri.path
  }
  return null
}

/** Parse one `composerHeaders.value` JSON blob. Never reads chat text. */
export function parseComposerHeaderValue(
  raw: string,
  fallbackComposerId: string,
  fallbackCreatedAt: number | null = null,
  fallbackUpdatedAt: number | null = null,
): ComposerLineTotals | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null
  }
  const value = parsed as ComposerHeaderValue
  const added = asFiniteInt(value.totalLinesAdded)
  const removed = asFiniteInt(value.totalLinesRemoved)
  if (added === null && removed === null) {
    return null
  }
  const composerId =
    typeof value.composerId === 'string' && value.composerId !== ''
      ? value.composerId
      : fallbackComposerId
  const createdAt = asFiniteInt(value.createdAt) ?? fallbackCreatedAt
  const lastUpdatedAt = asFiniteInt(value.lastUpdatedAt) ?? fallbackUpdatedAt
  return {
    composerId,
    workspacePath: asPath(value.workspaceIdentifier?.uri),
    linesAdded: added ?? 0,
    linesRemoved: removed ?? 0,
    filesChanged: asFiniteInt(value.filesChangedCount) ?? 0,
    lastUpdatedAt,
    createdAt,
  }
}

export function workspacePathMatches(
  workspacePath: string | null,
  activeWorkspacePath: string,
): boolean {
  if (workspacePath === null || workspacePath === '') {
    return false
  }
  const left = workspacePath.replace(/\\/g, '/').replace(/\/+$/, '')
  const right = activeWorkspacePath.replace(/\\/g, '/').replace(/\/+$/, '')
  if (left === right) {
    return true
  }
  // Prefix match only on a path segment boundary (avoid /proj matching /proj-old).
  return (
    left.endsWith('/' + right) ||
    right.endsWith('/' + left)
  )
}

export function filterComposerTotalsForWorkspace(
  rows: readonly ComposerLineTotals[],
  activeWorkspacePath: string,
): ComposerLineTotals[] {
  return rows.filter((row) =>
    workspacePathMatches(row.workspacePath, activeWorkspacePath),
  )
}
