# Plan implementacji MVP — Cursor Cost Tracker

**Status:** gotowy do realizacji  
**Data:** 2026-09-01  
**Zakres:** tylko faza **MVP** z PRD (status bar + Last 100 + polling). Bez v1.1 / v1.2 / v2.  
**Źródła:** [prd.md](../context/prd.md) (kanon EN) · [prd.pl.md](../context/prd.pl.md) · [tech-stack.md](../context/tech-stack.md) · [architecture.md](../context/architecture.md) · [security.md](../context/security.md)  
**Wersja angielska (kanoniczna):** [mvp.md](./mvp.md)  
Przy rozjeździe z angielskim PRD lub [mvp.md](./mvp.md) wygrywa **angielski**.

---

## 1. Cel

WSIX, który na zalogowanym Cursorze:

1. Pokazuje **Current** i **Today** na belce w ≤ 10 s od startu (`activate` bez blokady).
2. Po kliknięciu otwiera **Last 100 Cursor queries** (bez Quick Pick).
3. Odświeża komendą / ikoną sync i pollingiem co 5 min.
4. Nigdy nie wycieka tokenu sesji do logów ani webview.

Mapowanie: historyjki **A1–A7**, cele **G1–G5**, akceptacja **§13**.

---

## 2. Poza zakresem (nie implementować)

| Element | Powód |
|---------|--------|
| Quick Pick jako domyślny klik | PRD §5.3 |
| Activity Bar / sidebar | v1.1 / v1.2 |
| Powiadomienia 80%/90% | v1.1 |
| Copy stats, CSV, Secret Storage | v1.1 / v2 |
| React/Vue, axios, webpack, tylko native sqlite | tech-stack |
| Publikacja Open VSX | v2; wystarczy lokalny VSIX |
| Ręczny token w settings | v2 |

---

## 3. Kolejność prac

Fazy po kolei. Późniejsze zależą od typów i `UsageService`.

| Faza | Nazwa | Dostarcza | Historyjki |
|------|-------|-----------|------------|
| **0** | Szkielet | `package.json`, esbuild, tsconfig, Vitest, pusty `activate` | — |
| **1** | Typy + parse + format | Czyste funkcje + testy jednostkowe | G3 |
| **2** | Sesja | kopia `state.vscdb` + sql.js + JWT `sub` | A6 |
| **3** | API Cursor | summary + events, timeout, AbortController | A1 A2 A5 |
| **4** | UsageService | snapshot, poll, cache | G1 G5 |
| **5** | Status bar | Current, Today, Refresh, kolory, tooltipy | A1 A2 A4 A5 A7 |
| **6** | Webview historii | tabela Last 100, CSP, reuse panelu | A3 G2 |
| **7** | Sklejenie + VSIX | komendy, ustawienia, ignore, audyt tokenu | G4 §13 |

Szacunek: **3–5 dni** (PRD §11), jeden developer.

---

## 4. Docelowe drzewo (twórz w miarę faz)

```
package.json
tsconfig.json
esbuild.mjs
.eslintrc.cjs          # opcjonalnie w fazie 0
.vscodeignore
src/
  extension.ts
  config.ts
  format.ts
  usage/
    types.ts
    session.ts
    api.ts
    parse.ts
    service.ts
  ui/
    statusBar.ts
    historyPanel.ts
media/
  history.html
  history.css
  history.js
test/
  format.test.ts
  parse.test.ts
  dailyBudget.test.ts
  fixtures/            # zanonimizowany JSON, bez tokenów
```

Przy zmianie układu zaktualizuj [architecture.md](../context/architecture.md).

---

## 5. Wspólne typy (`src/usage/types.ts`)

```typescript
export type UsageQuery = {
  timestamp: number
  model: string | null
  kind: string | null
  costUsd: number
  tokens: number
  inputTokens: number
  outputTokens: number
}

export type UsageReady = {
  email: string | null
  plan: string | null
  usedUsd: number
  limitUsd: number | null
  remainingUsd: number | null
  todayUsedUsd: number | null
  dailyBudgetUsd: number | null
  workingDaysLeft: number | null
  billingCycleEnd: string | null
  isUnlimited: boolean
  recentQueries: UsageQuery[]
}

export type UsageSnapshot =
  | { status: 'loading' }
  | { status: 'ready'; data: UsageReady }
  | { status: 'error'; message: string }
```

Payload webview: `{ type: 'data', events: UsageQuery[] }` — **bez** tokenu/cookie. Email nie jest wymagany w tabeli MVP.

---

## 6. Faza 0 — Szkielet

**Pliki:** `package.json`, `tsconfig.json`, `esbuild.mjs`, `.vscodeignore`, `src/extension.ts`

**`package.json` (musi zawierać):**

- `name`: `cursor-cost-tracker` (lub `cursor-cost`); `displayName`: Cursor Cost Tracker
- `publisher`: placeholder zgodny z przyszłym namespace Open VSX
- `engines.vscode`: `^1.85.0`
- `activationEvents`: `["onStartupFinished"]`
- `main`: `./dist/extension.js`
- `extensionKind`: `["ui"]`
- `contributes.commands`: `cursorCost.showHistory`, `cursorCost.refresh`
- `contributes.configuration`: `cursorCost.pollIntervalMinutes` (1–60, domyślnie 5), `showStatusBar`, `showToday`
- skrypty: `build` (esbuild), `watch`, `test` (vitest), `package` (vsce)
- `devDependencies`: `typescript`, `esbuild`, `@types/vscode` ^1.85, `@vscode/vsce`, `vitest`
- `dependencies`: `sql.js` (wasm w `dist` przez esbuild / copy)

**esbuild:** wejście `src/extension.ts`, `bundle: true`, `format: 'cjs'`, `platform: 'node'`, `external: ['vscode']`, `outfile: dist/extension.js`. Wasm sql.js: `initSqlJs({ locateFile })`.

**tsconfig:** ES2022, `strict`, `noUncheckedIndexedAccess`, `module`/`moduleResolution` Node16.

**`.vscodeignore`:** wyklucz `src/**`, testy, `.ai/**`, `.cursor/**`; **zostaw** `dist/`, `media/`, `LICENSE`, `package.json`, wasm.

**`activate`:** puste subskrypcje; `deactivate` no-op. Powrót w milisekundach (bez `await` na sieć).

**Gotowe gdy:** `npm run build` daje `dist/extension.js`; pusty VSIX nie crashuje.

---

## 7. Faza 1 — Parse i format (bez VS Code)

**Pliki:** `src/usage/parse.ts`, `src/format.ts`, `test/*.test.ts`, `test/fixtures/`

### 7.1 Parse (PRD §8)

| Funkcja | Zachowanie |
|---------|------------|
| `centsToUsd(cents)` | dzielenie przez 100; ochrona przed NaN |
| `pickUsagePool(summary)` | individual `onDemand` → `plan` → team `onDemand` → `overall` |
| `isUnlimited(pool)` | w UI ukryj Today |
| `mapEventToQuery(raw)` | koszt z `chargedCents` / `tokenUsage.totalCents` / `usageBasedCosts`; tokeny = input + output + cache jeśli są |
| `workingDaysLeftInMonth(from: Date)` | pon.–pt. do końca miesiąca, w tym dziś (lokalna TZ) |
| `dailyBudgetUsd(remaining, days)` | `remaining / days`; null gdy days ≤ 0 |
| `sumTodayUsedUsd(events, now)` | suma kosztu eventów z dzisiejszego dnia kalendarzowego |
| `stripModelPrefix(model)` | obetnij prefiks `cursor-` w UI |

Fixtury **bez tokenów**. Pokryj: brak limitu, unlimited, puste eventy, piątek na końcu miesiąca, mieszane pola centów.

### 7.2 Format

| Funkcja | Przykład |
|---------|----------|
| `formatDollars(n)` | `3.79 $` (2 miejsca) |
| `formatTokens(n)` | `64,755` w tabeli (pełna liczba z przecinkami) |
| `formatDateTime(ms)` | `1.09.2026, 10:05:12` (lokalnie) |
| `formatKind(kind)` | czytelny kind (`Included In Business`) |

**Gotowe gdy:** `npm test` zielone dla parse + format.

---

## 8. Faza 2 — Sesja

**Plik:** `src/usage/session.ts`

1. Ścieżka DB wg `process.platform` (tabela PRD §8).
2. Brak pliku → `{ ok: false, error: 'Sign in to Cursor' }` (komunikat EN w UI).
3. Kopia pliku do `Buffer` (bez exclusive write). sql.js na kopii.
4. `SELECT value FROM ItemTable WHERE key = ?` dla `cursorAuth/accessToken`.
5. Dekoduj payload JWT (base64url, **bez** osobnej biblioteki JWT) → `sub`.
6. Cookie: `WorkosCursorSessionToken=${sub}::${accessToken}`.
7. Opcjonalnie email z DB; inaczej `null`.

**Nigdy nie loguj** cookie, tokenu, `sub`.

**Gotowe gdy:** testy ścieżek z mockiem `fs`; żywa DB nieobowiązkowa w CI.

---

## 9. Faza 3 — HTTP API

**Plik:** `src/usage/api.ts`

| Wywołanie | Metoda | Uwagi |
|-----------|--------|-------|
| Usage summary | `GET https://cursor.com/api/usage-summary` | nagłówek `Cookie` |
| Events | `POST https://cursor.com/api/dashboard/get-filtered-usage-events` | JSON `{ page, pageSize, startDate?, endDate? }` |

- `pageSize=100` dla Last 100 (strona 1).
- Today: paginacja z filtrem daty (np. max 50 stron); pustka → fallback bez filtra, filtr dziś po stronie klienta.
- Timeout 15 s / AbortController z serwisu.
- Allowlist: tylko host `cursor.com`.
- Błędy niezależne: pad summary → snapshot error; pad events → `todayUsedUsd: null`, `recentQueries: []`, Current działa jeśli summary OK.

**Gotowe gdy:** funkcje biorą `cookie` + `signal`; testy z mockiem `fetch`.

---

## 10. Faza 4 — UsageService

**Plik:** `src/usage/service.ts`

- `start()`: emit `loading`, potem `refresh()` bez blokowania activate.
- `refresh()`: abort poprzedniego; sesja → Promise.all summary + recent; today/budget; emit `ready` lub `error`.
- Poll: `setInterval` z `pollIntervalMinutes` (1–60). Clear w `dispose`.
- `onDidChange` EventEmitter dla UI.
- Cache ostatniego `ready` w pamięci, żeby panel otworzył się w &lt; 2 s (G2). Opcjonalnie **oczyszczony** snapshot w `globalState` (bez cookie).

**Gotowe gdy:** testy z fake session/api: loading → ready; abort; interwał z configu.

---

## 11. Faza 5 — Status bar

**Plik:** `src/ui/statusBar.ts`  
**PRD:** §5.1, A1 A2 A4 A5 A7

Trzy itemy, `StatusBarAlignment.Right`, priorytet ~100 / 99 / 98:

| Item | Komenda | Widoczny gdy |
|------|---------|----------------|
| Current | `cursorCost.showHistory` | `showStatusBar` |
| Today | `cursorCost.showHistory` | `showStatusBar` && `showToday` && nie unlimited && `todayUsedUsd !== null` |
| Refresh | `cursorCost.refresh` | `showStatusBar` |

**Render:**

- `loading`: `$(loading~spin) …`
- `error`: `$(warning) N/A` + tooltip = `message`
- `unlimited`: Current `$(credit-card) Unlimited`; ukryj Today
- `ready`: `$(credit-card) {used} / {limit}`; Today `$(calendar) {today} / {budget}`
- Kolor: `charts.red` przy > 100%; żółty przy ≥ 90% miesiąca (Current) lub ≥ 80% dnia (Today); inaczej zieleń/domyślny
- Tooltip Current: `email · plan · cycle ends {date}` (A7)
- Tooltip Today: remaining / dni robocze (krótki EN)
- `accessibilityInformation` na każdym itemie

`showStatusBar` / `showToday` przez `config.ts` + `onDidChangeConfiguration`.

**Gotowe gdy:** mock snapshotów zmienia tekst/kolor; Today znika przy unlimited i przy null today.

---

## 12. Faza 6 — Webview Last 100

**Pliki:** `src/ui/historyPanel.ts`, `media/history.html|css|js`  
**PRD:** §5.2, A3, G2

- `createWebviewPanel('cursorCost.history', 'Last 100 Cursor queries', ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [media] })`
- Reuse (`reveal`), jeśli panel już jest
- CSP z nonce; `enableCommandUris: false`
- HTML: nagłówek + Close (`postMessage { type: 'close' }`) + kolumny TIME, MODEL, COST, TOKENS, INPUT / OUTPUT, KIND
- CSS: tokeny `--vscode-*`; tabela monospace; separatory wierszy
- Na `ready` z webview: wyślij cache `events` (najnowsze na górze)
- Subskrypcja `UsageService`; po refresh `postMessage { type: 'data', events }`
- Close czyści referencję panelu

**Gotowe gdy:** drugie otwarcie fokusuje ten sam panel; w payloadzie brak pól tokenu (review / komenda `9-security-token-audit`).

---

## 13. Faza 7 — Sklejenie, paczka, weryfikacja

**Pliki:** `src/extension.ts`, `src/config.ts`

```
activate:
  wrapper config
  UsageService.start()
  StatusBarController.register
  HistoryPanel.register
  komendy: showHistory, refresh
  onDidChangeConfiguration → poll / widoczność
  subscriptions.push(service, statusBar, panel)
```

Następnie:

1. `npm test`
2. Komenda `9-security-token-audit` (grep tokenu w `src/` + `dist/`)
3. `npm run build` + `vsce package --no-dependencies`
4. Komenda `6-install-in-cursor`
5. Checklist ręczny = PRD §13 (Windows P0)
6. Aktualizacja [codebase-snapshot.md](../context/codebase-snapshot.md)

**Gotowe gdy:** da się odhaczyć wszystkie punkty §13 na zalogowanym Cursorze.

---

## 14. Historyjka → faza

| Historyjka | Faza |
|------------|------|
| A1 Current | 3–5 |
| A2 Today | 1, 3–5 |
| A3 klik Last 100 | 6–7 |
| A4 kolor ostrzegawczy | 5 |
| A5 Refresh | 4–5, 7 |
| A6 komunikat bez tokenu | 2, 5 |
| A7 tooltip plan/cykl | 3, 5 |

---

## 15. Ryzyka w trakcie implementacji

| Ryzyko | Mitygacja w planie |
|--------|-------------------|
| Zablokowany `state.vscdb` na Windows | kopia pliku (faza 2) |
| Brak wasm sql.js w VSIX | copy w esbuild / vsce (faza 0) |
| Zmiana kształtu JSON API | izolacja parse; fixtury; snapshot error |
| Zbyt nowe `engines.vscode` | `^1.85.0`, aż Help → About wskaże inaczej |
| Rate limit | min. 5 min poll; jeden refresh naraz |

---

## 16. Później (nie ten plan)

- **v1.1:** `!` przy spike (domyślnie 1M tokenów), Ignore — [token-spike.pl.md](./token-spike.pl.md); alerty 80/90% wydatków, Copy stats  
- **v1.2:** sidebar, opcjonalny Quick Pick  
- **v2:** Secret Storage, CSV, Open VSX (`publishing.md`)

Dopiero po spełnieniu MVP §13.
