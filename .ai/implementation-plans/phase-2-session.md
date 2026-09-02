# Phase 2 — Session (`state.vscdb`)

**Parent:** [mvp.md](./mvp.md)  
**Status:** ready to implement  
**Depends on:** [phase-0-scaffold.md](./phase-0-scaffold.md) (sql.js + wasm in `dist/`); types from [phase-1-parse-format.md](./phase-1-parse-format.md) optional  
**Next:** [phase-3-cursor-api.md](./phase-3-cursor-api.md)  
**Polish:** [phase-2-session.pl.md](./phase-2-session.pl.md)  
**PRD:** §8 session table, A6  
**Security:** [security.md](../context/security.md)

If this file and [mvp.md](./mvp.md) or the English PRD disagree, **the PRD wins**.

---

## 1. Goal

Resolve Cursor’s local `state.vscdb`, read `cursorAuth/accessToken`, decode JWT `sub` without a JWT library, and build the session cookie. Fail with a user-facing English message when the file or key is missing. Never crash the host.

**Implementation note (after MVP):** Cursor `state.vscdb` can be several GB. Prefer `node:sqlite` `DatabaseSync` with `{ readOnly: true }` on the live file. Use sql.js only when native SQLite is missing **and** the file is under ~1.5 GiB (`readFile` / wasm cannot load >2 GiB).

**Done when:** path helpers are unit-tested with mocked `fs`; live DB is **not** required in CI.

---

## 2. Out of scope

| Item | When |
|------|------|
| `fetch` to cursor.com | phase 3 |
| Status bar `N/A` rendering | phase 5 |
| Manual token in Settings | v2 |
| Logging token / cookie / `sub` | never |

---

## 3. Files

```
src/usage/session.ts
test/session.test.ts
```

Do not add `jsonwebtoken` / `jose`. Use `Buffer` + base64url only.

---

## 4. Public API

```typescript
export type SessionOk = {
  ok: true
  cookie: string
  email: string | null
}

export type SessionErr = {
  ok: false
  error: string
}

export type SessionResult = SessionOk | SessionErr

export function getStateDbPath(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string
export function readCursorSession(options?: {
  dbPath?: string
  locateWasm?: (file: string) => string
}): Promise<SessionResult>
```

Inject `platform` / `env` / `dbPath` so tests never touch the real Cursor DB.

User-facing `error` strings (English, stable for the status-bar tooltip):

- File missing: `Sign in to Cursor`
- Key missing / empty token: `Sign in to Cursor`
- Corrupt JWT (no `sub`): `Sign in to Cursor` (same message; do not explain JWT internals)
- Copy/read failure: `Sign in to Cursor` or a short `Could not read Cursor session` — pick one, no path to the token in the string

Do **not** put the file path, token, or `sub` in `error`.

---

## 5. Work order

### 5.1 DB path (PRD §8)

| OS | Path |
|----|------|
| Windows (`win32`) | `%APPDATA%\Cursor\User\globalStorage\state.vscdb` |
| macOS (`darwin`) | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` |
| Linux | `~/.config/Cursor/User/globalStorage/state.vscdb` |

Use `path.join`. On Windows prefer `env.APPDATA`. On Unix, `env.HOME` (and `USERPROFILE` only as a last resort on win32 if APPDATA is missing).

This is Cursor’s user DB, not VS Code’s.

### 5.2 Copy, then sql.js

1. `fs.access` / `existsSync` — missing file → `SessionErr`.
2. Copy to a temp file **or** `fs.readFile` into a `Buffer` / `Uint8Array`. Never open the live DB with a write lock. Cursor may hold `state.vscdb` on Windows.
3. `initSqlJs({ locateFile })` pointing at `dist/sql-wasm.wasm` (copied in phase 0). In tests, mock `initSqlJs` or skip wasm and test path + JWT helpers in isolation.
4. `new SQL.Database(uint8Array)`.
5. Parameterized query only:

```sql
SELECT value FROM ItemTable WHERE key = ?
```

Bind `cursorAuth/accessToken`. Never concatenate the key into SQL.

6. Close the in-memory DB. Delete the temp copy if you used a temp file (`fs.rm` in `finally`).

Optional email: if a known ItemTable key exists for the Cursor email, read it; otherwise `email: null`. Do not guess keys by dumping the whole table into logs.

### 5.3 JWT `sub` (no library)

Access token is a JWT (`header.payload.sig`).

1. Split on `.` — require three parts.
2. Base64url-decode the payload (replace `-`/`_`, pad `=`).
3. `JSON.parse` → read `sub` as string.
4. Cookie:

```
WorkosCursorSessionToken=${sub}::${accessToken}
```

If payload parse fails or `sub` is missing → `SessionErr`.

Export `decodeJwtSub(token: string): string | null` and test it with a **fake** three-part token (header/payload/sig) whose payload is `{"sub":"user_test"}` — never a real session JWT.

### 5.4 What not to do

- `console.log` / OutputChannel of cookie, token, `sub`, raw SQL value
- Return the raw access token as its own field if the cookie is enough (phase 3 only needs `cookie`). If you keep `accessToken` on `SessionOk` for debugging, **do not**; cookie only.
- Commit copies of `state.vscdb`

---

## 6. Tests (`test/session.test.ts`)

- `getStateDbPath('win32', { APPDATA: 'C:\\Users\\x\\AppData\\Roaming' })` matches PRD
- `darwin` / `linux` home paths
- missing file → `ok: false`, message `Sign in to Cursor`
- `decodeJwtSub` happy path + malformed token → `null`
- parameterized query: mock DB layer if wasm is heavy; otherwise test decode + path only in CI

Mark any test that would open the developer’s real Cursor DB as `describe.skip` or gate on `process.env.CURSOR_SESSION_TEST=1`. Default CI = skip live DB.

---

## 7. Security checklist (this phase)

- [ ] SELECT uses `?` bind
- [ ] File is copied / read into memory, not locked for write
- [ ] No token/`sub`/cookie in tests output or fixtures
- [ ] `error` strings are generic

---

## 8. Handoff to phase 3

Phase 3 `api.ts` accepts `cookie: string` + `AbortSignal`. It must not import sql.js. Session stays the only module that touches `state.vscdb`.
