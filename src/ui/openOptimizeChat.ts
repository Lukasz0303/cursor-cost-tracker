import * as vscode from 'vscode'
import { catalogFor } from '../i18n'
import { DEFAULT_LOCALE, type Locale } from '../locale'

/** Focus the last/selected Agent chat input — prefer over opening a new chat. */
const COMPOSER_FOCUS = 'composer.focusComposer'
/** Surfaces an existing Composer without creating a new Agent tab when possible. */
const COMPOSER_OPEN = 'composer.openComposer'
/** New Agent chat — Run Optimize. */
const COMPOSER_NEW = 'composer.newAgentChat'
/** Glass layout opens an existing agent by id. Editor uses composer.openComposer. */
const GLASS_OPEN_AGENT = 'glass.openAgentById'
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

type OpenStep = {
  command: string
  args?: readonly unknown[]
}

async function pasteIntoComposer(
  prompt: string,
  openCommands: readonly OpenStep[],
  deps: OpenOptimizeChatDeps,
  waitMs: number,
): Promise<void> {
  const previous = await deps.readClipboard()
  await deps.writeClipboard(prompt)
  try {
    for (const step of openCommands) {
      await deps.executeCommand(step.command, ...(step.args ?? []))
    }
    await delay(waitMs)
    await deps.executeCommand(PASTE)
  } finally {
    await delay(waitMs)
    await deps.writeClipboard(previous)
  }
}

function step(command: string, ...args: unknown[]): OpenStep {
  return { command, args }
}

export type OptimizeChatTarget = 'new' | 'last' | 'composer'

export type OpenOptimizeChatOptions = {
  /**
   * `last` — focus the last active Agent chat.
   * `new` — open a fresh Agent chat. Run Optimize uses `last`.
   * `composer` — open the conversation Play was pressed on, then paste there.
   */
  target?: OptimizeChatTarget
  /** Composer id for `target: 'composer'`. Play passes the conversation id. */
  composerId?: string
}

async function copyToClipboard(
  prompt: string,
  deps: OpenOptimizeChatDeps,
  locale: Locale,
): Promise<OpenOptimizeChatResult> {
  await deps.writeClipboard(prompt)
  deps.showInformationMessage(catalogFor(locale).optimize.clipboard)
  return 'clipboard'
}

/**
 * Prefill a new Agent chat. If that command is missing, copy to the clipboard.
 * Does not focus or paste into the last chat.
 */
async function openNewOptimizeChat(
  prompt: string,
  deps: OpenOptimizeChatDeps,
  locale: Locale,
): Promise<OpenOptimizeChatResult> {
  const waitMs = deps.delayMs ?? PASTE_DELAY_MS
  if (await commandExists(COMPOSER_NEW, deps.getCommands)) {
    await pasteIntoComposer(prompt, [step(COMPOSER_NEW)], deps, waitMs)
    return 'composer-new'
  }
  return copyToClipboard(prompt, deps, locale)
}

/**
 * Open an existing conversation and focus its empty input.
 * Does not paste a prompt and does not create a second chat.
 */
export async function openConversationComposer(
  composerId: string,
  deps: OpenOptimizeChatDeps = defaultDeps(),
): Promise<boolean> {
  const id = composerId.trim()
  if (id === '' || id.startsWith('query-')) {
    return false
  }
  const getCommands = deps.getCommands
  try {
    if (await commandExists(COMPOSER_OPEN, getCommands)) {
      await deps.executeCommand(COMPOSER_OPEN, id, { focusMainInputBox: true })
      return true
    }
    if (await commandExists(GLASS_OPEN_AGENT, getCommands)) {
      await deps.executeCommand(GLASS_OPEN_AGENT, id)
      return true
    }
  } catch {
    return false
  }
  return false
}

/** Open that conversation and paste a prompt into its empty input. */
export async function pasteIntoConversation(
  composerId: string,
  prompt: string,
  deps: OpenOptimizeChatDeps = defaultDeps(),
  locale: Locale = DEFAULT_LOCALE,
): Promise<OpenOptimizeChatResult> {
  const id = composerId.trim()
  if (id === '' || id.startsWith('query-')) {
    return copyToClipboard(prompt, deps, locale)
  }
  return openComposerOptimizeChat(prompt, id, deps, locale)
}

/**
 * Open the Agent chat Play was pressed on and paste there.
 * A new empty chat has no transcript, so this path never creates one.
 */
async function openComposerOptimizeChat(
  prompt: string,
  composerId: string,
  deps: OpenOptimizeChatDeps,
  locale: Locale,
): Promise<OpenOptimizeChatResult> {
  const base = deps.delayMs ?? PASTE_DELAY_MS
  // Switching to another composer needs the input focused before paste.
  const waitMs = base === 0 ? 0 : Math.max(base, 400)
  const getCommands = deps.getCommands
  const open = (await commandExists(COMPOSER_OPEN, getCommands))
    ? step(COMPOSER_OPEN, composerId)
    : (await commandExists(GLASS_OPEN_AGENT, getCommands))
      ? step(GLASS_OPEN_AGENT, composerId)
      : null
  if (open === null) {
    return copyToClipboard(prompt, deps, locale)
  }
  try {
    await pasteIntoComposer(prompt, [open], deps, waitMs)
  } catch {
    return copyToClipboard(prompt, deps, locale)
  }
  return 'composer'
}

/**
 * Prefill the last active Agent chat.
 * Never auto-submits — the user presses Start.
 */
async function openLastOptimizeChat(
  prompt: string,
  deps: OpenOptimizeChatDeps,
  locale: Locale,
): Promise<OpenOptimizeChatResult> {
  const waitMs = deps.delayMs ?? PASTE_DELAY_MS
  const getCommands = deps.getCommands

  // Focus last/selected Agent only. Calling openComposer first often opens a
  // new chat window; focusComposer targets the selectedComposerId input.
  if (await commandExists(COMPOSER_FOCUS, getCommands)) {
    await pasteIntoComposer(prompt, [step(COMPOSER_FOCUS)], deps, waitMs)
    return 'composer'
  }

  if (await commandExists(COMPOSER_OPEN, getCommands)) {
    await pasteIntoComposer(prompt, [step(COMPOSER_OPEN)], deps, waitMs)
    return 'composer'
  }

  if (await commandExists(COMPOSER_NEW, getCommands)) {
    await pasteIntoComposer(prompt, [step(COMPOSER_NEW)], deps, waitMs)
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

  return copyToClipboard(prompt, deps, locale)
}

/**
 * Prefill Cursor Composer / VS Code Chat with an Optimize prompt.
 * Never auto-submits — the user presses Start.
 */
export async function openOptimizeChat(
  prompt: string,
  deps: OpenOptimizeChatDeps = defaultDeps(),
  locale: Locale = DEFAULT_LOCALE,
  options?: OpenOptimizeChatOptions,
): Promise<OpenOptimizeChatResult> {
  if (options?.target === 'new') {
    return openNewOptimizeChat(prompt, deps, locale)
  }
  if (options?.target === 'composer') {
    const composerId = options.composerId?.trim() ?? ''
    if (composerId === '') {
      return copyToClipboard(prompt, deps, locale)
    }
    return openComposerOptimizeChat(prompt, composerId, deps, locale)
  }
  return openLastOptimizeChat(prompt, deps, locale)
}
