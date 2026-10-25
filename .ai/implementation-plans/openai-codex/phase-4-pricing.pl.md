# Faza 4 — Taryfa

**Plan nadrzędny:** [openai-codex.pl.md](./openai-codex.pl.md) §5 oraz decyzje 20–22
**Status:** gotowe do implementacji
**Zależy od:** [phase-3a-query.pl.md](./phase-3a-query.pl.md) dla etykiet wierszy. Statystyki z fazy 3d podchwycą zapisane stringi bez przepisywania.
**Dalej:** [phase-5-recorder.pl.md](./phase-5-recorder.pl.md) (późniejszy minor, nie to wydanie)
**Angielski:** [phase-4-pricing.md](./phase-4-pricing.md)
**Wydanie:** 1.1.0. Nie podbijać `package.json` w tej turze. Wydanie z pustym katalogiem i kosztem `—` jest dopuszczalne, gdy tokeny są poprawne.

Gdy ten plik kłóci się z planem nadrzędnym, **wygrywa plan nadrzędny**. Gdy którykolwiek kłóci się z PRD, **wygrywa PRD**.

Jedna wiadomość w Agent. Ruszać tylko ścieżki z §3.

---

## 1. Cel

Wyceniać request z jawnej wersji taryfy. Brak stawki zostaje `—`. Wiersz planu ChatGPT wyceniony taryfą API jest podpisany jako ekwiwalent API. Szacunek API, koszt raportowany przez organizację i ekwiwalent API nigdy nie dzielą jednej sumy.

**Gotowe, gdy:**

- Stawki fixture 2 / 0.5 / 8 za milion, I=100000, C=80000, O=10000, R=2000 → decimal **0.16** (akceptacja 6).
- Nieznany model albo brak stawki zostawia koszt null, a `cost_coverage` nie jest `complete`.
- `billingMode = chatgpt-plan` trzyma `reportedCostUsd` jako null, dopóki wiersz nie ma już zgłoszonej opłaty. Wynik taryfy API jest zapisany jako podstawa ekwiwalentu API, nie jako szacunek API i nie jako koszt raportowany.
- Wiersz requestu trzyma `pricingVersion`.
- `npm test` jest zielone dla `test/openaiHistoryPricing.test.ts`.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| Domyślna mapa nazwy modelu Codexa na cennik Cursora | nigdy |
| Costs API organizacji | faza 6 |
| Przepisywanie historycznych wierszy przy zmianie taryfy | świadome przeliczenie to późniejsza wersja. Ta faza stempluje wersję, której użyła. |
| Sieciowe pobranie cennika | katalog w tej fazie to tabela w repozytorium i może być pusty |

---

## 3. Pliki

```
src/openaiHistory/pricing/decimal.ts
src/openaiHistory/pricing/types.ts
src/openaiHistory/pricing/catalog.ts
src/openaiHistory/pricing/calculate.ts
src/openaiHistory/pricing/coverage.ts
src/openaiHistory/store/migrations.ts
test/openaiHistoryPricing.test.ts
```

`migrations.ts` tylko dopisuje migrację **2**: tabela `pricing_versions`. Nie edytować migracji 1.

---

## 4. Decimal (`decimal.ts`)

Pieniądze to stałoprzecinkowa liczba całkowita (skala **6** miejsc po przecinku) trzymana jako string dziesiętny. Na zapisanej wartości nie ma floatu binarnego.

```typescript
export function multiplyRate(tokens: number, ratePerMillion: string): string
export function addDecimal(a: string, b: string): string
export function formatCostCell(value: string | null): string
```

`formatCostCell` to jedyne miejsce, które zaokrągla do dwóch miejsc. Niezerowe wartości, które zaokrąglają się do `0.00`, zwracają tekst komórki `< $0.01`. Null zwraca `—`.

Formuła, stosowana tylko wtedy, gdy I, C i O są liczbami i istnieją wszystkie trzy stawki:

```text
((I - C) × inputRate + C × cachedInputRate + O × outputRate) / 1_000_000
```

R nie jest dodatkowym składnikiem. Nullowe C nie staje się zerem: koszt jest null. Niezerowe `cache_write_input_tokens` nie wchodzi do formuły; coverage nie sięga `complete`.

---

## 5. Katalog i liczenie

```typescript
export type PricingVersion = {
  id: string
  model: string
  effectiveFrom: string
  serviceTier: string | null
  inputRate: string
  cachedInputRate: string
  outputRate: string
  source: 'fixture' | 'manual' | 'empty'
}

export function priceRequest(input: {
  model: string | null
  billingMode: BillingMode
  usage: TokenUsage
  reportedCostUsd: string | null
  catalog: readonly PricingVersion[]
  observedAt: string
}): PricedRequest
```

Wyszukanie to dokładny string modelu plus wersja, której `effectiveFrom` jest najpóźniejsza i nadal ≤ `observedAt`. Bez rozmytego dopasowania do modelu Cursora. Pusty katalog zwraca ceny null.

| `billingMode` | Zapisany wynik |
|---------------|----------------|
| `api` | `estimatedApiCostUsd` ustawione, podstawa estimated-api, `reportedCostUsd` bez zmian |
| `chatgpt-plan` | `reportedCostUsd` zostaje null, dopóki `input.reportedCostUsd` nie jest nie-null. Wynik formuły wraca w polu `apiEquivalentCostUsd`. Etykieta wiersza w fazie 3a to `API-equiv. $…`. |
| `unknown` | Wynik formuły nie jest pokazywany jako opłata. Komórka kosztu zostaje `—`, chyba że istnieje kwota raportowana. |

`coverage.ts`: `complete` tylko wtedy, gdy formuła się wykonała i cache-write jest null albo zero. `tokens-only`, gdy usage istnieje, a cena jest null. `partial`, gdy część I/C/O jest null. `unknown`, gdy brakuje usage.

Importer woła `priceRequest` przy wstawianiu requestu. Drugi import tego samego response id nie podmienia już zapisanego `pricingVersion`.

---

## 6. Migracja 2

`pricing_versions(id TEXT PRIMARY KEY, model TEXT NOT NULL, effective_from TEXT NOT NULL, service_tier TEXT, input_rate TEXT NOT NULL, cached_input_rate TEXT NOT NULL, output_rate TEXT NOT NULL, source TEXT NOT NULL)`.

W produkcji nic nie siać. Testy wstawiają wersję fixture 2 / 0.5 / 8.

---

## 7. Testy

- Fixture 0.16, porównanie stringa na decimalu skali 6 (`0.160000` albo forma kanoniczna modułu — utrwalić jedną w teście).
- Null C → koszt null.
- Brak modelu → koszt null, coverage `tokens-only`.
- `chatgpt-plan` z pasującą taryfą → ustawiony ekwiwalent API, `reportedCostUsd` null, helper etykiety zwraca string zaczynający się od `API-equiv.`.
- `chatgpt-plan` z opłatą zgłoszoną w pliku → ta opłata zostaje na `reportedCostUsd` i nie jest dodawana do ekwiwalentu.
- Niezerowy cache-write → coverage nie jest `complete`.
- Pusty katalog → koszt null.
- Ponowne zastosowanie tego samego response id zostawia pierwsze `pricingVersion`.

---

## 8. Przekazanie

1.1.0 może wyjść po tej fazie, gdy tura wydania zaktualizuje PRD, architekturę, bezpieczeństwo, README, changelog i snapshot kodu, a potem spakuje w osobnej wiadomości. Fazy 5–7 zostają niezacząte.
