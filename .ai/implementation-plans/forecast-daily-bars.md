# Monthly forecast bars — accrued vs that day

**English canonical.** Polish: [forecast-daily-bars.pl.md](./forecast-daily-bars.pl.md)
**Parent:** [feedback-2026-10-25.md](./feedback-2026-10-25.md)
**Status:** closed in **1.0.8**. Do not reopen as “draw both”.
**Checked:** 2026-10-25, `media/src/charts/forecast.js`, `media/src/session.js`.

The report (against **1.0.6**, screenshot dated Oct 10): a day of about $0.05 drew a bar near a dollar. The bars never fell, so they duplicated the solid line. Expected shape:

- solid lines = accruals, they never go down
- bars = that day’s spend, any height, including zero

The diagnosis of the **1.0.6 default** was right. The follow-up fix is already in the tree. Drawing both encodings on one axis is the wrong next step.

---

## 1. What the code does now

`mtdBarMode` starts at `'cumulative'` (`media/src/session.js`). The Statistics / Charts forecast has a Cumulative / Daily switch.

| Mode | Bar height | Lines |
|------|------------|-------|
| Cumulative (default) | `series.used` — running total through that day | Solid `used`, dashed `forecast` |
| Daily | `series.day` — that day’s spend | Dashed `forecastDay` only. The solid accrual line is omitted. |

Cumulative mode still draws the bar and the solid line from the same `used` array. A $0.05 day whose month-to-date is about $1 still draws a tall bar **in that mode**. That is the pace view: the bar is green while the running total is inside the plan and red only on the part above the plan (changelog **1.0.5** and **1.0.8**).

Daily mode is the view the report asked for. A day of $0.05 is a short bar. The Y axis rescales to the daily values (`forecast.js` uses `day` / `forecastDay` / `dayAllowanceUsd` when `daily` is true), so the cumulative total does not set the scale.

A day with no positive spend draws no bar (`usedVal > 0` is required). That is a gap, not a zero-height rectangle. Leave it. A gap is readable; a hairline on every empty day is not the bug.

The mode is panel memory. Reloading the panel returns to Cumulative. Do not persist it and do not change the default. The default is the plan-vs-accrual chart the rest of the forecast copy describes.

---

## 2. Why both encodings stay off one axis

A solid accrual line and a daily bar do not share a scale. On Oct 10 the accrual was about a dollar and the day was about five cents. On one axis the daily bar collapses into the baseline and the line is the only thing you can see — the opposite of what the report wanted to read. Two Y axes would make the chart look precise while the eye compares unrelated units.

The switch is the resolution: Cumulative keeps line and bar on the accrual scale; Daily keeps the bar on the day scale and drops the accrual line. The legend already hides the “used” line in Daily (`syncMtdBarModeUi`).

Do not “fix” Daily by stroking `series.used` back onto that plot.

---

## 3. Out of scope

| Item | Why |
|------|-----|
| Another code change for this report | Daily mode shipped in 1.0.8. |
| Defaulting the chart to Daily | Changes the meaning of the forecast card. |
| Persisting Cumulative / Daily | Not asked. Reload resets on purpose with the rest of the in-memory chart toggles. |
| Zero-height bars on empty days | A gap is the empty day. |
| Codex limit chart | Different series. It already splits even-plan green from the part above the plan. |
