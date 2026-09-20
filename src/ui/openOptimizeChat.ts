import * as vscode from 'vscode'
import { catalogFor } from '../i18n'
import { DEFAULT_LOCALE, type Locale } from '../locale'

/** Focus the last/selected Agent chat input — prefer over opening a new chat. */
const COMPOSER_FOCUS = 'composer.focusComposer'
/** Surfaces an existing Composer without creating a new Agent tab when possible. */
const COMPOSER_OPEN = 'composer.openComposer'
/** Last resort only when no existing Composer surface is available. */
const COMPOSER_NEW = 'composer.newAgentChat'
const PASTE = 'editor.action.clipboardPasteAction'
const VS_CODE_CHAT_OPEN = 'workbench.action.chat.open'
const PASTE_DELAY_MS = 150

export type OpenOptimizeChatResult =
  | 'composer'
  | 'composer-new'
  | 'vscode-chat'
  | 'clipboard'

export type OpenOptimizeChatDeps = {
  readClipboard: () => Thenable<string> | Promise<string>
  writeClipboard: (text: string) => Thenable<void> | Promise<void>
  getCommands: () => Thenable<string[]> | Promise<string[]>
  executeCommand: (
    command: string,
    ...args: unknown[]
  ) => Thenable<unknown> | Promise<unknown>
  showInformationMessage: (message: string) => void
  delayMs?: number
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function defaultDeps(): OpenOptimizeChatDeps {
  return {
    readClipboard: () => vscode.env.clipboard.readText(),
    writeClipboard: (text) => vscode.env.clipboard.writeText(text),
    getCommands: () => vscode.commands.getCommands(true),
    executeCommand: (command, ...args) =>
      vscode.commands.executeCommand(command, ...args),
    showInformationMessage: (message) => {
      void vscode.window.showInformationMessage(message)
    },
    delayMs: PASTE_DELAY_MS,
  }
}

async function commandExists(
  commandId: string,
  getCommands: OpenOptimizeChatDeps['getCommands'],
): Promise<boolean> {
  const commands = await getCommands()
  return commands.includes(commandId)
}

async function pasteIntoComposer(
  prompt: string,
  openCommands: string[],
  deps: OpenOptimizeChatDeps,
  waitMs: number,
): Promise<void> {
  const previous = await deps.readClipboard()
  await deps.writeClipboard(prompt)
  try {
    for (const commandId of openCommands) {
      await deps.executeCommand(commandId)
    }
    await delay(waitMs)
    await deps.executeCommand(PASTE)
  } finally {
    await delay(waitMs)
    await deps.writeClipboard(previous)
  }
}

/**
 * Prefill Cursor Composer / VS Code Chat with the Optimize prompt.
 * Prefer focusing the last active Agent chat — do not open a new chat first.
 * Never auto-submits — the user presses Start.
 */
export async function openOptimizeChat(
  prompt: string,
  deps: OpenOptimizeChatDeps = defaultDeps(),
  locale: Locale = DEFAULT_LOCALE,
): Promise<OpenOptimizeChatResult> {
  const waitMs = deps.delayMs ?? PASTE_DELAY_MS
  const getCommands = deps.getCommands

  // Focus last/selected Agent only. Calling openComposer first often opens a
  // new chat window; focusComposer targets the selectedComposerId input.
  if (await commandExists(COMPOSER_FOCUS, getCommands)) {
    await pasteIntoComposer(prompt, [COMPOSER_FOCUS], deps, waitMs)
    return 'composer'
  }

  if (await commandExists(COMPOSER_OPEN, getCommands)) {
    await pasteIntoComposer(prompt, [COMPOSER_OPEN], deps, waitMs)
    return 'composer'
  }

  if (await commandExists(COMPOSER_NEW, getCommands)) {
    await pasteIntoComposer(prompt, [COMPOSER_NEW], deps, waitMs)
    return 'composer-new'
  }

  if (await commandExists(VS_CODE_CHAT_OPEN, getCommands)) {
    try {
      await deps.executeCommand(VS_CODE_CHAT_OPEN, {
        query: prompt,
        isPartialQuery: true,
      })
      return 'vscode-chat'
    } catch {
      // Fall through to clipboard-only.
    }
  }

  await deps.writeClipboard(prompt)
  deps.showInformationMessage(catalogFor(locale).optimize.clipboard)
  return 'clipboard'
}
