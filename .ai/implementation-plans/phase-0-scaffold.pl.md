# Faza 0 — Szkielet

**Plan nadrzędny:** [mvp.pl.md](./mvp.pl.md) · kanon EN: [phase-0-scaffold.md](./phase-0-scaffold.md)  
**Status:** gotowy do realizacji  
**Zależy od:** nic (repo przed implementacją; brak `src/`)  
**Następna:** [phase-1-parse-format.pl.md](./phase-1-parse-format.pl.md)  
**Źródła:** [tech-stack.md](../context/tech-stack.md) · [architecture.md](../context/architecture.md) · [publishing.md](../context/publishing.md)

Przy rozjeździe z [prd.md](../context/prd.md) lub [mvp.md](./mvp.md) wygrywa **angielski PRD**, potem mvp.md.

---

## 1. Cel

Szkielet rozszerzenia VS Code / Cursor: TypeScript → esbuild → `dist/extension.js`, puste `activate()` wracające od razu, skrypty build / watch / test / package.

Bez logiki usage, paska i sieci.

**Gotowe gdy:** `npm run build` zapisuje `dist/extension.js`; F5 Extension Host (albo pusty VSIX) nie crashuje.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| Parse, sesja, API, UI | fazy 1–6 |
| Odczyt `state.vscdb` w runtime | faza 2 (kopiowanie **wasm** jest w tej fazie) |
| Publikacja Open VSX | v2 (`icon.png` + `"icon"` w `package.json` idą już do lokalnego VSIX) |
| ESLint | opcjonalnie; pomiń, chyba że jeden plik |
| `@vscode/test-electron` | nigdy w MVP |

---

## 3. Pliki do utworzenia

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

Nie twórz jeszcze `media/` (faza 6) ani `src/usage/` (faza 1).

---

## 4. Kolejność prac

### 4.1 `package.json`

| Pole | Wartość |
|------|---------|
| `name` | `cursor-cost-tracker` |
| `displayName` | Cursor Cost Tracker |
| `description` | See Cursor AI spend on the status bar. Click opens Last 100 queries. |
| `version` | `0.1.0` |
| `publisher` | placeholder zgodny z przyszłym namespace Open VSX |
| `license` | `MIT` |
| `engines.vscode` | `^1.85.0` |
| `categories` | `["Other"]` |
| `activationEvents` | `["onStartupFinished"]` |
| `main` | `./dist/extension.js` |
| `extensionKind` | `["ui"]` |
| `repository` | URL GitHub z README repo |
| `icon` | `icon.png` (ikona produktu w korzeniu repo; PNG ≥ 128×128) |

**`contributes.commands`** (zarejestruj teraz; handlery no-op do fazy 7):

| ID komendy | Tytuł |
|------------|--------|
| `cursorCost.showHistory` | Cursor Cost: Show Usage History |
| `cursorCost.refresh` | Cursor Cost: Refresh |

**`contributes.configuration`** (przestrzeń `cursorCost`):

| Klucz | Typ | Domyślnie | Ograniczenia |
|-------|-----|-----------|--------------|
| `pollIntervalMinutes` | number | `5` | min 1, max 60 |
| `showStatusBar` | boolean | `true` | |
| `showToday` | boolean | `true` | |

**Nie** dodawaj `spikeTokenThreshold` / `showSpikeWarning` (v1.1).

**Skrypty:** `build` (`node esbuild.mjs`), `watch`, `test` (`vitest run`), `package` (`npm run build && vsce package --no-dependencies`).

**dependencies:** `sql.js`  
**devDependencies:** `typescript`, `esbuild`, `@types/vscode` `^1.85.0`, `@types/node`, `@vscode/vsce`, `vitest`

Bez axios, webpack, React, biblioteki JWT.

### 4.2 `tsconfig.json`

- `target`: `ES2022`
- `module` / `moduleResolution`: `Node16`
- `strict`: `true`
- `noUncheckedIndexedAccess`: `true`
- `rootDir`: `src` (testy w `test/` przez Vitest)

### 4.3 `esbuild.mjs`

Wejście `src/extension.ts`, `bundle: true`, `format: 'cjs'`, `platform: 'node'`, `external: ['vscode']`, `outfile: dist/extension.js`, sourcemap, `--watch`.

**Wasm sql.js (teraz, użyte w fazie 2):** po bundlu skopiuj `node_modules/sql.js/dist/sql-wasm.wasm` → `dist/sql-wasm.wasm`. Później `initSqlJs({ locateFile })`. Bez wasm w VSIX faza 2 nie zadziała na czystej instalacji.

### 4.4 `vitest.config.ts`

`environment: node`, `include: test/**/*.test.ts`. Zero testów w tej fazie jest OK, jeśli `npm test` kończy się kodem 0.

### 4.5 `.gitignore`

Ignoruj: `node_modules/`, `dist/`, `*.vsix`, `.vscode-test/`. **Nie** ignoruj `.vscode/launch.json` ani `.ai/`.

### 4.6 `.vscodeignore`

**Wyklucz:** `src/**`, `test/**`, `.ai/**`, `.cursor/**`, `esbuild.mjs`, `tsconfig.json`, `vitest.config.ts`.

**Zostaw w VSIX:** `dist/**` (js + wasm), `media/**`, `LICENSE`, `package.json`, `README.md`, **`icon.png`**.

### 4.7 Debug (F5)

`.vscode/tasks.json`: preLaunch `npm: watch` lub `build`.  
`.vscode/launch.json`: `extensionHost`, `--extensionDevelopmentPath=${workspaceFolder}`.

### 4.8 `src/extension.ts`

Puste `activate` (bez `await` na sieć), puste `deactivate`. Powrót w milisekundach. Bez logów, które później mogłyby trzymać token.

---

## 5. Weryfikacja

1. `npm install`
2. `npm run build` → istnieje `dist/extension.js` i `dist/sql-wasm.wasm`
3. `npm test` → kod 0
4. F5: brak błędu aktywacji
5. Opcjonalnie: `vsce package --no-dependencies` i LICENSE w paczce

---

## 6. Aktualizacja kontekstu

Po szkielecie zaktualizuj [codebase-snapshot.md](../context/codebase-snapshot.md): nie pisz „brak `src/`”; zachowanie to nadal puste `activate`.

---

## 7. Przekazanie do fazy 1

Faza 1 potrzebuje działającego Vitest i TS strict. Nie potrzebuje API vscode. Następne pliki: `src/usage/types.ts`, `parse.ts`, `src/format.ts`, testy i fixtury.
