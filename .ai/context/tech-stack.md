# Tech stack — Cursor Cost Tracker

Updated: 2026-09-01. Mapped to [prd.md](./prd.md).

## 1. Product

| Decision | Choice | Rejected | Why |
|----------|--------|----------|-----|
| Shape | VS Code Extension | Electron, PWA, CLI | Only the Extension API gives a status bar in Cursor |
| IDE | Cursor (VS Code fork) | JetBrains | Same VSIX; `engines.vscode` ≤ Help → About VS Code version |
| `extensionKind` | `ui` | `workspace` | Read `state.vscdb` on the local machine |

## 2. Runtime and build

| Area | Technology | Why |
|------|------------|-----|
| Language | TypeScript 5, `strict`, `noUncheckedIndexedAccess` | Typed `vscode` + usage parsing |
| Bundler | esbuild → `dist/extension.js` (CJS, `external: ['vscode']`) | Small VSIX, fast watch |
| Node | 18+ (`fetch`, AbortSignal) | No axios |
| Packaging | `@vscode/vsce` | `.vsix` file |
| Tests | Vitest | Unit: format, pool parse, daily budget — no Electron |
| Lint | ESLint + typescript-eslint (once `package.json` exists) | Consistent with TS strict |

**Rejected:** webpack (yo code), React/Vue in the webview, axios, native `better-sqlite3` as the only path.

## 3. Data and network

| Area | Choice | Notes |
|------|--------|-------|
| Session | `node:sqlite` read-only on the live file; sql.js copy only if the DB is under ~1.5 GiB | Cursor `state.vscdb` can be multi-GB (Node `readFile` / sql.js cannot load it). Keep sql.js for hosts without `node:sqlite`. Not `better-sqlite3`. |
| HTTP | `fetch` to `cursor.com` | `/api/usage-summary`, `/api/dashboard/get-filtered-usage-events` |
| State | in-memory + optional `globalState` | Polling; no Redux |
| Timeout | 15 s, `AbortController` | One refresh at a time |

## 4. UI

| Surface | API | Phase |
|---------|-----|-------|
| Current / Today / Sync | `createStatusBarItem` | MVP |
| Last 100 | `WebviewPanel` + `media/history.*` | MVP |
| Spike `!` / Ignore | `globalState` + table actions | v1.1 |
| Settings | `contributes.configuration` | MVP + spike keys v1.1 |
| Palette | `contributes.commands` | MVP |
| Quick Pick / sidebar | — | not MVP |

Webview: `--vscode-*` tokens, CSP with nonce, `retainContextWhenHidden: true`.

## 5. Target `package.json` versions

```json
{
  "engines": { "vscode": "^1.85.0" },
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension.js",
  "icon": "icon.png"
}
```

Marketplace / VSIX icon is repo-root `icon.png` (PNG, at least 128×128). Do not put Cursor’s cube or the VS Code logo in that file.

After Open VSX: if Cursor search hides the extension, lower `engines.vscode` to the version from Help → About.

## 6. Tests — what to cover

- `parse`: cents, pools, unlimited, input/output tokens
- `dailyBudget`: working days, month end
- `formatDollars` / `formatTokens`
- Status bar: unlimited, over, warn, N/A (mock service)

No `@vscode/test-electron` at the start. Manual: VSIX in Cursor vs numbers on the usage site.
