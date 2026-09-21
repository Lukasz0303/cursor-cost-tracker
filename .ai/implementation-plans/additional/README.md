# Additional / backlog plans

Not scheduled. **Do not implement these instead of the next MINOR.**

Burn Rate Guard shipped as [Burn Rate Guard](../burn-rate-guard.md) (**1.0.4**) · Polish: [burn-rate-guard.pl.md](../burn-rate-guard.pl.md).

**Generated Lines Insight** promoted out of backlog: [generated-lines-insight.md](../generated-lines-insight.md) · [generated-lines-insight.pl.md](../generated-lines-insight.pl.md) (**1.0.4**).

These plans stay as product notes (loop heuristics, daily cap, efficiency score, model advisor, project attribution). If a later MINOR picks one up, re-number it so versions do not collide with what already shipped.

On conflict, [prd.md](../../context/prd.md) wins.

| (was) | Feature | English | Polish |
|-------|---------|---------|--------|
| 1.2 | Runaway Agent Detector (token-similarity loop) | [runaway-agent-detector.md](./runaway-agent-detector.md) | [runaway-agent-detector.pl.md](./runaway-agent-detector.pl.md) |
| 1.3 | Daily Spend Guard | [daily-spend-guard.md](./daily-spend-guard.md) | [daily-spend-guard.pl.md](./daily-spend-guard.pl.md) |
| 1.4 | Cost Efficiency Score | [cost-efficiency-score.md](./cost-efficiency-score.md) | [cost-efficiency-score.pl.md](./cost-efficiency-score.pl.md) |
| 1.5 | Model Cost Advisor | [model-cost-advisor.md](./model-cost-advisor.md) | [model-cost-advisor.pl.md](./model-cost-advisor.pl.md) |
| 1.6 | Project Cost Attribution | [project-cost-attribution.md](./project-cost-attribution.md) | [project-cost-attribution.pl.md](./project-cost-attribution.pl.md) |

Epic overview: [v1.2-overview.md](./v1.2-overview.md) · [v1.2-overview.pl.md](./v1.2-overview.pl.md)

**Burn Rate Guard vs Runaway Agent Detector:** Burn Rate Guard watches **dollars (and tokens) per time window**. The runaway plan watches **repeat / balloon query shapes**. They are complementary; cost-rate ships first. Do not mix both into one PR.
