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
  return [
    '## Findings',
    'Meter hints only. Confirm each one against this chat before you act on it.',
    ...lines,
    '',
  ]
}

function ruleSection(queryCount: number, depth: OptimizeDepth): string[] {
  const short =
    queryCount < MIN_REQUESTS_FOR_RULE
      ? `This thread has ${queryCount} billed requests, so the meter sample is thin. Prefer tips in the reply. Write a rule only when this chat shows a habit that will repeat.`
      : 'Write a rule only for a habit you can point at in this chat.'
  const scope =
    depth === 'quick'
      ? 'At most one tiny rule.'
      : depth === 'deep'
        ? 'Add focused rule files for this thread. Do not replace rules that are still good.'
        : 'Add or tighten one small rule for this thread. Do not replace rules that are still good.'
  return [
    '## Rules',
    short,
    scope,
    '- Say what this chat was doing (the kind of ask, the tool loop, the files) in the rule text.',
    '- Do not write a generic idle-gap, cache-write, or "start a fresh chat" rule unless that is what this thread actually did.',
    '- At most 40 lines. Front matter: `alwaysApply: false` and a short `description`.',
    '- Do not edit AGENTS.md or product code. Do not audit the repository.',
    `You must still write \`${OPTIMIZE_SAVINGS_FILE}\` (## Lifetime savings).`,
    '',
  ]
}

function identityLine(named: boolean, title: string): string {
  if (!named) {
    return 'This thread has no stored title. Match it by the work already in this chat and the billing window below. If this chat is empty, stop.'
  }
  return `This thread is titled "${title}". If the open chat is clearly a different conversation, stop and name the chat that is open. Do not optimize the wrong thread.`
}

function introLines(
  depth: OptimizeDepth,
  toolLine: string,
  named: boolean,
  title: string,
): string[] {
  const label = optimizeDepthLabel(depth)
  const shared = [
    `You are inside this Cursor conversation. The user pressed Play (Optimize ${label}) and this prompt was pasted here.`,
    "Use this chat's real history: the asks, the files, the repeated turns, and the tool loops. The extension did not attach a transcript dump and did not read the messages.",
    'The sections below are billing metadata for this same thread. Cite a number when you claim something was expensive. Do not invent quotes, paths, or work that is not in this chat.',
    identityLine(named, title),
    'Cache read is cheap, cache write is dear, output is dearest. That is a hint, not the answer. Name the habit in this chat that produced the burn.',
    'Do not answer with a generic essay about idle gaps, cache write, or starting a fresh chat unless this thread actually did that.',
    toolLine,
  ]
  if (depth === 'quick') {
    return [
      `Cursor conversation (Optimize ${label})`,
      '',
      ...shared,
      'Keep the answer short. Lead with the single habit in this chat that cost the most.',
      '',
    ]
  }
  if (depth === 'deep') {
    return [
      `Cursor conversation (Optimize ${label})`,
      '',
      ...shared,
      'This is a playbook for the whole thread, grounded in what this chat actually did — not a single last-turn tip and not a workspace audit.',
      '',
    ]
  }
  return [
    `Cursor conversation (Optimize ${label})`,
    '',
    ...shared,
    'Lead with the habit in this chat that cost the most. At most three actions.',
    '',
  ]
}

function nextTimeSection(
  depth: OptimizeDepth,
  count: number,
  billed: string,
): string[] {
  const evidence = `Billing evidence for this thread: ${count} requests, ${billed}. Use the curve, idle markers, and dearest row only when they match something that happened in this chat.`
  if (depth === 'quick') {
    return [
      '## Next time (Quick)',
      evidence,
      'From this chat, not from a template:',
      '1. At most three bullets on why this thread got expensive. Each bullet names something that happened here (a repeated ask, a file, a tool loop, or a resume) and cites one number.',
      '2. Three concrete changes to the next message in this chat.',
      '3. At most one tiny rule for the habit you just named.',
      '',
    ]
  }
  if (depth === 'deep') {
    return [
      '## Diagnosis checklist (Deep)',
      'Answer from this chat. Cite a number only when the messages support it:',
      '- What did this thread keep re-sending or re-doing?',
      '- Was the burn input context, tool loops, retries, model choice, or a resume after a gap?',
      `- Which single habit would have prevented most of the ${billed} billed here?`,
      '- What must stay allowed so quality does not collapse on the next similar turn?',
      '',
      '## Next time (Deep)',
      'Whole-conversation playbook for this thread. Assume the same kind of work continues here.',
      evidence,
      '1. Diagnose the waste in structured sections tied to turns in this chat.',
      '2. Before/after for the next similar turn (token and dollar ranges you estimate).',
      '3. What to type on the very next message in this chat. No invented quotes.',
      '4. Focused rules for the pattern this chat repeated. Do not rewrite the repo.',
      '',
    ]
  }
  return [
    '## Next time',
    evidence,
    'From this chat:',
    '1. Explain the waste pattern of this thread (what was asked, what grew, what was repeated).',
    '2. A short plan for the rest of this chat: what to stop doing, what to ask in one turn, what not to re-attach.',
    '3. At most three actions. Each one names a habit from this chat and cites one number.',
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
    `Also write \`${OPTIMIZE_SAVINGS_FILE}\`. That file is the running Optimize total for this project, separate from any rule you add for this thread.`,
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
    'Estimate the next similar turn in this chat after the habit changes. The extension did not put prompt text or code in this message.',
  ]
}

/**
 * Billing brief pasted into the conversation Play was pressed on.
 * The extension does not read the transcript. The open chat is the context.
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
  const findings = options.findings ?? []
  const billed = formatDollars(sumCost(queries))
  const title = promptConversationTitle(group)
  const toolLine = `Tools may look at this chat to name the waste. Add focused rules for this thread, and you must write \`${OPTIMIZE_SAVINGS_FILE}\`. Do not audit or rewrite the repository.`

  const lines = [
    ...introLines(depth, toolLine, group.named, title),
    '## Conversation',
    `title: ${title}`,
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
    ...nextTimeSection(depth, count, billed),
    ...ruleSection(count, depth),
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
