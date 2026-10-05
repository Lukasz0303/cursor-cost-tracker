# Datetime consistency + media frontend split

**English canonical.** Polish: [datetime-media-foundation.pl.md](./datetime-media-foundation.pl.md)
**Status:** implemented (phases 0–6 landed in tree; zoom/expand on Charts; webview sources in `media/src/`).
**Depends on:** existing `historyFromDate`, `formatDateTime`, webview `limits` esbuild path.
**Version:** foundation work (PATCH / internal); chart zoom may ship as a later MINOR slice.

If this file and [prd.md](../context/prd.md) disagree, **the PRD wins**.

---

## 1. Goal

Address contributor feedback:

1. **One local-calendar-day policy** across Today, From–To, Charts, Coding stats, and Optimize prompts (no silent UTC vs local mix).
2. **Split `media/` sources** so small UI work does not require loading a 7k+ line IIFE (agent token cost and contributor velocity).
3. **Cheap HistoryPanel paint** on theme changes (no session DB / titles / savings credit).
4. **Chart click-expand + zoom** only after Charts live in their own modules.

**Done when:**

- All day keys are `YYYY-MM-DD` (1-based month, padded) from `src/time/`.
- Optimize timestamps match the Last N TIME column (local + zone label).
- CI runs day-boundary tests under `TZ=UTC`, `America/Los_Angeles`, `Europe/Warsaw`, `Asia/Tokyo`.
- Webview sources live under `media/src/`; `media/history.js` is the esbuild output.
- Chart expand/zoom works from the Charts modules without touching Settings/Optimize.

---

## 2. Out of scope

| Item | Why |
|------|-----|
| Full audit cleanup (clamps→config, git SKIP_DIR, settingsStore tests) | Separate slices |
| Rewrite webview in TypeScript / React | Too expensive; keep vanilla JS modules |
| CSS full split in the first media pass | Optional follow-up |
| New usage API / server grouping | Not needed for day expand |

---

## 3. Phases

| Phase | Deliverable |
|-------|-------------|
| 0 | This plan + README index |
| 1 | `src/time/*`, migrate call sites, Optimize local+zone, CI TZ |
| 2 | `HistoryPanel` cheap color paint |
| 3 | `media/src` → esbuild → `history.js`; extract Charts |
| 3b | Extract leaderboard + settings modules |
| 5 | Chart expand + zoom (Last 7 / Month / Sample) |
| 6 | PRD timezone policy, contributor note, CHANGELOG |

Agent turns stay narrow: one phase per message when Warn-at has fired; otherwise follow the table order.

---

## 4. Time API (`src/time/`)

Canonical exports:

- `isoDateFromLocal`, `localDayKey(ms)`, `localMonthKey(ms)`
- `startOfLocalDayMs`, `endOfLocalDayMs` (inclusive end of day)
- `sameLocalDay`, `localDayBoundsMs(now)` → `{ startMs, endMs, startDate, endDate }` (date fields as ms strings for the API)
- `formatDateTimeWithZone(ms)` for Optimize briefs

Facades keep working: `historyFromDate.ts`, `format.ts`, `gitMerged.localDayKey`, `leaderboard/dates`, `forecastWindow.localDayKey` re-export or delegate.

---

## 5. Media bundle

- Entry: `media/src/main.js`
- Output: `media/history.js` (committed, banner “Generated… Do not edit”)
- Extract order: Charts → Leaderboard → Settings
- Edit `media/src/**` only; rebuild via existing esbuild / `npm run compile`

---

## 6. Chart zoom / expand (phase 5)

1. Click bar → detail strip (date, counts, tokens, cost, running total).
2. Expand → client filter of sample `events` for that local day.
3. Zoom buttons: Last 7 / Month / Sample on the already-loaded series (no new API).

## 7. Contributor reply (draft)

> Thanks for the timezone and `media/` notes. We now use one local-calendar-day layer (`src/time/`) everywhere (including Optimize briefs with a local zone label), CI runs day-boundary tests in several `TZ`s, and the webview is built from `media/src/` so chart work does not require loading the whole panel. Charts also got click-to-expand for a day plus Sample / Last 7 / Month zoom on the loaded series.
