import type * as vscode from 'vscode'
import type { UsageService } from './service'

/** Minimum time between activity-triggered fetches (manual Refresh bypasses this). */
export const ACTIVITY_EDIT_DEBOUNCE_MS = 5_000

export function registerActivityRefresh(
  service: UsageService,
  vscodeApi: typeof vscode,
): vscode.Disposable {
  let editTimer: ReturnType<typeof setTimeout> | undefined

  const scheduleAfterEdit = (): void => {
    if (editTimer !== undefined) {
      clearTimeout(editTimer)
    }
    editTimer = setTimeout(() => {
      editTimer = undefined
      service.refreshOnActivity()
    }, ACTIVITY_EDIT_DEBOUNCE_MS)
  }

  const disposables: vscode.Disposable[] = [
    vscodeApi.window.onDidChangeWindowState((state) => {
      if (!state.focused) {
        return
      }
      service.refreshOnActivity()
    }),
    vscodeApi.workspace.onDidChangeTextDocument(() => {
      if (!vscodeApi.window.state.focused) {
        return
      }
      scheduleAfterEdit()
    }),
    {
      dispose: (): void => {
        if (editTimer !== undefined) {
          clearTimeout(editTimer)
          editTimer = undefined
        }
      },
    },
  ]

  return vscodeApi.Disposable.from(...disposables)
}
