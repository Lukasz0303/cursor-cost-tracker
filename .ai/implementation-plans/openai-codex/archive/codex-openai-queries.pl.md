# Plan implementacji — lokalna historia Codexa i requesty OpenAI

**Tło.** Implementować z [openai-codex.md](../openai-codex.md) · [polski](../openai-codex.pl.md).
Półka: [README.pl.md](../README.pl.md).

**Wersja polska tego wejścia.** Kanoniczna angielska: [codex-openai-queries.md](./codex-openai-queries.md)
**Status:** zastąpiony jako samodzielny plan. Zostaje jako wejście podsumowania.
**Specyfikacja:** [cursor-cost-tracker-openai-requests-spec.md](../../../reports/cursor-cost-tracker-openai-requests-spec.md) (2026-10-07).
**Zależy od:** obecnego potoku Cursora (`UsageService` → `toHistoryRows` → `media/src/tabs/queries.js`). Tego potoku nie przepisujemy.
**Wersja paczki:** **1.1.0** MINOR dla faz 1–4 (lokalny Codex, tabela, tokeny, nieznany koszt, CSV). Fazy 5–7 to kolejne MINOR-y. W turze fazy nie podbijać `package.json`.
**Baza wyjściowa:** **1.0.7**.

Gdy ten plik i [prd.md](../../../context/prd.md) się różnią, **wygrywa PRD**. Funkcja nie zmienia rozliczenia Cursora, jedynego blokującego modala critical alert ani ukrytej zakładki Leaderboard.

Jedna faza na jedną wiadomość w Agent. Faza wymienia co najwyżej ścieżki podane pod tą fazą.

---

## 1. Cel

Pokazać sesje **Codexa — agenta kodującego OpenAI**, które już leżą na tym komputerze, w tym samym panelu co zapytania Cursora, bez udawania, że to zużycie Cursora.

Użytkownik otwiera panel historii, przełącza źródło z **Cursor** na **Codex local** i widzi rozmowy z plików rollout w `~/.codex`: tytuł, liczbę tur, liczbę wywołań modelu, model, tokeny, input/output, rodzaj rozliczenia oraz koszt tylko wtedy, gdy znamy taryfę. Rozwinięcie rozmowy pokazuje rozpoznane wywołania. Statistics, Charts i Optimize liczą wybrane źródło. **OpenAI API** to drugie źródło: wywołania, które aplikacja sama zarejestrowała. Usage i Costs API organizacji to osobne porównanie, nigdy wiersz w tabeli requestów.

**1.1.0 jest gotowe, gdy:**

- Ten sam rollout zaimportowany drugi raz nie zwiększa liczby requestów ani kosztu.
- Requestem jest `token_usage_record.payload.usage`. `turn_token_usage`, `thread_token_usage` oraz `event_msg` / `token_count` nie są doliczane drugi raz.
- Brak ceny albo usage wygląda jak `—`, a nie jak `$0.00` albo `0` tokenów.
- Last N, pasek statusu, burn rate, prognoza miesiąca i CSV Cursora dalej biorą wyłącznie zdarzenia Cursora.
- Do webview, CSV, logów i ustawień nie trafia plik auth Codexa, klucz API, prompt ani wynik narzędzia.

---

## 2. Czego chce specyfikacja, a co jest w kodzie

Drzewo ze specyfikacji (`src/providers/…`, `src/webview/openaiHistoryView.ts`) w tym repozytorium nie istnieje. Jest jeden webview (`media/history.html`, wejście `media/src/main.js`) i jedna próbka Cursora w pamięci. Funkcję dopasowujemy do tego kształtu.

| Potrzeba ze specyfikacji | Kod dziś | Decyzja |
|---|---|---|
| Przełącznik Cursor / Codex / OpenAI API | Jedna tabela z `UsageQuery[]` | Dodać przełącznik. Cursor zostaje przy obecnym payloadzie. Codex i OpenAI API dostają nowy. |
| Grupy rozmów ze rozwijaniem | `src/ui/queryGroups.ts` grupuje **już załadowaną** próbkę po **znormalizowanym tytule**. Rozwinięcie używa `rowIndexes` w webview. | Zostawić to dla Cursora. Codex grupuje po `(source, accountScope, conversationId)` i dociąga dzieci z bazy przy rozwinięciu. |
| Usage na request, cache jako podzbiór, reasoning jako podzbiór | `UsageQuery.tokens` i `queryListPrice`, które **dodają** cache read i cache write do inputu i outputu | Nowy normalizator. Suma Codexa to `input + output`. Cache jest częścią inputu. Reasoning jest częścią outputu. Nie wołać `queryListPrice`. |
| Nieznane a zero | `costUsd: number` — `0` w Cursorze bywa prawdziwym zerem planu | Pieniądze i tokeny Codexa to `number \| null`. `null` znaczy „nie wiemy”. |
| Lokalne SQLite dla dużej historii | sql.js / `node:sqlite` tylko **czytają** `state.vscdb` Cursora. Stan trackera to `globalState` i pamięć. | Nowy plik bazy w global storage rozszerzenia. Nie zapisujemy `~/.codex` ani `state.vscdb`. |
| Przyrostowy import JSONL | Brak watchera na Codexie | Nowy importer. `activate()` tylko go planuje. |
| Cennik | `src/pricing/` to publiczny katalog Cursora | Osobna taryfa Codexa. Bez automatycznego mapowania nazwy modelu Codexa na model API. |
| Przycisk play przy Optimize | `composer.openComposer` z **id rozmowy Cursora**, potem wklejenie | Play Codexa otwiera analizę tego wiersza. Nie otwiera composera Cursora z id wątku Codexa i nie uruchamia płatnego powtórzenia. |
| Usage organizacji a wiersze lokalne | Podsumowanie Cursora to plan Cursora | Późniejsza faza. Nigdy nie wchodzi do `usedUsd`, prognozy MTD ani kolumny kosztu requestu. |
| CSV | `buildQueriesCsv` w `src/ui/exportCsv.ts` | Nowy builder. Eksport Cursora bez zmian. |
| Konto | E-mail Cursora z API usage | Konto Codexa zostaje nieznane, dopóki metadane rolloutu nie podadzą id. Nie czytać plików auth. Nie przepisywać e-maila Cursora na wiersze Codexa. |

---

## 3. Ustalenia produktowe

1. **Pierwsze wydanie to lokalny Codex.** Rejestrator OpenAI API i raporty organizacji przychodzą później. Chip OpenAI API jest widoczny w 1.1.0 i mówi, że nic nie jest podłączone.
2. **Import domyślnie wyłączony** (`cursorCost.codexImportEnabled` = false). Skan `~/.codex` jest świadomy. Gdy `sessions/` istnieje, a import jest wyłączony, pasek zapytań pokazuje jedną zamykalną linijkę: „Na tym komputerze są sesje Codexa.” Włączenie to przełącznik w Settings, nie modal.
3. **Pasek statusu zostaje cursorowy.** Current, Today, chipy zapytań, kolor burn i modal critical czytają tylko `UsageSnapshot`. W 1.1.0 Codex nie dostaje chipa na pasku.
4. **Bez nowej zakładki i bez Reacta.** Support i Settings ignorują przełącznik źródła. Leaderboard zostaje ukryty i nie jest rankingiem Codexa.
5. **Jedyny blokujący modal** to critical alert ostatniego zapytania Cursora. Usunięcie zaimportowanych danych to dwukrok w Settings, nie `showWarningMessage`.
6. **`extensionKind` to `ui`.** Importer czyta komputer, na którym działa rozszerzenie UI. Pasek pokrycia to mówi wprost. Okno Remote SSH nie widzi samo z siebie plików Codexa na hoście SSH.
7. **Tytuł to metadane, nie prompt.** Gdy późniejszy adapter ma tytuł wątku, używamy go. Tekstu pierwszej wiadomości użytkownika w 1.1.0 nie zapisujemy; fallback to `#` i 8 znaków `thread_id`. Bloki instrukcji środowiska nie są tytułem.
8. **Etykieta grupy** to `4 turns · 28 model requests`, a nie `4 requests`, gdy znamy obie liczby. Pliki złożone wyłącznie ze snapshotów nie wymyślają liczby requestów.
9. **Koszty różnego rodzaju nie wchodzą do jednej sumy.** Szacunek API, koszt raportowany przez organizację i ekwiwalent API planu ChatGPT stoją obok siebie.
10. **Fork:** skopiowany `responseId` zostaje jednym requestem globalnie. Rozmowa potomna może do niego linkować. Jej własny wydatek liczy tylko odpowiedzi, które pojawiły się najpierw na tym dziecku.

---

## 4. Poza 1.1.0

| Element | Kiedy |
|---|---|
| Wrapper zapisujący wywołania OpenAI innej aplikacji | Faza 5 |
| `GET /v1/organization/usage/completions` i Costs API | Faza 6 |
| Codex app-server `thread/list` (tytuły, zdarzenia na żywo) | Po 1.1.0, opcjonalnie. Podstawą backfillu zostają pliki. |
| Backfill zapisanych Chat Completions | Nieplanowane |
| Osobista historia strony ChatGPT | Brak źródła. Nie obiecywać. |
| Przechwyt TLS, ciasteczko logowania Codexa, auth.json | Nigdy |
| Wiersze Codexa na pasku, w burn rate albo w prognozie miesiąca Cursora | Nie w 1.1.0 |
| Łączenie dwóch wątków Codexa, bo mają ten sam tytuł | Nigdy. Ta reguła jest tylko dla Cursora (`titleGroupKey`). |
| Benchmark 100 tys. wierszy jako warunek merge | Cel fazy 7. 1.1.0 ma paginować, nie rysować całej tabeli. |

---

## 5. Jak i gdzie to wygląda

Panel to istniejący `WebviewPanel` `cursorCost.history`. HTML: `media/history.html`. Zachowanie: `media/src/` (po edycji `npm run build` odtwarza `media/history.js`). `media/history.js` nie edytować ręcznie.

### 5.1 Przełącznik źródła

Segmented control **pod paskiem zakładek**, na szerokość panelu. Widoczny tylko na **Last N**, **Statistics**, **Charts** i **Optimize**. Ukryty na Support i Settings.

```
[ Last 1000 Cursor queries ] [ Statistics ] [ Charts ] [ Optimize ] [ Support ] [ Settings ]

Źródło   ( Cursor )  ( Codex local )  ( OpenAI API )
```

- Pigułki w tej samej rodzinie co obecne przełączniki. Nie `vscode-button-background`.
- Domyślnie **Cursor**. Zapis w `cursorCost.querySource` (`cursor` | `codex-local` | `openai-api`).
- Etykieta zakładki zapytań jedzie za źródłem: `Last N Cursor queries`, `Codex queries` albo `OpenAI API`.
- W 1.1.0 **OpenAI API** da się wybrać. Treść to stan pusty z §5.6, nie udawana tabela.

Zmiana źródła przerysowuje widok z danych, które host już ma, albo z nowego `codex.result`. Nie woła API usage Cursora. **Refresh** na Cursorze dalej wysyła `{ type: 'refresh' }`. Na Codexie wysyła `{ type: 'codex.refresh' }` (ponowny skan). Na OpenAI API wysyła `{ type: 'openai.refresh' }` i do fazy 5 wraca stan „niepodłączone”.

### 5.2 Pasek pokrycia (tylko Codex local)

Tuż pod przełącznikiem, jedna linia monospace, sam tekst:

`Local history · this computer · account unknown · 12 sessions · 7 Oct – 14 Oct · last sync 18:12`

Warianty, jeden naraz, wygrywa najpoważniejszy:

| Stan | Linia |
|---|---|
| Import wyłączony, sesje są | `Codex sessions found on this computer. Turn on import in Settings.` |
| Import wyłączony, nic nie ma | ukryty |
| Import włączony, brak katalogu | `Codex home not found · <ścieżka>` |
| Import włączony, katalog pusty | `No local Codex history found` |
| Parser nie pokrył części linii | `Partial history · N unrecognized lines` |
| W plikach nie ma id konta | `account unknown` (to norma, nie kolor błędu) |
| Ostatni skan się nie udał | `Sync failed · showing data from 18:02` i zostają poprzednie wiersze |
| Okno zdalne | prefiks `This computer (not the SSH host) ·` |

Ścieżkę pokazujemy, bo użytkownik ją ustawił. Znaki HTML ze ścieżki są escapowane.

### 5.3 Pasek narzędzi zapytań przy Codexie

Zostaje rząd `view-actions`. Zmienia się znaczenie kontrolek:

| Kontrolka | Zachowanie dla Codexa |
|---|---|
| Over Warn at | Filtr wierszy, których tokeny **requestu** albo **suma grupy** są ≥ `cursorCost.spikeTokenThreshold`. `!` używa tego samego progu co Cursor. **Modal** critical dla Codexa się nie otwiera. |
| Optimized | Wiersze z zapisanym id analizy Codexa. Sam cache hit nie jest „optimized”. |
| Group by conversation | Osobne ustawienie `cursorCost.codexGroupByConversation`, domyślnie **włączone**. Wyłączone = płaska lista wywołań modelu, od najnowszych. Nie zapisuje `cursorCost.groupQueriesByConversation`. |
| Export CSV | `{ type: 'codex.exportCsv' }`. Płaskie requesty dla aktywnych filtrów, wszystkie strony. |

Drugi rząd filtrów, tylko Codex, pod `view-actions`:

`From` `To` (lokalne `YYYY-MM-DD`, przedział `[from, to)`), `Account` (All / Unknown / wykryty scope), `Model`, `Status` (completed, failed, cancelled, incomplete, unknown).

Daty zapisują się na Apply / Enter / blur, z tego samego powodu co Show last: niepełne wpisywanie nie może odpalać zapytania. Puste From i To znaczą zaimportowany zakres, nie 1 września 2026 i nie okno `historyFromDate` Cursora. From–To Cursora zostaje tylko przy próbce Cursora.

### 5.4 Tabela

Ta sama szeroka skorupa: `.table-wrap`, poziomy scroll, przyklejona pierwsza kolumna, liczby monospace, tylko tokeny motywu.

**Kolumny Cursora bez zmian:** TIME, MODEL, CONTEXT, COST, TOKENS, INPUT / OUTPUT, KIND.

**Kolumny Codexa** (bez CONTEXT — nie ma licznika okna composera Cursora):

| Kolumna | Pojedynczy request | Grupa rozmowy |
|---|---|---|
| (chevron) | brak | przycisk, `aria-expanded`, na lewo od TIME |
| TIME | czas obserwacji, lokalnie; strefa w tooltipie; id w szczegółach | tytuł albo `#abcd1234`; druga linia `4 turns · 28 model requests`; trzecia `14 Oct 09:07 → 14 Oct 11:02` |
| MODEL | nazwa albo `Unknown`. Tooltip: `response` albo `turn context` | jeden model albo `Mixed (2)` |
| COST | `Est. $0.16`, `API-equiv. $0.16`, kwota raportowana albo `—`. Tooltip nazywa podstawę. `< $0.01`, gdy wartość jest niezerowa, a po dwóch miejscach znika. | Suma **jednej** podstawy. Gdy wyceniono 9 z 10: `$1.20 · 9/10 priced`. Suma nie może wyglądać na kompletną, gdy nie jest. |
| TOKENS | `I + O`. `!`, gdy próg Warn at przekroczony i ostrzeżenia są włączone. | Suma unikalnych requestów w filtrze. Play siedzi w tej komórce. |
| INPUT / OUTPUT | `15347 / 185`. Tooltip: cache inputu i reasoning. | Sumy. `partial`, gdy któremuś dziecku brakuje usage. |
| KIND | `API`, `ChatGPT plan`, `Unknown` | jeden rodzaj albo `Mixed` |

Tło grupy używa obecnego stylu wiersza zgrupowanego. Dzieci są wcięte o jeden poziom i mają cichsze tło. Dzieci nie wchodzą w pierwszy paint: chevron wysyła `{ type: 'codex.expand', conversationId, accountScopeId }`, host zwraca stronę. Rozwijanie Cursora zostaje na indeksach w `queries.js` i nie woła `codex.expand`.

Sortowanie: domyślnie czas malejąco. Sort po koszcie i tokenach robi host (`time-desc` | `cost-desc` | `tokens-desc`), żeby webview nie sortował 100 tys. rekordów. Strona ma 100 wierszy. Stopka `Load more` używa `nextCursor`. Cały wynik nie jedzie w cursorskim `{ type: 'data' }`.

### 5.5 Szczegóły requestu

Klik w wiersz requestu Codexa otwiera **szufladę pod tabelą** (nie modal VS Code, nie nowy edytor). Treść to tekst:

- Źródło `Codex local`, etykieta urządzenia, scope konta, pewność (`unknown` / `reported by file` / `assigned by you`)
- Rozmowa, sesja, tura, response id
- Jakość usage i liczby: input, cached input, output, reasoning, total
- Podstawa kosztu, formuła słownie (`uncached input × rate + cached input × cached rate + output × output rate`), wersja taryfy, albo `Price unavailable`
- Status, sam kod błędu (bez HTML i bez stacka z logu)
- Czas obserwacji. Start i koniec tylko wtedy, gdy plik je ma. `observedAt` nie jest podpisywany jako start.
- Kopiuj szczegóły (czysty tekst, te same pola)

Klawiatura: Enter na wierszu otwiera szufladę, Escape ją zamyka. Chevron jest osobnym przyciskiem, więc Enter nie rozwija przy okazji grupy.

### 5.6 Stany puste i częściowe

W `#empty` albo na pasku pokrycia. Zastępują ciało tabeli tylko wtedy, gdy nie ma wierszy.

- `No local Codex history found` — katalog da się czytać, sesji zero.
- `Partial history` — nieznane typy linii, dziury albo samo usage ze snapshotów. Tabela może pokazać wiersze `derived` i nie nazywa ich wywołaniami modelu.
- `Account unknown` — import działa. To nie blokada.
- `Price unavailable` — tokeny są, `estimatedApiCostUsd` jest null. Kolumna COST: `—`.
- `Sync failed · showing data from …` — wiersze zostają.
- `No matching requests` — filtry wycięły wszystko. Pasek pokrycia zostaje.
- OpenAI API przed fazą 5: `OpenAI API recorder is not connected. This extension does not see other programs’ calls to OpenAI.`

Brakujące liczby zostają puste. Nie zamieniamy ich na zero.

### 5.7 Settings

Nowa karta **Codex** w `#settingsView`, po **Recent queries**, przed **Refresh** (fieldset `settings.recentQueries` w `media/history.html`).

| Pole | Klucz | Domyślnie | Uwagi |
|---|---|---|---|
| Import local Codex sessions | `cursorCost.codexImportEnabled` | false | Wyłączone = brak watchera. |
| Codex home | `cursorCost.codexHome` | `""` | Puste: `CODEX_HOME`, potem `~/.codex`. |
| Group Codex by thread | `cursorCost.codexGroupByConversation` | true | Niezależne od grupowania tytułów Cursora. |
| Query source | `cursorCost.querySource` | `cursor` | Zapisuje je też segmented control. |

Linie tylko do odczytu: rozwiązany katalog, „ten komputer”, liczba sesji, zakres dat, ostatni skan, wersja parsera, liczba nierozpoznanych linii.

Przyciski: **Rescan** (`codex.refresh`), **Delete imported data** (dwa kroki: przycisk zmienia się w „Delete imported Codex data — confirm”, drugie kliknięcie wysyła `codex.forget`). Usunięcie wierszy trackera nie kasuje `~/.codex`.

Klucz administracyjny OpenAI **nie jest** polem 1.1.0. Faza 6 trzyma go w `context.secrets`, nigdy w `settings.json` i nigdy w webview.

### 5.8 Statistics, Charts, Optimize po zmianie źródła

**Wybrany Cursor:** obecne sekcje bez zmian. Host dalej wysyła `stats`, `charts`, `mtd`, `burnRate`, `codeLines`, `optimize` z próbki Cursora.

**Wybrany Codex local:**

- Statistics chowa liczniki planu Current/Today, kartę burn rate, kartę generated lines i prognozę **planu** na miesiąc. To rozliczenie Cursora.
- Statistics pokazuje cztery karty: miks tokenów (input, cached input, output, reasoning), liczniki (wywołania modelu, tury, rozmowy), udział wycenionych (`26/28`) oraz dwie karty kosztu obok siebie (szacunek API, ekwiwalent API). Trzecia karta pojawia się tylko, gdy istnieje koszt raportowany. Żadna karta ich nie dodaje.
- Cache hit to `sum(cached input) / sum(input)` na wierszach, gdzie obie wartości są niepuste. To nie średnia procentów z wierszy.
- Charts używają tych samych dziennych słupków SVG z serią Codexa: tokeny na lokalny dzień, szacowany koszt na dzień. Dzień bez wierszy to luka, nie słupek „potwierdzone zero”. Na tej serii nie ma linii prognozy Cursora.
- Optimize pokazuje wskazówki dla ostatniego wiersza Codexa na progu Warn at albo powyżej: wzrost inputu wobec poprzedniego requestu w tym samym wątku, niski udział cache, wiele wywołań modelu w jednej turze. Każda linia to wskazówka. Prognoza oszczędności jest podpisana jako prognoza. Run wkleja brief do otwartego czatu Agent w Cursorze tak jak dziś (`composer.focusComposer`) i **nie** wysyła go sam. Czerwony play wybiera ten wiersz Codexa i otwiera zakładkę Optimize; nie woła `composer.openComposer`.

**Wybrane OpenAI API (1.1.0):** trzy zakładki pokazują stan „niepodłączone”. Nie spadają do liczb Cursora.

### 5.9 Co użytkownik ma zobaczyć od razu

Tooltip komórki kosztu Codexa odpowiada na trzy pytania: skąd tokeny (plik rollout), którego zegara używamy (czas obserwacji, strefa lokalna) i czy pieniądz jest szacunkiem, ekwiwalentem API planu ChatGPT, opłatą raportowaną, czy wartością nieznaną. Pasek pokrycia mówi, czyj to komputer i jaki jest scope konta.

---

## 6. Model danych

Nowe typy w `src/codex/types.ts`. Nie rozszerzać `UsageQuery` w `src/usage/types.ts`. Zero dolara na planie Cursora i nieznana cena Codexa to różne fakty; jedna liczba ich nie uniesie.

Pola requestu idą za kontraktem ze specyfikacji (rozdział 6 raportu): tożsamość, scope konta i pewność, id rozmowy / sesji / tury / odpowiedzi, czasy, model i `modelEvidence`, `billingMode`, status, usage, `usageQuality`, `estimatedApiCostUsd` i `reportedCostUsd` jako decimal string albo null, `pricingVersion`, `costCoverage`, pochodzenie `(fileId, byteOffset)`, `parserVersion`.

Osobne encje w tej samej bazie:

- `conversations` — scope, id rozmowy, opcjonalny rodzic, tytuł, liczba tur
- `observations` — jeden wiersz na przyjętą linię logu, unikalność `(sourceInstanceId, fileGeneration, byteOffset)`
- `usage_snapshots` — tylko liczniki skumulowane; nigdy nie są wywołaniami modelu
- `import_checkpoints` — id pliku, generacja, offset bajtowy, kontekst parsera (sesja, tura, model)
- `pricing_versions` — faza 4
- `billing_buckets` — faza 6, bez łączenia z kosztem requestu

`deviceId` to losowe id tworzone raz w `globalState` (`cursorCost.codexDeviceId`). `sourceInstanceId` to skrót rozwiązanego katalogu Codexa, nie id konta i nie ścieżka repozytorium.

Scope konta: gdy plik nie ma id konta, klucz to `unknown:` + `sourceInstanceId`, nigdy SQL NULL i nigdy e-mail logowania Cursora. Ręczne przypisanie (później) ma pewność `user-assigned` i nie jest przepisywane przy zmianie konta Cursora.

---

## 7. Tokeny i pieniądze

Postać normalna usage w kształcie OpenAI:

```text
I = tokeny wejścia, razem z cache
C = cached input, podzbiór I
O = tokeny wyjścia, razem z reasoning
R = reasoning, podzbiór O
T = I + O
```

Nie liczyć `I + C + O + R`. Gdy są wszystkie cztery liczby, sprawdzić `0 ≤ C ≤ I` i `0 ≤ R ≤ O`. Gdy `total_tokens` się nie zgadza, zostawić surowe wartości i ustawić flagę anomalii. Nie poprawiać ich po cichu.

Koszt, tylko gdy znamy model, taryfę i stawki:

```text
((I - C) × input + C × cachedInput + O × output) / 1_000_000
```

Fixture (stawki fikcyjne, nie żywy cennik): I=100000, C=80000, O=10000, R=2000, stawki 2 / 0.5 / 8 za milion → **0.16**, T=110000. Reasoning nie jest czwartym składnikiem.

Gdy `C` jest null, nie wstawiać `0` i nie pokazywać jednej pewnej ceny. Pokazać `—` albo zakres. Nieznany model albo brak stawki → `—`. Niezerowe `cache_write_input_tokens` zostają zapisane i **niewycenione**, dopóki adapter nie opisze semantyki. Nie kopiować stawek cache write Cursora z `src/pricing/listPrice.ts`.

`billingMode = chatgpt-plan`: `reportedCostUsd` zostaje null, dopóki plik nie poda opłaty. Taryfa API, jeśli jest jawnie zmapowana, nazywa się **API-equivalent**, nie fakturą. Nie dzielić miesięcznego abonamentu ChatGPT przez requesty. Ścieżka w `.codex` sama z siebie nie oznacza planu ChatGPT; inaczej KIND to `Unknown`.

W bazie trzymać więcej niż dwa miejsca po przecinku. Zaokrąglenie tylko w formatowaniu komórki.

---

## 8. Importer

### 8.1 Wykrywanie

`src/codex/discover.ts` (funkcja czysta, dostaje `homedir` i `env`):

1. `cursorCost.codexHome`, gdy niepuste.
2. Inaczej `CODEX_HOME`.
3. Inaczej `~/.codex`.

Skan `sessions/**/*.jsonl` i `archived_sessions/**/*.jsonl`. `history.jsonl` może później dać tytuł; nie jest usage. Tylko odczyt. Pomijać to, co nie jest zwykłym plikiem.

### 8.2 Odczyt

`src/codex/import.ts` i `src/codex/jsonl.ts`:

- Checkpoint: id pliku, generacja (rozmiar + inode albo skrót treści, gdy plik maleje), zatwierdzony offset bajtowy, kontekst parsera.
- Czytać od offsetu. Przyjmować tylko pełne linie zakończone `\n`. Krótki ogon bajtów zostawić na rozcięty znak UTF-8. Offsety są w bajtach, nie w długości stringa JavaScript.
- Jedna transakcja: obserwacje + requesty + checkpoint.
- Skrócenie albo podmiana → nowa generacja, import od nowa, deduplikacja. Zniknięcie logu nie kasuje wierszy trackera.
- Zdarzenia systemu plików: debounce 750 ms. Kontrolny skan co 30 s, gdy import jest włączony i panel jest otwarty albo skan jest brudny. Głębokość kolejki 1. Nigdy nie czekać na to w `activate()`.
- Drugie okno: plik blokady albo lease w `globalState` ze starym timeoutem. Zapisy i tak są idempotentne.

### 8.3 Mapowanie linii

| `type` | Akcja |
|---|---|
| `session_meta` | Uzupełnić sesję, wątek, opcjonalne id konta. Powtórka nie tworzy drugiej rozmowy. |
| `turn_context` | Zapamiętać model tej tury (`modelEvidence: turn-context`). |
| `token_usage_record` | Kandydat requestu wyłącznie z `payload.usage`, plus id i czas linii jako `observedAt`. |
| `event_msg` z `token_count` | Snapshot albo kontrola. Nie drugi request. |
| Wiadomość użytkownika | Tylko licznik tur. W 1.1.0 nie zapisywać tekstu. |
| Zdarzenie błędu końcowego | Status tylko wtedy, gdy payload wyraźnie nazywa tę samą odpowiedź albo turę. Samo usage nie znaczy `completed`. |
| Cokolwiek innego | Pominąć. Zwiększyć licznik nierozpoznanych. |

Model z odpowiedzi, gdy późniejsze źródło go ma, zastępuje turn-context. Brak modelu → `Unknown`, nie aktualny domyślny model Codexa.

### 8.4 Tożsamość

Preferowany klucz: `(provider, accountScope, responseId)`.

Bez `responseId`: id to `(sourceInstanceId, fileGeneration, byteOffset)`. `usageQuality` nie jest `reported` jako potwierdzone pojedyncze wywołanie, chyba że typ linii to `token_usage_record` **i** niesie response id. `token_usage_record` **z** `responseId` to jedno wywołanie modelu.

Ta sama odpowiedź w rolloucie i później w rejestratorze API: dwie obserwacje, jeden request.

Nie deduplikować po tekście promptu, liczbie tokenów ani czasie.

Same snapshoty skumulowane: delty jako `derived` z przedziałem czasu. Spadek, reset albo brak bazy to luka, nie `max(delta, 0)`. Gdy w tym przedziale są wiersze request-level, nakładające się wiersze derived wypadają z sum.

---

## 9. Magazyn

Plik: `<ExtensionContext.globalStorageUri>/codex-history.sqlite`. Nie workspace i nie `~/.codex`.

`engines.node` to `>=18`. `node:sqlite` `DatabaseSync` jest już preferowanym **czytnikiem** bazy Cursora i nie zawsze jest dostępny. Plan:

- Gdy `DatabaseSync` umie otworzyć plik do zapisu, użyć go.
- Inaczej sql.js: transakcja w pamięci i atomowy zapis pliku (`zapis tymczasowy + rename`). Cel 100 tys. wierszy czeka na `node:sqlite`, jeśli eksport sql.js będzie za wolny. UI ma być poprawne w obu wariantach.

Indeksy jak w specyfikacji: unikalne `(scope_id, response_id)`, gdy response id jest niepuste; unikalne obserwacje; `(source, account_scope_id, observed_at)`; `(conversation_id, observed_at)`; `(model, observed_at)`. Tabela wersji schematu. Migracja przed pierwszym importem w procesie.

Zapytania panelu: filtr, deduplikacja, grupa, agregacja, sort, limit — w SQL. Webview nie dostaje logu.

---

## 10. Host ↔ webview

Nowe warianty w `src/webview/messages.ts`. Nie przeciążać `refresh` ani `exportCsv` (zostają cursorskie).

Webview → host:

- `setQuerySource` `{ value }`
- `codex.refresh`
- `codex.query` `{ from, to, accountScopeId, model, status, groupBy, sort, costBasis, cursor, limit }`
- `codex.expand` `{ conversationId, accountScopeId }`
- `codex.details` `{ id }`
- `codex.exportCsv` (filtry ostatniego zapytania, wszystkie strony)
- `codex.forget`
- `codex.analyze` `{ id }` — faza 7; w 1.1.0 może zwrócić pustą listę wskazówek

Host → webview, obok obecnego `data`:

- `codex.status` `{ enabled, resolvedHome, machineLabel, sessionCount, from, to, lastSyncAt, lastError, unrecognizedLines, parserVersion, accountKnown }`
- `codex.result` `{ correlationId, rows, groups, nextCursor, totals, coverage }`
- `codex.children` `{ correlationId, conversationId, rows }`
- `codex.detail` `{ correlationId, detail }`
- `codex.exportReady` — host otwiera też dialog zapisu, tak jak CSV Cursora
- `operation.error` `{ correlationId, message }`

Każde zapytanie ma `correlationId`. Webview odrzuca spóźnioną odpowiedź z nieaktualnym id. Host przycina `limit` do 1–200. Wiersze w payloadzie to model widoku z §5.4, nie `TrackedRequest` i nie linia JSONL.

Cursorowe `{ type: 'data' }` nie dostaje tablicy zdarzeń Codexa.

---

## 11. CSV

`src/codex/csv.ts`. Kolumny jak w rozdziale 16 specyfikacji, w tej kolejności. Kropka dziesiętna. Null → puste pole, nie `0`. Cudzysłowy przy przecinku i nowej linii. Tytuł zaczynający się od `=`, `+`, `-`, `@` albo tabulatora dostaje apostrof na początku. Bez promptów i bez sekretów.

Agregaty rozmów to druga akcja eksportu, nie dodatkowe wiersze pod eksportem requestów. Sumy pliku requestów muszą zgadzać się z przefiltrowanymi sumami na ekranie.

---

## 12. Fazy

Każda faza to jedna tura Agent: pliki poniżej, Vitest tej fazy, na końcu jedno `npm test` i `typecheck`. Katalogi językowe: w turze, która dodaje napisy, tylko `en` i `pl`. Reszta katalogów to następna wiadomość.

### Faza 1 — parser i normalizacja

```
src/codex/types.ts
src/codex/jsonl.ts
src/codex/parseRollout.ts
src/codex/usage.ts
test/codexParse.test.ts
test/fixtures/codex/*.jsonl
```

Gotowe, gdy na syntetycznych fixture przechodzą punkty 1–4, 6, 8 i 9 z rozdziału 20 specyfikacji (podwójny import na tym etapie to czysta funkcja: parse dwa razy, scalenie po response id). Bez importu `vscode`.

### Faza 2 — wykrywanie, baza, import

```
src/codex/discover.ts
src/codex/store.ts
src/codex/import.ts
src/codex/identity.ts
test/codexImport.test.ts
```

Gotowe, gdy drugi import nic nie zmienia, rozcięta linia domyka się w następnym kawałku, skrócony plik importuje się bez duplikatów, nieznane konto nie jest stringiem `null`, a skopiowany response id na forku nie podwaja sumy globalnej. Nadal bez webview.

Scheduler podłączamy dopiero w fazie 3 (`src/extension.ts`), żeby ta faza dała się testować zegarem i katalogiem tymczasowym.

### Faza 3 — panel

```
src/webview/messages.ts
src/ui/codexRows.ts
src/extension.ts
media/history.html
media/src/tabs/queries.js
```

Gdy zestaw jest za szeroki na jedną turę, podzielić na **3a** host (`messages.ts`, `codexRows.ts`, `extension.ts`) i **3b** webview (`history.html`, `queries.js` oraz `media/css/base.css` tylko wtedy, gdy szuflada potrzebuje reguły).

Karta Settings i klucze w `package.json` należą do **3a**. Napisy: `src/i18n/catalogs/en.ts` i `pl.ts` tylko w **3b**.

Gotowe, gdy przełącznik, pasek pokrycia, tabela z grupami, leniwe dzieci, szuflada, filtry, stany puste, CSV i usunięcie danych działają na bazie z fazy 2. Źródło Cursor dalej maluje się z `data.events` / `queryGroups`. `npm run build` odtwarza `media/history.js`.

### Faza 4 — taryfa

```
src/codex/pricing.ts
src/codex/tariff.ts
test/codexPricing.test.ts
```

Gotowe, gdy fixture 0.16 jest pokryte, brak stawek zostaje `—`, kwoty planu ChatGPT są podpisane jako API-equivalent, a stare wiersze trzymają `pricingVersion`. Bez cichego mapowania nazwy modelu Codexa na wiersze `src/pricing`. 1.1.0 można wydać nawet wtedy, gdy każdy żywy model jest `—`, byle tokeny były dobre.

### Faza 5 — ingest rejestratora OpenAI API (późniejszy MINOR)

Rozszerzenie nie widzi innych procesów. Faza 5 dodaje **opcjonalny plik ingest**, do którego aplikacja użytkownika dopisuje JSONL begin/finish/fail. Normalizacja wchodzi w ten sam `TrackedRequest` ze `source: openai-api`. Kształt wrappera jest w rozdziale 9 specyfikacji. Przy streamingu liczy się wyłącznie końcowy obiekt usage. Błąd transportu nie jest kosztem zero. Retry z nowym response id to nowy request. Bez proxy TLS. Chip źródła pokazuje wtedy prawdziwe wiersze zamiast stanu „niepodłączone”.

### Faza 6 — porównanie z organizacją (późniejszy MINOR)

Klucz administracyjny w Secret Storage. Ręczne odświeżenie i poll co 15 minut, ponowne pobranie ostatnich koszyków, podmiana koszyków, backoff przy 429. Statistics pokazuje `local estimate` i `organization reported` dla **tej samej** organizacji, projektu, czasu, modelu i jednostki. Błąd zostawia wiersze lokalne. Te dolary nie są zapisywane na requestach i nie są saldem planu ChatGPT.

### Faza 7 — wskazówki Optimize i skala (późniejszy MINOR)

Reguły w `src/codex/optimize.ts`: wzrost inputu, powtórzony rozmiar kontekstu, niski udział cache, wiele wywołań na turę. Zapis analizy (czas, zakres, wersja reguł, status). Nie przepisywać historycznego kosztu, żeby „pokazać oszczędność”. Paginacja i zmierzona pierwsza strona z ciepłej bazy to poprzeczka wydajności (500 ms ze specyfikacji to cel, nie obietnica).

---

## 13. Testy akceptacyjne (właściciel)

| # | Reguła | Faza | Test |
|---|---|---|---|
| 1 | Drugi import nie zmienia sum | 2 | `codexImport.test.ts` |
| 2 | `token_usage_record` i `token_count` liczą się raz | 1 | `codexParse.test.ts` |
| 3 | Snapshoty skumulowane nie są udawaną listą requestów | 1 | `codexParse.test.ts` |
| 4 | Fork ze skopiowanymi response id nie podwaja zużycia globalnego | 2 | `codexImport.test.ts` |
| 5 | Ten sam tytuł, dwa scope kont, dwie grupy; unknown ≠ bieżące konto Cursora | 2 i 3 | `identity` + `codexRows` |
| 6 | 100000 / 80000 / 10000 / 2000 → T 110000 i 0.16 przy fikcyjnej taryfie | 1 i 4 | `usage` + `pricing` |
| 7 | Brak taryfy albo usage to `—`; częściowa grupa pokazuje `9/10 priced` | 3 i 4 | `codexRows` |
| 8 | Dwa modele → `Mixed (2)` | 3 | `codexRows` |
| 9 | Rozcięta linia JSONL i rozcięty UTF-8 | 1 | `jsonl` |
| 10 | Skrócenie, rotacja, archiwum, restart | 2 | `codexImport` |
| 11 | Przerwany stream jest partial, nie `$0` | 5 | fixture rejestratora |
| 12 | Nowy response id przy retry to nowy request; ten sam id nie | 5 | fixture rejestratora |
| 13 | Zakres przez zmianę czasu w Warszawie nie gubi i nie dubluje | 3 | granice zapytania przez `src/time/` |
| 14 | CSV wszystkich stron = sumy filtra, bez wierszy grup | 3 | `codex/csv.ts` |
| 15 | Sekrety, HTML promptu, formuły CSV | 1–3 | fixture tytułu i błędu; prefiks csv |
| 16 | Błąd synchronizacji administracyjnej zostawia wiersze lokalne | 6 | baza nietknięta przy wyjątku |
| 17 | Koszt organizacji nie wchodzi do requestów ani do planu ChatGPT | 6 | payload porównania |
| 18 | Duży zbiór nie jedzie do renderera | 3 i 7 | limit strony; brak pełnej tabeli w postMessage |

Zestaw UI na fazę 3: mieszane modele w jednym wątku, nieznana cena, częściowe usage, nieznane konto, jeden wiersz powyżej Warn at. Prawdziwy prywatny rollout porównać tylko na maszynie utrzymującego; nie commitować tego pliku.

---

## 14. Pliki, które zostają tylko cursorskie

Nie puszczać wierszy Codexa przez:

- `UsageQuery` w `src/usage/types.ts`
- `src/usage/service.ts` / `api.ts` / `parse.ts`
- `src/pricing/listPrice.ts`
- `toHistoryRows` w `src/ui/historyRows.ts`
- ścieżkę `titleGroupKey` w `src/ui/queryGroups.ts`
- `src/ui/mtdPace.ts`, `src/burnRate/*`, `src/ui/criticalAlert.ts`
- `buildQueriesCsv` w `src/ui/exportCsv.ts`
- budowę paska statusu

Wspólne, wolno wołać: `src/format.ts` (formatery Codexa obok obecnych), granice dnia w `src/time/`, `isSpike` z `src/spikes/threshold.ts` dla znaku `!`, unię komunikatów w `src/webview/messages.ts`, nowe klucze w `src/config.ts`.

---

## 15. Bezpieczeństwo

- Pliki rollout czytać jako dane. Tytuły i kody błędów rysować przez `textContent`.
- Nie otwierać `auth.json`, `session.json` ani ciasteczek, żeby zgadnąć konto.
- Nie wysyłać do webview tokenu Cursora, tokenu Codexa ani klucza OpenAI.
- Klucz fazy 6 żyje wyłącznie w `context.secrets`.
- CSV i kopia szczegółów zawierają id i liczby, nie prompty ani wyniki narzędzi.
- Ścieżki importera zostają wewnątrz rozwiązanego katalogu Codexa po `realpath`. Odrzucić home, który rozwiązuje się poza katalogiem wybranym przez użytkownika.

---

## 16. Kolejność

1. Parser i arytmetyka usage.
2. Import SQLite i deduplikacja.
3. Przełącznik źródła, tabela Codexa, szuflada, CSV.
4. Jawna taryfa albo uczciwe `—`.
5. Dopiero potem rejestrator, sumy organizacji i wskazówki Optimize.

Kroki 3–4 można wydać użytkownikom jako **1.1.0** bez cennika, jeśli tokeny są wiarygodne. Nie blokować tego wydania kluczem administracyjnym.
