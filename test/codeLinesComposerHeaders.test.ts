import { describe, expect, it } from 'vitest'
import {
  filterComposerTotalsForWorkspace,
  parseComposerHeaderValue,
  workspacePathMatches,
} from '../src/codeLines/composerHeaders'

describe('parseComposerHeaderValue', () => {
  it('reads totals and workspace path', () => {
    const raw = JSON.stringify({
      composerId: 'abc',
      totalLinesAdded: 120,
      totalLinesRemoved: 4,
      filesChangedCount: 3,
      lastUpdatedAt: 1_700_000_000_000,
      workspaceIdentifier: {
        uri: { fsPath: '/Users/me/proj' },
      },
    })
    const row = parseComposerHeaderValue(raw, 'fallback')
    expect(row).toEqual({
      composerId: 'abc',
      workspacePath: '/Users/me/proj',
      linesAdded: 120,
      linesRemoved: 4,
      filesChanged: 3,
      lastUpdatedAt: 1_700_000_000_000,
      createdAt: null,
    })
  })

  it('returns null when line fields are missing', () => {
    expect(parseComposerHeaderValue('{"name":"x"}', 'id')).toBeNull()
  })
})

describe('workspacePathMatches', () => {
  it('does not match a path that only shares a prefix', () => {
    expect(workspacePathMatches('/Users/me/proj', '/Users/me/proj-old')).toBe(
      false,
    )
    expect(workspacePathMatches('/Users/me/proj-old', '/Users/me/proj')).toBe(
      false,
    )
  })

  it('matches equal paths ignoring trailing slash', () => {
    expect(
      workspacePathMatches('/a/b/', '/a/b'),
    ).toBe(true)
  })

  it('filters composers to the active workspace', () => {
    const rows = filterComposerTotalsForWorkspace(
      [
        {
          composerId: '1',
          workspacePath: '/w/one',
          linesAdded: 10,
          linesRemoved: 0,
          filesChanged: 1,
          lastUpdatedAt: 1,
          createdAt: 1,
        },
        {
          composerId: '2',
          workspacePath: '/w/two',
          linesAdded: 99,
          linesRemoved: 0,
          filesChanged: 1,
          lastUpdatedAt: 1,
          createdAt: 1,
        },
      ],
      '/w/one',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.linesAdded).toBe(10)
  })
})
