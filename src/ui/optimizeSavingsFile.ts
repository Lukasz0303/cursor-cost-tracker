import * as vscode from 'vscode'
import { OPTIMIZE_SAVINGS_FILE } from './optimizeSavings'

/**
 * Read `.ai/optimize-savings.md` from the first workspace folder.
 * Returns null when missing or unreadable — never throws.
 */
export async function readOptimizeSavingsMarkdown(
  folders: readonly vscode.WorkspaceFolder[] = vscode.workspace.workspaceFolders ??
    [],
  fs: {
    readFile: (uri: vscode.Uri) => Thenable<Uint8Array>
  } = vscode.workspace.fs,
): Promise<string | null> {
  const root = folders[0]
  if (root === undefined) {
    return null
  }
  const uri = vscode.Uri.joinPath(root.uri, OPTIMIZE_SAVINGS_FILE)
  try {
    const bytes = await fs.readFile(uri)
    return Buffer.from(bytes).toString('utf8')
  } catch {
    return null
  }
}

/**
 * Watch `.ai/optimize-savings.md` and call `onChange` when it is created,
 * changed, or deleted. Returns a disposable; no-op when there is no folder.
 */
export function watchOptimizeSavingsFile(
  onChange: () => void,
  folders: readonly vscode.WorkspaceFolder[] = vscode.workspace.workspaceFolders ??
    [],
): vscode.Disposable {
  const root = folders[0]
  if (root === undefined) {
    return { dispose: () => undefined }
  }

  const pattern = new vscode.RelativePattern(root, OPTIMIZE_SAVINGS_FILE)
  const watcher = vscode.workspace.createFileSystemWatcher(pattern)
  const subs = [
    watcher,
    watcher.onDidCreate(() => onChange()),
    watcher.onDidChange(() => onChange()),
    watcher.onDidDelete(() => onChange()),
  ]
  return {
    dispose: () => {
      for (const sub of subs) {
        sub.dispose()
      }
    },
  }
}
