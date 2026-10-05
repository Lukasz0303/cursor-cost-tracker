import { formatCompactTokens, formatDollars, formatTokens } from '../format'
import {
  DEFAULT_OPTIMIZE_DEPTH,
  optimizeDepthLabel,
  parseOptimizeDepth,
  type OptimizeDepth,
} from '../optimizeDepth'
import { formatDateTimeWithZone } from '../time/zoneLabel'
import type { ConversationGroup } from '../usage/groupConversations'
import type { UsageQuery } from '../usage/types'
import {
  CCT_SAVINGS_FENCE,
  OPTIMIZE_SAVINGS_FILE,
  parseOptimizeSavingsMarkdown,
} from './optimizeSavings'

const IDLE_MS = 30 * 60 * 1000
const SLICE_COUNT = 6
const MAX_OTHER_EVENTS = 5
const MAX_FINDINGS = 4
const MAX_MARKERS = 6
const MIN_REQUESTS_FOR_RULE = 3

export const CONVERSATION_FINDING_IDS = [
  'stale-resume',
  'context-blowup',
  'concentration',
  'no-cache-read',
] as const

export type ConversationFindingId = (typeof CONVERSATION_FINDING_IDS)[number]

export type ConversationFinding = {
  id: ConversationFindingId
  line: string
}

export type ConversationOptimizeOptions = {
  /** Quick / Balanced / Deep — same model as the Optimize tab. Default Balanced. */
  depth?: OptimizeDepth
  /** Slice 5 rules for this group only. Omitted when that module is absent. */
  findings?: readonly ConversationFinding[]
  /** True when coding-stats lines are on screen. Dollars stay the account's. */
  accountSpend?: boolean
  projectLabel?: string
  /** Current `.ai/optimize-savings.md`, so the next fence stays cumulative. */
  priorMarkdown?: string | null
  /** Already credited mid for this workspace. Wins when the file was reset lower. */
  creditedTokensMid?: number
  creditedUsdMid?: number
  creditedRun?: number
}

const FINDING_IDS = new Set<string>(CONVERSATION_FINDING_IDS)

export function aboutPromptTokens(prompt: string): number {
  return Math.ceil(prompt.length / 4)
}

export function promptConversationTitle(group: ConversationGroup): string {
  return group.named ? group.title : 'unnamed conversation'
}

function formatStamp(ms: number): string {
  const date = new Date(ms)
  if (!Number.isFinite(date.getTime())) {
    return 'not in the data'
  }
  return formatDateTimeWithZone(ms)
}

function sliceSizes(count: number): number[] {
  const sizes = Array.from({ length: SLICE_COUNT }, () => 0)
  if (count <= 0) {
    return sizes
  }
  const base = Math.floor(count / SLICE_COUNT)
  let extra = count % SLICE_COUNT
  for (let i = 0; i < SLICE_COUNT; i++) {
    const add = extra > 0 ? 1 : 0
    sizes[i] = base + add
    if (extra > 0) {
      extra -= 1
    }
  }
  return sizes
}

function sliceOf(index: number, sizes: readonly number[]): number {
  let cursor = 0
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]
    if (size === undefined) {
      continue
    }
    cursor += size
    if (index < cursor) {
      return i + 1
    }
  }
  return sizes.length
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? null
  }
  const left = sorted[mid - 1]
  const right = sorted[mid]
  if (left === undefined || right === undefined) {
    return null
  }
  return (left + right) / 2
}

function sumCost(queries: readonly UsageQuery[]): number {
  return queries.reduce((sum, query) => sum + query.costUsd, 0)
}

function modelName(query: UsageQuery): string {
  return query.model === null || query.model === '' ? 'unknown' : query.model
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

type IndexedQuery = {
  query: UsageQuery
  index: number
}

function dearest(queries: readonly UsageQuery[], limit: number): IndexedQuery[] {
  const indexed = queries.map((query, offset) => ({
    query,
    index: offset + 1,
  }))
  indexed.sort((a, b) => {
    if (b.query.costUsd !== a.query.costUsd) {
      return b.query.costUsd - a.query.costUsd
    }
    if (b.query.tokens !== a.query.tokens) {
      return b.query.tokens - a.query.tokens
    }
    return a.index - b.index
  })
  return indexed.slice(0, limit)
}

function modelLines(queries: readonly UsageQuery[]): string {
  const costs = new Map<string, number>()
  for (const query of queries) {
    const name = modelName(query)
    costs.set(name, (costs.get(name) ?? 0) + query.costUsd)
  }
  const ranked = [...costs.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  if (ranked.length === 0) {
    return 'not in the data'
  }
  return ranked
    .slice(0, 12)
    .map(([name, cost]) => `${name} ${formatDollars(cost)}`)
    .join(' · ')
}

function majorityLine(queries: readonly UsageQuery[]): string {
  const total = sumCost(queries)
  if (total <= 0) {
    return 'model majority: not in the data'
  }
  const costs = new Map<string, number>()
  for (const query of queries) {
    const name = modelName(query)
    costs.set(name, (costs.get(name) ?? 0) + query.costUsd)
  }
  let topName = ''
  let topCost = 0
  for (const [name, cost] of costs) {
    if (cost > topCost) {
      topName = name
      topCost = cost
    }
  }
  if (topCost / total <= 0.5) {
    return 'model majority: no single model is most of the dollars'
  }
  const percent = Math.round((topCost / total) * 100)
  return `model majority: ${topName} is ${percent}% of ${formatDollars(total)}`
}

function curveLines(queries: readonly UsageQuery[]): string[] {
  const sizes = sliceSizes(queries.length)
  const lines: string[] = []
  let offset = 0
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i] ?? 0
    const slice = queries.slice(offset, offset + size)
    offset += size
    const cache = median(slice.map((query) => query.cacheReadTokens))
    const cacheLabel =
      cache === null ? 'not in the data' : formatTokens(cache)
    lines.push(
      `${i + 1}. reqs ${slice.length} · ${formatDollars(sumCost(slice))} · med cache read ${cacheLabel}`,
    )
  }
  return lines
}

type IdleMarker = {
  minutes: number
  beforeIndex: number
  slice: number
}

function idleMarkers(queries: readonly UsageQuery[]): string[] {
  const sizes = sliceSizes(queries.length)
  const markers: IdleMarker[] = []
  for (let i = 1; i < queries.length; i++) {
    const previous = queries[i - 1]
    const current = queries[i]
    if (previous === undefined || current === undefined) {
      continue
    }
    const gap = current.timestamp - previous.timestamp
    if (gap < IDLE_MS) {
      continue
    }
    markers.push({
      minutes: Math.round(gap / 60_000),
      beforeIndex: i + 1,
      slice: sliceOf(i, sizes),
    })
  }
  const kept =
    markers.length <= MAX_MARKERS
      ? markers
      : [...markers]
          .sort(
            (a, b) =>
              b.minutes - a.minutes || a.beforeIndex - b.beforeIndex,
          )
          .slice(0, MAX_MARKERS)
  kept.sort((a, b) => a.beforeIndex - b.beforeIndex)
  return kept.map(
    (marker) =>
      `${marker.minutes}m idle before #${marker.beforeIndex} (slice ${marker.slice})`,
  )
}

function tokenBuckets(queries: readonly UsageQuery[]): string {
  let input = 0
  let output = 0
  let cacheRead = 0
  let cacheWrite = 0
  for (const query of queries) {
    input += query.inputTokens
    output += query.outputTokens
    cacheRead += query.cacheReadTokens
    cacheWrite += query.cacheWriteTokens
  }
  return `input ${formatTokens(input)} · output ${formatTokens(output)} · cache read ${formatTokens(cacheRead)} · cache write ${formatTokens(cacheWrite)}`
}

function findingId(findings: readonly ConversationFinding[]): ConversationFindingId | null {
  for (const finding of findings) {
    if (FINDING_IDS.has(finding.id)) {
      return finding.id
    }
  }
  return null
}

function findingsSection(findings: readonly ConversationFinding[]): string[] {
  const lines: string[] = []
  for (const finding of findings) {
    if (!FINDING_IDS.has(finding.id)) {
      continue
    }
    const line = oneLine(finding.line)
    if (line === '') {
      continue
    }
    lines.push(`- ${finding.id}: ${line}`)
    if (lines.length >= MAX_FINDINGS) {
      break
    }
  }
  if (lines.length === 0) {
    return []
  }
  return ['## Findings', ...lines, '']
}

function ruleSection(
  queryCount: number,
  finding: ConversationFindingId | null,
  depth: OptimizeDepth,
): string[] {
  if (queryCount < MIN_REQUESTS_FOR_RULE) {
    return [
      '## One rule file',
      `This conversation has ${queryCount} requests, fewer than ${MIN_REQUESTS_FOR_RULE}. Write no rule file, and say why in one line.`,
      `Still write \`${OPTIMIZE_SAVINGS_FILE}\` for the lifetime total in ## Lifetime savings.`,
      '',
    ]
  }
  // Quick: only write a rule when a finding already fired for this group.
  if (depth === 'quick' && finding === null) {
    return [
      '## One rule file',
      'Quick depth: no finding fired for this conversation. Write no rule file.',
      `Still write \`${OPTIMIZE_SAVINGS_FILE}\` for the lifetime total in ## Lifetime savings.`,
      '',
    ]
  }
  const slug = finding ?? 'conversation-length'
  return [
    '## One rule file',
    `You may create or replace exactly one rule file: \`.cursor/rules/cct-${slug}.mdc\`.`,
    '- At most 40 lines.',
    '- Front matter: `alwaysApply: false` and a short `description`. No globs.',
    '- State a general habit only: start a fresh chat after a long idle gap, do not resume a thread whose cache write dominates, or keep the next similar turn inside one task.',
    '- Do not quote this chat, do not include the conversation title, and do not name a file from the repo.',
    '- Do not edit other rules, AGENTS.md, or product code.',
    '- Do not read the transcript to fill in the rule.',
    `You must also write \`${OPTIMIZE_SAVINGS_FILE}\` (## Lifetime savings). No other files.`,
    '',
  ]
}

function introLines(depth: OptimizeDepth, toolLine: string): string[] {
  const label = optimizeDepthLabel(depth)
  if (depth === 'quick') {
    return [
      `Cursor conversation brief (Optimize ${label})`,
      '',
      'Use only the numbers below. If a figure is missing, say `not in the data`.',
      'Do not ask what the work was. This extension did not read prompts, messages, or code.',
      'Lead with the largest dollar item. Keep the answer short.',
      toolLine,
      '',
    ]
  }
  if (depth === 'deep') {
    return [
      `Cursor conversation brief (Optimize ${label})`,
      '',
      'Use only the numbers below. If a figure is missing, say `not in the data`.',
      'Do not ask what the work was. This extension did not read prompts, messages, or code.',
      'Cache read is cheap, cache write is dear, output is dearest. A long thread gets dearer per turn because every turn resends context.',
      "Do not recommend a cheaper model unless one model is most of this conversation's dollars.",
      'This is a full playbook for the WHOLE conversation pattern — not a single last-turn tip.',
      'Lead with the largest dollar item. At most three actions, each citing a number from this brief.',
      toolLine,
      '',
    ]
  }
  return [
    `Cursor conversation brief (Optimize ${label})`,
    '',
    'Use only the numbers below. If a figure is missing, say `not in the data`.',
    'Do not ask what the work was. This extension did not read prompts, messages, or code.',
    'Cache read is cheap, cache write is dear, output is dearest. A long thread gets dearer per turn because every turn resends context.',
    "Do not recommend a cheaper model unless one model is most of this conversation's dollars.",
    'Lead with the largest dollar item. At most three actions, each citing a number from this brief.',
    toolLine,
    '',
  ]
}

function nextTimeSection(
  depth: OptimizeDepth,
  count: number,
  billed: string,
  idleExample: string,
  medianCache: string,
): string[] {
  if (depth === 'quick') {
    return [
      '## Next time (Quick)',
      'Assume the same kind of work starts again. Write at most three bullets. Every bullet must cite a number from this brief.',
      `- When to open a new chat: ${count} requests · ${billed}.`,
      `- Where to split: idle example ${idleExample}.`,
      `- What grew: cache vs median cache read ${medianCache}.`,
      '',
    ]
  }
  if (depth === 'deep') {
    return [
      '## Diagnosis checklist (Deep)',
      'Answer each in one line, citing a number from this brief:',
      `- Was the burn mostly cache write, cache read growth, output, or model mix? (tokens line + models)`,
      `- Where should this thread have been split? (idle markers / cost curve; example ${idleExample})`,
      `- Which single habit would have prevented most of the ${billed} billed here?`,
      `- What must stay allowed so quality does not collapse on the next similar conversation?`,
      '',
      '## Next time (Deep)',
      'Assume the same kind of work starts again. This is a whole-conversation playbook.',
      'Write at most five bullets. Every bullet must cite a number from this brief.',
      `- When to open a new chat: this brief has ${count} requests and ${billed}.`,
      `- Where the curve says the thread should have been split: idle example ${idleExample}.`,
      `- What the numbers say grew: cache write after a gap, or cache read versus this group's median cache read ${medianCache}.`,
      '- One durable rule focus for the next similar thread (cite the finding id or conversation-length).',
      '- What to type differently on the very next message after Start (no invented transcript quotes).',
      '',
    ]
  }
  return [
    '## Next time',
    'Assume the same kind of work starts again.',
    'Write at most five bullets. Every bullet must cite a number from this brief.',
    `- When to open a new chat: this brief has ${count} requests and ${billed}.`,
    `- Where the curve says the thread should have been split: idle example ${idleExample}.`,
    `- What the numbers say grew: cache write after a gap, or cache read versus this group's median cache read ${medianCache}.`,
    '',
  ]
}

function higherMid(file: number | null, credited: number | undefined): number | null {
  const stored =
    credited !== undefined && Number.isFinite(credited) && credited > 0
      ? credited
      : null
  if (file === null) {
    return stored
  }
  if (stored === null) {
    return file
  }
  return Math.max(file, stored)
}

function savingsClose(
  projectLabel: string | undefined,
  priorMarkdown: string | null | undefined,
  creditedTokensMid: number | undefined,
  creditedUsdMid: number | undefined,
  creditedRun: number | undefined,
): string[] {
  const trimmed = projectLabel?.trim() ?? ''
  const project = trimmed === '' ? '<workspace folder name>' : trimmed
  const prior = parseOptimizeSavingsMarkdown(priorMarkdown)
  const tokensMid = higherMid(prior.estTokensSaved, creditedTokensMid)
  const usdMid = higherMid(prior.estUsdSaved, creditedUsdMid)
  const fileRun = prior.run !== null && prior.run >= 1 ? prior.run : null
  const storedRun =
    creditedRun !== undefined && Number.isFinite(creditedRun) && creditedRun >= 1
      ? Math.round(creditedRun)
      : null
  const run =
    fileRun === null ? storedRun : storedRun === null ? fileRun : Math.max(fileRun, storedRun)
  const hasPrior = tokensMid !== null || usdMid !== null || run !== null
  const nextRun = run !== null ? run + 1 : 1
  const tokensHint =
    tokensMid !== null
      ? `<${Math.round(tokensMid)} + integer tokens saved on the NEXT similar turn>`
      : '<integer tokens saved on the NEXT similar turn>'
  const usdHint =
    usdMid !== null
      ? `<${usdMid} + dollars saved on the NEXT similar turn>`
      : '<dollars saved on the NEXT similar turn>'
  const priorLines = hasPrior
    ? [
        `Prior mid: ${tokensMid === null ? 'n/a tokens' : `~${formatCompactTokens(tokensMid)} tokens`} / ${usdMid === null ? 'n/a' : `~${formatDollars(usdMid)}`}.`,
        run !== null
          ? `Prior run: ${run}. Set run to ${nextRun}.`
          : 'Prior fence has no run. Set run to 1.',
        'tokens_mid and usd_mid are the lifetime totals for this project: prior mid plus what this conversation saves on the next similar turn. Both must be >= the prior mid.',
      ]
    : ['No prior projection in this brief. Create the file with run: 1.']

  return [
    '## Lifetime savings',
    `Also write \`${OPTIMIZE_SAVINGS_FILE}\`. That file is the running Optimize total for this project, separate from the one conversation rule above.`,
    ...priorLines,
    'Overwrite that file with this fence (keep project):',
    '',
    `\`\`\`${CCT_SAVINGS_FENCE}`,
    `project: ${project}`,
    `tokens_mid: ${tokensHint}`,
    `usd_mid: ${usdHint}`,
    `run: ${nextRun}`,
    '```',
    '',
    'End with (REQUIRED): mid tokens saved, mid USD saved, and project name — same values as the fence (`project`, `tokens_mid`, `usd_mid`).',
    'Do not summarize a transcript. This brief has no prompt text and no code.',
  ]
}

function groupMedianCache(queries: readonly UsageQuery[]): string {
  const value = median(queries.map((query) => query.cacheReadTokens))
  return value === null ? 'not in the data' : formatTokens(value)
}

/**
 * Numbers-only brief for one conversation. The extension does not send it.
 * No transcript and no file tree. The agent may write exactly one rule file.
 * Depth mirrors the Optimize tab (Quick / Balanced / Deep); default Balanced.
 */
export function buildConversationOptimizePrompt(
  group: ConversationGroup,
  options: ConversationOptimizeOptions = {},
): string {
  const depth = parseOptimizeDepth(options.depth ?? DEFAULT_OPTIMIZE_DEPTH)
  const queries = group.queries
  const count = queries.length
  const first = queries[0]
  const last = queries[count - 1]
  const window =
    first === undefined || last === undefined
      ? 'not in the data'
      : `${formatStamp(first.timestamp)} → ${formatStamp(last.timestamp)}`
  const top = dearest(queries, 1)[0]
  const dearestLine =
    top === undefined
      ? 'not in the data'
      : `#${top.index} · ${modelName(top.query)} · ${formatTokens(top.query.tokens)} tokens · ${formatDollars(top.query.costUsd)}`
  const markers = idleMarkers(queries)
  const idleExample =
    markers[0] === undefined ? 'not in the data' : markers[0]
  const findings = options.findings ?? []
  const fired = findingId(findings)
  const billed = formatDollars(sumCost(queries))
  const medianCache = groupMedianCache(queries)

  const skipRuleQuick = depth === 'quick' && (count < MIN_REQUESTS_FOR_RULE || fired === null)
  const toolLine =
    count < MIN_REQUESTS_FOR_RULE || skipRuleQuick
      ? `Do not write a rule file at this depth. You must still write \`${OPTIMIZE_SAVINGS_FILE}\`.`
      : `Tools are allowed only to write the one rule file in ## One rule file and \`${OPTIMIZE_SAVINGS_FILE}\`. The savings file is required.`

  const lines = [
    ...introLines(depth, toolLine),
    '## Conversation',
    `title: ${promptConversationTitle(group)}`,
    `window: ${window}`,
    `requests: ${count}`,
    `billed: ${billed}`,
    `dearest: ${dearestLine}`,
    `models: ${modelLines(queries)}`,
    majorityLine(queries),
    `tokens: ${tokenBuckets(queries)}`,
  ]
  if (options.accountSpend === true) {
    lines.push(
      "dollars: these are the account's usage events, not this repo's git or coding-stats lines",
    )
  }
  lines.push(
    '',
    '## Cost curve — 6 equal slices, oldest -> newest',
    ...curveLines(queries),
  )
  if (markers.length > 0) {
    lines.push(...markers)
  }
  lines.push(
    '',
    '## Other events',
    ...dearest(queries, MAX_OTHER_EVENTS).map(
      (item) =>
        `#${item.index} · ${formatStamp(item.query.timestamp)} · ${modelName(item.query)} · ${formatTokens(item.query.tokens)} tokens · ${formatDollars(item.query.costUsd)}`,
    ),
    '',
    ...findingsSection(findings),
    ...nextTimeSection(depth, count, billed, idleExample, medianCache),
    ...ruleSection(count, fired, depth),
    ...savingsClose(
      options.projectLabel,
      options.priorMarkdown,
      options.creditedTokensMid,
      options.creditedUsdMid,
      options.creditedRun,
    ),
  )
  return lines.join('\n')
}
