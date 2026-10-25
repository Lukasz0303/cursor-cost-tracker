import { describe, expect, it } from 'vitest'
import {
  parseWebviewMessage,
  readStoredDayRange,
} from '../src/webview/messages'

describe('parseWebviewMessage', () => {
  it('accepts a leaderboard lock with no payload', () => {
    expect(parseWebviewMessage({ type: 'lockLeaderboard' })).toEqual({
      type: 'lockLeaderboard',
    })
  })

  it('accepts OpenAI connect mode and connect commands', () => {
    expect(parseWebviewMessage({ type: 'openai.setMode', value: 'web' })).toEqual({
      type: 'openai.setMode',
      value: 'web',
    })
    expect(
      parseWebviewMessage({ type: 'openai.connect', mode: 'local' }),
    ).toEqual({
      type: 'openai.connect',
      mode: 'local',
    })
    expect(parseWebviewMessage({ type: 'openai.disconnect' })).toEqual({
      type: 'openai.disconnect',
    })
    expect(parseWebviewMessage({ type: 'openai.setMode', value: 'nope' })).toBeUndefined()
  })

  it('drops empty and unknown commands', () => {
    expect(parseWebviewMessage(null)).toBeUndefined()
    expect(parseWebviewMessage({ type: 'nope' })).toBeUndefined()
    expect(parseWebviewMessage({ ready: true })).toBeUndefined()
  })

  it('keeps flag values strict', () => {
    expect(parseWebviewMessage({ type: 'setShowToday', value: true })).toEqual({
      type: 'setShowToday',
      value: true,
    })
    expect(parseWebviewMessage({ type: 'setShowToday', value: 'true' })).toEqual({
      type: 'setShowToday',
      value: false,
    })
  })

  it('coerces numeric settings the way the panel used to', () => {
    expect(parseWebviewMessage({ type: 'setHistoryLimit', value: '2000' })).toEqual({
      type: 'setHistoryLimit',
      value: 2000,
    })
    expect(
      parseWebviewMessage({ type: 'setRecentQueryCount', value: 'nope' }),
    ).toEqual({
      type: 'setRecentQueryCount',
      value: Number.NaN,
    })
  })

  it('trims leaderboard strings and ignores blank emails', () => {
    expect(
      parseWebviewMessage({
        type: 'runLeaderboardScan',
        from: ' 2026-01-01 ',
        to: 12,
        emails: [' a@b.c ', '', '  '],
      }),
    ).toEqual({
      type: 'runLeaderboardScan',
      from: '2026-01-01',
      to: '',
      emails: ['a@b.c'],
    })
  })

  it('accepts only known optimize depths', () => {
    expect(parseWebviewMessage({ type: 'runOptimize', depth: 'deep' })).toEqual({
      type: 'runOptimize',
      depth: 'deep',
    })
    expect(parseWebviewMessage({ type: 'runOptimize', depth: 'max' })).toEqual({
      type: 'runOptimize',
      depth: undefined,
    })
  })

  it('treats any sample mode other than calendar as last N', () => {
    expect(
      parseWebviewMessage({
        type: 'setHistorySample',
        mode: 'nope',
        limit: 100,
      }),
    ).toEqual({
      type: 'setHistorySample',
      mode: 'lastN',
      limit: 100,
      fromDate: undefined,
      toDate: undefined,
    })
  })

  it('keeps the author message body for the existing parser', () => {
    const raw = { type: 'sendAuthorMessage', body: 'hi', email: 'a@b.c' }
    expect(parseWebviewMessage(raw)).toEqual({
      type: 'sendAuthorMessage',
      body: 'hi',
      email: 'a@b.c',
      raw,
    })
  })

  it('rejects codex.query limits outside 1–100', () => {
    const base = {
      type: 'codex.query',
      correlationId: 'c1',
      filterRevision: 1,
      from: null,
      to: null,
      accountScopeKey: null,
      model: null,
      status: null,
      groupBy: 'none',
      sort: 'time-desc',
      costBasis: 'estimated-api',
      cursor: null,
    }
    expect(parseWebviewMessage({ ...base, limit: 0 })).toBeUndefined()
    expect(parseWebviewMessage({ ...base, limit: 500 })).toBeUndefined()
    expect(parseWebviewMessage({ ...base, limit: 50 })).toMatchObject({
      type: 'codex.query',
      limit: 50,
    })
  })

  it('rejects unsafe codex.query filter strings', () => {
    const base = {
      type: 'codex.query',
      correlationId: 'c1',
      filterRevision: 1,
      from: null,
      to: null,
      model: null,
      status: null,
      groupBy: 'none',
      sort: 'time-desc',
      costBasis: 'estimated-api',
      cursor: null,
      limit: 10,
    }
    expect(
      parseWebviewMessage({ ...base, accountScopeKey: '../etc/passwd' }),
    ).toBeUndefined()
    expect(
      parseWebviewMessage({ ...base, accountScopeKey: 'sk-secret-key' }),
    ).toBeUndefined()
  })

  it('accepts the spend mix bucket string and blanks a non-string', () => {
    expect(parseWebviewMessage({ type: 'setSpendMixBuckets', value: '{"buckets":[]}' })).toEqual({
      type: 'setSpendMixBuckets',
      value: '{"buckets":[]}',
    })
    expect(parseWebviewMessage({ type: 'setSpendMixBuckets', value: 4 })).toEqual({
      type: 'setSpendMixBuckets',
      value: '',
    })
  })

  it('keeps Cursor refresh distinct from codex.refresh', () => {
    expect(parseWebviewMessage({ type: 'refresh' })).toEqual({ type: 'refresh' })
    expect(parseWebviewMessage({ type: 'codex.refresh' })).toEqual({
      type: 'codex.refresh',
    })
  })
})

describe('readStoredDayRange', () => {
  it('reads from and to only when they are strings', () => {
    expect(readStoredDayRange({ from: '2026-01-01', to: '2026-01-31' })).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
    })
    expect(readStoredDayRange({ from: 1 })).toEqual({ from: '', to: '' })
    expect(readStoredDayRange(null)).toEqual({ from: '', to: '' })
  })
})
