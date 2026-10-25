# Faza 7 — Przebiegi analizy

**Plan nadrzędny:** [openai-codex.pl.md](./openai-codex.pl.md) §9 faza 7
**Status:** późniejszy minor. Nie zaczynać w trakcie 1.1.0.
**Zależy od:** [phase-3d-stats.pl.md](./phase-3d-stats.pl.md). Faza 6 nie jest wymagana dla chipa.
**Dalej:** nic w tym katalogu
**Angielski:** [phase-7-analysis.md](./phase-7-analysis.md)

Gdy ten plik kłóci się z planem nadrzędnym, **wygrywa plan nadrzędny**. Gdy którykolwiek kłóci się z PRD, **wygrywa PRD**.

Jedna wiadomość w Agent. Ruszać tylko ścieżki z §3.

---

## 1. Cel

Utrwalić przebieg analizy, żeby chip Optimized mógł do niego pasować. Nie przepisywać historycznego kosztu. Zmierzyć pierwszą ciepłą stronę przy 100 000 wierszach; 500 ms to cel do pomiaru, nie próg, który ta faza musi już spełnić.

**Gotowe, gdy:**

- Zapisany przebieg sprawia, że filtr Optimized obejmuje to id requestu albo rozmowy i wyklucza wiersze, które mają tylko cache hit (akceptacja: decyzja 19).
- Ponowna analiza nie zmienia `estimated_api_cost_usd` ani `pricing_version` na requeście.
- Webview nadal dostaje jedną stronę (akceptacja 18). Sprawdzenie 100 000 wierszy to notatka z pomiarem w wyjściu testu, nie załadowanie 100 000 węzłów DOM.

---

## 2. Poza zakresem

| Element | Dlaczego |
|---------|----------|
| Opcjonalne tytuły z Codex app-server | Osobna zmiana. Wynegocjowany schemat, bez startu procesu. Tytuł zapasowy zostaje `#` plus krótkie id. |
| Przepisywanie tokenów, żeby pokazać „oszczędność” | Historyczny koszt zostaje |
| Wirtualizacja tabeli Cursora | Tylko ścieżka strony Codexa, jeśli pomiar powie, że zapytanie hosta jest w porządku, a koszt jest w DOM |

---

## 3. Pliki

```
src/openaiHistory/analysis/runs.ts
src/openaiHistory/store/migrations.ts
src/openaiHistory/historyQuery.ts
src/ui/historyPanel.ts
media/src/tabs/queries.js
test/openaiAnalysisRuns.test.ts
```

Migracja **5** dodaje `optimization_runs(id, started_at, range_from, range_to, rule_version, status, request_id, conversation_id)`.

`historyQuery.ts` dostaje filtr `optimized: boolean`. Gdy true, strona zostawia wiersze, których id jest wskazane przez przebieg. Cache hit nie jest dopasowaniem.

`queries.js` włącza chip Optimized, który faza 3c zostawiła bez dopasowania. `historyPanel.ts` zapisuje przebieg, gdy `codex.analyze` wkleja brief, ze statusem `pasted`. Nie oznacza `applied`.

---

## 4. Pomiar

Test wstawia 100 000 syntetycznych wierszy requestów do tymczasowej bazy i mierzy `historyQuery` dla `limit: 100` na ciepłym pliku. Zapisać milisekundy. Nie wywalać zestawu na 500 ms. Nie renderować strony w webview.

---

## 5. Testy

- Wstawić przebieg dla requestu A. Filtr Optimized zwraca A i nie zwraca requestu B, nawet gdy B ma tokeny cached input.
- Po przebiegu string kosztu A jest bez zmian.
- Dwie strony nadal idą keysetem bez powtarzania id przy większej liczbie wierszy użytej przez istniejący test paginacji (przypadek 100 000 to pomiar, nie asercja paginacji).

---

## 6. Przekazanie

W tym katalogu nie ma dalszej fazy. Źródło tytułów z Codex app server to nowy plan, nie rozszerzenie tego pliku.
