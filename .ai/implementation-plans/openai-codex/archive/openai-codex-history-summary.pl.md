# Podsumowanie obu podejść — lokalna historia Codexa i requesty OpenAI

**Porównanie w tle.** Implementować z [openai-codex.md](../openai-codex.md) · [polski](../openai-codex.pl.md).
Półka: [README.pl.md](../README.pl.md).

Ten plik zapisuje, jak scalono dwa plany źródłowe. To nie jest plan implementacji.

| Rola | Dokument |
|---|---|
| Specyfikacja (kontrakt produktu) | [cursor-cost-tracker-openai-requests-spec.md](../../../reports/cursor-cost-tracker-openai-requests-spec.md) |
| Podejście A — plan wydania dopasowany do repozytorium | [codex-openai-queries.md](./codex-openai-queries.md) · [polski](./codex-openai-queries.pl.md) |
| Podejście B — plan inżynierski Codex / OpenAI | [openai-codex-request-history-plan.md](./openai-codex-request-history-plan.md) · [polski](./openai-codex-request-history-plan.pl.md) |
| Kanoniczna wersja angielska tego podsumowania | [openai-codex-history-summary.md](./openai-codex-history-summary.md) |

**Status:** zaplanowane. Nie zaczęte.
**Wydanie:** **1.1.0** MINOR dla faz 1–4 (lokalny Codex, tabela, tokeny, nieznany koszt, CSV). Fazy 5–7 to kolejne MINOR-y. W turze fazy nie podbijać `package.json`.
**Zależy od:** obecnego potoku Cursora (`UsageService` → `toHistoryRows` → `media/src/tabs/queries.js`). Tego potoku nie przepisujemy.
**Konflikt:** wygrywa [prd.md](../../../context/prd.md). Funkcja nie zmienia rozliczenia Cursora, jedynego blokującego modala critical alert ani ukrytej zakładki Leaderboard.

Jedna faza na jedną wiadomość w Agent. Faza wymienia wyłącznie ścieżki podane pod tą fazą. Języki w fazie UI to `en` i `pl`. Pozostałe katalogi to następna wiadomość.

---

## 1. Werdykt

**Lepszy plan do wydania to podejście A.** Już pasuje do tej wtyczki: jeden webview, liczby Cursora zostają osobno, import za zgodą, klucze ustawień, przełącznik źródła, który nie wchodzi na pasek statusu, oraz fazy na tyle małe, że mieszczą się w jednej turze Agenta.

**Podejście B jest lepszą specyfikacją inżynierską** magazynu, czytnika bajtów, deduplikacji, pieniędzy, prywatności i bramek, które mają zostać zamknięte do późniejszego wydania. Kilka wyborów magazynu z A jest w tym repozytorium błędnych i poniżej są zastąpione.

Implementować z **tego podsumowania**. Nie wybierać jednego pliku źródłowego i nie ignorować drugiego.

### Co które podejście ustaliło trafnie

| Temat | Zostaje z | Dlaczego wygrywa |
|---|---|---|
| Pierwsze wydanie to tylko lokalny Codex, użyteczny bez klucza API | Oba | Kolejność ze specyfikacji: importer → tabela → rejestrator → porównanie organizacji. |
| Last N, pasek statusu, burn rate, prognoza, modal krytyczny i CSV zostają na zdarzeniach Cursora | Oba | Wiersz Codexa nie może zmienić Current, Today ani modala `!`. |
| Import za zgodą, jednorazowa podpowiedź „znaleziono sesje”, osobne ustawienia Codexa | A | Skan `~/.codex` przy aktywacji jest niespodzianką dla prywatności. B uruchamia import przy starcie. |
| Przełącznik pod paskiem zakładek, pigułki ghost, brak kolumny CONTEXT, szuflada, `9/10 priced`, pasek pokrycia | A | Pasuje do obecnego panelu i do informacji ze zrzutów, bez drugiego webview. |
| Otwarcie z Current / Today / chipa ostatniego zapytania wymusza źródło **Cursor** | B | To kontrolki liczb Cursora. Zapisane źródło Codex ukryłoby liczniki planu. |
| Zapis `cursorCost.querySource` na kolejne otwarcia panelu historii | A | Kto pracuje w Codex local, nie powinien wracać do Cursora przy każdym ponownym otwarciu panelu. |
| Przestrzeń `src/openaiHistory/`, parser Codexa w `codex/` | B | Faza 5 to drugie źródło. `src/codex/` zostawiłby rejestrator OpenAI bez miejsca. |
| Zapis przez sql.js za interfejsem magazynu; atomiczna podmiana pliku tymczasowego | B | `node:sqlite` w tym repo otwiera bazę Cursora **tylko do odczytu**. Node 18 nie gwarantuje `DatabaseSync`. Produkt zabrania ścieżki wyłącznie natywnego SQLite. „Wolimy DatabaseSync do zapisu” z A nie wchodzi do 1.1.0. |
| Pełny schemat 1.1.0, dzierżawa, strony keyset, deduplikacja w aplikacji, kwoty jako tekst dziesiętny | B | Częściowe unikalne indeksy SQL i kursory offsetowe są słabsze na sql.js i przy dwóch oknach IDE. |
| Ścieżki bezwzględne zostają na hoście. Pasek mówi „ten komputer”, nie ścieżkę home | B | A pokazuje ścieżkę na pasku. Rozwiązany katalog należy tylko do karty Settings. |
| Wybieralny chip **OpenAI API** z jawnym stanem „niepodłączone” | A, tekst z B | Wyłączony chip chowa granicę. Statistics, Charts i Optimize nie mogą spaść do liczb Cursora. |
| `en` + `pl` w fazie webview; pozostałe katalogi później | A | Faza B, która edytuje wszystkie jedenaście katalogów naraz, psuje budżet tury. |
| Dokumenty (PRD, security, README, CHANGELOG, snapshot) wchodzą z wydaniem, które zmienia zachowanie | Scalenie | Faza 0 z B przepisuje dokumenty produktu przed jakimkolwiek kodem. Nie opisywać funkcji jako wydanej, dopóki nie jest. |
| Play otwiera zakładkę Optimize. Nie woła `composer.openComposer` | Oba | Id wątku Codexa nie jest id composera Cursora. |
| Run Optimize przy Codexie wkleja brief samych liczb do otwartego czatu Agenta i nie wysyła go | A, ograniczone przez B | Ten sam gest co dzisiejsze Optimize. Brief ma liczby i identyfikatory. To nie jest ponowne wykonanie i nie ma w nim promptu ani tekstu narzędzia. |
| Usage/Costs organizacji dopiero po zmianie PRD i security | B | 1.1.0 nie dodaje klienta `api.openai.com` ani klucza administracyjnego. |
| Rejestrator to oczyszczony JSONL, który dopisuje aplikacja użytkownika | Kształt z A, zakaz pól z B | W 1.1.0 nie ma workspace `packages/`, proxy TLS ani lokalnego serwera HTTP. |

### Odrzucone

- Zgadywanie ceny API modelu Codexa z `src/pricing/` albo z podobnej nazwy.
- Czytanie `auth.json`, ciasteczek albo tokenów logowania Codexa, żeby zgadnąć konto.
- Zapis promptu, odpowiedzi albo tekstu narzędzia. Tytuły w 1.1.0 to `#` plus 8 znaków `thread_id`.
- Traktowanie `history.jsonl`, `token_count`, `turn_token_usage` albo `thread_token_usage` jako dodatkowych requestów obok `payload.usage`.
- Jedna wspólna suma szacunku API, kosztu raportowanego przez organizację i ekwiwalentu planu ChatGPT.
- Drugi blokujący modal. Usunięcie zaimportowanych danych to dwuetapowa kontrolka w Settings.
- Wirtualizacja 100 tys. wierszy jako warunek scalenia 1.1.0. 1.1.0 paginuje. 500 ms ciepłej strony to cel pomiaru w fazie 7.
- App-server jako importer. Backfill to pliki. App-server później to opcjonalne tytuły tylko do odczytu, z negocjacją wersji, bez uruchamiania ani wznawiania agenta.

---

## 2. Zamknięte decyzje produktowe

Zamykają pytania otwarte na końcu podejścia B.

1. **Jeden katalog Codexa w 1.1.0.** Wiele katalogów to późniejszy minor. Kolejność: niepuste `cursorCost.codexHome`, potem bezwzględne `CODEX_HOME`, które istnieje i jest katalogiem, potem `~/.codex`.
2. **Katalog jest ustawieniem paczki.** `deviceId` to losowy identyfikator tworzony raz w `globalState` (`cursorCost.codexDeviceId`). `sourceInstanceId` to skrót rozwiązanego realpath, nie identyfikator konta i nie ścieżka repozytorium.
3. **Import domyślnie wyłączony** (`cursorCost.codexImportEnabled` = false). Przy wyłączonym imporcie tani test istnienia może zauważyć `sessions/` i pokazać jedną zamykalną linijkę. Treść plików czytamy dopiero po włączeniu.
4. **Brak domyślnej mapy model → cena.** Historia tokenów wychodzi z kosztem `—`. Późniejsza ręczna mapa jest oznaczona jako założenie użytkownika i da się ją usunąć bez przepisywania usage.
5. **Raport organizacji zostaje poza wtyczką**, dopóki PRD nie pozwoli na opcjonalnego klienta administracyjnego `api.openai.com`, a klucz nie leży w `context.secrets`. Bez nowego modala na klucz.
6. **Chip Optimized przy Codexie** pasuje tylko do zapisanego przebiegu analizy. Do fazy 7 ten zbiór jest pusty. Sam cache hit nie jest „optimized”.
7. **Pasek statusu zostaje cursorowy.** W 1.1.0 nie ma chipa Codexa.
8. **Etykieta grupy** to `4 turns · 28 model requests`, gdy obie liczby istnieją. Pliki wyłącznie ze snapshotów nie wymyślają liczby requestów.
9. **Nieznane konto** ma klucz zakresu `unknown-source:<sourceInstanceId>`. To nigdy nie jest e-mail logowania Cursora i nigdy nie jest SQL NULL.
10. **Forki:** skopiowany `responseId` to jeden globalny request. Rozmowa potomna może do niego linkować. Jej własny wydatek liczy odpowiedzi, które pierwszy raz pojawiają się na tym dziecku.
11. **Ten komputer.** Wtyczka UI czyta maszynę, na której działa host UI. Okno Remote SSH nie skanuje hosta SSH. Pasek to mówi.

---

## 3. Co wchodzi do 1.1.0

- Wykrycie jednego lokalnego katalogu Codexa i przyrostowy import `sessions/**/*.jsonl` oraz `archived_sessions/**/*.jsonl`.
- Zapis znormalizowanych requestów w `<ExtensionContext.globalStorageUri>/openai-request-history.sqlite`. Nigdy nie zapisujemy `~/.codex`, `state.vscdb` ani workspace.
- Przełącznik **Cursor | Codex local | OpenAI API** na Last N, Statistics, Charts i Optimize. Ukryty na Support i Settings.
- Grupowanie po `(provider, accountScopeKey, conversationId)`, leniwe dzieci, bezpieczna szuflada szczegółów, filtry, sort po stronie hosta, strony keyset, CSV wszystkich pasujących requestów.
- Tokeny, gdy model, konto, cena albo tryb rozliczenia są nieznane. Brakujące liczby wyglądają jak `—`.
- Statistics, Charts i wskazówki wysokiego zużycia dla Codexa. Sekcje Cursora zostają, gdy wybrane jest źródło Cursor.

### Świadomie poza 1.1.0

| Element | Kiedy |
|---|---|
| JSONL dla własnych wywołań OpenAI aplikacji | Faza 5, późniejszy minor |
| `GET /v1/organization/usage/completions` i Costs API | Faza 6, po zgodzie PRD i security |
| Tytuły z Codex app-server | Opcja fazy 7 albo osobny minor. Backfill zostaje w plikach. |
| Backfill zapisanych Chat Completions | Niezaplanowane |
| Osobista historia strony ChatGPT | Brak źródła. Nie obiecywać. |
| Przechwytywanie TLS, pliki auth Codexa, drugi modal, sumy Codexa na pasku statusu | Nigdy w tej funkcji |
| Scalanie dwóch wątków, bo tytuły są takie same | Nigdy. Grupowanie po tytule zostaje tylko dla Cursora (`titleGroupKey`). |

---

## 4. Panel

Znaczniki w `media/history.html`. Zachowanie w `media/src/`. Przebudowa: `npm run build`. Nie edytować ręcznie `media/history.js` ani `media/history.css`.

### 4.1 Przełącznik źródła

Kontrolka segmentowa **pod paskiem zakładek**, na pełną szerokość, widoczna na Last N, Statistics, Charts i Optimize.

```
[ Last 1000 Cursor queries ] [ Statistics ] [ Charts ] [ Optimize ] [ Support ] [ Settings ]

Source   ( Cursor )  ( Codex local )  ( OpenAI API )
```

- Pigułki ghost. Nie `--vscode-button-background`. `aria-pressed` na wybranym źródle.
- Domyślnie `cursor`. Zapis jako `cursorCost.querySource` (`cursor` | `codex-local` | `openai-api`).
- Current, Today i chip ostatniego zapytania otwierają panel **na Cursorze** i przy tej nawigacji zapisują `querySource` z powrotem jako `cursor`. Samo polecenie historii szanuje zapisane źródło.
- Etykieta zakładki idzie za źródłem: `Last N Cursor queries`, `Codex queries` albo `OpenAI API`.
- Zmiana źródła nie woła API zużycia Cursora.
- **Refresh** na pasku wysyła `{ type: 'refresh' }` dla Cursora, `{ type: 'codex.refresh' }` dla Codexa (ponowny skan), `{ type: 'openai.refresh' }` dla OpenAI API. Do fazy 5 odświeżenie OpenAI zwraca stan niepodłączony.
- **OpenAI API** w 1.1.0 da się wybrać. Tekst: `OpenAI API recorder is not connected. This extension does not see other programs’ calls to OpenAI.` Statistics, Charts i Optimize pokazują ten pusty stan. Nie używają sum Cursora.

### 4.2 Pasek pokrycia (tylko Codex local)

Jedna linia monospace pod przełącznikiem. Sam tekst. Wygrywa najcięższy wariant.

| Stan | Linia |
|---|---|
| Import wyłączony, `sessions/` istnieje | `Codex sessions found on this computer. Turn on import in Settings.` Da się zamknąć. |
| Import wyłączony, nic nie znaleziono | ukryty |
| Import włączony, brak katalogu | `Codex home not found` |
| Import włączony, katalog pusty | `No local Codex history found` |
| Częściowe pokrycie parsera | `Partial history · N unrecognized lines` |
| Brak id konta w plikach | `account unknown` w zwykłej linii. To nie jest kolor błędu. |
| Ostatni skan się nie udał | `Sync failed · showing data from 18:02` i zostają poprzednie wiersze |
| Okno zdalne | prefiks `This computer (not the SSH host) ·` |

Kształt zwykłej linii:

`Local history · this computer · account unknown · 12 sessions · 7 Oct – 14 Oct · last sync 18:12`

Pasek nie zawiera bezwzględnej ścieżki Codexa. Settings pokazuje rozwiązany katalog.

### 4.3 Pasek narzędzi przy wybranym Codexie

| Kontrolka | Zachowanie |
|---|---|
| Over Warn at | Filtr po stronie klienta. Wiersz pasuje, gdy tokeny **requestu** albo **suma grupy** są ≥ `cursorCost.spikeTokenThreshold`. `!` używa `isSpike`. **Modal** krytyczny się nie odpala. |
| Optimized | Tylko zapisane id analizy. Do fazy 7 nic nie pasuje. |
| Group by conversation | `cursorCost.codexGroupByConversation`, domyślnie **true**. Nie zapisuje `cursorCost.groupQueriesByConversation`. |
| Export CSV | `{ type: 'codex.exportCsv' }`. Płaska lista requestów, aktywne filtry, wszystkie strony. |
| Data | Presety: Last 7 days, This month, All imported, Custom. Własne From/To to lokalne `YYYY-MM-DD`, przedział `[from, to)`, zapis przy Apply / Enter / blur. Pusty własny zakres oznacza cały import. Nie czyta ani nie zapisuje `cursorCost.historyFromDate`. |
| Konto | All / Unknown / każdy wykryty zakres. Unknown nie jest przepisywane na konto Cursora. |
| Model | Modele obecne przy pozostałych filtrach, plus Unknown. |
| Status | completed, failed, cancelled, incomplete, unknown. Unknown jest normalny. |
| Sort | Domyślnie czas malejąco. `cost-desc` i `tokens-desc` lecą w magazynie. |

### 4.4 Tabela

Ta sama skorupa: `.table-wrap`, poziomy scroll, przyklejona pierwsza kolumna, liczby monospace, tylko `--vscode-*`.

**Kolumny Cursora zostają:** TIME, MODEL, CONTEXT, COST, TOKENS, INPUT / OUTPUT, KIND.

**Kolumny Codexa.** CONTEXT odpada. Colspan wynika z widocznych kolumn.

| Kolumna | Płaski request | Grupa rozmowy |
|---|---|---|
| chevron | brak | przycisk, `aria-expanded` |
| TIME | czas obserwacji, strefa lokalna w tooltipie | tytuł albo `#abcd1234`; `4 turns · 28 model requests`; aktywność `14 Oct 09:07 → 14 Oct 11:02` |
| MODEL | nazwa albo `Unknown`. Tooltip: `response` albo `turn context` | jeden model albo `Mixed (2)` |
| COST | `Est. $0.16`, `API-equiv. $0.16`, kwota raportowana albo `—`. `< $0.01`, gdy zapisana wartość jest niezerowa i przy dwóch miejscach znika. | Suma **jednej** podstawy. `9/10 priced`, gdy pokrycie jest częściowe. |
| TOKENS | `I + O`. `!`, gdy ostrzeżenia są włączone i wiersz jest nad Warn at. | Suma unikalnych requestów w filtrze. Play siedzi w tej komórce. |
| INPUT / OUTPUT | `15347 / 185`. Tooltip: cache inputu i reasoning. | Sumy. Oznaczenie `partial`, gdy któremuś dziecku brakuje usage. |
| KIND | `API`, `ChatGPT plan`, `Unknown` | jeden rodzaj albo `Mixed` |

Dzieci nie wchodzą do pierwszego rysowania. Chevron wysyła `{ type: 'codex.expand', conversationId, accountScopeKey }`. Rozwijanie Cursora zostaje oparte na indeksach w `queries.js` i nie wysyła `codex.expand`.

Rozmiar strony 100. Stopka **Load more** używa nieprzezroczystego kursora keyset `(krotka sortowania, id)`. Host przycina `limit` do 1–100. Wiadomość Cursora `{ type: 'data' }` nie dostaje tablicy Codexa.

Te same tytuły nie scalają grup. Brak id rozmowy daje osobną grupę z krótkim id, a nie jeden globalny worek Unknown.

### 4.5 Szuflada szczegółów

Kliknięcie requestu otwiera szufladę **pod tabelą**. To nie jest modal VS Code i nie jest nowy edytor. Render przez `textContent`.

- Źródło `Codex local`, etykieta urządzenia, zakres, pewność (`unknown` / `reported by file` / `assigned by you`)
- Rozmowa, sesja, tura, id odpowiedzi (krótki pokaz; pełne id wolno w kopiowaniu, bo to nie sekret)
- Jakość usage oraz input, cache inputu, output, reasoning, total
- Podstawa kosztu, formuła słowami, wersja cennika albo `Price unavailable`
- Status i sam **kod** błędu
- Czas obserwacji. Start / koniec tylko wtedy, gdy plik je ma. `observedAt` nie jest podpisywane jako start.
- Kopiuj szczegóły: te same pola w zwykłym tekście

Enter na wierszu z fokusem otwiera szufladę. Escape ją zamyka. Chevron jest osobnym przyciskiem.

### 4.6 Karta ustawień

Nowa karta **Codex** w `#settingsView`, po **Recent queries** i przed **Refresh**.

| Pole | Klucz | Domyślnie |
|---|---|---|
| Import lokalnych sesji Codexa | `cursorCost.codexImportEnabled` | false |
| Katalog Codexa | `cursorCost.codexHome` | `""` |
| Grupuj Codex po wątku | `cursorCost.codexGroupByConversation` | true |
| Źródło zapytań | `cursorCost.querySource` | `cursor` |

Linie tylko do odczytu: rozwiązany katalog, „ten komputer”, liczba sesji, zakres dat, ostatni skan, wersja parsera `rollout-v1`, liczba nierozpoznanych linii.

**Rescan** wysyła `codex.refresh`. **Delete imported data** jest dwuetapowe: przycisk zmienia się w „Delete imported Codex data — confirm”, drugie kliknięcie wysyła `codex.forget`. Kasuje wyłącznie wiersze należące do wtyczki.

W 1.1.0 nie ma pola na klucz administracyjny OpenAI.

### 4.7 Statistics, Charts, Optimize

**Wybrany Cursor:** obecne sekcje, bez zmian.

**Wybrany Codex local:**

- Ukryć liczniki planu Current/Today, kartę burn rate, kartę generated lines i prognozę **planu** na miesiąc. Nie rysować ich jako zera.
- Cztery karty: miks tokenów (input, cache inputu, output, reasoning); liczniki (requesty modelu, tury, rozmowy); udział wycenionych (`26/28`); szacunek API i ekwiwalent API obok siebie. Karta kosztu raportowanego pojawia się tylko wtedy, gdy taka kwota istnieje. Żadna karta nie dodaje tych kwot.
- Cache hit to `sum(cache inputu) / sum(input)` tam, gdzie obie wartości są niepuste. To nie jest średnia procentów wierszy.
- Wykresy: dzienne słupki tokenów i dzienne słupki szacowanego kosztu z serii Codexa. Dzień bez wierszy to luka, nie potwierdzone zero. Na tej serii nie ma linii prognozy Cursora.
- Optimize: wskazówki dla wybranego wiersza Codexa albo ostatniego wiersza na poziomie Warn at lub wyżej — wzrost inputu wobec poprzedniego requestu w tym samym wątku, niski udział cache, wiele requestów modelu w jednej turze. Każda linia to hipoteza. Prognozowane oszczędności są podpisane jako prognoza. Ustalenia nie czytają tekstu promptu.
- **Play** wybiera ten wiersz i otwiera Optimize. Nie woła `composer.openComposer` i nie uruchamia requestu.
- **Run Optimize** wkleja brief samych danych rozliczeniowych do otwartego czatu Agenta (`composer.focusComposer`) i nie wysyła go.

---

## 5. Model danych

Nowe typy w `src/openaiHistory/domain.ts`. Nie rozszerzać `UsageQuery`. Cursorowe `$0` planu wliczonego i nieznana cena Codexa to różne fakty.

```ts
type RequestSource = 'codex-local' | 'openai-api'
type AccountConfidence = 'source-reported' | 'user-assigned' | 'unknown'
type ModelEvidence = 'response' | 'turn-context' | 'requested' | 'unknown'
type BillingMode = 'api' | 'chatgpt-plan' | 'unknown'
type RequestStatus = 'completed' | 'failed' | 'cancelled' | 'incomplete' | 'unknown'
type UsageQuality = 'reported' | 'derived' | 'partial' | 'missing'
type CostCoverage = 'complete' | 'tokens-only' | 'partial' | 'unknown'
```

`TrackedRequest` idzie za sekcją 6 specyfikacji: tożsamość, `accountScopeKey` (zawsze niepusty), pewność, identyfikatory rozmowy / sesji / tury / odpowiedzi, czasy, model i dowód, tryb rozliczenia, status, usage, jakość, `estimatedApiCostUsd` i `reportedCostUsd` jako tekst dziesiętny albo null, `pricingVersion`, `costCoverage`, `parserVersion`. Pochodzenie `(sourceFileId, generation, byteOffset)` żyje na obserwacji, nie w payloadzie webview.

Null oznacza niewiedzę. Zero oznacza zaraportowane zero. Obecność usage nie ustawia statusu `completed`.

### Reguły tokenów i pieniędzy

```text
I = tokeny wejścia, łącznie z cache
C = cache wejścia, podzbiór I
O = tokeny wyjścia, łącznie z reasoning
R = reasoning, podzbiór O
T = I + O
```

Nie liczyć `I + C + O + R`. Gdy są wszystkie cztery, sprawdzić `0 ≤ C ≤ I` oraz `0 ≤ R ≤ O`. Gdy `total_tokens` się nie zgadza, zostawić surowe liczby i ustawić flagę anomalii. Nie poprawiać ich po cichu.

Koszt, tylko gdy znamy model, taryfę i stawki, liczy helper bigint o stałej skali. Zapis to kanoniczny tekst dziesiętny. Zaokrąglenie dopiero w formatowaniu i CSV.

```text
((I - C) × inputRate + C × cachedInputRate + O × outputRate) / 1_000_000
```

Fixture (stawki fikcyjne, nie żywy cennik): I=100000, C=80000, O=10000, R=2000, stawki 2 / 0,5 / 8 za milion → **0,16**, T=110000. Reasoning nie jest czwartym składnikiem.

Gdy `C` jest null, nie podstawiać `0` i nie pokazywać jednej pewnej ceny. Pokazać `—` albo jawny zakres. Nieznany model albo brak stawki → `—`. Niezerowe `cache_write_input_tokens` zostaje zapisane i niewycenione. Nie kopiować stawek z `src/pricing/listPrice.ts`.

`billingMode = chatgpt-plan`: `reportedCostUsd` zostaje null, dopóki plik nie raportuje opłaty. Jawnie zmapowana taryfa API jest podpisana **API-equivalent**. Nie dzielić abonamentu ChatGPT przez requesty. Ścieżka w `.codex` sama z siebie nie oznacza planu ChatGPT; w przeciwnym razie KIND to `Unknown`.

### Tabele w 1.1.0

Plik: `openai-request-history.sqlite` w global storage.

| Tabela | Po co |
|---|---|
| `schema_migrations` | Uporządkowane migracje. |
| `source_instances` | Odcisk katalogu, id urządzenia, ostatni skan. Ścieżka nie jest kontem. |
| `source_files` | Tożsamość, generacja, rozmiar, mtime, odcisk prefiksu. Nie idzie do webview. |
| `import_checkpoints` | Id pliku, generacja, offset bajtowy, `partial_bytes`, kontekst parsera. |
| `conversations` | Zakres, id rozmowy, opcjonalny rodzic, tytuł, liczba tur, pierwszy i ostatni czas. Bez treści. |
| `requests` | Jeden zdeduplikowany request biznesowy. Usage i koszt mogą być null. |
| `request_observations` | Każde pochodzenie. Unikalność `(source_file_id, generation, byte_offset)`. |
| `usage_snapshots` | Liczniki skumulowane. Nigdy nie są rysowane jako requesty modelu. |

Późniejsze migracje, nietworzone w fazie 2: `pricing_versions` (faza 4), `http_attempts` (faza 5), `billing_buckets` (faza 6), `optimization_runs` (faza 7).

Unikalność, którą wymusza aplikacja, nawet gdy SQL jest słaby:

```text
requests (provider, account_scope_key, response_id), gdy response_id jest niepusty
request_observations (source_file_id, generation, byte_offset)
```

Indeksy: `(source, account_scope_key, observed_at, id)`, `(conversation_id, observed_at, id)`, `(model, observed_at, id)`.

Jedna dzierżawa w global storage. Drugie okno czyta magazyn i nie importuje. Zapisy są idempotentne. Nieudany flush zostawia poprzedni plik i pokazuje błąd synchronizacji. Paczka importu i checkpoint commitują się razem. Między paczkami oddajemy wątek. W `activate()` nie czekamy na import.

`RequestStore` to interfejs. W 1.1.0 jest jedna implementacja: sql.js, migracja w pamięci, zapis pliku tymczasowego obok, rename. Natywny zapis można zmierzyć później za tym samym interfejsem.

---

## 6. Importer

Moduły w `src/openaiHistory/codex/`. Wersja parsera **`rollout-v1`**. Nowy kształt rolloutu dostaje własną wersję i zanonimizowany fixture.

### Wykrywanie

Tylko odczyt. Wyliczyć zwykłe pliki w `sessions/` i `archived_sessions/`. Nie iść za symlinkiem, który po `realpath` wychodzi poza wybrany katalog. `history.jsonl` nie jest usage. Brak katalogu to `Codex home not found`, a nie wyjątek przy aktywacji.

### Odczyt przyrostowy

- Checkpoint: id pliku, generacja (rozmiar plus ograniczony odcisk prefiksu; skrócenie albo podmiana przy tym samym rozmiarze zaczyna nową generację), zatwierdzony offset bajtowy, kontekst parsera (sesja, tura, model) oraz `partial_bytes`.
- Czytać bufory od offsetu. Dekodować tylko bajty do ostatniego `\n`. Zostawić ogon, także rozcięty znak UTF-8.
- Offsety są w bajtach, nie w długości stringa JavaScript.
- Ograniczyć rozmiar linii. Linia zła albo nieznana podbija licznik diagnostyczny i nie jest pokazywana.
- Nie kasować wierszy trackera tylko dlatego, że plik logu zniknął.
- `fs.watch` to podpowiedź, debounce 750 ms. Kontrolny skan co 30 s jest wiążący, gdy import jest włączony, także przy zamkniętym panelu. Skan najpierw bierze stat, a czyta brudne ogony. Głębokość kolejki 1. Import wyłączony oznacza brak watchera i brak czytania treści.

### Mapowanie linii

| `type` | Akcja |
|---|---|
| `session_meta` | Uzupełnić sesję, wątek, opcjonalne id konta. Powtórka nie tworzy drugiej rozmowy. |
| `turn_context` | Zapamiętać model tej tury (`modelEvidence: turn-context`). Niższy priorytet niż model z odpowiedzi. |
| `token_usage_record` | Kandydat requestu wyłącznie z `payload.usage`, plus identyfikatory. Znacznik czasu linii to `observedAt`. |
| `event_msg` z `token_count` | Snapshot albo kontrola. Nie drugi request. |
| Tekst użytkownika, agenta, narzędzia, instrukcji | Zignorować treść. Nie zapisywać jej i nie używać jako tytułu w 1.1.0. |
| Zdarzenie końca albo błędu | Ustawić status tylko wtedy, gdy payload nazywa tę samą odpowiedź albo turę. |
| Cokolwiek innego | Pominąć. Podbić licznik nierozpoznanych. |

Brak modelu → `Unknown`, nie aktualny domyślny model Codexa użytkownika.

### Tożsamość

Preferowany klucz: `(provider = openai, accountScopeKey, responseId)`.

Brak `responseId`: tymczasowe id `(sourceInstanceId, fileGeneration, byteOffset)`. `token_usage_record` **z** `responseId` to jeden request modelu. Ta sama odpowiedź widziana później z rejestratora API to druga obserwacja i ten sam request.

Nie deduplikować po tekście promptu, liczbie tokenów, czasie, modelu ani tytule.

Same snapshoty skumulowane: delty zapisać jako `derived` z przedziałem czasu. Spadek, reset albo brak bazy to luka, nie `max(delta, 0)`. Gdy wiersze request-level pokrywają ten przedział, wyłączyć nakładające się wiersze derived z sum.

---

## 7. Kontrakt hosta

Dodać warianty w `src/webview/messages.ts`. Nie przeciążać cursorowych `refresh` ani `exportCsv`. Te same stringi typów odbić w `media/src/messages.js`.

Webview → host:

- `setQuerySource` `{ value }`
- `codex.refresh`
- `codex.query` `{ correlationId, filterRevision, from, to, accountScopeKey, model, status, groupBy, sort, costBasis, cursor, limit }`
- `codex.expand` `{ correlationId, filterRevision, conversationId, accountScopeKey }`
- `codex.details` `{ correlationId, id }`
- `codex.exportCsv` — filtry ostatniego zapytania, wszystkie strony
- `codex.forget`
- `openai.refresh` — niepodłączone do fazy 5
- `codex.analyze` `{ id }` — faza 7; do tego czasu zakładka Optimize może rysować lokalne wskazówki bez zapisu przebiegu

Host → webview, obok obecnej wiadomości `data` Cursora:

- `codex.status`
- `codex.result` `{ correlationId, filterRevision, rows, nextCursor, totals, coverage, lastSyncAt }`
- `codex.children`
- `codex.detail`
- `codex.exportReady` — host otwiera też dialog zapisu, tak jak CSV Cursora
- `operation.error` `{ correlationId, message }`

Webview odrzuca odpowiedź ze starym correlation id albo starą rewizją filtra. Host odrzuca ścieżki, SQL, URL-e, sekrety i limit poza 1–100. Wiersze payloadu to model widoku z §4.4, nie linia JSONL i nie pełny `TrackedRequest`.

Kolejność zapytania: znormalizowane requesty → źródło, konto, model, status, `[from, to)` → jedna podstawa kosztu → sort i strona keyset. Tryb grup liczy agregaty w SQL, potem stronuje grupy. Sumy biorą się z agregatów SQL, nie z pierwszej strony i nie z DOM. Granice czasu używają `src/time/`, żeby doby ze zmianą czasu w Warszawie nie traktować jak 24 godzin.

`HistoryPanel` dostaje router Codexa. `UsageService` zostaje jedynym właścicielem ciasteczek Cursora i pollingu Cursora. `PanelPublisher` dalej publikuje wyłącznie payload Cursora.

### CSV

`src/openaiHistory/exportCsv.ts`. Kolumny w kolejności z sekcji 16 specyfikacji. Kropka dziesiętna `.`. Null → pusta komórka. Cudzysłowy przy przecinkach i nowych liniach. Gdy tytuł zaczyna się od `=`, `+`, `-`, `@` albo tabulacji, dopisać z przodu pojedynczy apostrof. Bez promptów, sekretów i ścieżek bezwzględnych. Agregaty rozmów to osobna, późniejsza akcja, nie dodatkowe wiersze w tym pliku. Sumy pliku requestów zgadzają się z przefiltrowanymi sumami SQL.

---

## 8. Fazy

Każda faza to jedna tura Agenta: wymienione pliki, Vitest dla tych plików, jedno `npm test` i `typecheck` na końcu. Gdy faza nadal jest za szeroka, ciąć na granicy litery i stanąć. Nie zaczynać następnej litery w tej samej turze.

### Faza 1 — Parser i matematyka usage

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

Bez importu `vscode`. Fixture są syntetyczne: meta sesji, kontekst tury, `token_usage_record`, same snapshoty, zła linia, rozcięty JSON, rozcięty UTF-8, fork, nieznane konto, dwa modele. Bez prawdziwego rolloutu, bez id konta, bez promptu.

Gotowe, gdy przechodzą punkty akceptacji specyfikacji 2, 3, 6 (połowa tokenowa: T=110000), 8 (parser emituje oba modele) i 9. Podwójny import to czyste scalenie po response id.

### Faza 2a — Magazyn

```
src/openaiHistory/store/types.ts
src/openaiHistory/store/migrations.ts
src/openaiHistory/store/sqlJsRequestStore.ts
src/openaiHistory/store/storeLease.ts
test/openaiHistoryStore.test.ts
```

Gotowe, gdy magazyn po restarcie zwraca te same sumy, nieudany flush nie przesuwa checkpointu, a dwie nieznane instancje źródła się nie zlewają.

### Faza 2b — Wykrywanie i import

```
src/openaiHistory/codex/sourceRoot.ts
src/openaiHistory/codex/discover.ts
src/openaiHistory/codex/importer.ts
src/openaiHistory/historyService.ts
test/codexSourceRoot.test.ts
test/codexImporter.test.ts
```

Gotowe, gdy drugi import nic nie zmienia, skrócony albo podmieniony plik importuje się ponownie bez duplikatów, fork nie podwaja globalnej sumy, a nieznany zakres to `unknown-source:…`. Scheduler zostaje poza `extension.ts` do fazy 3b. Testy używają katalogu tymczasowego i fałszywego zegara.

### Faza 3a — Zapytania, wiersze, CSV, wiadomości

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

Gotowe, gdy filtry, granice czasu ze zmianą w Warszawie, `Mixed (2)`, `9/10 priced`, stronicowanie keyset i prefiks formuł CSV przechodzą bez webview.

### Faza 3b — Podpięcie hosta

```
src/extension.ts
src/ui/historyPanel.ts
src/config.ts
package.json
```

Zarejestrować usługę obok `UsageService`. Startować ją tylko przy włączonym imporcie. `activate()` na nią nie czeka. Klucze ustawień z §4.6. Ścieżka publikacji Cursora bez zmian.

### Faza 3c — Webview zapytań

```
media/history.html
media/src/messages.js
media/src/tabs/queries.js
media/css/queries.css
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
```

`queries.css` tylko wtedy, gdy szuflada albo przełącznik źródła potrzebuje reguły. `npm run build` odtwarza `media/history.js`. Gotowe, gdy przełącznik, pasek, tabela grup, leniwe dzieci, szuflada, filtry, stany puste, CSV i dwuetapowe kasowanie działają na bazie z fazy 2, a źródło Cursor dalej rysuje się z `data.events`.

### Faza 3d — Statistics, Charts i Optimize dla źródła

```
src/openaiHistory/historyStats.ts
src/openaiHistory/historyCharts.ts
media/src/tabs/stats.js
media/src/tabs/optimize.js
media/src/charts/host.js
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
```

Pozostałe katalogi językowe to **następna** wiadomość, potem raz `npm run sync-i18n -- check`.

### Faza 4 — Taryfa

```
src/openaiHistory/pricing/decimal.ts
src/openaiHistory/pricing/types.ts
src/openaiHistory/pricing/catalog.ts
src/openaiHistory/pricing/calculate.ts
src/openaiHistory/pricing/coverage.ts
test/openaiHistoryPricing.test.ts
```

Gotowe, gdy przechodzi fixture 0,16, brak stawek zostaje `—`, kwoty planu ChatGPT są podpisane API-equivalent, a wiersze trzymają `pricingVersion`. Żywy katalog może być pusty. Wydać 1.1.0 z uczciwym kosztem `—`, gdy tokeny są dobre. Bez cichej mapy na `src/pricing`.

### Faza 5 — Import rejestratora (późniejszy minor)

Udokumentować i importować oczyszczony JSONL: `begin` / `finish` / `fail` z `logicalOperationId`, `attemptId`, lokalnymi id rozmowy i tury, modelem żądanym i zwróconym, końcowym usage, id odpowiedzi, statusem, bezpiecznym kodem błędu. Bez klucza API, nagłówka Authorization, promptu, tekstu odpowiedzi, argumentów narzędzia i ciasteczek. Streaming zostawia końcowy obiekt usage dostawcy. Przerwany stream to `partial` albo `missing`, nie `$0`. Retry z nowym response id to nowy request. Chip OpenAI API pokazuje wtedy wiersze.

### Faza 6 — Porównanie organizacji (późniejszy minor)

Zablokowane do edycji PRD i security, która pozwala wyłącznie na udokumentowane endpointy organizacji po opt-in. Klucz administracyjny w Secret Storage. Ręczne odświeżenie plus poll co 15 minut, ponowne pobranie ostatnich koszyków, podmiana koszyków, backoff przy 429. Statistics pokazuje lokalny szacunek i raportowany koszt organizacji dla **tej samej** organizacji, projektu, czasu, modelu i jednostki. Błąd zostawia lokalne wiersze. Te dolary nie są zapisywane na requestach i nie są saldem planu ChatGPT.

### Faza 7 — Przebiegi Optimize i pomiar ciepłej strony (późniejszy minor)

Zapis przebiegu analizy (czas, zakres, wersja reguł, status). Nie przepisywać historycznego kosztu. Chip Optimized zaczyna pasować do tych id. Zmierzyć pierwszą ciepłą stronę przy 100 000 wierszach. 500 ms ze specyfikacji to cel, nie twierdzenie. Opcjonalne wzbogacenie tytułów z app-servera to osobna zmiana: negocjowany schemat, bez startu procesu, tytuł z rolloutu zostaje fallbackiem (`#` + krótkie id).

---

## 9. Akceptacja

| # | Reguła | Faza |
|---|---|---|
| 1 | Drugi import nie zmienia liczby requestów ani sum | 2b |
| 2 | `token_usage_record` i `token_count` liczą się raz | 1 |
| 3 | Snapshoty skumulowane nie są udawaną listą requestów | 1 |
| 4 | Skopiowane response id z forka nie podwajają globalnego zużycia | 2b |
| 5 | Ten sam tytuł, dwa zakresy, dwie grupy. Unknown zostaje unknown po logowaniu Cursora | 2b, 3a |
| 6 | 100000 / 80000 / 10000 / 2000 → T 110000 i 0,16 przy fikcyjnej taryfie | 1 i 4 |
| 7 | Brak taryfy albo usage to `—`. Częściowa grupa pokazuje `9/10 priced` | 3a, 4 |
| 8 | Dwa modele → `Mixed (2)`, nie ostatni model na każdym wierszu | 3a |
| 9 | Rozcięta linia JSONL i rozcięty UTF-8 | 1 |
| 10 | Skrócenie, podmiana przy tym samym rozmiarze, archiwum, restart | 2b |
| 11 | Przerwany stream jest częściowy, nie `$0` | 5 |
| 12 | Nowe response id przy retry to nowy request; to samo id nim nie jest | 5 |
| 13 | Zakres ze zmianą czasu w Warszawie nic nie gubi i nic nie dubluje | 3a |
| 14 | CSV wszystkich stron zgadza się z przefiltrowanymi sumami i nie ma wierszy grup | 3a |
| 15 | Sekrety, HTML promptu i formuły CSV nie są wykonywalne | 1–3c |
| 16 | Błąd synchronizacji administracyjnej zostawia lokalne wiersze | 6 |
| 17 | Koszt organizacji nie jest dodawany do requestów ani do planu ChatGPT | 6 |
| 18 | Webview dostaje stronę, nie log i nie 100 tys. wierszy | 3a, 7 |
| 19 | `activate()` nie czeka na wykrywanie, import ani sieć | 3b |
| 20 | Current / Today / chipy ostatnich zapytań dalej publikują payload Cursora | 3b, 3d |

Sprawdzenie ręczne: jeden syntetyczny rollout w katalogu tymczasowym plus jedna lokalna sesja porównana z tabelą i CSV na maszynie utrzymującego. Tego pliku nie commitować.

Przed scaleniem 1.1.0: `npm run typecheck`, `npm test`, `npm run build`. `npm run sync-i18n -- check` po wiadomości z katalogami. `npm run package` to osobna wiadomość. PRD, architecture, security, README, CHANGELOG i snapshot kodu zaktualizować w turze wydania, nie przed fazą 1.

---

## 10. Pliki, które zostają tylko cursorowe

Nie puszczać wierszy Codexa przez:

- `src/usage/types.ts` `UsageQuery`
- `src/usage/service.ts`, `api.ts`, `parse.ts`
- `src/pricing/listPrice.ts`
- `src/ui/historyRows.ts` `toHistoryRows`
- `src/ui/queryGroups.ts` `titleGroupKey`
- `src/ui/mtdPace.ts`, `src/burnRate/*`, `src/ui/criticalAlert.ts`
- `src/ui/exportCsv.ts` `buildQueriesCsv`
- budowniczych paska statusu

Wspólne, wolno wołać: `src/format.ts` (formatery Codexa obok istniejących), granice dni w `src/time/`, `src/spikes/threshold.ts` `isSpike` dla znaku `!`, `src/webview/messages.ts` jako unia wiadomości, `src/config.ts` dla nowych kluczy.

---

## 11. Bezpieczeństwo

- Czytać pliki rollout jako dane. Ograniczyć rozmiar linii. Nigdy nie wykonywać stringów z nich.
- Nie otwierać `auth.json`, ciasteczek sesji ani plików auth Codexa, żeby zgadnąć konto.
- Nie wysyłać tokena dostępu Cursora, tokena Codexa ani klucza OpenAI do webview, CSV, logów, `settings.json` ani `globalState`.
- Parser odrzuca treści. Schemat nie ma kolumn promptu ani wyniku narzędzia.
- Tytuły i kody błędów renderować jako tekst. Prefiks formuł CSV jak w §7.
- Bezwzględne ścieżki źródła zostają w tabeli plików magazynu hosta i na karcie Settings. Diagnostyka hashuje je, gdy ścieżka musi trafić do logu.
- Ścieżki importera zostają wewnątrz rozwiązanego katalogu po `realpath`.
- 1.1.0 nie otwiera nowego klienta sieciowego.
- Kasowanie usuwa wyłącznie dane należące do wtyczki, po drugim kliknięciu w panelu.
- Fixture są syntetyczne. Prawdziwe pliki rollout nigdy nie wchodzą do repozytorium.
