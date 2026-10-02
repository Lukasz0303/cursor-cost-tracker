# Billing-cycle forecast alignment

**English canonical.**  
**Upstream:** [Lukasz0303/cursor-cost-tracker#8](https://github.com/Lukasz0303/cursor-cost-tracker/issues/8)  
**Depends on:** Monthly cost forecast (`src/ui/mtdPace.ts`) + `billingCycleStart` / `billingCycleEnd` on `UsageReady`.  
**Hardened from grill (2026-10):** decisions below are binding; do not reopen without a new grill.

If this file and [prd.md](../context/prd.md) disagree, **update the PRD in the docs phase** so they match.

---

## 1. Goal

Forecast burn-up (meters + chart) can follow the user’s **Cursor billing cycle**, not only the local calendar month. Mid-cycle renewals show a **reset marker** and a **drop-to-zero** on used + forecast. Default behavior stays today’s calendar-month view.

**Done when:**

- Setting `cursorCost.forecastWindow` works (`calendarMonth` default | `billingCycle`).
- Billing Cycle option is available only for a **monthly** cycle; otherwise hidden and math falls back to calendar month.
- Calendar month with a mid-month renewal: used + forecast drop; meters use pre/post-reset branches; renewal day has marker + optional diagonal hash.
- Status bar / Today daily budget **unchanged** (still calendar-month `applyBudgetDayBasis`).
- Vitest covers window helpers + `toMtdPace` branches; Phase 2 wires Settings + chart chrome.
- No new `/api/usage` call.

---

## 2. Out of scope

| Item | Why |
|------|-----|
| `GET /api/usage` / `startOfMonth` from that endpoint | Live `usage-summary` already has timed `billingCycleStart` / `End` (e.g. `…T13:51:29.000Z`) |
| Mid-day **value split** on the renewal bar | One bar, one value; hash is chrome only |
| Status bar / Today daily budget on cycle days | Explicitly left calendar-month |
| Yearly (or non-monthly) billing axis | Hide Billing Cycle; calendar fallback |
| Changing period cards “This month” / Last N sample policy | Same Last N limits as today |
| Polish plan twin / full locale catalogs in Phase 1–2 | `en` + `pl` in wire turn; other catalogs later |
| VSIX / version bump | Separate short turn |

---

## 3. Decisions (grilled)

### Data

- **Source:** `UsageReady.billingCycleStart` / `billingCycleEnd` from existing `usage-summary` parse only.
- **Interval:** half-open by instant **`[start, end)`**. Portal “Sep 26 → Oct 26” means renews at the End instant; End’s local calendar day is the **first day of the next cycle** for chart bucketing under the simple day rule below.
- **Spend membership:** every query goes to the period that contains its `timestamp` under `[start, end)`. No reassignment hacks.

### Setting

- **`cursorCost.forecastWindow`:** `calendarMonth` (default) | `billingCycle`.
- **UI:** Settings → **Monthly budget** fieldset, next to Pace by.
- **Monthly gate:** both ISOs present, `end > start`, and duration in **\[26, 35\]** days (ms → days). Otherwise **hide** Billing Cycle option and coerce effective window to `calendarMonth` (even if the stored setting is `billingCycle`).
- Missing / inverted range: same hide + fallback.

### Scope of the toggle

| Surface | Follows `forecastWindow`? |
|---------|---------------------------|
| MTD meters, run-out, forecast series, chart axis | **Yes** |
| Status bar, Today daily budget (`applyBudgetDayBasis`) | **No** |

### Calendar Month + mid-month renewal

- Axis: local **1st → last** of `now`’s month (unchanged).
- If renewal instant’s **local date** falls inside that month: vertical **reset marker**; **used and forecast** drop to zero at that day and climb again (two segments).
- **Meters (branch C):**
  - Before renewal local day: pre-reset branch — **used = full active-cycle residue** (includes days before the 1st, e.g. Sep 26–30 when viewing October); pace days = cycle-active days in that pre-reset branch (not “Oct 1…reset” alone).
  - On/after renewal local day: post-reset branch — used / pace from renewal day through month-end (new cycle).
- **Renewal local day chart:** whole day treated as **first day of the new cycle** for the post-drop series (simple rule). **One bar, one value** — no mid-day value split.
- **Hash:** if renewal instant is **not** local midnight, diagonal hash on that day’s bar (slightly different tone). Marker always when renewal is in-window.
- If renewal is outside the calendar month (e.g. cycle 1st→1st): no marker, no drop (today’s shape).

### Billing Cycle mode

- Axis: local calendar days that intersect **`[start, end)`** (roughly one month when the monthly gate passes).
- **No** mid-window drop; single continuous used/forecast. Optional end-of-window marker at renewal is fine; not required for MVP of this feature.
- Meters / pace / run-out use this window consistently with the chart.

### Pro included-% series

- Same window and drop rules as USD Spend; post-reset series starts from post-reset activity; meters follow branch C. (API % remains cycle-scoped; day weights stay cost-weighted as today where applicable.)

---

## 4. Phases (separate Agent turns)

### Phase 1 — core + Vitest

| Step | Work | Files |
|------|------|--------|
| 1 | `ForecastWindow` type, parse, default `calendarMonth` | `src/forecastWindow.ts` (or next to `budgetDayBasis.ts`) |
| 2 | Helpers: parse cycle instants; `isMonthlyBillingCycle` (26–35d); effective window; half-open membership; renewal local day; `hasUsableBillingCycle` | same module + Vitest |
| 3 | Generalize month frames → window frames; calendar + billing builders; residue used; series drop at renewal; payload fields for marker / hash (`resetDate`, `resetMidday` or equivalent) | `src/ui/mtdPace.ts` |
| 4 | Wire options from snapshot cycle dates + `forecastWindow` into `toMtdPace` | `mtdPace.ts`, call sites in tests |
| 5 | Do **not** change `applyBudgetDayBasis` / status bar | — |

**Tests (Phase 1):** monthly gate boundaries (25/26/35/36d); missing end; half-open membership; calendar drop + residue; billing axis length; meter branch pre vs post; midnight vs midday → hash flag.

### Phase 2 — host + webview + en/pl

| Step | Work | Files |
|------|------|--------|
| 1 | `package.json` contributes + `config.ts` | |
| 2 | Payload + `setForecastWindow` message | `historyRows.ts`, `historyPanel.ts`, `config.ts` |
| 3 | Settings select under Monthly budget; hide Billing Cycle when `!hasUsableBillingCycle` | `media/history.html` / `history.js` |
| 4 | Chart: vertical reset marker; diagonal hash fill when flagged; keep Today/7d/Month range as viewport | `media/history.js`, `history.css` |
| 5 | Copy keys `en` + `pl` only | `src/i18n/catalogs/en.ts`, `pl.ts` (+ json if required by tooling) |

### Phase 3 — docs (Ask or short Agent)

- PRD + [architecture](../context/architecture.md) / snapshot + [README](./README.md) index row.
- CHANGELOG / version only when packaging.

---

## 5. Payload / API sketch

Extend `MtdPacePayload` (names flexible, keep small):

```ts
forecastWindow: 'calendarMonth' | 'billingCycle' // effective
billingCycleAvailable: boolean
resetDate: string | null       // local day label matching forecast points, or ISO date key
resetMidday: boolean           // hash chrome
```

Host → webview config already patterns: add `forecastWindow` alongside `budgetDayBasis`.  
Webview → host: `{ type: 'setForecastWindow', value }`.

---

## 6. Implications to accept

- Pre-reset October series can open **above** pure October $ (Sep residue). Forecast meters may disagree with status-bar Today — intentional.
- Last N / From-date may undercount residue if early-cycle events fell out of the sample (same class of limit as today’s MTD).

---

## 7. PRD deltas (docs phase)

- Document `cursorCost.forecastWindow` and monthly gate.
- Monthly cost forecast window: calendar month **or** active billing cycle `[start, end)`.
- Reset marker + drop on calendar view when renewal falls in-month.
- G5 / Optimize / burn-rate unchanged.
