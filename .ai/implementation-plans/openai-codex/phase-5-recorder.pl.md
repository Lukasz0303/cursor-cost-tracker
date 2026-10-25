# Faza 5 — Rejestrator

**Plan nadrzędny:** [openai-codex.pl.md](./openai-codex.pl.md) §9 faza 5
**Status:** późniejszy minor. Nie zaczynać w trakcie 1.1.0.
**Zależy od:** wydanej [phase-4-pricing.pl.md](./phase-4-pricing.pl.md)
**Dalej:** [phase-6-organization.pl.md](./phase-6-organization.pl.md)
**Angielski:** [phase-5-recorder.md](./phase-5-recorder.md)

Gdy ten plik kłóci się z planem nadrzędnym, **wygrywa plan nadrzędny**. Gdy którykolwiek kłóci się z PRD, **wygrywa PRD**. PRD musi dopuścić tego klienta, zanim faza wystartuje.

Jedna wiadomość w Agent. Ruszać tylko ścieżki z §3.

---

## 1. Cel

Importować JSONL, który dopisuje własna aplikacja użytkownika. Chip OpenAI API pokazuje wtedy te wiersze. Wtyczka nadal sama nie widzi wywołań innych programów.

**Gotowe, gdy:**

- Przerwany stream jest `partial` albo `missing`, a nie potwierdzonym `$0` (akceptacja 11).
- Retry z nowym `responseId` jest nowym requestem. To samo `responseId` jest drugą obserwacją tego samego requestu (akceptacja 12).
- Linia sinka nigdy nie zapisuje klucza API, nagłówka Authorization, promptu, tekstu odpowiedzi, argumentów narzędzia ani ciasteczek.
- `openai.refresh` zwraca wiersze zamiast `not-connected`, gdy ścieżka sinka jest ustawiona i da się ją czytać.

---

## 2. Poza zakresem

| Element | Dlaczego |
|---------|----------|
| Przechwytywanie TLS, ciasteczka ChatGPT | Reguła produktu |
| Zużycie i koszty organizacji | faza 6 |
| Domyślne ustawienie klucza administracyjnego | nigdy. Klucze czekają na fazę 6 i `context.secrets`. |

---

## 3. Pliki

```
src/openaiHistory/recorder/sinkTypes.ts
src/openaiHistory/recorder/sinkParser.ts
src/openaiHistory/recorder/importer.ts
src/openaiHistory/store/migrations.ts
test/openaiRecorder.test.ts
test/fixtures/openai-sink/
```

Migracja **3** dodaje `http_attempts`. Nie edytować migracji 1–2.

Ustawienie dokładane w tej fazie, tylko w `package.json` i `src/config.ts`: `cursorCost.openaiSinkPath` (string, domyślnie `""`). Pusta ścieżka zostawia stan braku połączenia. Pole Settings podłączyć w `media/src/tabs/settings.js` w tej samej fazie, bo chip nie wyjdzie z not-connected bez niego. Tylko `en` i `pl`.

---

## 4. Linie sinka

Trzy typy rekordów, jeden obiekt JSON na linię: `begin`, `finish`, `fail`.

| Pole | Na |
|------|-----|
| `logicalOperationId`, `attemptId`, lokalne `conversationId`, `turnId`, `requestedModel` | `begin` |
| zwrócony model, końcowe usage, `responseId`, status, `completedAt` | `finish` |
| bezpieczny `errorCode` | `fail` |

`begin` wstawia wiersz `http_attempts` i request z `usageQuality: 'missing'` oraz kosztem null. `finish` wypełnia usage wyłącznie z końcowego obiektu usage dostawcy. Nie sumować tokenów odgadniętych z fragmentów strumienia. `finish` bez usage ustawia `partial`, gdy próba się zaczęła, inaczej `missing`. `fail` ustawia status i nie ustawia kosztu na zero.

Parser normalizuje usage Responses (`input_tokens`, `input_tokens_details.cached_tokens`, `output_tokens`, `output_tokens_details.reasoning_tokens`, `total_tokens`) oraz Chat Completions (`prompt_tokens`, `completion_tokens`). Jedno fixture na kształt.

Deduplikacja jak w fazie 2a: `(provider = openai, accountScopeKey, responseId)`. Nowe response id wstawia. To samo id dodaje obserwację z `attributes_spend = 0`.

Zakres konta używa własnego opaque id projektu albo klucza z linii, gdy linia je ma (`account:<id>`, pewność `source-reported`). Inaczej `unknown-source:<sourceInstanceId>` dla tego pliku sinka. Nigdy e-mail Cursora.

---

## 5. Testy

- `begin` + `finish` z usage → jeden request, `reported`.
- `begin` bez `finish` → `partial` albo `missing`, koszt null.
- Dwa finish, dwa response id, jedno `logicalOperationId` → dwa requesty.
- Dwa finish, jedno response id → jeden request, dwie obserwacje.
- Linia zawierająca `Authorization` albo pole promptu jest pominięta i policzona, a zakazany tekst nie występuje w bazie.

---

## 6. Przekazanie

Faza 6 może porównać te wiersze z koszykami organizacji. Nie wolno jej zapisać dolarów organizacji na tych wierszach.
