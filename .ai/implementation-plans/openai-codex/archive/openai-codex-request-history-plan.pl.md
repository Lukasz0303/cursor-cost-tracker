# Historia requestów OpenAI Codex — plan implementacji

**Tło.** Implementować z [openai-codex.md](../openai-codex.md) · [polski](../openai-codex.pl.md).
Półka: [README.pl.md](../README.pl.md).

**Przygotował:** Codex — agent kodujący OpenAI
**Data:** 2026-10-14
**Status:** zastąpiony jako samodzielny plan. Zostaje jako wejście podsumowania. Ten dokument jest planem, nie implementacją.
**Główne źródło:** [specyfikacja requestów OpenAI/Codex](../../../reports/cursor-cost-tracker-openai-requests-spec.md)  
**Kanoniczna wersja angielska:** [openai-codex-request-history-plan.md](./openai-codex-request-history-plan.md)  
**Proponowany podział wydań:** lokalna historia Codexa w 1.1.0; rejestrator API i raporty organizacji dopiero w późniejszych wydaniach minor.

## 1. Decyzja produktowa

Dodać do istniejącego panelu History historię requestów zależną od źródła:

- **Cursor** — dotychczasowe zdarzenia zużycia Cursora, bez zmian;
- **Codex local** — rekordy na poziomie requestu importowane z lokalnie zachowanych plików JSONL rollout Codexa;
- **OpenAI API** — widocznie ograniczone, przyszłe źródło zawierające wyłącznie wywołania zapisane przez instrumentowaną aplikację.

Pierwszy wydawalny wycinek to **wyłącznie Codex local**. Jest użyteczny bez klucza API, nie czyta prywatnych rozmów ChatGPT i nie twierdzi, że jest pełną historią konta.

Wybór źródła steruje zakładkami Queries, Statistics, Charts i analizą Optimize. Pasek statusu zostaje tylko cursorowy. Obliczenia Current, Today, prognozy, alertu i pollingu są specyficzne dla Cursora i nigdy nie mogą zawierać wartości Codexa ani OpenAI.

> Lokalny rekord Codexa jest lokalnie zaobserwowanym rekordem zużycia. Nie jest dowodem kwoty na fakturze ChatGPT, zużycia API organizacji ani pełnej historii konta.

## 2. Analiza kodu i konsekwencje implementacji

| Obecna implementacja | Obserwacja | Wymagana decyzja |
|---|---|---|
| src/usage/types.ts | UsageQuery ma liczbowy costUsd i liczbowe pola tokenów. Zero liczbowe oznacza dziś albo prawdziwe zero, albo brak danych. | Nie dodawać rekordów Codexa do UsageQuery. Utworzyć księgę requestów niezależną od dostawcy, z polami nullable. |
| src/usage/service.ts | Posiada dostęp do sesji Cursora, polling cursor.com i pamięciowy cache Cursora. | Zostawić bez zmian. Dodać osobny CodexHistoryService i rejestr źródeł. |
| src/ui/historyRows.ts | Generuje jeden payload Cursora dla tabeli, statystyk, wykresów, cennika i Optimize. | Zachować ścieżkę Cursora; publikować osobne wyniki zapytań hosta dla Codexa/OpenAI. |
| src/ui/queryGroups.ts | Grupuje wiersze Cursora po znormalizowanym lokalnym tytule Cursora. | Nigdy nie używać tego dla Codexa. Grupy Codexa mają klucz: dostawca, zakres konta i identyfikator rozmowy; tytuł służy tylko do prezentacji. |
| src/ui/historyPanel.ts | Posiada wielokrotnego użytku WebviewPanel, zwalidowane komunikaty i eksport CSV Cursora. | Wstrzyknąć tu rejestr źródeł i router komunikatów innych niż Cursor. |
| media/history.html i media/src/tabs/queries.js | Istniejąca tabela już obsługuje filtry, rozwijanie, nawigację klawiaturą i wygenerowaną paczkę przeglądarkową. | Rozszerzyć ten widok. Edytować media/src i media/css, nigdy wygenerowanych media/history.js/history.css. |
| src/pricing/ | Ładuje cennik Cursora i liczy podział ceny katalogowej Cursora. | Zostawić tylko dla Cursora. Utworzyć osobny, wersjonowany katalog cen OpenAI z szacunkami nullable. |
| sql.js | Dziś czyta zewnętrzną bazę SQLite Cursora; rozszerzenie nie ma własnego magazynu historii. | Dodać prywatną bazę SQLite rozszerzenia w global storage, opartą o już zainstalowaną zależność sql.js. |
| src/webview/messages.ts | Waliduje listę dozwolonych poleceń webview. | Dodać tam komunikaty zapytań źródła, zanim HistoryPanel je obsłuży. |
| src/i18n/catalogs/ | Jedenaście plików katalogów musi zgadzać się z kluczami angielskimi. | Dodać, przetłumaczyć i sprawdzić parytet wszystkich nowych etykiet i stanów. |

Obecna tabela Queries ma też kolumnę **Context tylko dla Cursora**. Dane Codexa nie ustalają tego samego licznika kontekstu Cursora, więc wiersze inne niż Cursor nie mogą go wymyślać.

## 3. Potwierdzone ograniczenie Codexa

App-server Codexa jest przydatny do opcjonalnych nazw wątków i metadanych, ale nie jest głównym importerem. Oficjalna dokumentacja opisuje API wątku/tury/elementu oraz zbiorcze podsumowania zużycia tokenów ChatGPT; nie udostępnia temu rozszerzeniu trwałej, obejmującej całe konto księgi requestów. Udokumentowany transport WebSocket jest też eksperymentalny i niewspierany dla obciążeń produkcyjnych. [Codex App Server](https://learn.chatgpt.com/docs/app-server)

Wynika z tego:

1. Pierwsze wydanie czyta zachowane lokalne pliki rollout i nigdy nie uruchamia, nie wznawia ani nie steruje agentem Codexa po to, by zebrać zużycie.
2. App-server to późniejsze, best-effort wzbogacenie tytułów i metadanych, ze schematem negocjowanym według wersji.
3. Podsumowania zużycia konta i limitów nigdy nie są zamieniane na wiersze requestów ani łączone z kosztami requestów.
4. Rozszerzenie nigdy nie czyta, nie używa ponownie i nie wysyła danych logowania Codexa, tokenów transportu app-servera, prywatnych ciasteczek, tekstu promptu, tekstu odpowiedzi, wyniku narzędzia ani plików instrukcji.

## 4. Zakres i bramki wydań

### 4.1 Wchodzi do 1.1.0

- Wykrycie jednego lokalnego katalogu źródłowego Codexa: prywatny skonfigurowany katalog, potem CODEX_HOME, potem domyślny katalog Codexa.
- Przyrostowy import aktywnych i zarchiwizowanych plików JSONL rollout.
- Trwałe zapisanie znormalizowanych obserwacji requestów w prywatnym magazynie rozszerzenia, także po restarcie IDE.
- Rysowanie historii rozmów i requestów Codexa ze stanami pokrycia.
- Filtrowanie, sortowanie, grupowanie po rzeczywistym identyfikatorze rozmowy, leniwe rozwijanie, podgląd bezpiecznych szczegółów requestu i eksport wybranych wyników do CSV.
- Pokazywanie tokenów nawet wtedy, gdy model, konto, cennik albo tryb rozliczenia są nieznane.
- Statystyki, wykresy i analiza wysokiego zużycia tylko do odczytu, dla źródła lokalnego.

### 4.2 Wyraźnie poza 1.1.0

- Bierne przechwytywanie ruchu TLS, ruchu CLI Codexa, innego edytora albo wywołań OpenAI innej aplikacji.
- Obietnica pobrania wszystkich osobistych rozmów ChatGPT albo wszystkich requestów konta.
- Pole na klucz API, polling Usage/Costs organizacji albo żądania sieciowe do OpenAI.
- Domyślne mapowanie ceny API na model Codexa.
- Zapis promptu/odpowiedzi/transkryptu, wyszukiwanie transkryptu, skan workspace, auto-naprawa, ponowne uruchomienie requestu Codexa albo automatyczne wnioskowanie tożsamości konta.
- Jakakolwiek zmiana zachowania paska statusu Cursora, obliczeń Current/Today/prognozy Cursora albo istniejącego grupowania zdarzeń Cursora.

### 4.3 Późniejsze bramki

| Wydanie | Możliwość | Bramka |
|---|---|---|
| 1.2.x | Import z instrumentowanego rejestratora OpenAI API | Osobno wersjonowany kontrakt rejestratora dowodzi zachowania strumienia, retry i rotacji w jednej kontrolowanej aplikacji. |
| 1.3.x | Porównanie Usage/Costs organizacji | Zgoda PRD/bezpieczeństwa na api.openai.com i zaakceptowany UX poświadczeń w SecretStorage. |
| 1.4.x | Opcjonalne wzbogacenie tytułów przez app-server | Negocjacja schematu per wersja, brak skutków ubocznych procesu i fixture zgodności. |

Pierwsze wydanie można opublikować, gdy ceny są niedostępne. Historia tokenów jest użyteczna i uczciwsza niż zgadnięty koszt.

## 5. Propozycja UI

Użyć istniejącej zakładki Queries, bez Activity Bar, drugiego webview, Reacta i modalnego flow połączenia.

~~~text
Pasek narzędzi panelu History
[Last 1000 Cursor queries] [Statistics] [Charts] [Optimize] [Support] [Settings]     [Run Optimize] [Refresh]

Queries — Cursor
[Źródło: Cursor | Codex local | OpenAI API] [Over Warn at] [Optimized] [Group by conversation] [Export CSV]
TIME | MODEL | Context | COST | TOKENS | INPUT / OUTPUT | KIND

Queries — Codex local
[Źródło: Cursor | Codex local | OpenAI API] [Data] [Konto] [Model] [Status] [Group by conversation] [Export CSV]
Codex local · To urządzenie · Konto nieznane · 18 sesji · 2026-09-01–2026-10-14 · Ostatni skan 10:24 [Odśwież lokalnie]
TIME / ROZMOWA | MODEL | COST | TOKENS | INPUT / OUTPUT | KIND
▸ Refactor importer                gpt-…  —                 1.25M  1.1M / 150k  ChatGPT plan
  4 tury · 28 wywołań modelu · 2026-10-13 09:12 → 10:17 · usage zgłoszone 26/28
    10:02:18                         gpt-…  API-equiv. $…    155,532 15,347 / 185 ChatGPT plan

Szczegóły requestu
Źródło: Codex local · zaobserwowano 10:02:18 · status nieznany
Konto: nieznane · Usage: zgłoszone · Cennik: niedostępny
Input 15 347 (cache 12 160) · Output 185 (reasoning 32) · Razem 15 532
ID: wątek #… · tura #… · odpowiedź #… · parser rollout-v1
~~~

### 5.1 Przełączanie źródła

- Umieścić dostępny, trzyprzyciskowy segmented control jako pierwszą akcję Queries. Użyć aria-pressed.
- Domyślnie Cursor, gdy panel otwiera się z Current, Today, chipa ostatniego zapytania albo obecnego polecenia historii.
- W 1.1.0 trzymać wybór tylko dla aktywnej sesji panelu; nie zapisywać go w ustawieniach workspace.
- Cursor zachowuje obecny pasek narzędzi i sterowane z Settings zachowanie Last N / From / To.
- Codex local ma niezależne daty zapytania po stronie hosta. Ich zmiana nie może pobierać cursor.com ani zmieniać cursorCost.historyFromDate.
- OpenAI API jest widoczne, ale wyłączone w 1.1.0. Stan pusty mówi, że rozszerzenie nie potrafi samo obserwować wywołań innych aplikacji.
- Gdy źródło jest wybrane, tytuł zakładki i dokumentu zmienia się na Codex local requests.

### 5.2 Filtry Codex local

| Kontrolka | Zachowanie |
|---|---|
| Data | Ostatnie 7 dni, ten miesiąc, cała zaimportowana historia, własny From/To. Własne daty zamienić na lokalne granice [from, to). |
| Konto | Wszystkie, nieznane konto, konto zgłoszone przez źródło albo zakres przypisany przez użytkownika. Nieznane nigdy nie jest po cichu mapowane na konto Cursora. |
| Model | Wszystkie modele obecne przy aktywnych filtrach plus Unknown. |
| Status | Wszystkie, completed, failed, cancelled, incomplete, unknown. Unknown jest normalny przy pierwszym imporcie rolloutu. |
| Grupa | Wyłączone = wiersze requestów. Włączone = grupy o kluczu dostawca + zakres + identyfikator rozmowy. |
| Sort | Domyślnie od najnowszych; sort po koszcie i tokenach robi host/baza. |
| Eksport | Eksportuje każdy pasujący request, nie tylko stronę przeglądarki. Przyszły eksport agregatów jest osobny. |

Zawsze pokazywać pasek statusu źródła Codexa: zakres, pewność konta, zaimportowany przedział dat, liczbę plików/sesji, liczbę danych częściowych, ostatni udany skan i Odśwież lokalnie. Tam też renderowane są stany No local Codex history found, Partial history oraz Sync failed przy jednoczesnym pokazywaniu danych z danego momentu.

### 5.3 Tabela i zasady interakcji

- Zostawić szeroką, monospaced tabelę z poziomym scrollem. Ukryć Context dla Codexa/OpenAI; colspan szczegółów liczyć z aktywnych kolumn.
- Wiersze rozmowy pokazują tytuł albo krótkie ID, liczbę tur, liczbę wywołań modelu, zakres aktywności i pokrycie. Tur nigdy nie nazywać requestami.
- Te same tytuły nigdy nie łączą różnych grup konto/rozmowa. Brak identyfikatora rozmowy daje deterministyczne, osobne grupy z krótkim ID, a nie jeden globalny worek Unknown.
- Rozwinięcie grupy wysyła żądanie do hosta i leniwie pobiera wiersze dzieci z SQLite.
- Szczegóły zawierają tylko bezpieczne metadane: źródło, znane czasy, jakość usage/cennika, formułę/wersję, liczbowe usage, zamaskowane ID, status i bezpieczny kod/komunikat błędu.
- Wiersz Codexa z wysoką liczbą tokenów otwiera tylko do odczytu Analyze usage w Optimize. Nigdy nie otwiera czatu Codexa, nie wysyła promptu i nie startuje płatnego requestu.
- Zachować obecną klawiaturę, aria-expanded, fokus i poziomy scroll.

### 5.4 Statistics, Charts i Optimize

| Zakładka | Cursor | Codex local w 1.1.0 |
|---|---|---|
| Statistics | Dotychczasowe zachowanie bez zmian. | Pokrycie źródła, liczba requestów/tur, tokeny input/cache/output/reasoning/razem, pokrycie usage/cennika/konta, osobne linie szacunku i kosztu raportowanego. Current/Today/prognoza Cursora są niedostępne, nigdy zerem. |
| Charts | Dotychczasowe zachowanie bez zmian. | Dzienna seria znanych tokenów, miks tokenów według modelu, liczby requestów/tur, seria znanego kosztu. Brakująca cena to luka/stan nieznany, nigdy potwierdzony słupek zera. |
| Optimize | Dotychczasowy przepływ Agenta Cursora bez zmian. | Analiza metadanych tylko do odczytu: wysoki wzrost inputu, powtórzony kontekst, udział cache i requesty na turę. Ustalenia to hipotezy i nigdy nie zaglądają w tekst promptu. |

## 6. Model requestu niezależny od dostawcy

Utworzyć src/openaiHistory/ zamiast zmieniać src/usage/. Nazwa identyfikuje dostawcę; kod Cursora zostaje tam, gdzie jest.

~~~ts
type RequestSource = 'codex-local' | 'openai-api'
type AccountConfidence = 'source-reported' | 'user-assigned' | 'unknown'
type ModelEvidence = 'response' | 'turn-context' | 'requested' | 'unknown'
type BillingMode = 'api' | 'chatgpt-plan' | 'unknown'
type RequestStatus = 'completed' | 'failed' | 'cancelled' | 'incomplete' | 'unknown'
type UsageQuality = 'reported' | 'derived' | 'partial' | 'missing'
type CostCoverage = 'complete' | 'tokens-only' | 'partial' | 'unknown'

type RequestUsage = {
  inputTokens: number | null
  cachedInputTokens: number | null
  cacheWriteInputTokens: number | null
  outputTokens: number | null
  reasoningOutputTokens: number | null
  totalTokens: number | null
}

type TrackedRequest = {
  id: string
  source: RequestSource
  sourceInstanceId: string
  deviceId: string
  accountScopeId: string | null
  accountScopeKey: string
  accountConfidence: AccountConfidence
  conversationId: string
  sessionId: string | null
  turnId: string | null
  rootTurnId: string | null
  parentConversationId: string | null
  responseId: string | null
  providerRequestId: string | null
  logicalOperationId: string | null
  attemptId: string | null
  observedAt: string
  startedAt: string | null
  completedAt: string | null
  model: string | null
  modelEvidence: ModelEvidence
  serviceTier: string | null
  billingMode: BillingMode
  status: RequestStatus
  errorCode: string | null
  usage: RequestUsage
  usageQuality: UsageQuality
  estimatedApiCostUsd: string | null
  reportedCostUsd: string | null
  pricingVersion: string | null
  costCoverage: CostCoverage
  parserVersion: string
}
~~~

Niezmienniki:

1. Null znaczy nieznane; zero znaczy pozytywnie zgłoszone zero.
2. Pieniądze trzymać jako kanoniczny tekst dziesiętny i liczyć helperem decimal na bigint o stałej skali. Zaokrąglać tylko przy wyświetlaniu i eksporcie.
3. Dla usage tekstowego I=input, C=cached input, O=output, R=reasoning output i T=I+O. C jest podzbiorem I, a R podzbiorem O.
4. Walidować 0 <= C <= I oraz 0 <= R <= O. Zapisywać anomalie bez cichego poprawiania wartości źródłowych.
5. Usage nie dowodzi statusu completed.
6. Nieznane konta używają niepustych kluczy zakresu instancji źródła. Unikalność nullable w SQL nie może ich sklejać.
7. Obserwacje zachowują pochodzenie plik/generacja/offset bajtowy; requesty to zdeduplikowane fakty biznesowe.

## 7. Trwały, prywatny magazyn

### 7.1 Lokalizacja i implementacja

Księgę requestów trzymać pod context.globalStorageUri, na przykład w codex-request-history.sqlite. To prywatne dane rozszerzenia: nigdy plik workspace, nigdy baza Codexa i nigdy plik w repozytorium użytkownika.

Do pierwszego magazynu z zapisem użyć już zainstalowanej zależności sql.js, żeby funkcja została przenośna na wspieranych systemach. Magazyn ładuje się asynchronicznie po aktywacji, robi migracje w pamięci, zapisuje zatwierdzoną bazę przez tymczasowy plik sąsiedni, a potem zmienia mu nazwę na docelową. Nieudany flush zachowuje ostatnią poprawną bazę i pokazuje błąd synchronizacji źródła; nigdy nie usuwa zaimportowanej historii.

Interfejs RequestStore zostaje niezależny od sql.js. Późniejszą implementację natywną można zmierzyć i wprowadzić za tym interfejsem, ale node:sqlite nie może stać się wymaganym writerem: rozszerzenie wspiera Node 18, a produkt wyraźnie odrzuca ścieżkę SQLite wyłącznie natywną.

### 7.2 Minimalny schemat

| Tabela | Pola istotne | Cel |
|---|---|---|
| schema_migrations | version, applied_at | Uporządkowane, idempotentne śledzenie schematu. |
| source_instances | id, source, root_fingerprint, device_id, configured_at, last_scan_at, status | Identyfikuje katalog źródła, nie traktując jego ścieżki jako konta. |
| source_files | id, source_instance_id, canonical_path, file_identity, generation, size, mtime, fingerprint | Wykrywanie rotacji, skrócenia i podmiany. Nigdy nie wysyłane do webview. |
| import_checkpoints | source_file_id, generation, byte_offset, partial_bytes, parser_context_json, committed_at | Import przyrostowy z dokładnością do bajta. |
| conversations | id, provider, scope_key, conversation_id, title, title_evidence, parent_id, first_at, last_at | Bezpieczne metadane i tytuł do wyświetlenia, bez treści transkryptu. |
| requests | id, provider, account_scope_key, response_id, pola źródła, czasy, model, billing/status, nullable pola usage/kosztu, pricing_version | Jeden zdeduplikowany request biznesowy. |
| request_observations | id, request_id, source_instance_id, source_file_id, generation, byte_offset, parser_version, observed_at, raw_kind | Zachowuje każde pochodzenie. |
| usage_snapshots | id, source_instance_id, conversation_id, range_start/end, pola usage, quality | Fallback skumulowany, nigdy nie rysowany jako wiersze requestów. |
| http_attempts | id, request_id, logical_operation_id, attempt_id, czasy, status, safe_error | Zarezerwowane na retry rejestratora. |
| pricing_versions | id, source_url, verified_at, effective_from, assumptions_json | Audytowalne migawki stawek. |
| billing_buckets | id, scope_key, start/end, dimensions_hash, currency, reported_cost | Późniejsze porównanie agregatów organizacji. |
| optimization_runs | id, ID źródła/requestu/rozmowy, rule_version, created_at, status | Przyszły stan analizy niezależny od źródła. |

Wymagane indeksy i unikalność:

~~~text
UNIQUE requests(provider, account_scope_key, response_id) WHERE response_id IS NOT NULL
UNIQUE request_observations(source_file_id, generation, byte_offset)
INDEX requests(source, account_scope_key, observed_at DESC, id)
INDEX requests(conversation_id, observed_at DESC, id)
INDEX requests(model, observed_at DESC, id)
INDEX source_files(source_instance_id, canonical_path)
UNIQUE billing_buckets(scope_key, start_at, end_at, dimensions_hash)
~~~

Helper migracji/magazynu implementuje też deduplikację na poziomie aplikacji, a nie polega wyłącznie na częściowych indeksach między wersjami SQLite hosta. Rekordy importu, obserwacje i aktualizacje checkpointu commitują się w jednej transakcji.

### 7.3 Wiele okien, awaria i sprzątanie

- Przed importem utworzyć jeden lease w prywatnym global storage. Drugie lokalne okno IDE czyta utrwalony magazyn, ale nie uruchamia konkurencyjnego importera.
- Zapisy są idempotentne. Odzyskanie lease po awarii może ponownie czytać pliki bez zmiany sum.
- Commitować krótkie paczki linii, nie jedną transakcję na duży plik, i oddawać sterowanie extension hostowi między paczkami.
- Nie utrwalać surowego JSONL, wiadomości, wyników narzędzi, materiału uwierzytelniającego ani bezwzględnych ścieżek źródła pokazywanych użytkownikowi.
- Dodać podsekcję Settings z rozwiniętym potwierdzeniem w panelu: Usuń zaimportowaną historię Codexa z tego rozszerzenia. Kasuje wyłącznie magazyn i metadane należące do rozszerzenia i nigdy nie kasuje ani nie edytuje plików rollout. Nie może wprowadzić drugiego blokującego modala.

## 8. Importer Codex local

### 8.1 Wykrywanie źródła

Utworzyć:

~~~text
src/openaiHistory/codex/sourceRoot.ts
src/openaiHistory/codex/discover.ts
src/openaiHistory/codex/diagnostics.ts
~~~

Algorytm:

1. Rozwiązać jawny katalog zapisany w globalState rozszerzenia.
2. Gdy go nie ma, przyjąć bezwzględne, niepuste CODEX_HOME tylko wtedy, gdy istnieje i jest katalogiem.
3. W przeciwnym razie użyć katalogu domowego platformy plus .codex.
4. Rekurencyjnie wyliczyć pliki JSONL pod sessions i archived_sessions. Nigdy nie traktować history.jsonl jako kompletnego źródła requestów.
5. Wygenerować deviceId raz na instalację rozszerzenia i sourceInstanceId raz na katalog. Ścieżka katalogu nie jest identyfikatorem konta.
6. Na pasku źródła podać To urządzenie oraz lokalność extension hosta. Sformułowanie dla Remote SSH / dev-containera mówi, który system plików został przeskanowany, i nigdy nie sugeruje skanu drugiej maszyny.

Użyć asynchronicznego przejścia fs/promises ze strażnikami katalogu i błędów. Nie podążać za symlinkami katalogów poza wybrany korzeń. Brakujący korzeń to normalny stan No local Codex history found.

### 8.2 Przyrostowy czytnik bajtów

Utworzyć:

~~~text
src/openaiHistory/codex/byteReader.ts
src/openaiHistory/codex/checkpoint.ts
src/openaiHistory/codex/importer.ts
src/openaiHistory/codex/watch.ts
~~~

Dla każdego pliku i generacji:

1. Porównać stan checkpointu z aktualnym stat i ograniczonym odciskiem prefiksu.
2. Gdy rozmiar maleje, tożsamość się zmienia albo odcisk dowodzi podmiany, zamknąć bieżącą generację i zacząć nową od offsetu bajtowego zero. Nie kasować wcześniejszych obserwacji.
3. Czytać od zatwierdzonego offsetu bajtowego jako kawałki Buffer; znaleźć ostatni bajt nowej linii i dekodować tylko kompletne bajty rozdzielone nową linią.
4. Zatrzymać wszystkie końcowe bajty jako partial_bytes. To obsługuje niedokończony JSON i sekwencje UTF-8 rozcięte między zapisami.
5. Liczyć offsety obserwacji z pozycji bajtowych, nigdy z długości stringa JavaScript.
6. Parsować każdą kompletną linię niezależnie. Linie uszkodzone albo niewspierane zwiększają diagnostykę i pętla idzie dalej; surowa treść nigdy nie jest pokazywana.
7. Znormalizować, zdeduplikować, zapisać rekordy + obserwacje + checkpoint w jednej transakcji, potem przesunąć zatwierdzony offset.
8. Oddać sterowanie po ograniczonej paczce bajtów/linii. Kolejka importera ma współbieżność jeden.

fs.watch używać tylko jako podpowiedzi o niskim opóźnieniu, z debounce 750 ms. Kontrolny skan co 30 sekund jest rozstrzygający, bo zdarzenia watchera mogą ginąć, a zachowanie rekurencyjne różni się między platformami. Błędy importu używają ograniczonego retry/backoff i nigdy nie blokują aktywacji.

### 8.3 Parser rolloutu

Utworzyć:

~~~text
src/openaiHistory/codex/rolloutTypes.ts
src/openaiHistory/codex/rolloutContext.ts
src/openaiHistory/codex/rolloutParser.ts
src/openaiHistory/codex/usageAdapter.ts
~~~

| Zdarzenie rolloutu | Zachowanie parsera |
|---|---|
| session_meta | Upsert metadanych źródła/sesji i opcjonalnego identyfikatora konta zgłoszonego przez źródło. Powtórzenie nie tworzy requestu. |
| turn_context | Zapisać dowód modelu/kontekstu dla pasującej tury. Ma niższy priorytet niż model zgłoszony przez odpowiedź. |
| token_usage_record | Zrobić kandydata requestu wyłącznie z payload.usage; przenieść ID i znacznik czasu zdarzenia jako observedAt. |
| event_msg zawierający token_count | Zapisać snapshot tylko wtedy, gdy dowód semantyczny mówi, że jest skumulowany. Nigdy nie dodawać go do sum token_usage_record. |
| Jawne zdarzenie końca/błędu | Zaktualizować status tylko przy pewnym powiązaniu z requestem/turą; inaczej zostawić unknown. |
| Użytkownik, agent, narzędzie, instrukcja, dowolny tekst | Całkowicie zignorować treść. Nie używać tekstu użytkownika jako tytułu, bo produkt zabrania czytania transkryptu. |
| Nieznane zdarzenie | Bezpiecznie zignorować i zwiększyć licznik diagnostyczny. |

Początkowa nazwa parsera to rollout-v1. Każdy późniejszy kształt rolloutu dostaje własną wersję parsera i zanonimizowany fixture. Źródło złożone wyłącznie ze snapshotów skumulowanych ma przedziały usage typu derived i nie ma zmyślonej liczby requestów.

### 8.4 Deduplikacja, forki i konta

- Główny klucz requestu: dostawca openai + accountScopeKey + responseId. Znany zakres to account:<nieprzezroczyste-id>; nieznany to unknown-source:<sourceInstanceId>.
- Bez identyfikatora odpowiedzi utworzyć tymczasowy rekord oparty o obserwację, z kluczem źródło/generacja/offset, i jasno opisać jego pewność/jakość.
- Nigdy nie deduplikować po podobieństwie promptu, modelu, tytule, tokenach ani znaczniku czasu.
- Późniejsza obserwacja rejestratora z tym samym znanym dostawcą/kontem/identyfikatorem odpowiedzi dokleja się do istniejącego requestu, zachowując oba pochodzenia.
- Forki zachowują linię rozmowy/sesji rodzica. Odziedziczone identyfikatory odpowiedzi liczą się raz; domyślna suma rozmowy potomnej zawiera tylko nowe obserwacje.
- Przypisanie przez użytkownika tworzy osobno oznaczone mapowanie i nigdy nie przepisuje historycznej tożsamości unknown ani zgłoszonej przez źródło.

## 9. Usługa hosta, zapytania i kontrakt webview

### 9.1 Nowe moduły

~~~text
src/openaiHistory/domain.ts
src/openaiHistory/ids.ts
src/openaiHistory/usage.ts
src/openaiHistory/store/types.ts
src/openaiHistory/store/migrations.ts
src/openaiHistory/store/sqlJsRequestStore.ts
src/openaiHistory/store/storeLease.ts
src/openaiHistory/historyService.ts
src/openaiHistory/sourceRegistry.ts
src/openaiHistory/historyQuery.ts
src/openaiHistory/historyRows.ts
src/openaiHistory/historyGroups.ts
src/openaiHistory/historyDetails.ts
src/openaiHistory/historyStats.ts
src/openaiHistory/historyCharts.ts
src/openaiHistory/exportCsv.ts
src/openaiHistory/webviewRouter.ts
~~~

W src/extension.ts zbudować rejestr źródeł obok istniejącego UsageService, wystartować go w tle, zarejestrować dispose i przekazać do HistoryPanel. UsageService pozostaje jedynym właścicielem ciasteczek Cursora i pollingu API Cursora.

HistoryPanel dostaje zależności rejestru i routera. PanelPublisher dalej produkuje wyłącznie obecny payload Cursora. Nowy router publikuje metadane źródła i obsługuje zapytania inne niż Cursor. Dzięki temu ta sama zmiana nie przepisuje prognozy, Burn Rate, statystyk kodu, cennika modeli ani Optimize Cursora.

### 9.2 Typowany protokół

Każde żądanie przeglądarki zawiera client correlationId i filterRevision.

~~~ts
type RequestHistoryQuery = {
  source: 'codex-local' | 'openai-api'
  from: string | null
  to: string | null
  accountScopeId: string | null
  includeUnknownAccounts: boolean
  sourceInstanceId: string | null
  model: string | null
  status: RequestStatus | null
  groupBy: 'conversation' | 'none'
  sort: 'time-desc' | 'cost-desc' | 'tokens-desc'
  costBasis: 'estimated-api' | 'reported' | 'api-equivalent'
  pageCursor: string | null
  limit: number
}

// Przeglądarka -> host:
// requestHistory.query, requestHistory.expandConversation,
// requestHistory.details, requestHistory.refreshSource,
// requestHistory.exportCsv, requestHistory.analyze

// Host -> przeglądarka:
// requestHistory.result, requestHistory.conversation,
// requestHistory.details, requestHistory.sourceStatus,
// requestHistory.exportComplete, requestHistory.operationError
~~~

Dodać ścisłe warianty do src/webview/messages.ts i odzwierciedlić znane stringi w media/src/messages.js. Wymagania:

- Przyciąć limit do 25–100 po stronie hosta.
- Ściśle parsować dni ISO, wartości enum, booleany, ID, sort i podstawę kosztu.
- Odrzucać ścieżki, SQL, URL-e, dane auth, surowe stringi tokenów i nieograniczone rozmiary stron.
- Włączyć znormalizowane filtry do odcisku zapytania; przeglądarka ignoruje nieaktualne odpowiedzi.
- Użyć nieprzezroczystych kursorów keyset zbudowanych z krotki sortowania + identyfikatora requestu, nigdy offsetów sterowanych przez przeglądarkę.

### 9.3 Kolejność zapytania

1. Zacząć od znormalizowanych requestów, nie od surowych obserwacji/snapshotów.
2. Zastosować filtry źródła, konta, instancji źródła, modelu, statusu i lokalnego [from, to).
3. Wybrać jedną opisaną podstawę kosztu; nigdy nie mieszać wartości szacowanych, raportowanych i ekwiwalentu API.
4. Tryb bez grup sortuje i stronnicuje keysetem wiersze requestów.
5. Tryb z grupami grupuje dostawcę + zakres konta + identyfikator rozmowy, liczy sumy/pokrycie pasujących dzieci, sortuje, potem stronnicuje grupy.
6. Dzieci są pobierane tylko przy rozwinięciu, pod tym samym zamrożonym odciskiem filtra.
7. Sumy i pokrycie używają dedykowanych agregatów SQL, nigdy DOM przeglądarki ani wartości pierwszej strony.

Każdy wynik zawiera rows, nextCursor, totals, coverage, status źródła i lastSyncAt.

## 10. Semantyka cennika i kosztu

Utworzyć osobną przestrzeń src/openaiHistory/pricing/:

~~~text
src/openaiHistory/pricing/decimal.ts
src/openaiHistory/pricing/types.ts
src/openaiHistory/pricing/catalog.ts
src/openaiHistory/pricing/calculate.ts
src/openaiHistory/pricing/coverage.ts
~~~

Katalog to przypięty lokalny manifest z datą weryfikacji, URL źródła, datą obowiązywania, service tier, trybem standard/batch, wymiarami cen i założeniami. Nie scrapować publicznej strony cennika przy starcie rozszerzenia i nie używać ponownie katalogu modeli Cursora.

Gdy znane są model, wersja stawki, input, cached input i output:

~~~text
szacowany koszt API =
  ((input - cached input) * cena inputu za milion
   + cached input * cena cached input za milion
   + output * cena outputu za milion) / 1_000_000
~~~

Reguły:

- Tokeny reasoning są częścią outputu i nigdy nie są naliczane drugi raz.
- Nieznany cached input nie jest zastępowany zerem. Renderować niedostępne, częściowe albo jawny zakres tylko z widocznymi założeniami.
- Nieznany model/stawka to pauza em, nigdy 0,00 USD.
- Rekord Codexa oznaczony jako plan ChatGPT pokazuje szacunek ekwiwalentu API tylko przy jawnym, audytowalnym mapowaniu. Nigdy nie jest opisywany jako koszt zafakturowany i nigdy nie jest odejmowany od limitu abonamentu.
- Mapowania Codexa domyślnie nie istnieją. Późniejsze mapowanie użytkownika pokazuje Założenie: mapowanie użytkownika plus metadane mapowania/wersji i można je usunąć bez zmiany źródłowego usage.
- Raportowany koszt organizacji to osobne pole i nigdy nie łączy się z szacunkiem per request w jedną sumę.
- Sumować wartości dziesiętne o wysokiej precyzji przed renderowaniem. Małe wartości dodatnie mogą wyświetlać się jako mniej niż 0,01 USD, a dokładne wartości zostają w szczegółach i CSV.

## 11. Późniejszy rejestrator OpenAI API i raporty organizacji

### 11.1 Rejestrator, nie bierne przechwytywanie

Rozszerzenie nie potrafi obserwować dowolnych aplikacji. Po 1.1.0 utworzyć pakiet towarzyszący, na przykład packages/openai-request-recorder, z jawnie skonfigurowanym lokalnym ujściem JSONL. Aplikacja owija własnego klienta:

1. recorder.begin zapisuje logicalOperationId, attemptId, bezpieczne lokalne ID rozmowy/tury, żądany model, czas startu i identyfikatory zakresu bez sekretów;
2. aplikacja wysyła swój request;
3. recorder.finish zapisuje zwrócony model, usage, ID odpowiedzi/dostawcy, czas zakończenia i status;
4. recorder.fail zapisuje bezpieczny błąd/status, nie maskując oryginalnej porażki aplikacji;
5. rozszerzenie importuje wyłącznie oczyszczone ujście JSONL rejestratora, tą samą architekturą checkpointu i magazynu.

Schemat rejestratora nie zawiera klucza API, nagłówka Authorization, promptu, tekstu odpowiedzi, argumentów narzędzia ani ciasteczek. Streaming zapisuje końcowe usage dostawcy, gdy jest dostępne; delty tekstu nigdy nie są liczone jako usage. Przerwane strumienie są partial/missing, nie kosztem zero. Próby retry odnoszą się do operacji logicznej, a różne identyfikatory odpowiedzi zostają osobnymi requestami.

Ten projekt unika lokalnych serwerów HTTP, przechwytywania TLS i psucia aplikacji, gdy tracker jest niedostępny.

### 11.2 Porównanie Usage/Costs organizacji

Ta możliwość wymaga osobnej decyzji produktowej i bezpieczeństwa: obecny PRD ogranicza ruch sieciowy rozszerzenia do usług Cursora i nie ma flow podłączania poświadczeń.

Zanim powstanie kod, uzupełnić dokument PRD/bezpieczeństwa tak, by pozwalał wyłącznie na udokumentowane endpointy organizacji OpenAI po jawnym opt-in użytkownika. Osobno wpisane poświadczenie administracyjne trzymać tylko w ExtensionContext.secrets. Nie może wystąpić w konfiguracji paczki, globalState, CSV, logach, payloadach przeglądarki ani plikach workspace.

Po zatwierdzeniu:

- Przejść wszystkie strony wyników Usage/Costs, łącznie z next_page.
- Ponownie pobrać i podmienić ostatnie koszyki, żeby znieść opóźnienie raportowania.
- Zachować walutę, wymiary, zakres i koszyk czasu.
- Porównywać tylko pasujące filtry organizacji/projektu/klucza/modelu/czasu/jednostki.
- Renderować lokalny szacunek tokenów i raportowany koszt organizacji jako osobne, opisane wartości.
- Nigdy ich nie dodawać, nie rozdzielać ich różnicy na requesty i nie używać agregatów jako dowodu rozliczenia planu ChatGPT.
- Zachować zaimportowaną historię, gdy synchronizacja administracyjna się nie uda, i pokazać świeżość danych.

## 12. Wymagania bezpieczeństwa i prywatności

Przed wydaniem zaktualizować .ai/context/security.md, zachowując każde ograniczenie tokenu Cursora.

| Ryzyko | Wymagana kontrola |
|---|---|
| Materiał auth Codexa obok rolloutów | Czytać tylko wybrane lokalizacje JSONL. Nigdy nie sondować plików auth/config, by wywnioskować konto. |
| Wyciek promptu/odpowiedzi/narzędzia | Ignorować treści w parserze, pominąć kolumny treści w schemacie i wysyłać do przeglądarki tylko bezpieczne etykiety/ID/znaczniki czasu/status/liczby. |
| Wstrzyknięcie HTML/CSV | Użyć textContent i węzłów DOM. Escapować cudzysłowy i nowe linie w CSV oraz poprzedzać apostrofem tytuły zaczynające się od =, +, - albo @. |
| Wyciek sekretu | Żadnego poświadczenia OpenAI/Codex w logach, OutputChannel, komunikacie przeglądarki, URL, JSON ustawień, globalState, eksporcie ani fixture. |
| Prywatność ścieżki źródła | Bezwzględne ścieżki zostają po stronie hosta; UI pokazuje ogólne etykiety źródła/urządzenia. Gdy się da, hashować ścieżki w diagnostyce. |
| Uszkodzony albo wrogi JSONL | Traktować jako dane, ograniczyć rozmiar linii, strzec kształtów i liczb i nigdy nie wykonywać stringów. |
| Destrukcyjne sprzątanie | Usuwać tylko dane należące do rozszerzenia po jawnym potwierdzeniu w panelu. Nigdy nie modyfikować plików rollout. |
| Wiele okien | Lease plus transakcja/idempotencja zapobiegają podwójnemu importowi. |
| Nowa powierzchnia sieciowa | 1.1.0 nie dodaje żadnej. Każdy późniejszy klient api.openai.com jest opt-in, ograniczony timeoutem/backoffem i odizolowany od ciasteczek Cursora. |

Istniejący audyt bezpieczeństwa musi objąć to nowe drzewo źródeł i wynik dist. Fixture muszą być syntetyczne albo zanonimizowane; prawdziwe pliki rollout nigdy nie wchodzą do repozytorium.

## 13. Implementacja fazami, z dokładnymi plikami

### Faza 0 — kontrakt, dokumentacja i fixture

**Pliki**

~~~text
.ai/context/prd.md
.ai/context/architecture.md
.ai/context/security.md
.ai/context/codebase-snapshot.md
test/fixtures/codex-rollouts/
.ai/implementation-plans/README.md
~~~

**Praca**

1. Zapisać granicę źródła, regułę braku transkryptu, wyłączenie paska statusu, regułę braku sieci w 1.1.0 i lokalizację prywatnego magazynu.
2. Dodać syntetyczne warianty fixture: metadane sesji, kontekst tury, usage requestu, usage wyłącznie ze snapshotu, uszkodzony rekord, rozcięty JSON/UTF-8, rotacja, fork, nieznane konto i mieszane modele.
3. Potwierdzić zachowanie selektora źródła, paska statusu i tabeli, zanim przetłumaczy się stringi.
4. Nie aktualizować dokumentacji obecnego zachowania jako wydanej, dopóki kod naprawdę nie wejdzie.

**Gotowe, gdy**

- Żaden projekt nie zakłada prywatnego endpointu historii requestów ChatGPT.
- Fixture nie zawierają identyfikatorów kont, promptów, ścieżek repozytoriów, sekretów ani prawdziwego tekstu rolloutu.

### Faza 1 — domena, arytmetyka dziesiętna, magazyn

**Nowe pliki**

~~~text
src/openaiHistory/domain.ts
src/openaiHistory/ids.ts
src/openaiHistory/usage.ts
src/openaiHistory/store/types.ts
src/openaiHistory/store/migrations.ts
src/openaiHistory/store/sqlJsRequestStore.ts
src/openaiHistory/store/storeLease.ts
src/openaiHistory/pricing/decimal.ts
src/openaiHistory/pricing/types.ts
test/openaiHistoryDomain.test.ts
test/openaiHistoryDecimal.test.ts
test/openaiHistoryStore.test.ts
test/openaiHistoryMigrations.test.ts
~~~

**Praca**

1. Znormalizować ścisłe enumy, ID, czasy ISO, nullable nieujemne usage i klucze zakresu konta.
2. Zapisywać anomalie źródła zamiast mutować dane.
3. Zdefiniować operacje repozytorium dla paczek importu, statusu źródła, stron, dzieci, bezpiecznych szczegółów, agregatów, iteracji CSV, sprzątania i zamknięcia.
4. Zaimplementować migracje, cykl życia prywatnego pliku, serializowany flush, podmianę przez plik tymczasowy, lease i odzyskanie po restarcie.
5. Rozszerzyć lokalną deklarację sql.js tylko w potrzebnym zakresie i testować względem zainstalowanego API runtime.

**Gotowe, gdy**

- Restart czyta identyczne sumy requestów i obserwacji.
- Rollback nie zostawia ani przesuniętego checkpointu, ani wpół zapisane go requestu.
- Nieznane instancje źródła nie mogą się zderzyć.

### Faza 2 — wykrywanie, parser, importer przyrostowy

**Nowe pliki**

~~~text
src/openaiHistory/codex/sourceRoot.ts
src/openaiHistory/codex/discover.ts
src/openaiHistory/codex/byteReader.ts
src/openaiHistory/codex/checkpoint.ts
src/openaiHistory/codex/rolloutTypes.ts
src/openaiHistory/codex/rolloutContext.ts
src/openaiHistory/codex/rolloutParser.ts
src/openaiHistory/codex/usageAdapter.ts
src/openaiHistory/codex/importer.ts
src/openaiHistory/codex/watch.ts
src/openaiHistory/codex/diagnostics.ts
src/openaiHistory/historyService.ts
test/codexSourceRoot.test.ts
test/codexDiscover.test.ts
test/codexByteReader.test.ts
test/codexRolloutParser.test.ts
test/codexImporter.test.ts
~~~

**Praca**

1. Zaimplementować pierwszeństwo katalogu i walidację.
2. Wykrywać JSONL aktywne i archiwalne ze stabilną tożsamością i wykrywaniem generacji.
3. Zaimplementować checkpointy bezpieczne bajtowo i ograniczoną kolejkę importu.
4. Mapować payload.usage wyłącznie z token_usage_record.
5. Nieść kontekst modelu tury jako dowód niższego priorytetu i nigdy nie używać skonfigurowanego modelu jako fallbacku.
6. Utrwalać diagnostykę pokrycia/parsera i status źródła.
7. Startować wykrywanie i import asynchronicznie przy aktywacji rozszerzenia; dispose strumieni, timera i watchera.

**Gotowe, gdy**

- Ponowny import, rotacja, skrócenie, przeniesienie do archiwum i restart zostawiają sumy bez zmian.
- Niedokończony dopisek JSONL/UTF-8 staje się dokładnie jednym rekordem po dokończeniu.
- Snapshot token_count nigdy nie dubluje usage z token_usage_record.

### Faza 3 — rejestr, zapytania hosta, CSV, agregaty źródła

**Nowe pliki**

~~~text
src/openaiHistory/sourceRegistry.ts
src/openaiHistory/historyQuery.ts
src/openaiHistory/historyRows.ts
src/openaiHistory/historyGroups.ts
src/openaiHistory/historyDetails.ts
src/openaiHistory/historyStats.ts
src/openaiHistory/historyCharts.ts
src/openaiHistory/exportCsv.ts
src/openaiHistory/webviewRouter.ts
test/openaiHistoryQuery.test.ts
test/openaiHistoryGroups.test.ts
test/openaiHistoryStats.test.ts
test/openaiHistoryCharts.test.ts
test/openaiHistoryExportCsv.test.ts
test/openaiHistoryRouter.test.ts
~~~

**Zmieniane pliki**

~~~text
src/extension.ts
src/ui/historyPanel.ts
src/webview/messages.ts
test/webviewMessages.test.ts
~~~

**Praca**

1. Zarejestrować CodexHistoryService obok UsageService, nie wewnątrz niego.
2. Wstrzyknąć rejestr źródeł i router do HistoryPanel.
3. Dodać ścisłe parsowanie komunikatów źródła, korelację, odświeżanie, obsługę zapytań strony/szczegółów/dzieci i błędy.
4. Utworzyć osobne, niezależne od źródła wiersze/grupy/szczegóły bez przeciążania HistoryRow albo QueryGroupPayload.
5. Zaimplementować agregaty po stronie hosta i strony keyset po 100 wierszy.
6. Zbudować bezpieczne CSV całego wyniku requestów z datami ISO UTC i nazwą pliku właściwą dla źródła.
7. Zostawić obecne polecenie i builder CSV Cursora bez zmian.

**Gotowe, gdy**

- Baza 100 000 wierszy stronnicuje, filtruje i sortuje bez wysyłania surowych logów albo wszystkich wierszy do przeglądarki.
- Sumy CSV zgadzają się z przefiltrowanymi sumami SQL i nie ma podwójnego liczenia grupy/dziecka.

### Faza 4 — webview, style, lokalizacja

**Zmieniane pliki**

~~~text
media/history.html
media/src/messages.js
media/src/session.js
media/src/tabs/queries.js
media/src/tabs/stats.js
media/src/tabs/optimize.js
media/src/charts/host.js
media/css/queries.css
media/css/stats.css
media/css/charts.css
media/css/optimize.css
src/i18n/catalogs/en.ts
src/i18n/catalogs/pl.ts
src/i18n/catalogs/zh-cn.ts
src/i18n/catalogs/fr.ts
src/i18n/catalogs/de.ts
src/i18n/catalogs/ja.ts
src/i18n/catalogs/ko.ts
src/i18n/catalogs/pt-br.ts
src/i18n/catalogs/ru.ts
src/i18n/catalogs/es.ts
src/i18n/catalogs/uk.ts
test/i18nKeys.test.ts
~~~

**Praca**

1. Dodać selektor źródła, kontrolki Codexa, pasek statusu źródła, lokalne odświeżanie, stronicowanie, wszystkie stany puste/częściowe/błędu oraz dynamiczne nagłówki i colspan.
2. Rozdzielić tabelę przeglądarki na renderowanie Cursora o identycznym zachowaniu i renderowanie historii requestów stronicowanej przez hosta.
3. Renderować wszystkie wartości zewnętrzne jako węzły tekstowe DOM i zachować wzorce fokusu oraz rozwijania.
4. Uczynić Statistics/Charts/Optimize świadomymi źródła bez przebudowy obecnego markupu Cursora dla źródła Cursor.
5. Dodać stringi angielskie, uruchomić npm run sync-i18n -- sync, potem przetłumaczyć i przejrzeć każdy język.
6. Zbudować wygenerowane assety webview z ich plików źródłowych.

**Gotowe, gdy**

- Ścieżki źródła/filtra/grupy/szczegółów/stronicowania/eksportu działają myszą i klawiaturą.
- Cursor pozostaje wizualnie i funkcjonalnie bez zmian przy źródle Cursor.
- Codex nie pokazuje zmyślonego Context, kosztu, konta ani statusu.

### Faza 5 — cennik i analiza tylko do odczytu

**Nowe pliki**

~~~text
src/openaiHistory/pricing/catalog.ts
src/openaiHistory/pricing/calculate.ts
src/openaiHistory/pricing/coverage.ts
src/openaiHistory/optimize/insights.ts
src/openaiHistory/optimize/runs.ts
test/openaiHistoryPricing.test.ts
test/openaiHistoryOptimize.test.ts
~~~

**Praca**

1. Dodać format przypiętego manifestu cen i fixture testowy z fikcyjnymi stawkami.
2. Zaimplementować pokrycie ceny complete/partial/unknown i osobne etykiety podstawy kosztu.
3. Dodać etykiety cen w Statistics/Charts źródła i wyjaśnienie formuły w szczegółach.
4. Zaimplementować wskazówki metadanych Codexa tylko do odczytu; zapisać przebieg analizy bez ruszania istniejącego stanu optimized-target Cursora.
5. Podłączyć akcję wysokich tokenów wyłącznie do Analyze usage. Żaden czat się nie otwiera, nie ma promptów ani wykonania requestu.

**Gotowe, gdy**

- I=100 000, C=80 000, O=10 000, R=2 000 przy stawkach fixture 2/0,5/8 za milion daje T=110 000 i 0,16 USD.
- Brak stawki/modelu/cache renderuje się jako niedostępne/częściowe, nigdy jako cena zero.
- Reasoning nigdy nie jest liczony podwójnie.

### Faza 6 — opcjonalny rejestrator, porównanie organizacji, app-server

Każdą możliwość wydać jako osobny pull request i osobne wydanie, nie jako zmianę stabilizującą 1.1.0:

- Rejestrator: kontrakt towarzyszący, oczyszczone ujście, przykład integracji aplikacji, fixture streamingu/retry i adapter importera.
- Organizacja: zgoda produktowa i bezpieczeństwa, cykl życia SecretStorage, paginacja/backoff, podmiana świeżych koszyków, karta porównania i testy braku łączenia sum.
- App-server: wygenerowany schemat dla zainstalowanej wersji, uścisk dłoni możliwości, paginacja tytułów/wątków tylko do odczytu, fallback do lokalnego rolloutu i brak startu/wznowienia procesu.

## 14. Macierz testów

| Obszar | Wymagane przypadki automatyczne |
|---|---|
| Parser | Tylko payload.usage; priorytet dowodu modelu; uszkodzone rekordy; null/zero; fallback snapshotu; nieznane zdarzenie; brak zapisu tekstu. |
| Import/checkpoint | Podwójny import; rozcięty JSON; rozcięty UTF-8; offsety bajtowe; skrócenie; podmiana przy tym samym rozmiarze; przeniesienie do archiwum; restart; debounce; lease. |
| Deduplikacja/forki | Ta sama odpowiedź w dwóch obserwacjach; ta sama znana odpowiedź z dwóch źródeł; izolacja unknown-source; retry/nowa odpowiedź; odziedziczona odpowiedź forka raz. |
| Pieniądze/usage | Walidacja podzbioru cache/reasoning; formuła fixture; pokrycie częściowe; suma dziesiętna; znane zero kontra nieznane; brak mapowania modelu po podobieństwie nazwy. |
| Zapytania | [from, to) przez zmianę czasu Europe/Warsaw; wszystkie filtry; sort w bazie; kursor keyset; suma grupy tylko z pasujących; tytuły się nie łączą; leniwe dzieci. |
| Webview | Ścisłe odrzucenie polecenia; nieaktualna korelacja; przełączenie źródła; stany statusu; dynamiczne kolumny; rozwijanie klawiaturą; bezpieczny tekst. |
| CSV | Wszystkie strony; pola UTC; puste nieznane; tytuł wstrzykujący formułę; escapowanie cudzysłowu i nowej linii; brak sekretu/tekstu promptu; brak podwójnego liczenia. |
| Regresja | Obecny UsageService, tabela/grupy Cursora, próbka historii, Current/Today, prognoza, pasek statusu, eksport, parytet katalogów. |

## 15. Kryteria akceptacji

1. Zaimportowanie jednego rolloutu dwa razy nie zmienia ani liczby requestów, ani sum.
2. token_usage_record plus token_count dla tej samej aktywności liczy się dokładnie raz.
3. Logi złożone wyłącznie ze snapshotów nigdy nie tworzą fałszywej listy requestów.
4. Odziedziczone identyfikatory odpowiedzi forka nie zwiększają zużycia globalnego.
5. Nieznane konto zostaje nieznane po zalogowaniu Cursora i odświeżeniu sesji.
6. Te same tytuły na różnych kontach i w różnych rozmowach zostają osobnymi grupami.
7. Grupy z mieszanymi modelami renderują Mixed (N), a nie ostatni model na każdym requeście.
8. Brak modelu, usage, ceny i konta pozostaje widocznie niedostępny.
9. Zakres źródła, świeżość i pokrycie pojawiają się przed liczbami, które dałoby się wziąć za dane całego konta.
10. Eksport obejmuje wszystkie pasujące strony i zgadza się z sumami tego samego filtra.
11. Porażka importu zachowuje wcześniej zapisane wiersze i raportuje świeżość.
12. Źródło OpenAI API w 1.1.0 nie obiecuje biernej obserwacji.
13. Żaden token Cursora, poświadczenie Codexa, poświadczenie API, prompt, odpowiedź ani surowy JSONL nie trafia do payloadów przeglądarki, CSV, fixture, logów ani kanałów wyjścia.
14. Aktywacja rozszerzenia nie czeka na wykrywanie, import ani pracę sieciową.
15. Istniejące Current/Today i chipy ostatnich zapytań Cursora zachowują regresyjnie równoważny wynik.
16. Pierwsza ciepła strona Codexa jest mierzona poniżej 500 ms na maszynie referencyjnej przy 100 000 wierszach requestów; rozmiar strony ogranicza DOM przeglądarki.

Uruchomić przed merge:

~~~text
npm run typecheck
npm run lint
npm test
npm run sync-i18n -- check
npm run build
npm run package
~~~

Weryfikacja ręczna używa wyłącznie skopiowanego syntetycznego fixture rolloutu w katalogu tymczasowym oraz jednej świadomie utworzonej lokalnej sesji Codexa, porównanej z tabelą i CSV. Żaden prawdziwy log konta nie jest commitowany.

## 16. Dokumentacja i wydanie

- Traktować lokalną historię Codexa jako wydanie MINOR, 1.1.0, po testach zgodności.
- Aktualizować README, stronę, CHANGELOG, PRD, architekturę, dokument bezpieczeństwa i snapshot kodu dopiero wtedy, gdy implementacja jest zmergowana.
- Opisywać możliwość jako lokalną historię rolloutu Codexa, nigdy jako całą historię ChatGPT/OpenAI.
- Udokumentować wersje parsera, luki w danych, zachowanie sprzątania oraz różnicę między zużyciem tokenów, szacunkiem ekwiwalentu API, raportowanym kosztem organizacji i rozliczeniem planu ChatGPT.
- Nazwa pliku i linia „Przygotował” identyfikują ten dokument jako plan autorstwa OpenAI/Codex, do porównania z planami przygotowanymi przez inne modele.

## 17. Decyzje produktowe wciąż wymagane

1. Czy 1.1.0 ogranicza się do jednego skonfigurowanego katalogu Codexa, czy od pierwszego dnia musi wspierać kilka zaimportowanych katalogów/urządzeń?
2. Czy selektor katalogu zostaje prywatnym globalState, jak zaproponowano, czy staje się też kluczem konfiguracji paczki?
3. Czy widoczne, ręczne mapowanie modelu Codexa na cenę API jest pożądane po wydaniu historii samych tokenów?
4. Czy przyszły UX wpisywania poświadczeń w SecretStorage jest akceptowalny przy obecnej regule braku dodatkowego modala, czy raportowanie organizacji ma zostać poza rozszerzeniem?
5. Czy przebiegi analizy Codexa mają dostać filtr w stylu Optimized dopiero po zaimplementowaniu prawdziwego rekordu analizy niezależnego od źródła?

Dopóki te wybory nie są zatwierdzone, fazy 1–4 dają uczciwą, kompletną lokalną historię Codexa bez rozszerzania zakresu sieci, poświadczeń i transkryptu.
