import {
  optimizeDepthLabel,
  type OptimizeDepth,
} from '../optimizeDepth'
import { formatCompactTokens, formatDollars } from '../format'
import type { OptimizeInsights } from './optimizeInsights'
import {
  CCT_SAVINGS_FENCE,
  OPTIMIZE_SAVINGS_FILE,
  type OptimizeSavings,
} from './optimizeSavings'

function formatHit(value: number | null): string {
  if (value === null) {
    return 'n/a'
  }
  return `${value}%`
}

function lastQueryCompact(insights: OptimizeInsights): string {
  const focus = insights.focus
  if (focus === null) {
    return 'Last red query: none (no sample query ≥ Warn at)'
  }
  return `Last red query: ${focus.model}, ${formatCompactTokens(focus.tokens)} tokens, ${formatDollars(focus.costUsd)}, ${focus.kind}, cache ${formatHit(focus.cacheHitPercent)}`
}

function lastQueryDetailed(insights: OptimizeInsights): string {
  const focus = insights.focus
  if (focus === null) {
    return `## Last red query (Warn at)
none in sample — no query reached the token warning threshold`
  }
  const spikeFinding = insights.findings.find((f) => f.id === 'newest-spike')
  const flag =
    spikeFinding?.detail ??
    'last query at/over Warn at (red !) is the cost focus'
  return `## Last red query (Warn at / red ! — your focus)
- Model: ${focus.model}
- Tokens: ${formatCompactTokens(focus.tokens)} (${focus.tokens.toLocaleString('en-US')} raw)
- Cost: ${formatDollars(focus.costUsd)}
- Kind: ${focus.kind}
- Cache hit: ${formatHit(focus.cacheHitPercent)}
- Flag: ${flag}`
}

function sampleSignals(insights: OptimizeInsights, limit: number): string {
  const findings = insights.findings
    .filter(
      (f) =>
        f.id !== 'newest-spike' &&
        f.id !== 'newest-expensive' &&
        f.id !== 'no-red-query',
    )
    .slice(0, limit)
  if (findings.length === 0) {
    return '- Extra signals: none'
  }
  return findings
    .map((f) => `- ${f.label}: ${f.detail}`)
    .join('\n')
}

function priorProjectionSection(
  priorMarkdown: string | null | undefined,
  prior: OptimizeSavings,
  maxChars: number,
): string {
  if (
    priorMarkdown === null ||
    priorMarkdown === undefined ||
    priorMarkdown.trim() === ''
  ) {
    return `## Prior projection
None yet — first Optimize run. Create \`${OPTIMIZE_SAVINGS_FILE}\` with \`run: 1\`.`
  }

  const priorNums =
    prior.hasProjection &&
    (prior.estTokensSaved !== null || prior.estUsdSaved !== null)
      ? `- Prior mid: ${prior.estTokensSaved === null ? 'n/a tokens' : `~${formatCompactTokens(prior.estTokensSaved)} tokens`} / ${prior.estUsdSaved === null ? 'n/a' : `~${formatDollars(prior.estUsdSaved)}`}
- New mid must be cumulative (>= prior).`
      : '- Prior file exists but mid numbers missing; rewrite a complete block.'

  const clipped =
    priorMarkdown.length > maxChars
      ? `${priorMarkdown.slice(0, maxChars)}\n…(truncated)`
      : priorMarkdown

  return `## Prior projection (cumulative — do not shrink mid)
${priorNums}

\`\`\`markdown
${clipped}
\`\`\``
}

function savingsFenceSpec(projectLabel?: string): string {
  const trimmed = (projectLabel ?? '').trim()
  const projectHint =
    trimmed !== ''
      ? trimmed
      : '<workspace folder name>'
  return `\`\`\`${CCT_SAVINGS_FENCE}
project: ${projectHint}
tokens_mid: <integer tokens saved on the NEXT similar turn>
usd_mid: <dollars saved on the NEXT similar turn>
tokens_low: <optional>
usd_low: <optional>
tokens_high: <optional>
usd_high: <optional>
run: <1-based Optimize run count>
\`\`\``
}

function endReportRequirement(): string {
  return `End with (REQUIRED): mid tokens saved, mid USD saved, and project name — same values as the fence (\`project\`, \`tokens_mid\`, \`usd_mid\`).`
}

function requiredOutputQuick(projectLabel: string): string {
  return `## Required output
1) One short tip or tiny \`.cursor/rules\` line for THIS chat pattern (optional if tips are enough).
2) Write \`${OPTIMIZE_SAVINGS_FILE}\` with a brief note + this fence:

${savingsFenceSpec(projectLabel)}

3) Estimate mid yourself (next similar turn). If a prior file exists, keep mid cumulative and bump \`run\`.
4) ${endReportRequirement()}
5) If file writes are refused, print the same markdown + fence (including project) in chat.`
}

function requiredOutputBalanced(projectLabel: string): string {
  return `## Required output
1) Add a small durable guardrail for THIS last-query pattern (short \`.cursor/rules\` snippet or checklist). ADD rules; do not replace good ones.
2) Write (create/overwrite) \`${OPTIMIZE_SAVINGS_FILE}\` with:
   - What changed for this last-query pattern
   - "Projected savings after adopting these rules" (ranges OK)
   - Assumptions (1–3 bullets) tied to the last-query metadata
   - This machine block (REQUIRED):

${savingsFenceSpec(projectLabel)}

3) You estimate the numbers — never invent a fixed extension heuristic.
4) If prior projection exists: cumulative mids (>= prior), increment \`run\`.
5) ${endReportRequirement()}
6) If file writes are refused, print the same markdown + fence (including project) in chat.`
}

function requiredOutputDeep(projectLabel: string): string {
  return `## Required output (complete — do not skip)
1) From THIS chat only, add durable guardrails so the next similar turn is cheaper
   (prefer \`.cursor/rules\` snippets + a checklist). Each Optimize run ADDS rules —
   do not replace prior good rules unless they conflict. Do NOT rewrite the whole repo.
2) Write (create or overwrite) \`${OPTIMIZE_SAVINGS_FILE}\` including:
   - Human summary of rules added this run
   - "Projected savings after adopting these rules" with low / mid / high for tokens and USD
   - Monthly projection if this chat's rate continues (optional but preferred)
   - Assumptions (3–5 bullets) tied to last-query metadata + this chat
   - Per-rule-cluster savings notes when multiple rules are added
   - This machine block (REQUIRED — exact fence name):

${savingsFenceSpec(projectLabel)}

3) Savings MUST be estimated by YOU after the guardrails. Numbers = NEXT similar
   expensive turn once rules are in place.
4) If \`${OPTIMIZE_SAVINGS_FILE}\` already exists: CUMULATIVE mids (>= prior), bump \`run\`,
   explain what grew.
5) ${endReportRequirement()}
6) If the user refuses file writes, still print the full markdown + \`${CCT_SAVINGS_FENCE}\` (including project) in chat.
Prefer ranges in prose; put mid in the fence.`
}

function intro(depth: OptimizeDepth, projectLabel: string): string {
  const projectLine =
    projectLabel.trim() !== ''
      ? `Project (this workspace): ${projectLabel.trim()}`
      : 'Project (this workspace): unknown — still set `project` in the fence to the repo folder name.'
  return `You are inside the last Composer chat that triggered a red Warn-at spike (!).
The user opened Optimize (${optimizeDepthLabel(depth)}) and pasted this HERE.
Optimize THAT conversation / last red query only — do not audit the whole workspace.
Use this chat's history when you need wording; the extension did not attach a transcript dump.
${projectLine}`
}

function buildQuick(
  insights: OptimizeInsights,
  priorMarkdown: string | null | undefined,
  prior: OptimizeSavings,
  projectLabel: string,
): string {
  const priorHint =
    prior.hasProjection && prior.estTokensSaved !== null
      ? `Prior mid ~${formatCompactTokens(prior.estTokensSaved)} tokens — keep cumulative.`
      : priorMarkdown && priorMarkdown.trim() !== ''
        ? 'Prior savings file exists — keep cumulative.'
        : 'No prior savings file.'

  return `${intro('quick', projectLabel)}

${lastQueryCompact(insights)}
Sample size: ${insights.sampleSize}. ${priorHint}

## Task (Quick) — keep it short
1. 5 bullets: why THIS last red turn was expensive.
2. 3 concrete next-message changes (shorter ask, less tool churn, cheaper model when enough).
3. At most one tiny durable rule.
4. Then ${OPTIMIZE_SAVINGS_FILE} + fence (include project + mid tokens/USD).

${requiredOutputQuick(projectLabel)}

Press Start when ready. Do not invent missing transcript text.`
}

function buildBalanced(
  insights: OptimizeInsights,
  priorMarkdown: string | null | undefined,
  prior: OptimizeSavings,
  projectLabel: string,
): string {
  return `${intro('balanced', projectLabel)}

${lastQueryDetailed(insights)}

## Light context (not a workspace audit)
- Recent sample: ${insights.sampleSize} queries, ${formatCompactTokens(insights.totalTokens)} tokens, ${formatDollars(insights.totalCostUsd)}
- Sample cache hit: ${formatHit(insights.cacheHitPercent)}; spikes in sample: ${insights.spikeCount} (${insights.spikeSharePercent}%)
${sampleSignals(insights, 3)}

${priorProjectionSection(priorMarkdown, prior, 1200)}

## Task (Balanced)
1. Explain the waste pattern of THIS last red turn (metadata + this chat).
2. Short plan for this chat going forward: Agent vs Ask, tool-churn limits, context hygiene.
3. Add or tighten a small \`.cursor/rules\` snippet aimed at THIS pattern (not a full repo rewrite).
4. Optional: 5-item checklist before the next expensive run in this chat.
5. Estimate cumulative token/$ save for the next similar turn and satisfy Required output.

${requiredOutputBalanced(projectLabel)}

Prefer this open chat's real history. Always end with persisted projected savings (tokens, USD, project). User presses Start.`
}

function buildDeep(
  insights: OptimizeInsights,
  priorMarkdown: string | null | undefined,
  prior: OptimizeSavings,
  projectLabel: string,
): string {
  const models =
    insights.topModelsByCost.length === 0
      ? 'none'
      : insights.topModelsByCost
          .map(
            (row) =>
              `${row.model} (${formatDollars(row.costUsd)}, ${row.queries} q, ${formatCompactTokens(row.tokens)})`,
          )
          .join('; ')
  const avg =
    insights.avgCostPer1MTokens === null
      ? 'n/a'
      : `${insights.avgCostPer1MTokens.toFixed(2)} $ / 1M tokens`

  return `${intro('deep', projectLabel)}

${lastQueryDetailed(insights)}

## Comparison context (still NOT a whole-workspace rewrite)
- Recent sample: ${insights.sampleSize} queries
- Sample totals: ${formatCompactTokens(insights.totalTokens)} tokens, ${formatDollars(insights.totalCostUsd)}
- Sample cache hit: ${formatHit(insights.cacheHitPercent)}
- Spikes in sample: ${insights.spikeCount} (${insights.spikeSharePercent}%)
- Top models by cost: ${models}
- Avg cost density: ${avg}
- Addressable / wastey in sample: ${insights.wasteyQueryCount} queries, ${formatCompactTokens(insights.addressableTokens)} tokens
${sampleSignals(insights, 6)}

### Diagnosis checklist (answer each)
- Was the spike mostly input context, tool loops, model choice, or retries?
- What should the user type differently on the next message in THIS chat?
- Which single rule would have prevented most of this burn?
- What must stay allowed so quality does not collapse?

${priorProjectionSection(priorMarkdown, prior, 4000)}

## Task (Deep) — full playbook for THIS last-chat pattern
1. Diagnose THIS spike from metadata + this chat history (structured sections).
2. Draft/update focused rule files for this pattern (Agent vs Ask, tool limits, cache-friendly asks, anti-spike).
3. Include a before/after table for the next similar turn (tokens + $ ranges).
4. Suggest extension settings (e.g. spikeTokenThreshold, critical thresholds) without auto-changing them.
5. Expand "Projected savings" per rule cluster in \`${OPTIMIZE_SAVINGS_FILE}\`.
6. Estimate cumulative token/$ save (must grow vs prior when rules are added).
7. End with a short "what to do on the very next message" block for the user.
8. Do not turn this into a whole-workspace cost audit or unrelated refactors.

${requiredOutputDeep(projectLabel)}

### Quality bar
- Concrete, actionable, tied to the last query numbers above.
- No invented transcript quotes.
- Always persist projected token/$ savings and project name in \`${OPTIMIZE_SAVINGS_FILE}\`.
User will press Start.`
}

export type BuildOptimizePromptOptions = {
  priorMarkdown?: string | null
  priorSavings?: OptimizeSavings
  /** Workspace folder basename for the fence `project:` field. */
  projectLabel?: string
}

export function buildOptimizePrompt(
  insights: OptimizeInsights,
  depth: OptimizeDepth,
  priorMarkdown?: string | null,
  priorSavings?: OptimizeSavings,
  projectLabel?: string,
): string {
  if (insights.sampleSize === 0) {
    return `No usage queries are loaded yet. Ask the user to Refresh Cursor Cost Tracker, then re-run Optimize.`
  }

  if (insights.focus === null) {
    return `No red query in the recent sample (nothing at/over Warn at in Settings).
Ask the user to lower Warn at, wait for a spike, then re-run Optimize.
Do not invent a target query.`
  }

  const prior = priorSavings ?? {
    estTokensSaved: null,
    estUsdSaved: null,
    project: null,
    run: null,
    hasProjection: false,
    note: '',
    summary: '',
  }
  const markdown = priorMarkdown ?? null
  const label = projectLabel?.trim() ?? ''

  if (depth === 'quick') {
    return buildQuick(insights, markdown, prior, label)
  }
  if (depth === 'deep') {
    return buildDeep(insights, markdown, prior, label)
  }
  return buildBalanced(insights, markdown, prior, label)
}

export { OPTIMIZE_SAVINGS_FILE }
