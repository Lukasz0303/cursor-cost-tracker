import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vscode', () => ({
  commands: {
    getCommands: vi.fn(),
    executeCommand: vi.fn(),
  },
  env: {
    clipboard: {
      readText: vi.fn(),
      writeText: vi.fn(),
    },
  },
  window: {
    showInformationMessage: vi.fn(),
  },
}))

import { openOptimizeChat } from '../src/ui/openOptimizeChat'
import type { OpenOptimizeChatDeps } from '../src/ui/openOptimizeChat'

function mockDeps(
  commands: string[],
  overrides: Partial<OpenOptimizeChatDeps> = {},
): OpenOptimizeChatDeps & {
  writeClipboard: ReturnType<typeof vi.fn>
  executeCommand: ReturnType<typeof vi.fn>
  showInformationMessage: ReturnType<typeof vi.fn>
} {
  const writeClipboard = vi.fn(async () => undefined)
  const executeCommand = vi.fn(async () => undefined)
  const showInformationMessage = vi.fn()
  return {
    readClipboard: async () => 'previous-clip',
    writeClipboard,
    getCommands: async () => commands,
    executeCommand,
    showInformationMessage,
    delayMs: 0,
    ...overrides,
  }
}

describe('openOptimizeChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('focuses the last/selected Composer and does not open a new chat', async () => {
    const deps = mockDeps([
      'composer.openComposer',
      'composer.focusComposer',
      'composer.newAgentChat',
    ])
    await expect(openOptimizeChat('SAVE TOKENS', deps)).resolves.toBe(
      'composer',
    )
    expect(deps.executeCommand).toHaveBeenCalledWith('composer.focusComposer')
    expect(deps.executeCommand).not.toHaveBeenCalledWith('composer.openComposer')
    expect(deps.executeCommand).not.toHaveBeenCalledWith(
      'composer.newAgentChat',
    )
    expect(deps.executeCommand).toHaveBeenCalledWith(
      'editor.action.clipboardPasteAction',
    )
    expect(deps.writeClipboard).toHaveBeenCalledWith('SAVE TOKENS')
    expect(deps.writeClipboard).toHaveBeenLastCalledWith('previous-clip')
    expect(deps.showInformationMessage).not.toHaveBeenCalled()
  })

  it('uses openComposer only when focus is missing', async () => {
    const deps = mockDeps(['composer.openComposer', 'composer.newAgentChat'])
    await expect(openOptimizeChat('OPEN', deps)).resolves.toBe('composer')
    expect(deps.executeCommand).toHaveBeenCalledWith('composer.openComposer')
    expect(deps.executeCommand).not.toHaveBeenCalledWith(
      'composer.newAgentChat',
    )
  })

  it('falls back to new Agent chat when focus/open are missing', async () => {
    const deps = mockDeps(['composer.newAgentChat'])
    await expect(openOptimizeChat('NEW', deps)).resolves.toBe('composer-new')
    expect(deps.executeCommand).toHaveBeenCalledWith('composer.newAgentChat')
  })

  it('opens VS Code Chat with a partial query when Composer is missing', async () => {
    const deps = mockDeps(['workbench.action.chat.open'])
    await expect(openOptimizeChat('PROMPT', deps)).resolves.toBe('vscode-chat')
    expect(deps.executeCommand).toHaveBeenCalledWith(
      'workbench.action.chat.open',
      { query: 'PROMPT', isPartialQuery: true },
    )
  })

  it('falls back to clipboard copy when no chat command works', async () => {
    const deps = mockDeps([])
    await expect(openOptimizeChat('CLIP', deps)).resolves.toBe('clipboard')
    expect(deps.writeClipboard).toHaveBeenCalledWith('CLIP')
    expect(deps.showInformationMessage).toHaveBeenCalledWith(
      'Optimize prompt copied — paste into the last Chat and press Start.',
    )
  })

  it('falls back to clipboard when VS Code Chat open throws', async () => {
    const deps = mockDeps(['workbench.action.chat.open'], {
      executeCommand: vi.fn(async () => {
        throw new Error('chat unavailable')
      }),
    })
    await expect(openOptimizeChat('CLIP', deps)).resolves.toBe('clipboard')
    expect(deps.showInformationMessage).toHaveBeenCalled()
  })
})
