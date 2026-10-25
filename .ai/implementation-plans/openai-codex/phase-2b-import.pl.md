# Faza 2b — Import

**Plan nadrzędny:** [openai-codex.pl.md](./openai-codex.pl.md)
**Status:** gotowe do implementacji
**Zależy od:** [phase-1-parse.pl.md](./phase-1-parse.pl.md), [phase-2a-store.pl.md](./phase-2a-store.pl.md)
**Dalej:** [phase-3a-query.pl.md](./phase-3a-query.pl.md)
**Angielski:** [phase-2b-import.md](./phase-2b-import.md)
**Wydanie:** 1.1.0. Nie podbijać `package.json`.

Gdy ten plik kłóci się z planem nadrzędnym, **wygrywa plan nadrzędny**. Gdy którykolwiek kłóci się z PRD, **wygrywa PRD**.

Jedna wiadomość w Agent. Ruszać tylko ścieżki z §3. W tej fazie scheduler nie jest rejestrowany z `extension.ts`.

---

## 1. Cel

Czytać pliki rollout pod jednym katalogiem Codexa i stosować idempotentne batche. Drugi import tych samych bajtów nie zmienia liczby requestów ani sum tokenów.

**Gotowe, gdy:**

- Drugi import jest no-opem na sumach.
- Skrócenie pliku i podmiana przy tym samym rozmiarze nie dublują requestów.
- Fork, który kopiuje `responseId`, nie podwaja sumy globalnej. Rozmowa dziecka linkuje do rodzica. Wydatek przypisany dziecku liczy tylko odpowiedzi, które pierwszy raz pojawiają się na dziecku.
- Zakres nieznanego konta to `unknown-source:<sourceInstanceId>`, nigdy e-mail Cursora i nigdy SQL NULL.
- Testy używają katalogu tymczasowego. `npm test` jest zielone dla dwóch nowych plików testów.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| `activate()`, UI ustawień, webview | faza 3 |
| `fs.watch` podłączony do extension hosta | faza 3b woła `start()`; ta faza implementuje timer, ale nic go nie uruchamia |
| Sieć, klucz administracyjny | fazy 5–6 |
| Kasowanie wierszy trackera, bo zniknął plik logu | nigdy. Kasowanie to `codex.forget` w fazie 3 |

---

## 3. Pliki

```
src/openaiHistory/codex/sourceRoot.ts
src/openaiHistory/codex/discover.ts
src/openaiHistory/codex/importer.ts
src/openaiHistory/historyService.ts
test/codexSourceRoot.test.ts
test/codexImporter.test.ts
```

---

## 4. Katalog (`sourceRoot.ts`)

```typescript
export type ResolvedCodexRoot =
  | { ok: true; realpath: string; sourceInstanceId: string; via: 'setting' | 'env' | 'home' }
  | { ok: false; reason: 'missing' | 'not-directory' }

export function resolveCodexRoot(input: {
  codexHomeSetting: string
  codexHomeEnv: string | undefined
  homeDir: string
  stat: (path: string) => Promise<'dir' | 'file' | 'missing'>
  realpath: (path: string) => Promise<string>
}): Promise<ResolvedCodexRoot>
```

Kolejność:

1. Niepuste `codexHomeSetting`, po rozwinięciu `~`, gdy `stat` mówi katalog.
2. Inaczej `codexHomeEnv` tylko wtedy, gdy jest bezwzględne i `stat` mówi katalog. Względne `CODEX_HOME` jest ignorowane.
3. Inaczej `homeDir + '/.codex'`, gdy to katalog.
4. Inaczej `{ ok: false, reason: 'missing' }`.

`sourceInstanceId` to hex sha256 rozwiązanego realpath. To nie jest sama ścieżka.

`sessionsDirectoryExists(rootRealpath, stat): Promise<boolean>` robi stat tylko na `<root>/sessions`. Nie czyta treści plików. Faza 3 używa tego przy wyłączonym imporcie.

---

## 5. Odkrywanie (`discover.ts`)

```typescript
export function discoverRolloutFiles(rootRealpath: string, deps: FsDeps): Promise<DiscoveredFile[]>
```

- Brać zwykłe pliki pod `<root>/sessions/` i `<root>/archived_sessions/`.
- Pomijać `history.jsonl` po nazwie pliku. To nie jest usage.
- `realpath` każdego pliku. Gdy realpath nie leży pod `rootRealpath`, pominąć. Nie iść za symlinkiem, który wychodzi z katalogu.
- Zwracać `{ absolutePath, size, mtimeMs }`. Ta funkcja nie zwraca treści.

---

## 6. Importer (`importer.ts`)

```typescript
export function importDiscoveredFile(input: {
  file: DiscoveredFile
  root: ResolvedCodexRoot & { ok: true }
  deviceId: string
  store: RequestStore
  readFrom: (path: string, offset: number) => Promise<Uint8Array>
}): Promise<{ unrecognized: number }>
```

Generacja:

- Odcisk prefiksu to sha256 pierwszych **4096** bajtów albo całego pliku, gdy jest krótszy.
- Generacja rośnie, gdy `size` maleje, albo gdy rozmiar jest ten sam, a odcisk prefiksu różni się od zapisanego.
- Nowa generacja czyta od offsetu **0**. Ta sama generacja czyta od offsetu checkpointu.
- Ten sam rozmiar i ten sam odcisk: czytać ogon od checkpointu.

Pętla odczytu:

- Zasiać czytnik bajtów wartością `partial_bytes` z checkpointu.
- Dekodować tylko do ostatniego znaku nowej linii. Rozcięty ogon wraca do `partial_bytes`.
- Parsować każdą linię fazą 1. Skip zwiększa `unrecognized`.
- `session_meta` / `turn_context` aktualizują `parser_context` checkpointu i mogą zrobić upsert rozmowy (tytuł = `shortThreadTitle(threadId)`, bez tekstu wiadomości). Powtórzona meta nie tworzy drugiej rozmowy.
- Kandydat requestu staje się jednym requestem i jedną obserwacją.
- Zakres: `accountScopeKey(opaqueId)` z pewnością `source-reported`, gdy kontekst ma opaque id. Inaczej `unknownScopeKey(sourceInstanceId)` z pewnością `unknown`.
- Brak `responseId`: `provisionalRequestKey(sourceInstanceId, generation, byteOffset)`.
- To samo response id już zapisane dla tego zakresu: druga obserwacja, `attributes_spend = 0`, bez dodanych tokenów. Gdy id wątku w tym pliku jest inne, ustawić `parent_conversation_id` na rozmowie dziecka, jeśli kandydat niesie rodzica. Własne późniejsze requesty dziecka (nowe response id) dostają `attributes_spend = 1`.
- Wynik `status` aktualizuje tylko status i `error_code` pasującego requestu. Nie wstawia usage.
- Migawki idą do `usage_snapshots`. Spadek albo brak linii bazowej ustawia `gap = 1`. Nie wymyślać wiersza requestu z delty. Nie zamieniać ujemnej delty w zero.
- Liczba tur na rozmowie to liczba różnych `turn_id` widzianych na `turn_context` i kandydatach requestu. Pliki samych migawek zostawiają `turn_count` jako null. Nie dostają wymyślonej liczby requestów.
- Usunięcie albo brak wcześniej zaimportowanego pliku nie kasuje requestów.

Commit batcha pliku i jego checkpointu razem przez `applyBatch`. Między plikami oddać kolejkę (`await` makrozadania), żeby długi import dało się przerwać z serwisu. Cap jednego batcha to **200** wyników; zapisać batch i kontynuować tę samą generację od nowego offsetu.

`deviceId` jest argumentem. Ta faza nie czyta `globalState`. Testy podają `'device-test'`.

---

## 7. Serwis (`historyService.ts`)

```typescript
export type HistoryServiceOptions = {
  importEnabled: boolean
  resolveRoot: () => Promise<ResolvedCodexRoot>
  discover: typeof discoverRolloutFiles
  store: RequestStore
  lease: () => Promise<LeaseRole>
  now: () => number
}

export class HistoryService {
  start(): void
  refresh(): Promise<void>
  stop(): void
}
```

- `start()` wraca od razu. Nie czeka na pierwszy skan.
- Gdy `importEnabled` jest false: brak watchera, brak odczytu treści. `refresh()` może wołać `sessionsDirectoryExists` i zapamiętać boolean dla fazy 3. Nie otwiera plików rollout.
- Gdy włączone: głębokość kolejki **1**. Drugi `refresh()` w trakcie jednego przebiegu ustawia bit dirty i po bieżącym przebiegu odpala się jeszcze raz.
- `fs.watch` na katalogu to podpowiedź, debounce **750** ms, potem `refresh()`.
- Timer **30_000** ms jest rozstrzygający. Najpierw stat, czytać tylko brudne ogony (zmieniony size, mtime albo odcisk, albo brak checkpointu).
- Lease `reader`: pominąć odczyt treści. Metody zapytań z fazy 3a nadal działają.
- `stop()` czyści timer i watcher.

Nie konstruować tego z `extension.ts` w tej fazie. Testy wołają `start` / `refresh` / `stop` na katalogu tymczasowym.

---

## 8. Testy

### 8.1 `test/codexSourceRoot.test.ts`

- Ustawienie wygrywa z env i z `~/.codex`.
- Puste ustawienie spada do bezwzględnego, istniejącego `CODEX_HOME`.
- Względne `CODEX_HOME` jest ignorowane.
- Brak katalogów → `missing`.
- `sourceInstanceId` zmienia się, gdy zmienia się realpath, i zostaje stabilne dla tego samego realpath.

### 8.2 `test/codexImporter.test.ts`

Katalog tymczasowy z syntetycznym JSONL. Bez prawdziwego domu Codexa.

- Import dwa razy → ta sama liczba requestów i te same sumy tokenów (akceptacja 1).
- Rekord usage plus migawka token-count → jeden request, jeden wiersz migawki (akceptacja 2).
- Plik samych migawek → zero requestów (akceptacja 3).
- Plik forka używa ponownie `responseId` → jeden globalny request; rozmowa dziecka ma `parent_conversation_id`; nowe response id na dziecku zwiększa licznik globalny o jeden i jest jedynym wierszem wydatku dziecka (akceptacja 4).
- Dwa katalogi (dwa id instancji), ten sam tytuł, brak id konta → dwa klucze zakresu, oba `unknown-source:…` (akceptacja 5, połowa magazynu).
- Skrócić plik, importować ponownie → nowa generacja, bez duplikatu requestu.
- Ten sam rozmiar, inny prefiks, importować ponownie → nowa generacja, bez duplikatu.
- Przenieść plik pod `archived_sessions/` → nadal jeden request.
- Otworzyć magazyn ponownie i importować jeszcze raz → nadal jeden request.
- Linia rolloutu zawierająca zdanie promptu nie pojawia się w żadnej tekstowej kolumnie SQL (zrzut wartości schematu).
- Symlink, którego realpath wychodzi z katalogu, jest pominięty.
- `history.jsonl` jest pominięty.
- Import wyłączony → `refresh()` nie woła `readFrom`.

---

## 9. Bezpieczeństwo

Zostać wewnątrz rozwiązanego katalogu. Nie otwierać plików auth Codexa. W tej fazie nie logować ścieżek bezwzględnych na poziomie info (testy mogą asercje stawiać na zwracanych strukturach). Nierozpoznane linie zwiększają tylko licznik.

---

## 10. Przekazanie

Faza 3a czyta magazyn. Nie importuje. Faza 3b woła `HistoryService.start` z `activate()` bez czekania.
