# Faza 2 — Sesja (`state.vscdb`)

**Plan nadrzędny:** [mvp.pl.md](./mvp.pl.md) · kanon EN: [phase-2-session.md](./phase-2-session.md)  
**Status:** gotowy do realizacji  
**Zależy od:** [phase-0-scaffold.pl.md](./phase-0-scaffold.pl.md) (sql.js + wasm w `dist/`)  
**Następna:** [phase-3-cursor-api.pl.md](./phase-3-cursor-api.pl.md)  
**PRD:** §8, A6  
**Bezpieczeństwo:** [security.md](../context/security.md)

Przy rozjeździe wygrywa **angielski PRD**.

---

## 1. Cel

Znajdź lokalny `state.vscdb` Cursora, odczytaj `cursorAuth/accessToken`, zdekoduj JWT `sub` bez biblioteki JWT, zbuduj cookie sesji. Brak pliku/klucza → komunikat EN dla użytkownika. Host się nie wywala.

**Uwaga (po MVP):** `state.vscdb` może mieć kilka GB. Preferuj `node:sqlite` tylko do odczytu. sql.js tylko gdy brak natywnego SQLite **i** plik ma poniżej ~1.5 GiB.

**Gotowe gdy:** helpery ścieżek przetestowane z mockiem `fs`; żywa DB **nie** jest wymagana w CI.

---

## 2. Poza zakresem

| Element | Kiedy |
|---------|--------|
| `fetch` na cursor.com | faza 3 |
| Render `N/A` na pasku | faza 5 |
| Ręczny token w Settings | v2 |
| Logowanie tokenu / cookie / `sub` | nigdy |

---

## 3. Pliki

```
src/usage/session.ts
test/session.test.ts
```

Bez `jsonwebtoken` / `jose`. Tylko `Buffer` + base64url.

---

## 4. Publiczne API

```typescript
export type SessionOk = { ok: true; cookie: string; email: string | null }
export type SessionErr = { ok: false; error: string }
export type SessionResult = SessionOk | SessionErr

export function getStateDbPath(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string
export function readCursorSession(options?: {
  dbPath?: string
  locateWasm?: (file: string) => string
}): Promise<SessionResult>
```

Wstrzykuj `platform` / `env` / `dbPath` — testy nie dotykają prawdziwej bazy Cursora.

Komunikaty `error` (angielski, stabilne pod tooltip):

- brak pliku / brak klucza / pusty token / zły JWT: `Sign in to Cursor`
- błąd kopii: ten sam albo krótkie `Could not read Cursor session`

**Nie** wstawiaj ścieżki, tokenu ani `sub` do `error`.

Na `SessionOk` **tylko** `cookie` (+ opcjonalny email). **Nie** zwracaj surowego `accessToken` osobnym polem.

---

## 5. Kolejność prac

### 5.1 Ścieżka DB (PRD §8)

| OS | Ścieżka |
|----|---------|
| Windows (`win32`) | `%APPDATA%\Cursor\User\globalStorage\state.vscdb` |
| macOS (`darwin`) | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` |
| Linux | `~/.config/Cursor/User/globalStorage/state.vscdb` |

To baza **Cursora**, nie VS Code.

### 5.2 Kopia, potem sql.js

1. Brak pliku → `SessionErr`.
2. Kopia do temp **albo** `readFile` do `Buffer`. Nigdy exclusive write na żywej DB (Windows może trzymać lock).
3. `initSqlJs({ locateFile })` → `dist/sql-wasm.wasm`.
4. `SELECT value FROM ItemTable WHERE key = ?` z bind `cursorAuth/accessToken`. Nigdy konkatenacja SQL.
5. Zamknij DB; usuń temp w `finally`.

Opcjonalny email z znanego klucza ItemTable; inaczej `null`. Nie dumpuj całej tabeli do logów.

### 5.3 JWT `sub` (bez biblioteki)

1. Split po `.` — trzy części.
2. Base64url payload.
3. `JSON.parse` → `sub`.
4. Cookie: `WorkosCursorSessionToken=${sub}::${accessToken}`

Eksportuj `decodeJwtSub(token): string | null`. Testuj **fałszywym** JWT (`{"sub":"user_test"}`) — nigdy prawdziwym.

### 5.4 Zakazy

- `console.log` / OutputChannel cookie, tokenu, `sub`, wartości SQL
- commit kopii `state.vscdb`

---

## 6. Testy

- ścieżki win32 / darwin / linux
- brak pliku → `Sign in to Cursor`
- `decodeJwtSub` OK i malformed → `null`
- żywa DB: `describe.skip` albo `CURSOR_SESSION_TEST=1`; CI = skip

---

## 7. Checklist bezpieczeństwa

- [ ] SELECT z `?`
- [ ] kopia / odczyt do pamięci
- [ ] brak tokenu w output testów
- [ ] generyczne `error`

---

## 8. Przekazanie do fazy 3

`api.ts` bierze `cookie: string` + `AbortSignal`. Nie importuje sql.js. Tylko sesja tyka `state.vscdb`.
