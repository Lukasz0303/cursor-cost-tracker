# v1.7 plan implementacyjny — Generated Lines Insight

**Polski.** Angielski (kanoniczny): [generated-lines-insight.md](./generated-lines-insight.md)  
**Status:** research **R1** — wydane w **1.0.4** z Burn Rate Guard  
**Zależności:** baseline MVP (**1.0.3**). Ten sam PATCH co Burn Rate Guard.  
**Wersja:** **1.0.4** (PATCH)

Przy konflikcie wygrywa [prd.md](../context/prd.md) / [prd.pl.md](../context/prd.pl.md).

API usage **nie ma** LOC, diffów ani accept/reject. Linie AI: lokalny storage Cursor i/lub heurystyka edycji. Linie wmerge’owane: **git** na default branch aktywnego workspace.

---

## 1. Cel

Dla **aktywnego workspace**:

1. Ile linii **dodano** w czasie?
2. Ile z nich to linie **AI**?
3. Jaki jest **stosunek** linii AI do linii na **`main` / `master`**?

Trzy sekcje na Statistics + serie na Charts. To **dwa niezależne wolumeny**, nie „które linie AI przeżyły review”.

**Done when:**

- Spike z werdyktem R1/R2/R3 w §5.
- Pure helpery + Vitest; UI z pustymi stanami; toggle; bez cookie / `text` bubble w webview; `activate()` nie blokuje; G5 bez zmian.

---

## 2. Co da się pokazać

| Pytanie | v1 |
|---------|-----|
| Wolumen linii AI | Tak (R1/R2), estimate (A), niedostępne (B) |
| Linie wmerge’owane na main/master | Tak (git) |
| Stosunek AI : merged | Tak gdy AI ≠ null i merged > 0 |
| Konkretne linie AI na masterze | **Poza zakresem** |

---

## 3. Poza zakresem

Usage API jako LOC · multi-workspace · konfigurowalny base branch · chip na status barze · modale · treść czatu · blame przeżycia linii · 7. zakładka / React.

---

## 4. Delty PRD

Sekcja **Generated Lines Insight**: `cursorCost.codeLinesInsight` (domyślnie true); aktywny folder; auto `main`→`master`; Statistics + Charts; disclaimer; non-goal: bez transcriptów, **z** strukturalnymi hunkami checkpointów.

---

## 5. Bramka research

Hipoteza: `cursorDiskKV` → `checkpointId:*` z `originalModelDiffWrtV0` → `sum(modified.length)`.

| Kod | Znaczenie | Źródło AI |
|-----|-----------|-----------|
| **R1** | Checkpointy OK | `aiFromCheckpoints` |
| **R2** | Częściowo | Checkpointy + Fallback A |
| **R3** | Bezużyteczne | Fallback A (prefer) lub B |

**Zapisany werdykt: R1** — źródło AI: `composerHeaders.totalLinesAdded` (filtr workspace). Checkpointy tylko jako fallback (nie sumować wszystkich — skumulowane wrt V0).

---

## 6. Definicje

`addedLines` · `aiLines` (nullable) · `mergedLines` (git numstat `+`) · `ratio = ai / merged`.

---

## 7. Fallback

Checkpointy → A (edycje IDE, „estimated”) → B (tylko git, bez udawania AI).

---

## 8. Pliki i fazy

Jak w EN §8. Fazy: **0 research → 1 core+test → 2 UI → 3 docs**.

---

## 9–12.

Payload, Charts, performance, checklist — jak w pliku angielskim (§9–§12).
