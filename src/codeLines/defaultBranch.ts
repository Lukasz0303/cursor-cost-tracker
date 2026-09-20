/** Prefer `main`, then `master`, then optional origin/HEAD short name. */
export function pickDefaultBranch(
  localBranches: readonly string[],
  originHead: string | null = null,
): string | null {
  const set = new Set(localBranches.map((name) => name.trim()).filter(Boolean))
  if (set.has('main')) {
    return 'main'
  }
  if (set.has('master')) {
    return 'master'
  }
  if (originHead !== null) {
    const short = originHead
      .trim()
      .replace(/^refs\/heads\//, '')
      .replace(/^origin\//, '')
    if (short !== '' && set.has(short)) {
      return short
    }
    if (short !== '') {
      return short
    }
  }
  return null
}
