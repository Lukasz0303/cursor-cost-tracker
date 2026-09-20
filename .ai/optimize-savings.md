# Projected savings

## Optimize Deep run #9

Last red: **grok-4.6-high**, **5.0M** tokens (5,030,662 raw), **2.73 $**, Included In Pro, cache **98%** — compacted coding-stats thread that then added an info control, swapped the glyph (`?` pill), and packaged VSIX twice (`1.0.13` / `1.0.14`). Optimize Deep was pasted **into the same spiked chat**.

Prior mid **7.1M / 4.30 $** (run #8, i18n N-catalogs) kept cumulative. This run **adds** the cosmetic-after-Warn-at / no-VSIX-on-glyph cluster.

### Diagnosis (this spike)

| Check | Answer |
|---|---|
| Main driver | **Input context** (long summary + growing webview thread). Cache **98%** → not cold cache. |
| Tool loops | Secondary: CSS/JS reads + two `package` shells. Not the 5M. |
| Model | **grok-4.6-high** for a 12px control — overkill. |
| Retries | Not the story. |
| What the user should type next | **New chat**; goal + `media/history.js` + `media/history.css` only. Package later if they ask. Do **not** paste Optimize here again. |
| Single rule that would have prevented most burn | After `!`, glyph/CSS polish leaves the fat thread; no version bump/VSIX on that turn. |
| Must stay allowed | Named leftover ≤5 paths; dedicated VSIX message; quality of the info dialog itself. |

### Why THIS last red turn was expensive

- Chat was already a **continuation** of Generated Lines / coding-stats UI (formulas, title, dialog). Compaction **re-fed a large summary** into Agent.
- Small asks (“ikona info”, then “ikona jest okropna”) stayed in that thread instead of a 2-file chat.
- Each polish turn still **bumped version + CHANGELOG + `npm run package`**.
- Existing continue-after-warn covered “kontynuj” and HTML tagging, **not** glyph polish + VSIX-on-tweak.
- Cache **98%** → burn was **volume of context**, not misses.

### Rules added this run

- **New** `.cursor/rules/optimize-cosmetic-after-warn.mdc` — after `!`, icon/CSS → new chat, ≤2 media paths, no package unless named.
- **Add** to `optimize-continue-after-warn.mdc` — glyph polish is not a leftover slice; no VSIX on that turn.
- **Add** to `optimize-agent-turns.mdc` — pointer at the cosmetic rule.

Prior i18n split (run #8) and continue-after-warn (no Deep Optimize in the spiked thread) stay; this run does not replace them.

### Next similar turn (glyph / info control after Warn-at)

| | This spike | Disciplined | Tokens saved | USD saved |
|---|---:|---:|---:|---:|
| One polish + package in fat thread | 5.0M / 2.73 $ | ~0.3–0.5M / ~0.20 $ | ~4.6M | ~2.50 $ |

Density this query ≈ **0.54 $ / 1M** (2.73 / 5.03). Incremental mid uses that, not the sample 0.65.

### Projected savings after adopting these rules (cumulative vs run #8)

| | Tokens saved | USD saved |
|---|-------------:|----------:|
| Low | ~10.7M | ~6.10 $ |
| Mid | ~11.7M | ~6.80 $ |
| High | ~13.4M | ~7.85 $ |

What grew: run #8 mid **7.1M / 4.30 $** + this pattern incremental mid **~4.6M / ~2.50 $** → **11.7M / 6.80 $**. High still includes the older i18n-N-catalogs ceiling.

### Per-rule-cluster

| Cluster | Incremental mid | Notes |
|---|---:|---|
| i18n N catalogs after Ask (run #8) | 1.6M / 1.05 $ | already in the 7.1M cumulative |
| Cosmetic + VSIX after Warn-at (this run) | 4.6M / 2.50 $ | 5.0M → ~0.4M in a 2-file chat |
| Continue / no Deep Optimize in spiked thread | overlap | already written; this chat **violated** it by pasting Deep here |

### Monthly (if this rate continues)

Two similar “polish the card in the same `!` thread” spikes per month → about **9M tokens / ~5 $** extra avoided, on top of the i18n cluster. Sample still has **153 / 484** queries ≥ 1M — this rule only cuts the **post-Warn-at cosmetic** subset.

### Assumptions

- Next similar turn is another **webview glyph/CSS** follow-up in a **compacted** coding-stats / Last N thread, not a greenfield feature.
- User actually **opens a new chat** (this Deep paste did not).
- Model for polish is Ask or a cheaper Agent; **grok-4.6-high** is not required to swap a `?`.
- VSIX is a **later** named Shell, not bundled with the CSS edit.
- Density stays near **0.54 $ / 1M** for included Pro on this model class.

### Extension settings (do not auto-change)

- `spikeTokenThreshold` **1M** did its job (`!` at 5.0M).
- `criticalTokenThreshold` **10M** / `criticalCostUsdThreshold` **5 $** did **not** modal — this turn was **5.0M / 2.73 $**. Only lower those if they **want** a blocking dialog at this size.
- Burn Rate Guard is a **window**, not a single Agent turn — leaving it is fine for this pattern.

```cct-savings
project: cursor-cost-tracker
tokens_mid: 11700000
usd_mid: 6.80
tokens_low: 10700000
usd_low: 6.10
tokens_high: 13400000
usd_high: 7.85
run: 9
```
