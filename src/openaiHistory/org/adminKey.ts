/** Secret Storage id for the OpenAI organization admin API key. Never put in settings. */
export const OPENAI_ADMIN_KEY_SECRET = 'cursorCost.openaiAdminApiKey'

export const OPENAI_ADMIN_KEYS_URL =
  'https://platform.openai.com/settings/organization/admin-keys'

export type VerifyAdminKeyResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Prove the admin key works against organization usage without storing buckets.
 * 401/403 = bad key. Other HTTP responses still mean the network path is open.
 */
export async function verifyOpenaiAdminKey(
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifyAdminKeyResult> {
  const trimmed = key.trim()
  if (trimmed.length === 0) {
    return { ok: false, message: 'Admin key is empty.' }
  }
  const end = Math.floor(Date.now() / 1000)
  const start = end - 3600
  const url =
    'https://api.openai.com/v1/organization/usage/completions' +
    `?start_time=${start}&end_time=${end}&bucket_width=1h`
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: 'application/json',
      },
    })
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'OpenAI rejected the admin key.' }
    }
    if (res.ok || res.status === 400) {
      return { ok: true }
    }
    return { ok: false, message: `OpenAI returned HTTP ${res.status}.` }
  } catch {
    return { ok: false, message: 'Could not reach api.openai.com.' }
  }
}
