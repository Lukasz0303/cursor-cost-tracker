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
