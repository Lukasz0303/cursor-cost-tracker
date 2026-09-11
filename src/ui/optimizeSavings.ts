import { formatCompactTokens, formatDollars } from '../format'

export const OPTIMIZE_SAVINGS_FILE = '.ai/optimize-savings.md'

/** Machine block the Optimize prompt requires inside the savings file. */
export const CCT_SAVINGS_FENCE = 'cct-savings'

export type OptimizeSavings = {
  /** Mid projected tokens saved per similar request; 0 until the agent writes the file. */
  estTokensSaved: number | null
  /** Mid projected USD saved per similar request; 0 until the agent writes the file. */
  estUsdSaved: number | null
  /** Project label from the fence (`project:`), when present. */
  project: string | null
  /** Optimize run count from the fence, when present. */
  run: number | null
  /** True when `.ai/optimize-savings.md` had a parseable cct-savings block. */
  hasProjection: boolean
  note: string
  summary: string
}

const EMPTY_NOTE =
  'Projected cost saved on a similar request. Stays 0 / 0.00 $ until you Run Optimize and press Start.'

function zeroSavingsSummary(): string {
  return `Projected save per similar request: ${formatCompactTokens(0)} / ${formatDollars(0)}`
}

/**
 * Parse projected savings from `.ai/optimize-savings.md`.
 * Prefers a fenced `cct-savings` block; otherwise returns empty (no heuristic).
 */
export function parseOptimizeSavingsMarkdown(
  markdown: string | null | undefined,
): OptimizeSavings {
  if (markdown === null || markdown === undefined || markdown.trim() === '') {
    return emptySavings()
  }

  const block = extractCctSavingsBlock(markdown)
  if (block === null) {
    return {
      ...emptySavings(),
      note: `Found ${OPTIMIZE_SAVINGS_FILE}, but no ${CCT_SAVINGS_FENCE} block yet. Re-run Optimize and press Start.`,
    }
  }

  const tokensMid = readNumber(block, 'tokens_mid')
  const usdMid = readNumber(block, 'usd_mid')
  if (tokensMid === null && usdMid === null) {
    return {
      ...emptySavings(),
      note: `${OPTIMIZE_SAVINGS_FILE} is missing tokens_mid / usd_mid. Re-run Optimize.`,
    }
  }

  const tokens =
    tokensMid !== null && Number.isFinite(tokensMid)
      ? Math.max(0, Math.round(tokensMid))
      : null
  const usd =
    usdMid !== null && Number.isFinite(usdMid)
      ? Math.round(Math.max(0, usdMid) * 100) / 100
      : null
  const runRaw = readNumber(block, 'run')
  const run =
    runRaw !== null && runRaw >= 1 ? Math.round(runRaw) : null
  const project = readString(block, 'project')
  const runLabel =
    run !== null ? ` (optimize run #${run})` : ''

  const summaryParts: string[] = []
  if (tokens !== null) {
    summaryParts.push(`~${formatCompactTokens(tokens)}`)
  }
  if (usd !== null) {
    summaryParts.push(`~${formatDollars(usd)}`)
  }

  return {
    estTokensSaved: tokens,
    estUsdSaved: usd,
    project,
    run,
    hasProjection: true,
    note: `Projected cost saved on a similar request. From ${OPTIMIZE_SAVINGS_FILE} after you ran Optimize${runLabel}. Grows as rules accumulate.`,
    summary: `Projected save per similar request: ${summaryParts.join(' · ')}`,
  }
}

/** Before `.ai/optimize-savings.md` exists — show 0 / 0.00 $, not a dash. */
export function emptySavings(): OptimizeSavings {
  return {
    estTokensSaved: 0,
    estUsdSaved: 0,
    project: null,
    run: null,
    hasProjection: false,
    note: EMPTY_NOTE,
    summary: zeroSavingsSummary(),
  }
}

function extractCctSavingsBlock(markdown: string): string | null {
  const re = /```cct-savings\s*([\s\S]*?)```/i
  const match = re.exec(markdown)
  if (match === null || match[1] === undefined) {
    return null
  }
  return match[1]
}

function readNumber(block: string, key: string): number | null {
  const re = new RegExp(`(?:^|\\n)\\s*${key}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i')
  const match = re.exec(block)
  if (match === null || match[1] === undefined) {
    return null
  }
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

function readString(block: string, key: string): string | null {
  const re = new RegExp(`(?:^|\\n)\\s*${key}\\s*:\\s*(.+)`, 'i')
  const match = re.exec(block)
  if (match === null || match[1] === undefined) {
    return null
  }
  const value = match[1].trim()
  return value === '' ? null : value
}
