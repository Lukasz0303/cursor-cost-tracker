# Faza 2a — Magazyn

**Plan nadrzędny:** [openai-codex.pl.md](./openai-codex.pl.md)
**Status:** gotowe do implementacji
**Zależy od:** [phase-1-parse.pl.md](./phase-1-parse.pl.md)
**Dalej:** [phase-2b-import.pl.md](./phase-2b-import.pl.md)
**Angielski:** [phase-2a-store.md](./phase-2a-store.md)
**Wydanie:** 1.1.0. Nie podbijać `package.json`.

Gdy ten plik kłóci się z planem nadrzędnym, **wygrywa plan nadrzędny**. Gdy którykolwiek kłóci się z PRD, **wygrywa PRD**.

Jedna wiadomość w Agent. Ruszać tylko ścieżki z §3. Bez importu `vscode`. Testy wstrzykują sql.js i fałszywego pisarza pliku.

---

## 1. Cel

Wersjonowany magazyn sql.js dla znormalizowanych wierszy Codexa. Migracja w pamięci, zapis pliku tymczasowego obok, rename na miejsce docelowe. Jeden lease, żeby drugi wołający mógł czytać i nie mógł importować.

**Gotowe, gdy:**

- Ponowne otwarcie zapisanego pliku zwraca tę samą liczbę requestów i te same sumy tokenów.
- Nieudany flush zostawia poprzedni plik, a checkpoint po ponownym otwarciu jest starym offsetem.
- Dwie instancje źródła z nieznanym kontem zostają osobno (`unknown-source:<id>` nigdy nie jest SQL NULL i nigdy nie jest wspólnym NULL).
- `npm test` jest zielone dla `test/openaiHistoryStore.test.ts`.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| Chodzenie po `sessions/` | faza 2b |
| Adapter `globalState` | faza 3b (ta faza bierze interfejs `LeaseStore`) |
| Wiersze cennika | faza 4 dodaje `pricing_versions` |
| `http_attempts`, `billing_buckets`, `optimization_runs` | fazy 5–7 |
| Zapis `~/.codex`, `state.vscdb` albo workspace | nigdy |

---

## 3. Pliki

```
src/openaiHistory/store/types.ts
src/openaiHistory/store/migrations.ts
src/openaiHistory/store/sqlJsRequestStore.ts
src/openaiHistory/store/storeLease.ts
test/openaiHistoryStore.test.ts
```

Nazwa pliku, której host użyje w fazie 3b: `openai-request-history.sqlite` w `globalStorageUri`. Ta faza przyjmuje ścieżkę argumentem i nie szuka `globalStorageUri`.

---

## 4. Lease (`storeLease.ts`)

```typescript
export type LeaseStore = {
  read(): Promise<string | null>
  write(value: string): Promise<void>
}

export type LeaseRole = 'writer' | 'reader'

export function tryAcquireImportLease(
  store: LeaseStore,
  ownerId: string,
  nowMs: number,
): Promise<LeaseRole>
```

Zapisany JSON: `{ ownerId, expiresAt }`. TTL **60_000** ms. Obecny właściciel odnawia, zapisując późniejsze `expiresAt`. Brak rekordu albo rekord przeterminowany pozwala wołającemu zostać `writer`. Każdy inny dostaje `reader`.

Klucz magazynu, podłączany w fazie 3b, to `cursorCost.codexImportLease`. Testy używają `LeaseStore` w pamięci.

`reader` może wołać metody zapytań. `applyBatch` rzuca, gdy wołający nie jest writerem. Faza 2b tego pilnuje; ta faza wystawia `assertWriter()`.

---

## 5. Schemat (`migrations.ts`)

`schema_migrations(version INTEGER PRIMARY KEY)`. Migracja **1** tworzy tabele poniżej. Późniejsze fazy dopisują migracje; nie edytują migracji 1 po wydaniu.

### `source_instances`

`id` (id instancji źródła, PK), `provider` (`openai`), `root_realpath`, `device_id`, `last_scan_at`, `parser_version`, `unrecognized_lines INTEGER NOT NULL DEFAULT 0`.

### `source_files`

`id` PK, `source_instance_id`, `absolute_path`, `generation INTEGER`, `size_bytes`, `mtime_ms`, `prefix_fingerprint`. Unikalność `(source_instance_id, absolute_path)`.

Ścieżki bezwzględne żyją tylko tutaj. Wiersze zapytania budowane w fazie 3a nie wybierają tej kolumny do webview.

### `import_checkpoints`

`source_file_id` PK, `generation`, `byte_offset`, `partial_bytes` (blob, nullable), `parser_context` (tekst JSON `ParserContext`).

### `conversations`

`id` PK, `provider`, `account_scope_key`, `conversation_id`, `parent_conversation_id`, `title`, `turn_count` nullable, `first_observed_at`, `last_observed_at`. Unikalność `(provider, account_scope_key, conversation_id)`.

### `requests`

Jeden zdeduplikowany request. Usage i koszt nullable. Kolumny:

`id`, `provider` (`openai`), `source` (`codex-local` | `openai-api`), `account_scope_key` **NOT NULL**, `account_confidence`, `conversation_id`, `session_id`, `turn_id`, `response_id`, `provisional_key`, `observed_at`, `started_at`, `completed_at`, `model`, `model_evidence`, `billing_mode`, `status`, `error_code`, `input_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, `output_tokens`, `reasoning_output_tokens`, `total_tokens`, `usage_quality`, `usage_anomaly`, `estimated_api_cost_usd` (string dziesiętny, w tej fazie null), `reported_cost_usd`, `pricing_version`, `cost_coverage`, `device_id`, `source_instance_id`.

Częściowy indeks unikalny, bo SQL NULL nie jest kluczem:

```sql
CREATE UNIQUE INDEX requests_response_uid
ON requests(provider, account_scope_key, response_id)
WHERE response_id IS NOT NULL AND response_id != '';

CREATE UNIQUE INDEX requests_provisional_uid
ON requests(provisional_key)
WHERE provisional_key IS NOT NULL AND provisional_key != '';
```

Indeksy wyszukiwania:

```text
(source, account_scope_key, observed_at, id)
(conversation_id, observed_at, id)
(model, observed_at, id)
```

### `request_observations`

`id` PK, `request_id`, `source_file_id`, `generation`, `byte_offset`, `observed_at`, `attributes_spend INTEGER NOT NULL`.

Unikalność `(source_file_id, generation, byte_offset)`.

`attributes_spend = 1` tylko dla obserwacji, która utworzyła request (albo pierwszej zastosowanej). Późniejsza obserwacja tego samego `(provider, account_scope_key, response_id)` wstawia kolejną obserwację z `attributes_spend = 0`. Sumy globalne liczą request raz. Sumy grupy w fazie 3a liczą request do rozmowy tylko wtedy, gdy obserwacja tej rozmowy ma `attributes_spend = 1`.

### `usage_snapshots`

Liczniki skumulowane. Nigdy nie są requestem modelu. `id` PK, `source_file_id`, `generation`, `byte_offset`, `conversation_id`, `observed_at`, te same nullable kolumny tokenów, `gap INTEGER NOT NULL DEFAULT 0`. Unikalność `(source_file_id, generation, byte_offset)`.

---

## 6. Magazyn (`sqlJsRequestStore.ts`)

```typescript
export type RequestStore = {
  applyBatch(batch: ImportBatch): Promise<void>
  readCheckpoint(fileId: string): Promise<Checkpoint | null>
  totals(sourceInstanceId: string): Promise<{ requests: number; inputTokens: number; outputTokens: number }>
  exportBytes(): Uint8Array
  flush(destinationPath: string): Promise<void>
  close(): Promise<void>
}

export function openRequestStore(bytes: Uint8Array | null, sql: SqlJsStatic): RequestStore
```

`ImportBatch` to opis samych wstawień: upsert instancji, upsert pliku, checkpoint, rozmowy, upserty requestów, obserwacje, migawki i `unrecognizedDelta`. Faza 2b to buduje. Ta faza to przyjmuje.

Reguły upsertu:

- To samo `(provider, account_scope_key, response_id)` aktualizuje pola nullable tylko wtedy, gdy nowa wartość jest nie-null, i nie dodaje drugiego requestu. Status może przejść z `unknown` na status terminalny. Nie może wrócić ze statusu terminalnego do `unknown`.
- Brak `responseId` używa `provisional_key`. Ten sam klucz aktualizuje; nie wstawia drugi raz.
- Stringi kosztu zostają null. `cost_coverage` to `tokens-only`, gdy którakolwiek kolumna tokenów jest nie-null, inaczej `unknown`.

`applyBatch` i jego checkpoint to jedna transakcja sql.js. Rzut wewnątrz batcha wycofuje transakcję.

### Flush

1. Wyeksportować bajty z pamięci.
2. Zapisać `<destination>.tmp` obok pliku docelowego.
3. Zrobić rename na plik docelowy.
4. Przy dowolnej porażce: skasować temp, jeśli istnieje, zostawić plik docelowy nietknięty, przeładować pamięć z bajtów pliku docelowego, gdy ten istnieje, i rzucić dalej.

Nie skracać najpierw pliku docelowego.

---

## 7. Testy (`test/openaiHistoryStore.test.ts`)

Katalog tymczasowy. Bez `vscode`.

- Zastosować batch z dwoma requestami, flush, otworzyć bajty ponownie → ta sama liczba i te same sumy I/O.
- Drugi batch powtarza to samo `responseId` → nadal jeden request, dwie obserwacje, jedna z `attributes_spend = 0`. Sumy bez zmian.
- Dwa batche z `unknown-source:aaa` i `unknown-source:bbb` oraz tym samym `responseId` → dwa requesty.
- Checkpoint i wstawienie requestu dzielą transakcję: batch, który rzuca przed commitem, nie przesuwa `readCheckpoint`.
- Pisarz flusha rzuca → bajty pliku docelowego zostają poprzednim eksportem; ponowne otwarcie pokazuje stary checkpoint.
- `tryAcquireImportLease`: pierwszy wołający `writer`, drugi `reader`, przeterminowany lease pozwala trzeciemu zostać `writer`.

---

## 8. Bezpieczeństwo

Schemat nie ma kolumny promptu ani wyniku narzędzia. `applyBatch` odrzuca obiekt batcha, który niesie pole `prompt`, `text` albo `arguments` (rzut). Test podaje kandydata, który nadal ma te klucze, i oczekuje rzutu, żeby późniejszy importer nie mógł ich przemycić.

---

## 9. Przekazanie

Faza 2b buduje `ImportBatch` z parsera i woła `applyBatch` / `flush`. Nie dodaje tabel.
