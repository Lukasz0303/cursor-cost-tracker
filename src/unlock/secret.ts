/**
 * esbuild replaces `process.env.CCT_UNLOCK_SECRET` with the contents of
 * `.ai/reports/.unlock-secret` when that file exists, so the real secret never
 * lands in the repository. Builds without the file fall back to the constant
 * below and only verify codes generated with that same fallback.
 */
const FALLBACK_SECRET = 'cct-local-build'

export function unlockSecret(): string {
  const injected = process.env.CCT_UNLOCK_SECRET
  return typeof injected === 'string' && injected.length > 0
    ? injected
    : FALLBACK_SECRET
}
