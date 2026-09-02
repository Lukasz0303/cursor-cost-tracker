# Faza 4 — UsageService

**Plan nadrzędny:** [mvp.pl.md](./mvp.pl.md) · kanon EN: [phase-4-usage-service.md](./phase-4-usage-service.md)  
**Status:** gotowy do realizacji  
**Zależy od:** faz 1–3  
**Następna:** [phase-5-status-bar.pl.md](./phase-5-status-bar.pl.md)  
**PRD:** G1, G5, A5, poll 5 min

Przy rozjeździe wygrywa **angielski PRD**.

---

## 1. Cel

Sesja + API + parse → `UsageSnapshot`. Emit `loading`, potem refresh **bez blokady** `activate()`. Poll z clampem. Jeden request w locie (`AbortController`). Cache ostatniego `ready` (G2: panel &lt; 2 s).

**Gotowe gdy:** testy z fake session/api: loading → ready, abort, interwał z configu.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| StatusBarItem / WebviewPanel | fazy 5–6 |
| Sklejenie `activate()` | faza 7 |
| Ignore keys | v1.1 |
| Cookie w `globalState` | nigdy |

---

## 3. Pliki

```
src/usage/service.ts
test/service.test.ts
```

Do fazy 5 wstrzykuj `pollIntervalMinutes` jako liczbę (domyślnie 5).

---

## 4. Publiczne API

Klasa `UsageService` z wstrzykiwanymi `readSession`, `fetchSummary`, `fetchEvents`, opcjonalnym `now()`.

Metody: `start()`, `refresh()`, `dispose()`, `onDidChange`, `getSnapshot()`, `getCachedQueries()`, `reconfigure({ pollIntervalMinutes })`.

Clamp poll **1–60**. Domyślnie **5**. Nie szybciej niż 1 min (rate limit).

Unikaj twardego importu vscode w unit testach (własny EventEmitter albo mock).

Cookie tylko w zmiennej lokalnej wewnątrz `refresh()`, **nie** na `this`.

---

## 5. Zachowanie

### 5.1 `start()`

Emit `loading` (gdy brak cache). Wywołaj `refresh()` bez await w `activate`. Włącz `setInterval`. `start()` sam nie `await`uje sieci.

### 5.2 `refresh()`

1. Abort poprzedniego kontrolera.
2. Nowy `AbortController`.
3. Sesja `ok: false` → emit error (A6), stop.
4. `Promise.all` summary + events.
5. Summary fail → snapshot error.
6. Summary OK + events fail → `ready` z `todayUsedUsd: null`, `recentQueries: []`.
7. Oba OK → `buildUsageReady` (today, budżet, working days).
8. Cache `ready` w pamięci.

Ignoruj `AbortError` z zastąpionego refresh (bez error dla usera).

### 5.3 Cache

W pamięci — wymagane (G2). Opcjonalnie oczyszczony snapshot w `globalState` (used/limit/today/queries). **Nigdy** cookie / token / `sub`.

### 5.4 `dispose()`

`clearInterval`, abort, dispose emitter.

---

## 6. Testy

| Przypadek | Oczekiwanie |
|-----------|-------------|
| start | najpierw `loading`, potem `ready` |
| błąd sesji | `error`; brak fetch |
| events fail, summary OK | `ready`, today null, queries `[]` |
| drugi `refresh` | pierwszy signal `aborted` |
| `dispose` | brak emisji, timer wyłączony |
| clamp | `0` → 1; `99` → 60 |

`vi.useFakeTimers` dla poll. W asercjach nie wypisuj cookie.

---

## 7. Przekazanie do fazy 5

Pasek subskrybuje `onDidChange` i czyta `getSnapshot()`. Sam nie woła sesji ani API.
