# Projected savings

## What changed (Optimize Quick run #5)

- Last red: **Agent volume** (`grok-4.6-high`, 1.1M tokens, 0.93 $, Included In Pro, cache 82%) — merge two Optimize cards into one `<details>`.
- Same habit as run #4: broad grep/read across `media` + `src` + `.ai/context` + rules before editing the three webview files.
- No new alwaysApply rule (`optimize-agent-turns.mdc` already covers tool churn / path-named asks). Tips only.
- Prior mid ~1.35M / ~0.80 $ (run #4) kept cumulative.

## Why THIS last red turn was expensive

- Agent on a **UI-only** ask (join two sections + clarify “similar request” copy) while still scanning PRD, README, CHANGELOG, and rules.
- Explore-first: multi-pattern greps for `Saved so far` / `Projected save` across the whole tree before opening `media/history.html`.
- Extra reads (image asset path, architecture, versioning rule) that did not change the merge.
- Doc/context updates bundled into the same Agent turn instead of a follow-up Ask.
- Cache ~82% — burn is **turn length / tool volume**, not a cold-cache miss.

## Next-message changes

1. Name the files: `media/history.html` + `media/history.css` + `media/history.js` (+ `src/ui/optimizeSavings.ts` only if copy strings live there) — no `.ai/context` / PRD scan.
2. Skip README / CHANGELOG / rules unless the ask says “update docs.”
3. Prefer Ask / cheaper model for copy-only tweaks; Agent only when HTML+CSS+JS (or host strings) must change together.

## Projected savings after adopting these tips

Next similar ~1.1M-class Optimize UI edit with path-named files and no context crawl should cut most of the explore tax on top of prior packaging discipline.

| | Tokens saved | USD saved |
|---|-------------:|----------:|
| Low | ~1.45M | ~0.88 $ |
| Mid | ~1.60M | ~0.97 $ |
| High | ~1.85M | ~1.15 $ |

Mids are **cumulative** vs run #4 (~1.35M / 0.80 $). Incremental mid ~250k / ~0.17 $ at ~0.85 $ / 1M tokens (this spike’s $/token).

## Assumptions

- Otherwise next Agent turn on a small Optimize UI ask still lands near ~1M+ if context greps continue.
- Cache stays high; savings from fewer tools and fewer doc files, not invented transcript.

```cct-savings
project: cursor-cost-tracker
tokens_mid: 1600000
usd_mid: 0.97
tokens_low: 1450000
usd_low: 0.88
tokens_high: 1850000
usd_high: 1.15
run: 5
```
