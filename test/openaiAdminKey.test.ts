import { describe, expect, it, vi } from 'vitest'
import { verifyOpenaiAdminKey } from '../src/openaiHistory/org/adminKey'

describe('verifyOpenaiAdminKey', () => {
  it('rejects an empty key without calling the network', async () => {
    const fetchImpl = vi.fn()
    const result = await verifyOpenaiAdminKey('  ', fetchImpl as typeof fetch)
    expect(result).toEqual({ ok: false, message: 'Admin key is empty.' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('treats 401 as a rejected key', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 401 }))
    const result = await verifyOpenaiAdminKey(
      'sk-admin-x',
      fetchImpl as unknown as typeof fetch,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/rejected/i)
    }
  })

  it('accepts HTTP 200 as a working key', async () => {
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 200 }),
    )
    const result = await verifyOpenaiAdminKey(
      'sk-admin-ok',
      fetchImpl as unknown as typeof fetch,
    )
    expect(result).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledOnce()
    const call = fetchImpl.mock.calls[0]
    expect(call).toBeDefined()
    if (call === undefined) {
      return
    }
    expect(String(call[0])).toContain('organization/usage/completions')
    const headers = call[1]?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBe('Bearer sk-admin-ok')
  })
})
