# Phase 0 — Scaffold

**Parent:** [mvp.md](./mvp.md)  
**Status:** ready to implement  
**Depends on:** nothing (repo is pre-implementation; no `src/` yet)  
**Next:** [phase-1-parse-format.md](./phase-1-parse-format.md)  
**Polish:** [phase-0-scaffold.pl.md](./phase-0-scaffold.pl.md)  
**Sources:** [tech-stack.md](../context/tech-stack.md) · [architecture.md](../context/architecture.md) · [publishing.md](../context/publishing.md)

If this file and [mvp.md](./mvp.md) or the English PRD disagree, **the PRD wins**, then mvp.md.

---

## 1. Goal

Create a loadable VS Code / Cursor extension skeleton: TypeScript → esbuild → `dist/extension.js`, empty `activate()` that returns immediately, scripts for build / watch / test / package.

No usage logic, no status bar, no network.

**Done when:** `npm run build` writes `dist/extension.js`; F5 Extension Host (or an empty VSIX) does not crash.

---

## 2. Out of scope

| Item | When |
|------|------|
| Parse, session, API, UI | phases 1–6 |
| sql.js *runtime* read of `state.vscdb` | phase 2 (wasm **copy** is this phase) |
| Open VSX publish | v2 (`icon.png` + `"icon"` in `package.json` ship in the local VSIX now) |
| ESLint | optional; skip unless it is a one-file add |
| `@vscode/test-electron` | never in MVP |

---

## 3. Files to create

```
package.json
tsconfig.json
esbuild.mjs
vitest.config.ts
.gitignore
.vscodeignore
.vscode/launch.json
.vscode/tasks.json
src/extension.ts
```

Do not create `media/` yet (phase 6). Do not create `src/usage/` yet (phase 1).

---

## 4. Work order

### 4.1 `package.json`

| Field | Value |
|-------|--------|
| `name` | `cursor-cost-tracker` |
| `displayName` | Cursor Cost Tracker |
| `description` | See Cursor AI spend on the status bar. Click opens Last 100 queries. |
| `version` | `0.1.0` |
| `publisher` | placeholder matching the future Open VSX namespace (GitHub org/user is a reasonable stand-in) |
| `license` | `MIT` |
| `engines.vscode` | `^1.85.0` |
| `categories` | `["Other"]` |
| `activationEvents` | `["onStartupFinished"]` |
| `main` | `./dist/extension.js` |
| `extensionKind` | `["ui"]` |
| `repository` | the GitHub URL from the repo README |
| `icon` | `icon.png` (repo-root product icon; PNG ≥ 128×128) |

**`contributes.commands`** (register now; handlers stay no-ops until phase 7):

| Command ID | Title |
|------------|--------|
| `cursorCost.showHistory` | Cursor Cost: Show Usage History |
| `cursorCost.refresh` | Cursor Cost: Refresh |

**`contributes.configuration`** (`cursorCost` namespace):

| Key | Type | Default | Constraints |
|-----|------|---------|-------------|
| `pollIntervalMinutes` | number | `5` | min 1, max 60 |
| `showStatusBar` | boolean | `true` | |
| `showToday` | boolean | `true` | |

Do **not** add `spikeTokenThreshold` / `showSpikeWarning` (v1.1).

**Scripts:**

```json
{
  "build": "node esbuild.mjs",
  "watch": "node esbuild.mjs --watch",
  "test": "vitest run",
  "package": "npm run build && vsce package --no-dependencies"
}
```

**Dependencies:** `sql.js`  
**devDependencies:** `typescript`, `esbuild`, `@types/vscode` `^1.85.0`, `@types/node`, `@vscode/vsce`, `vitest`

Do not add axios, webpack, React, or a JWT library.

### 4.2 `tsconfig.json`

- `compilerOptions.target`: `ES2022`
- `module` / `moduleResolution`: `Node16`
- `strict`: `true`
- `noUncheckedIndexedAccess`: `true`
- `skipLibCheck`: `true`
- `rootDir`: `src` (tests live under `test/` with Vitest; include them via vitest, not as the extension emit)
- `outDir`: `dist` (esbuild is the real bundler; tsc is typecheck-only if you add `"typecheck": "tsc --noEmit"`)

Include `src/**/*.ts`. Exclude `node_modules`, `dist`, `test` from tsc emit if `rootDir` is `src`.

### 4.3 `esbuild.mjs`

Bundle:

- entry: `src/extension.ts`
- `bundle: true`
- `format: 'cjs'`
- `platform: 'node'`
- `external: ['vscode']`
- `outfile: dist/extension.js`
- sourcemap for watch/F5
- `--watch` when `process.argv` contains `--watch`

**sql.js wasm (do this now, used in phase 2):** after a successful bundle, copy `node_modules/sql.js/dist/sql-wasm.wasm` → `dist/sql-wasm.wasm`. Later `initSqlJs({ locateFile: (file) => path.join(__dirname, file) })`. If wasm is missing from the VSIX, phase 2 cannot run on a clean install.

Do not bundle `vscode`.

### 4.4 `vitest.config.ts`

- `test.environment`: `node`
- `include`: `test/**/*.test.ts`
- No vscode mock required yet (phase 1 tests are pure)

A placeholder `test/scaffold.test.ts` that asserts `1 + 1 === 2` is optional; prefer skipping until phase 1 if the `test` script already exits 0 with zero files. Vitest with zero tests should still succeed — confirm locally.

### 4.5 `.gitignore`

Ignore at least: `node_modules/`, `dist/`, `*.vsix`, `.vscode-test/`.  
Do **not** ignore `.vscode/launch.json` or `.ai/`.

### 4.6 `.vscodeignore`

**Exclude:** `src/**`, `test/**`, `.ai/**`, `.cursor/**`, `esbuild.mjs`, `tsconfig.json`, `vitest.config.ts`, `**/*.map` (optional), `node_modules/**` (vsce with `--no-dependencies` still needs `dist/` contents)

**Keep in the VSIX:** `dist/**` (js + wasm), `media/**` (empty until phase 6), `LICENSE`, `package.json`, `readme` / `README.md`, **`icon.png`**.

### 4.7 Debug launch (F5)

`.vscode/tasks.json`: task `npm: watch` (or `npm: build`) as preLaunch.

`.vscode/launch.json`: type `extensionHost`, `args`: `--extensionDevelopmentPath=${workspaceFolder}`, `outFiles`: `${workspaceFolder}/dist/**/*.js`.

### 4.8 `src/extension.ts`

```typescript
import type * as vscode from 'vscode'

export function activate(_context: vscode.ExtensionContext): void {
  // Phase 7 wires UsageService, status bar, and commands.
}

export function deactivate(): void {}
```

Rules:

- No `async` `activate` that awaits fetch or SQLite.
- Return in milliseconds.
- Do not log anything that could later hold a session token.

---

## 5. Verification

1. `npm install`
2. `npm run build` → `dist/extension.js` exists; `dist/sql-wasm.wasm` exists
3. `npm test` → exits 0 (zero tests is acceptable)
4. F5: Extension Host opens; no activation error in the debug console
5. Optional: `npx @vscode/vsce package --no-dependencies` and confirm LICENSE is inside (vsce warns if missing)

---

## 6. Security (this phase)

No token handling yet. Do not add `console.log` of configuration that will later include secrets. Do not commit `node_modules` or a built VSIX unless asked.

---

## 7. Context update

After the skeleton lands, update [codebase-snapshot.md](../context/codebase-snapshot.md): stop saying “no `src/`”; list the scaffold files and that behavior is still empty `activate`.

---

## 8. Handoff to phase 1

Phase 1 needs a working `npm test` (Vitest) and TypeScript strictness. It does **not** need vscode APIs. Next files: `src/usage/types.ts`, `src/usage/parse.ts`, `src/format.ts`, `test/*.test.ts`, `test/fixtures/`.
