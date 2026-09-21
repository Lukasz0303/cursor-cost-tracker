# Plan v1.6 — Project Cost Attribution

**Kanon EN:** [project-cost-attribution.md](./project-cost-attribution.md)  
**Plan nadrzędny:** [v1.2-overview.pl.md](./v1.2-overview.pl.md)  
**Status:** gotowy do realizacji  
**Zależność:** preferować 1.5.0 (sekwencyjny MINOR). Niezależna ścieżka danych — nie importuje advisor / efficiency / runaway.  
**Następna:** brak w tym epicu (sync Team później, nie jako 1.7 w tym folderze dopóki nie będzie planu).  
**Wersja:** **1.6.0** (MINOR)

Przy rozjeździe z [prd.md](../../context/prd.md) wygrywa **angielski PRD**.

Cursor `get-filtered-usage-events` **nie ma** project, repo ani branch. Atrybucja to **lokalny stempel**, gdy fingerprint zapytania jest **pierwszy raz widziany** przez host rozszerzenia na tej maszynie.

---

## 1. Cel

Przypisać nowe wiersze usage do bieżącego folderu workspace + gałęzi git (gdy dostępna). Pokazać spend **by project** (i by branch) na Statistics, filtrować Last N bez 7. kolumny tabeli i dodać project/branch do Export CSV.

**Gotowe gdy:**

- Fingerprinty first-seen persystują w `globalState`; historyczne wiersze zostają **Unattributed**.
- Multi-window: host, który **pierwszy** zobaczy zapytanie, wygrywa (współdzielony `globalState`).
- Paski Statistics; chipy filtrów Last N; kolumny CSV; toggle Settings.
- Cap rozmiaru mapy; Vitest dla merge/evict/unattributed; `typecheck` zielone.
- Copy mówi, że to lokalna inferencja, nie metadane billingu Cursor.

---

## 2. Poza zakresem

| Element | Dlaczego |
|---------|----------|
| Backfill sprzed 1.6 | Niemożliwe bez zgadywania |
| Czytanie `.git` poza workspace | Bezpieczeństwo / zakres |
| Sync dashboardu Team / org | Późniejszy produkt |
| 7. kolumna Last N PROJECT | Layout; użyć **filtrów** |
| Blocking modal / tost przy stemplu | Cicho |
| Użycie session cookie do extra API | Niedozwolone |
| „Prawdziwy” zdalny folder Remote SSH | `extensionKind: ui` — stempel to workspace **lokalnego** okna; udokumentować niedokładność |

---

## 3. Delty PRD

Nowy podrozdział **Project cost attribution:**

- Przy każdym udanym snapshotcie usage każdy fingerprint `UsageQuery` nieobecny już w mapie `globalState` `cursorCost.attribution` jest stemplowany:
  - `project`: basename folderu workspace (`vscode.workspace.workspaceFolders[0]`; multi-root: folder zawierający **aktywny edytor**, inaczej pierwszy folder)
  - `branch`: nazwa `HEAD` z Git API gdy `vscode.git` jest obecne; inaczej `null`
  - `repo`: basename URL origin bez `.git` gdy Git API to udostępnia; inaczej `null`
- Brak folderów workspace → **nie stempluj** (zostaw brak → UI **Unattributed**).
- Cap mapy **20_000** wpisów; najpierw evict najstarsze `attributedAt`.
- Statistics: paski by-project (koszt, requesty); opcjonalnie by-branch gdy w próbce ≥ 2 gałęzie.
- Last N: chipy filtrów All / nazwy projektów / Unattributed — **nie** nowa kolumna.
- Export CSV: kolumny `project`, `branch` (puste jeśli nieznane).
- Toggle `cursorCost.projectAttribution` (domyślnie **true**). Gdy off: nie zapisuj nowych stempli; istniejąca mapa zostaje; UI ukrywa filtry/paski (CSV może nadal zawierać zapisane stemple jeśli export ruszy — **preferować pominięcie kolumn gdy toggle off**).
- Disclaimer: `Inferred from the workspace that was open when the query first appeared in this app — not from Cursor’s invoice.`

---

## 4. Pliki

```
src/attribution/fingerprint.ts     # re-export queryFingerprint albo cienki wrapper
src/attribution/store.ts           # merge, cap, lookup (czyste + adapter Memento)
src/attribution/workspaceStamp.ts  # vscode: folder + git (cienkie, testowane przez inject)
src/attribution/aggregate.ts       # by project / branch z queries + mapy
src/config.ts
src/ui/historyRows.ts              # klucz filtra wiersza; payload.attribution
src/ui/historyPanel.ts             # kolumny export CSV; set*
src/ui/periodStats.ts              # byProject / byBranch albo podpięcie na payload
src/extension.ts                   # po snapshocie: stempel, potem odświeżenie panelu
src/usage/service.ts               # opcjonalny hook: on ready, wołaj stamper (trzymać service wolny od vscode jeśli możliwe — preferować listener w extension.ts)
package.json                       # 1.6.0
media/history.html|css|js          # chipy + paski Statistics + Settings
test/attributionStore.test.ts
test/attributionAggregate.test.ts
```

Trzymać `UsageService` wolny od `vscode` (dziś już bierze deps). Stempel w `extension.ts` albo małym `AttributionController` subskrybowanym do `onDidChange`, jak critical alert.

Aktualizacja PRD, architecture, snapshot, webview rule, `shared.mdc` (`src/attribution/`).

---

## 5. Typy i algorytm

```typescript
export const ATTRIBUTION_STATE_KEY = 'cursorCost.attribution'
export const ATTRIBUTION_MAX_ENTRIES = 20_000
export const UNATTRIBUTED_LABEL = 'Unattributed'

export type AttributionStamp = {
  project: string
  branch: string | null
  repo: string | null
  attributedAt: number
}

export type AttributionMap = Record<string, AttributionStamp>

export type AttributionRow = {
  label: string
  costUsd: number
  tokens: number
  requests: number
  percent: number
}

export type AttributionPayload = {
  byProject: AttributionRow[]
  byBranch: AttributionRow[]
  unattributedCount: number
  unattributedCostUsd: number
  note: string
}
```

Fingerprint: **reuse** `queryFingerprint` z `src/spikes/criticalAlert.ts` (`timestamp|tokens|costUsd|model`). Ten sam string dla store i tożsamości CSV.

### 5.1 Stempel (`buildStamp`)

Wstrzyknięte:

```typescript
type StampContext = {
  project: string | null
  branch: string | null
  repo: string | null
  nowMs: number
}
```

Jeśli `project === null` albo `project.trim() === ''` → zwrócić `null` (nie zapisuj).

Inaczej `{ project: trimmed basename, branch, repo, attributedAt: nowMs }`. Sanityzacja: brać tylko `basename` (bez pełnych ścieżek w `globalState` ani webview). Origin: jeśli URL `https://github.com/org/foo.git` → `foo`.

Git: `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)`. Wybrać repozytorium, którego `rootUri` zgadza się z wybranym folderem. `repo.state.HEAD?.name`. Brak rozszerzenia → branch/repo null, nadal stempluj project.

Multi-root: `window.activeTextEditor?.document.uri` → `workspace.getWorkspaceFolder`. Inaczej `workspaceFolders[0]`.

Puste okno (brak folderu): pominąć stempel.

### 5.2 Merge (`mergeAttribution`)

Czyste:

```
mergeAttribution(map, fingerprints: string[], stamp: AttributionStamp | null, max = 20_000)
```

- Jeśli `stamp === null`, zwrócić mapę bez zmian.
- Dla każdego fingerprintu nieobecnego w mapie wstawić `stamp`.
- Jeśli `size > max`, usuwać wpisy z najmniejszym `attributedAt` aż `size <= max`. Nigdy nie evictować w tym samym przebiegu kluczy właśnie wstawionych, jeśli zrzuciłoby to je poniżej max przed starymi — **evict najstarsze najpierw, w tym nowe tylko jeśli wszystko jest nowe** (FIFO po `attributedAt`).

Pierwszy piszący wygrywa: jeśli klucz istnieje, **nie nadpisuj** (inne okno już przypisało).

### 5.3 Lookup

`stampFor(query, map): AttributionStamp | undefined`

Agregacja zapytań próbki:

- etykieta `project` = stamp.project albo `Unattributed`
- etykieta `branch` = stamp.branch albo `Unattributed` (wykres byBranch tylko gdy ≥ 2 różne niepuste nazwy gałęzi **albo** 1 gałąź + unattributed — nadal użyteczne; **pokazać byBranch gdy ≥ 2 różne etykiety** w tym Unattributed)

Sortować paski po `costUsd` malejąco. Reuse kształtu `PeriodBreakdownRow` (`label`, `value` dolary, `share`, `percent`) dla spójności Statistics.

### 5.4 Remote SSH / chmura

Udokumentować: sesja jest lokalnym UI (`extensionKind: ui`). Stempel to ten lokalny folder, który był otwarty. Zapytanie odpalone na remote może być błędnie przypisane do lokalnego projektu. PRD + hint Settings.

---

## 6. Ustawienia i wiadomości

| Klucz | Typ | Domyślnie |
|-------|-----|-----------|
| `cursorCost.projectAttribution` | boolean | `true` |

Fieldset Settings **Project attribution** (po Insights / Advisor). Checkbox + hint o first-seen workspace i historii Unattributed.

| `type` | Akcja |
|--------|--------|
| `setProjectAttribution` | boolean |

Przy **wyłączeniu**: przestać pisać; zostawić mapę (włączenie przywraca paski). Nie czyścić `globalState`, chyba że dodamy później „Clear attribution” — **nie w 1.6**.

Payload:

```typescript
projectAttribution: boolean
attribution: AttributionPayload | null  // null when setting off
```

`HistoryRow` dodaje `project: string` (etykieta do filtra; `Unattributed` gdy brak). **Nie** dodawać widocznej kolumny PROJECT w tabeli HTML.

Opcjonalne chipy toolbara: `All` + unikalne etykiety projektów w bieżącej próbce (cap **12** chipów + `Unattributed` jeśli obecne). Filtr klienta jak Over Warn at / Looping.

---

## 7. Powierzchnie UI

### 7.1 Statistics

Karty **Spend by project** (zawsze gdy toggle on) i **Spend by branch** (gdy ≥ 2 etykiety). Ten sam komponent paska co by-model. Stopka note = disclaimer.

### 7.2 Last N

Tylko chipy filtrów. Bez 7. kolumny. Export CSV (`cursorCost.exportCsv`): gdy toggle on, dopisać `project,branch` (wartości escaped). Gdy toggle off, zostawić poprzedni schemat CSV (bez extra kolumn), żeby diffy zostawały stabilne.

### 7.3 Status bar / Optimize / tost

Bez zmian. Nie stemplować z fence Optimize `project:` (to oszczędności, nie usage).

### 7.4 Charts

Bez wymaganego zmian w 1.6.

---

## 8. Kroki wdrożenia

| Krok | Praca | Pliki |
|------|--------|--------|
| 1 | Bump `1.6.0`. Klucz `projectAttribution`. | `package.json` |
| 2 | Boolean config. | `config.ts` |
| 3 | Czyste testy merge / evict / aggregate. | `store.ts`, `aggregate.ts` + testy |
| 4 | `workspaceStamp` z wstrzykniętym git/folder (unit-test basename + parse origin bez vscode). | `workspaceStamp.ts` + testy basename URL |
| 5 | `AttributionController`: on snapshot ready, merge, `globalState.update`. | `src/ui/attributionController.ts` albo `src/attribution/controller.ts`, `extension.ts` |
| 6 | Etykiety payload + paski Statistics. | `historyRows.ts`, `periodStats.ts` |
| 7 | Chipy Last N + kolumny CSV. | `media/history.js`, `historyPanel.ts` (builder exportu) |
| 8 | Fieldset Settings. | `media/history.*` |
| 9 | PRD (w tym caveat Remote SSH), architecture, snapshot, webview + shared rules. | `.ai/context/*`, `.cursor/rules/*` |

Nie dodawać sync Team, UI backfill ani kolumny PROJECT.

Znaleźć bieżący builder CSV (history panel / command) i rozszerzyć w tym samym PR — grep `exportCsv` / `text/csv`.

---

## 9. Testy

- Merge: istniejący klucz nie nadpisany, gdy drugi stempel się różni.
- Nowe klucze wstawione; brakujący stempel (`null`) zostawia mapę bez zmian.
- Evict: 20_001. najstarsze `attributedAt` usunięte; najnowsze zostaje.
- Agregacja: dwa projekty dzielą koszt; nieznany fingerprint → liczba/koszt Unattributed.
- Parse origin: `git@github.com:Org/Foo.git` i `https://github.com/Org/Foo.git` → `Foo`.
- Basename: `/Users/a/work/my-app` → `my-app` (wstrzyknąć helper ścieżki; nie tykać dysku).
- Payload: `HistoryRow.project` to `Unattributed` bez wpisu w mapie.
- Toggle off → `attribution` null w helperze payload.

Mock `Memento` jak testy IgnoreStore (gdy istnieją) albo mapa in-memory.

---

## 10. Bezpieczeństwo

- Przechowywać **tylko basename**, nigdy absolutnych ścieżek, remote z tokenami ani emaili.
- Webview dostaje etykiety już używane jako nazwy projektów (jak fence Optimize `project`).
- Nie logować pełnej mapy atrybucji.
- Git API read-only; bez `git` child_process jeśli brak `vscode.git` (pominąć branch zamiast spawn).

---

## 11. Kryteria gotowości

- [ ] Wersja **1.6.0**
- [ ] Stempel first-seen; bez overwrite; Unattributed dla historii
- [ ] Cap 20k; basename + opcjonalnie branch/repo
- [ ] Statistics by-project (i by-branch gdy użyteczne)
- [ ] Last N **filtry**, nie 7. kolumna; CSV gdy włączone
- [ ] Disclaimer + nota Remote SSH w PRD
- [ ] `npm test` + `typecheck`
- [ ] Bez sync Team, backfill, extra modala
