import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  emptyParserContext,
  parseRolloutLine,
} from '../src/openaiHistory/codex/rolloutParser'
import type { ParseOutcome } from '../src/openaiHistory/codex/rolloutTypes'
import type { ParserContext } from '../src/openaiHistory/domain'

const FIXTURE_DIR = join(__dirname, 'fixtures', 'codex-rollouts')

function readLines(name: string): string[] {
  const text = readFileSync(join(FIXTURE_DIR, name), 'utf8')
  return text.split(/\n/).filter((line) => line.length > 0)
}

function parseAll(name: string): { outcomes: ParseOutcome[]; context: ParserContext } {
  let context = emptyParserContext()
  const outcomes: ParseOutcome[] = []
  let offset = 0
  for (const line of readLines(name)) {
    const outcome = parseRolloutLine(line, context, offset)
    outcomes.push(outcome)
    if (outcome.type === 'context' || outcome.type === 'request' || outcome.type === 'snapshot' || outcome.type === 'status') {
      context = outcome.context
    }
    offset += Buffer.byteLength(line, 'utf8') + 1
  }
  return { outcomes, context }
}

describe('parseRolloutLine fixtures', () => {
  it('session-meta fills context and never emits a request', () => {
    const { outcomes, context } = parseAll('session-meta.jsonl')
    expect(outcomes.every((o) => o.type === 'context')).toBe(true)
    expect(outcomes).toHaveLength(2)
    expect(context.sessionId).toBe('session-aaa')
    expect(context.threadId).toBe('thread-aaa')
    expect(context.accountOpaqueId).toBe('acct-111')
  })

  it('turn-context remembers the model', () => {
    const { context } = parseAll('turn-context.jsonl')
    expect(context.model).toBe('gpt-fixture-a')
    expect(context.turnId).toBe('turn-1')
  })

  it('token-usage-record uses payload.usage only', () => {
    const { outcomes } = parseAll('token-usage-record.jsonl')
    const request = outcomes.find((o) => o.type === 'request')
    expect(request?.type).toBe('request')
    if (request?.type !== 'request') {
      return
    }
    expect(request.candidate.usage.inputTokens).toBe(15347)
    expect(request.candidate.usage.outputTokens).toBe(185)
    expect(request.candidate.usage.cachedInputTokens).toBe(12160)
    expect(request.candidate.model).toBe('gpt-fixture-b')
    expect(request.candidate.modelEvidence).toBe('response')
    expect(request.candidate.status).toBe('unknown')
  })

  it('token-count-snapshot yields one request and one snapshot', () => {
    const { outcomes } = parseAll('token-count-snapshot.jsonl')
    expect(outcomes.filter((o) => o.type === 'request')).toHaveLength(1)
    expect(outcomes.filter((o) => o.type === 'snapshot')).toHaveLength(1)
  })

  it('snapshot-only yields zero requests', () => {
    const { outcomes } = parseAll('snapshot-only.jsonl')
    expect(outcomes.filter((o) => o.type === 'request')).toHaveLength(0)
    expect(outcomes.filter((o) => o.type === 'snapshot')).toHaveLength(2)
  })

  it('bad-line is bad-json', () => {
    const { outcomes } = parseAll('bad-line.jsonl')
    expect(outcomes).toEqual([{ type: 'skip', reason: 'bad-json' }])
  })

  it('dropped-body omits the fixture sentence from the outcome', () => {
    const { outcomes } = parseAll('dropped-body.jsonl')
    expect(outcomes).toEqual([{ type: 'skip', reason: 'dropped-body' }])
    expect(JSON.stringify(outcomes[0])).not.toContain('SYNTHETIC_FIXTURE_SENTENCE_DO_NOT_STORE')
  })

  it('fork emits two candidates with the same responseId and a parent on the child', () => {
    const { outcomes } = parseAll('fork.jsonl')
    const requests = outcomes.filter((o) => o.type === 'request')
    expect(requests).toHaveLength(2)
    if (requests[0]?.type !== 'request' || requests[1]?.type !== 'request') {
      return
    }
    expect(requests[0].candidate.responseId).toBe('resp_shared')
    expect(requests[1].candidate.responseId).toBe('resp_shared')
    expect(requests[1].candidate.parentConversationId).toBe('thread-parent')
  })

  it('unknown-account leaves accountOpaqueId null', () => {
    const { outcomes } = parseAll('unknown-account.jsonl')
    const request = outcomes.find((o) => o.type === 'request')
    expect(request?.type).toBe('request')
    if (request?.type !== 'request') {
      return
    }
    expect(request.candidate.accountOpaqueId).toBeNull()
  })

  it('treats response text, world state, and non-token events as ignored', () => {
    const lines = [
      '{"type":"response_item","payload":{"type":"message"}}',
      '{"type":"world_state","payload":{}}',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
      '{"type":"compacted"}',
      'not-json',
      '{"type":"brand_new_envelope"}',
    ]
    const reasons = lines.map((line) => parseRolloutLine(line, emptyParserContext(), 0))
    expect(reasons.map((outcome) => (outcome.type === 'skip' ? outcome.reason : outcome.type))).toEqual([
      'ignored',
      'ignored',
      'ignored',
      'ignored',
      'bad-json',
      'unknown-type',
    ])
  })

  it('keeps rate_limits off the token sum and records the newest window fields', () => {
    const line = JSON.stringify({
      timestamp: '2026-10-19T10:15:34.000Z',
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: {
            input_tokens: 10,
            cached_input_tokens: 4,
            output_tokens: 2,
            reasoning_output_tokens: 1,
            total_tokens: 12,
          },
        },
        rate_limits: {
          plan_type: 'team',
          limit_id: 'codex',
          primary: { used_percent: 26, window_minutes: 300, resets_at: 1792422464 },
          secondary: { used_percent: 4, window_minutes: 10080, resets_at: 1793009264 },
          credits: { has_credits: true, unlimited: false, balance: null },
          rate_limit_reached_type: null,
        },
      },
    })
    const outcome = parseRolloutLine(line, emptyParserContext(), 12)
    expect(outcome.type).toBe('snapshot')
    if (outcome.type !== 'snapshot') {
      return
    }
    expect(outcome.snapshot.usage.inputTokens).toBe(10)
    expect(outcome.rateLimit).toMatchObject({
      planType: 'team',
      limitId: 'codex',
      primary: { usedPercent: 26, windowMinutes: 300, resetsAt: 1792422464 },
      secondary: { usedPercent: 4, windowMinutes: 10080, resetsAt: 1793009264 },
      credits: { hasCredits: true, unlimited: false, balance: null },
      rateLimitReachedType: null,
    })
  })

  it('copies model_context_window from the session onto the request', () => {
    let context = emptyParserContext()
    const started = parseRolloutLine(
      JSON.stringify({
        type: 'event_msg',
        payload: { type: 'task_started', model_context_window: 258400, turn_id: 'turn-1' },
      }),
      context,
      0,
    )
    expect(started.type).toBe('context')
    if (started.type !== 'context') {
      return
    }
    context = started.context
    const request = parseRolloutLine(
      JSON.stringify({
        timestamp: '2026-10-24T19:33:47.000Z',
        type: 'token_usage_record',
        payload: {
          thread_id: 'thread-plan',
          response_id: 'resp-plan',
          model: 'gpt-6-astra',
          usage: { input_tokens: 142065, output_tokens: 8000, total_tokens: 229895 },
        },
      }),
      context,
      20,
    )
    expect(request.type).toBe('request')
    if (request.type !== 'request') {
      return
    }
    expect(request.candidate.modelContextWindow).toBe(258400)
    expect(request.candidate.usage.inputTokens).toBe(142065)
  })

  it('maps rate-limit plan_type team onto the session billing mode', () => {
    let context = emptyParserContext()
    const first = parseRolloutLine(
      JSON.stringify({
        timestamp: '2026-10-24T19:00:00.000Z',
        type: 'token_usage_record',
        payload: {
          thread_id: 'thread-exec',
          response_id: 'resp-before',
          model: 'gpt-6-astra',
          usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
        },
      }),
      context,
      0,
    )
    expect(first.type).toBe('request')
    if (first.type !== 'request') {
      return
    }
    expect(first.candidate.billingMode).toBe('unknown')
    context = first.context
    const snapshot = parseRolloutLine(
      JSON.stringify({
        timestamp: '2026-10-24T19:00:01.000Z',
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: { total_token_usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 } },
          rate_limits: { plan_type: 'team', limit_id: 'codex' },
        },
      }),
      context,
      10,
    )
    expect(snapshot.type).toBe('snapshot')
    if (snapshot.type !== 'snapshot') {
      return
    }
    expect(snapshot.context.billingMode).toBe('chatgpt-plan')
    context = snapshot.context
    const later = parseRolloutLine(
      JSON.stringify({
        timestamp: '2026-10-24T19:00:02.000Z',
        type: 'token_usage_record',
        payload: {
          thread_id: 'thread-exec',
          response_id: 'resp-after',
          model: 'gpt-6-astra',
          usage: { input_tokens: 20, output_tokens: 4, total_tokens: 24 },
        },
      }),
      context,
      20,
    )
    expect(later.type).toBe('request')
    if (later.type !== 'request') {
      return
    }
    expect(later.candidate.billingMode).toBe('chatgpt-plan')
  })

  it('leaves an unknown plan_type as unknown billing', () => {
    const outcome = parseRolloutLine(
      JSON.stringify({
        timestamp: '2026-10-24T19:00:01.000Z',
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: { total_token_usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } },
          rate_limits: { plan_type: 'custom-lab', limit_id: 'codex' },
        },
      }),
      emptyParserContext(),
      0,
    )
    expect(outcome.type).toBe('snapshot')
    if (outcome.type !== 'snapshot') {
      return
    }
    expect(outcome.context.billingMode).toBe('unknown')
  })

  it('two-models prefers response model then falls back to turn-context', () => {
    const { outcomes } = parseAll('two-models.jsonl')
    const requests = outcomes.filter((o) => o.type === 'request')
    expect(requests).toHaveLength(2)
    if (requests[0]?.type !== 'request' || requests[1]?.type !== 'request') {
      return
    }
    expect(requests[0].candidate.model).toBe('model-b')
    expect(requests[0].candidate.modelEvidence).toBe('response')
    expect(requests[1].candidate.model).toBe('model-a')
    expect(requests[1].candidate.modelEvidence).toBe('turn-context')
  })
})

describe('ids helpers used by later phases', () => {
  it('shortThreadTitle and scope keys', async () => {
    const {
      shortThreadTitle,
      unknownScopeKey,
      accountScopeKey,
      provisionalRequestKey,
    } = await import('../src/openaiHistory/ids')
    expect(shortThreadTitle('abcdefghij')).toBe('#abcdefgh')
    expect(shortThreadTitle('abc')).toBe('#abc')
    expect(unknownScopeKey('inst')).toBe('unknown-source:inst')
    expect(accountScopeKey('acct')).toBe('account:acct')
    expect(provisionalRequestKey('inst', 2, 40)).toBe('inst:2:40')
  })
})
