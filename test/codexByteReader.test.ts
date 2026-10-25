import { describe, expect, it } from 'vitest'
import {
  MAX_ROLLOUT_LINE_BYTES,
  createByteReader,
} from '../src/openaiHistory/codex/byteReader'

describe('createByteReader', () => {
  it('reassembles a JSONL line split across chunks', () => {
    const line = '{"type":"session_meta","payload":{"session_id":"s1"}}'
    const whole = new TextEncoder().encode(`${line}\n`)
    const mid = Math.floor(whole.byteLength / 2)

    const split = createByteReader()
    expect(split.push(whole.subarray(0, mid))).toEqual([])
    expect(split.push(whole.subarray(mid))).toEqual([line])

    const once = createByteReader()
    expect(once.push(whole)).toEqual([line])
  })

  it('reassembles a multibyte UTF-8 character split across chunks', () => {
    // U+20AC (€) is three bytes: E2 82 AC — put it in a dropped text field
    const prefix = '{"type":"user_message","payload":{"text":"'
    const suffix = '"}}\n'
    const euro = new Uint8Array([0xe2, 0x82, 0xac])
    const head = new TextEncoder().encode(prefix)
    const tail = new TextEncoder().encode(suffix)

    const reader = createByteReader()
    const first = new Uint8Array(head.byteLength + 1)
    first.set(head)
    first[head.byteLength] = euro[0]!
    expect(reader.push(first)).toEqual([])

    const second = new Uint8Array(2 + tail.byteLength)
    second[0] = euro[1]!
    second[1] = euro[2]!
    second.set(tail, 2)
    const lines = reader.push(second)
    expect(lines).toHaveLength(1)
    expect(lines[0]!).toContain('€')
    expect(JSON.parse(lines[0]!).payload.text).toBe('€')
  })

  it('reports the second line start as first line bytes including newline', () => {
    const first = '{"a":1}'
    const second = '{"b":2}'
    const chunk = new TextEncoder().encode(`${first}\n${second}\n`)
    const reader = createByteReader()
    const lines = reader.push(chunk)
    expect(lines).toEqual([first, second])
    const starts = reader.lastLineStarts()
    expect(starts[0]).toBe(0)
    expect(starts[1]).toBe(new TextEncoder().encode(`${first}\n`).byteLength)
  })

  it('drops an oversized line and still returns the next short line', () => {
    const oversized = 'x'.repeat(MAX_ROLLOUT_LINE_BYTES + 1)
    const short = '{"type":"ok"}'
    const chunk = new TextEncoder().encode(`${oversized}\n${short}\n`)
    const reader = createByteReader()
    const lines = reader.push(chunk)
    expect(lines).toEqual([short])
    expect(reader.lastDroppedCount()).toBe(1)
  })

  it('strips CR from CRLF line endings', () => {
    const line = '{"type":"session_meta"}'
    const reader = createByteReader()
    expect(reader.push(new TextEncoder().encode(`${line}\r\n`))).toEqual([line])
  })
})
