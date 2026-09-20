# Projected savings

## Optimize Deep run #10

Last red: **grok-4.6-high**, **3.6M** tokens (3,641,891 raw), **2.55 $**, Included In Pro, cache **88%** — Generated Lines / coding-stats Agent thread that stacked git-author, VSIX, account picker + catalogs, clone grouping, then polyrepo-in-parent-folder. Optimize Deep was pasted **into the same spiked chat**.

Prior mid **11.7M / 6.80 $** (run #9, cosmetic-after-Warn-at) kept cumulative. This run **adds** the next-feature-after-Warn-at cluster (do not stack another git/coding-stats MINOR in the fat `!` thread).

### Diagnosis (this spike)

| Check | Answer |
|---|---|
| Main driver | **Input context** (long Agent history: author identities, picker, grouping, polyrepo). Cache **88%** → not cold cache. |
| Tool loops | Secondary: reads + several `package` shells the user asked for. Not the 3.6M. |
| Model | **grok-4.6-high** for successive MINOR slices in one thread — overkill once `!` had already fired. |
| Retries | Not the story. |
| What the user should type next | **New chat** for the next git/coding-stats ask (goal + ≤5 paths). Package stays a dedicated Shell if they want VSIX. Do **not** paste Optimize here again. |
| Single rule that would have prevented most burn | After `!`, the next polyrepo / picker / grouping feature leaves this thread. |
| Must stay allowed | Named leftover ≤5 paths; user-named VSIX-only Shell; quality of author filter, clone grouping, and polyrepo when each is its own chat. |

### Why THIS last red turn was expensive

- Chat was already a **continuation** of Generated Lines (team vs personal git author, 6 329 vs 31 294, dirty 5 153, “?” accounts, duplicate `pc-playercenter-monorepo`, then 20-repo `rhino-rage` stack). Compaction **re-fed a large summary** into Agent.
- Each product ask was reasonable **alone**; stacking them after `!` made every turn pay the whole thread.
- Split-minor / continue-after-warn already said new chat for the next feature and **no Deep Optimize in the spiked thread**. This chat **violated** both (picker + N catalogs, then polyrepo, then Deep paste here).
- Cache **88%** → burn was **volume of context**, not misses. Density this query ≈ **0.70 $ / 1M** (2.55 / 3.64).

### Rules added this run

- **New** `.cursor/rules/optimize-next-feature-after-warn.mdc` — after `!`, next coding-stats / git / polyrepo / account-picker slice → new chat, ≤5 paths; verify-with-Ask unless a named defect; no Deep Optimize here.
- **Add** to `optimize-agent-turns.mdc` — pointer at that rule.
- **Add** to `optimize-continue-after-warn.mdc` — next git/coding-stats feature is not a leftover.
- **Add** to `optimize-split-minor-features.mdc` — after `!`, those MINORs are a new chat, not phase 2 of the spike.

Prior cosmetic-after-warn (run #9), i18n split (run #8), and continue-after-warn stay; this run does not replace them.

### Next similar turn (another git/coding-stats slice after Warn-at)

| | This spike | Disciplined | Tokens saved | USD saved |
|---|---:|---:|---:|---:|
| Next MINOR in the fat `!` thread | 3.6M / 2.55 $ | ~0.5–0.8M / ~0.40 $ | ~2.9M | ~2.05 $ |

Incremental mid uses this query’s density (**0.70 $ / 1M**), not the sample 0.65.

### Projected savings after adopting these rules (cumulative vs run #9)

| | Tokens saved | USD saved |
|---|-------------:|----------:|
| Low | ~14.1M | ~8.50 $ |
| Mid | ~14.6M | ~8.85 $ |
| High | ~15.5M | ~9.40 $ |

What grew: run #9 mid **11.7M / 6.80 $** + this pattern incremental mid **~2.9M / ~2.05 $** → **14.6M / 8.85 $**. High still includes older i18n + cosmetic ceilings.

### Per-rule-cluster

| Cluster | Incremental mid | Notes |
|---|---:|---|
| i18n N catalogs after Ask (run #8) | 1.6M / 1.05 $ | already in the 11.7M cumulative |
| Cosmetic + VSIX after Warn-at (run #9) | 4.6M / 2.50 $ | already in the 11.7M cumulative |
| Next coding-stats MINOR after `!` (this run) | 2.9M / 2.05 $ | 3.6M → ~0.7M in a ≤5-path new chat |
| Continue / no Deep Optimize in spiked thread | overlap | already written; this Deep paste **violated** it again |

### Monthly (if this rate continues)

Two similar “one more git/coding-stats feature in the same `!` thread” spikes per month → about **5.8M tokens / ~4.10 $** extra avoided, on top of cosmetic + i18n clusters. Sample has **164 / 521** queries ≥ 1M — this rule only cuts the **post-Warn-at next-MINOR** subset.

### Assumptions

- Next similar turn is another **Generated Lines / git-author / polyrepo / project-split** follow-up in a **compacted** coding-stats Agent thread, not a greenfield MVP.
- User actually **opens a new chat** after `!` (this Deep paste did not).
- User-named **VSIX-only** Shell stays cheap (one `package`) and is **not** bundled with the next feature.
- **grok-4.6-high** is not required to verify “czy dwa klony się skleją” — Ask is enough.
- Density stays near **0.70 $ / 1M** for included Pro on this model class.

### Extension settings (do not auto-change)

- `spikeTokenThreshold` **1M** did its job (`!` at 3.6M).
- `criticalTokenThreshold` **10M** / `criticalCostUsdThreshold` **5 $** did **not** modal — this turn was **3.6M / 2.55 $**. Only lower those if they **want** a blocking dialog at this size.
- Burn Rate Guard is a **window**, not a single Agent turn — leaving it is fine for this pattern.

```cct-savings
project: cursor-cost-tracker
tokens_mid: 14600000
usd_mid: 8.85
tokens_low: 14100000
usd_low: 8.50
tokens_high: 15500000
usd_high: 9.40
run: 10
```
