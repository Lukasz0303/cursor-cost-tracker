import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = join(import.meta.dirname, '..')
const messagesJs = readFileSync(join(repoRoot, 'media/src/messages.js'), 'utf8')
const messagesTs = readFileSync(join(repoRoot, 'src/webview/messages.ts'), 'utf8')

function exportedTypes(source: string): Map<string, string> {
  const types = new Map<string, string>()
  for (const match of source.matchAll(/^\s+(\w+): '([^']+)',?$/gm)) {
    const key = match[1]
    const value = match[2]
    if (key === undefined || value === undefined) {
      continue
    }
    types.set(key, value)
  }
  return types
}

function jsFiles(dir: string): string[] {
  const found: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      found.push(...jsFiles(path))
      continue
    }
    if (name.endsWith('.js')) {
      found.push(path)
    }
  }
  return found
}

describe('webview message type constants', () => {
  const types = exportedTypes(messagesJs)

  it('lists the types the views post', () => {
    expect(types.size).toBeGreaterThan(0)
    for (const [key, value] of types) {
      expect(value).toBe(key)
    }
  })

  it('matches a type the host parser handles', () => {
    for (const value of types.values()) {
      expect(messagesTs).toContain(`'${value}'`)
    }
  })

  it('rejects a raw type string in a view', () => {
    const raw: string[] = []
    for (const path of jsFiles(join(repoRoot, 'media/src'))) {
      if (path.endsWith(`${join('media', 'src', 'messages.js')}`)) {
        continue
      }
      const source = readFileSync(path, 'utf8')
      if (source.includes("type: '") || source.includes('.post(\'')) {
        raw.push(path)
      }
    }
    expect(raw).toEqual([])
  })
})
