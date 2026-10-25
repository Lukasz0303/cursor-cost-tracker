# Faza 3a — Zapytanie, wiersze, CSV, komunikaty

**Plan nadrzędny:** [openai-codex.pl.md](./openai-codex.pl.md)
**Status:** gotowe do implementacji
**Zależy od:** [phase-2a-store.pl.md](./phase-2a-store.pl.md) (ścieżka odczytu). Fixture importu można wstawić wprost przez `applyBatch`.
**Dalej:** [phase-3b-host.pl.md](./phase-3b-host.pl.md)
**Angielski:** [phase-3a-query.md](./phase-3a-query.md)
**Wydanie:** 1.1.0. Nie podbijać `package.json`.

Gdy ten plik kłóci się z planem nadrzędnym, **wygrywa plan nadrzędny**. Gdy którykolwiek kłóci się z PRD, **wygrywa PRD**.

Jedna wiadomość w Agent. Ruszać tylko ścieżki z §3. Bez edycji webview.

---

## 1. Cel

Zamieniać wiersze magazynu w jedną stronę view-modeli oraz CSV wszystkich pasujących stron. Dodać warianty komunikatów host/webview bez przeciążania cursorowych `refresh` i `exportCsv`.

**Gotowe, gdy:**

- Zakres czasu letniego Warszawy nie gubi ani nie dubluje wiersza (akceptacja 13).
- Dwa modele w jednej grupie renderują `Mixed (2)` (akceptacja 8).
- Dziewięć wycenionych requestów na dziesięć renderuje `9/10 priced` (akceptacja 7, połowa etykiety; ceny mogą być stringami fixture już na wierszu).
- Paginacja keyset zwraca stabilny `nextCursor` i nie powtarza id.
- CSV wszystkich stron zgadza się z przefiltrowanymi sumami SQL, nie ma wierszy grup i poprzedza tytuł zaczynający się od `=`, `+`, `-`, `@` albo tabulacji pojedynczym apostrofem (akceptacja 14 i 15).
- `npm test` jest zielone dla trzech nowych plików testów.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| `extension.ts`, routing panelu | faza 3b |
| HTML / CSS | faza 3c |
| Liczenie ceny z taryfy | faza 4. Ta faza drukuje string kosztu już zapisany albo `—`. |
| Cursorowe `toHistoryRows` | nie edytować |

---

## 3. Pliki

```
src/openaiHistory/historyQuery.ts
src/openaiHistory/historyRows.ts
src/openaiHistory/historyGroups.ts
src/openaiHistory/historyDetails.ts
src/openaiHistory/exportCsv.ts
src/webview/messages.ts
test/openaiHistoryQuery.test.ts
test/openaiHistoryExportCsv.test.ts
test/webviewMessages.test.ts
```

Granice doby idą przez `src/time/`. Importować. Nie przepisywać.

---

## 4. Zapytanie (`historyQuery.ts`)

```typescript
export type CodexQuery = {
  correlationId: string
  filterRevision: number
  from: string | null
  to: string | null
  accountScopeKey: string | null
  model: string | null
  status: RequestStatus | null
  groupBy: 'conversation' | 'none'
  sort: 'time-desc' | 'cost-desc' | 'tokens-desc'
  costBasis: 'estimated-api' | 'reported' | 'api-equivalent'
  cursor: string | null
  limit: number
}

export function parseCodexQuery(input: unknown): CodexQuery | { error: string }
```

Odrzucić limit poza **1–100** (samo obcięcie nie wystarcza: zwrócić `error`). Odrzucić `cursor`, stringi filtra albo id, które zawierają separator ścieżki, komentarz SQL, schemat URL albo wyglądają jak sekret (`sk-`, `Bearer `, string w kształcie JWT). Sam SQL używa wyłącznie parametrów wiązanych.

Kolejność: requesty z `attributes_spend = 1` dla grupowanej rozmowy, potem `source`, konto, model, status, potem półotwarty `[from, to)` na `observed_at`, potem jedna `costBasis`, potem sort i strona keyset.

`from` / `to` to lokalne `YYYY-MM-DD`. Puste znaczy brak granicy. Konwertować przez `src/time/`, żeby doby wiosennego i jesiennego przejścia w Warszawie zostały półotwarte w czasie absolutnym. Lokalny czas, który nie istnieje, nie jest wymyślany. Powtórzona lokalna godzina przy cofnięciu zegara wchodzi raz.

`costBasis` wybiera, która zapisana kolumna pieniędzy jest sortowana i sumowana. Nie dodaje szacunku, kosztu raportowanego i ekwiwalentu API do jednej liczby. Null pieniędzy sortuje się na końcu przy `cost-desc`.

Kursor keyset to nieprzezroczysty string krotki sortowania plus `id`. Następna strona zaczyna się ściśle po tej krotce. Tryb grupowany agreguje w SQL, potem stronuje grupy.

```typescript
export type CodexPage = {
  correlationId: string
  filterRevision: number
  rows: CodexRow[]
  nextCursor: string | null
  totals: CodexTotals
  coverage: CodexCoverage
  lastSyncAt: string | null
}
```

`totals` to agregaty SQL całego filtra, nie strony. `coverage` obejmuje `priced`, `pricedDenom`, `missingUsage`, `missingAccount`, `partial`.

Pochodne wiersze migawek są wyłączone z sum requestów. Gdy rozmowa ma w danym przedziale jakikolwiek request z `attributes_spend = 1`, wiersze migawek z tego przedziału nie dodają tokenów do sum.

---

## 5. Wiersze i grupy

`historyRows.ts` mapuje jeden request na płaski view-model. `historyGroups.ts` mapuje jedną zagregowaną grupę.

Wspólny kształt używany przez webview w fazie 3c:

| Pole | Request | Grupa |
|------|---------|-------|
| `rowKind` | `'request'` | `'group'` |
| `id` | id requestu | `provider + accountScopeKey + conversationId` |
| `timeLabel` | czas obserwacji, lokalnie | `#` + 8 znaków albo zapisany tytuł |
| `timeTitle` | nazwa strefy lokalnej | `4 turns · 28 model requests`, gdy obie liczby istnieją. Brakującą liczbę pominąć. Same migawki: bez wymyślonej liczby requestów. |
| `rangeLabel` | — | `14 Oct 09:07 → 14 Oct 11:02` |
| `modelLabel` | nazwa albo `Unknown` | jeden model albo `Mixed (2)` |
| `modelTitle` | `response` albo `turn context` | — |
| `costLabel` | `Est. $0.16`, `API-equiv. $0.16`, kwota raportowana albo `—` | Tylko jedna podstawa. `9/10 priced`, gdy `priced < pricedDenom`. |
| `tokensLabel` | `I + O` istniejącym formatem tokenów albo `—` | Suma unikalnych przypisanych requestów w filtrze. |
| `spike` | tokeny ≥ argument progu | suma grupy ≥ próg |
| `inputOutputLabel` | `15347 / 185` | Sumy. Sufiks `partial`, gdy któremuś dziecku brakuje usage. |
| `inputOutputTitle` | cached input i reasoning, gdy są | — |
| `kindLabel` | `API`, `ChatGPT plan`, `Unknown` | jeden rodzaj albo `Mixed` |
| `conversationId`, `accountScopeKey` | do rozwinięcia | do rozwinięcia |

`< $0.01`, gdy niezerowy zapisany decimal zaokrągla się do zera na dwóch miejscach. Nie pokazywać wtedy `$0.00`.

`historyDetails.ts` zwraca pola szuflady jako zwykłe stringi: źródło, etykieta urządzenia (`this computer`), zakres, pewność, rozmowa, sesja, tura, id odpowiedzi, jakość usage, I, C, O, R, T, podstawa kosztu, formuła słowami, wersja cennika albo `Price unavailable`, status, kod błędu, czas obserwacji. `started` i `finished` tylko wtedy, gdy kolumny są nie-null. Bez HTML. Bez ścieżki bezwzględnej.

---

## 6. CSV (`exportCsv.ts`)

```typescript
export function buildCodexCsv(rows: readonly CodexCsvSourceRow[]): string
```

Zapytanie przechodzi każdą pasującą stronę. Jeden wiersz wyjścia na request. Bez wierszy grup.

Kropka dziesiętna `.`. Null to pusta komórka. Cytować przecinki i nowe linie. Tytuł zaczynający się od `=`, `+`, `-`, `@` albo tabulacji dostaje wiodący pojedynczy apostrof.

Kolumny, po kolei: `source`, `device_id`, `account_scope`, `account_confidence`, `conversation_id`, `conversation_title`, `turn_id`, `response_id`, `observed_at_utc`, `model`, `model_evidence`, `status`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`, `total_tokens`, `estimated_api_cost_usd`, `reported_cost_usd`, `billing_mode`, `pricing_version`, `usage_quality`, `cost_coverage`.

Bez ścieżki bezwzględnej, bez promptu, bez treści błędu. `error_code` zostaje poza CSV w 1.1.0 (ma go szuflada). Id urządzenia to nieprzezroczyste id instalacji, nie nazwa hosta.

---

## 7. Komunikaty (`src/webview/messages.ts`)

Dodać warianty. Nie zmieniać znaczenia `refresh` ani `exportCsv`.

Webview → host:

| `type` | Payload |
|--------|---------|
| `setQuerySource` | `value: unknown` (host przyjmuje `cursor` \| `codex-local` \| `openai-api`) |
| `setCodexImportEnabled` | `value: unknown` |
| `setCodexHome` | `value: unknown` |
| `setCodexGroupByConversation` | `value: unknown` |
| `codex.refresh` | brak |
| `codex.query` | pola `CodexQuery` |
| `codex.expand` | `conversationId`, `accountScopeKey` |
| `codex.details` | `requestId` |
| `codex.exportCsv` | filtr bez `cursor` / `limit` |
| `codex.forget` | brak |
| `openai.refresh` | brak |
| `codex.analyze` | opcjonalne `requestId`, `conversationId`, `depth` |

Host → webview, jako osobna unia, którą panel już wysyła (dodać warianty obok cursorowego komunikatu `data`, nie dokładać tablicy Codexa do `data`):

| `type` | Payload |
|--------|---------|
| `codex.status` | flaga importu, stan katalogu, flaga partial, liczba nierozpoznanych, liczba sesji, zakres dat, `lastSyncAt`, wersja parsera, lista kont, lista modeli, `remoteWindow`. `resolvedHome` jest tylko dla karty Settings. |
| `codex.result` | `CodexPage` |
| `codex.children` | `conversationId`, `accountScopeKey`, `rows` |
| `codex.detail` | pola szuflady |
| `codex.exportReady` | `{ correlationId, ok }` |
| `operation.error` | `{ correlationId?, message }` ze stałym bezpiecznym zdaniem, nie surowym wyjątkiem |

`parseWebviewMessage` (albo istniejący parser w tym pliku) musi przyjąć nowe typy i odrzucić `codex.query`, które nie przechodzi `parseCodexQuery`.

Settery ustawień mają ten sam kształt co `setHistoryLimit`. Lista operacji w planie nadrzędnym ich nie nazywa; karta Settings nie utrwali stanu bez nich.

---

## 8. Testy

### `test/openaiHistoryQuery.test.ts`

- Zasiać wiersze wokół wiosennego i jesiennego przejścia Europe/Warsaw. `[from, to)` obejmujący każde przejście zwraca każdy wiersz raz.
- Grupa z modelami `a` i `b` → `Mixed (2)`.
- 9 wierszy ze stringiem kosztu i 1 z nullem, podstawa `estimated-api` → etykieta zawiera `9/10 priced`. Suma pieniędzy to suma 9, nie udawana dziesiąta.
- Rozmiar strony 2 na 5 wierszach → kursory nie powtarzają id, a suma zbiorów to pełny zestaw.
- Ten sam tytuł, dwa `account_scope_key` → dwie grupy.
- Filtr `status` i `model` zmienia agregat SQL, nie tylko stronę.

### `test/openaiHistoryExportCsv.test.ts`

- Wszystkie strony zgadzają się z przefiltrowanymi sumami.
- Brak wiersza nagłówka grupy.
- Tytuł `=cmd` staje się `'=cmd`.
- Null usage to pusta komórka.
- String podobny do promptu nie jest kolumną i nie występuje w CSV.

### `test/webviewMessages.test.ts`

- `codex.query` z `limit: 0` i `limit: 500` jest odrzucone.
- `codex.query`, którego `accountScopeKey` zawiera `../` albo `sk-`, jest odrzucone.
- Cursorowe `refresh` nadal parsuje się jako refresh, nie jako `codex.refresh`.

---

## 9. Przekazanie

Faza 3b routuje te komunikaty. Nie przebudowuje SQL.
