# Faza 3b — Podłączenie hosta

**Plan nadrzędny:** [openai-codex.pl.md](./openai-codex.pl.md)
**Status:** gotowe do implementacji
**Zależy od:** [phase-2b-import.pl.md](./phase-2b-import.pl.md), [phase-3a-query.pl.md](./phase-3a-query.pl.md)
**Dalej:** [phase-3c-webview.pl.md](./phase-3c-webview.pl.md)
**Angielski:** [phase-3b-host.md](./phase-3b-host.md)
**Wydanie:** 1.1.0. Nie podbijać wersji. Zmiany w `package.json` to wyłącznie klucze konfiguracji.

Gdy ten plik kłóci się z planem nadrzędnym, **wygrywa plan nadrzędny**. Gdy którykolwiek kłóci się z PRD, **wygrywa PRD**.

Jedna wiadomość w Agent. Ruszać tylko ścieżki z §3.

---

## 1. Cel

Zarejestrować serwis historii Codexa obok `UsageService`. Uruchamiać go tylko wtedy, gdy import jest włączony. `activate()` nie czeka na import. Publikacja Cursora zostaje na zdarzeniach Cursora.

**Gotowe, gdy:**

- Przy wyłączonym imporcie aktywacja nie czyta treści rolloutów (dubler testowy albo strażnik wywołania).
- Przy włączonym imporcie `void service.start()` nie jest awaited.
- `cursorCost.showHistory` z Current, Today albo chipa ostatniego zapytania zapisuje `cursorCost.querySource` z powrotem jako `cursor`, a panel nadal dostaje cursorowy payload `data`.
- Polecenie historii bez chipa używa zapisanego `querySource`.
- `codex.forget` kasuje wyłącznie wiersze wtyczki i tylko po tym, jak webview je wyśle (dwuklik potwierdzenia to faza 3c).
- Otwarcie panelu na Codexie nie woła API usage Cursora.
- Brak nowego blokującego modala. Critical alert nadal patrzy tylko na zapytania Cursora.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| Markup przełącznika źródła | faza 3c |
| Treść wklejki Statistics / Optimize | faza 3d wypełnia brief. Ta faza routuje `codex.analyze` i **nie** woła `composer.openComposer`. |
| Pozostałe katalogi locale | wiadomość po 3d |
| VSIX | osobna wiadomość |

---

## 3. Pliki

```
src/extension.ts
src/ui/historyPanel.ts
src/config.ts
package.json
```

Dodać właściwości konfiguracji. Nie dodawać wpisu `contributes.commands`. `codex.exportCsv` i `codex.refresh` to komunikaty webview, nie id poleceń.

---

## 4. Ustawienia (`package.json`, `src/config.ts`)

| Klucz | Typ | Domyślnie |
|-------|-----|-----------|
| `cursorCost.codexImportEnabled` | boolean | `false` |
| `cursorCost.codexHome` | string | `""` |
| `cursorCost.codexGroupByConversation` | boolean | `true` |
| `cursorCost.querySource` | enum `cursor` \| `codex-local` \| `openai-api` | `cursor` |

`config.ts` czyta je tym samym stylem obcięcia co istniejące klucze. `codexHome` wraca jako string. Nie kanonizować go tutaj; robi to `resolveCodexRoot`.

`deviceId` nie jest ustawieniem. Przy pierwszej potrzebie zapisać `cursorCost.codexDeviceId` w `globalState` (losowy UUID). Nigdy go nie nadpisywać.

Adapter lease: `LeaseStore` nad kluczem `globalState` `cursorCost.codexImportLease`.

Ścieżka magazynu: `context.globalStorageUri` + `openai-request-history.sqlite`.

`extensionKind` zostaje `ui`. Serwis rozwiązuje katalog na hoście UI. Okno Remote SSH nie skanuje hosta SSH. `codex.status.remoteWindow` jest true, gdy ustawione jest `vscode.env.remoteName`. Tekst prefiksu to faza 3c.

---

## 5. Aktywacja (`src/extension.ts`)

Obok istniejącego `UsageService`:

1. Zbudować `HistoryService` z flagą importu, resolwerem katalogu, magazynem i lease.
2. Gdy `codexImportEnabled` jest true, wołać `void history.start()`. Nie `await`.
3. Przy zmianie konfiguracji czterech kluczy zaktualizować serwis. Wyłączenie importu woła `stop()` (brak watchera, brak odczytu treści). Włączenie woła ponownie `void start()`.
4. Zdisposować serwis razem z wtyczką.

Polling Cursora, pasek statusu, burn rate i critical alert zostają przy obecnych konstruktorach. Nie podawać im wierszy Codexa.

---

## 6. Routing panelu (`src/ui/historyPanel.ts`)

| Komunikat | Zachowanie |
|-----------|------------|
| `setQuerySource` | Utrwalić enum. Wysłać `codex.status`, gdy wartość nie jest `cursor`. Nie wołać cursorowego `refresh`. |
| `setCodexImportEnabled` / `setCodexHome` / `setCodexGroupByConversation` | `workspace.getConfiguration('cursorCost').update` na celu globalnym. |
| `codex.refresh` | `void history.refresh()`. |
| `codex.query` | Wykonać zapytanie fazy 3a. Wysłać `codex.result`. Przy porażce wysłać `operation.error` stałym zdaniem i nie wysyłać poprzedniego wyniku (webview i tak trzyma ostatnią dobrą stronę). |
| `codex.expand` | Dzieci tej rozmowy i zakresu. Wysłać `codex.children`. Rozwijanie Cursora zostaje oparte o indeks i nie może wejść w tę gałąź. |
| `codex.details` | Wysłać `codex.detail`. |
| `codex.exportCsv` | Zbudować CSV wszystkich pasujących stron, zapisać tą samą ścieżką dialogu co CSV Cursora, wysłać `codex.exportReady`. |
| `codex.forget` | Skasować wiersze wyłącznie w sqlite wtyczki. Nie ruszać `~/.codex` ani `state.vscdb`. Potem wysłać świeży `codex.status`. |
| `openai.refresh` | Nie wysyłać pustego `codex.status`. Nie wysyłać `operation.error`. Dla OpenAI wysłać `{ type: 'openai.status', state: 'not-connected' }`. Ten jeden wariant dopisać tutaj w `src/webview/messages.ts`, jeśli faza 3a go nie ma — to jedyna dodatkowa ścieżka, której ta faza potrzebuje, bo host nie odpowie na `openai.refresh` bez niej. |
| `codex.analyze` | Nie wołać `composer.openComposer`. Nie wysyłać czatu. Faza 3d podmienia treść handlera na wklejkę briefu rozliczeniowego. Do tego czasu wysłać `operation.error` stałym zdaniem „not available yet”, żeby przycisk nie otworzył composera przez wpadnięcie w `optimizeConversation`. |
| `refresh` / `exportCsv` | Bez zmian, zachowanie Cursora. |

Gdy pasek statusu otwiera panel (`showHistory` z Current, Today albo chipa zapytania), zapisać `querySource` jako `cursor` przed pokazaniem. Wpis historii z palety poleceń nie nadpisuje zapisanego źródła.

`codex.status.resolvedHome` można wysłać dla karty Settings. Nie umieszczać tego stringa na wierszach `codex.result`.

---

## 7. Sprawdzenia

Nowy plik Vitest nie jest wymagany, jeśli `extension.ts` nie daje się zaimportować bez `vscode`. Dodać `test/codexConfig.test.ts` **tylko** wtedy, gdy `config.ts` jest już testowane bez `vscode`; inaczej trzymać odczyty przy istniejących testach konfiguracji i nie tworzyć testu integracyjnego vscode.

Notatka ręczna na turę wydania, nie na tę turę: aktywacja przy wyłączonym imporcie nie otwiera `~/.codex/sessions/**`.

`npm test` i `typecheck` raz na końcu tej fazy.

---

## 8. Bezpieczeństwo

`codex.forget` to jedyne kasowanie. Odmawia działania, dopóki typ komunikatu nie jest dokładnie `codex.forget` (krok potwierdzenia to stan UI w fazie 3c). Logi nie drukują katalogu Codexa, id urządzenia ani SQL.

---

## 9. Przekazanie

Faza 3c maluje przełącznik, pasek, tabelę i kartę Settings z tych komunikatów. Cursorowe `data.events` zostaje źródłem tabeli Cursora.
