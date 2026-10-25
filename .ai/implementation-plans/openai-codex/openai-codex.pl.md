# Lokalna historia Codexa i requesty OpenAI

**Status:** zaplanowane. Nie zaczęte.
**Wydanie:** 1.1.0 dla faz 1–4. Fazy 5–7 to późniejsze minor. W turze fazy nie podbijać `package.json`.
**Baza:** 1.0.7. `extensionKind` to `ui`. Node `>=18`. Zapis przez sql.js.

Gdy ten plan kłóci się z wymaganiami produktu, wygrywają wymagania produktu. Rozliczenie Cursora, jedyny blokujący modal critical alert i ukryty Leaderboard zostają bez zmian.

Jedna faza na jedną wiadomość w Agent. Ruszać tylko ścieżki wymienione pod tą fazą. Napisy UI w tej fazie to angielski i polski. Pozostałe katalogi to następna wiadomość.

Potok Cursora zostaje: `UsageService` → `toHistoryRows` → zakładka zapytań. Wiersze Codexa do niego nie wchodzą.

---

## 1. Efekt

Panel historii dostaje przełącznik źródła: **Cursor**, **Codex local**, **OpenAI API**.

Codex local pokazuje rozmowy już zapisane w plikach rollout na tym komputerze: tytuł albo krótkie id, tury, liczbę requestów modelu, model, tokeny, input/output, rodzaj rozliczenia i koszt tylko wtedy, gdy znamy taryfę. Rozwinięcie rozmowy dociąga wywołania modelu. Statistics, Charts i Optimize idą za wybranym źródłem.

OpenAI API to drugie źródło: wywołania, które aplikacja sama zapisała. W 1.1.0 chip da się wybrać, a treść mówi, że rejestrator nie jest podłączony. Raporty zużycia i kosztów organizacji to późniejsze porównanie. Nigdy nie stają się wierszami tabeli requestów.

1.1.0 jest gotowe, gdy:

- Ten sam rollout zaimportowany drugi raz nie zmienia liczby requestów ani kosztu.
- Requestem jest `token_usage_record.payload.usage`. `turn_token_usage`, `thread_token_usage` oraz `event_msg` / `token_count` nie są doliczane drugi raz.
- Brak ceny albo usage wygląda jak `—`.
- Last N, pasek statusu, burn rate, prognoza miesiąca i CSV Cursora zostają na zdarzeniach Cursora.
- Do webview, CSV, logów i ustawień nie trafia plik auth Codexa, klucz API, prompt ani wynik narzędzia.

---

## 2. Decyzje

1. Jeden katalog Codexa. Kolejność: niepuste `cursorCost.codexHome`, potem bezwzględne `CODEX_HOME`, gdy jest istniejącym katalogiem, potem `~/.codex`.
2. Import jest wyłączony, dopóki `cursorCost.codexImportEnabled` nie jest true. Przy wyłączeniu test katalogu może zauważyć `sessions/` i pokazać jedną zamykalną linię. Treść plików czytamy po włączeniu.
3. `deviceId` powstaje raz w `globalState` (`cursorCost.codexDeviceId`). `sourceInstanceId` to skrót rozwiązanego realpath.
4. Klucz nieznanego konta to `unknown-source:<sourceInstanceId>`. To nie jest e-mail Cursora i nie jest SQL NULL.
5. Klucz znanego konta to `account:<opaque-id>`, pewność `source-reported`. Późniejsze przypisanie ręczne to `user-assigned` i nie przepisuje się przy zmianie konta Cursora.
6. Tytuły w 1.1.0 to `#` plus 8 znaków `thread_id`. Tekst wiadomości nie jest zapisywany.
7. Etykieta grupy to `4 turns · 28 model requests`, gdy obie liczby istnieją. Pliki samych snapshotów nie wymyślają liczby requestów.
8. Klucz grupy to `(provider, accountScopeKey, conversationId)`. Te same tytuły się nie scalają. Brak id rozmowy to osobna grupa z krótkim id.
9. Skopiowany `responseId` na forku to jeden globalny request. Dziecko może do niego linkować. Własny wydatek dziecka liczy odpowiedzi, które pierwszy raz pojawiają się na tym dziecku.
10. Klucz deduplikacji to `(provider = openai, accountScopeKey, responseId)`. Ta sama odpowiedź z późniejszego rejestratora to druga obserwacja i ten sam request. Bez deduplikacji po prompcie, tokenach, czasie, modelu i tytule.
11. Brak `responseId`: tymczasowe id `(sourceInstanceId, fileGeneration, byteOffset)`. `token_usage_record` z `responseId` to jeden request modelu.
12. Pasek statusu zostaje cursorowy. W 1.1.0 nie ma chipa Codexa.
13. `cursorCost.querySource` jest zapisywane. Current, Today i chip ostatniego zapytania otwierają panel na Cursorze i zapisują źródło z powrotem jako `cursor`. Polecenie historii używa zapisanego źródła.
14. Grupowanie Codexa używa `cursorCost.codexGroupByConversation` (domyślnie true). Nie zapisuje `cursorCost.groupQueriesByConversation`.
15. Daty Codexa nie czytają ani nie zapisują `cursorCost.historyFromDate`.
16. Modal krytyczny nie odpala się dla Codexa. Znak `!` używa tego samego progu Warn at.
17. Play na wierszu Codexa otwiera Optimize dla tego wiersza. Nie woła `composer.openComposer`.
18. Run Optimize przy wybranym Codexie wkleja brief samych danych rozliczeniowych do otwartego czatu Agenta i nie wysyła go. Brief ma liczby i identyfikatory. Nie ma promptu ani tekstu narzędzia.
19. Chip Optimized pasuje do zapisanego przebiegu analizy. Do fazy 7 nic nie pasuje. Cache hit nie jest „optimized”.
20. Brak domyślnej mapy nazwy modelu Codexa na cennik Cursora. Historia tokenów wychodzi z kosztem `—`, gdy nie ma zapisanej taryfy.
21. `billingMode = chatgpt-plan` trzyma `reportedCostUsd` jako null, dopóki plik nie raportuje opłaty. Zmapowana taryfa API jest podpisana API-equivalent. Sama ścieżka w `.codex` nie oznacza planu ChatGPT.
22. Szacunek API, koszt raportowany przez organizację i ekwiwalent API nigdy nie dzielą jednej sumy.
23. Wtyczka UI czyta maszynę, na której działa host UI. Okno Remote SSH nie skanuje hosta SSH.
24. Plik magazynu: `<globalStorageUri>/openai-request-history.sqlite`. Implementacja to sql.js: migracja w pamięci, zapis pliku tymczasowego obok, rename. `RequestStore` to interfejs. Nie zapisujemy `~/.codex`, `state.vscdb` ani workspace.
25. Usunięcie zaimportowanych danych to dwuetapowa kontrolka w Settings. Kasuje wyłącznie wiersze wtyczki.
26. 1.1.0 nie otwiera klienta sieciowego. Klucz administracyjny nie jest ustawieniem. Endpointy organizacji czekają na zmianę wymagań produktu i potem żyją w `context.secrets`.
27. Wersja parsera tego kształtu to `rollout-v1`.

---

## 3. Ustawienia

Karta **Codex** w widoku ustawień, po Recent queries i przed Refresh.

| Pole | Klucz | Domyślnie |
|---|---|---|
| Import lokalnych sesji Codexa | `cursorCost.codexImportEnabled` | false |
| Katalog Codexa | `cursorCost.codexHome` | `""` |
| Grupuj Codex po wątku | `cursorCost.codexGroupByConversation` | true |
| Źródło zapytań | `cursorCost.querySource` | `cursor` |

Tylko do odczytu: rozwiązany katalog, ten komputer, liczba sesji, zakres dat, ostatni skan, wersja parsera, liczba nierozpoznanych linii.

Rescan wysyła `codex.refresh`. Delete zmienia się w „Delete imported Codex data — confirm”; drugie kliknięcie wysyła `codex.forget`.

---

## 4. Panel

Znaczniki w `media/history.html`. Zachowanie w `media/src/`. Przebudowa: `npm run build`. Nie edytować ręcznie `media/history.js` ani `media/history.css`.

### 4.1 Przełącznik źródła

Pod paskiem zakładek, na pełną szerokość, na Last N, Statistics, Charts i Optimize. Ukryty na Support i Settings. Pigułki ghost, `aria-pressed`.

```
Source   ( Cursor )  ( Codex local )  ( OpenAI API )
```

Etykieta zakładki: `Last N Cursor queries`, `Codex queries` albo `OpenAI API`.

Zmiana źródła nie woła API zużycia Cursora. Refresh wysyła `refresh` dla Cursora, `codex.refresh` dla Codexa, `openai.refresh` dla OpenAI API. Do fazy 5 odświeżenie OpenAI zwraca stan niepodłączony.

Treść OpenAI API: `OpenAI API recorder is not connected. This extension does not see other programs’ calls to OpenAI.` Statistics, Charts i Optimize używają tego pustego stanu. Nie pokazują sum Cursora.

### 4.2 Pasek pokrycia

Jedna linia monospace pod przełącznikiem. Sam tekst. Wygrywa najcięższy stan. Bezwzględna ścieżka Codexa nie jest na tej linii.

| Stan | Linia |
|---|---|
| Import wyłączony, `sessions/` istnieje | `Codex sessions found on this computer. Turn on import in Settings.` Da się zamknąć. |
| Import wyłączony, nic nie znaleziono | ukryty |
| Import włączony, brak katalogu | `Codex home not found` |
| Import włączony, katalog pusty | `No local Codex history found` |
| Częściowe pokrycie parsera | `Partial history · N unrecognized lines` |
| Brak id konta | `account unknown` w zwykłej linii. To nie jest kolor błędu. |
| Ostatni skan się nie udał | `Sync failed · showing data from 18:02`. Zostają poprzednie wiersze. |
| Okno zdalne | prefiks `This computer (not the SSH host) ·` |

Zwykła linia: `Local history · this computer · account unknown · 12 sessions · 7 Oct – 14 Oct · last sync 18:12`

### 4.3 Pasek narzędzi Codexa

| Kontrolka | Zachowanie |
|---|---|
| Over Warn at | Tokeny requestu albo suma grupy ≥ `cursorCost.spikeTokenThreshold`. |
| Optimized | Tylko zapisane id analizy. |
| Group by conversation | Ustawienie Codexa. Wyłączone = płaskie requesty modelu, od najnowszych. |
| Export CSV | `codex.exportCsv`. Płaskie requesty, aktywne filtry, wszystkie strony. |
| Data | Last 7 days, This month, All imported, Custom. Własne From/To to lokalne `YYYY-MM-DD`, przedział `[from, to)`, zapis przy Apply / Enter / blur. Pusty własny zakres to cały import. |
| Konto | All, Unknown albo wykryty zakres. |
| Model | Modele przy pozostałych filtrach, plus Unknown. |
| Status | completed, failed, cancelled, incomplete, unknown. |
| Sort | Domyślnie `time-desc`. `cost-desc` i `tokens-desc` lecą w magazynie. |

### 4.4 Tabela

Kolumny Cursora zostają: TIME, MODEL, CONTEXT, COST, TOKENS, INPUT / OUTPUT, KIND.

Codex pomija CONTEXT. Szeroka tabela, poziomy scroll, przyklejona pierwsza kolumna, liczby monospace, tylko tokeny motywu.

| Kolumna | Request | Grupa |
|---|---|---|
| chevron | brak | `aria-expanded` |
| TIME | czas obserwacji; strefa lokalna w tooltipie | `#abcd1234` albo późniejszy tytuł; `4 turns · 28 model requests`; `14 Oct 09:07 → 14 Oct 11:02` |
| MODEL | nazwa albo `Unknown`; tooltip `response` albo `turn context` | jeden model albo `Mixed (2)` |
| COST | `Est. $0.16`, `API-equiv. $0.16`, kwota raportowana albo `—`. `< $0.01`, gdy niezerowa zapisana wartość znika przy dwóch miejscach. | Tylko jedna podstawa. `9/10 priced`, gdy pokrycie jest częściowe. |
| TOKENS | `I + O`. `!`, gdy ostrzeżenia są włączone i wiersz jest nad Warn at. | Suma unikalnych requestów w filtrze. Play jest w tej komórce. |
| INPUT / OUTPUT | `15347 / 185`. Tooltip: cache inputu i reasoning. | Sumy. `partial`, gdy któremuś dziecku brakuje usage. |
| KIND | `API`, `ChatGPT plan`, `Unknown` | jeden rodzaj albo `Mixed` |

Dzieci ładują się przy rozwinięciu: `{ type: 'codex.expand', conversationId, accountScopeKey }`. Rozwijanie Cursora zostaje na indeksach i nie wysyła `codex.expand`.

Rozmiar strony 100. Load more używa kursora keyset `(krotka sortowania, id)`. Host przycina `limit` do 1–100. Wiadomość `data` Cursora nie dostaje tablicy Codexa.

### 4.5 Szuflada

Kliknięcie requestu otwiera szufladę pod tabelą. Tylko `textContent`. To nie jest modal.

Źródło, etykieta urządzenia, zakres, pewność, rozmowa, sesja, tura, id odpowiedzi, jakość usage, input, cache inputu, output, reasoning, total, podstawa kosztu, formuła słowami, wersja cennika albo `Price unavailable`, status, kod błędu, czas obserwacji. Start i koniec tylko wtedy, gdy plik je ma. Kopiowanie szczegółów używa tych samych pól w zwykłym tekście.

Enter otwiera szufladę. Escape ją zamyka. Chevron jest osobnym przyciskiem.

### 4.6 Statistics, Charts, Optimize

Wybrany Cursor: obecne sekcje, bez zmian.

Wybrany Codex:

- Ukryć liczniki planu Current/Today, burn rate, generated lines i prognozę planu na miesiąc. Nie rysować ich jako zera.
- Karty: miks tokenów (input, cache inputu, output, reasoning); liczniki (requesty modelu, tury, rozmowy); udział wycenionych (`26/28`); szacunek API i ekwiwalent API obok siebie. Karta kosztu raportowanego pojawia się tylko wtedy, gdy taka kwota istnieje.
- Cache hit to `sum(cache inputu) / sum(input)` tam, gdzie obie wartości są niepuste.
- Wykresy: dzienne tokeny i dzienny szacowany koszt. Dzień bez wierszy to luka.
- Wskazówki Optimize: wzrost inputu wobec poprzedniego requestu w tym samym wątku, niski udział cache, wiele requestów modelu w jednej turze. Każda linia to hipoteza. Prognozowane oszczędności są podpisane jako prognoza.

---

## 5. Liczby

```text
I = input, łącznie z cache
C = cache inputu, podzbiór I
O = output, łącznie z reasoning
R = reasoning, podzbiór O
T = I + O
```

Nie dodawać `I + C + O + R`. Gdy są wszystkie cztery, wymagać `0 ≤ C ≤ I` oraz `0 ≤ R ≤ O`. Gdy `total_tokens` się nie zgadza, zostawić surowe liczby i ustawić flagę anomalii.

Pieniądze to bigint o stałej skali, zapisany jako tekst dziesiętny. Zaokrąglenie tylko w komórce i w CSV.

```text
((I - C) × inputRate + C × cachedInputRate + O × outputRate) / 1_000_000
```

Stawki fixture 2 / 0,5 / 8 za milion, I=100000, C=80000, O=10000, R=2000 → **0,16**, T=110000.

Pusty cache inputu nie jest zastępowany zerem. Nieznany model albo brak stawki to `—`. Niezerowe `cache_write_input_tokens` jest zapisane i niewycenione. Obecność usage nie ustawia statusu `completed`. `observedAt` nie jest czasem startu.

Null oznacza niewiedzę. Zero oznacza zaraportowane zero.

---

## 6. Magazyn

| Tabela | Trzyma |
|---|---|
| `schema_migrations` | wersja |
| `source_instances` | odcisk katalogu, id urządzenia, ostatni skan |
| `source_files` | tożsamość, generacja, rozmiar, mtime, odcisk prefiksu |
| `import_checkpoints` | id pliku, generacja, offset bajtowy, `partial_bytes`, kontekst parsera |
| `conversations` | zakres, id rozmowy, rodzic, tytuł, liczba tur, pierwszy i ostatni czas |
| `requests` | jeden zdeduplikowany request, usage i koszt mogą być null |
| `request_observations` | jedno pochodzenie na przyjętą linię |
| `usage_snapshots` | liczniki skumulowane, nigdy niepokazywane jako requesty modelu |

Późniejsze migracje: `pricing_versions` (faza 4), `http_attempts` (faza 5), `billing_buckets` (faza 6), `optimization_runs` (faza 7).

Unikalność w aplikacji:

```text
requests (provider, account_scope_key, response_id), gdy response_id jest niepusty
request_observations (source_file_id, generation, byte_offset)
```

Indeksy: `(source, account_scope_key, observed_at, id)`, `(conversation_id, observed_at, id)`, `(model, observed_at, id)`.

Jedna dzierżawa w global storage. Drugie okno czyta i nie importuje. Zapisy są idempotentne. Nieudany flush zostawia poprzedni plik. Paczka importu i jej checkpoint commitują się razem. Między paczkami oddajemy wątek. `activate()` nie czeka.

Pochodzenie zostaje na obserwacji. Ścieżki bezwzględne zostają w `source_files` i na karcie Settings. Nie ma ich w payloadzie webview.

Typy są w `src/openaiHistory/domain.ts`. Nie rozszerzać `UsageQuery`.

```text
RequestSource        codex-local | openai-api
AccountConfidence    source-reported | user-assigned | unknown
ModelEvidence        response | turn-context | requested | unknown
BillingMode          api | chatgpt-plan | unknown
RequestStatus        completed | failed | cancelled | incomplete | unknown
UsageQuality         reported | derived | partial | missing
CostCoverage         complete | tokens-only | partial | unknown
```

---

## 7. Importer

Moduły w `src/openaiHistory/codex/`. Tylko odczyt. Zwykłe pliki w `sessions/` i `archived_sessions/`. Nie iść za symlinkiem, który rozwiązuje się poza katalogiem. `history.jsonl` nie jest usage. Brak katalogu to `Codex home not found`.

Checkpoint trzyma id pliku, generację, offset bajtowy, kontekst parsera (sesja, tura, model) i `partial_bytes`. Generacja zmienia się, gdy plik się skraca albo ograniczony odcisk prefiksu pokazuje podmianę przy tym samym rozmiarze. Czytać od offsetu. Dekodować tylko do ostatniego znaku nowej linii. Zostawić rozcięty ogon UTF-8. Offsety są w bajtach. Ograniczyć rozmiar linii. Zła albo nieznana linia podbija licznik i jest pomijana. Skasowanie pliku logu nie kasuje wierszy trackera.

`fs.watch` to podpowiedź, debounce 750 ms. Przy włączonym imporcie skan co 30 s jest wiążący, także przy zamkniętym panelu. Najpierw stat, potem brudne ogony. Głębokość kolejki 1. Import wyłączony oznacza brak watchera i brak czytania treści.

| Linia | Akcja |
|---|---|
| `session_meta` | Uzupełnić sesję, wątek, opcjonalne id konta. Powtórka nie tworzy rozmowy. |
| `turn_context` | Model tej tury, dowód `turn-context`. Model z odpowiedzi wygrywa. |
| `token_usage_record` | Kandydat wyłącznie z `payload.usage`. Czas linii to `observedAt`. |
| `event_msg` / `token_count` | Snapshot albo kontrola. Nie drugi request. |
| Tekst użytkownika, agenta, narzędzia, instrukcji | Odrzucić treść. |
| Błąd końcowy | Ustawić status tylko wtedy, gdy payload nazywa tę samą odpowiedź albo turę. |
| Cokolwiek innego | Pominąć. Policzyć. |

Brak modelu → `Unknown`.

Pliki samych snapshotów zapisują delty jako `derived` z przedziałem czasu. Spadek, reset albo brak bazy to luka. Gdy wiersze request-level pokrywają ten przedział, wiersze derived wypadają z sum.

---

## 8. Wiadomości hosta

Dodać warianty w `src/webview/messages.ts`. Te same stringi odbić w `media/src/messages.js`. Nie przeciążać cursorowych `refresh` ani `exportCsv`.

Webview → host: `setQuerySource`, `codex.refresh`, `codex.query`, `codex.expand`, `codex.details`, `codex.exportCsv`, `codex.forget`, `openai.refresh`, `codex.analyze`.

`codex.query` niesie `correlationId`, `filterRevision`, `from`, `to`, `accountScopeKey`, `model`, `status`, `groupBy`, `sort`, `costBasis`, `cursor`, `limit`.

Host → webview, obok wiadomości `data` Cursora: `codex.status`, `codex.result`, `codex.children`, `codex.detail`, `codex.exportReady`, `operation.error`.

`codex.result` niesie `correlationId`, `filterRevision`, `rows`, `nextCursor`, `totals`, `coverage`, `lastSyncAt`.

Webview odrzuca nieaktualne correlation id albo rewizję filtra. Host odrzuca ścieżki, SQL, URL-e, sekrety i limit poza 1–100. Wiersze to model widoku z §4.4.

Kolejność zapytania: requesty, potem źródło, konto, model, status i `[from, to)`, potem jedna podstawa kosztu, potem sort i strona keyset. Tryb grup liczy agregaty w SQL, potem stronuje grupy. Sumy to agregaty SQL. Granice doby idą przez `src/time/`.

`HistoryPanel` routuje wiadomości Codexa. `UsageService` dalej posiada ciasteczka Cursora i polling Cursora.

CSV to `src/openaiHistory/exportCsv.ts`. Jeden wiersz na request, wszystkie pasujące strony. Kropka dziesiętna `.`. Null to pusta komórka. Cudzysłowy przy przecinkach i nowych liniach. Tytuł zaczynający się od `=`, `+`, `-`, `@` albo tabulacji dostaje z przodu pojedynczy apostrof. Kolumny: `source`, `device_id`, `account_scope`, `account_confidence`, `conversation_id`, `conversation_title`, `turn_id`, `response_id`, `observed_at_utc`, `model`, `model_evidence`, `status`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`, `total_tokens`, `estimated_api_cost_usd`, `reported_cost_usd`, `billing_mode`, `pricing_version`, `usage_quality`, `cost_coverage`. Agregaty rozmów to osobny, późniejszy eksport. Sumy pliku requestów zgadzają się z przefiltrowanymi sumami SQL.

---

## 9. Fazy

Stanąć na końcu fazy. Gdy faza z literą nadal jest za szeroka, nie zaczynać następnej litery w tej samej turze.

Pliki kroków (typy, zachowanie, testy) są w [README.pl.md](./README.pl.md). Ta sekcja zostaje granicą faz. Gdy plik kroku kłóci się z tym planem, wygrywa ten plan.

| Faza | Plik |
|---|---|
| 1 | [phase-1-parse.pl.md](./phase-1-parse.pl.md) |
| 2a | [phase-2a-store.pl.md](./phase-2a-store.pl.md) |
| 2b | [phase-2b-import.pl.md](./phase-2b-import.pl.md) |
| 3a | [phase-3a-query.pl.md](./phase-3a-query.pl.md) |
| 3b | [phase-3b-host.pl.md](./phase-3b-host.pl.md) |
| 3c | [phase-3c-webview.pl.md](./phase-3c-webview.pl.md) |
| 3d | [phase-3d-stats.pl.md](./phase-3d-stats.pl.md) |
| 4 | [phase-4-pricing.pl.md](./phase-4-pricing.pl.md) |
| 5 | [phase-5-recorder.pl.md](./phase-5-recorder.pl.md) |
| 6 | [phase-6-organization.pl.md](./phase-6-organization.pl.md) |
| 7 | [phase-7-analysis.pl.md](./phase-7-analysis.pl.md) |

### Faza 1 — Parser i usage

```
src/openaiHistory/domain.ts
src/openaiHistory/ids.ts
src/openaiHistory/usage.ts
src/openaiHistory/codex/rolloutTypes.ts
src/openaiHistory/codex/rolloutParser.ts
src/openaiHistory/codex/byteReader.ts
test/openaiHistoryUsage.test.ts
test/codexRolloutParser.test.ts
test/codexByteReader.test.ts
test/fixtures/codex-rollouts/
```

Bez importu `vscode`. Tylko syntetyczne fixture: meta sesji, kontekst tury, `token_usage_record`, same snapshoty, zła linia, rozcięty JSON, rozcięty UTF-8, fork, nieznane konto, dwa modele.

Gotowe, gdy rekord usage i snapshot token-count liczą się raz, sam snapshot nie staje się listą requestów, T=110000 dla liczb fixture, oba modele są emitowane, a rozcięta linia i rozcięty UTF-8 domykają się na następnym kawałku.

### Faza 2a — Magazyn

```
src/openaiHistory/store/types.ts
src/openaiHistory/store/migrations.ts
src/openaiHistory/store/sqlJsRequestStore.ts
src/openaiHistory/store/storeLease.ts
test/openaiHistoryStore.test.ts
```

Gotowe, gdy restart zwraca te same sumy, nieudany flush nie przesuwa checkpointu, a dwie nieznane instancje źródła zostają osobno.

### Faza 2b — Import

```
src/openaiHistory/codex/sourceRoot.ts
src/openaiHistory/codex/discover.ts
src/openaiHistory/codex/importer.ts
src/openaiHistory/historyService.ts
test/codexSourceRoot.test.ts
test/codexImporter.test.ts
```

Gotowe, gdy drugi import nic nie zmienia, skrócenie i podmiana przy tym samym rozmiarze nie dublują, fork nie podwaja globalnej sumy, a nieznany zakres to `unknown-source:…`. Testy używają katalogu tymczasowego. Scheduler zostaje poza `extension.ts`.

### Faza 3a — Zapytanie, wiersze, CSV, wiadomości

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

Gotowe, gdy przechodzą granice czasu ze zmianą w Warszawie, `Mixed (2)`, `9/10 priced`, stronicowanie keyset i prefiks formuły CSV.

### Faza 3b — Podpięcie hosta

```
src/extension.ts
src/ui/historyPanel.ts
src/config.ts
package.json
```

Zarejestrować usługę obok `UsageService`. Startować ją tylko przy włączonym imporcie. `activate()` nie czeka. Publikacja Cursora zostaje jak jest.

### Faza 3c — Webview zapytań

```
media/history.html
media/src/messages.js
media/src/tabs/queries.js
media/css/queries.css
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
```

`queries.css` tylko wtedy, gdy przełącznik albo szuflada potrzebuje reguły. `npm run build` odtwarza `media/history.js`.

Gotowe, gdy działają przełącznik, pasek, grupy, leniwe dzieci, szuflada, filtry, stany puste, CSV i dwuetapowe kasowanie, a Cursor dalej rysuje się z `data.events`.

### Faza 3d — Statistics, Charts, Optimize

```
src/openaiHistory/historyStats.ts
src/openaiHistory/historyCharts.ts
media/src/tabs/stats.js
media/src/tabs/optimize.js
media/src/charts/host.js
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
```

Pozostałe katalogi językowe to następna wiadomość.

### Faza 4 — Taryfa

```
src/openaiHistory/pricing/decimal.ts
src/openaiHistory/pricing/types.ts
src/openaiHistory/pricing/catalog.ts
src/openaiHistory/pricing/calculate.ts
src/openaiHistory/pricing/coverage.ts
test/openaiHistoryPricing.test.ts
```

Gotowe, gdy przechodzi fixture 0,16, brak stawek zostaje `—`, kwoty planu ChatGPT są podpisane API-equivalent, a wiersze trzymają `pricingVersion`. Żywy katalog może być pusty. Wydać 1.1.0 z `—`, gdy tokeny są dobre.

### Faza 5 — Rejestrator

Importować JSONL, który dopisuje aplikacja użytkownika: `begin`, `finish`, `fail`. Pola: `logicalOperationId`, `attemptId`, lokalne id rozmowy i tury, żądany model, zwrócony model, końcowe usage, id odpowiedzi, status, bezpieczny kod błędu. Bez klucza API, nagłówka Authorization, promptu, tekstu odpowiedzi, argumentów narzędzia i ciasteczek. Streaming zapisuje końcowe usage dostawcy. Przerwany stream to `partial` albo `missing`. Retry z nowym response id to nowy request. Chip OpenAI API pokazuje wtedy wiersze.

### Faza 6 — Porównanie organizacji

Po tym, jak wymagania produktu pozwolą na opcjonalnego klienta administracyjnego: klucz w Secret Storage, ręczne odświeżenie, poll co 15 minut, podmiana ostatnich koszyków, backoff przy 429. Statistics pokazuje lokalny szacunek i raportowany koszt organizacji dla tej samej organizacji, projektu, czasu, modelu i jednostki. Błąd synchronizacji zostawia lokalne wiersze. Te dolary nie są zapisywane na requestach i nie są saldem planu ChatGPT.

### Faza 7 — Przebiegi analizy

Zapis czasu, zakresu, wersji reguł i statusu. Nie przepisywać historycznego kosztu. Chip Optimized pasuje do tych id. Zmierzyć pierwszą ciepłą stronę przy 100 000 wierszach; 500 ms to cel pomiaru. Opcjonalne tytuły z app-servera to osobna zmiana: negocjowany schemat, bez startu procesu, tytuł zapasowy zostaje `#` plus krótkie id.

---

## 10. Akceptacja

| # | Reguła | Faza |
|---|---|---|
| 1 | Drugi import nie zmienia liczby ani sum | 2b |
| 2 | Rekord usage i snapshot token-count liczą się raz | 1 |
| 3 | Snapshoty skumulowane nie są listą requestów | 1 |
| 4 | Response id z forka nie podwajają globalnego zużycia | 2b |
| 5 | Ten sam tytuł, dwa zakresy, dwie grupy. Unknown zostaje unknown | 2b, 3a |
| 6 | Liczby fixture → T 110000 i 0,16 | 1, 4 |
| 7 | Brak taryfy albo usage to `—`. Częściowa grupa pokazuje `9/10 priced` | 3a, 4 |
| 8 | Dwa modele → `Mixed (2)` | 3a |
| 9 | Rozcięta linia JSONL i rozcięty UTF-8 | 1 |
| 10 | Skrócenie, podmiana przy tym samym rozmiarze, archiwum, restart | 2b |
| 11 | Przerwany stream jest częściowy, nie `$0` | 5 |
| 12 | Nowe response id to nowy request; to samo id nim nie jest | 5 |
| 13 | Zakres ze zmianą czasu w Warszawie nic nie gubi i nic nie dubluje | 3a |
| 14 | CSV wszystkich stron zgadza się z przefiltrowanymi sumami i nie ma wierszy grup | 3a |
| 15 | Sekrety, HTML promptu i formuły CSV nie są wykonywalne | 1–3c |
| 16 | Błąd synchronizacji administracyjnej zostawia lokalne wiersze | 6 |
| 17 | Koszt organizacji nie jest dodawany do requestów ani do planu ChatGPT | 6 |
| 18 | Webview dostaje jedną stronę | 3a, 7 |
| 19 | `activate()` nie czeka na import ani sieć | 3b |
| 20 | Current, Today i chipy ostatnich zapytań dalej publikują payload Cursora | 3b, 3d |

Sprawdzenie ręczne używa syntetycznego rolloutu w katalogu tymczasowym plus jednej lokalnej sesji porównanej z tabelą i CSV. Tej sesji nie commitować.

Przed scaleniem 1.1.0: `typecheck`, `test`, `build`. Sprawdzenie zgodności katalogów po wiadomości z dodatkowymi językami. Paczka to osobna wiadomość. Wymagania produktu, architektura, security, README, changelog i snapshot kodu aktualizują się w turze wydania.

---

## 11. Zostawić na ścieżce Cursora

- `src/usage/types.ts`, `service.ts`, `api.ts`, `parse.ts`
- `src/pricing/listPrice.ts`
- `src/ui/historyRows.ts` `toHistoryRows`
- grupowanie po tytule w `src/ui/queryGroups.ts`
- `src/ui/mtdPace.ts`, `src/burnRate/*`, `src/ui/criticalAlert.ts`
- `src/ui/exportCsv.ts` `buildQueriesCsv`
- budowniczowie paska statusu

Wspólne: `src/format.ts`, `src/time/`, `isSpike` w `src/spikes/threshold.ts`, `src/webview/messages.ts`, `src/config.ts`.

---

## 12. Bezpieczeństwo

Czytać linie rollout jako dane. Ograniczyć linię. Nie wykonywać ich. Nie otwierać plików auth Codexa ani ciasteczek, żeby zgadnąć konto. Nie wysyłać tokena Cursora, tokena Codexa ani klucza OpenAI do webview, CSV, logów, ustawień ani `globalState`. Schemat nie ma kolumn promptu ani wyniku narzędzia. Tytuły i kody błędów renderować jako tekst. Ścieżki importera trzymać wewnątrz rozwiązanego katalogu. Kasowanie usuwa tylko dane wtyczki, po drugim kliknięciu. Fixture są syntetyczne.
