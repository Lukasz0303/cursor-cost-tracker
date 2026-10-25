# Faza 3c — Webview zapytań

**Plan nadrzędny:** [openai-codex.pl.md](./openai-codex.pl.md) §3 i §4
**Status:** gotowe do implementacji
**Zależy od:** [phase-3b-host.pl.md](./phase-3b-host.pl.md)
**Dalej:** [phase-3d-stats.pl.md](./phase-3d-stats.pl.md)
**Angielski:** [phase-3c-webview.md](./phase-3c-webview.md)
**Wydanie:** 1.1.0. Nie podbijać `package.json`.

Gdy ten plik kłóci się z planem nadrzędnym, **wygrywa plan nadrzędny**. Gdy którykolwiek kłóci się z PRD, **wygrywa PRD**.

Jedna wiadomość w Agent. Ruszać tylko ścieżki z §3. Napisy UI w tej fazie to angielski i polski. Pozostałe katalogi to następna wiadomość po fazie 3d.

---

## 1. Cel

Panel historii pokazuje przełącznik źródła, a dla Codexa pasek pokrycia, pasek narzędzi, tabelę grup, leniwe dzieci, szufladę i kartę Settings. Wiersze Cursora nadal malują się z `data.events`.

**Gotowe, gdy:**

- Przełącznik, pasek, grupy, leniwe dzieci, szuflada, filtry, stany puste, przycisk CSV i dwuetapowe kasowanie działają na komunikatach hosta z fazy 3b.
- OpenAI API pokazuje zdanie o braku połączenia i nie pokazuje sum Cursora.
- Support i Settings chowają przełącznik.
- `npm run build` regeneruje `media/history.js`. Nie edytować ręcznie `media/history.js` ani `media/history.css`.
- Last N Cursora nadal się renderuje, gdy `querySource` to `cursor`.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| Treści Statistics, Charts i Optimize dla Codexa | faza 3d. Przełącznik jest widoczny na tych zakładkach i wysyła `setQuerySource`, ale te zakładki do 3d zostają przy sekcjach Cursora. |
| Żywa taryfa | faza 4. Komórki kosztu już pokazują `—` albo zapisaną etykietę. |
| Więcej katalogów niż `en` i `pl` | następna wiadomość |
| Ręczna edycja wyjść builda | nigdy |

`media/src/tabs/settings.js` jest w tej fazie, choć krótka lista plików planu nadrzędnego go pominęła. Karta Codexa nie może żyć w `queries.js`.

---

## 3. Pliki

```
media/history.html
media/src/messages.js
media/src/tabs/queries.js
media/src/tabs/settings.js
media/css/queries.css
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
```

`queries.css` tylko dla przełącznika, paska, przyklejonej pierwszej kolumny i szuflady. Wyłącznie tokeny motywu (`--vscode-*`). Pigułki ghost, nie `--vscode-button-background`.

Po edycjach raz uruchomić `npm run build`.

---

## 4. Przełącznik źródła

Pod paskiem zakładek, na pełną szerokość, na Last N, Statistics, Charts i Optimize. Ukryty na Support i Settings. Trzy pigułki ghost, `aria-pressed`.

```
Source   ( Cursor )  ( Codex local )  ( OpenAI API )
```

Etykieta zakładki idzie za źródłem: `Last N Cursor queries`, `Codex queries` albo `OpenAI API`.

Klik wysyła `{ type: 'setQuerySource', value }`. Nie wysyła cursorowego `refresh`. Refresh na pasku wysyła `refresh` na Cursorze, `codex.refresh` na Codexie, `openai.refresh` na OpenAI API.

Treść OpenAI oraz stan pusty, gdy Statistics albo Charts nadal są widoczne przy tym źródle: `OpenAI API recorder is not connected. This extension does not see other programs’ calls to OpenAI.` Nie używać sum Cursora jako zastępnika.

---

## 5. Pasek pokrycia

Jedna linia monospace pod przełącznikiem. Sam tekst. Wygrywa najcięższy stan. Nie drukować `resolvedHome` na tej linii.

| Stan | Linia |
|------|-------|
| Import wyłączony, sesje znalezione | `Codex sessions found on this computer. Turn on import in Settings.` Do zamknięcia na czas sesji webview. |
| Import wyłączony, nic nie znaleziono | ukryty |
| Import włączony, brak katalogu | `Codex home not found` |
| Import włączony, katalog pusty | `No local Codex history found` |
| Częściowe pokrycie parsera | `Partial history · N unrecognized lines` |
| Brak id konta | `account unknown` wewnątrz zwykłej linii. Nie kolor błędu. |
| Ostatni reskan nieudany | `Sync failed · showing data from 18:02`. Zostawić poprzednie wiersze. |
| `remoteWindow` | prefiks `This computer (not the SSH host) ·` |

Zwykła linia: `Local history · this computer · account unknown · 12 sessions · 7 Oct – 14 Oct · last sync 18:12`.

Odrzucić `codex.result`, którego `correlationId` albo `filterRevision` jest starsze niż ostatnio wysłane zapytanie.

---

## 6. Pasek narzędzi i tabela

Kontrolki z planu nadrzędnego §4.3: Over Warn at (filtr klienta po `spike`), Optimized (dopasowanie wyłączone — do fazy 7 nic nie pasuje; cache hit nie jest optimized), Group by conversation (wysyła `setCodexGroupByConversation`, nie zapisuje `groupQueriesByConversation`), Export CSV (`codex.exportCsv`), presety dat Last 7 days / This month / All imported / Custom, konto, model, status, sort.

Własne From/To to lokalne `YYYY-MM-DD`, stosowane na Apply / Enter / blur. Nie czytają ani nie zapisują `cursorCost.historyFromDate`. Pusty własny zakres znaczy cały import.

Tabela Codexa pomija CONTEXT. Poziomy scroll, przyklejona pierwsza kolumna, liczby monospace. Chevron grupy to przycisk z `aria-expanded`. Rozwinięcie wysyła `{ type: 'codex.expand', conversationId, accountScopeKey }`. Rozwijanie Cursora zostaje oparte o indeks i nie wysyła `codex.expand`.

Rozmiar strony 100. Dociągnij więcej wysyła `nextCursor`.

Klik wiersza requestu otwiera szufladę pod tabelą. Przypisanie wyłącznie przez `textContent`. Enter na wierszu otwiera szufladę. Escape ją zamyka. Copy details kopiuje te same pola czystego tekstu.

Play w komórce TOKENS wysyła `codex.analyze` dla tego wiersza. Nie wysyła `optimizeConversation`.

---

## 7. Karta Settings

W `media/src/tabs/settings.js` fieldset **Codex** po Recent queries i przed Refresh.

| Kontrolka | Komunikat |
|-----------|-----------|
| Import lokalnych sesji Codexa | `setCodexImportEnabled` |
| Katalog Codexa | `setCodexHome` na Apply / Enter / blur |
| Grupuj Codex po wątku | `setCodexGroupByConversation` |
| Źródło zapytań | `setQuerySource` |

Linie tylko do odczytu z `codex.status`: rozwiązany katalog (`resolvedHome`), ten komputer, liczba sesji, zakres dat, ostatni skan, wersja parsera, liczba nierozpoznanych linii.

Przycisk Rescan wysyła `codex.refresh`. Delete czyta `Delete imported Codex data`. Pierwszy klik zmienia etykietę na `Delete imported Codex data — confirm`. Drugi klik wysyła `codex.forget` i przywraca etykietę. Każdy inny klik w karcie przywraca etykietę. Nie ma modala `window.confirm`.

---

## 8. Katalogi

Dodać klucze tylko do `en.ts` i `pl.ts`. Polskie napisy dla zdań z §4–§7. Zdania angielskie w `en.ts` zostawić identyczne z planem nadrzędnym, żeby testy i zrzuty się zgadzały.

---

## 9. Sprawdzenia

Raz `npm run build`. Raz `npm test`, jeśli test fixture komunikatów już importuje katalogi; nie dodawać harnessu przeglądarki.

Czego ta faza tu nie sprawdzi: układu pikseli wewnątrz Cursora. Implementujący sprawdza przełącznik, rozwinięcie grupy, Escape na szufladzie i to, że komunikat `data` Cursora nadal wypełnia tabelę, gdy pigułka źródła to Cursor.

---

## 10. Przekazanie

Faza 3d podmienia treści Statistics, Charts i Optimize, gdy źródłem jest Codex. Przełącznik z tej fazy zostaje.
