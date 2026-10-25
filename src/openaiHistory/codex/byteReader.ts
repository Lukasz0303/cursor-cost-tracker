export const MAX_ROLLOUT_LINE_BYTES = 1_048_576

export class LineTooLongError extends Error {
  constructor(readonly lineByteLength: number) {
    super(`rollout line exceeds ${MAX_ROLLOUT_LINE_BYTES} bytes`)
    this.name = 'LineTooLongError'
  }
}

export type ByteReader = {
  push(chunk: Uint8Array): string[]
  byteOffset(): number
  /** Byte offsets of the start of each line returned by the last `push`. */
  lastLineStarts(): number[]
  lastDroppedCount(): number
}

export function createByteReader(): ByteReader {
  let buffer = new Uint8Array(0)
  let streamOffset = 0
  let lastStarts: number[] = []
  let lastDropped = 0

  return {
    push(chunk: Uint8Array): string[] {
      lastStarts = []
      lastDropped = 0
      if (chunk.byteLength > 0) {
        const next = new Uint8Array(buffer.byteLength + chunk.byteLength)
        next.set(buffer)
        next.set(chunk, buffer.byteLength)
        buffer = next
      }

      const lines: string[] = []
      let searchFrom = 0

      while (searchFrom < buffer.byteLength) {
        const nl = buffer.indexOf(0x0a, searchFrom)
        if (nl < 0) {
          break
        }

        let lineEnd = nl
        if (lineEnd > 0 && buffer[lineEnd - 1] === 0x0d) {
          lineEnd -= 1
        }
        const lineBytes = lineEnd - searchFrom
        if (lineBytes > MAX_ROLLOUT_LINE_BYTES) {
          lastDropped += 1
          streamOffset += nl + 1 - searchFrom
          // leave streamOffset for the next line start after the newline
          searchFrom = nl + 1
          continue
        }

        const slice = buffer.subarray(searchFrom, lineEnd)
        lastStarts.push(streamOffset)
        lines.push(decodeUtf8(slice))
        streamOffset += nl + 1 - searchFrom
        searchFrom = nl + 1
      }

      buffer = buffer.subarray(searchFrom)
      return lines
    },

    byteOffset(): number {
      return streamOffset
    },

    lastLineStarts(): number[] {
      return lastStarts
    },

    lastDroppedCount(): number {
      return lastDropped
    },
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}
