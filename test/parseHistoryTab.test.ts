import { describe, expect, it, vi } from 'vitest'

vi.mock('vscode', () => ({
  window: {},
  workspace: {},
  commands: {},
  env: { clipboard: {} },
  Uri: { joinPath: vi.fn(), file: vi.fn() },
  ConfigurationTarget: { Global: 1 },
}))

describe('parseHistoryTab', () => {
  it('accepts optimize, support and rejects unknown tabs', async () => {
    const { parseHistoryTab } = await import('../src/ui/historyPanel')
    expect(parseHistoryTab('optimize')).toBe('optimize')
    expect(parseHistoryTab({ tab: 'optimize' })).toBe('optimize')
    expect(parseHistoryTab('support')).toBe('support')
    expect(parseHistoryTab({ tab: 'support' })).toBe('support')
    expect(parseHistoryTab('stats')).toBe('stats')
    expect(parseHistoryTab('nope')).toBe('queries')
    expect(parseHistoryTab(null)).toBe('queries')
  })
})
