# Faza 3 — HTTP API usage Cursora

**Plan nadrzędny:** [mvp.pl.md](./mvp.pl.md) · kanon EN: [phase-3-cursor-api.md](./phase-3-cursor-api.md)  
**Status:** gotowy do realizacji  
**Zależy od:** [phase-1-parse-format.pl.md](./phase-1-parse-format.pl.md), cookie z [phase-2-session.pl.md](./phase-2-session.pl.md)  
**Następna:** [phase-4-usage-service.pl.md](./phase-4-usage-service.pl.md)  
**PRD:** §8, A1 A2 A5  
**Bezpieczeństwo:** allowlist hosta w [security.md](../context/security.md)

Przy rozjeździe wygrywa **angielski PRD**.

---

## 1. Cel

Klient wyłącznie na `fetch`. Argumenty: `cookie` + `AbortSignal`. Parse z fazy 1. Błędy niezależne: events mogą paść, summary nadal działa.

**Gotowe gdy:** funkcje biorą `cookie` + `signal`; Vitest mockuje `fetch` (bez żywej sieci w CI).

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| Polling / EventEmitter | faza 4 |
| axios | nigdy |
| Hosty inne niż `cursor.com` | nigdy |
| Cookie w webview | nigdy |

---

## 3. Pliki

```
src/usage/api.ts
test/api.test.ts
```

URL-e jako stałe na górze pliku.

---

## 4. Endpointy

| Cel | Metoda | URL | Ciało |
|-----|--------|-----|--------|
| Current | `GET` | `https://cursor.com/api/usage-summary` | tylko nagłówek Cookie |
| Last 100 + Today | `POST` | `https://cursor.com/api/dashboard/get-filtered-usage-events` | JSON `{ page, pageSize, startDate?, endDate? }` |

Bez `Authorization: Bearer`. Timeout 15 s, scalony z `signal` z fazy 4. Allowlist: hostname **`cursor.com`**.

---

## 5. Publiczne API

```typescript
export function fetchUsageSummary(cookie: string, signal: AbortSignal): Promise<FetchSummaryResult>
export function fetchRecentEvents(cookie: string, signal: AbortSignal, options?: { pageSize?: number }): Promise<FetchEventsResult>
```

Wynik: `{ ok: true; raw }` / `{ ok: true; queries }` albo `{ ok: false; message }`.

`pageSize` domyślnie **100**, `page` **1**.

Today (może być tu albo w serwisie):

- POST z `startDate` / `endDate` lokalnego dnia; paginacja, **max 50 stron**
- pusta odpowiedź → fallback bez filtra, filtr dnia po stronie parse
- całkowita porażka events → `ok: false`; faza 4 ustawi `todayUsedUsd: null`, `recentQueries: []`

HTTP 401/403/5xx: generyczny EN (`Could not load usage`, `Sign in to Cursor`). **Bez** body odpowiedzi i **bez** cookie w `message`.

`AbortError`: faza 4 ignoruje przestarzałe aborty.

---

## 6. Kolejność prac

1. Stałe URL + `assertCursorHost`.
2. GET summary → `unknown`.
3. POST events → `mapEventToQuery`, sortowanie newest first.
4. Nigdy nie loguj nagłówków ani body.

Parse puli zostaje w `parse.ts`. `api.ts` zwraca surowy summary.

---

## 7. Izolacja błędów (kontrakt fazy 4)

| Porażka | Current | Today | Last 100 |
|---------|---------|-------|----------|
| Summary | snapshot error | — | — |
| Events, summary OK | ready ze summary | `todayUsedUsd: null` | `[]` |
| Oba OK | ready | policzone | last 100 |

---

## 8. Testy

Mock `fetch`:

- GET: URL, nagłówek `Cookie`, brak `Authorization`
- POST: `page: 1`, `pageSize: 100`
- 401 → `ok: false`, message bez cookie
- zły JSON → `ok: false`
- abort nie wiesza się
- allowlist przed fetch

Bez prawdziwej sieci w CI.

---

## 9. Przekazanie do fazy 4

`refresh()`: sesja → błąd albo `Promise.all` summary + events → `buildUsageReady` → `ready`. API bez `setInterval` i vscode.
