import { describe, expect, it } from 'vitest'
import {
  catalogFromModels,
  parseModelPricingMarkdown,
} from '../src/pricing/parse'

const SAMPLE = `
## Cursor Models

| Model | Provider | Input | Cache write | Cache read | Output | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| [Grok 4.7](https://x.ai/news/grok-4-7) | Cursor | $2 | - | $0.5 | $6 | Fast mode is available at 2x pricing |
| Grok 4.7 (Fast) | Cursor | $4 | - | $1 | $12 | Jointly trained |
| [Composer 2.5](https://cursor.com/blog/composer-2-5) | Cursor | $0.5 | - | $0.2 | $2.5 | - |

## Other Models

### Model pricing

| Model | Provider | Input | Cache write | Cache read | Output | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [Claude 4 Sonnet](https://www.anthropic.com/claude/sonnet) | Anthropic | $3 | $3.75 | $0.3 | $15 | Hidden by default; Thinking variant counts as 2 requests |
| [GPT-5 Fast](https://openai.com/index/gpt-5/) | OpenAI | $2.5 | - | $0.25 | $20 | Hidden by default; Faster speed but 2x price |

## Plans

| Plan | Price | Cursor Models | Other Models |
| --- | --- | --- | --- |
| **Pro** | $20/mo | Included | Included |
`

describe('parseModelPricingMarkdown', () => {
  const models = parseModelPricingMarkdown(SAMPLE)

  it('reads Cursor and other-model tables and skips the plans table', () => {
    expect(models.map((model) => model.name)).toEqual([
      'Grok 4.7',
      'Grok 4.7 (Fast)',
      'Composer 2.5',
      'Claude 4 Sonnet',
      'GPT-5 Fast',
    ])
    expect(models.map((model) => model.pool)).toEqual([
      'cursor',
      'cursor',
      'cursor',
      'other',
      'other',
    ])
  })

  it('keeps per-million prices and treats a dash as missing', () => {
    expect(models[0]).toMatchObject({
      provider: 'Cursor',
      input: '$2',
      cacheWrite: null,
      cacheRead: '$0.5',
      output: '$6',
    })
    expect(models[3]?.cacheWrite).toBe('$3.75')
  })

  it('marks Fast variant rows and Hidden by default, not notes that only mention Fast', () => {
    expect(models[0]).toMatchObject({ fast: false, hiddenByDefault: false })
    expect(models[1]).toMatchObject({ fast: true, hiddenByDefault: false })
    expect(models[3]).toMatchObject({ fast: false, hiddenByDefault: true })
    expect(models[4]).toMatchObject({ fast: true, hiddenByDefault: true })
  })

  it('counts default visibility and Fast variants', () => {
    const catalog = catalogFromModels(models, '2026-09-26T00:00:00.000Z')
    expect(catalog.visibleByDefault).toBe(3)
    expect(catalog.hiddenByDefault).toBe(2)
    expect(catalog.fast).toBe(2)
    expect(catalog.error).toBeNull()
  })
})
