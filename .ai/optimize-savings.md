# Projected savings

## Optimize Deep run #12

Last red: **grok-4.7-high**, **2.0M** tokens (2,018,593 raw), **1.06 $**, Included In Pro, cache **99%** — this landing-page chat. Competitor research and a full `site/` landed first; “wygląda słabo” stayed here (PNG reads, headless shots, CSS rewrite); then `site/preview.sh` was restarted after aborted shells. Optimize Deep was pasted **into this spiked chat**.

Prior mid **18.3M / 11.48 $** (run #11, plan-then-build) kept cumulative. This run **adds** the site-preview cluster.

### Diagnosis (this spike)

| Check | Answer |
|---|---|
| Main driver | **Input context**. Cache **99%** → about **20k** tokens were new; the other ~2.0M was this thread replayed (research, HTML, then screenshot reads). Not cold cache. |
| Tool loops | Secondary but they **built** the context: competitor fetches, Read on `screenshots/*.png`, headless Chrome shots read back as images, then kill/rebind of port 4173. |
| Model | **grok-4.7-high** for “make it look professional” and for “the preview died” — a short follow-up on a fat thread. |
| Retries | The preview server was started, killed, and started again. That is a restart loop, not a failed model retry. |
| What the user should type next | **Nothing in this chat.** To see the page: `sh site/preview.sh` in a terminal. A visual pass is a **new chat** with `site/index.html` + `site/styles.css` only. Do **not** paste Optimize here again. |
| Single rule that would have prevented most burn | Once `site/` exists, do not Read PNGs and do not restart the preview inside this thread. |
| Must stay allowed | The first turn that creates `site/` when that folder is named; the user running `site/preview.sh` themselves; a later chat limited to those two files. |

### Why THIS last red turn was expensive

- The thread already held the competitor page, Open VSX facts, and the full landing HTML/CSS.
- “Wygląda słabo” was answered **here**, including image reads. Those pixels stayed in context for every later turn.
- Short follow-ups (“odpal”, “server aborted”) still billed ~**2.0M** tokens because cache hit was **99%**. Density this query ≈ **0.53 $ / 1M** (1.06 / 2.019).
- Deep Optimize pasted into the spiked chat repeats the run #11 violation.

### Rules added this run

- **New** `.cursor/rules/optimize-site-preview.mdc` — after `site/` exists: visual pass is a new chat, ≤2 files, no PNG reads; one preview command, no restart loop; no Deep Optimize here.
- **Add** to `optimize-agent-turns.mdc`, `optimize-cosmetic-after-warn.mdc`, and `optimize-continue-after-warn.mdc` — pointers only.

Run #11 (plan then build-all), run #10 (next feature after `!`), run #9 (cosmetic), and run #8 (i18n catalogs) stay. This run does not replace them.

### Next similar turn (page exists, then “looks bad” or the preview died)

| | This spike | Disciplined | Tokens saved | USD saved |
|---|---:|---:|---:|---:|
| New chat, two `site/` files, no PNGs, no server loop | 2.0M / 1.06 $ | ~0.35M / ~0.18 $ | ~1.7M | ~0.89 $ |

Incremental mid uses this query’s density (**0.53 $ / 1M**), not the sample 0.65. The disciplined ~0.35M is the visual pass in a fresh chat. A dead preview with **no** Agent turn saves the whole ~2.0M; that is the high case, not the mid.

### Projected savings after adopting these rules (cumulative vs run #11)

| | Tokens saved | USD saved |
|---|-------------:|----------:|
| Low | ~18.8M | ~11.59 $ |
| Mid | ~20.0M | ~12.37 $ |
| High | ~21.5M | ~13.29 $ |

What grew: run #11 mid **18.3M / 11.48 $** + this pattern incremental mid **~1.7M / ~0.89 $** → **20.0M / 12.37 $**.

### Per-rule-cluster

| Cluster | Incremental mid | Notes |
|---|---:|---|
| i18n N catalogs after Ask (run #8) | 1.6M / 1.05 $ | already in the 18.3M cumulative |
| Cosmetic + VSIX after Warn-at (run #9) | 4.6M / 2.50 $ | already in the 18.3M cumulative |
| Next coding-stats MINOR after `!` (run #10) | 2.9M / 2.05 $ | already in the 18.3M cumulative |
| Plan then build-all + every locale (run #11) | 3.7M / 2.63 $ | already in the 18.3M cumulative |
| Site “looks bad” + preview restarts (this run) | 1.7M / 0.89 $ | 2.0M → ~0.35M, no PNG reads |
| Continue / no Deep Optimize in spiked thread | overlap | this Deep paste **violated** it again |

### Monthly (if this rate continues)

Two similar follow-ups a month (visual pass or preview restart inside a fat `site/` thread) → about **3.4M tokens / ~1.78 $** avoided, on top of the earlier clusters. Sample has **178 / 593** queries ≥ 1M — this rule only cuts the **landing-page follow-up** subset.

### Assumptions

- Next similar turn is another **“the page looks bad” or “the preview died”** after `site/` was already built in-thread, not the first creation of the page.
- The user opens a **new chat** for CSS/HTML and does not paste Deep Optimize into the spiked thread.
- The agent does **not** Read `screenshots/*.png` or headless captures; the user looks in the browser.
- A dead preview is fixed by the user running `sh site/preview.sh`, so it is not inside the 0.35M disciplined turn.
- Density stays near **0.53 $ / 1M** when a follow-up replays a cached thread on this model. A fresh chat costs more per token and far fewer tokens.

### Extension settings (do not auto-change)

- `spikeTokenThreshold` **1M** did its job (`!` at 2.0M).
- `criticalTokenThreshold` **10M** / `criticalCostUsdThreshold` **5 $** did **not** modal — this turn was **2.0M / 1.06 $**. Leave them. A cached replay is not a reason to lower the blocking dialog.
- Burn Rate Guard watches a **time window**, not one Agent turn. Leave it for this pattern.

### What to do on the very next message

Stop this chat. In a terminal: `sh site/preview.sh`. If the layout still needs work, new Composer chat, one sentence, two paths: `site/index.html` and `site/styles.css`. Do not paste Optimize Deep here.

```cct-savings
project: cursor-cost-tracker
tokens_mid: 20000000
usd_mid: 12.37
tokens_low: 18800000
usd_low: 11.59
tokens_high: 21500000
usd_high: 13.29
run: 12
```
