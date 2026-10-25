import { decompress } from 'fzstd'

export function decompressZstd(bytes: Uint8Array): Uint8Array {
  return decompress(bytes)
}
