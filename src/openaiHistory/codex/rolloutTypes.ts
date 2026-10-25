import type {
  ParserContext,
  RateLimitMeasurement,
  RequestCandidate,
  RequestStatus,
  UsageSnapshotEvent,
} from '../domain'

export type ParseOutcome =
  | { type: 'request'; candidate: RequestCandidate; context: ParserContext }
  | {
      type: 'snapshot'
      snapshot: UsageSnapshotEvent
      rateLimit: RateLimitMeasurement | null
      context: ParserContext
    }
  | { type: 'context'; context: ParserContext }
  | {
      type: 'status'
      status: RequestStatus
      errorCode: string | null
      responseId: string | null
      turnId: string | null
      context: ParserContext
    }
  | {
      type: 'skip'
      reason: 'empty' | 'bad-json' | 'unknown-type' | 'dropped-body' | 'ignored'
    }

export type RolloutLineType =
  | 'session_meta'
  | 'turn_context'
  | 'token_usage_record'
  | 'event_msg'
  | string
