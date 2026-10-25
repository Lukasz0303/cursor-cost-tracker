# Faza 6 — Porównanie organizacji

**Plan nadrzędny:** [openai-codex.pl.md](./openai-codex.pl.md) §9 faza 6
**Status:** późniejszy minor. Nie zaczynać, dopóki PRD nie dopuści klienta administracyjnego za zgodą.
**Zależy od:** [phase-5-recorder.pl.md](./phase-5-recorder.pl.md)
**Dalej:** [phase-7-analysis.pl.md](./phase-7-analysis.pl.md)
**Angielski:** [phase-6-organization.md](./phase-6-organization.md)

Gdy ten plik kłóci się z planem nadrzędnym, **wygrywa plan nadrzędny**. Gdy którykolwiek kłóci się z PRD, **wygrywa PRD**.

Jedna wiadomość w Agent. Ruszać tylko ścieżki z §3.

---

## 1. Cel

Pokazać lokalny szacunek i koszt raportowany przez organizację dla tej samej organizacji, projektu, czasu, modelu i jednostki. Te dolary nie są zapisywane na requestach i nie są saldem planu ChatGPT.

**Gotowe, gdy:**

- Błąd synchronizacji zostawia lokalne wiersze na miejscu (akceptacja 16).
- Koszt organizacji nie jest dodawany do wierszy requestów i nie jest odejmowany od planu ChatGPT (akceptacja 17).
- Klucz administracyjny żyje w `context.secrets`. Nie jest ustawieniem, nie ma go w webview, w CSV ani w logach.

---

## 2. Poza zakresem

| Element | Dlaczego |
|---------|----------|
| Zamiana koszyków w wiersze requestów | To agregaty |
| Polling częstszy niż 15 minut | Kontrakt planu nadrzędnego |
| Blokowanie `activate()` na sieci | `activate()` zostaje nieblokujące |

---

## 3. Pliki

```
src/openaiHistory/org/client.ts
src/openaiHistory/org/buckets.ts
src/openaiHistory/store/migrations.ts
src/ui/historyPanel.ts
media/src/tabs/stats.js
test/openaiOrgBuckets.test.ts
```

Migracja **4** dodaje `billing_buckets`. Unikalność `(scope_id, start_at, end_at, dimensions_hash)`.

`historyPanel.ts` i `stats.js` tylko dla karty porównania. Nie zmieniać sum requestów.

---

## 4. Klient

Ręczne odświeżenie oraz poll co 15 minut. Pobrać ponownie ostatnie okno i podmienić koszyki o tym samym zakresie i scope. Iść za `next_page`. Przy HTTP 429 zrobić backoff i zostawić poprzednie koszyki. Timeout nie kasuje lokalnych requestów.

Endpointy, gdy PRD je nazwie:

```text
GET https://api.openai.com/v1/organization/usage/completions
GET https://api.openai.com/v1/organization/costs
```

Klucz jest czytany z Secret Storage w chwili wywołania. Webview wysyła tylko `openai.orgRefresh`. Nigdy nie wysyła klucza.

Porównywać wyłącznie zgodną organizację, projekt, czas, model i jednostkę. Statistics pokazuje `localTokenEstimate` i `reportedOrganizationCost` jako dwie liczby. Brakujący wymiar chowa porównanie zamiast wymuszać dopasowanie.

---

## 5. Testy

- Koszyki fixture podmieniają ten sam zakres i się nie dublują.
- Rzucający klient zostawia wcześniej wstawione requesty i koszyki bez zmian.
- Mapper, który dostaje jednocześnie wiersz requestu i koszyk, nie zapisuje kwoty koszyka na `reported_cost_usd`.
- Budowniczy żądania wyeksportowany z modułu klienta nie ma pola, które przyjmuje klucz do wartości zwracanej i logowanej w testach (parametr klucza idzie jako nagłówek wewnątrz wstrzykniętego `fetch` i nie występuje w komunikatach rzuconych błędów).

---

## 6. Przekazanie

Faza 7 zapisuje przebiegi analizy. Nie wycenia ponownie z koszyków organizacji.
