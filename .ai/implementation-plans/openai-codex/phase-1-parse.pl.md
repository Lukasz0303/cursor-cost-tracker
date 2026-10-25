# Faza 1 — Parser i usage

**Plan nadrzędny:** [openai-codex.pl.md](./openai-codex.pl.md)
**Status:** zaimplementowane
**Zależy od:** niczego w `src/openaiHistory/`
**Dalej:** [phase-2a-store.pl.md](./phase-2a-store.pl.md)
**Angielski:** [phase-1-parse.md](./phase-1-parse.md)
**Wydanie:** 1.1.0. Nie podbijać `package.json`.

Gdy ten plik kłóci się z planem nadrzędnym, **wygrywa plan nadrzędny**. Gdy którykolwiek kłóci się z PRD, **wygrywa PRD**.

Jedna wiadomość w Agent. Ruszać tylko ścieżki z §3.

---

## 1. Cel

Czyste funkcje zamieniają jedną linię rolloutu Codexa w kandydata requestu, migawkę usage albo pominięcie. Bez `vscode`, bez `fs`, bez SQLite, bez sieci.

**Gotowe, gdy:**

- `token_usage_record` i `event_msg` / `token_count` tej samej odpowiedzi liczą się jako **jeden** kandydat requestu. Migawka nie jest drugim requestem.
- Wejście złożone tylko ze snapshotów nie staje się listą requestów.
- Liczniki fixture I=100000, C=80000, O=10000, R=2000 dają **T=110000**.
- Fixture z dwoma modelami emituje oba. Model zgłoszony przy odpowiedzi wygrywa z kontekstem tury na tym requeście.
- Linia JSONL przecięta między chunkami oraz sekwencja UTF-8 przecięta między chunkami domykają się przy następnym chunku.
- `npm test` jest zielone dla trzech nowych plików testów.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| Deduplikacja, sumy forka, SQLite | faza 2 |
| Kwota **0.16** | faza 4 (ta faza sprawdza tylko T) |
| Webview, ustawienia, `extension.ts` | faza 3 |
| Czytanie prawdziwego drzewa `~/.codex` | nigdy w testach |

---

## 3. Pliki

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

Fixture są syntetyczne. Identyfikatory wymyślone. Bez plików auth, ciasteczek, promptów skopiowanych z prawdziwej sesji i bez wyniku narzędzia.

---

## 4. Domena (`src/openaiHistory/domain.ts`)

Nie rozszerzać `UsageQuery`. Stała wersji parsera: `rollout-v1`.

```typescript
export const ROLLOUT_PARSER_VERSION = 'rollout-v1'

export type RequestSource = 'codex-local' | 'openai-api'
export type AccountConfidence = 'source-reported' | 'user-assigned' | 'unknown'
export type ModelEvidence = 'response' | 'turn-context' | 'requested' | 'unknown'
export type BillingMode = 'api' | 'chatgpt-plan' | 'unknown'
export type RequestStatus = 'completed' | 'failed' | 'cancelled' | 'incomplete' | 'unknown'
export type UsageQuality = 'reported' | 'derived' | 'partial' | 'missing'
export type CostCoverage = 'complete' | 'tokens-only' | 'partial' | 'unknown'

export type TokenUsage = {
  inputTokens: number | null
  cachedInputTokens: number | null
  cacheWriteInputTokens: number | null
  outputTokens: number | null
  reasoningOutputTokens: number | null
  totalTokens: number | null
  anomaly: boolean
}

export type RequestCandidate = {
  kind: 'request'
  responseId: string | null
  conversationId: string | null
  parentConversationId: string | null
  sessionId: string | null
  turnId: string | null
  observedAt: string
  model: string | null
  modelEvidence: ModelEvidence
  billingMode: BillingMode
  status: RequestStatus
  errorCode: string | null
  accountOpaqueId: string | null
  usage: TokenUsage
  usageQuality: UsageQuality
  byteOffset: number
}

export type UsageSnapshotEvent = {
  kind: 'snapshot'
  conversationId: string | null
  sessionId: string | null
  turnId: string | null
  observedAt: string
  usage: TokenUsage
  byteOffset: number
}

export type ParserContext = {
  sessionId: string | null
  threadId: string | null
  turnId: string | null
  model: string | null
  accountOpaqueId: string | null
  parentConversationId: string | null
  billingMode: BillingMode
}
```

`billingMode` zostaje `unknown`, dopóki sama linia nie nazwie planu albo opłaty API. Ścieżki tu nie ma i ścieżka nie może ustawić `chatgpt-plan`.

---

## 5. Identyfikatory (`src/openaiHistory/ids.ts`)

| Funkcja | Wynik |
|---------|--------|
| `shortThreadTitle(threadId: string): string` | `#` + pierwsze 8 znaków. Krótsze id używa całego id po `#`. |
| `unknownScopeKey(sourceInstanceId: string): string` | `unknown-source:` + id. Nigdy puste. |
| `accountScopeKey(opaqueId: string): string` | `account:` + id. |
| `provisionalRequestKey(sourceInstanceId, fileGeneration, byteOffset): string` | Stabilne złączenie trzech wartości. Tylko gdy brak `responseId`. |

W tej fazie nie ma haszowania. `sourceInstanceId` przychodzi już policzone w fazie 2b.

---

## 6. Usage (`src/openaiHistory/usage.ts`)

```text
I = input, razem z cache
C = cached input, podzbiór I
O = output, razem z reasoning
R = reasoning, podzbiór O
T = I + O
```

Nie dodawać `I + C + O + R`. Null znaczy nieznane. Zero znaczy zgłoszone zero. Nie zastępować nullowego `C` zerem.

| Funkcja | Zachowanie |
|---------|------------|
| `readTokenCount(value: unknown): number \| null` | Skończona liczba całkowita ≥ 0, inaczej `null`. |
| `normalizeUsage(raw: unknown): TokenUsage` | Mapować `input_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, `output_tokens`, `reasoning_output_tokens`, `total_tokens`. Ignorować każdy inny klucz, w tym `turn_token_usage` i `thread_token_usage`. |
| `applyUsageRules(usage: TokenUsage): TokenUsage` | Gdy `I` i `C` są liczbami i `C` jest poza `0…I`, ustawić `anomaly` i **zostawić** surowe liczby. To samo dla `R` poza `0…O`. Gdy `total_tokens` jest liczbą, `I` i `O` są liczbami i `total_tokens !== I + O`, ustawić `anomaly` i zostawić surowe liczby. |
| `billableTotal(usage: TokenUsage): number \| null` | `I + O`, gdy obie są liczbami. Inaczej `null`. Nie wracać do `total_tokens` jako T. Nie dodawać tokenów cache-write. |

Fixture: I=100000, C=80000, O=10000, R=2000 → `billableTotal` **110000**, `anomaly` false.

---

## 7. Parser (`rolloutTypes.ts`, `rolloutParser.ts`)

Każdą zdekodowaną linię traktować jako dane. Nie używać `eval`. Limit długości egzekwuje czytnik bajtów przed parsowaniem.

```typescript
export type ParseOutcome =
  | { type: 'request'; candidate: RequestCandidate; context: ParserContext }
  | { type: 'snapshot'; snapshot: UsageSnapshotEvent; context: ParserContext }
  | { type: 'context'; context: ParserContext }
  | { type: 'skip'; reason: 'empty' | 'bad-json' | 'unknown-type' | 'dropped-body' }

export function parseRolloutLine(
  line: string,
  context: ParserContext,
  byteOffset: number,
): ParseOutcome
```

`emptyParserContext(): ParserContext` zwraca same nulle i `billingMode: 'unknown'`.

| Linia | Akcja |
|-------|--------|
| `session_meta` | Skopiować id sesji, id wątku, opcjonalne `creator_account_id` albo `creator_user_id` (wygrywa pierwsze niepuste), opcjonalne id wątku rodzica. Nie emituje requestu. Powtórka tylko odświeża kontekst. |
| `turn_context` | Zapamiętać `turnId` i model. Dowód dla późniejszego requestu bez modelu odpowiedzi to `turn-context`. |
| `token_usage_record` | Jeden kandydat z samego `payload.usage`. `observedAt` to `timestamp` linii. Model z payloadu wygrywa (`response`); inaczej model z kontekstu (`turn-context`); inaczej `model: null` (UI później mówi Unknown). `usageQuality` to `reported`, gdy I albo O jest liczbą, inaczej `missing`. Status zostaje `unknown`. Samo usage nie ustawia `completed`. |
| `event_msg` z `token_count` | Migawka. Nie request. |
| Tekst użytkownika, agenta, narzędzia albo instrukcji | `skip` / `dropped-body`. Zwrócona wartość nie zawiera tekstu wiadomości. |
| Błąd terminalny, którego payload nazywa to samo `response_id` albo `turn_id` co bieżący kontekst | Samo odświeżenie kontekstu nie wystarcza: emitować `type: 'request'` tylko wtedy, gdy ta linia ma też `payload.usage`. W przeciwnym razie zwrócić wynik `{ type: 'status'; status; errorCode; responseId; turnId }`, dopisany do unii powyżej, żeby faza 2 mogła poprawić status bez wymyślania usage. |
| Cokolwiek innego albo zły JSON | `skip`. Wołający liczy to. |

Brak nazwy modelu na kandydacie znaczy `model: null`. Nie podstawiać domyślnej nazwy modelu.

Wynik statusu (dopisać do unii):

```typescript
| {
    type: 'status'
    status: RequestStatus
    errorCode: string | null
    responseId: string | null
    turnId: string | null
    context: ParserContext
  }
```

Linia terminalna, która nie nazywa id odpowiedzi ani id tury, to `unknown-type` (pominięta, policzona). Nie przypinać jej do „ostatniego requestu”.

---

## 8. Czytnik bajtów (`byteReader.ts`)

```typescript
export const MAX_ROLLOUT_LINE_BYTES = 1_048_576

export type ByteReader = {
  push(chunk: Uint8Array): string[]
  byteOffset(): number
}

export function createByteReader(): ByteReader
```

- `push` dokleja bajty, dekoduje tylko do ostatniego `\n` (bajt `0x0A`) i zwraca te pełne linie bez znaku nowej linii.
- Sekwencja UTF-8 przecięta granicą chunka zostaje w ogonie, aż następny `push` ją domknie.
- Offsety to offsety bajtowe początku każdej zwróconej linii, liczone od startu strumienia.
- Linia dłuższa niż `MAX_ROLLOUT_LINE_BYTES` jest odrzucana. Wołający liczy ją przez rzucone `LineTooLong` albo zwrócone `{ dropped: true }` — wybrać jedno i pokryć testem. Wznowić po następnym znaku nowej linii. Nie parsować przewymiarowanej linii.
- `\r\n` to jeden koniec linii. Nie zostawiać końcowego `\r` w JSON.

---

## 9. Testy

### 9.1 `test/openaiHistoryUsage.test.ts`

- Liczniki fixture → T=110000, anomaly false.
- Null w `cached_input_tokens` zostaje nullem.
- `cached_input_tokens: 0` zostaje zerem.
- `C > I` ustawia anomaly i zostawia obie liczby.
- `total_tokens` niezgodne z `I + O` ustawia anomaly.
- Obiekty `turn_token_usage` / `thread_token_usage` obok `usage` nie są czytane przez `normalizeUsage` (podać samo `usage`; test parsera dowodzi, że rekord ignoruje rodzeństwo).
- Niezerowe `cache_write_input_tokens` jest zapisane i nie wchodzi do T.

### 9.2 `test/codexRolloutParser.test.ts`

Fixture w `test/fixtures/codex-rollouts/`:

| Plik | Asercja |
|------|---------|
| `session-meta.jsonl` | Kontekst wypełniony. Brak requestu. Druga meta nie emituje requestu. |
| `turn-context.jsonl` | Model zapamiętany. |
| `token-usage-record.jsonl` | Jeden kandydat z `payload.usage`. Sąsiednie `turn_token_usage` i `thread_token_usage` nie zmieniają I/O. |
| `token-count-snapshot.jsonl` | Jedna linia requestu plus jeden `token_count` → jeden wynik requestu i jeden wynik migawki. |
| `snapshot-only.jsonl` | Zero wyników requestu. |
| `bad-line.jsonl` | Zły JSON → `bad-json`. |
| `dropped-body.jsonl` | Linia wiadomości użytkownika → `dropped-body`, a `JSON.stringify(outcome)` nie zawiera zdania z fixture. |
| `fork.jsonl` | Dwóch kandydatów, to samo `responseId`, drugi niesie `parentConversationId`. Ta faza ich nie scala. |
| `unknown-account.jsonl` | `accountOpaqueId` null. |
| `two-models.jsonl` | Kontekst tury z modelem A, późniejszy rekord z modelem B → model kandydata B, dowód `response`. Rekord bez modelu → model A, dowód `turn-context`. |

### 9.3 `test/codexByteReader.test.ts`

- Rozciąć linię JSONL na dwa chunki → jedna linia, taka jak przy podaniu w całości.
- Rozciąć wielobajtowy znak UTF-8 (w polu tekstu, które i tak odrzucamy) między chunkami → jedna poprawna linia po drugim `push`.
- Offset drugiej linii to długość bajtowa pierwszej linii razem ze znakiem nowej linii.
- Linia ponad limit jest odrzucona; następna krótka linia nadal wraca.

---

## 10. Bezpieczeństwo

Linie czytać jako dane. Fixture są syntetyczne. Żadna kolumna i żadne zwracane pole nie trzyma tekstu promptu ani wyniku narzędzia.

---

## 11. Przekazanie

Faza 2a zapisuje kandydatów i migawki. Nie parsuje od nowa. Faza 2b jest pierwszym modułem, który może wołać `fs`.
