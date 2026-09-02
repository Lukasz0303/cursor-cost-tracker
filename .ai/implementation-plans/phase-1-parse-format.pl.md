# Faza 1 — Typy, parse, format

**Plan nadrzędny:** [mvp.pl.md](./mvp.pl.md) · kanon EN: [phase-1-parse-format.md](./phase-1-parse-format.md)  
**Status:** gotowy do realizacji  
**Zależy od:** [phase-0-scaffold.pl.md](./phase-0-scaffold.pl.md) (`npm test` działa)  
**Następna:** [phase-2-session.pl.md](./phase-2-session.pl.md)  
**PRD:** §8, G3 (± 0,01 $)  
**Historyjki:** A2 (budżet dzienny)

Przy rozjeździe wygrywa **angielski PRD**.

---

## 1. Cel

Czyste funkcje: nieoficjalny JSON Cursora → `UsageReady` / `UsageQuery` oraz format dolarów, tokenów, dat i kind. Bez importu `vscode`, `fetch` i SQLite.

**Gotowe gdy:** `npm test` zielone dla parse + format + daily budget.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| Odczyt `state.vscdb` | faza 2 |
| HTTP | faza 3 |
| Status bar / webview | fazy 5–6 |
| `!` / Ignore | v1.1 |

---

## 3. Pliki

```
src/usage/types.ts
src/usage/parse.ts
src/format.ts
test/format.test.ts
test/parse.test.ts
test/dailyBudget.test.ts
test/fixtures/usage-summary.sample.json
test/fixtures/usage-events.sample.json
```

Fixtury **zanonimizowane**: bez tokenów, cookie, prawdziwych emaili, JWT.

---

## 4. Typy (`src/usage/types.ts`)

Skopiuj z [mvp.md](./mvp.md) §5: `UsageQuery`, `UsageReady`, `UsageSnapshot` (`loading` | `ready` | `error`).

Typy JSON API trzymaj w `parse.ts` (albo `apiTypes.ts`) jako `unknown` + zwężanie. **Nie** dodawaj pól cookie/token do `UsageQuery` / `UsageReady`.

---

## 5. Parse (`src/usage/parse.ts`)

Klauzule strażnicze, early return, happy path na końcu. Jawne typy zwracane. Bez `any`.

| Funkcja | Zachowanie | Krawędzie |
|---------|------------|-----------|
| `centsToUsd` | `cents / 100` | `NaN` / `Infinity` → `0` (albo pomiń event; jedna decyzja + test) |
| `pickUsagePool` | individual `onDemand` → `plan` → team `onDemand` → `overall` | brak puli; pomiń nieosobiste jeśli jest flaga |
| `isUnlimited` | true gdy brak capu | UI ukryje Today |
| `mapEventToQuery` | koszt z `chargedCents` **albo** `tokenUsage.totalCents` **albo** `usageBasedCosts`; tokeny = input + output + cache r/w | nieparsowalne → `null` |
| `workingDaysLeftInMonth` | pon.–pt. **łącznie z dniem dzisiejszym**, lokalna TZ | piątek = ostatni dzień miesiąca → `1` |
| `dailyBudgetUsd` | `remaining / days` | `null` gdy `days ≤ 0` lub remaining null |
| `sumTodayUsedUsd` | suma `costUsd` z lokalnego dnia kalendarzowego | pusta lista → `0`; **nie** data UTC |
| `stripModelPrefix` | obetnij wiodące `cursor-` | `null` zostaje `null` |

Zrób też kompozytor dla fazy 4, np. `buildUsageReady({ summary, events, now, email? })`.

JSON jest nieoficjalny: parse nie rzuca do hosta rozszerzenia.

### 5.1 Koszt eventu

1. `chargedCents` jeśli skończona liczba  
2. inaczej `tokenUsage.totalCents`  
3. inaczej `usageBasedCosts`  
4. inaczej `0` albo `null` (udokumentuj w teście)

### 5.2 Suma tokenów

`tokens = input + output + cacheRead + cacheWrite` gdy klucze są; kolumny INPUT / OUTPUT zostają surowym input/output (bez cache).

---

## 6. Format (`src/format.ts`)

Stringi UI po **angielsku**.

| Funkcja | Przykład | Zasady |
|---------|----------|--------|
| `formatDollars` | `3.79 $` | zawsze 2 miejsca; spacja przed `$` |
| `formatTokens` | `64,755` | pełna liczba z separatorem tysięcy; **nie** `64.8k` w MVP |
| `formatDateTime` | `1.09.2026, 10:05:12` | lokalna TZ; dzień.miesiąc.rok |
| `formatKind` | `Included In Business` | humanizacja enumów; puste → `—` albo `Unknown` (test) |

---

## 7. Testy

`npm test` (komenda `4-run-tests`).

- cents, kolejność puli, unlimited / brak limitu, mieszane pola centów, puste eventy
- budżet: remaining/dni, `days <= 0`, piątek na końcu miesiąca, weekend nie jest dniem roboczym
- format dolarów, tokenów, daty ze **wstrzykniętym** `now` / timestampem (bez zegara maszyny)

---

## 8. Bezpieczeństwo

Brak sekretów w fixturach. Parse nie wrzuca całych body API do komunikatów błędów.

---

## 9. Przekazanie do fazy 2

Faza 2 czyta cookie z SQLite. Parse zostaje bez `fs` i `vscode`.
