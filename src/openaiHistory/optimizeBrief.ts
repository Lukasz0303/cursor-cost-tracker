import type { CodexDetailFields } from './historyDetails'

export type CodexOptimizeDepth = 'quick' | 'balanced' | 'deep'

/**
 * Billing-only Codex Optimize brief. No prompt text, tool text, or absolute paths.
 * Depth: quick → one hint; balanced → all hints; deep → all hints + token breakdown.
 */
export function buildCodexOptimizeBrief(input: {
  depth: CodexOptimizeDepth
  row: CodexDetailFields
  hints: readonly string[]
  model?: string | null
}): string {
  const { depth, row, hints } = input
  const model =
    typeof input.model === 'string' && input.model.trim() !== ''
      ? input.model.trim()
      : '—'

  const lines: string[] = [
    'Codex local — Optimize brief (billing metadata only)',
    `Depth: ${depth}`,
    `Model: ${model}`,
    `Observed: ${row.observed}`,
    `Status: ${row.status}`,
    `Conversation: ${row.conversation}`,
    `Session: ${row.session}`,
    `Turn: ${row.turn}`,
    `Response id: ${row.responseId}`,
    `Total tokens: ${row.total}`,
    `Cost: ${row.costBasis}`,
  ]

  const selectedHints =
    depth === 'quick' ? hints.slice(0, 1) : [...hints]

  if (selectedHints.length > 0) {
    lines.push('')
    lines.push('Hypotheses:')
    for (const hint of selectedHints) {
      lines.push(`- ${hint}`)
    }
  }

  if (depth === 'deep') {
    lines.push('')
    lines.push('Token breakdown:')
    lines.push(`- Input: ${row.input}`)
    lines.push(`- Cached input: ${row.cachedInput}`)
    lines.push(`- Output: ${row.output}`)
    lines.push(`- Reasoning: ${row.reasoning}`)
    lines.push(`- Usage quality: ${row.usageQuality}`)
  }

  lines.push('')
  lines.push(
    'Numbers only — no chat transcript. Review the open Agent chat yourself; do not treat this brief as a submit.',
  )

  return lines.join('\n')
}
