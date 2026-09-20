import { describe, expect, it } from 'vitest'
import {
  countCheckpointInsertedLines,
  maxCheckpointLinesByComposer,
} from '../src/codeLines/checkpointLines'

describe('countCheckpointInsertedLines', () => {
  it('sums modified line arrays', () => {
    const raw = JSON.stringify({
      files: [
        {
          uri: { path: '/a.ts' },
          originalModelDiffWrtV0: [
            { original: { startLineNumber: 1, endLineNumberExclusive: 1 }, modified: ['a', 'b'] },
            { original: { startLineNumber: 2, endLineNumberExclusive: 3 }, modified: ['c'] },
          ],
        },
      ],
    })
    expect(countCheckpointInsertedLines(raw)).toBe(3)
  })

  it('returns 0 for empty or invalid payloads', () => {
    expect(countCheckpointInsertedLines('{}')).toBe(0)
    expect(countCheckpointInsertedLines('not-json')).toBe(0)
  })
})

describe('maxCheckpointLinesByComposer', () => {
  it('keeps the max per composer (cumulative checkpoints)', () => {
    const map = maxCheckpointLinesByComposer([
      { composerId: 'a', insertedLines: 10 },
      { composerId: 'a', insertedLines: 40 },
      { composerId: 'a', insertedLines: 25 },
      { composerId: 'b', insertedLines: 3 },
    ])
    expect(map.get('a')).toBe(40)
    expect(map.get('b')).toBe(3)
  })
})
