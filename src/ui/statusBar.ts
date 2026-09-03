import * as vscode from 'vscode'
import {
  colorSchemeFromKind,
  onDidChangeCursorCostConfigOverlay,
  readCursorCostConfig,
  reconcileCursorCostConfigOverlay,
  resolveStatusColors,
  type CursorCostConfig,
} from '../config'
import type { UsageService } from '../usage/service'
import {
  RECENT_STATUS_SLOTS,
  toBudgetStatusItem,
  toStatusBarView,
  type SpendTone,
  type StatusBarItemView,
} from './statusBarView'

/** Far from editor Ln/Col (~100). Higher priority sits further left. */
const BUDGET_PRIORITY = -9_999
/**
 * Refresh sits immediately after Current/Today (not after recent query chips).
 * A lower priority than the query slots parks it on the window edge, where
 * Cursor's right-side chrome / overflow swallows an icon-only item.
 */
const REFRESH_PRIORITY = BUDGET_PRIORITY - 1
const RECENT_PRIORITY_START = REFRESH_PRIORITY - 1

function barColor(
  tone: SpendTone,
  config: CursorCostConfig,
): string | undefined {
  if (tone === 'red') {
    return config.warnColor
  }
  if (tone === 'green') {
    return config.okColor
  }
  return undefined
}

function applyItem(
  item: vscode.StatusBarItem,
  view: StatusBarItemView,
  config: CursorCostConfig,
): void {
  item.text = view.text
  if (view.tooltipMarkdown) {
    const markdown = new vscode.MarkdownString(view.tooltip)
    markdown.isTrusted = true
    markdown.supportHtml = true
    markdown.supportThemeIcons = true
    item.tooltip = markdown
  } else {
    item.tooltip = view.tooltip
  }
  item.color = barColor(view.tone, config)
  item.command = view.command
  item.accessibilityInformation = { label: view.accessibility }
  if (view.visible) {
    item.show()
  } else {
    item.hide()
  }
}

export class StatusBarController implements vscode.Disposable {
  static register(
    context: vscode.ExtensionContext,
    service: UsageService,
  ): StatusBarController {
    const controller = new StatusBarController(service)
    context.subscriptions.push(controller)
    return controller
  }

  private readonly budget: vscode.StatusBarItem
  private readonly recent: vscode.StatusBarItem[]
  private readonly refresh: vscode.StatusBarItem
  private readonly disposables: vscode.Disposable[] = []

  constructor(private readonly service: UsageService) {
    this.budget = vscode.window.createStatusBarItem(
      'cursorCost.budget',
      vscode.StatusBarAlignment.Right,
      BUDGET_PRIORITY,
    )
    this.budget.name = 'Cursor Cost'
    this.recent = []
    for (let i = 0; i < RECENT_STATUS_SLOTS; i++) {
      const item = vscode.window.createStatusBarItem(
        `cursorCost.recent.${i}`,
        vscode.StatusBarAlignment.Right,
        RECENT_PRIORITY_START - i,
      )
      item.name = `Cursor Cost recent query ${i + 1}`
      this.recent.push(item)
    }
    // No item id: a named id matching the command (`cursorCost.refresh`) can
    // stay user-hidden after overflow, and `show()` will not unhide it.
    this.refresh = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      REFRESH_PRIORITY,
    )
    this.refresh.name = 'Cursor Cost Refresh'
    this.disposables.push(
      this.budget,
      ...this.recent,
      this.refresh,
      this.service.onDidChange(() => {
        this.render()
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('cursorCost')) {
          reconcileCursorCostConfigOverlay(
            vscode.workspace.getConfiguration('cursorCost'),
          )
          this.render()
        }
      }),
      onDidChangeCursorCostConfigOverlay(() => {
        this.render()
      }),
      vscode.window.onDidChangeActiveColorTheme(() => {
        this.render()
      }),
    )
    this.render()
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose()
    }
  }

  private render(): void {
    const config = readCursorCostConfig(
      vscode.workspace.getConfiguration('cursorCost'),
    )
    const colors = resolveStatusColors(
      config,
      colorSchemeFromKind(vscode.window.activeColorTheme.kind),
    )
    const painted = { ...config, ...colors }
    const view = toStatusBarView(
      this.service.getSnapshot(),
      painted,
      this.service.isRefreshing(),
    )
    applyItem(
      this.budget,
      toBudgetStatusItem(view, this.service.getSnapshot(), painted),
      painted,
    )
    applyItem(this.refresh, view.refresh, painted)
    for (let i = 0; i < this.recent.length; i++) {
      const item = this.recent[i]
      const slot = view.recent[i]
      if (item === undefined || slot === undefined) {
        continue
      }
      applyItem(item, slot, painted)
    }
  }
}
