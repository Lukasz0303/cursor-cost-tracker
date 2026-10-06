# Spójność dat/czasu + split frontendu media

**Polski.** Kanoniczny EN: [datetime-media-foundation.md](./datetime-media-foundation.md)
**Status:** w toku (fazy w kolejności poniżej).
**Zależy od:** istniejącego `historyFromDate`, `formatDateTime`, ścieżki esbuild `limits`.
**Wersja:** praca fundamentowa (PATCH / wewnętrzna); zoom chartów może wejść później jako MINOR.

Gdy ten plik i [prd.md](../context/prd.md) się różnią, **wygrywa PRD**.

---

## 1. Cel

Odpowiedź na feedback kontrybutora:

1. **Jedna polityka lokalnego dnia kalendarzowego** (Today, From–To, Charts, Coding stats, prompty Optimize) — bez cichego mieszania UTC/local.
2. **Split źródeł `media/`**, żeby drobna zmiana UI nie wymagała ładowania IIFE 7k+ linii (koszt tokenów agenta i tempo kontrybucji).
3. **Tani paint HistoryPanel** przy zmianie motywu (bez session DB / titles / credit savings).
4. **Click-expand + zoom chartów** dopiero po wyciągnięciu modułów Charts.

**Done when:** jak w wersji angielskiej (§1).

---

## 2. Poza zakresem

Jak w EN: pełny audyt, rewrite webview na TS/React, pełny split CSS w pierwszym passie, nowe API usage.

---

## 3. Fazy

| Faza | Deliverable |
|------|-------------|
| 0 | Ten plan + indeks README |
| 1 | `src/time/*`, migracja, Optimize local+zone, CI TZ |
| 2 | Tani paint kolorów w `HistoryPanel` |
| 3 | `media/src` → esbuild → `history.js`; extract Charts |
| 3b | Extract leaderboard + settings |
| 5 | Expand + zoom chartów |
| 6 | PRD timezone, nota contributor, CHANGELOG |

---

## 4–6

Szczegóły API czasu, bundla media i zoomu — w [datetime-media-foundation.md](./datetime-media-foundation.md).
